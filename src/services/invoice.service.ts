// ─────────────────────────────────────────────────────────────────
// Invoice Service — İş Mantığı Katmanı
// ─────────────────────────────────────────────────────────────────
// Faturalar salt okunurdur:
//   - Oluşturulduktan sonra DEĞİŞTİRİLEMEZ (update yok).
//   - Sadece APPROVED siparişler için oluşturulabilir.
//   - Aynı sipariş için en fazla bir fatura olabilir.
//   - Numara formatı: FAT-YYYY-NNNNN (transaction-safe)
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { withTransaction, generateSequentialNumber } from "@/lib/transaction";
import { DuplicateInvoiceError, InvalidOrderStatusError, NotFoundError } from "@/lib/errors";
import type { PrismaClient } from "@prisma/client";
import type { InvoiceFilterInput } from "@/schemas/invoice.schema";
import type { PaginatedResult } from "@/types";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ─── Fatura Oluşturma ───
export async function createInvoice(orderId: string, userId: string) {
    return withTransaction(async (tx) => {
        const txClient = tx as unknown as TxClient;

        // Siparişi kontrol et
        const order = await txClient.order.findUnique({
            where: { id: orderId },
            include: {
                invoices: { select: { id: true } },
            },
        });

        if (!order) {
            throw new NotFoundError("Sipariş bulunamadı");
        }

        if (order.status !== "APPROVED") {
            throw new InvalidOrderStatusError(order.status, "INVOICE_CREATE");
        }

        // Aynı sipariş için zaten fatura var mı?
        if (order.invoices.length > 0) {
            throw new DuplicateInvoiceError(order.orderNumber);
        }

        // Ardışık fatura numarası üret
        const invoiceNumber = await generateSequentialNumber(tx, "FAT", "invoices", "invoice_number");

        const invoice = await txClient.invoice.create({
            data: {
                invoiceNumber,
                orderId,
                totalAmount: order.totalAmount,
                createdById: userId,
            },
            include: {
                order: {
                    select: {
                        orderNumber: true,
                        customerName: true,
                        items: {
                            include: { product: { select: { sku: true, name: true, unit: true } } },
                        },
                    },
                },
                createdBy: { select: { name: true } },
            },
        });

        return invoice;
    });
}

// ─── Fatura Detayı ───
export async function getInvoiceById(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            order: {
                include: {
                    items: {
                        include: { product: { select: { sku: true, name: true, unit: true } } },
                    },
                },
            },
            createdBy: { select: { name: true, email: true } },
        },
    });

    if (!invoice) {
        throw new NotFoundError("Fatura bulunamadı");
    }

    return invoice;
}

// ─── Fatura Listesi ───
export async function listInvoices(
    filter: InvoiceFilterInput
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.invoice.findFirst>>>> {
    const { page, pageSize, search, startDate, endDate } = filter;
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
        where.OR = [
            { invoiceNumber: { contains: search, mode: "insensitive" } },
            { order: { customerName: { contains: search, mode: "insensitive" } } },
            { order: { orderNumber: { contains: search, mode: "insensitive" } } },
        ];
    }
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
    }

    const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
            where,
            include: {
                order: { select: { orderNumber: true, customerName: true } },
                createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
        }),
        prisma.invoice.count({ where }),
    ]);

    return {
        data: invoices,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}
