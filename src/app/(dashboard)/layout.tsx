import { redirect } from "next/navigation";
import { cache } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { RoleProvider } from "@/lib/hooks/use-user-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/rbac";

const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";

interface AssignmentQueryRow {
    class_id: string;
    section_id: string;
    classes?: { name: string } | null;
    sections?: { name: string } | null;
}

const loadUserContext = cache(async (userId: string) => {
    const supabase = await createServerSupabaseClient();
    const [profileRes, assignmentRes] = await Promise.all([
        supabase.from("profiles").select("role, full_name").eq("id", userId).maybeSingle(),
        (supabase as any)
            .from("class_teacher_assignments")
            .select("class_id, section_id, classes ( name ), sections ( name )")
            .eq("user_id", userId),
    ]);

    let role: UserRole | null = null;
    let fullName: string | null = null;
    let assignments: { class_id: string; section_id: string; class_name?: string; section_name?: string }[] = [];

    if (profileRes.data) {
        role = (profileRes.data.role as UserRole) || null;
        fullName = profileRes.data.full_name || null;
    }

    if (assignmentRes.data) {
        const rawData = assignmentRes.data as unknown as AssignmentQueryRow[];
        assignments = rawData.map((a) => ({
            class_id: a.class_id,
            section_id: a.section_id,
            class_name: a.classes?.name,
            section_name: a.sections?.name,
        }));
    }

    return { role, fullName, assignments };
});

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let role: UserRole | null = null;
    let userId: string | null = null;
    let email: string | null = null;
    let fullName: string | null = null;
    let assignments: { class_id: string; section_id: string; class_name?: string; section_name?: string }[] = [];

    const hasSupabaseConfig = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    if (!AUTH_DISABLED && hasSupabaseConfig) {
        try {
            const supabase = await createServerSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                redirect("/login");
            }

            userId = user.id;
            email = user.email ?? null;

            const context = await loadUserContext(user.id);
            role = context.role;
            fullName = context.fullName;
            assignments = context.assignments;
        } catch (error: any) {
            // Re-throw redirect exceptions so Next.js handles navigation properly
            if (error?.digest?.startsWith("NEXT_REDIRECT")) {
                throw error;
            }
        }
    }

    return (
        <RoleProvider
            initialRole={role}
            initialUserId={userId}
            initialEmail={email}
            initialFullName={fullName}
            initialAssignments={assignments}
        >
            <div className="flex min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header />
                    <main id="main-content" className="flex-1 flex flex-col">
                        <div className="pt-14 lg:pt-0 flex-1 flex flex-col pb-20 lg:pb-8">
                            <div className="animate-slide-up p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto flex-1">
                                {children}
                            </div>
                        </div>
                    </main>
                    <MobileBottomNav />
                </div>
            </div>
        </RoleProvider>
    );
}
