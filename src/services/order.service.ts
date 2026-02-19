// ─────────────────────────────────────────────────────────────────
// Order Service — İş Mantığı Katmanı
// ─────────────────────────────────────────────────────────────────
// Sipariş durum makinesi:
//   DRAFT → APPROVED → (CANCELLED)
//
// Kritik kurallar:
//   1. Sipariş DRAFT olarak oluşturulur, stok düşmez.
//   2. Onay anında stok atomik olarak düşer (reserveStockForOrder).
//   3. İptal sadece APPROVED siparişlerde yapılabilir.
//   4. İptal edilince stok geri yüklenir (returnStockForCancel).
//   5. Sipariş numarası transaction-safe sequential: SIP-YYYY-NNNNN
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { withTransaction, lockOrderForUpdate, generateSequentialNumber } from "@/lib/transaction";
import { InvalidOrderStatusError, NotFoundError } from "@/lib/errors";
import { publishEvent } from "@/lib/outbox";
import { reserveStockForOrder, returnStockForCancel } from "./stock.service";
import { OrderStatus, type PrismaClient } from "@prisma/client";
import type { CreateOrderInput, OrderFilterInput } from "@/schemas/order.schema";
import type { PaginatedResult } from "@/types";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ─── Sipariş Oluşturma (DRAFT) ───
export async function createOrder(
    input: CreateOrderInput,
    userId: string
) {
    return withTransaction(async (tx) => {
        const txClient = tx as unknown as TxClient;

        // Ardışık sipariş numarası üret
        const orderNumber = await generateSequentialNumber(tx, "SIP", "orders", "order_number");

        // Toplam tutarı hesapla
        const totalAmount = input.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
        );

        // Sipariş ve kalemleri oluştur
        const order = await txClient.order.create({
            data: {
                orderNumber,
                status: OrderStatus.DRAFT,
                customerName: input.customerName,
                totalAmount,
                note: input.note,
                createdById: userId,
                items: {
                    create: input.items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.quantity * item.unitPrice,
                    })),
                },
            },
            include: {
                items: {
                    include: { product: { select: { sku: true, name: true } } },
                },
            },
        });

        return order;
    });
}

// ─── Sipariş Onaylama (DRAFT → APPROVED) ───
export async function approveOrder(orderId: string, userId: string) {
    return withTransaction(async (tx) => {
        const txClient = tx as unknown as TxClient;

        // Pessimistic lock ile siparişi kilitle
        const order = await lockOrderForUpdate(tx, orderId);
        if (!order) {
            throw new NotFoundError("Sipariş bulunamadı");
        }

        if (order.status !== "DRAFT") {
            throw new InvalidOrderStatusError(order.status, "APPROVED");
        }

        // Sipariş kalemlerini getir
        const items = await txClient.orderItem.findMany({
            where: { orderId },
        });

        // Stok düş — her kalem için pessimistic lock + kontrol
        await reserveStockForOrder(
            txClient,
            items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            userId,
            order.order_number
        );

        // Durumu güncelle
        const updated = await txClient.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.APPROVED,
                approvedAt: new Date(),
            },
            include: {
                items: {
                    include: { product: { select: { sku: true, name: true } } },
                },
            },
        });

        // Outbox: Async fatura oluşturma tetikle
        await publishEvent(tx, "ORDER_APPROVED", {
            orderId, orderNumber: order.order_number, userId,
        }, `order:approve:${orderId}`);

        return updated;
    });
}

// ─── Sipariş İptal (APPROVED → CANCELLED) ───
export async function cancelOrder(orderId: string, userId: string) {
    return withTransaction(async (tx) => {
        const txClient = tx as unknown as TxClient;

        const order = await lockOrderForUpdate(tx, orderId);
        if (!order) {
            throw new NotFoundError("Sipariş bulunamadı");
        }

        if (order.status !== "APPROVED") {
            throw new InvalidOrderStatusError(order.status, "CANCELLED");
        }

        // Sipariş kalemlerini getir
        const items = await txClient.orderItem.findMany({
            where: { orderId },
        });

        // Stok geri yükle
        await returnStockForCancel(
            txClient,
            items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            userId,
            order.order_number
        );

        const updated = await txClient.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.CANCELLED,
                cancelledAt: new Date(),
            },
        });

        return updated;
    });
}

// ─── Sipariş Detayı ───
export async function getOrderById(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: {
                include: { product: { select: { sku: true, name: true, unit: true } } },
            },
            createdBy: { select: { name: true, email: true } },
            invoices: { select: { id: true, invoiceNumber: true, createdAt: true } },
        },
    });

    if (!order) {
        throw new NotFoundError("Sipariş bulunamadı");
    }

    return order;
}

// ─── Sipariş Listesi ───
export async function listOrders(
    filter: OrderFilterInput
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.order.findFirst>>>> {
    const { page, pageSize, status, search, startDate, endDate } = filter;
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status) where.status = status;
    if (search) {
        where.OR = [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { customerName: { contains: search, mode: "insensitive" } },
        ];
    }
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
    }

    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where,
            include: {
                createdBy: { select: { name: true } },
                _count: { select: { items: true, invoices: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
        }),
        prisma.order.count({ where }),
    ]);

    return {
        data: orders,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}
