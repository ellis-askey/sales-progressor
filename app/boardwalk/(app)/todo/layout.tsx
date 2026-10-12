// Boardwalk To Do — layout for every /boardwalk/todo view. Session is already
// guarded by the (app) layout; this adds the task store (TodoProvider) and
// the persistent chrome: sidebar, quick-add, task detail panel, search,
// keyboard shortcuts, mobile navigation.

import { redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";
import { TodoProvider } from "@/components/boardwalk/todo/TodoProvider";
import { TodoChrome } from "@/components/boardwalk/todo/TodoChrome";

export const dynamic = "force-dynamic";

export const metadata = { title: "To Do" };

export default async function TodoLayout({ children }: { children: React.ReactNode }) {
  const session = await getFormsSession();
  if (!session) redirect("/boardwalk/login");

  return (
    <TodoProvider me={session.userId}>
      <TodoChrome>{children}</TodoChrome>
    </TodoProvider>
  );
}
