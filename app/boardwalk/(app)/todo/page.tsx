import { redirect } from "next/navigation";

export default function TodoIndex() {
  redirect("/boardwalk/todo/today");
}
