import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShoppingCart, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getUserOrganizationId } from "@/lib/get-user-org";
import { getSales } from "./_lib/queries";
import { saleColumns } from "./_components/columns";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, DataTableSkeleton } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";

interface Props {
    searchParams: Promise<{ search?: string }>;
}

export default async function SalesPage({ searchParams }: Props) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const params = await searchParams;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Satışlar"
                description="Satış işlemlerini yönetin"
                icon={ShoppingCart}
                action={
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Yeni Satış
                    </Button>
                }
            />

            <div className="flex items-center gap-4">
                <SearchInput placeholder="Satış no veya müşteri adı ile ara..." />
            </div>

            <Suspense fallback={<DataTableSkeleton columns={5} />}>
                <SalesTable userId={user.id} search={params.search} />
            </Suspense>
        </div>
    );
}

async function SalesTable({
    userId,
    search,
}: {
    userId: string;
    search?: string;
}) {
    const orgId = await getUserOrganizationId(userId);
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
