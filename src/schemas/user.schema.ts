// ─────────────────────────────────────────────────────────────────
// User Domain — Zod Şemaları
// ─────────────────────────────────────────────────────────────────
// Tüm kullanıcı işlemleri için giriş validasyon şemaları.
// Server Actions bu şemaları parse eder, service katmanına
// tip-güvenli veri aktarır.
// ─────────────────────────────────────────────────────────────────

import { z } from "zod";
import { Role } from "@prisma/client";

// ── Paylaşılan Kurallar ──
const emailSchema = z
    .string()
    .min(1, "E-posta zorunludur")
    .email("Geçerli bir e-posta adresi giriniz")
    .transform((v) => v.toLowerCase().trim());

const passwordSchema = z
    .string()
    .min(8, "Şifre en az 8 karakter olmalıdır")
    .max(64, "Şifre en fazla 64 karakter olabilir");

const nameSchema = z
    .string()
    .min(2, "İsim en az 2 karakter olmalıdır")
    .max(100, "İsim en fazla 100 karakter olabilir")
    .transform((v) => v.trim());

const roleSchema = z.nativeEnum(Role, {
    error: "Geçersiz rol",
});

// ── Kullanıcı Oluşturma ──
export const createUserSchema = z.object({
    email: emailSchema,
    name: nameSchema,
    password: passwordSchema,
    role: roleSchema.default(Role.VIEWER),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// ── Kullanıcı Güncelleme ──
export const updateUserSchema = z.object({
    id: z.string().cuid(),
    email: emailSchema.optional(),
    name: nameSchema.optional(),
    role: roleSchema.optional(),
    active: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ── Şifre Değiştirme ──
export const changePasswordSchema = z
    .object({
        id: z.string().cuid(),
        newPassword: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Şifreler eşleşmiyor",
        path: ["confirmPassword"],
    });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── Giriş (Login) ──
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, "Şifre zorunludur"),
});
export type LoginInput = z.infer<typeof loginSchema>;
