"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getUserOrganizationId } from "@/lib/get-user-org";
import { createSaleSchema } from "@/schemas/sale.schema";
import * as saleService from "@/services/sale.service";

export type FormState = {
    success: boolean;
    error?: string;
    fieldErrors?: Record<string, string[]>;
};

export async function createSale(
    _prev: FormState,
    formData: FormData
): Promise<FormState> {
    try {
        const user = await requireAuth();
        const orgId = await getUserOrganizationId(user.id);

        const itemsRaw = formData.get("items") as string;
        const items = JSON.parse(itemsRaw || "[]") as Array<{
            productId: string;
            quantity: number;
            unitPrice: number;
        }>;

        const raw = {
            organizationId: orgId,
            warehouseId: formData.get("warehouseId"),
            customerName: formData.get("customerName"),
            note: formData.get("note") || undefined,
            items,
        };

        const validated = createSaleSchema.parse(raw);
        await saleService.createSale(validated, user.id);

        revalidatePath("/sales");
        revalidatePath("/inventory");
        return { success: true };
    } catch (error) {
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "Beklenmeyen bir hata oluştu." };
    }
}
