// ─────────────────────────────────────────────────────────────────
// Outbox Worker Entry Point
// ─────────────────────────────────────────────────────────────────
// Usage: npx tsx src/worker/run-worker.ts
// ─────────────────────────────────────────────────────────────────

import { startWorker } from "@/lib/outbox-worker";

startWorker().catch((err) => {
    console.error("Worker failed to start:", err);
    process.exit(1);
});
