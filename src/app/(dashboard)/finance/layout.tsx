'use client';

import { useUserRole } from "@/lib/hooks/use-user-role";
import { ShieldAlert as ShieldWarning, Loader2 as SpinnerGap } from "lucide-react";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <SpinnerGap size={24} strokeWidth={1.5} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allowed = role === 'super_admin' || role === 'admin' || role === 'accountant';

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center">
          <ShieldWarning className="w-6 h-6 text-destructive" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Finance Management is restricted to Admin and Accountant roles.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

