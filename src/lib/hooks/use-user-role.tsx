"use client";

import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/rbac";

type ClassTeacherAssignment = {
  class_id: string;
  section_id: string;
  class_name?: string;
  section_name?: string;
};

type UserRoleData = {
  role: UserRole | null;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  loading: boolean;
  assignments: ClassTeacherAssignment[];
  /** Check if user has access to a specific class/section */
  hasClassAccess: (classId: string, sectionId?: string) => boolean;
  /** Refresh role data from server */
  refresh: () => Promise<void>;
};

const RoleContext = createContext<UserRoleData>({
  role: null,
  userId: null,
  email: null,
  fullName: null,
  loading: true,
  assignments: [],
  hasClassAccess: () => false,
  refresh: async () => {},
});

export function useUserRole() {
  return useContext(RoleContext);
}

export function RoleProvider({ children, initialRole, initialUserId, initialEmail, initialFullName, initialAssignments }: {
  children: ReactNode;
  initialRole?: UserRole | null;
  initialUserId?: string | null;
  initialEmail?: string | null;
  initialFullName?: string | null;
  initialAssignments?: ClassTeacherAssignment[];
}) {
  const [role, setRole] = useState<UserRole | null>(initialRole ?? null);
  const [userId, setUserId] = useState<string | null>(initialUserId ?? null);
  const [email, setEmail] = useState<string | null>(initialEmail ?? null);
  const [fullName, setFullName] = useState<string | null>(initialFullName ?? null);
  const [loading, setLoading] = useState(!initialRole);
  const [assignments, setAssignments] = useState<ClassTeacherAssignment[]>(initialAssignments ?? []);
  const supabase = useMemo(() => createClient() as any, []);

  const fetchRoleData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRole(null);
        setUserId(null);
        setEmail(null);
        setFullName(null);
        setAssignments([]);
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? null);

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setRole(profile.role as UserRole);
        setFullName(profile.full_name || user.user_metadata?.display_name as string || null);
      }

      // Fetch class teacher assignments if applicable
      if (profile?.role === "class_teacher") {
        const { data: assignmentData } = await (supabase as any)
          .from("class_teacher_assignments")
          .select(`
            class_id,
            section_id,
            classes ( name ),
            sections ( name )
          `)
          .eq("user_id", user.id);

        if (assignmentData) {
          setAssignments(assignmentData.map((a: any) => ({
            class_id: a.class_id as string,
            section_id: a.section_id as string,
            class_name: a.classes?.name,
            section_name: a.sections?.name,
          })));
        }
      }
    } catch {
      // Auth might not be configured
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!initialRole) {
      void fetchRoleData();
    }
  }, [initialRole, fetchRoleData]);

  const hasClassAccess = useCallback((classId: string, sectionId?: string) => {
    if (role === "super_admin" || role === "admin") return true;
    if (role !== "class_teacher") return false;

    return assignments.some(a => {
      if (sectionId) return a.class_id === classId && a.section_id === sectionId;
      return a.class_id === classId;
    });
  }, [role, assignments]);

  const value = useMemo<UserRoleData>(() => ({
    role,
    userId,
    email,
    fullName,
    loading,
    assignments,
    hasClassAccess,
    refresh: fetchRoleData,
  }), [role, userId, email, fullName, loading, assignments, hasClassAccess, fetchRoleData]);

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}
