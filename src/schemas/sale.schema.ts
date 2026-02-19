// ─────────────────────────────────────────────────────────────────
// Sale Domain — Zod Şemaları (Phase 8 Lite)
// ─────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Satış Kalemi ──
const saleItemSchema = z.object({
    productId: z.string().cuid("Geçersiz ürün ID"),
    quantity: z
        .number()
        .int("Miktar tam sayı olmalıdır")
        .min(1, "Miktar en az 1 olmalıdır"),
    unitPrice: z
        .number()
        .min(0, "Birim fiyat negatif olamaz"),
});

// ── Satış Oluşturma ──
export const createSaleSchema = z.object({
    organizationId: z.string().cuid("Geçersiz organizasyon ID"),
    warehouseId: z.string().cuid("Geçersiz depo ID"),
    customerName: z
        .string()
        .min(2, "Müşteri adı en az 2 karakter olmalıdır")
        .max(200, "Müşteri adı en fazla 200 karakter olabilir")
        .transform((v) => v.trim()),
    note: z
        .string()
        .max(1000, "Not en fazla 1000 karakter olabilir")
        .optional()
        .transform((v) => v?.trim() || undefined),
    items: z
        .array(saleItemSchema)
        .min(1, "Satış en az 1 kalem içermelidir")
        .max(100, "Satış en fazla 100 kalem içerebilir"),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

// ── Satış Onay / İptal ──
export const saleActionSchema = z.object({
    saleId: z.string().cuid("Geçersiz satış ID"),
});
export type SaleActionInput = z.infer<typeof saleActionSchema>;

// ── Satış Listeleme Filtresi ──
export const saleFilterSchema = z.object({
    status: z.enum(["DRAFT", "APPROVED", "CANCELLED"]).optional(),
    search: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
});
export type SaleFilterInput = z.infer<typeof saleFilterSchema>;
