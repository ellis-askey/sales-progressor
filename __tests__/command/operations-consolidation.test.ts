/**
 * @jest-environment node
 *
 * Operations consolidation regression guard. Eight landing pages become the
 * Files / Messaging / Email / Requests tabs of /command/operations. Static guard
 * only — locks the shell, redirect map, sidebar collapse, retirement, the
 * ?tab=→?kind= rename, link repoints and preserved write wiring. Does not
 * exercise runtime (message delivery / WhatsApp / threading are untouched by
 * design and not tested here).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { OPERATIONS_REDIRECTS } from "@/lib/operations-redirects";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const gone = (p: string) => !existsSync(join(process.cwd(), p));

const SHELL = "app/command/(protected)/operations/page.tsx";
const NAV = "components/command/workspace-nav.ts";
const NEXT_CONFIG = "next.config.ts";
const FILES = "components/command/operations/tabs/FilesTab.tsx";
const MESSAGES = "components/command/operations/messaging/MessagesView.tsx";
const WHATSAPP = "components/command/operations/messaging/WhatsAppView.tsx";
const AGENTS = "components/command/operations/email/AgentEmailsView.tsx";
const SENDERS = "components/command/operations/email/SendersView.tsx";
const PROPOSALS = "components/command/operations/requests/ProposalsView.tsx";

describe("Operations — tabbed workspace shell", () => {
  it("exposes the four tabs (Files default, Messaging, Email, Requests), lazily gated", () => {
    const src = read(SHELL);
    for (const k of ["files", "messaging", "email", "requests"]) expect(src).toContain(`key: "${k}"`);
    expect(src).toContain('? rawTab : "files"');
    expect(src).toContain('active === "files" && (');
    expect(src).toContain('active === "messaging" && (');
    expect(src).toContain('active === "email" && (');
    expect(src).toContain('active === "requests" && <RequestsTab');
  });

  it("hardens tab against a forwarded array (legacy ?tab= can't flip the workspace tab)", () => {
    expect(read(SHELL)).toContain("Array.isArray(sp.tab) ? sp.tab[0] : sp.tab");
  });
});

describe("Operations — redirect map (real OPERATIONS_REDIRECTS)", () => {
  const EXPECTED: Record<string, string> = {
    "/command/files": "/command/operations?tab=files",
    "/command/outbound": "/command/operations?tab=messaging&view=messages",
    "/command/whatsapp": "/command/operations?tab=messaging&view=whatsapp",
    "/command/email-senders": "/command/operations?tab=email&view=senders",
    "/command/agent-emails": "/command/operations?tab=email&view=agents",
    "/command/email-threading": "/command/operations?tab=email&view=threading",
    "/command/proposals": "/command/operations?tab=requests&view=proposals",
    "/command/crm-requests": "/command/operations?tab=requests&view=crm",
  };

  it("maps every landing to its canonical tab/view (302, reversible)", () => {
    const actual: Record<string, string> = {};
    for (const r of OPERATIONS_REDIRECTS) { actual[r.source] = r.destination; expect(r.permanent).toBe(false); }
    expect(actual).toEqual(EXPECTED);
  });

  it("destinations use only canonical tab/view params; workspace itself not redirected", () => {
    expect(OPERATIONS_REDIRECTS.map((r) => r.source)).not.toContain("/command/operations");
    for (const r of OPERATIONS_REDIRECTS) {
      const keys = (r.destination.split("?")[1] ?? "").split("&").map((p) => p.split("=")[0]);
      for (const k of keys) expect(["tab", "view"]).toContain(k);
    }
  });

  it("is wired into next.config.ts alongside the other workspace redirects", () => {
    const cfg = read(NEXT_CONFIG);
    expect(cfg).toContain('from "./lib/operations-redirects"');
    expect(cfg).toContain("...OPERATIONS_REDIRECTS");
    for (const spread of ["...CONTENT_REDIRECTS", "...GROWTH_REDIRECTS", "...MONEY_REDIRECTS"]) {
      expect(cfg).toContain(spread);
    }
  });
});

describe("Operations — sidebar collapse + legacy retirement", () => {
  it("collapses the Operations section to a single /command/operations entry", () => {
    const src = read(NAV);
    const start = src.indexOf('id: "operations"');
    const after = src.indexOf('id: "', start + 10);
    const section = src.slice(start, after === -1 ? undefined : after);
    const hrefs = (section.match(/href: "([^"]+)"/g) ?? []).map((h) => h.replace(/href: "|"/g, ""));
    expect(hrefs).toEqual(["/command/operations"]);
  });

  it("retires all eight landing pages but keeps email-senders/actions.ts", () => {
    for (const p of [
      "files", "outbound", "whatsapp", "proposals", "crm-requests", "email-senders", "agent-emails", "email-threading",
    ]) {
      expect(gone(`app/command/(protected)/${p}/page.tsx`)).toBe(true);
    }
    expect(existsSync(join(process.cwd(), "app/command/(protected)/email-senders/actions.ts"))).toBe(true);
  });
});

describe("Operations — preserved functionality + repoints", () => {
  it("Files repoints its links + revalidate to /command/operations and keeps the ?tx= drawer", () => {
    const src = read(FILES);
    expect(src).toContain("/command/operations?tab=files&tx=${r.id}"); // list row drill-down
    expect(src).toContain('revalidatePath("/command/operations")'); // dismiss action repointed
    expect(src).toContain('<input type="hidden" name="tab" value="files" />'); // GET form keeps tab
    expect(src).toContain("getFileOperational(selectedId)"); // the ?tx= panel loader
    expect(src).not.toContain('"/command/files?'); // no stray legacy links
  });

  it("Messages repoints links to the canonical view and keeps the outbound log loaders", () => {
    const src = read(MESSAGES);
    expect(src).toContain('const BASE = "/command/operations?tab=messaging&view=messages"');
    expect(src).toContain('p.set("tab", "messaging")');
    expect(src).toContain("commandDb.outboundMessage.findMany");
    expect(src).not.toContain('"/command/outbound?'); // no stray legacy links
  });

  it("WhatsApp keeps every integration component + repoints only the files link", () => {
    const src = read(WHATSAPP);
    for (const comp of ["<WhatsAppAssign", "<WhatsAppAssignedList", "<WhatsAppRepairButton", "<WhatsAppCloudCard", "<WhatsAppConvertHistory"]) {
      expect(src).toContain(comp);
    }
    expect(src).toContain("/command/operations?tab=files&tx=${chat.transactionId}");
  });

  it("Agent emails uses ?kind= (not the workspace ?tab=) for its kind selector", () => {
    const src = read(AGENTS);
    expect(src).toContain('p.set("tab", "email")');
    expect(src).toContain('p.set("view", "agents")');
    expect(src).toContain("TABS.some((t) => t.id === kind)"); // reads the kind prop, not tab
    expect(src).toContain("buildUrl({ kind:"); // tab-switch links use kind
    expect(src).not.toContain('"/command/agent-emails?');
  });

  it("Senders keeps the domain-auth write component (absolute actions import)", () => {
    const src = read(SENDERS);
    expect(src).toContain("<AgencyDomainAuth");
    expect(src).toContain('from "@/app/command/(protected)/email-senders/actions"');
  });

  it("Proposals keeps the review component + the best-effort reconcile", () => {
    const src = read(PROPOSALS);
    expect(src).toContain("<ProposalReview");
    expect(src).toContain('status: "superseded"'); // the reconcile updateMany
  });
});
