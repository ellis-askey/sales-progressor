// Dev-only endpoint for the /dev/system-compare visual library.
//
// GET  → returns the current preferences JSON.
// POST → records ONE decision for a comparison group and writes it back.
//
// Hard safety rules:
//   - 404 in production (never reachable on a prod deploy).
//   - Writes ONLY to the fixed file below — the path is NEVER taken from input.
//   - Validates every field; rejects anything unexpected.
//   - Touches no production component, style, token, or data. The file it writes
//     is an advisory preference record; it does not modify any UI.
//
// Not wired to any cron, action, or build step. Confined to the dev tool.

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// The ONLY file this endpoint may write. Resolved from cwd, never from the request.
const PREFS_PATH = path.join(process.cwd(), "docs", "ui-library", "ui-preferences.json");

const DECISIONS = ["prefer", "keep-both", "neither", "skip", "clear"] as const;
type DecisionKind = (typeof DECISIONS)[number];

type PrefRecord = {
  decision: Exclude<DecisionKind, "clear">;
  variantId?: string;
  note?: string;
  at: string;
};

type PrefsFile = {
  version: number;
  note?: string;
  updatedAt: string | null;
  decisions: Record<string, PrefRecord>;
};

const EMPTY: PrefsFile = { version: 1, updatedAt: null, decisions: {} };

function isProd() {
  return process.env.NODE_ENV === "production";
}

async function readPrefs(): Promise<PrefsFile> {
  try {
    const raw = await fs.readFile(PREFS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY };
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      note: typeof parsed.note === "string" ? parsed.note : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      decisions:
        parsed.decisions && typeof parsed.decisions === "object" ? parsed.decisions : {},
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function GET() {
  if (isProd()) return new NextResponse("Not found", { status: 404 });
  const prefs = await readPrefs();
  return NextResponse.json(prefs);
}

// A conservative id/charset guard so a bad request can't write odd keys.
const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

export async function POST(req: Request) {
  if (isProd()) return new NextResponse("Not found", { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const groupId = b.groupId;
  const decision = b.decision;
  const variantId = b.variantId;
  const note = b.note;

  if (typeof groupId !== "string" || !SAFE_ID.test(groupId)) {
    return NextResponse.json({ ok: false, error: "Invalid groupId" }, { status: 400 });
  }
  if (typeof decision !== "string" || !DECISIONS.includes(decision as DecisionKind)) {
    return NextResponse.json({ ok: false, error: "Invalid decision" }, { status: 400 });
  }
  if (variantId !== undefined && (typeof variantId !== "string" || !SAFE_ID.test(variantId))) {
    return NextResponse.json({ ok: false, error: "Invalid variantId" }, { status: 400 });
  }
  if (note !== undefined && (typeof note !== "string" || note.length > 500)) {
    return NextResponse.json({ ok: false, error: "Invalid note" }, { status: 400 });
  }
  if (decision === "prefer" && !variantId) {
    return NextResponse.json({ ok: false, error: "prefer requires a variantId" }, { status: 400 });
  }

  const prefs = await readPrefs();
  const now = new Date().toISOString();

  if (decision === "clear") {
    delete prefs.decisions[groupId];
  } else {
    prefs.decisions[groupId] = {
      decision: decision as Exclude<DecisionKind, "clear">,
      ...(variantId ? { variantId } : {}),
      ...(note ? { note } : {}),
      at: now,
    };
  }
  prefs.updatedAt = now;

  // Write ONLY the fixed preferences file. Pretty-printed for a readable git diff.
  await fs.writeFile(PREFS_PATH, JSON.stringify(prefs, null, 2) + "\n", "utf8");

  return NextResponse.json({ ok: true, decisions: prefs.decisions });
}
