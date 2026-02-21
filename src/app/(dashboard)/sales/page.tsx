import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShoppingCart } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getUserOrganizationId } from "@/lib/get-user-org";
import { getSales } from "./_lib/queries";
import { saleColumns } from "./_components/columns";
import { CreateSaleDialog } from "./_components/create-sale-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, DataTableSkeleton } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import prisma from "@/lib/prisma";

interface Props {
    searchParams: Promise<{ search?: string }>;
}

export default async function SalesPage({ searchParams }: Props) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const orgId = await getUserOrganizationId(user.id);
    const params = await searchParams;

    // Dialog dropdowns için ürün ve depo listeleri
    const [products, warehouses] = await Promise.all([
        prisma.product.findMany({
            where: { organizationId: orgId, active: true, deletedAt: null },
            select: { id: true, name: true, sku: true, price: true },
            orderBy: { name: "asc" },
        }),
        prisma.warehouse.findMany({
            where: { organizationId: orgId, active: true },
            select: { id: true, name: true, code: true },
            orderBy: { name: "asc" },
        }),
    ]);

    const serializedProducts = products.map((p) => ({
        ...p,
        price: Number(p.price),
    }));

    return (
        <div className="space-y-6">
            <PageHeader
                title="Satışlar"
                description="Satış işlemlerini yönetin"
                icon={ShoppingCart}
                action={
                    <CreateSaleDialog
                        products={serializedProducts}
                        warehouses={warehouses}
                    />
                }
            />

            <div className="flex items-center gap-4">
                <SearchInput placeholder="Satış no veya müşteri adı ile ara..." />
            </div>

            <Suspense fallback={<DataTableSkeleton columns={5} />}>
                <SalesTable orgId={orgId} search={params.search} />
            </Suspense>
        </div>
    );
}

async function SalesTable({
    orgId,
    search,
}: {
    orgId: string;
    search?: string;
}) {
    const sales = await getSales(orgId, search);

    return (
        <DataTable
            columns={saleColumns}
            data={sales}
            keyExtractor={(row) => row.id}
            emptyTitle="Satış bulunamadı"
            emptyDescription="Henüz satış kaydı bulunmamaktadır."
        />
    );
}
