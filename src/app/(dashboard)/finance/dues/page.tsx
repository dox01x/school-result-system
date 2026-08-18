import { redirect } from "next/navigation";

export default function DuesRedirect() {
  redirect("/finance/tuition/overdue");
}
