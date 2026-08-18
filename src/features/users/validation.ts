import type { UserRole } from "@/types/auth";

export function validateUserRoleUpdate(userId: string, role: UserRole): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!userId) errors.push("User ID is required.");
  if (!role) errors.push("Role is required.");
  return { valid: errors.length === 0, errors };
}
