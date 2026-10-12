"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/forms/types";
import { BoardwalkWordmark } from "./BoardwalkWordmark";
import { BwMenu, BwToastProvider } from "./ui";

export function BoardwalkShell({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/forms/auth/logout", { method: "POST" });
    router.replace("/boardwalk/login");
    router.refresh();
  }

  const initials = session.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <BwToastProvider>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: 62,
            borderBottom: "1px solid var(--bw-line)",
            background: "rgba(243, 240, 238, 0.92)",
            backdropFilter: "blur(8px)",
            position: "sticky",
            top: 0,
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 22,
          }}
        >
          <Link href="/boardwalk/forms" style={{ textDecoration: "none" }}>
            <BoardwalkWordmark size={19} />
          </Link>

          {/* Suite switcher: one login, two products */}
          <nav aria-label="Boardwalk apps" className="bw-seg" style={{ flexShrink: 0 }}>
            <Link
              href="/boardwalk/forms"
              data-active={pathname?.startsWith("/boardwalk/forms") || pathname?.startsWith("/boardwalk/typeform")}
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.03em", color: pathname?.startsWith("/boardwalk/forms") ? "var(--bw-ink-strong)" : "var(--bw-ink-soft)", background: pathname?.startsWith("/boardwalk/forms") ? "var(--bw-paper-raised)" : "transparent", boxShadow: pathname?.startsWith("/boardwalk/forms") ? "var(--bw-shadow-sm)" : "none" }}
            >
              Forms
            </Link>
            <Link
              href="/boardwalk/todo"
              data-active={pathname?.startsWith("/boardwalk/todo")}
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.03em", color: pathname?.startsWith("/boardwalk/todo") ? "var(--bw-ink-strong)" : "var(--bw-ink-soft)", background: pathname?.startsWith("/boardwalk/todo") ? "var(--bw-paper-raised)" : "transparent", boxShadow: pathname?.startsWith("/boardwalk/todo") ? "var(--bw-shadow-sm)" : "none" }}
            >
              To Do
            </Link>
          </nav>
          <div style={{ flex: 1 }} />

          <BwMenu
            align="right"
            trigger={
              <button
                aria-label="Account menu"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: "none",
                  background: "var(--bw-blush)",
                  color: "var(--bw-blush-ink)",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "var(--bw-font-sans)",
                }}
              >
                {initials || "B"}
              </button>
            }
          >
            <div style={{ padding: "8px 10px 6px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 650 }}>{session.name}</div>
              <div style={{ fontSize: 12, color: "var(--bw-ink-faint)" }}>{session.email}</div>
            </div>
            <div className="bw-menu-sep" />
            <button className="bw-menu-item" onClick={() => router.push("/boardwalk/account")}>
              Account &amp; password
            </button>
            <button className="bw-menu-item bw-menu-danger" onClick={signOut}>
              Sign out
            </button>
          </BwMenu>
        </header>

        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</main>
      </div>
    </BwToastProvider>
  );
}
