import prisma from "@/lib/prisma";

export async function getProducts(orgId: string, search?: string) {
    return prisma.product.findMany({
        where: {
            organizationId: orgId,
            ...(search
                ? {
                    OR: [
                        { name: { contains: search, mode: "insensitive" } },
                        { sku: { contains: search, mode: "insensitive" } },
                    ],
                }
                : {}),
        },
        include: {
            category: { select: { name: true } },
            stocks: { select: { quantity: true, minQuantity: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
}

export type ProductRow = Awaited<ReturnType<typeof getProducts>>[number];
