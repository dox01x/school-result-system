import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1">
                    <div className="pt-14 lg:pt-0">
                        <div className="animate-fade-in p-5 lg:p-8 max-w-[1400px] mx-auto">{children}</div>
                    </div>
                </main>
            </div>
        </div>
    );
}
