"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getUserOrganizationId } from "@/lib/get-user-org";
import { createWarehouseSchema } from "@/schemas/warehouse.schema";
import prisma from "@/lib/prisma";

export type FormState = {
    success: boolean;
    error?: string;
    fieldErrors?: Record<string, string[]>;
};

export async function createWarehouse(
    _prev: FormState,
    formData: FormData
): Promise<FormState> {
    try {
        const user = await requireAuth();
        const orgId = await getUserOrganizationId(user.id);

        const raw = {
            name: formData.get("name"),
            code: formData.get("code"),
            address: formData.get("address") || undefined,
        };

        const validated = createWarehouseSchema.parse(raw);

        // Depo kodu teklik kontrolü (org-scoped)
        const existing = await prisma.warehouse.findUnique({
            where: {
                organizationId_code: {
                    organizationId: orgId,
                    code: validated.code,
                },
            },
        });

        if (existing) {
            return {
                success: false,
                error: "Bu depo kodu zaten kullanılmaktadır.",
                fieldErrors: { code: ["Bu depo kodu zaten kullanılmaktadır."] },
            };
        }

        // Transaction: depo oluştur + tüm ürünler için stok kaydı aç
        await prisma.$transaction(async (tx) => {
            const warehouse = await tx.warehouse.create({
                data: {
                    organizationId: orgId,
                    name: validated.name,
                    code: validated.code,
                    address: validated.address,
                },
            });

            // Organizasyondaki tüm aktif ürünler için stok kaydı oluştur (qty=0)
            const products = await tx.product.findMany({
                where: { organizationId: orgId, active: true, deletedAt: null },
                select: { id: true },
            });

            if (products.length > 0) {
                await tx.stock.createMany({
                    data: products.map((p) => ({
                        organizationId: orgId,
                        productId: p.id,
                        warehouseId: warehouse.id,
                        quantity: 0,
                        minQuantity: 0,
                    })),
                });
            }

            return warehouse;
        });

        revalidatePath("/warehouses");
        revalidatePath("/inventory");
        return { success: true };
    } catch (error) {
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "Beklenmeyen bir hata oluştu." };
    }
}
