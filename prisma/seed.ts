// ─────────────────────────────────────────────────────────────────
// Seed Data — Başlangıç Verileri
// ─────────────────────────────────────────────────────────────────
// Kullanım: npm run db:seed
//
// Bu script:
//   1. Admin kullanıcı oluşturur (admin@erp.com / Admin123!)
//   2. Her rol için birer kullanıcı oluşturur
//   3. Örnek ürünler ekler
//
// Neden seed?
//   - Geliştirme ortamında hemen çalışmaya başlamak için.
//   - Rollerin doğru çalıştığını test etmek için.
//   - CI/CD'de test verisi hazırlamak için.
// ─────────────────────────────────────────────────────────────────

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seed başlatılıyor...\n");

    // ── Kullanıcılar ──
    const defaultPassword = await bcrypt.hash("Admin123!", 12);

    const users = [
        {
            email: "admin@erp.com",
            name: "Sistem Yöneticisi",
            passwordHash: defaultPassword,
            role: Role.ADMIN,
        },
        {
            email: "satis@erp.com",
            name: "Satış Temsilcisi",
            passwordHash: defaultPassword,
            role: Role.SALES,
        },
        {
            email: "depo@erp.com",
            name: "Depo Sorumlusu",
            passwordHash: defaultPassword,
            role: Role.WAREHOUSE,
        },
        {
            email: "izleyici@erp.com",
            name: "İzleyici Kullanıcı",
            passwordHash: defaultPassword,
            role: Role.VIEWER,
        },
    ];

    for (const user of users) {
        const created = await prisma.user.upsert({
            where: { email: user.email },
            update: {},
            create: user,
        });
        console.log(`  ✅ Kullanıcı: ${created.name} (${created.email}) — Rol: ${created.role}`);
    }

    // ── Ürünler ──
    const products = [
        {
            sku: "ELK-001",
            name: "Dizüstü Bilgisayar - ProBook 450",
            description: "15.6 inç, Intel i7, 16GB RAM, 512GB SSD",
            unit: "ADET",
            price: 42500.00,
            minStock: 5,
            currentStock: 50,
        },
        {
            sku: "ELK-002",
            name: "Monitör - 27\" 4K IPS",
            description: "27 inç, 4K UHD, IPS Panel, USB-C",
            unit: "ADET",
            price: 12800.00,
            minStock: 10,
            currentStock: 30,
        },
        {
            sku: "ELK-003",
            name: "Kablosuz Klavye-Mouse Set",
            description: "Bluetooth, şarj edilebilir, Türkçe Q klavye",
            unit: "ADET",
            price: 1250.00,
            minStock: 20,
            currentStock: 100,
        },
        {
            sku: "OFI-001",
            name: "A4 Fotokopi Kağıdı (5\'li Paket)",
            description: "80gr, 500 yaprak x 5 paket",
            unit: "PAKET",
            price: 450.00,
            minStock: 50,
            currentStock: 200,
        },
        {
            sku: "OFI-002",
            name: "Toner Kartuş - HP 26A",
            description: "HP LaserJet Pro uyumlu, siyah",
            unit: "ADET",
            price: 1800.00,
            minStock: 10,
            currentStock: 25,
        },
        {
            sku: "MOB-001",
            name: "Ofis Koltuğu - Ergonomik",
            description: "Yükseklik ayarlı, bel destekli, mesh sırt",
            unit: "ADET",
            price: 8500.00,
            minStock: 3,
            currentStock: 15,
        },
        {
            sku: "KAB-001",
            name: "CAT6 Ethernet Kablosu (100m)",
            description: "CAT6 UTP, 100 metre, mavi",
            unit: "METRE",
            price: 25.00,
            minStock: 500,
            currentStock: 2000,
        },
        {
            sku: "GÜV-001",
            name: "UPS - 1500VA",
            description: "Line-interactive, 1500VA/900W, 6 çıkış",
            unit: "ADET",
            price: 6200.00,
            minStock: 5,
            currentStock: 8,
        },
    ];

    for (const product of products) {
        const created = await prisma.product.upsert({
            where: { sku: product.sku },
            update: {},
            create: product,
        });
        console.log(`  ✅ Ürün: ${created.sku} — ${created.name} (Stok: ${created.currentStock})`);
    }

    console.log("\n🎉 Seed tamamlandı!");
}

main()
    .catch((e) => {
        console.error("❌ Seed hatası:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
