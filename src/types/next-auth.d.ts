// ─────────────────────────────────────────────────────────────────
// Auth.js v5 — TypeScript Type Augmentation
// ─────────────────────────────────────────────────────────────────
// Auth.js'in varsayılan tipleri User, Session ve JWT'de
// sadece id, name, email, image alanlarını tanımlar.
// ERP sisteminde her token/session'da `role` bilgisine
// ihtiyaç duyulduğundan, tipleri genişletiyoruz.
//
// Bu dosya sayesinde:
//   session.user.role   → TypeScript hatası vermez
//   token.role          → TypeScript hatası vermez
//   authorize() return  → role alanını kabul eder
//
// Dosya konumu: src/types/next-auth.d.ts
//   TypeScript module augmentation için herhangi bir yerde
//   olabilir, tsconfig.json include'a dahildir.
// ─────────────────────────────────────────────────────────────────

import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
    /**
     * Session.user nesnesine `id` ve `role` eklenir.
     * `DefaultSession["user"]` zaten name, email, image içerir.
     */
    interface Session {
        user: {
            id: string;
            role: Role;
        } & DefaultSession["user"];
    }

    /**
     * authorize() callback'inden dönen User nesnesine `role` eklenir.
     */
    interface User {
        role?: Role;
    }
}

declare module "next-auth/jwt" {
    /**
     * JWT token'a `id` ve `role` eklenir.
     * Bu alanlar jwt callback'inde set edilir.
     */
    interface JWT {
        id: string;
        role: Role;
    }
}
