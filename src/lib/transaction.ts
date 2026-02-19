// ─────────────────────────────────────────────────────────────────
// Transaction Yardımcıları
// ─────────────────────────────────────────────────────────────────
// Neden bu dosya?
//   Prisma'nın interactive transaction'ları doğrudan $transaction
//   ile yapılabilir, ancak pessimistic locking (FOR UPDATE) için
//   raw SQL gerekir. Bu yardımcılar, raw SQL'i tip-güvenli bir
//   şekilde sarmalayarak service katmanında tekrar eden kodu önler.
//
// Neden FOR UPDATE (Pessimistic Locking)?
//   ERP sistemlerinde stok miktarı birden fazla kullanıcı tarafından
//   aynı anda değiştirilebilir. Optimistic locking (version column)
//   yüksek çakışma senaryolarında sürekli retry gerektirir.
//   Pessimistic locking, satırı kilitlediğinden çakışma riski sıfırdır.
//   Dezavantaj: Kısa süreli bekleme (ms düzeyinde) oluşabilir.
//   ERP iş yüklerinde bu kabul edilebilir bir trade-off'tur.
// ─────────────────────────────────────────────────────────────────

import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "./prisma";

/**
 * Prisma interactive transaction tipi.
 * Service fonksiyonlarında parametre olarak kullanılır.
 */
export type TransactionClient = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Transaction içinde çalışan bir fonksiyonu yürütür.
 * Tüm yazma operasyonları bu fonksiyon üzerinden geçmelidir.
 *
 * @param fn - Transaction client'ı alan ve sonuç dönen fonksiyon
 * @param options - Prisma transaction seçenekleri
 *
 * @example
 * ```ts
 * const result = await withTransaction(async (tx) => {
 *   const product = await lockProductForUpdate(tx, productId);
 *   // ... iş mantığı
 *   return product;
 * });
 * ```
 */
export async function withTransaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
    options?: {
        maxWait?: number;   // Transaction'ın başlaması için maksimum bekleme (ms)
        timeout?: number;   // Transaction'ın tamamlanması için maksimum süre (ms)
        isolationLevel?: Prisma.TransactionIsolationLevel;
    }
): Promise<T> {
    return prisma.$transaction(fn, {
        maxWait: options?.maxWait ?? 5000,
        timeout: options?.timeout ?? 10000,
        isolationLevel: options?.isolationLevel,
    });
}

/**
 * Bir ürün satırını pessimistic lock ile kilitler (SELECT ... FOR UPDATE).
 * Transaction içinde kullanılmalıdır.
 *
 * Neden raw SQL?
 *   Prisma query API'si FOR UPDATE desteklemez. $queryRaw ile
 *   doğrudan PostgreSQL'in satır kilitleme mekanizmasını kullanırız.
 *
 * @returns Kilitlenen ürün kaydı (id, sku, name, unit, price, active, organization_id)
 */
export async function lockProductForUpdate(
    tx: TransactionClient,
    productId: string
): Promise<{
    id: string;
    sku: string;
    name: string;
    unit: string;
    price: Prisma.Decimal;
    organization_id: string;
    active: boolean;
} | null> {
    const results = await (tx as PrismaClient).$queryRaw<
        Array<{
            id: string;
            sku: string;
            name: string;
            unit: string;
            price: Prisma.Decimal;
            organization_id: string;
            active: boolean;
        }>
    >`
    SELECT id, sku, name, unit, price, organization_id, active
    FROM products
    WHERE id = ${productId}
    FOR UPDATE
  `;

    return results[0] ?? null;
}

/**
 * Bir sipariş satırını pessimistic lock ile kilitler.
 * Transaction içinde kullanılmalıdır.
 */
