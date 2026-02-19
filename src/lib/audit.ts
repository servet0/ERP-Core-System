// ─────────────────────────────────────────────────────────────────
// Audit Log Helper
// ─────────────────────────────────────────────────────────────────
// Fail-safe: Audit log hatası ana akışı ASLA bozmamalı.
// GDPR: sanitizeMetadata ile hassas veriler temizlenir.
// ─────────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface AuditLogParams {
    userId?: string;
    action: string;           // "user.create", "order.approve"
    entity: string;           // "User", "Order", "Product"
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    status?: "SUCCESS" | "FAILURE";
    error?: string;
    duration?: number;        // ms
}

const SENSITIVE_KEYS = ["password", "token", "secret", "creditcard", "passwordhash"];

function sanitizeMetadata(
    metadata: Record<string, unknown>
): Record<string, unknown> {
    const sanitized = { ...metadata };
    for (const key of Object.keys(sanitized)) {
        if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
            sanitized[key] = "***REDACTED***";
        }
    }
    return sanitized;
}

/**
 * Audit log kaydı oluşturur.
 * Hata durumunda sessizce loglar — ana akışı kesmez.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
    try {
        const safeMetadata = params.metadata
            ? sanitizeMetadata(params.metadata)
            : undefined;

        await prisma.auditLog.create({
            data: {
                userId: params.userId,
                action: params.action,
                entity: params.entity,
                entityId: params.entityId,
                metadata: safeMetadata ?? Prisma.JsonNull,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                status: params.status ?? "SUCCESS",
                error: params.error,
                duration: params.duration,
            },
        });

        logger.info(`AUDIT: ${params.action}`, {
            userId: params.userId,
            entity: params.entity,
            entityId: params.entityId,
            status: params.status ?? "SUCCESS",
            duration: params.duration,
        });
    } catch (err) {
        // Audit log ASLA ana akışı kesmez
        logger.error("Audit log yazılamadı", {
            error: err instanceof Error ? err.message : String(err),
            action: params.action,
        });
    }
}
