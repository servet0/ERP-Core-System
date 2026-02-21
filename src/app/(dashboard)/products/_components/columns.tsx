import type { Column } from "@/components/shared/data-table";
import type { ProductRow } from "../_lib/queries";
import { StatusBadge } from "@/components/shared/status-badge";

function getStockStatus(product: ProductRow): string {
    const totalStock = product.stocks.reduce((sum, s) => sum + s.quantity, 0);
    const minStock = product.stocks[0]?.minQuantity ?? 0;

    if (totalStock === 0) return "critical";
    if (totalStock <= minStock) return "low";
    return "normal";
}

export const productColumns: Column<ProductRow>[] = [
    {
        key: "name",
        header: "Ürün Adı",
        render: (row) => (
            <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.category?.name}</p>
            </div>
        ),
    },
    {
        key: "sku",
        header: "SKU",
        render: (row) => (
            <span className="font-mono text-xs">{row.sku}</span>
        ),
    },
    {
        key: "price",
        header: "Fiyat",
        render: (row) => (
            <span>
                {new Intl.NumberFormat("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                }).format(Number(row.price))}
            </span>
        ),
        className: "text-right",
    },
    {
        key: "stock",
        header: "Stok Durumu",
        render: (row) => <StatusBadge status={getStockStatus(row)} />,
    },
    {
        key: "createdAt",
        header: "Oluşturulma",
        render: (row) =>
            new Intl.DateTimeFormat("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            }).format(row.createdAt),
        className: "text-right",
    },
];
