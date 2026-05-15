import { redirect } from "next/navigation";

export default function OldNewSalePage() {
  redirect("/agent/transactions/new-v2");
}
