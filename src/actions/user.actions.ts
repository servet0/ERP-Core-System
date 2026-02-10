// ─────────────────────────────────────────────────────────────────
// User Server Actions — Application Katmanı
// ─────────────────────────────────────────────────────────────────
// Server Actions ince bir katmandır:
//   1. Zod ile input validasyonu
//   2. requireAuth() ile kimlik kontrolü
//   3. requirePermission() ile operasyon izni kontrolü
//   4. Service çağrısı
//   5. ActionResult<T> formatında sonuç dönüşü
//
// ❌ İş mantığı burada OLMAZ — service katmanında.
// ❌ Hard-coded role check OLMAZ — permission-based kontrol zorunlu.
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, type ActionResult } from "@/lib/errors";
import { createUserSchema, updateUserSchema, changePasswordSchema } from "@/schemas/user.schema";
import * as userService from "@/services/user.service";

// ─── Kullanıcı Listesi ───
export async function listUsersAction(params: {
    page?: number;
    pageSize?: number;
    search?: string;
}): Promise<ActionResult<Awaited<ReturnType<typeof userService.listUsers>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "users:list");

        const result = await userService.listUsers(params);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Kullanıcı Detayı ───
export async function getUserAction(
    id: string
): Promise<ActionResult<Awaited<ReturnType<typeof userService.getUserById>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "users:list");

        const result = await userService.getUserById(id);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Kullanıcı Oluşturma ───
export async function createUserAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof userService.createUser>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "users:create");

        const validated = createUserSchema.parse(input);
        const result = await userService.createUser(validated);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Kullanıcı Güncelleme ───
export async function updateUserAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof userService.updateUser>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "users:update");

        const validated = updateUserSchema.parse(input);
        const result = await userService.updateUser(validated);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Şifre Değiştirme ───
export async function changePasswordAction(
    input: unknown
): Promise<ActionResult<void>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "users:update");

        const validated = changePasswordSchema.parse(input);
        await userService.changePassword(validated);
        return { success: true, data: undefined };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Kullanıcı Deaktif Etme ───
export async function deactivateUserAction(
    id: string
): Promise<ActionResult<void>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "users:delete");

        await userService.deactivateUser(id);
        return { success: true, data: undefined };
    } catch (error) {
        return handleActionError(error);
    }
}
