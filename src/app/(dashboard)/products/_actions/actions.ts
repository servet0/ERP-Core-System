"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getUserOrganizationId } from "@/lib/get-user-org";
import { createProductSchema } from "@/schemas/product.schema";
import * as productService from "@/services/product.service";

export type FormState = {
    success: boolean;
    error?: string;
    fieldErrors?: Record<string, string[]>;
};

export async function createProduct(
    _prev: FormState,
    formData: FormData
): Promise<FormState> {
    try {
        const user = await requireAuth();
        const orgId = await getUserOrganizationId(user.id);

        const raw = {
            name: formData.get("name"),
            sku: formData.get("sku"),
            price: Number(formData.get("price") || 0),
            unit: (formData.get("unit") as string) || "ADET",
            minStock: Number(formData.get("minStock") || 0),
        };

        const validated = createProductSchema.parse(raw);
        await productService.createProduct(orgId, validated);

        revalidatePath("/products");
        return { success: true };
    } catch (error) {
        if (error instanceof Error && "fieldErrors" in error) {
            const ve = error as Error & { fieldErrors: Record<string, string[]> };
            return { success: false, error: ve.message, fieldErrors: ve.fieldErrors };
        }
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "Beklenmeyen bir hata oluştu." };
    }
}
