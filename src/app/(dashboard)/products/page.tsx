import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Package, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getUserOrganizationId } from "@/lib/get-user-org";
import { getProducts } from "./_lib/queries";
import { productColumns } from "./_components/columns";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, DataTableSkeleton } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";

interface Props {
    searchParams: Promise<{ search?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const params = await searchParams;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Ürünler"
                description="Ürün kataloğunu yönetin"
                icon={Package}
                action={
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Yeni Ürün
                    </Button>
                }
            />

            <div className="flex items-center gap-4">
                <SearchInput placeholder="Ürün adı veya SKU ile ara..." />
            </div>

            <Suspense fallback={<DataTableSkeleton columns={5} />}>
                <ProductsTable userId={user.id} search={params.search} />
            </Suspense>
        </div>
    );
}

async function ProductsTable({
    userId,
    search,
}: {
    userId: string;
    search?: string;
}) {
    const orgId = await getUserOrganizationId(userId);
    const products = await getProducts(orgId, search);

    return (
        <DataTable
            columns={productColumns}
            data={products}
            keyExtractor={(row) => row.id}
            emptyTitle="Ürün bulunamadı"
            emptyDescription="Henüz ürün eklenmemiş. Yeni bir ürün ekleyerek başlayın."
        />
    );
}
