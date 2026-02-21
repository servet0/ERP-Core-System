import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

// ── Types ──

export interface Column<T> {
    key: string;
    header: string;
    render?: (row: T) => React.ReactNode;
    className?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyExtractor: (row: T) => string;
    emptyTitle?: string;
    emptyDescription?: string;
}

// ── DataTable ──

export function DataTable<T>({
    columns,
    data,
    keyExtractor,
    emptyTitle = "Veri bulunamadı",
    emptyDescription = "Henüz kayıt bulunmamaktadır.",
}: DataTableProps<T>) {
    if (data.length === 0) {
        return (
            <EmptyState
                icon={Inbox}
                title={emptyTitle}
                description={emptyDescription}
            />
        );
    }

    return (
        <div className="rounded-2xl border bg-card">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        "px-4 py-3 text-left font-medium text-muted-foreground",
                                        col.className
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <tr
                                key={keyExtractor(row)}
                                className="border-b last:border-0 transition-colors hover:bg-muted/30"
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={cn("px-4 py-3", col.className)}
                                    >
                                        {col.render
                                            ? col.render(row)
                                            : String(
                                                (row as Record<string, unknown>)[col.key] ?? ""
                                            )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Loading Skeleton ──

export function DataTableSkeleton({
    columns = 5,
    rows = 5,
}: {
    columns?: number;
    rows?: number;
}) {
    return (
        <div className="rounded-2xl border bg-card">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            {Array.from({ length: columns }).map((_, i) => (
                                <th key={i} className="px-4 py-3">
                                    <Skeleton className="h-4 w-24" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: rows }).map((_, i) => (
                            <tr key={i} className="border-b last:border-0">
                                {Array.from({ length: columns }).map((_, j) => (
                                    <td key={j} className="px-4 py-3">
                                        <Skeleton className="h-4 w-full max-w-[120px]" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
