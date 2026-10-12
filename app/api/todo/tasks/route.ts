import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { createTask, listTasks, type TaskQuery } from "@/lib/todo/service";
import type { FilterQuery } from "@/lib/todo/types";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (req, session) => {
  const url = new URL(req.url);
  const p = url.searchParams;
  let filter: FilterQuery | undefined;
  const rawFilter = p.get("filter");
  if (rawFilter) {
    try {
      filter = JSON.parse(rawFilter);
    } catch {
      return NextResponse.json({ error: "Bad filter" }, { status: 400 });
    }
  }
  const query: TaskQuery = {
    view: (p.get("view") as TaskQuery["view"]) ?? "inbox",
    projectId: p.get("projectId") ?? undefined,
    labelId: p.get("labelId") ?? undefined,
    search: p.get("search") ?? undefined,
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    cursor: p.get("cursor") ?? undefined,
    filter,
  };
  return NextResponse.json(await listTasks(session.tenantId, session.userId, query));
});

export const POST = withFormsAuth(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  const task = await createTask(session.tenantId, session.userId, body);
  return NextResponse.json({ task }, { status: 201 });
});
