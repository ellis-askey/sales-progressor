import { redirect } from "next/navigation";

export default function CompletingPage() {
  redirect("/agent/completions");
}
