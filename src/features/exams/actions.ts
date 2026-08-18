"use server";

import { revalidatePath } from "next/cache";
import { createExam, updateExam, deleteExam } from "./mutations";
import { validateExamInput, type ExamInput } from "./validation";

export async function addExamAction(input: ExamInput) {
  const validation = validateExamInput(input);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const exam = await createExam(input);
    revalidatePath("/exams");
    return { success: true, exam };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create exam." };
  }
}

export async function updateExamAction(id: string, input: Partial<ExamInput>) {
  try {
    const exam = await updateExam(id, input);
    revalidatePath("/exams");
    revalidatePath(`/exams/${id}`);
    return { success: true, exam };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update exam." };
  }
}

export async function deleteExamAction(id: string) {
  try {
    await deleteExam(id);
    revalidatePath("/exams");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete exam." };
  }
}
