// ─────────────────────────────────────────────────────────────────
// İş Mantığı Hata Sınıfları
// ─────────────────────────────────────────────────────────────────
// Neden özel hata sınıfları?
//   1. Server Actions'da hata türünü ayırt edip kullanıcıya uygun
//      mesaj göstermek için (iş hatası vs beklenmeyen hata).
//   2. `code` alanı, frontend'de i18n veya hata eşleme için kullanılabilir.
//   3. Loglama katmanında iş hataları (expected) ile sistem hataları
//      (unexpected) farklı seviyede loglanır.
// ─────────────────────────────────────────────────────────────────

/**
 * Tüm iş mantığı hatalarının temel sınıfı.
 * Bu hata türü "beklenen" hatalardır — kullanıcıya mesaj gösterilebilir.
 */
export class BusinessError extends Error {
    public readonly code: string;
    public readonly statusCode: number;

    constructor(code: string, message: string, statusCode: number = 400) {
        super(message);
        this.name = "BusinessError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

/**
 * Stok yetersizliği hatası.
 * Bir ürünün mevcut stoğu istenen miktardan az olduğunda fırlatılır.
 */
export class InsufficientStockError extends BusinessError {
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

/**
 * Geçersiz sipariş durumu geçişi hatası.
 * Örn: CANCELLED → APPROVED geçişi denendiğinde fırlatılır.
 */
export class InvalidOrderStatusError extends BusinessError {
    public readonly currentStatus: string;
    public readonly targetStatus: string;

    constructor(currentStatus: string, targetStatus: string) {
        super(
            "INVALID_ORDER_STATUS",
            `Geçersiz durum geçişi: ${currentStatus} → ${targetStatus}`
        );
        this.name = "InvalidOrderStatusError";
        this.currentStatus = currentStatus;
        this.targetStatus = targetStatus;
    }
}

/**
 * Yetkilendirme hatası.
 * Kullanıcının rolü istenen işlem için yetersiz olduğunda fırlatılır.
 */
export class UnauthorizedError extends BusinessError {
    constructor(message: string = "Bu işlem için yetkiniz bulunmamaktadır.") {
        super("UNAUTHORIZED", message, 403);
        this.name = "UnauthorizedError";
    }
}

/**
 * Mükerrer fatura hatası.
 * Bir sipariş için zaten fatura kesildiyse fırlatılır.
 */
export class DuplicateInvoiceError extends BusinessError {
    constructor(orderNumber: string) {
        super(
            "DUPLICATE_INVOICE",
            `${orderNumber} numaralı sipariş için zaten fatura kesilmiştir.`
        );
        this.name = "DuplicateInvoiceError";
    }
}

/**
 * Kayıt bulunamadı hatası.
 */
export class NotFoundError extends BusinessError {
    constructor(entity: string, id: string) {
        super("NOT_FOUND", `${entity} bulunamadı: ${id}`, 404);
        this.name = "NotFoundError";
    }
}

/**
 * Validasyon hatası — Zod hataları için sarmalayıcı.
 */
export class ValidationError extends BusinessError {
    public readonly fieldErrors: Record<string, string[]>;

    constructor(fieldErrors: Record<string, string[]>) {
        const fields = Object.keys(fieldErrors).join(", ");
        super("VALIDATION_ERROR", `Doğrulama hatası: ${fields}`);
        this.name = "ValidationError";
        this.fieldErrors = fieldErrors;
    }
}

// ─────────────────────────────────────────────────────────────────
// Yardımcı: Server Action sonuç tipi
// ─────────────────────────────────────────────────────────────────

/**
 * Tüm Server Actions bu tip ile sonuç döner.
 * Başarısızlık durumunda hata kodu ve mesajı içerir.
 */
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };

/**
 * Server Action'larda kullanılacak hata yakalama yardımcısı.
 * BusinessError → yapılandırılmış hata yanıtı
 * Diğer hatalar → genel hata mesajı (detaylar loglanır)
 */
export function handleActionError(error: unknown): ActionResult<never> {
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

    if (error instanceof BusinessError) {
        return {
            success: false,
            error: {
                code: error.code,
                message: error.message,
            },
        };
    }

    // Beklenmeyen hata — loglama yapılmalı, kullanıcıya detay verilmemeli
    console.error("[UNEXPECTED_ERROR]", error);
    return {
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
        },
    };
}
