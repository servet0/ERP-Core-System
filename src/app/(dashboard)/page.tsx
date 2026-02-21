import { redirect } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Building2,
    UserCheck,
    Package,
    Warehouse,
    ShoppingCart,
    BarChart3,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import prisma from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { DataCard } from "@/components/shared/data-card";

// ── Data Fetching ──

async function getDashboardStats() {
    const [
        totalUsers,
        activeUsers,
        totalOrganizations,
        totalProducts,
        totalWarehouses,
        totalSales,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { active: true } }),
        prisma.organization.count(),
        prisma.product.count(),
        prisma.warehouse.count(),
        prisma.sale.count(),
    ]);

    return {
        totalUsers,
        activeUsers,
        totalOrganizations,
        totalProducts,
        totalWarehouses,
        totalSales,
    };
}

// ── Page ──

export default async function DashboardPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const stats = await getDashboardStats();

    return (
        <div className="space-y-8">
            <PageHeader
                title="Dashboard"
                description={`Hoş geldiniz, ${user.name}`}
                icon={LayoutDashboard}
            />

            {/* ── System Stats (ADMIN) ── */}
            {user.role === "ADMIN" && (
                <section className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Sistem
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <DataCard
                            label="Toplam Kullanıcı"
                            value={stats.totalUsers}
                            icon={Users}
                        />
                        <DataCard
                            label="Aktif Kullanıcı"
                            value={stats.activeUsers}
                            icon={UserCheck}
                        />
                        <DataCard
                            label="Organizasyon"
                            value={stats.totalOrganizations}
                            icon={Building2}
                        />
                    </div>
                </section>
            )}

            {/* ── Operations Overview ── */}
            <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Operasyonlar
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DataCard
                        label="Ürünler"
                        value={stats.totalProducts}
                        icon={Package}
                    />
                    <DataCard
                        label="Depolar"
                        value={stats.totalWarehouses}
                        icon={Warehouse}
                    />
                    <DataCard
                        label="Satışlar"
                        value={stats.totalSales}
                        icon={ShoppingCart}
                    />
                </div>
            </section>

            {/* ── Quick Actions Placeholder ── */}
            <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Hızlı Erişim
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <QuickLink
                        href="/products"
                        icon={Package}
                        label="Ürünler"
                        description="Ürün kataloğunu yönet"
                    />
                    <QuickLink
                        href="/inventory"
                        icon={BarChart3}
                        label="Stok"
                        description="Stok durumunu görüntüle"
                    />
                    <QuickLink
                        href="/sales"
                        icon={ShoppingCart}
                        label="Satışlar"
                        description="Satış işlemlerini yönet"
                    />
                    <QuickLink
                        href="/warehouses"
                        icon={Warehouse}
                        label="Depolar"
                        description="Depo bilgilerini düzenle"
                    />
                </div>
            </section>
        </div>
    );
}

// ── Quick Link Card ──

function QuickLink({
    href,
    icon: Icon,
    label,
    description,
}: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
}) {
    return (
        <a
            href={href}
            className="group flex items-start gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent"
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Icon className="h-4 w-4" />
            </div>
            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
        </a>
    );
}
