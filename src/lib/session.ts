// ─────────────────────────────────────────────────────────────────
// Session Yardımcı Fonksiyonları
// ─────────────────────────────────────────────────────────────────
// Server Components ve Server Actions'da session'a erişim için
// merkezi yardımcı fonksiyonlar.
//
// Neden ayrı bir dosya?
//   1. `auth()` çağrısını her yerde tekrarlamamak için.
//   2. Null-check ve tip dönüşümünü tek noktada yapmak için.
//   3. İleride audit logging gibi cross-cutting concern'ler
//      eklendiğinde tek bir noktadan geçmesi için.
// ─────────────────────────────────────────────────────────────────

import { auth } from "@/auth";
import type { SessionUser } from "@/types";
import type { Role } from "@prisma/client";

/**
 * Mevcut oturumun kullanıcı bilgilerini döner.
 * Oturum yoksa null döner.
 *
 * @example
 * ```ts
 * const user = await getCurrentUser();
 * if (!user) redirect("/login");
 * ```
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.role) {
        return null;
    }

    return {
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        role: session.user.role as Role,
    };
}

/**
 * Oturum açmış kullanıcıyı zorunlu kılar.
 * Oturum yoksa hata fırlatır.
 * Server Actions içinde kullanılır (redirect yerine hata tercih edilir).
 *
 * @throws Error — Oturum bulunamadığında
 *
 * @example
 * ```ts
 * const user = await requireAuth();
 * // user tipi SessionUser — null olamaz
 * ```
 */
export async function requireAuth(): Promise<SessionUser> {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error("Oturum bulunamadı. Lütfen giriş yapın.");
    }

    return user;
}
