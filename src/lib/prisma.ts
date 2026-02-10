// ─────────────────────────────────────────────────────────────────
// Prisma Client Singleton
// ─────────────────────────────────────────────────────────────────
// Neden singleton?
//   Next.js development modunda hot-reload her dosya değişikliğinde
//   modülleri yeniden yükler. Her yeniden yüklemede yeni bir
//   PrismaClient oluşturulursa bağlantı havuzu (connection pool)
//   tükenir. Global nesne üzerinden singleton pattern bu sorunu çözer.
//
// Production'da Node.js modüller yalnızca bir kez yüklenir,
// dolayısıyla globalThis trick'i gereksizdir ama zararsızdır.
// ─────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === "development"
                ? ["query", "error", "warn"]
                : ["error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;
