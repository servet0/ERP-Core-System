// ─────────────────────────────────────────────────────────────────
// Stock Service — Phase 7B: Transaction-Safe Stock Engine
// ─────────────────────────────────────────────────────────────────
//
// TRANSACTION FLOW (for every stock mutation):
//
//   ┌─ prisma.$transaction ──────────────────────────────────────┐
//   │  1. Validate: product exists + belongs to organizationId   │
//   │  2. Validate: warehouse exists + belongs to organizationId │
//   │  3. SELECT ... FOR UPDATE on stocks row (pessimistic lock) │
//   │  4. Business rule check (e.g., sufficient stock)           │
//   │  5. INSERT StockMovement (audit trail — written first)     │
//   │  6. UPSERT/UPDATE Stock.quantity (denormalized balance)    │
//   │  7. Publish outbox event if low-stock threshold hit        │
//   └────────────────────────────────────────────────────────────┘
//
// WHY StockMovement FIRST?
//   If a failure occurs between step 5 and 6, the movement record
//   exists but the balance wasn't updated — a reconciliation job
//   can detect and fix this. The reverse (balance updated but no
//   movement record) is unrecoverable.
//
// ORGANIZATION ISOLATION:
//   Every public function requires organizationId. Before any
//   mutation, we verify that both the product and warehouse
//   belong to the caller's organization. This prevents cross-
//   tenant data leaks even if IDs are guessed.
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import {
    InsufficientStockError,
    NotFoundError,
    OrganizationMismatchError,
    ValidationError,
} from "@/lib/errors";
import { withTransaction, type TransactionClient } from "@/lib/transaction";
import { publishEvent } from "@/lib/outbox";
import { StockMovementType, StockReferenceType, type PrismaClient } from "@prisma/client";
import type { StockMovementFilterInput } from "@/schemas/stock.schema";
import type { PaginatedResult } from "@/types";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/** Locked stock row returned from SELECT ... FOR UPDATE */
interface LockedStockRow {
    id: string;
    organization_id: string;
    product_id: string;
    warehouse_id: string;
    quantity: number;
    min_quantity: number;
}

/** Common parameters every stock mutation needs */
interface StockMutationParams {
    organizationId: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    userId: string;
    referenceType: StockReferenceType;
    reference?: string;
    note?: string;
}

/** Return value of stock mutations for caller convenience */
export interface StockMutationResult {
    movementId: string;
    previousQuantity: number;
    newQuantity: number;
    productId: string;
    warehouseId: string;
}

// ─────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Validate that a product exists and belongs to the given organization.
 * Throws NotFoundError or OrganizationMismatchError.
 */
async function validateProductOwnership(
    tx: TransactionClient,
    productId: string,
    organizationId: string,
): Promise<{ sku: string }> {
    const product = await tx.product.findUnique({
        where: { id: productId },
        select: { sku: true, organizationId: true },
    });

    if (!product) {
        throw new NotFoundError("Ürün bulunamadı", productId);
    }

    if (product.organizationId !== organizationId) {
        throw new OrganizationMismatchError("Product", productId, organizationId);
    }

    return { sku: product.sku };
}

/**
 * Validate that a warehouse exists and belongs to the given organization.
 * Throws NotFoundError or OrganizationMismatchError.
 */
async function validateWarehouseOwnership(
    tx: TransactionClient,
    warehouseId: string,
    organizationId: string,
): Promise<void> {
    const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
        select: { organizationId: true },
    });

    if (!warehouse) {
        throw new NotFoundError("Depo bulunamadı", warehouseId);
    }

    if (warehouse.organizationId !== organizationId) {
        throw new OrganizationMismatchError("Warehouse", warehouseId, organizationId);
    }
}

/**
 * Acquire a pessimistic lock (SELECT ... FOR UPDATE) on the stock row
 * for a given product × warehouse pair. Returns null if no row exists.
 */
async function lockStockForUpdate(
    tx: TransactionClient,
    productId: string,
    warehouseId: string,
): Promise<LockedStockRow | null> {
    const results = await (tx as unknown as PrismaClient).$queryRaw<LockedStockRow[]>`
        SELECT id, organization_id, product_id, warehouse_id, quantity, min_quantity
        FROM stocks
        WHERE product_id = ${productId}
          AND warehouse_id = ${warehouseId}
        FOR UPDATE
    `;
    return results[0] ?? null;
}

