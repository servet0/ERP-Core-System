// ─────────────────────────────────────────────────────────────────
// Product Server Actions (Phase 5: +audit, +rate-limit)
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, RateLimitError, type ActionResult } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createProductSchema, updateProductSchema, productFilterSchema } from "@/schemas/product.schema";
import * as productService from "@/services/product.service";

// ─── Ürün Listesi (read) ───
export async function listProductsAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof productService.listProducts>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "products:list");

        const filter = productFilterSchema.parse(input);
        const result = await productService.listProducts(filter);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Ürün Detayı (read) ───
export async function getProductAction(
    id: string
): Promise<ActionResult<Awaited<ReturnType<typeof productService.getProductById>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "products:list");

        const result = await productService.getProductById(id);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Ürün Oluşturma ───
export async function createProductAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof productService.createProduct>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "products:create");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = createProductSchema.parse(input);
        const result = await productService.createProduct(validated);

        await logAudit({
            userId: user.id, action: "product.create", entity: "Product",
            entityId: result.id, metadata: { sku: result.sku, name: result.name },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}

// ─── Ürün Güncelleme ───
export async function updateProductAction(
    input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof productService.updateProduct>>>> {
    try {
        const user = await requireAuth();
        requirePermission(user.role, "products:update");
        if (!checkRateLimit(user.id, RATE_LIMITS.ACTION)) throw new RateLimitError();

        const start = Date.now();
        const validated = updateProductSchema.parse(input);
        const result = await productService.updateProduct(validated);

        await logAudit({
            userId: user.id, action: "product.update", entity: "Product",
            entityId: result.id, metadata: { changedFields: Object.keys(validated) },
            duration: Date.now() - start,
        });

        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}
