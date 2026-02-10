// ─────────────────────────────────────────────────────────────────
// Invoice Server Actions — Application Katmanı
// ─────────────────────────────────────────────────────────────────
// Fatura salt okunur — sadece oluşturma ve görüntüleme işlemleri var.
// Güncelleme ve silme ACTION'I KASITLI OLARAK YOK.
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, type ActionResult } from "@/lib/errors";
import { createInvoiceSchema, invoiceFilterSchema } from "@/schemas/invoice.schema";
import * as invoiceService from "@/services/invoice.service";

// ─── Fatura Oluşturma ───
export async function createInvoiceAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof invoiceService.createInvoice>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "invoices:create");

        const { orderId } = createInvoiceSchema.parse(input);
        const result = await invoiceService.createInvoice(orderId, user.id);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Fatura Detayı ───
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

// ─── Fatura Listesi ───
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
