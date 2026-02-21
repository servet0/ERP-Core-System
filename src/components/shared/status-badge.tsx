import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type StatusVariant = "default" | "success" | "warning" | "destructive" | "secondary";

const STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
    // General
    active: { label: "Aktif", variant: "success" },
    inactive: { label: "Pasif", variant: "secondary" },

    // Sales / Orders
    DRAFT: { label: "Taslak", variant: "secondary" },
    APPROVED: { label: "Onaylı", variant: "success" },
    CANCELLED: { label: "İptal", variant: "destructive" },
    PENDING: { label: "Bekliyor", variant: "warning" },

    // Stock
    low: { label: "Düşük Stok", variant: "destructive" },
    normal: { label: "Normal", variant: "success" },
    critical: { label: "Kritik", variant: "destructive" },
};

const VARIANT_CLASSES: Record<StatusVariant, string> = {
    default: "",
    success:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
    warning:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
    destructive:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
    secondary: "",
};

interface StatusBadgeProps {
    status: string;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const mapped = STATUS_MAP[status];
    const label = mapped?.label ?? status;
    const variant = mapped?.variant ?? "default";

    return (
        <Badge
            variant={variant === "success" || variant === "warning" ? "outline" : variant}
            className={cn(
                VARIANT_CLASSES[variant],
                "font-medium",
                className
            )}
        >
            {label}
        </Badge>
    );
}
