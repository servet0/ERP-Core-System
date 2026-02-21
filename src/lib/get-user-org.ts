import prisma from "@/lib/prisma";

/**
 * Kullanıcının organizasyon ID'sini veritabanından çözümler.
 * Multi-tenant yapıda tüm data-fetch işlemleri bu ID ile filtrelenir.
 */
export async function getUserOrganizationId(userId: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { organizationId: true },
    });

    if (!user.organizationId) {
        throw new Error("Kullanıcıya atanmış bir organizasyon bulunamadı.");
    }

    return user.organizationId;
}