export async function lockOrderForUpdate(
    tx: TransactionClient,
    orderId: string
): Promise<{
    id: string;
    order_number: string;
    status: string;
    total_amount: Prisma.Decimal;
    created_by_id: string;
} | null> {
    const results = await (tx as PrismaClient).$queryRaw<
        Array<{
            id: string;
            order_number: string;
            status: string;
            total_amount: Prisma.Decimal;
            created_by_id: string;
        }>
    >`
    SELECT id, order_number, status, total_amount, created_by_id
    FROM orders
    WHERE id = ${orderId}
    FOR UPDATE
  `;

    return results[0] ?? null;
}
/**
 * Bir satış satırını pessimistic lock ile kilitler.
 * Transaction içinde kullanılmalıdır.
 */
export async function lockSaleForUpdate(
    tx: TransactionClient,
    saleId: string
): Promise<{
    id: string;
    sale_number: string;
    status: string;
    organization_id: string;
    warehouse_id: string;
    total_amount: Prisma.Decimal;
    created_by_id: string;
} | null> {
    const results = await (tx as PrismaClient).$queryRaw<
        Array<{
            id: string;
            sale_number: string;
            status: string;
            organization_id: string;
            warehouse_id: string;
            total_amount: Prisma.Decimal;
            created_by_id: string;
        }>
    >`
    SELECT id, sale_number, status, organization_id, warehouse_id, total_amount, created_by_id
    FROM sales
    WHERE id = ${saleId}
    FOR UPDATE
  `;

    return results[0] ?? null;
}

/**
 * Bir sonraki ardışık numara üretir.
 * Transaction içinde çağrılarak çakışma önlenir.
 *
 * @param tx - Transaction client
 * @param prefix - Numara öneki (ör: "SIP", "FAT")
 * @param table - Tablo adı ("orders" veya "invoices")
 * @param column - Numara sütunu ("order_number" veya "invoice_number")
 *
 * @returns "SIP-2026-00001" formatında ardışık numara
 *
 * Neden bu yaklaşım?
 *   PostgreSQL sequence kullanılabilirdi ancak yıl bazlı sıfırlama
 *   ve özel format gerekliliği nedeniyle uygulama katmanında hesaplanır.
 *   Transaction kilidi sayesinde çift numara oluşmaz.
 */
export async function generateSequentialNumber(
    tx: TransactionClient,
    prefix: string,
    table: "orders" | "invoices" | "sales",
    column: "order_number" | "invoice_number" | "sale_number"
): Promise<string> {
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-%`;

    // En son numarayı bul (kilitli transaction içinde)
    let lastNumber: string | null = null;

    if (table === "orders") {
        const result = await (tx as PrismaClient).$queryRaw<
            Array<{ order_number: string }>
        >`
      SELECT order_number FROM orders
      WHERE order_number LIKE ${pattern}
      ORDER BY order_number DESC
      LIMIT 1
      FOR UPDATE
    `;
        lastNumber = result[0]?.order_number ?? null;
    } else if (table === "invoices") {
        const result = await (tx as PrismaClient).$queryRaw<
            Array<{ invoice_number: string }>
        >`
      SELECT invoice_number FROM invoices
      WHERE invoice_number LIKE ${pattern}
      ORDER BY invoice_number DESC
      LIMIT 1
      FOR UPDATE
    `;
        lastNumber = result[0]?.invoice_number ?? null;
    } else {
        const result = await (tx as PrismaClient).$queryRaw<
            Array<{ sale_number: string }>
        >`
      SELECT sale_number FROM sales
      WHERE sale_number LIKE ${pattern}
      ORDER BY sale_number DESC
      LIMIT 1
      FOR UPDATE
    `;
        lastNumber = result[0]?.sale_number ?? null;
    }

    let nextSeq = 1;
    if (lastNumber) {
        // "SIP-2026-00042" → 42
        const parts = lastNumber.split("-");
        const seqPart = parts[parts.length - 1];
        nextSeq = parseInt(seqPart, 10) + 1;
    }

    // 5 haneli sıfır dolgulu: 00001, 00042, 99999
    const seqStr = nextSeq.toString().padStart(5, "0");
    return `${prefix}-${year}-${seqStr}`;
}
