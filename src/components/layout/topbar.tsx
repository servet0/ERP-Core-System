"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// ── Route → Label Map ──

const routeLabels: Record<string, string> = {
    "/": "Dashboard",
    "/products": "Ürünler",
    "/warehouses": "Depolar",
    "/inventory": "Stok",
    "/sales": "Satışlar",
    "/settings": "Ayarlar",
};

export function Topbar() {
    const pathname = usePathname();

    // Build breadcrumb from pathname
    const segments = pathname === "/" ? [] : pathname.split("/").filter(Boolean);
    const currentLabel = routeLabels[pathname] ?? segments[segments.length - 1] ?? "Sayfa";

    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-sm px-4">
            {/* Sidebar toggle (hamburger on mobile, collapse on desktop) */}
            <SidebarTrigger className="-ml-1 h-8 w-8" />
            <Separator orientation="vertical" className="mr-2 h-4" />

            {/* Breadcrumb */}
            <Breadcrumb className="flex-1">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/">ERP Core</BreadcrumbLink>
                    </BreadcrumbItem>
                    {segments.length > 0 && (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </>
                    )}
                </BreadcrumbList>
            </Breadcrumb>

            {/* Actions */}
            <div className="flex items-center gap-1">
                <ThemeToggle />
            </div>
        </header>
    );
}
