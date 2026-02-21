import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getUserOrganizationId } from "@/lib/get-user-org";
import { getInventory } from "./_lib/queries";
import { inventoryColumns } from "./_components/columns";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, DataTableSkeleton } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";

interface Props {
    searchParams: Promise<{ search?: string }>;
}

export default async function InventoryPage({ searchParams }: Props) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const params = await searchParams;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Stok Durumu"
                description="Ürünlerin depo bazlı stok seviyelerini izleyin"
                icon={BarChart3}
            />

            <div className="flex items-center gap-4">
                <SearchInput placeholder="Ürün adı veya SKU ile ara..." />
            </div>

            <Suspense fallback={<DataTableSkeleton columns={5} />}>
                <InventoryTable userId={user.id} search={params.search} />
            </Suspense>
        </div>
    );
}

async function InventoryTable({
    userId,
    search,
}: {
    userId: string;
    search?: string;
}) {
    const orgId = await getUserOrganizationId(userId);
    const inventory = await getInventory(orgId, search);

    return (
        <DataTable
            columns={inventoryColumns}
            data={inventory}
            keyExtractor={(row) => row.id}
            emptyTitle="Stok kaydı bulunamadı"
            emptyDescription="Henüz stok kaydı bulunmamaktadır."
        />
    );
}
