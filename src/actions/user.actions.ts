// ─────────────────────────────────────────────────────────────────
// User Server Actions — Application Katmanı (Phase 5: +audit, +rate-limit)
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, RateLimitError, type ActionResult } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createUserSchema, updateUserSchema, changePasswordSchema } from "@/schemas/user.schema";
import * as userService from "@/services/user.service";

// ─── Kullanıcı Listesi (read — rate limit yok) ───
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

// ─── Kullanıcı Detayı (read — rate limit yok) ───
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
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = createUserSchema.parse(input);
        const result = await userService.createUser(validated);

        await logAudit({
            userId: user.id, action: "user.create", entity: "User",
            entityId: result.id, metadata: { email: result.email, role: result.role },
            duration: Date.now() - start,
        });

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
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = updateUserSchema.parse(input);
        const result = await userService.updateUser(validated);

        await logAudit({
            userId: user.id, action: "user.update", entity: "User",
            entityId: result.id, metadata: { changedFields: Object.keys(validated) },
            duration: Date.now() - start,
        });

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
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = changePasswordSchema.parse(input);
        await userService.changePassword(validated);

        await logAudit({
            userId: user.id, action: "user.change_password", entity: "User",
            entityId: validated.id, duration: Date.now() - start,
        });

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
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        await userService.deactivateUser(id);

        await logAudit({
            userId: user.id, action: "user.deactivate", entity: "User",
            entityId: id, duration: Date.now() - start,
        });

        return { success: true, data: undefined };
    } catch (error) {
        return handleActionError(error);
    }
}
