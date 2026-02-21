import prisma from "@/lib/prisma";

export async function getInventory(orgId: string, search?: string) {
    return prisma.stock.findMany({
        where: {
            organizationId: orgId,
            ...(search
                ? {
                    product: {
                        OR: [
                            { name: { contains: search, mode: "insensitive" } },
                            { sku: { contains: search, mode: "insensitive" } },
                        ],
                    },
                }
                : {}),
        },
        include: {
            product: { select: { name: true, sku: true, unit: true } },
            warehouse: { select: { name: true, code: true } },
        },
        orderBy: { quantity: "asc" },
        take: 50,
    });
}

export type InventoryRow = Awaited<ReturnType<typeof getInventory>>[number];
