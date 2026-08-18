export * from "@/lib/utils";

export function formatCurrency(amount: number | null | undefined, symbol = "৳"): string {
  if (amount === null || amount === undefined || isNaN(amount)) return `${symbol}0`;
  return `${symbol}${amount.toLocaleString("en-US")}`;
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "—";
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
