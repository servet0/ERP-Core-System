import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

export default function DashboardPage() {
    return (
        <div className="space-y-8">
            <PageHeader
                title="Dashboard"
                description="Genel bakış ve özet bilgiler"
                icon={LayoutDashboard}
            />

            {/* Data cards and content will be added in future phases */}
            <div className="rounded-2xl border bg-card p-12 text-center">
                <p className="text-sm text-muted-foreground">
                    İçerik bir sonraki aşamada eklenecek.
                </p>
            </div>
        </div>
    );
}
