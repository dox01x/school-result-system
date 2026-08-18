"use server";

import { revalidatePath } from "next/cache";
import { saveExamSubjectConfig } from "./mutations";
import { validateExamSubjectConfig } from "./validation";
import type { ExamSubjectConfig } from "./types";

export async function saveExamSubjectConfigAction(config: ExamSubjectConfig) {
  const validation = validateExamSubjectConfig(config);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const data = await saveExamSubjectConfig(config);
    revalidatePath("/exam-configuration");
    revalidatePath("/exam-configuration/subjects");
    return { success: true, config: data };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to save configuration." };
  }
}
