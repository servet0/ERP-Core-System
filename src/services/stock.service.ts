// ─────────────────────────────────────────────────────────────────
// Stock Service — İş Mantığı Katmanı
// ─────────────────────────────────────────────────────────────────
// Kritik iş kuralları:
//   1. Stok giriş/çıkış her zaman transaction içinde yapılır.
//   2. Pessimistic locking (SELECT FOR UPDATE) ile race condition engellenir.
//   3. quantity her zaman pozitif — yön MovementType'dan anlaşılır.
//   4. currentStock denormalize alan — transaction içinde güncellenir.
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { InsufficientStockError, NotFoundError } from "@/lib/errors";
import { withTransaction, lockProductForUpdate } from "@/lib/transaction";
import { publishEvent } from "@/lib/outbox";
import { MovementType, type Prisma, type PrismaClient } from "@prisma/client";
import type { StockMovementFilterInput } from "@/schemas/stock.schema";
import type { PaginatedResult } from "@/types";

// ── Transaction Client tipi ──
type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ─── Stok Giriş (IN) ───
export async function addStock(
    productId: string,
    quantity: number,
    userId: string,
    note?: string
): Promise<void> {
    await withTransaction(async (tx) => {
        // Pessimistic lock — diğer işlemler bu ürünü bekler
        const product = await lockProductForUpdate(tx, productId);
        if (!product) {
            throw new NotFoundError("Ürün bulunamadı");
        }

        // currentStock güncelle
        await (tx as unknown as TxClient).product.update({
            where: { id: productId },
            data: { currentStock: { increment: quantity } },
        });

        // Hareket kaydı oluştur
        await (tx as unknown as TxClient).stockMovement.create({
            data: {
                productId,
                type: MovementType.IN,
                quantity,
                note,
                createdById: userId,
            },
        });
    });
}

// ─── Stok Çıkış (OUT — Manuel) ───
export async function removeStock(
    productId: string,
    quantity: number,
    userId: string,
    note?: string
): Promise<void> {
    await withTransaction(async (tx) => {
        const product = await lockProductForUpdate(tx, productId);
        if (!product) {
            throw new NotFoundError("Ürün bulunamadı");
        }

        // Yeterli stok kontrolü
        if (product.current_stock < quantity) {
            throw new InsufficientStockError(
                product.sku,
                product.current_stock,
                quantity
            );
        }

        await (tx as unknown as TxClient).product.update({
            where: { id: productId },
            data: { currentStock: { decrement: quantity } },
        });

        await (tx as unknown as TxClient).stockMovement.create({
            data: {
                productId,
                type: MovementType.OUT,
                quantity,
                note,
                createdById: userId,
            },
        });

        // Low stock kontrolü — stok minimum seviyeye düştüyse event yayınla
        const newStock = product.current_stock - quantity;
        if (newStock <= product.min_stock && product.min_stock > 0) {
            await publishEvent(tx, "LOW_STOCK", {
                productId, sku: product.sku,
                currentStock: newStock, minStock: product.min_stock,
            }, `low_stock:${productId}:${Math.floor(Date.now() / 60000)}`);
        }
    });
}

// ─── Sipariş Onayında Stok Düşme (ORDER_OUT) ───
// OrderService tarafından transaction içinde çağrılır
export async function reserveStockForOrder(
    tx: TxClient,
    items: Array<{ productId: string; quantity: number }>,
    userId: string,
    orderNumber: string
): Promise<void> {
    for (const item of items) {
        const product = await lockProductForUpdate(tx as unknown as Prisma.TransactionClient, item.productId);
        if (!product) {
            throw new NotFoundError(`Ürün bulunamadı: ${item.productId}`);
        }

        if (product.current_stock < item.quantity) {
            throw new InsufficientStockError(
                product.sku,
                product.current_stock,
                item.quantity
            );
        }

        await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
            data: {
                productId: item.productId,
                type: MovementType.ORDER_OUT,
                quantity: item.quantity,
                reference: orderNumber,
                createdById: userId,
            },
        });
    }
}

// ─── Sipariş İptalinde Stok İade (CANCEL_IN) ───
// OrderService tarafından transaction içinde çağrılır
export async function returnStockForCancel(
    tx: TxClient,
    items: Array<{ productId: string; quantity: number }>,
    userId: string,
    orderNumber: string
): Promise<void> {
    for (const item of items) {
        await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
            data: {
                productId: item.productId,
                type: MovementType.CANCEL_IN,
                quantity: item.quantity,
                reference: orderNumber,
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
