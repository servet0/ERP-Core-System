// ─────────────────────────────────────────────────────────────────
// Stock Server Actions (Phase 5: +audit, +rate-limit)
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, RateLimitError, type ActionResult } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { stockInSchema, stockOutSchema, stockMovementFilterSchema } from "@/schemas/stock.schema";
import * as stockService from "@/services/stock.service";

// ─── Stok Giriş ───
export async function stockInAction(
    input: unknown
): Promise<ActionResult<void>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "stock:movement:in");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = stockInSchema.parse(input);
        await stockService.addStock(
            validated.productId,
            validated.quantity,
            user.id,
            validated.note
        );

        await logAudit({
            userId: user.id, action: "stock.in", entity: "Product",
            entityId: validated.productId,
            metadata: { quantity: validated.quantity },
            duration: Date.now() - start,
        });

        return { success: true, data: undefined };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Stok Çıkış ───
export async function stockOutAction(
    input: unknown
): Promise<ActionResult<void>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "stock:movement:out");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = stockOutSchema.parse(input);
        await stockService.removeStock(
            validated.productId,
            validated.quantity,
            user.id,
            validated.note
        );

        await logAudit({
            userId: user.id, action: "stock.out", entity: "Product",
            entityId: validated.productId,
            metadata: { quantity: validated.quantity },
            duration: Date.now() - start,
        });

        return { success: true, data: undefined };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Stok Hareket Listesi (read) ───
export async function listStockMovementsAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof stockService.listStockMovements>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "stock:view");

        const filter = stockMovementFilterSchema.parse(input);
        const result = await stockService.listStockMovements(filter);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}
