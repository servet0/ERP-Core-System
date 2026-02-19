// ─────────────────────────────────────────────────────────────────
// In-Memory Rate Limiter (Sliding Window)
// ─────────────────────────────────────────────────────────────────
// Trade-off: Redis vs In-Memory
//   Redis  → distributed, survives restart, extra infra
//   Memory → zero dependency, single process, clears on restart
// Karar: MVP için in-memory yeterli. Ölçeklenme → Redis adaptör.
// ─────────────────────────────────────────────────────────────────

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

interface Bucket {
    count: number;
    resetAt: number;
}

const store = new Map<string, Bucket>();

// Periyodik temizlik — memory leak önleme
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of store.entries()) {
            if (now > bucket.resetAt) store.delete(key);
        }
    }, 60_000);
}

/**
 * Rate limit kontrolü.
 * @returns true = izin verildi, false = limit aşıldı
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const bucket = store.get(identifier);

    if (!bucket || now > bucket.resetAt) {
        store.set(identifier, { count: 1, resetAt: now + config.windowMs });
        return true;
    }

    if (bucket.count >= config.maxRequests) return false;

    bucket.count++;
    return true;
}

/** Hazır konfigürasyonlar */
export const RATE_LIMITS = {
    /** Mutating actions: 30 req / dakika (userId bazlı) */
    ACTION: { windowMs: 60_000, maxRequests: 30 } as const,
    /** Auth actions: 10 req / 5 dakika (IP bazlı) */
    AUTH: { windowMs: 300_000, maxRequests: 10 } as const,
} as const;
