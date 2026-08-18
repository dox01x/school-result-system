"use server";

import { revalidatePath } from "next/cache";
import { updateUserRole } from "./mutations";
import { validateUserRoleUpdate } from "./validation";
import type { UserRole } from "@/types/auth";

export async function changeUserRoleAction(userId: string, role: UserRole) {
  const validation = validateUserRoleUpdate(userId, role);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const updated = await updateUserRole(userId, role);
    revalidatePath("/settings/users");
    revalidatePath("/dashboard/users");
    return { success: true, user: updated };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update role." };
  }
}
