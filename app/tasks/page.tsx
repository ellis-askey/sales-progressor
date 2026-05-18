import { redirect } from "next/navigation";

export default function TasksPage() {
  redirect("/agent/work-queue");
}