/**
 * Emit a LOW_STOCK outbox event when quantity drops at or below minQuantity.
 */
async function emitLowStockEventIfNeeded(
    tx: TransactionClient,
    params: {
        productId: string;
        warehouseId: string;
        sku: string;
        newQuantity: number;
        minQuantity: number;
    },
): Promise<void> {
    if (params.minQuantity > 0 && params.newQuantity <= params.minQuantity) {
        await publishEvent(tx, "LOW_STOCK", {
            productId: params.productId,
            warehouseId: params.warehouseId,
            sku: params.sku,
            currentStock: params.newQuantity,
            minStock: params.minQuantity,
        }, `low_stock:${params.productId}:${params.warehouseId}:${Math.floor(Date.now() / 60000)}`);
    }
}

// ─────────────────────────────────────────────────────────────────
// Public API — Core Stock Mutations
// ─────────────────────────────────────────────────────────────────

/**
 * Increase stock quantity (StockMovementType.IN).
 *
 * Creates the stock record if it doesn't exist yet (first delivery
 * to this warehouse). Always positive quantity.
 *
 * Flow:
 *   1. Validate product ∈ org
 *   2. Validate warehouse ∈ org
 *   3. Lock existing stock row (if any)
 *   4. INSERT StockMovement
 *   5. UPSERT Stock (create or increment)
 */
export async function increaseStock(params: StockMutationParams): Promise<StockMutationResult> {
    if (params.quantity <= 0) {
        throw new ValidationError("Miktar pozitif olmalıdır", {
            quantity: ["Miktar 0'dan büyük olmalıdır"],
        });
    }

    return withTransaction(async (tx) => {
        // ── Step 1–2: Org isolation ──
        await validateProductOwnership(tx, params.productId, params.organizationId);
        await validateWarehouseOwnership(tx, params.warehouseId, params.organizationId);

        // ── Step 3: Pessimistic lock ──
        const existingStock = await lockStockForUpdate(tx, params.productId, params.warehouseId);
        const previousQuantity = existingStock?.quantity ?? 0;
        const newQuantity = previousQuantity + params.quantity;

        // ── Step 4: INSERT movement (audit trail first) ──
        const movement = await tx.stockMovement.create({
            data: {
                organizationId: params.organizationId,
                productId: params.productId,
                warehouseId: params.warehouseId,
                type: StockMovementType.IN,
                referenceType: params.referenceType,
                quantity: params.quantity,
                reference: params.reference,
                note: params.note,
                createdById: params.userId,
            },
        });

        // ── Step 5: UPSERT stock balance ──
        if (existingStock) {
            await tx.stock.update({
                where: { productId_warehouseId: { productId: params.productId, warehouseId: params.warehouseId } },
                data: { quantity: { increment: params.quantity } },
            });
        } else {
            await tx.stock.create({
                data: {
                    organizationId: params.organizationId,
                    productId: params.productId,
                    warehouseId: params.warehouseId,
                    quantity: params.quantity,
                    minQuantity: 0,
                },
            });
        }

        return {
            movementId: movement.id,
            previousQuantity,
            newQuantity,
            productId: params.productId,
            warehouseId: params.warehouseId,
        };
    });
}

/**
 * Decrease stock quantity (StockMovementType.OUT).
 *
 * Prevents negative stock — throws InsufficientStockError if
 * the requested quantity exceeds available balance.
 *
 * Flow:
 *   1. Validate product ∈ org
 *   2. Validate warehouse ∈ org
 *   3. Lock stock row (must exist)
 *   4. Check: stock.quantity >= requested
 *   5. INSERT StockMovement
 *   6. UPDATE Stock (decrement)
 *   7. Emit LOW_STOCK event if threshold breached
 */
