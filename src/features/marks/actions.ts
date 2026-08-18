"use server";

import { revalidatePath } from "next/cache";
import { upsertBatchMarks } from "./mutations";
import { validateMarksPayload } from "./validation";
import type { BatchMarksSavePayload } from "./types";

export async function saveBatchMarksAction(payload: BatchMarksSavePayload) {
  const validation = validateMarksPayload(payload);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const data = await upsertBatchMarks(payload);
    revalidatePath("/marks");
    revalidatePath("/marks/entry");
    revalidatePath("/results");
    return { success: true, data };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to save marks." };
  }
}
