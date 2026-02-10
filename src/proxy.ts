// ─────────────────────────────────────────────────────────────────
// Next.js 16 Proxy — Route-Level RBAC Enforcement
// ─────────────────────────────────────────────────────────────────
//
// Next.js 16 Breaking Change: middleware.ts → proxy.ts
//   Next.js 16'da `middleware.ts` deprecate oldu, yerine `proxy.ts`
//   kullanılıyor. Export edilen fonksiyon adı da `proxy` olmalı.
//
// Bu proxy'nin görevi:
//   1. Korumalı rotalara gelen isteklerde JWT session kontrolü yapmak.
//   2. Session'daki role bilgisine göre izin kontrolü yapmak.
//   3. Yetkisiz erişimlerde 401 (auth yok) veya 403 (izin yok) döndürmek.
//
// Neden proxy'de RBAC?
//   - UI bile yüklenmeden erişim engellenmiş olur (performans + güvenlik).
//   - Defense in depth: Server Actions'da da ayrıca kontrol yapılır.
//   - Proxy hafif olmalı: DB sorgusu yapılmaz, JWT'den okuma yapılır.
//
// Neden hard-coded role check yok?
//   - Tüm izinler ROUTE_PERMISSION_MAP üzerinden eşlenir.
//   - `if (role === "ADMIN")` gibi kodlar bakım yükü doğurur.
//   - Yeni modül eklendiğinde sadece map güncellenir.
//
// Trade-off'lar:
//   1. JWT'deki role bilgisi stale olabilir (token süresi boyunca).
//      → Kabul edilebilir: maxAge 8 saat, kritik işlemlerde DB'den teyit.
//   2. Proxy'de Prisma import edilemez (edge-compat kısıtı).
//      → Permission map'i burada string literal olarak tekrarlanır.
//      → permissions.ts'deki map ile senkron tutulmalıdır.
//   3. Sub-route izinleri prefix match ile çözülür.
//      → /orders/new, /orders/123 hepsi "orders:list" iznini gerektirir.
//      → Daha granüler kontrol (ör: sipariş onaylama) Server Actions'da yapılır.
// ─────────────────────────────────────────────────────────────────

import { auth } from "@/auth";
import { NextResponse } from "next/server";

// ─── Tip Tanımları ───
type RoleString = "ADMIN" | "SALES" | "WAREHOUSE" | "VIEWER";

/**
 * Rota → Gerekli İzin eşleme haritası.
 *
 * Bu harita, src/lib/permissions.ts'deki ROUTE_PERMISSIONS ve PERMISSIONS
 * ile senkron tutulmalıdır. Proxy'de Prisma/permissions.ts import
 * edilemediğinden (bundle kısıtı), burada tekrarlanır.
 *
 * Yapı: { pathPrefix: { izinAdı: yetkiliRoller[] } }
 */
const ROUTE_PERMISSION_MAP: Record<string, RoleString[]> = {
    // ── Kullanıcı Yönetimi: Sadece ADMIN ──
    "/users": ["ADMIN"],

    // ── Ürün Yönetimi: Herkes görebilir ──
    "/products": ["ADMIN", "SALES", "WAREHOUSE", "VIEWER"],

    // ── Stok Yönetimi: Herkes görebilir ──
    "/stock": ["ADMIN", "SALES", "WAREHOUSE", "VIEWER"],

    // ── Sipariş Yönetimi: WAREHOUSE hariç ──
    "/orders": ["ADMIN", "SALES", "VIEWER"],

    // ── Fatura: WAREHOUSE hariç ──
    "/invoices": ["ADMIN", "SALES", "VIEWER"],

    // ── Dashboard: Herkes ──
    "/dashboard": ["ADMIN", "SALES", "WAREHOUSE", "VIEWER"],

    // ── Raporlar: Herkes ──
    "/reports": ["ADMIN", "SALES", "WAREHOUSE", "VIEWER"],
};

/**
 * Korumalı rota prefix'leri — bu prefix'lerle başlayan tüm rotalar
 * authentication gerektirir. İzin kontrolü ROUTE_PERMISSION_MAP'e
 * göre yapılır.
 */
const PROTECTED_PREFIXES = Object.keys(ROUTE_PERMISSION_MAP);

/**
 * Herkese açık rotalar — authentication gerekmez.
 */
const PUBLIC_PATHS = [
    "/login",
    "/api/auth",  // Auth.js'in kendi endpoint'leri
];

/**
 * Verilen pathname'in public olup olmadığını kontrol eder.
 */
function isPublicPath(pathname: string): boolean {
    return PUBLIC_PATHS.some(
        (path) => pathname === path || pathname.startsWith(path + "/")
    );
}

/**
 * Verilen pathname'in korumalı rota prefix'lerinden biriyle
 * eşleşip eşleşmediğini kontrol eder.
 * Eşleşirse yetkili rolleri döner, eşleşmezse null.
 */
function getRequiredRoles(pathname: string): RoleString[] | null {
    for (const [prefix, roles] of Object.entries(ROUTE_PERMISSION_MAP)) {
        if (pathname === prefix || pathname.startsWith(prefix + "/")) {
            return roles;
        }
    }
    return null;
}

// ─── Proxy Fonksiyonu ───

export const proxy = auth((req) => {
    const { pathname } = req.nextUrl;

    // ─── 1. Public rotalar → geçir ───
    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    // ─── 2. Statik dosyalar ve Next.js internal → geçir ───
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    // ─── 3. Auth kontrolü ───
    const session = req.auth;

    if (!session?.user) {
        // Oturum yok → login sayfasına yönlendir
        // API istekleri için 401 JSON döndür
        if (pathname.startsWith("/api/")) {
            return NextResponse.json(
                { error: { code: "UNAUTHORIZED", message: "Oturum bulunamadı." } },
                { status: 401 }
            );
        }

        const loginUrl = new URL("/login", req.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // ─── 4. RBAC kontrolü ───
    const userRole = session.user.role as RoleString | undefined;

    if (!userRole) {
        // Token'da role yok — geçersiz token durumu
        if (pathname.startsWith("/api/")) {
            return NextResponse.json(
                { error: { code: "UNAUTHORIZED", message: "Geçersiz oturum." } },
                { status: 401 }
            );
        }
        const loginUrl = new URL("/login", req.nextUrl.origin);
        return NextResponse.redirect(loginUrl);
    }

    const requiredRoles = getRequiredRoles(pathname);

    if (requiredRoles && !requiredRoles.includes(userRole)) {
        // Rol yetersiz → 403
        if (pathname.startsWith("/api/")) {
            return NextResponse.json(
                {
                    error: {
                        code: "FORBIDDEN",
                        message: `Bu sayfaya erişim yetkiniz bulunmamaktadır. Gerekli roller: ${requiredRoles.join(", ")}`,
                    },
                },
                { status: 403 }
            );
        }

        // Sayfalar için 403 sayfasına yönlendir
        const forbiddenUrl = new URL("/forbidden", req.nextUrl.origin);
        return NextResponse.redirect(forbiddenUrl);
    }

    // ─── 5. İzin verildi → devam ───
    return NextResponse.next();
});

// ─── Proxy Config ───
// Hangi yolların proxy'den geçeceğini belirler.
// Statik dosyalar ve Next.js internal yolları hariç tutulur.
export const config = {
    matcher: [
        /*
         * Aşağıdaki yollar HARİÇ tüm istekleri eşle:
         * - _next/static (statik dosyalar)
         * - _next/image (görüntü optimizasyonu)
         * - favicon.ico (favicon)
         * - public klasörü dosyaları
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
