// ─────────────────────────────────────────────────────────────────
// Seed Data — Başlangıç Verileri (Phase 7A: Multi-Tenant)
// ─────────────────────────────────────────────────────────────────
// Kullanım: npx tsx prisma/seed.ts
//
// Bu script:
//   1. Varsayılan organizasyon oluşturur
//   2. Admin ve rol kullanıcıları oluşturur
//   3. Kategoriler ekler
//   4. Varsayılan depo oluşturur
//   5. Örnek ürünler ve başlangıç stoğu ekler
// ─────────────────────────────────────────────────────────────────

import { PrismaClient, Role, StockMovementType, StockReferenceType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🌱 Seed başlatılıyor...\n");

    // ── Organizasyon ──
    const org = await prisma.organization.upsert({
        where: { taxId: "1234567890" },
        update: {},
        create: {
            name: "Demo Şirketi A.Ş.",
            taxId: "1234567890",
        },
    });
    console.log(`  ✅ Organizasyon: ${org.name} (${org.taxId})`);

    // ── Kullanıcılar ──
    const defaultPassword = await bcrypt.hash("Admin123!", 12);

    const users = [
        {
            email: "admin@erp.com",
            name: "Sistem Yöneticisi",
            passwordHash: defaultPassword,
            role: Role.ADMIN,
            organizationId: org.id,
        },
        {
            email: "satis@erp.com",
            name: "Satış Temsilcisi",
            passwordHash: defaultPassword,
            role: Role.SALES,
            organizationId: org.id,
        },
        {
            email: "depo@erp.com",
            name: "Depo Sorumlusu",
            passwordHash: defaultPassword,
            role: Role.WAREHOUSE,
            organizationId: org.id,
        },
        {
            email: "izleyici@erp.com",
            name: "İzleyici Kullanıcı",
            passwordHash: defaultPassword,
            role: Role.VIEWER,
            organizationId: org.id,
        },
    ];

    const createdUsers: Record<string, string> = {};
    for (const user of users) {
        const created = await prisma.user.upsert({
            where: { email: user.email },
            update: {},
            create: user,
        });
        createdUsers[created.role] = created.id;
        console.log(`  ✅ Kullanıcı: ${created.name} (${created.email}) — Rol: ${created.role}`);
    }

    // ── Kategoriler ──
    const categories = [
        { name: "Elektronik", slug: "elektronik" },
        { name: "Ofis Malzemeleri", slug: "ofis-malzemeleri" },
        { name: "Mobilya", slug: "mobilya" },
        { name: "Kablolama", slug: "kablolama" },
        { name: "Güç Sistemleri", slug: "guc-sistemleri" },
    ];

    const catMap: Record<string, string> = {};
    for (const cat of categories) {
        const created = await prisma.category.upsert({
            where: {
                organizationId_slug: {
                    organizationId: org.id,
                    slug: cat.slug,
                },
            },
            update: {},
            create: {
                organizationId: org.id,
                name: cat.name,
                slug: cat.slug,
            },
        });
        catMap[cat.slug] = created.id;
        console.log(`  ✅ Kategori: ${created.name}`);
    }

    // ── Depo ──
    const warehouse = await prisma.warehouse.upsert({
        where: {
            organizationId_code: {
                organizationId: org.id,
                code: "MERKEZ",
            },
        },
        update: {},
        create: {
            organizationId: org.id,
            code: "MERKEZ",
            name: "Merkez Depo",
            address: "İstanbul, Türkiye",
        },
    });
    console.log(`  ✅ Depo: ${warehouse.name} (${warehouse.code})`);

    // ── Ürünler + Stok ──
    const products = [
        { sku: "ELK-001", name: "Dizüstü Bilgisayar - ProBook 450", description: "15.6 inç, Intel i7, 16GB RAM, 512GB SSD", unit: "ADET", price: 42500.00, category: "elektronik", stock: 50, minStock: 5 },
        { sku: "ELK-002", name: "Monitör - 27\" 4K IPS", description: "27 inç, 4K UHD, IPS Panel, USB-C", unit: "ADET", price: 12800.00, category: "elektronik", stock: 30, minStock: 10 },
        { sku: "ELK-003", name: "Kablosuz Klavye-Mouse Set", description: "Bluetooth, şarj edilebilir, Türkçe Q klavye", unit: "ADET", price: 1250.00, category: "elektronik", stock: 100, minStock: 20 },
        { sku: "OFI-001", name: "A4 Fotokopi Kağıdı (5'li Paket)", description: "80gr, 500 yaprak x 5 paket", unit: "PAKET", price: 450.00, category: "ofis-malzemeleri", stock: 200, minStock: 50 },
        { sku: "OFI-002", name: "Toner Kartuş - HP 26A", description: "HP LaserJet Pro uyumlu, siyah", unit: "ADET", price: 1800.00, category: "ofis-malzemeleri", stock: 25, minStock: 10 },
        { sku: "MOB-001", name: "Ofis Koltuğu - Ergonomik", description: "Yükseklik ayarlı, bel destekli, mesh sırt", unit: "ADET", price: 8500.00, category: "mobilya", stock: 15, minStock: 3 },
        { sku: "KAB-001", name: "CAT6 Ethernet Kablosu (100m)", description: "CAT6 UTP, 100 metre, mavi", unit: "METRE", price: 25.00, category: "kablolama", stock: 2000, minStock: 500 },
        { sku: "GÜV-001", name: "UPS - 1500VA", description: "Line-interactive, 1500VA/900W, 6 çıkış", unit: "ADET", price: 6200.00, category: "guc-sistemleri", stock: 8, minStock: 5 },
    ];

    const adminId = createdUsers[Role.ADMIN];

    for (const p of products) {
        const product = await prisma.product.upsert({
            where: {
                organizationId_sku: {
                    organizationId: org.id,
                    sku: p.sku,
                },
            },
            update: {},
            create: {
                organizationId: org.id,
                categoryId: catMap[p.category],
                sku: p.sku,
                name: p.name,
                description: p.description,
                unit: p.unit,
                price: p.price,
            },
        });

        // Stock kaydı oluştur (product × warehouse unique)
        await prisma.stock.upsert({
            where: {
                productId_warehouseId: {
                    productId: product.id,
                    warehouseId: warehouse.id,
                },
            },
            update: {},
            create: {
                organizationId: org.id,
                productId: product.id,
                warehouseId: warehouse.id,
                quantity: p.stock,
                minQuantity: p.minStock,
            },
        });

        // Başlangıç stok hareketi oluştur
        const existingMovement = await prisma.stockMovement.findFirst({
            where: {
                productId: product.id,
                warehouseId: warehouse.id,
                reference: "SEED",
            },
        });

        if (!existingMovement) {
            await prisma.stockMovement.create({
                data: {
                    organizationId: org.id,
                    productId: product.id,
                    warehouseId: warehouse.id,
                    type: StockMovementType.IN,
                    referenceType: StockReferenceType.MANUAL,
                    quantity: p.stock,
                    reference: "SEED",
                    note: "Başlangıç stoğu",
                    createdById: adminId,
                },
            });
        }

        console.log(`  ✅ Ürün: ${product.sku} — ${product.name} (Stok: ${p.stock})`);
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
