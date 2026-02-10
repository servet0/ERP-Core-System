// ─────────────────────────────────────────────────────────────────
// Invoice Domain — Zod Şemaları
// ─────────────────────────────────────────────────────────────────
// Fatura salt okunurdur — oluşturulduktan sonra değiştirilemez.
// Bu nedenle sadece create ve filter şemaları vardır.
// ─────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Fatura Oluşturma (siparişten) ──
export const createInvoiceSchema = z.object({
    orderId: z.string().cuid("Geçersiz sipariş ID"),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ── Fatura Listeleme Filtresi ──
export const invoiceFilterSchema = z.object({
    search: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
});
export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;
