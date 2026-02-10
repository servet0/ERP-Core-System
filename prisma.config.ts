// ─────────────────────────────────────────────────────────────────
// Prisma v7 Configuration
// ─────────────────────────────────────────────────────────────────
// Prisma v7, datasource URL'i schema.prisma'dan kaldırıp
// bu dosyaya taşınmasını gerektirir. .env dosyasındaki
// DATABASE_URL değerini okur ve Prisma CLI'a iletir.
// ─────────────────────────────────────────────────────────────────

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
