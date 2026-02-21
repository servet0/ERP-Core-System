import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DataCardProps {
    label: string;
    value: string | number;
    icon?: LucideIcon;
    description?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
}

export function DataCard({
    label,
    value,
    icon: Icon,
    description,
    trend,
    className,
}: DataCardProps) {
    return (
        <div
            className={cn(
                "rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md",
                className
            )}
        >
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                {Icon && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
                <p className="text-3xl font-semibold tracking-tight">{value}</p>
                {trend && (
                    <span
                        className={cn(
                            "text-xs font-medium",
                            trend.isPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                        )}
                    >
                        {trend.isPositive ? "+" : ""}
                        {trend.value}%
                    </span>
                )}
            </div>
            {description && (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
        </div>
    );
}
