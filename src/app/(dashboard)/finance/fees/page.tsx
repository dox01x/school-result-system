import { redirect } from "next/navigation";

export default function FeesRedirect() {
  redirect("/finance/fee-structure");
}
