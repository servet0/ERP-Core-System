// ─────────────────────────────────────────────────────────────────
// RBAC İzin Sistemi
// ─────────────────────────────────────────────────────────────────
// Neden merkezi izin haritası?
//   1. Tek kaynak (single source of truth): Tüm roller ve izinler
//      burada tanımlı. Yeni modül eklendiğinde sadece bu dosya güncellenir.
//   2. Tip güvenliği: TypeScript, geçersiz izin adı kullanılmasını engeller.
//   3. Test edilebilirlik: İzin mantığı UI'dan bağımsız test edilebilir.
//   4. Middleware + Server Actions çift kontrol: Defense in depth.
// ─────────────────────────────────────────────────────────────────

import { Role } from "@prisma/client";
import { UnauthorizedError } from "./errors";

/**
 * Sistem genelindeki tüm izin tanımları.
 * Her izin, o işlemi gerçekleştirebilecek rollerin listesini içerir.
 */
export const PERMISSIONS = {
    // ── Kullanıcı Yönetimi ──
    "users:list": [Role.ADMIN],
    "users:create": [Role.ADMIN],
    "users:update": [Role.ADMIN],
    "users:delete": [Role.ADMIN],

    // ── Ürün Yönetimi ──
    "products:list": [Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.VIEWER],
    "products:create": [Role.ADMIN, Role.WAREHOUSE],
    "products:update": [Role.ADMIN, Role.WAREHOUSE],

    // ── Stok Yönetimi ──
    "stock:view": [Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.VIEWER],
    "stock:movement:in": [Role.ADMIN, Role.WAREHOUSE],
    "stock:movement:out": [Role.ADMIN, Role.WAREHOUSE],
    "stock:adjustment": [Role.ADMIN, Role.WAREHOUSE],

    // ── Sipariş Yönetimi ──
    "orders:list": [Role.ADMIN, Role.SALES, Role.VIEWER],
    "orders:create": [Role.ADMIN, Role.SALES],
    "orders:approve": [Role.ADMIN],
    "orders:cancel": [Role.ADMIN],

    // ── Fatura ──
    "invoices:list": [Role.ADMIN, Role.SALES, Role.VIEWER],
    "invoices:create": [Role.ADMIN],
    "invoices:export": [Role.ADMIN, Role.SALES],

    // ── Dashboard / Raporlar ──
    "dashboard:view": [Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.VIEWER],
} as const;

/** Sistemde tanımlı tüm izin adlarının tipi */
export type Permission = keyof typeof PERMISSIONS;

/**
 * Belirli bir rolün, belirli bir izne sahip olup olmadığını kontrol eder.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
    const allowedRoles = PERMISSIONS[permission];
    return (allowedRoles as readonly Role[]).includes(role);
}

/**
 * İzni zorunlu kılar. Sahip değilse UnauthorizedError fırlatır.
 * Server Actions ve Service katmanında kullanılır.
 *
 * @example
 * ```ts
 * requirePermission(user.role, "orders:approve");
 * ```
 */
export function requirePermission(role: Role, permission: Permission): void {
    if (!hasPermission(role, permission)) {
        throw new UnauthorizedError(
            `"${permission}" izni için "${role}" rolü yetkili değildir.`
        );
    }
}

// ─────────────────────────────────────────────────────────────────
// Rota → İzin Eşleme (Middleware için)
// ─────────────────────────────────────────────────────────────────
// Middleware, gelen isteğin path'ine göre hangi izni gerektirdiğini
// bu haritadan belirler. Eşleşmeyen rotalar varsayılan olarak
// kimlik doğrulaması gerektirir (giriş yapmış olmak yeterli).
// ─────────────────────────────────────────────────────────────────

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
    "/users": "users:list",
    "/products": "products:list",
    "/stock": "stock:view",
    "/orders": "orders:list",
    "/invoices": "invoices:list",
    "/dashboard": "dashboard:view",
    "/reports": "dashboard:view",
};

/**
 * Verilen pathname için gerekli izni döner.
 * Eşleşme bulunamazsa null döner (sadece auth gerekli).
 */
export function getRequiredPermission(pathname: string): Permission | null {
    // Tam eşleşme kontrolü
    if (pathname in ROUTE_PERMISSIONS) {
        return ROUTE_PERMISSIONS[pathname];
    }

    // Prefix eşleşme: /orders/new → /orders izni
    for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
        if (pathname.startsWith(route + "/")) {
            return permission;
        }
    }

    return null;
}
