// ─────────────────────────────────────────────────────────────────
// Outbox Event Handlers
// ─────────────────────────────────────────────────────────────────
// Her event type için bir handler. Handler'lar idempotent olmalı.
// ─────────────────────────────────────────────────────────────────

import type { OutboxEventType, OrderApprovedPayload, LowStockPayload, UserCreatedPayload } from "./outbox";
import { logger } from "./logger";

// Lazy import — circular dependency önleme
async function getInvoiceService() {
    return import("@/services/invoice.service");
}

/**
 * Event handler registry.
 * Her handler idempotent olmalı — aynı event birden fazla kez
 * işlense bile yan etki tekrarlanmamalı.
 */
export async function handleOutboxEvent(
    type: OutboxEventType,
    payload: Record<string, unknown>
): Promise<void> {
    switch (type) {
        case "ORDER_APPROVED":
            return handleOrderApproved(payload as unknown as OrderApprovedPayload);
        case "SALE_APPROVED":
            logger.info("SALE_APPROVED event processed", payload);
            return;
        case "SALE_CANCELLED":
            logger.info("SALE_CANCELLED event processed", payload);
            return;
        case "LOW_STOCK":
            return handleLowStock(payload as unknown as LowStockPayload);
        case "USER_CREATED":
            return handleUserCreated(payload as unknown as UserCreatedPayload);
        default: {
            const _exhaustive: never = type;
            logger.warn(`Unknown outbox event type: ${_exhaustive}`);
        }
    }
}

// ─── ORDER_APPROVED → Otomatik Fatura Oluşturma ───
async function handleOrderApproved(payload: OrderApprovedPayload): Promise<void> {
    logger.info("Processing ORDER_APPROVED", {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
    });

    try {
        const invoiceService = await getInvoiceService();
        await invoiceService.createInvoice(payload.orderId, payload.userId);
        logger.info("Invoice auto-created for order", {
            orderNumber: payload.orderNumber,
        });
    } catch (err) {
        // DuplicateInvoiceError = idempotent — fatura zaten var, başarılı say
        if (err instanceof Error && err.name === "DuplicateInvoiceError") {
            logger.info("Invoice already exists (idempotent skip)", {
                orderNumber: payload.orderNumber,
            });
            return; // Don't re-throw — mark as DONE
        }
        throw err; // Re-throw for retry
    }
}

// ─── LOW_STOCK → Stok Uyarısı ───
async function handleLowStock(payload: LowStockPayload): Promise<void> {
    // Phase 7: Gerçek bildirim (email, Slack, push notification)
    // Şimdilik yapısal log — log aggregator'da alerting kurulabilir
    logger.warn("LOW STOCK ALERT", {
        sku: payload.sku,
        currentStock: payload.currentStock,
        minStock: payload.minStock,
        productId: payload.productId,
    });
}

// ─── USER_CREATED → Hoş Geldin Email ───
async function handleUserCreated(payload: UserCreatedPayload): Promise<void> {
    // Phase 7: Gerçek email gönderimi (Resend, SendGrid, Nodemailer)
    // Şimdilik yapısal log
    logger.info("WELCOME EMAIL (placeholder)", {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
    });
}
