// ─────────────────────────────────────────────────────────────────
// Auth.js v5 — API Route Handler
// ─────────────────────────────────────────────────────────────────
// Auth.js tüm auth işlemlerini bu route üzerinden gerçekleştirir:
//   GET  /api/auth/signin     — Giriş sayfası (varsayılan)
//   POST /api/auth/signin     — Giriş işlemi
//   POST /api/auth/signout    — Çıkış işlemi
//   GET  /api/auth/session    — Session bilgisi
//   GET  /api/auth/csrf       — CSRF token
//   GET  /api/auth/providers  — Aktif provider'lar
//
// [...nextauth] catch-all route, tüm auth path'lerini yakalar.
// ─────────────────────────────────────────────────────────────────

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
