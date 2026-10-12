"use client";

// Persistent chrome for Boardwalk To Do: desktop sidebar, mobile bottom
// navigation, global quick-add (press Q), search (press / or Ctrl+K), the
// task detail panel, and the floating bulk-action bar.

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, CalendarDays, Inbox as InboxIcon, Search, LayoutGrid, PanelLeft } from "lucide-react";
import { useTodo } from "./TodoProvider";
import { TodoSidebar } from "./TodoSidebar";
import { QuickAddModal } from "./QuickAddModal";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { SearchOverlay } from "./SearchOverlay";
import { BulkBar } from "./BulkBar";
import { ProjectBrowserSheet } from "./ProjectBrowserSheet";

export function TodoChrome({ children }: { children: ReactNode }) {
  const todo = useTodo();
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const sidebarCollapsed = todo.prefs.sidebarCollapsed === true;
  const setSidebarCollapsed = (v: boolean) => todo.savePrefs({ sidebarCollapsed: v });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      if (typing) return;
      if (e.key === "q" || e.key === "n") {
        e.preventDefault();
        todo.openQuickAdd();
      } else if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "g") {
        // g then t/i/u — simple two-key nav
        const second = (ev: KeyboardEvent) => {
          if (ev.key === "t") router.push("/boardwalk/todo/today");
          if (ev.key === "i") router.push("/boardwalk/todo/inbox");
          if (ev.key === "u") router.push("/boardwalk/todo/upcoming");
          document.removeEventListener("keydown", second);
        };
        document.addEventListener("keydown", second);
        setTimeout(() => document.removeEventListener("keydown", second), 1200);
      } else if (e.key === "Escape") {
        // Belt and braces: the detail panel has its own Escape handler, but
        // this always-attached one guarantees Escape never leaves a stuck
        // drawer (the panel's listener re-subscribes on renders).
        if (todo.openTaskId) todo.openTask(null);
        else todo.clearSelection();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, todo]);

  const mobileTab = (onClick: () => void, label: string, icon: ReactNode, active: boolean) => (
    <button
      key={label}
      onClick={onClick}
      aria-label={label}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: "8px 0 6px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: active ? "var(--bw-ink-strong)" : "var(--bw-ink-faint)",
        fontFamily: "var(--bw-font-sans)",
        fontSize: 10,
        fontWeight: 650,
        letterSpacing: "0.04em",
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", height: "calc(100vh - 62px)", overflow: "hidden" }}>
      {!narrow && !sidebarCollapsed && (
        <TodoSidebar onSearch={() => setSearchOpen(true)} onCollapse={() => setSidebarCollapsed(true)} />
      )}
      {!narrow && sidebarCollapsed && (
        <div style={{ width: 44, flexShrink: 0, borderRight: "1px solid var(--bw-line)", background: "var(--bw-paper-raised)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 12 }}>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Expand sidebar" title="Expand sidebar" style={{ width: 30, height: 30, padding: 0 }} onClick={() => setSidebarCollapsed(false)}>
            <PanelLeft size={14} />
          </button>
          <button className="bw-btn bw-btn-primary bw-btn-sm" aria-label="Add task" title="Add task (Q)" style={{ width: 30, height: 30, padding: 0, borderRadius: 999 }} onClick={() => todo.openQuickAdd()}>
            <Plus size={14} />
          </button>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Search" title="Search ( / )" style={{ width: 30, height: 30, padding: 0 }} onClick={() => setSearchOpen(true)}>
            <Search size={13.5} />
          </button>
        </div>
      )}

      <main
        className="bw-scroll"
        style={{ flex: 1, minWidth: 0, overflowY: "auto", position: "relative", paddingBottom: narrow ? 76 : 0 }}
      >
        {children}
      </main>

      {/* Overlays */}
      <QuickAddModal />
      {todo.openTaskId && <TaskDetailPanel taskId={todo.openTaskId} onClose={() => todo.openTask(null)} narrow={narrow} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      {browseOpen && <ProjectBrowserSheet onClose={() => setBrowseOpen(false)} />}
      <BulkBar />

      {/* Mobile bottom nav + FAB */}
      {narrow && (
        <>
          <nav
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 45,
              display: "flex",
              background: "rgba(243,240,238,0.96)",
              backdropFilter: "blur(10px)",
              borderTop: "1px solid var(--bw-line)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {mobileTab(() => router.push("/boardwalk/todo/today"), "Today", <CalendarDays size={19} />, pathname?.includes("/today") ?? false)}
            {mobileTab(() => router.push("/boardwalk/todo/inbox"), "Inbox", <InboxIcon size={19} />, pathname?.includes("/inbox") ?? false)}
            <button
              onClick={() => todo.openQuickAdd()}
              aria-label="Add task"
              style={{
                width: 52,
                height: 52,
                borderRadius: 999,
                background: "var(--bw-brand)",
                color: "#fff",
                border: "none",
                margin: "-18px 6px 0",
                boxShadow: "var(--bw-shadow-lg)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Plus size={24} />
            </button>
            {mobileTab(() => setSearchOpen(true), "Search", <Search size={19} />, false)}
            {mobileTab(() => setBrowseOpen(true), "Browse", <LayoutGrid size={19} />, false)}
          </nav>
        </>
      )}
    </div>
  );
}
