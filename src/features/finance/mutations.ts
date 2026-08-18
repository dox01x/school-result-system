import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FeeCollectionPayload } from "./types";

export async function collectTuitionFee(payload: FeeCollectionPayload, collectedBy?: string) {
  const supabase = await createServerSupabaseClient();
  const receiptNo = `REC-${Date.now().toString().slice(-6)}`;

  const { data, error } = await supabase
    .from("tuition_payments")
    .insert([
      {
        student_id: payload.student_id,
        month: payload.month,
        year: payload.year,
        amount_paid: payload.amount_paid,
        discount: payload.discount || 0,
        payment_method: payload.payment_method,
        receipt_no: receiptNo,
        note: payload.note || null,
        status: "paid",
        collected_by: collectedBy || null,
      },
    ] as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}
