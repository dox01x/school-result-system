"use server";

import { revalidatePath } from "next/cache";
import { collectTuitionFee } from "./mutations";
import { validateFeeCollection } from "./validation";
import type { FeeCollectionPayload } from "./types";

export async function collectFeeAction(payload: FeeCollectionPayload, collectedBy?: string) {
  const validation = validateFeeCollection(payload);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const payment = await collectTuitionFee(payload, collectedBy);
    revalidatePath("/finance");
    revalidatePath("/finance/payments");
    revalidatePath("/finance/dues");
    return { success: true, payment };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to process payment." };
  }
}
