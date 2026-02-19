// ─────────────────────────────────────────────────────────────────
// Sale Service — Phase 8 Lite: Basic Sales Module
// ─────────────────────────────────────────────────────────────────
//
// Durum Makinesi: DRAFT → APPROVED → (CANCELLED)
//
//   DRAFT:     Satış kalemlerle birlikte oluşturulur, stok düşmez.
//   APPROVED:  Stok atomik olarak düşer (reserveStock).
//   CANCELLED: Stok geri yüklenir (returnStock). Sadece APPROVED'dan.
//
// TRANSACTION FLOW (approveSale):
//
//   ┌─ prisma.$transaction ──────────────────────────────────────┐
//   │  1. Lock sale row (SELECT ... FOR UPDATE)                  │
//   │  2. Validate: status === DRAFT (prevent double approve)    │
//   │  3. Validate: sale.organizationId matches caller           │
//   │  4. For each SaleItem:                                     │
//   │     a. Validate product ∈ org                              │
//   │     b. Lock stock row (FOR UPDATE)                         │
//   │     c. Check: stock.quantity >= requested                  │
//   │     d. INSERT StockMovement (type=OUT, ref=SALE)           │
//   │     e. UPDATE Stock (decrement)                            │
//   │  5. UPDATE Sale status → APPROVED, set approvedAt          │
//   │  6. Publish SALE_APPROVED outbox event                     │
//   └────────────────────────────────────────────────────────────┘
//
// ORGANIZATION ISOLATION:
//   approveSale and cancelSale lock the sale row and verify that
//   sale.organization_id matches the caller's organizationId.
//   reserveStock/returnStock further validate each product and
//   warehouse belong to the same org.
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import {
    withTransaction,
    lockSaleForUpdate,
    generateSequentialNumber,
    type TransactionClient,
} from "@/lib/transaction";
import {
    InvalidOrderStatusError,
    NotFoundError,
    OrganizationMismatchError,
} from "@/lib/errors";
import { publishEvent } from "@/lib/outbox";
import { reserveStock, returnStock } from "./stock.service";
import { SaleStatus } from "@prisma/client";
import type { CreateSaleInput, SaleFilterInput } from "@/schemas/sale.schema";
import type { PaginatedResult } from "@/types";

// ─── Satış Oluşturma (DRAFT) ───

export async function createSale(input: CreateSaleInput, userId: string) {
    return withTransaction(async (tx) => {
        const txClient = tx as TransactionClient;

        // Ardışık satış numarası üret: SAT-YYYY-NNNNN
        const saleNumber = await generateSequentialNumber(
            tx, "SAT", "sales", "sale_number"
        );

        // Toplam tutarı hesapla
        const totalAmount = input.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
        );

        // Satış ve kalemleri oluştur
        const sale = await txClient.sale.create({
            data: {
                organizationId: input.organizationId,
                warehouseId: input.warehouseId,
                saleNumber,
                status: SaleStatus.DRAFT,
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

        return sale;
    });
}

// ─── Satış Onaylama (DRAFT → APPROVED) ───

export async function approveSale(
    saleId: string,
    userId: string,
    organizationId: string,
) {
    return withTransaction(async (tx) => {
        const txClient = tx as TransactionClient;

        // 1. Pessimistic lock ile satışı kilitle
        const sale = await lockSaleForUpdate(tx, saleId);
        if (!sale) {
            throw new NotFoundError("Satış bulunamadı");
        }

        // 2. Org isolation — satış bu organizasyona mı ait?
        if (sale.organization_id !== organizationId) {
            throw new OrganizationMismatchError("Sale", saleId, organizationId);
        }

        // 3. Durum kontrolü — sadece DRAFT onaylanabilir
        if (sale.status !== "DRAFT") {
            throw new InvalidOrderStatusError(sale.status, "APPROVED");
        }

        // 4. Satış kalemlerini getir
        const items = await txClient.saleItem.findMany({
            where: { saleId },
        });

        // 5. Stok düş — her kalem için pessimistic lock + kontrol
        await reserveStock(
            txClient,
            sale.organization_id,
            sale.warehouse_id,
            items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            userId,
            sale.sale_number,
        );

        // 6. Durumu güncelle
        const updated = await txClient.sale.update({
            where: { id: saleId },
            data: {
                status: SaleStatus.APPROVED,
                approvedAt: new Date(),
            },
            include: {
                items: {
                    include: { product: { select: { sku: true, name: true } } },
                },
            },
        });

        // 7. Outbox event
        await publishEvent(tx, "SALE_APPROVED", {
            saleId,
            saleNumber: sale.sale_number,
            organizationId: sale.organization_id,
            userId,
        }, `sale:approve:${saleId}`);

        return updated;
    });
}

// ─── Satış İptal (APPROVED → CANCELLED) ───

export async function cancelSale(
    saleId: string,
    userId: string,
    organizationId: string,
) {
    return withTransaction(async (tx) => {
        const txClient = tx as TransactionClient;

        // 1. Pessimistic lock
        const sale = await lockSaleForUpdate(tx, saleId);
        if (!sale) {
            throw new NotFoundError("Satış bulunamadı");
        }

        // 2. Org isolation
        if (sale.organization_id !== organizationId) {
            throw new OrganizationMismatchError("Sale", saleId, organizationId);
        }

        // 3. Durum kontrolü — sadece APPROVED iptal edilebilir
        if (sale.status !== "APPROVED") {
            throw new InvalidOrderStatusError(sale.status, "CANCELLED");
        }

        // 4. Satış kalemlerini getir
        const items = await txClient.saleItem.findMany({
            where: { saleId },
        });

        // 5. Stok geri yükle
        await returnStock(
            txClient,
            sale.organization_id,
            sale.warehouse_id,
            items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            userId,
            sale.sale_number,
        );

        // 6. Durumu güncelle
        const updated = await txClient.sale.update({
            where: { id: saleId },
            data: {
                status: SaleStatus.CANCELLED,
                cancelledAt: new Date(),
            },
        });

        return updated;
    });
}

// ─── Satış Detayı ───

export async function getSaleById(saleId: string, organizationId: string) {
    const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
            items: {
                include: { product: { select: { sku: true, name: true, unit: true } } },
            },
            warehouse: { select: { code: true, name: true } },
            createdBy: { select: { name: true, email: true } },
        },
    });

    if (!sale) {
        throw new NotFoundError("Satış bulunamadı");
    }

    if (sale.organizationId !== organizationId) {
        throw new OrganizationMismatchError("Sale", saleId, organizationId);
    }

    return sale;
}

// ─── Satış Listesi ───

export async function listSales(
    organizationId: string,
    filter: SaleFilterInput,
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.sale.findFirst>>>> {
    const { page, pageSize, status, search, startDate, endDate } = filter;
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId };

    if (status) where.status = status;
    if (search) {
        where.OR = [
            { saleNumber: { contains: search, mode: "insensitive" } },
            { customerName: { contains: search, mode: "insensitive" } },
        ];
    }
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
    }

    const [sales, total] = await Promise.all([
        prisma.sale.findMany({
            where,
            include: {
                warehouse: { select: { code: true, name: true } },
                createdBy: { select: { name: true } },
                _count: { select: { items: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
        }),
        prisma.sale.count({ where }),
    ]);

    return {
        data: sales,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}
