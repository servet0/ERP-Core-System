// ─────────────────────────────────────────────────────────────────
// User Service — İş Mantığı Katmanı
// ─────────────────────────────────────────────────────────────────
// Bu dosya kullanıcı CRUD operasyonlarının iş mantığını içerir.
// Server Actions bu servis fonksiyonlarını çağırır.
//
// Neden ayrı service katmanı?
//   1. Test edilebilirlik — Server Actions'tan bağımsız test
//   2. Yeniden kullanılabilirlik — Farklı action'lar aynı servisi kullanabilir
//   3. İş kuralları tek yerde — DRY prensibi
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { excludeDeleted } from "@/lib/soft-delete";
import { withTransaction } from "@/lib/transaction";
import { publishEvent } from "@/lib/outbox";
import type { CreateUserInput, UpdateUserInput, ChangePasswordInput } from "@/schemas/user.schema";
import type { PaginatedResult } from "@/types";
import type { User } from "@prisma/client";

// ── Tip tanımları ──
type UserWithoutPassword = Omit<User, "passwordHash">;

const BCRYPT_ROUNDS = 12;

// ─── Kullanıcı Listesi ───
export async function listUsers(params: {
    page?: number;
    pageSize?: number;
    search?: string;
}): Promise<PaginatedResult<UserWithoutPassword>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const baseWhere = params.search
        ? {
            OR: [
                { name: { contains: params.search, mode: "insensitive" as const } },
                { email: { contains: params.search, mode: "insensitive" as const } },
            ],
        }
        : {};

    const where = excludeDeleted(baseWhere);

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
        }),
        prisma.user.count({ where }),
    ]);

    return {
        data: users as UserWithoutPassword[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}

// ─── Kullanıcı Detayı ───
export async function getUserById(id: string): Promise<UserWithoutPassword> {
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            active: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!user) {
        throw new NotFoundError("Kullanıcı bulunamadı");
    }

    return user as UserWithoutPassword;
}

// ─── Kullanıcı Oluşturma ───
export async function createUser(input: CreateUserInput): Promise<UserWithoutPassword> {
    // E-posta teklik kontrolü (TX dışında — lock gerekmez)
    const existing = await prisma.user.findUnique({
        where: { email: input.email },
    });

    if (existing) {
        throw new ValidationError("Bu e-posta adresi zaten kullanılmaktadır", {
            email: ["Bu e-posta adresi zaten kullanılmaktadır"],
        });
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    return withTransaction(async (tx) => {
        const txClient = tx as unknown as typeof prisma;

        const user = await txClient.user.create({
            data: {
                email: input.email,
                name: input.name,
                passwordHash,
                role: input.role,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        // Outbox: Hoş geldin email tetikle
        await publishEvent(tx, "USER_CREATED", {
            userId: user.id, email: user.email, name: user.name,
        }, `user:create:${user.id}`);

        return user as UserWithoutPassword;
    });
}

// ─── Kullanıcı Güncelleme ───
export async function updateUser(input: UpdateUserInput): Promise<UserWithoutPassword> {
    // Mevcut kullanıcıyı kontrol et
    const existing = await prisma.user.findUnique({
        where: { id: input.id },
    });

    if (!existing) {
        throw new NotFoundError("Kullanıcı bulunamadı");
    }

    // E-posta değişiyorsa teklik kontrolü
    if (input.email && input.email !== existing.email) {
        const emailExists = await prisma.user.findUnique({
            where: { email: input.email },
        });
        if (emailExists) {
            throw new ValidationError("Bu e-posta adresi zaten kullanılmaktadır", {
                email: ["Bu e-posta adresi zaten kullanılmaktadır"],
            });
        }
    }

    const { id, ...updateData } = input;

    const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            active: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return user as UserWithoutPassword;
}

// ─── Şifre Değiştirme ───
export async function changePassword(input: ChangePasswordInput): Promise<void> {
    const existing = await prisma.user.findUnique({
        where: { id: input.id },
    });

    if (!existing) {
        throw new NotFoundError("Kullanıcı bulunamadı");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
        where: { id: input.id },
        data: { passwordHash },
    });
}

// ─── Kullanıcı Silme (Soft Delete — active + deletedAt) ───
export async function deactivateUser(id: string): Promise<void> {
    const existing = await prisma.user.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new NotFoundError("Kullanıcı bulunamadı");
    }

    await prisma.user.update({
        where: { id },
        data: { active: false, deletedAt: new Date() },
    });
}