export async function decreaseStock(params: StockMutationParams): Promise<StockMutationResult> {
    if (params.quantity <= 0) {
        throw new ValidationError("Miktar pozitif olmalıdır", {
            quantity: ["Miktar 0'dan büyük olmalıdır"],
        });
    }

    return withTransaction(async (tx) => {
        // ── Step 1–2: Org isolation ──
        const { sku } = await validateProductOwnership(tx, params.productId, params.organizationId);
        await validateWarehouseOwnership(tx, params.warehouseId, params.organizationId);

        // ── Step 3: Pessimistic lock ──
        const existingStock = await lockStockForUpdate(tx, params.productId, params.warehouseId);
        if (!existingStock) {
            throw new NotFoundError(
                `Stok kaydı bulunamadı: ${params.productId} × ${params.warehouseId}`
            );
        }

        // ── Step 4: Negative stock prevention ──
        if (existingStock.quantity < params.quantity) {
            throw new InsufficientStockError(sku, existingStock.quantity, params.quantity);
        }

        const previousQuantity = existingStock.quantity;
        const newQuantity = previousQuantity - params.quantity;

        // ── Step 5: INSERT movement (audit trail first) ──
        const movement = await tx.stockMovement.create({
            data: {
                organizationId: params.organizationId,
                productId: params.productId,
                warehouseId: params.warehouseId,
                type: StockMovementType.OUT,
                referenceType: params.referenceType,
                quantity: params.quantity,
                reference: params.reference,
                note: params.note,
                createdById: params.userId,
            },
        });

        // ── Step 6: UPDATE stock balance ──
        await tx.stock.update({
            where: { productId_warehouseId: { productId: params.productId, warehouseId: params.warehouseId } },
            data: { quantity: { decrement: params.quantity } },
        });

        // ── Step 7: Low stock event ──
        await emitLowStockEventIfNeeded(tx, {
            productId: params.productId,
            warehouseId: params.warehouseId,
            sku,
            newQuantity,
            minQuantity: existingStock.min_quantity,
        });

        return {
            movementId: movement.id,
            previousQuantity,
            newQuantity,
            productId: params.productId,
            warehouseId: params.warehouseId,
        };
    });
}

/**
 * Adjust stock to a target quantity (StockMovementType.ADJUSTMENT).
 *
 * Used for inventory reconciliation: sets the stock to an absolute
 * target value by computing a delta. The delta is recorded as a
 * single movement. Target must be >= 0 (no negative stock).
 *
 * Flow:
 *   1. Validate product ∈ org
 *   2. Validate warehouse ∈ org
 *   3. Lock stock row (must exist)
 *   4. Compute delta = targetQuantity − current
 *   5. INSERT StockMovement (with computed delta)
 *   6. UPDATE Stock (set to target)
 *   7. Emit LOW_STOCK event if threshold breached
 */
export async function adjustStock(params: {
    organizationId: string;
    productId: string;
    warehouseId: string;
    targetQuantity: number;
    userId: string;
    reference?: string;
    note?: string;
}): Promise<StockMutationResult> {
    if (params.targetQuantity < 0) {
        throw new ValidationError("Hedef miktar negatif olamaz", {
            targetQuantity: ["Hedef miktar 0 veya üzeri olmalıdır"],
        });
    }

    return withTransaction(async (tx) => {
        // ── Step 1–2: Org isolation ──
        const { sku } = await validateProductOwnership(tx, params.productId, params.organizationId);
        await validateWarehouseOwnership(tx, params.warehouseId, params.organizationId);

        // ── Step 3: Pessimistic lock ──
        const existingStock = await lockStockForUpdate(tx, params.productId, params.warehouseId);
        if (!existingStock) {
            throw new NotFoundError(
                `Stok kaydı bulunamadı: ${params.productId} × ${params.warehouseId}`
            );
        }

        const previousQuantity = existingStock.quantity;
        const delta = params.targetQuantity - previousQuantity;

        // No-op: nothing to adjust
        if (delta === 0) {
            return {
                movementId: "",
                previousQuantity,
                newQuantity: previousQuantity,
                productId: params.productId,
                warehouseId: params.warehouseId,
            };
        }

        // ── Step 4: INSERT movement (audit trail first) ──
        const movement = await tx.stockMovement.create({
            data: {
                organizationId: params.organizationId,
                productId: params.productId,
                warehouseId: params.warehouseId,
                type: StockMovementType.ADJUSTMENT,
                referenceType: StockReferenceType.MANUAL,
                quantity: Math.abs(delta),
                reference: params.reference,
                note: params.note ?? `Sayım düzeltmesi: ${previousQuantity} → ${params.targetQuantity}`,
                createdById: params.userId,
            },
        });

        // ── Step 5: UPDATE stock to target ──
        await tx.stock.update({
            where: { productId_warehouseId: { productId: params.productId, warehouseId: params.warehouseId } },
            data: { quantity: params.targetQuantity },
        });

        // ── Step 6: Low stock event ──
        await emitLowStockEventIfNeeded(tx, {
            productId: params.productId,
            warehouseId: params.warehouseId,
            sku,
            newQuantity: params.targetQuantity,
            minQuantity: existingStock.min_quantity,
        });

        return {
            movementId: movement.id,
            previousQuantity,
            newQuantity: params.targetQuantity,
            productId: params.productId,
            warehouseId: params.warehouseId,
        };
    });
}

