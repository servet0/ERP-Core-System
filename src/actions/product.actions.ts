// ─────────────────────────────────────────────────────────────────
// Product Server Actions — Application Katmanı
// ─────────────────────────────────────────────────────────────────

"use server";

import { requireAuth } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { handleActionError, type ActionResult } from "@/lib/errors";
import { createProductSchema, updateProductSchema, productFilterSchema } from "@/schemas/product.schema";
import * as productService from "@/services/product.service";

// ─── Ürün Listesi ───
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

// ─── Ürün Detayı ───
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

        const validated = createProductSchema.parse(input);
        const result = await productService.createProduct(validated);
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

        const validated = updateProductSchema.parse(input);
        const result = await productService.updateProduct(validated);
        return { success: true, data: result };
    } catch (error) {
        return handleActionError(error);
    }
}
