import { redirect } from "next/navigation";

export default function ReportIndexPage() {
  redirect("/dashboard/finance/report/monthly");
}
