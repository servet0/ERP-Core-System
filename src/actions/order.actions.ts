// ─────────────────────────────────────────────────────────────────
// Order Server Actions — Application Katmanı
// ─────────────────────────────────────────────────────────────────
// Sipariş operasyonlarında granüler izin kontrolü:
//   - Oluşturma: orders:create (ADMIN, SALES)
//   - Onaylama: orders:approve (sadece ADMIN)
//   - İptal: orders:cancel (sadece ADMIN)
//   - Listeleme: orders:list (ADMIN, SALES, VIEWER)
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, type ActionResult } from "@/lib/errors";
import { createOrderSchema, orderActionSchema, orderFilterSchema } from "@/schemas/order.schema";
import * as orderService from "@/services/order.service";

// ─── Sipariş Oluşturma (DRAFT) ───
export async function createOrderAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof orderService.createOrder>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "orders:create");

        const validated = createOrderSchema.parse(input);
        const result = await orderService.createOrder(validated, user.id);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Sipariş Onaylama (DRAFT → APPROVED) ───
export async function approveOrderAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof orderService.approveOrder>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "orders:approve");

        const { orderId } = orderActionSchema.parse(input);
        const result = await orderService.approveOrder(orderId, user.id);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Sipariş İptal (APPROVED → CANCELLED) ───
export async function cancelOrderAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof orderService.cancelOrder>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "orders:cancel");

        const { orderId } = orderActionSchema.parse(input);
        const result = await orderService.cancelOrder(orderId, user.id);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Sipariş Detayı ───
export async function getOrderAction(
    id: string
): Promise<ActionResult<Awaited<ReturnType<typeof orderService.getOrderById>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "orders:list");

        const result = await orderService.getOrderById(id);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Sipariş Listesi ───
export async function listOrdersAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof orderService.listOrders>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "orders:list");

        const filter = orderFilterSchema.parse(input);
        const result = await orderService.listOrders(filter);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}
