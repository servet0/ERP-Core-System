// ─────────────────────────────────────────────────────────────────
// Product Domain — Zod Şemaları
// ─────────────────────────────────────────────────────────────────

import { z } from "zod";

const skuSchema = z
    .string()
    .min(1, "Stok kodu zorunludur")
    .max(50, "Stok kodu en fazla 50 karakter olabilir")
    .transform((v) => v.toUpperCase().trim());

const priceSchema = z
    .number()
    .min(0, "Fiyat negatif olamaz")
    .max(999_999_999.99, "Fiyat çok yüksek");

// ── Ürün Oluşturma ──
export const createProductSchema = z.object({
    sku: skuSchema,
    name: z
        .string()
        .min(2, "Ürün adı en az 2 karakter olmalıdır")
        .max(200, "Ürün adı en fazla 200 karakter olabilir")
        .transform((v) => v.trim()),
    description: z
        .string()
        .max(1000, "Açıklama en fazla 1000 karakter olabilir")
        .optional()
        .transform((v) => v?.trim() || undefined),
    unit: z
        .string()
        .min(1, "Birim zorunludur")
        .max(20)
        .default("ADET"),
    price: priceSchema.default(0),
    minStock: z
        .number()
        .int("Minimum stok tam sayı olmalıdır")
        .min(0, "Minimum stok negatif olamaz")
        .default(0),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

// ── Ürün Güncelleme ──
export const updateProductSchema = z.object({
    id: z.string().cuid(),
    sku: skuSchema.optional(),
    name: z
        .string()
        .min(2, "Ürün adı en az 2 karakter olmalıdır")
        .max(200)
        .transform((v) => v.trim())
        .optional(),
    description: z
        .string()
        .max(1000)
        .optional()
        .transform((v) => v?.trim() || undefined),
    unit: z.string().min(1).max(20).optional(),
    price: priceSchema.optional(),
    minStock: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ── Ürün Listeleme Filtresi ──
export const productFilterSchema = z.object({
    search: z.string().optional(),
    active: z.boolean().optional(),
    lowStockOnly: z.boolean().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
});
export type ProductFilterInput = z.infer<typeof productFilterSchema>;
