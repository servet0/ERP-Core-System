// ─────────────────────────────────────────────────────────────────
// Stock Server Actions (Phase 7B: Transaction-Safe Stock Engine)
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, RateLimitError, type ActionResult } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { StockReferenceType } from "@prisma/client";
import {
    stockInSchema,
    stockOutSchema,
    stockAdjustSchema,
    stockMovementFilterSchema,
} from "@/schemas/stock.schema";
import * as stockService from "@/services/stock.service";
import type { StockMutationResult } from "@/services/stock.service";

// ─── Stok Giriş (IN) ───
export async function stockInAction(
    input: unknown
): Promise<ActionResult<StockMutationResult>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "stock:movement:in");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = stockInSchema.parse(input);
        const result = await stockService.increaseStock({
            organizationId: validated.organizationId,
            productId: validated.productId,
            warehouseId: validated.warehouseId,
            quantity: validated.quantity,
            userId: user.id,
            referenceType: StockReferenceType.MANUAL,
            note: validated.note,
        });

        await logAudit({
            userId: user.id, action: "stock.in", entity: "Stock",
            entityId: `${validated.productId}×${validated.warehouseId}`,
            metadata: { quantity: validated.quantity, warehouseId: validated.warehouseId },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Stok Çıkış (OUT) ───
export async function stockOutAction(
    input: unknown
): Promise<ActionResult<StockMutationResult>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "stock:movement:out");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = stockOutSchema.parse(input);
        const result = await stockService.decreaseStock({
            organizationId: validated.organizationId,
            productId: validated.productId,
            warehouseId: validated.warehouseId,
            quantity: validated.quantity,
            userId: user.id,
            referenceType: StockReferenceType.MANUAL,
            note: validated.note,
        });

        await logAudit({
            userId: user.id, action: "stock.out", entity: "Stock",
            entityId: `${validated.productId}×${validated.warehouseId}`,
            metadata: { quantity: validated.quantity, warehouseId: validated.warehouseId },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Stok Düzeltme (ADJUSTMENT) ───
export async function stockAdjustAction(
    input: unknown
): Promise<ActionResult<StockMutationResult>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "stock:adjustment");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = stockAdjustSchema.parse(input);
        const result = await stockService.adjustStock({
            organizationId: validated.organizationId,
            productId: validated.productId,
            warehouseId: validated.warehouseId,
            targetQuantity: validated.targetQuantity,
            userId: user.id,
            reference: validated.reference,
            note: validated.note,
        });

        await logAudit({
            userId: user.id, action: "stock.adjust", entity: "Stock",
            entityId: `${validated.productId}×${validated.warehouseId}`,
            metadata: {
                targetQuantity: validated.targetQuantity,
                previousQuantity: result.previousQuantity,
                warehouseId: validated.warehouseId,
            },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Stok Hareket Listesi (read) ───
export async function listStockMovementsAction(
    organizationId: string,
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof stockService.listStockMovements>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "stock:view");

        const filter = stockMovementFilterSchema.parse(input);
        const result = await stockService.listStockMovements(organizationId, filter);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}
