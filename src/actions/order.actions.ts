// ─────────────────────────────────────────────────────────────────
// Order Server Actions (Phase 5: +audit, +rate-limit)
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, RateLimitError, type ActionResult } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createOrderSchema, orderActionSchema, orderFilterSchema } from "@/schemas/order.schema";
import * as orderService from "@/services/order.service";

// ─── Sipariş Oluşturma (DRAFT) ───
export async function createOrderAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof orderService.createOrder>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "orders:create");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = createOrderSchema.parse(input);
        const result = await orderService.createOrder(validated, user.id);

        await logAudit({
            userId: user.id, action: "order.create", entity: "Order",
            entityId: result.id,
            metadata: { orderNumber: result.orderNumber, itemCount: validated.items.length },
            duration: Date.now() - start,
        });

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
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const { orderId, organizationId, warehouseId } = orderActionSchema.parse(input);
        const result = await orderService.approveOrder(orderId, user.id, organizationId, warehouseId);

        await logAudit({
            userId: user.id, action: "order.approve", entity: "Order",
            entityId: orderId,
            metadata: { orderNumber: result.orderNumber },
            duration: Date.now() - start,
        });

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
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const { orderId, organizationId, warehouseId } = orderActionSchema.parse(input);
        const result = await orderService.cancelOrder(orderId, user.id, organizationId, warehouseId);

        await logAudit({
            userId: user.id, action: "order.cancel", entity: "Order",
            entityId: orderId,
            metadata: { orderNumber: result.orderNumber },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Sipariş Detayı (read) ───
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

// ─── Sipariş Listesi (read) ───
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
