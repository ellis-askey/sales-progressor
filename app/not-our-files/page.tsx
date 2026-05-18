import { redirect } from "next/navigation";

export default function NotOurFilesPage() {
  redirect("/agent/transactions");
}
