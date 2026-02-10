// ─────────────────────────────────────────────────────────────────
// Stock Domain — Zod Şemaları
// ─────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Stok Giriş (IN) ──
export const stockInSchema = z.object({
    productId: z.string().cuid("Geçersiz ürün ID"),
    quantity: z
        .number()
        .int("Miktar tam sayı olmalıdır")
        .min(1, "Miktar en az 1 olmalıdır")
        .max(1_000_000, "Miktar çok yüksek"),
    note: z
        .string()
        .max(500, "Not en fazla 500 karakter olabilir")
        .optional()
        .transform((v) => v?.trim() || undefined),
});
export type StockInInput = z.infer<typeof stockInSchema>;

// ── Stok Çıkış (OUT) ──
export const stockOutSchema = z.object({
    productId: z.string().cuid("Geçersiz ürün ID"),
    quantity: z
        .number()
        .int("Miktar tam sayı olmalıdır")
        .min(1, "Miktar en az 1 olmalıdır")
        .max(1_000_000, "Miktar çok yüksek"),
    note: z
        .string()
        .max(500, "Not en fazla 500 karakter olabilir")
        .optional()
        .transform((v) => v?.trim() || undefined),
});
export type StockOutInput = z.infer<typeof stockOutSchema>;

// ── Stok Hareket Listeleme Filtresi ──
export const stockMovementFilterSchema = z.object({
    productId: z.string().cuid().optional(),
    type: z.enum(["IN", "OUT", "ORDER_OUT", "CANCEL_IN"]).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
});
export type StockMovementFilterInput = z.infer<typeof stockMovementFilterSchema>;
