// ─────────────────────────────────────────────────────────────────
// Sale Server Actions (Phase 8 Lite: Basic Sales Module)
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, RateLimitError, type ActionResult } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
    createSaleSchema,
    saleActionSchema,
    saleFilterSchema,
} from "@/schemas/sale.schema";
import * as saleService from "@/services/sale.service";

// ─── Satış Oluşturma (DRAFT) ───
export async function createSaleAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof saleService.createSale>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "sales:create");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = createSaleSchema.parse(input);
        const result = await saleService.createSale(validated, user.id);

        await logAudit({
            userId: user.id, action: "sale.create", entity: "Sale",
            entityId: result.id,
            metadata: {
                saleNumber: result.saleNumber,
                customerName: validated.customerName,
                itemCount: validated.items.length,
                warehouseId: validated.warehouseId,
            },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Satış Onaylama (DRAFT → APPROVED) ───
export async function approveSaleAction(
    organizationId: string,
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof saleService.approveSale>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "sales:approve");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const { saleId } = saleActionSchema.parse(input);
        const result = await saleService.approveSale(saleId, user.id, organizationId);

        await logAudit({
            userId: user.id, action: "sale.approve", entity: "Sale",
            entityId: saleId,
            metadata: { saleNumber: result.saleNumber },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Satış İptal (APPROVED → CANCELLED) ───
export async function cancelSaleAction(
    organizationId: string,
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof saleService.cancelSale>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "sales:cancel");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const { saleId } = saleActionSchema.parse(input);
        const result = await saleService.cancelSale(saleId, user.id, organizationId);

        await logAudit({
            userId: user.id, action: "sale.cancel", entity: "Sale",
            entityId: saleId,
            metadata: { saleNumber: result.saleNumber },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Satış Listesi (read) ───
export async function listSalesAction(
    organizationId: string,
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof saleService.listSales>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "sales:list");

        const filter = saleFilterSchema.parse(input);
        const result = await saleService.listSales(organizationId, filter);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Satış Detayı (read) ───
export async function getSaleAction(
    organizationId: string,
    saleId: string
): Promise<ActionResult<Awaited<ReturnType<typeof saleService.getSaleById>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "sales:list");

        const result = await saleService.getSaleById(saleId, organizationId);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}
