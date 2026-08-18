"use server";

import { revalidatePath } from "next/cache";
import { setExamPublicationStatus } from "./mutations";
import { validatePublishPayload } from "./validation";
import type { PublishResultPayload } from "./types";

export async function publishResultAction(payload: PublishResultPayload) {
  const validation = validatePublishPayload(payload);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const updated = await setExamPublicationStatus(payload.exam_id, payload.is_published);
    revalidatePath("/results");
    revalidatePath("/results/publish");
    revalidatePath("/exams");
    return { success: true, exam: updated };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update publication status." };
  }
}
