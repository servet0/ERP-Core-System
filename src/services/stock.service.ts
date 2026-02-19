// ─────────────────────────────────────────────────────────────────
// Stock Service — İş Mantığı Katmanı (Phase 7A: Multi-Warehouse)
// ─────────────────────────────────────────────────────────────────
// Kritik iş kuralları:
//   1. Stok giriş/çıkış her zaman transaction içinde yapılır.
//   2. Pessimistic locking (SELECT FOR UPDATE) ile race condition engellenir.
//   3. quantity her zaman pozitif — yön StockMovementType'dan anlaşılır.
//   4. Stock.quantity denormalize alan — transaction içinde güncellenir.
//   5. Her işlem org-scoped: organizationId zorunlu.
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { InsufficientStockError, NotFoundError } from "@/lib/errors";
import { withTransaction } from "@/lib/transaction";
import { publishEvent } from "@/lib/outbox";
import { StockMovementType, StockReferenceType, type Prisma, type PrismaClient } from "@prisma/client";
import type { StockMovementFilterInput } from "@/schemas/stock.schema";
import type { PaginatedResult } from "@/types";

// ── Transaction Client tipi ──
type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ── Stok kaydını kilitle (SELECT FOR UPDATE) ──
async function lockStockForUpdate(
    tx: Prisma.TransactionClient,
    productId: string,
    warehouseId: string,
) {
    const results = await (tx as unknown as PrismaClient).$queryRaw<
        Array<{ id: string; quantity: number; min_quantity: number; product_id: string; warehouse_id: string }>
    >`
        SELECT id, quantity, min_quantity, product_id, warehouse_id
        FROM stocks
        WHERE product_id = ${productId}
          AND warehouse_id = ${warehouseId}
        FOR UPDATE
    `;
    return results[0] ?? null;
}

// ─── Stok Giriş (IN) ───
export async function addStock(
    organizationId: string,
    productId: string,
    warehouseId: string,
    quantity: number,
    userId: string,
    note?: string
): Promise<void> {
    await withTransaction(async (tx) => {
        const stock = await lockStockForUpdate(tx, productId, warehouseId);

        if (stock) {
            // Mevcut stok kaydını güncelle
            await (tx as unknown as TxClient).stock.update({
                where: { productId_warehouseId: { productId, warehouseId } },
                data: { quantity: { increment: quantity } },
            });
        } else {
            // Yeni stok kaydı oluştur
            await (tx as unknown as TxClient).stock.create({
                data: {
                    organizationId,
                    productId,
                    warehouseId,
                    quantity,
                },
            });
        }

        // Hareket kaydı oluştur
        await (tx as unknown as TxClient).stockMovement.create({
            data: {
                organizationId,
                productId,
                warehouseId,
                type: StockMovementType.IN,
                referenceType: StockReferenceType.MANUAL,
                quantity,
                note,
                createdById: userId,
            },
        });
    });
}

// ─── Stok Çıkış (OUT — Manuel) ───
export async function removeStock(
    organizationId: string,
    productId: string,
    warehouseId: string,
    quantity: number,
    userId: string,
    note?: string
): Promise<void> {
    await withTransaction(async (tx) => {
        const stock = await lockStockForUpdate(tx, productId, warehouseId);
        if (!stock) {
            throw new NotFoundError("Bu ürün için stok kaydı bulunamadı");
        }

        if (stock.quantity < quantity) {
            // Ürün SKU'sunu al
            const product = await (tx as unknown as TxClient).product.findUnique({
                where: { id: productId },
                select: { sku: true },
            });
            throw new InsufficientStockError(
                product?.sku ?? productId,
                stock.quantity,
                quantity
            );
        }

        await (tx as unknown as TxClient).stock.update({
            where: { productId_warehouseId: { productId, warehouseId } },
            data: { quantity: { decrement: quantity } },
        });

        await (tx as unknown as TxClient).stockMovement.create({
            data: {
                organizationId,
                productId,
                warehouseId,
                type: StockMovementType.OUT,
                referenceType: StockReferenceType.MANUAL,
                quantity,
                note,
                createdById: userId,
            },
        });

        // Low stock kontrolü
        const newQty = stock.quantity - quantity;
        if (newQty <= stock.min_quantity && stock.min_quantity > 0) {
            const product = await (tx as unknown as TxClient).product.findUnique({
                where: { id: productId },
                select: { sku: true },
            });
            await publishEvent(tx, "LOW_STOCK", {
                productId, warehouseId,
                sku: product?.sku ?? productId,
                currentStock: newQty,
                minStock: stock.min_quantity,
            }, `low_stock:${productId}:${warehouseId}:${Math.floor(Date.now() / 60000)}`);
        }
    });
}

// ─── Sipariş Onayında Stok Düşme (SALE OUT) ───
// OrderService tarafından transaction içinde çağrılır
export async function reserveStockForOrder(
    tx: TxClient,
    organizationId: string,
    warehouseId: string,
    items: Array<{ productId: string; quantity: number }>,
    userId: string,
    orderNumber: string
): Promise<void> {
    for (const item of items) {
        const stock = await lockStockForUpdate(tx as unknown as Prisma.TransactionClient, item.productId, warehouseId);
        if (!stock) {
            throw new NotFoundError(`Ürün için stok kaydı bulunamadı: ${item.productId}`);
        }

        if (stock.quantity < item.quantity) {
            const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { sku: true },
            });
            throw new InsufficientStockError(
                product?.sku ?? item.productId,
                stock.quantity,
                item.quantity
            );
        }

        await tx.stock.update({
            where: { productId_warehouseId: { productId: item.productId, warehouseId } },
            data: { quantity: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
            data: {
                organizationId,
                productId: item.productId,
                warehouseId,
                type: StockMovementType.OUT,
                referenceType: StockReferenceType.SALE,
                quantity: item.quantity,
                reference: orderNumber,
                createdById: userId,
            },
        });
    }
}

// ─── Sipariş İptalinde Stok İade ───
// OrderService tarafından transaction içinde çağrılır
export async function returnStockForCancel(
    tx: TxClient,
    organizationId: string,
    warehouseId: string,
    items: Array<{ productId: string; quantity: number }>,
    userId: string,
    orderNumber: string
): Promise<void> {
    for (const item of items) {
        await tx.stock.update({
            where: { productId_warehouseId: { productId: item.productId, warehouseId } },
            data: { quantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
            data: {
                organizationId,
                productId: item.productId,
                warehouseId,
                type: StockMovementType.IN,
                referenceType: StockReferenceType.SALE,
                quantity: item.quantity,
                reference: orderNumber,
                note: "Sipariş iptali — stok iade",
                createdById: userId,
            },
        });
    }
}

// ─── Stok Hareketleri Listesi ───
export async function listStockMovements(
    filter: StockMovementFilterInput
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.stockMovement.findFirst>>>> {
    const { page, pageSize, productId, type, startDate, endDate } = filter;
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
    }

    const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({
            where,
            include: {
                product: { select: { sku: true, name: true } },
                warehouse: { select: { code: true, name: true } },
                createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
        }),
        prisma.stockMovement.count({ where }),
    ]);

    return {
        data: movements,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}
