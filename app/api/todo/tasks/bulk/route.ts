import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { bulkUpdate, reorderTasks } from "@/lib/todo/service";

export const runtime = "nodejs";

// Bulk operations: { op: "patch", taskIds, patch } applies due date /
// priority / assignee / project changes to many tasks; { op: "reorder",
// orderedIds, target? } persists drag-and-drop order (optionally moving into
// a project/section, e.g. a board column).
export const POST = withFormsAuth(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  if (body.op === "reorder" && Array.isArray(body.orderedIds)) {
    await reorderTasks(session.tenantId, session.userId, body.orderedIds, body.target);
    return NextResponse.json({ ok: true });
  }
  if (body.op === "patch" && Array.isArray(body.taskIds)) {
    const tasks = await bulkUpdate(session.tenantId, session.userId, body.taskIds, body.patch ?? {});
    return NextResponse.json({ tasks });
  }
  return NextResponse.json({ error: "Unknown bulk operation" }, { status: 400 });
});
