'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShieldAlert as ShieldWarning, Loader2 as SpinnerGap } from "lucide-react";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const supabase = createClient() as any;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setAllowed(false); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const role = profile?.role || '';
        // Only super_admin, admin and accountant can access finance pages
        setAllowed(role === 'super_admin' || role === 'admin' || role === 'accountant');
      } catch {
        setAllowed(false);
      }
    };
    checkAccess();
  }, []);

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <SpinnerGap size={32} strokeWidth={1.5} className=" animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
          <ShieldWarning className="w-10 h-10 text-red-500" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground max-w-md">
          You do not have permission to access Finance Management. 
          Only <strong>Super Admin</strong>, <strong>Admin</strong>, and <strong>Accountant</strong> roles can view this section.
        </p>
        <p className="text-xs text-muted-foreground">
          Contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
