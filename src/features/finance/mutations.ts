import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateReceiptNumber, roundCurrency } from "@/lib/finance-utils";
import type { FeeCollectionPayload } from "./types";

export async function collectTuitionFee(payload: FeeCollectionPayload, collectedBy?: string) {
  const supabase = await createServerSupabaseClient();
  const year = payload.year || new Date().getFullYear();
  const receiptNumber = await generateReceiptNumber(supabase, year);

  const amountPaid = roundCurrency(payload.amount_paid);
  const discount = roundCurrency(payload.discount || 0);
  const amountDue = roundCurrency(amountPaid + discount);

  // Fetch student info for snapshot integrity
  const { data: student } = await (supabase as any)
    .from("students")
    .select("name, roll, classes(name), sections(name)")
    .eq("id", payload.student_id)
    .maybeSingle();

  const insertPayload = {
    student_id: payload.student_id,
    student_name: student?.name || "Student",
    roll: student?.roll || "",
    class_name: (student?.classes as any)?.name || "N/A",
    section: (student?.sections as any)?.name || "",
    month: payload.month,
    year: year,
    fee_type: "tuition",
    fee_details: [
      {
        type: "tuition",
        amount: amountDue,
        month: payload.month,
        year: year,
      },
    ],
    amount_due: amountDue,
    amount_paid: amountPaid,
    discount: discount,
    fine: 0,
    payment_method: payload.payment_method || "cash",
    receipt_number: receiptNumber,
    note: payload.note || null,
    status: "completed",
    collected_by: collectedBy || null,
    payment_date: new Date().toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from("tuition_payments")
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;

  // Synchronize with income_entries ledger
  try {
    await (supabase as any).from("income_entries").insert({
      title: `Tuition Fee - ${student?.name || "Student"}`,
      description: `Fees collected for Month ${payload.month}/${year}. Receipt: ${receiptNumber}`,
      amount: amountPaid,
      category: "Tuition Fee",
      entry_date: new Date().toISOString().split("T")[0],
      reference_type: "tuition_payment",
      reference_id: data.id,
      created_by: collectedBy || null,
    });
  } catch (incomeErr) {
    console.warn("Ledger synchronization warning:", incomeErr);
  }

  return data;
}
