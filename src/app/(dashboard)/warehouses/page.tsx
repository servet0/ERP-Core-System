import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getUserOrganizationId } from "@/lib/get-user-org";
import { getWarehouses } from "./_lib/queries";
import { warehouseColumns } from "./_components/columns";
import { CreateWarehouseDialog } from "./_components/create-warehouse-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, DataTableSkeleton } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";

interface Props {
    searchParams: Promise<{ search?: string }>;
}

export default async function WarehousesPage({ searchParams }: Props) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const params = await searchParams;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Depolar"
                description="Depo bilgilerini yönetin"
                icon={WarehouseIcon}
                action={
                    user.role === "ADMIN" ? <CreateWarehouseDialog /> : undefined
                }
            />

            <div className="flex items-center gap-4">
                <SearchInput placeholder="Depo adı ile ara..." />
            </div>

            <Suspense fallback={<DataTableSkeleton columns={5} />}>
                <WarehousesTable userId={user.id} search={params.search} />
            </Suspense>
        </div>
    );
}

async function WarehousesTable({
    userId,
    search,
}: {
    userId: string;
    search?: string;
}) {
    const orgId = await getUserOrganizationId(userId);
    const warehouses = await getWarehouses(orgId, search);

    return (
        <DataTable
            columns={warehouseColumns}
            data={warehouses}
            keyExtractor={(row) => row.id}
            emptyTitle="Depo bulunamadı"
            emptyDescription="Henüz depo kaydı bulunmamaktadır."
        />
    );
}
