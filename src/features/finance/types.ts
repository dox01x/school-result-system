export * from "@/types/finance";

export interface FeeCollectionPayload {
  student_id: string;
  month: string;
  year: number;
  amount_paid: number;
  discount?: number;
  payment_method: string;
  note?: string;
}
