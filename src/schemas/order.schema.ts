// ─────────────────────────────────────────────────────────────────
// Order Domain — Zod Şemaları
// ─────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Sipariş Kalemi ──
const orderItemSchema = z.object({
    productId: z.string().cuid("Geçersiz ürün ID"),
    quantity: z
        .number()
        .int("Miktar tam sayı olmalıdır")
        .min(1, "Miktar en az 1 olmalıdır"),
    unitPrice: z
        .number()
        .min(0, "Birim fiyat negatif olamaz"),
});

// ── Sipariş Oluşturma ──
export const createOrderSchema = z.object({
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
        .array(orderItemSchema)
        .min(1, "Sipariş en az 1 kalem içermelidir")
        .max(100, "Sipariş en fazla 100 kalem içerebilir"),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ── Sipariş Onay / İptal (stok mutasyonu gerektirir) ──
export const orderActionSchema = z.object({
    orderId: z.string().cuid("Geçersiz sipariş ID"),
    organizationId: z.string().cuid("Geçersiz organizasyon ID"),
    warehouseId: z.string().cuid("Geçersiz depo ID"),
});
export type OrderActionInput = z.infer<typeof orderActionSchema>;

// ── Sipariş Listeleme Filtresi ──
export const orderFilterSchema = z.object({
    status: z.enum(["DRAFT", "APPROVED", "CANCELLED"]).optional(),
    search: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
});
export type OrderFilterInput = z.infer<typeof orderFilterSchema>;
