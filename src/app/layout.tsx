import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "ERP Core System",
    description: "Sipariş ve Stok Yönetimi - ERP Çekirdek Modülü",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="tr">
            <body>{children}</body>
        </html>
    );
}
