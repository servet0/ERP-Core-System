// ─────────────────────────────────────────────────────────────────
// Structured Logger
// ─────────────────────────────────────────────────────────────────
// Production: JSON lines → log aggregator uyumlu
// Development: Renkli, okunabilir format
// ─────────────────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

const COLORS: Record<LogLevel, string> = {
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m",  // Green
    warn: "\x1b[33m",  // Yellow
    error: "\x1b[31m", // Red
};
const RESET = "\x1b[0m";

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
    const ts = new Date().toISOString();

    if (process.env.NODE_ENV === "production") {
        // JSON line format — Datadog, Grafana Loki, CloudWatch uyumlu
        console.log(JSON.stringify({ level, msg, ts, ...meta }));
    } else {
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
        console.log(`${COLORS[level]}[${level.toUpperCase()}]${RESET} ${msg}${metaStr}`);
    }
}

export const logger = {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
