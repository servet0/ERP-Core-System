import prisma from "@/lib/prisma";

export async function getSales(orgId: string, search?: string) {
    return prisma.sale.findMany({
        where: {
            organizationId: orgId,
            ...(search
                ? {
                    OR: [
                        { saleNumber: { contains: search, mode: "insensitive" } },
                        { customerName: { contains: search, mode: "insensitive" } },
                    ],
                }
                : {}),
        },
        include: {
            items: { select: { quantity: true, unitPrice: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
}

export type SaleRow = Awaited<ReturnType<typeof getSales>>[number];
