// ─────────────────────────────────────────────────────────────────
// Auth.js v5 — Ana Konfigürasyon
// ─────────────────────────────────────────────────────────────────
// Bu dosya Auth.js'in tüm konfigürasyonunu içerir ve dışa aktarır:
//   - handlers: API route handler'ları (GET, POST)
//   - auth: Server Components'ta session okuma
//   - signIn: Programatik giriş
//   - signOut: Programatik çıkış
//
// Neden Credentials Provider?
//   ERP sistemlerinde kullanıcılar kurumsal veritabanında
//   tanımlıdır. OAuth/sosyal giriş uygun değildir.
//   E-posta + şifre ile Prisma üzerinden doğrulama yapılır.
//
// Neden JWT strategy?
//   1. DB session tablosu gereksiz karmaşıklık ekler.
//   2. JWT token içinde userId ve role taşınır.
//   3. Her istekte DB sorgusu gerekmez (performans).
//   4. Trade-off: Rol değişikliği anında yansımaz,
//      kullanıcı yeniden giriş yapmalıdır.
// ─────────────────────────────────────────────────────────────────

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";

export const { handlers, signIn, signOut, auth } = NextAuth({
    // ── Session Stratejisi ──
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60, // 8 saat — iş günü süresi
    },

    // ── Sayfa Yönlendirmeleri ──
    pages: {
        signIn: "/login",
        error: "/login",
    },

    // ── Provider'lar ──
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: {
                    label: "E-posta",
                    type: "email",
                    placeholder: "admin@erp.com",
                },
                password: {
                    label: "Şifre",
                    type: "password",
                },
            },

            async authorize(credentials) {
                // ─── Temel doğrulama ───
                const email = credentials?.email as string | undefined;
                const password = credentials?.password as string | undefined;

                if (!email || !password) {
                    return null;
                }

                // ─── Kullanıcıyı veritabanından bul ───
                const user = await prisma.user.findUnique({
                    where: { email: email.toLowerCase().trim() },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        passwordHash: true,
                        role: true,
                        active: true,
                    },
                });

                if (!user) {
                    // Kullanıcı bulunamadı — güvenlik için genel hata
                    return null;
                }

                // ─── Hesap aktiflik kontrolü ───
                if (!user.active) {
                    // Deaktif edilmiş hesap — giriş engellenir
                    return null;
                }

                // ─── Şifre doğrulama ───
                const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
                if (!isPasswordValid) {
                    return null;
                }

                // ─── Başarılı — kullanıcı nesnesi döndür ───
                // Bu nesne JWT token'a yazılır (jwt callback üzerinden)
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                };
            },
        }),
    ],

    // ── Callback'ler ──
    callbacks: {
        /**
         * JWT callback — Token oluşturulduğunda ve her istekte çağrılır.
         *
         * İlk giriş (trigger === "signIn"):
         *   user nesnesi authorize'dan gelir, token'a eklenir.
         *
         * Sonraki istekler:
         *   user undefined'dır, token mevcut verileri taşır.
         */
        async jwt({ token, user }) {
            if (user) {
                // İlk giriş — authorize'dan dönen veriyi token'a yaz
                token.id = user.id as string;
                token.role = (user as { role: Role }).role;
            }
            return token;
        },

        /**
         * Session callback — session nesnesi oluşturulduğunda çağrılır.
         * Token'dan session.user'a veri aktarır.
         *
         * Bu sayede Server Components'ta:
         *   const session = await auth();
         *   session?.user?.id    // ✅
         *   session?.user?.role  // ✅
         */
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as Role;
            }
            return session;
        },
    },
});
