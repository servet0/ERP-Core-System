// ─────────────────────────────────────────────────────────────────
// Outbox Worker — Background Event Processor
// ─────────────────────────────────────────────────────────────────
// Poll-based worker:
//   1. SELECT ... FOR UPDATE SKIP LOCKED → pick one PENDING event
//   2. Mark PROCESSING
//   3. Call handler
//   4. Mark DONE or increment retryCount
//   5. After maxRetries → FAILED (dead letter)
//
// Trade-off: Polling vs CDC (Change Data Capture)
//   CDC (Debezium) → real-time, complex infra
//   Polling → simple, 5s latency, zero dependency
//   Decision: Polling for MVP. CDC upgrade path documented.
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { handleOutboxEvent } from "@/lib/outbox-handlers";
import type { OutboxEventType } from "@/lib/outbox";
import type { PrismaClient } from "@prisma/client";

const POLL_INTERVAL_MS = 5_000;     // 5 saniye
const SHUTDOWN_GRACE_MS = 10_000;   // Graceful shutdown bekleme

let isRunning = false;

/**
 * Tek bir PENDING event'i alır ve işler.
 * SELECT FOR UPDATE SKIP LOCKED ile çakışma önlenir.
 * @returns true if an event was processed
 */
async function processNextEvent(): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
        const txClient = tx as unknown as PrismaClient;

        // SKIP LOCKED: Eğer başka bir worker bu satırı kilitledi ise atla
        const events = await txClient.$queryRaw<
            Array<{ id: string; type: string; payload: unknown; retry_count: number; max_retries: number }>
        >`
      SELECT id, type, payload, retry_count, max_retries
      FROM outbox_events
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

        if (events.length === 0) return false;

        const event = events[0];

        // Mark as PROCESSING
        await txClient.outboxEvent.update({
            where: { id: event.id },
            data: { status: "PROCESSING" },
        });

        try {
            await handleOutboxEvent(
                event.type as OutboxEventType,
                event.payload as Record<string, unknown>
            );

            // Success → DONE
            await txClient.outboxEvent.update({
                where: { id: event.id },
                data: {
                    status: "DONE",
                    processedAt: new Date(),
                },
            });

            logger.info(`Event processed: ${event.type}`, { eventId: event.id });
        } catch (err) {
            const newRetryCount = event.retry_count + 1;
            const isFinal = newRetryCount >= event.max_retries;

            await txClient.outboxEvent.update({
                where: { id: event.id },
                data: {
                    status: isFinal ? "FAILED" : "PENDING",
                    retryCount: newRetryCount,
                    error: err instanceof Error ? err.message : String(err),
                    processedAt: isFinal ? new Date() : null,
                },
            });

            if (isFinal) {
                logger.error(`Event FAILED permanently: ${event.type}`, {
                    eventId: event.id,
                    error: err instanceof Error ? err.message : String(err),
                });
            } else {
                logger.warn(`Event retry ${newRetryCount}/${event.max_retries}: ${event.type}`, {
                    eventId: event.id,
                });
            }
        }

        return true;
    });
}

/**
 * Worker ana döngüsü.
 * SIGINT/SIGTERM ile graceful shutdown.
 */
export async function startWorker(): Promise<void> {
    isRunning = true;
    logger.info("Outbox worker started", { pollInterval: POLL_INTERVAL_MS });

    // Graceful shutdown
    const shutdown = () => {
        logger.info("Outbox worker shutting down...");
        isRunning = false;
        setTimeout(() => {
            logger.warn("Forced shutdown after grace period");
            process.exit(0);
        }, SHUTDOWN_GRACE_MS);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    while (isRunning) {
        try {
            const processed = await processNextEvent();

            if (!processed) {
                // Nothing to process — wait before next poll
                await sleep(POLL_INTERVAL_MS);
            }
            // If processed, immediately try next (drain queue faster)
        } catch (err) {
            logger.error("Worker poll error", {
                error: err instanceof Error ? err.message : String(err),
            });
            await sleep(POLL_INTERVAL_MS);
        }
    }

    logger.info("Outbox worker stopped gracefully");
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
