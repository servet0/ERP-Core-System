// ─────────────────────────────────────────────────────────────────
// Typed Error Hierarchy (Phase 5)
// ─────────────────────────────────────────────────────────────────
// BusinessError → AppError (rename + genişletme)
// Serbest string code → ErrorCode union type (type-safe)
// isOperational: true = beklenen iş hatası, false = sistem hatası
// ─────────────────────────────────────────────────────────────────

import { ZodError } from "zod";
import { logger } from "./logger";

// ── Error Codes ──

export type ErrorCode =
    | "UNAUTHORIZED"
    | "SESSION_EXPIRED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "VALIDATION_ERROR"
    | "INSUFFICIENT_STOCK"
    | "INVALID_ORDER_STATUS"
    | "DUPLICATE_INVOICE"
    | "RATE_LIMIT_EXCEEDED"
    | "INTERNAL_ERROR";

// ── Base Error ──

export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(
        code: ErrorCode,
        message: string,
        statusCode: number = 400,
        isOperational: boolean = true
    ) {
        super(message);
        this.name = "AppError";
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
    }
}

// Backward compat alias — mevcut import'ları kırmamak için
export const BusinessError = AppError;

// ── Domain Errors ──

export class InsufficientStockError extends AppError {
    public readonly sku: string;
    public readonly available: number;
    public readonly requested: number;

    constructor(sku: string, available: number, requested: number) {
        super(
            "INSUFFICIENT_STOCK",
            `Yetersiz stok: ${sku} için ${requested} adet istendi, mevcut: ${available}`
        );
        this.name = "InsufficientStockError";
        this.sku = sku;
        this.available = available;
        this.requested = requested;
    }
}

export class InvalidOrderStatusError extends AppError {
    constructor(currentStatus: string, targetStatus: string) {
        super(
            "INVALID_ORDER_STATUS",
            `Geçersiz durum geçişi: ${currentStatus} → ${targetStatus}`
        );
        this.name = "InvalidOrderStatusError";
    }
}

export class DuplicateInvoiceError extends AppError {
    constructor(orderNumber: string) {
        super(
            "DUPLICATE_INVOICE",
            `${orderNumber} numaralı sipariş için zaten fatura kesilmiştir.`
        );
        this.name = "DuplicateInvoiceError";
    }
}

// ── Auth Errors ──

export class UnauthorizedError extends AppError {
    constructor(message: string = "Bu işlem için yetkiniz bulunmamaktadır.") {
        super("UNAUTHORIZED", message, 403);
        this.name = "UnauthorizedError";
    }
}

// ── Infra Errors ──

export class NotFoundError extends AppError {
    constructor(message: string, id?: string) {
        super("NOT_FOUND", id ? `${message} bulunamadı: ${id}` : message, 404);
        this.name = "NotFoundError";
    }
}

export class ValidationError extends AppError {
    public readonly fieldErrors: Record<string, string[]>;

    constructor(message: string, fieldErrors?: Record<string, string[]>) {
        super("VALIDATION_ERROR", message);
        this.name = "ValidationError";
        this.fieldErrors = fieldErrors ?? {};
    }
}

export class RateLimitError extends AppError {
    constructor() {
        super("RATE_LIMIT_EXCEEDED", "Çok fazla istek gönderdiniz. Lütfen bekleyin.", 429);
        this.name = "RateLimitError";
    }
}

// ─────────────────────────────────────────────────────────────────
// ActionResult<T> — Server Action sonuç tipi
// ─────────────────────────────────────────────────────────────────

export type ActionResult<T = void> =
    | { success: true; data: T }
    | {
        success: false;
        error: {
            code: ErrorCode;
            message: string;
            fieldErrors?: Record<string, string[]>;
        };
    };

// ─────────────────────────────────────────────────────────────────
// handleActionError — Server Action hata yakalama
// ─────────────────────────────────────────────────────────────────

export function handleActionError(error: unknown): ActionResult<never> {
    // 1. Zod doğrulama hatası
    if (error instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of error.issues) {
            const path = issue.path.join(".");
            if (!fieldErrors[path]) fieldErrors[path] = [];
            fieldErrors[path].push(issue.message);
        }
        logger.warn("Validation Error (Zod)", { fieldErrors });
        return {
            success: false,
            error: { code: "VALIDATION_ERROR", message: "Veri doğrulama hatası", fieldErrors },
        };
    }

    // 2. Kendi hata sınıflarımız (operational)
    if (error instanceof ValidationError) {
        return {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                fieldErrors: error.fieldErrors,
            },
        };
    }

    if (error instanceof AppError) {
        if (error.isOperational) {
            logger.warn(`[${error.code}] ${error.message}`);
        } else {
            logger.error(`[SYSTEM] ${error.code}`, { message: error.message });
        }
        return {
            success: false,
            error: { code: error.code, message: error.message },
        };
    }

    // 3. Beklenmeyen hata — kullanıcıya detay verilmemeli
    logger.error("Unexpected Error", {
        error: error instanceof Error ? error.message : String(error),
    });
    return {
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
        },
    };
}
