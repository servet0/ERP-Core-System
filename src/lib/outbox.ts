// ─────────────────────────────────────────────────────────────────
// Outbox — Event Types & Transactional Publish Helper
// ─────────────────────────────────────────────────────────────────
// publishEvent() MUST be called inside withTransaction().
// This guarantees atomicity: business write + event write = same TX.
// ─────────────────────────────────────────────────────────────────

import type { TransactionClient } from "./transaction";
import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// ── Event Types ──

export type OutboxEventType =
    | "ORDER_APPROVED"
    | "LOW_STOCK"
    | "USER_CREATED";

// ── Event Payloads ──

export interface OrderApprovedPayload {
    orderId: string;
    orderNumber: string;
    userId: string;   // who approved
}

export interface LowStockPayload {
    productId: string;
    sku: string;
    currentStock: number;
    minStock: number;
}

export interface UserCreatedPayload {
    userId: string;
    email: string;
    name: string;
}

// ── Publish Helper ──

/**
 * Writes an event to the outbox table INSIDE the current transaction.
 * The event will be picked up by the background worker.
 *
 * @param tx - Transaction client (from withTransaction)
 * @param type - Event type
 * @param payload - Event data (must be JSON-serializable)
 * @param idempotencyKey - Optional dedup key (unique constraint)
 */
export async function publishEvent(
    tx: TransactionClient,
    type: OutboxEventType,
    payload: Record<string, unknown>,
    idempotencyKey?: string
): Promise<void> {
    await (tx as unknown as PrismaClient).outboxEvent.create({
        data: {
            type,
            payload: payload as Prisma.InputJsonValue,
            status: "PENDING",
            idempotencyKey,
        },
    });
}
