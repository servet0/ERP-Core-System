import type { Column } from "@/components/shared/data-table";
import type { InventoryRow } from "../_lib/queries";
import { StatusBadge } from "@/components/shared/status-badge";

function getStockLevel(row: InventoryRow): string {
    if (row.quantity === 0) return "critical";
    if (row.quantity <= row.minQuantity) return "low";
    return "normal";
}

export const inventoryColumns: Column<InventoryRow>[] = [
    {
        key: "product",
        header: "Ürün",
        render: (row) => (
            <div>
                <p className="font-medium">{row.product.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                    {row.product.sku}
                </p>
            </div>
        ),
    },
    {
        key: "warehouse",
        header: "Depo",
        render: (row) => (
            <span>
                {row.warehouse.name}{" "}
                <span className="text-xs text-muted-foreground">
                    ({row.warehouse.code})
                </span>
            </span>
        ),
    },
    {
        key: "quantity",
        header: "Miktar",
        render: (row) => (
            <span className="font-medium">
                {row.quantity} {row.product.unit}
            </span>
        ),
        className: "text-right",
    },
    {
        key: "minQuantity",
        header: "Min. Miktar",
        render: (row) => (
            <span className="text-muted-foreground">{row.minQuantity}</span>
        ),
        className: "text-right",
    },
    {
        key: "status",
        header: "Durum",
        render: (row) => <StatusBadge status={getStockLevel(row)} />,
    },
];
