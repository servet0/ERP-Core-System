"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Package,
    Warehouse,
    BarChart3,
    ShoppingCart,
    Settings,
    type LucideIcon,
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";

// ── Navigation Items ──

interface NavItem {
    title: string;
    href: string;
    icon: LucideIcon;
    permission?: string;
}

const mainNavItems: NavItem[] = [
    { title: "Dashboard", href: "/", icon: LayoutDashboard },
    { title: "Ürünler", href: "/products", icon: Package, permission: "products:list" },
    { title: "Depolar", href: "/warehouses", icon: Warehouse, permission: "warehouses:list" },
    { title: "Stok", href: "/inventory", icon: BarChart3, permission: "stock:list" },
    { title: "Satışlar", href: "/sales", icon: ShoppingCart, permission: "sales:list" },
];

const bottomNavItems: NavItem[] = [
    { title: "Ayarlar", href: "/settings", icon: Settings },
];

// ── Sidebar Component ──

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    userPermissions?: string[];
}

export function AppSidebar({ userPermissions, ...props }: AppSidebarProps) {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    const hasPermission = (permission?: string) => {
        if (!permission) return true;
        if (!userPermissions) return true; // show all if permissions not loaded
        return userPermissions.includes(permission);
    };

    return (
        <Sidebar collapsible="icon" variant="sidebar" {...props}>
            {/* ── Logo / Brand ── */}
            <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Package className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-sm font-semibold leading-none">
                            ERP Core
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-none mt-0.5">
                            Stok & Satış
                        </span>
                    </div>
                </Link>
            </SidebarHeader>

            {/* ── Main Navigation ── */}
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Ana Menü</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {mainNavItems
                                .filter((item) => hasPermission(item.permission))
                                .map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive(item.href)}
                                            tooltip={item.title}
                                        >
                                            <Link href={item.href}>
                                                <item.icon className="h-4 w-4" />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* ── Bottom: Settings + User ── */}
            <SidebarFooter>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {bottomNavItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.href)}
                                        tooltip={item.title}
                                    >
                                        <Link href={item.href}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <NavUser />
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
