// ─────────────────────────────────────────────────────────────────
// TypeScript Tip Tanımları
// ─────────────────────────────────────────────────────────────────
// Bu dosya, Prisma'nın otomatik ürettiği tiplere ek olarak
// uygulama genelinde kullanılan özel tipleri içerir.
// ─────────────────────────────────────────────────────────────────

import { Role } from "@prisma/client";
import { Permission } from "@/lib/permissions";

/**
 * Oturum açmış kullanıcının temel bilgileri.
 * NextAuth session ve JWT token'da saklanır.
 */
export interface SessionUser {
    id: string;
    email: string;
    name: string;
    role: Role;
}

/**
 * Sayfalama parametreleri.
 */
export interface PaginationParams {
    page: number;
    pageSize: number;
}

/**
 * Sayfalı sonuç sarmalayıcısı.
 */
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Sıralama parametreleri.
 */
export interface SortParams {
    field: string;
    direction: "asc" | "desc";
}

/**
 * Stok hareket özeti (dashboard ve raporlar için).
 */
export interface StockMovementSummary {
    productId: string;
    productSku: string;
    productName: string;
    totalIn: number;
    totalOut: number;
    netChange: number;
}

/**
 * Dashboard istatistikleri.
 */
export interface DashboardStats {
    totalProducts: number;
    totalOrders: number;
    todayOrders: number;
    lowStockProducts: number;
    pendingOrders: number;
    totalStockValue: number;
}

/**
 * Düşük stok uyarısı.
 */
export interface LowStockAlert {
    productId: string;
    sku: string;
    name: string;
    currentStock: number;
    minStock: number;
    deficit: number; // minStock - currentStock
}
