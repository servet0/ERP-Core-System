import prisma from "@/lib/prisma";

export async function getWarehouses(orgId: string, search?: string) {
    return prisma.warehouse.findMany({
        where: {
            organizationId: orgId,
            ...(search
                ? { name: { contains: search, mode: "insensitive" } }
                : {}),
        },
        include: {
            _count: { select: { stocks: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
}

export type WarehouseRow = Awaited<ReturnType<typeof getWarehouses>>[number];
