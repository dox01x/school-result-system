"use server";

import { getSchoolSummaryMetrics } from "./queries";

export async function fetchSchoolSummaryAction() {
  try {
    const metrics = await getSchoolSummaryMetrics();
    return { success: true, metrics };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch metrics." };
  }
}
