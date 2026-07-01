import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { RoleProvider } from "@/lib/hooks/use-user-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/rbac";

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

    try {
        const supabase = (await createServerSupabaseClient()) as any;
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            userId = user.id;
            email = user.email ?? null;

            const { data: profile } = await supabase
                .from("profiles")
                .select("role, full_name")
                .eq("id", user.id)
                .single();

            if (profile) {
                role = profile.role as UserRole;
                fullName = profile.full_name || null;
            }

            if (role === "class_teacher") {
                const { data: assignmentData } = await (supabase as any)
                    .from("class_teacher_assignments")
                    .select("class_id, section_id, classes ( name ), sections ( name )")
                    .eq("user_id", user.id);

                if (assignmentData) {
                    assignments = assignmentData.map((a: any) => ({
                        class_id: a.class_id as string,
                        section_id: a.section_id as string,
                        class_name: a.classes?.name,
                        section_name: a.sections?.name,
                    }));
                }
            }
        }
    } catch {
        // Auth not configured or profile table doesn't exist yet
    }

    return (
        <RoleProvider
            initialRole={role}
            initialUserId={userId}
            initialEmail={email}
            initialFullName={fullName}
            initialAssignments={assignments}
        >
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
        </RoleProvider>
    );
}
