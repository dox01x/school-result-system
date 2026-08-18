"use server";

import { revalidatePath } from "next/cache";
import { createStudent, updateStudent, deleteStudent } from "./mutations";
import { validateStudentInput, type StudentInput } from "./validation";

export async function addStudentAction(input: StudentInput) {
  const validation = validateStudentInput(input);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const student = await createStudent(input);
    revalidatePath("/students");
    revalidatePath("/dashboard/students");
    return { success: true, student };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to add student." };
  }
}

export async function updateStudentAction(id: string, input: Partial<StudentInput>) {
  try {
    const student = await updateStudent(id, input);
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    return { success: true, student };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update student." };
  }
}

export async function deleteStudentAction(id: string) {
  try {
    await deleteStudent(id);
    revalidatePath("/students");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete student." };
  }
}
