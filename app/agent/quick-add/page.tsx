import { redirect } from "next/navigation";

export default function QuickAddPage() {
  redirect("/agent/transactions/new");
}