// ─────────────────────────────────────────────────────────────────
// Public API — Transaction-Composable Stock Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Reserve (decrease) stock within an existing transaction.
 * Used by SaleService, OrderService, or any module that needs
 * atomic multi-item stock deduction.
 *
 * Note: This function receives a TransactionClient so it composes
 * within the caller's transaction, not creating a nested one.
 */
export async function reserveStock(
    tx: TransactionClient,
    organizationId: string,
    warehouseId: string,
    items: Array<{ productId: string; quantity: number }>,
    userId: string,
    referenceNumber: string,
): Promise<void> {
    // Validate warehouse once for all items
    await validateWarehouseOwnership(tx, warehouseId, organizationId);

    for (const item of items) {
        const { sku } = await validateProductOwnership(tx, item.productId, organizationId);

        const stock = await lockStockForUpdate(tx, item.productId, warehouseId);
        if (!stock) {
            throw new NotFoundError(`Stok kaydı bulunamadı: ${item.productId} × ${warehouseId}`);
        }

        if (stock.quantity < item.quantity) {
            throw new InsufficientStockError(sku, stock.quantity, item.quantity);
        }

        // Movement first, then balance
        await tx.stockMovement.create({
            data: {
                organizationId,
                productId: item.productId,
                warehouseId,
                type: StockMovementType.OUT,
                referenceType: StockReferenceType.SALE,
                quantity: item.quantity,
                reference: referenceNumber,
                createdById: userId,
            },
        });

        await tx.stock.update({
            where: { productId_warehouseId: { productId: item.productId, warehouseId } },
            data: { quantity: { decrement: item.quantity } },
        });
    }
}

/** @deprecated Use `reserveStock` instead */
export const reserveStockForOrder = reserveStock;

/**
 * Return (increase) stock within an existing transaction.
 * Used by SaleService, OrderService, or any module that needs
 * atomic multi-item stock return on cancellation.
 */
export async function returnStock(
    tx: TransactionClient,
    organizationId: string,
    warehouseId: string,
    items: Array<{ productId: string; quantity: number }>,
    userId: string,
    referenceNumber: string,
): Promise<void> {
    for (const item of items) {
        // Movement first, then balance
        await tx.stockMovement.create({
            data: {
                organizationId,
                productId: item.productId,
                warehouseId,
                type: StockMovementType.IN,
                referenceType: StockReferenceType.SALE,
                quantity: item.quantity,
                reference: referenceNumber,
                note: "İptal — stok iade",
                createdById: userId,
            },
        });

        await tx.stock.update({
            where: { productId_warehouseId: { productId: item.productId, warehouseId } },
            data: { quantity: { increment: item.quantity } },
        });
    }
}

/** @deprecated Use `returnStock` instead */
export const returnStockForCancel = returnStock;

// ─────────────────────────────────────────────────────────────────
// Public API — Read Operations
// ─────────────────────────────────────────────────────────────────

/**
 * Paginated stock movement history.
 * Org-scoped: always filters by organizationId.
 */
export async function listStockMovements(
    organizationId: string,
    filter: StockMovementFilterInput,
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.stockMovement.findFirst>>>> {
    const { page, pageSize, productId, warehouseId, type, startDate, endDate } = filter;
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId };

    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;
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

/**
 * Get current stock level for a product × warehouse pair.
 * Returns 0 if no stock record exists.
 */
export async function getStockLevel(
    organizationId: string,
    productId: string,
    warehouseId: string,
): Promise<number> {
    const stock = await prisma.stock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
        select: { quantity: true, organizationId: true },
    });

    if (stock && stock.organizationId !== organizationId) {
        throw new OrganizationMismatchError("Stock", `${productId}×${warehouseId}`, organizationId);
    }

    return stock?.quantity ?? 0;
}
