// ─────────────────────────────────────────────────────────────────
// Stock Server Actions — Application Katmanı
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, type ActionResult } from "@/lib/errors";
import { stockInSchema, stockOutSchema, stockMovementFilterSchema } from "@/schemas/stock.schema";
import * as stockService from "@/services/stock.service";

// ─── Stok Giriş ───
export async function stockInAction(
    input: unknown
): Promise<ActionResult<void>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "stock:movement:in");

        const validated = stockInSchema.parse(input);
        await stockService.addStock(
            validated.productId,
            validated.quantity,
            user.id,
            validated.note
        );
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

        const validated = stockOutSchema.parse(input);
        await stockService.removeStock(
            validated.productId,
            validated.quantity,
            user.id,
            validated.note
        );
        return { success: true, data: undefined };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Stok Hareket Listesi ───
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
