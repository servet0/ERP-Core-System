// ─────────────────────────────────────────────────────────────────
// Warehouse Domain — Zod Şemaları
// ─────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Depo Oluşturma ──
export const createWarehouseSchema = z.object({
    name: z
        .string()
        .min(2, "Depo adı en az 2 karakter olmalıdır")
        .max(200, "Depo adı en fazla 200 karakter olabilir")
        .transform((v) => v.trim()),
    code: z
        .string()
        .min(1, "Depo kodu zorunludur")
        .max(20, "Depo kodu en fazla 20 karakter olabilir")
        .transform((v) => v.toUpperCase().trim()),
    address: z
        .string()
        .max(500, "Adres en fazla 500 karakter olabilir")
        .optional()
        .transform((v) => v?.trim() || undefined),
});
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
