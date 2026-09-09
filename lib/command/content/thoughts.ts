import { commandDb } from "@/lib/command/prisma";

// Read helpers for Ellis's thoughts (docs/active/content-brand/SPEC.md, Phase
// 1.1). The raw-thought corpus the content engine revisits later. Superadmin
// gating lives in the callers (page/action), never here.

export type ThoughtStatus = "open" | "used" | "archived";

export type Thought = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  body: string;
  topic: string | null;
  source: string;
  status: string;
  usedInDraftId: string | null;
};

const SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  body: true,
  topic: true,
  source: true,
  status: true,
  usedInDraftId: true,
} as const;

// Everything, newest first, split by status so the panel can tab between them.
// Personal-scale volume, so a generous single read is fine.
export async function getThoughtsBoard(): Promise<{
  open: Thought[];
  used: Thought[];
  archived: Thought[];
  counts: { open: number; used: number; archived: number };
}> {
  const [open, used, archived] = await Promise.all([
    commandDb.ellisThought.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 300, select: SELECT }),
    commandDb.ellisThought.findMany({ where: { status: "used" }, orderBy: { updatedAt: "desc" }, take: 100, select: SELECT }),
    commandDb.ellisThought.findMany({ where: { status: "archived" }, orderBy: { updatedAt: "desc" }, take: 100, select: SELECT }),
  ]);
  return {
    open,
    used,
    archived,
    counts: { open: open.length, used: used.length, archived: archived.length },
  };
}

// Just the open count, for the Overview summary and nav badges later.
export async function getOpenThoughtCount(): Promise<number> {
  return commandDb.ellisThought.count({ where: { status: "open" } });
}
