// ─────────────────────────────────────────────────────────────────
// Invoice Server Actions (Phase 5: +audit, +rate-limit)
// ─────────────────────────────────────────────────────────────────
// Fatura salt okunur — sadece oluşturma ve görüntüleme.
// Güncelleme ve silme KASITLI OLARAK YOK.
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, RateLimitError, type ActionResult } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createInvoiceSchema, invoiceFilterSchema } from "@/schemas/invoice.schema";
import * as invoiceService from "@/services/invoice.service";

// ─── Fatura Oluşturma ───
export async function createInvoiceAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof invoiceService.createInvoice>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "invoices:create");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const { orderId } = createInvoiceSchema.parse(input);
        const result = await invoiceService.createInvoice(orderId, user.id);

        await logAudit({
            userId: user.id, action: "invoice.create", entity: "Invoice",
            entityId: result.id,
            metadata: { invoiceNumber: result.invoiceNumber, orderId },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Fatura Detayı (read) ───
export async function getInvoiceAction(
    id: string
): Promise<ActionResult<Awaited<ReturnType<typeof invoiceService.getInvoiceById>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "invoices:list");

        const result = await invoiceService.getInvoiceById(id);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Fatura Listesi (read) ───
export async function listInvoicesAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof invoiceService.listInvoices>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "invoices:list");

        const filter = invoiceFilterSchema.parse(input);
        const result = await invoiceService.listInvoices(filter);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}
