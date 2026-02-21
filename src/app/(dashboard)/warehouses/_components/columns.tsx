import type { Column } from "@/components/shared/data-table";
import type { WarehouseRow } from "../_lib/queries";
import { StatusBadge } from "@/components/shared/status-badge";

export const warehouseColumns: Column<WarehouseRow>[] = [
    {
        key: "name",
        header: "Depo Adı",
        render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
        key: "code",
        header: "Kod",
        render: (row) => (
            <span className="font-mono text-xs">{row.code}</span>
        ),
    },
    {
        key: "address",
        header: "Adres",
        render: (row) => (
            <span className="text-muted-foreground">{row.address ?? "—"}</span>
        ),
    },
    {
        key: "stockCount",
        header: "Ürün Sayısı",
        render: (row) => row._count.stocks,
        className: "text-right",
    },
    {
        key: "status",
        header: "Durum",
        render: () => <StatusBadge status="active" />,
    },
];
