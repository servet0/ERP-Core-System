// ─────────────────────────────────────────────────────────────────
// Report Service — Dashboard & Raporlama
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import type { DashboardStats } from "@/types";

// ─── Dashboard İstatistikleri ───
export async function getDashboardStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
        totalProducts,
        totalOrders,
        todayOrders,
        lowStockProducts,
        pendingOrders,
        stockValueResult,
    ] = await Promise.all([
        // Aktif ürün sayısı
        prisma.product.count({ where: { active: true } }),

        // Toplam sipariş sayısı
        prisma.order.count(),

        // Bugünkü sipariş sayısı
        prisma.order.count({
            where: { createdAt: { gte: today } },
        }),

        // Düşük stoklu ürün sayısı (currentStock < minStock ve minStock > 0)
        prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count
      FROM products
      WHERE current_stock < min_stock
        AND min_stock > 0
        AND active = true
    `.then((r) => Number(r[0].count)),

        // Onay bekleyen sipariş sayısı
        prisma.order.count({
            where: { status: OrderStatus.DRAFT },
        }),

        // Toplam stok değeri (currentStock * price)
        prisma.$queryRaw<[{ total: number | null }]>`
      SELECT COALESCE(SUM(current_stock * price), 0)::float as total
      FROM products
      WHERE active = true
    `.then((r) => r[0].total ?? 0),
    ]);

    return {
        totalProducts,
        totalOrders,
        todayOrders,
        lowStockProducts,
        pendingOrders,
        totalStockValue: stockValueResult,
    };
}
