// ─────────────────────────────────────────────────────────────────
// Stock Domain — Zod Şemaları (Phase 7B: +org, +warehouse)
// ─────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Stok Giriş (IN) ──
export const stockInSchema = z.object({
    organizationId: z.string().cuid("Geçersiz organizasyon ID"),
    productId: z.string().cuid("Geçersiz ürün ID"),
    warehouseId: z.string().cuid("Geçersiz depo ID"),
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
    organizationId: z.string().cuid("Geçersiz organizasyon ID"),
    productId: z.string().cuid("Geçersiz ürün ID"),
    warehouseId: z.string().cuid("Geçersiz depo ID"),
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

// ── Stok Düzeltme (ADJUSTMENT) ──
export const stockAdjustSchema = z.object({
    organizationId: z.string().cuid("Geçersiz organizasyon ID"),
    productId: z.string().cuid("Geçersiz ürün ID"),
    warehouseId: z.string().cuid("Geçersiz depo ID"),
    targetQuantity: z
        .number()
        .int("Hedef miktar tam sayı olmalıdır")
        .min(0, "Hedef miktar negatif olamaz")
        .max(10_000_000, "Hedef miktar çok yüksek"),
    reference: z
        .string()
        .max(100, "Referans en fazla 100 karakter olabilir")
        .optional()
        .transform((v) => v?.trim() || undefined),
    note: z
        .string()
        .max(500, "Not en fazla 500 karakter olabilir")
        .optional()
        .transform((v) => v?.trim() || undefined),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

// ── Stok Hareket Listeleme Filtresi ──
export const stockMovementFilterSchema = z.object({
    productId: z.string().cuid().optional(),
    warehouseId: z.string().cuid().optional(),
    type: z.enum(["IN", "OUT", "ADJUSTMENT"]).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
});
export type StockMovementFilterInput = z.infer<typeof stockMovementFilterSchema>;
