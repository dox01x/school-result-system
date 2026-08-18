import { redirect } from "next/navigation";

export default function ReportsRedirect() {
  redirect("/finance/report/monthly");
}
