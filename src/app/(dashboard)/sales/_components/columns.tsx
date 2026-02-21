import type { Column } from "@/components/shared/data-table";
import type { SaleRow } from "../_lib/queries";
import { StatusBadge } from "@/components/shared/status-badge";

function calculateTotal(sale: SaleRow): number {
    return sale.items.reduce(
        (sum, item) => sum + item.quantity * Number(item.unitPrice),
        0
    );
}

export const saleColumns: Column<SaleRow>[] = [
    {
        key: "saleNumber",
        header: "Satış No",
        render: (row) => (
            <span className="font-mono text-xs font-medium">
                {row.saleNumber}
            </span>
        ),
    },
    {
        key: "customerName",
        header: "Müşteri",
        render: (row) => <span className="font-medium">{row.customerName}</span>,
    },
    {
        key: "total",
        header: "Toplam",
        render: (row) => (
            <span>
                {new Intl.NumberFormat("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                }).format(calculateTotal(row))}
            </span>
        ),
        className: "text-right",
    },
    {
        key: "status",
        header: "Durum",
        render: (row) => <StatusBadge status={row.status} />,
    },
    {
        key: "createdAt",
        header: "Tarih",
        render: (row) =>
            new Intl.DateTimeFormat("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            }).format(row.createdAt),
        className: "text-right",
    },
];
