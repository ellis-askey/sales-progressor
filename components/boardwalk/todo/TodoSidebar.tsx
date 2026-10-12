"use client";

// Desktop sidebar: quick add, search, the four standing views with live
// counts, favourites, filters & labels, then My projects / Shared projects
// (collapsible, with per-section state remembered in prefs).

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus, Search, Inbox as InboxIcon, CalendarDays, CalendarRange, CircleCheck,
  ChevronDown, Star, SlidersHorizontal, Bell, Hash,
} from "lucide-react";
import { useTodo } from "./TodoProvider";
import { ProjectModal } from "./ProjectModal";
import { NotificationsPopover } from "./NotificationsPopover";

function Row({
  href,
  icon,
  label,
  count,
  active,
  color,
  indent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  color?: string;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 10px",
        paddingLeft: indent ? 26 : 10,
        borderRadius: 8,
        textDecoration: "none",
        color: active ? "var(--bw-ink-strong)" : "var(--bw-ink)",
        background: active ? "var(--bw-paper-sunken)" : "transparent",
        boxShadow: active ? "inset 2.5px 0 0 var(--bw-brand)" : "none",
        fontSize: 13.5,
        fontWeight: active ? 650 : 500,
        transition: "background 120ms ease",
      }}
    >
      <span style={{ display: "flex", color: color ?? (active ? "var(--bw-brand)" : "var(--bw-ink-soft)") }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {count !== undefined && count > 0 && (
        <span style={{ fontSize: 11.5, fontWeight: 650, color: "var(--bw-ink-faint)" }}>{count}</span>
      )}
    </Link>
  );
}

function SectionHeader({ label, open, onToggle, action }: { label: string; open: boolean; onToggle: () => void; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px 2px", marginTop: 14 }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", padding: 0, flex: 1, fontFamily: "var(--bw-font-sans)" }}
      >
        <span className="bw-kicker" style={{ fontSize: 10 }}>{label}</span>
        <ChevronDown size={11} style={{ color: "var(--bw-ink-faint)", transform: open ? "none" : "rotate(-90deg)", transition: "transform 160ms ease" }} />
      </button>
      {action}
    </div>
  );
}

export function TodoSidebar({ onSearch }: { onSearch: () => void }) {
  const todo = useTodo();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [projectModal, setProjectModal] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const collapsed = (todo.prefs.collapsed as Record<string, boolean>) ?? {};
  const setCollapsed = (key: string, open: boolean) =>
    todo.savePrefs({ collapsed: { ...collapsed, [key]: !open } });

  const myProjects = todo.projects.filter((p) => !p.isTemplate && p.memberIds.length <= 1);
  const shared = todo.projects.filter((p) => !p.isTemplate && p.memberIds.length > 1);
  const favourites = todo.projects.filter((p) => !p.isTemplate && p.isFavorite);
  const favFilters = todo.filters.filter((f) => f.isFavorite);

  const projectRow = (p: (typeof todo.projects)[number], indent = false) => (
    <Row
      key={p.id}
      href={`/boardwalk/todo/project/${p.id}`}
      icon={<Hash size={14} strokeWidth={2.4} />}
      color={p.color}
      label={p.name}
      count={todo.counts.byProject[p.id]}
      active={pathname.includes(`/project/${p.id}`)}
      indent={indent}
    />
  );

  return (
    <aside
      className="bw-scroll"
      style={{
        width: 264,
        minWidth: 220,
        flexShrink: 0,
        borderRight: "1px solid var(--bw-line)",
        background: "var(--bw-paper-raised)",
        overflowY: "auto",
        padding: "14px 10px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {/* Add + search + notifications */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button className="bw-btn bw-btn-primary bw-btn-sm" style={{ flex: 1, justifyContent: "flex-start", gap: 7 }} onClick={() => todo.openQuickAdd()}>
          <Plus size={14} /> Add task
          <span style={{ marginLeft: "auto", opacity: 0.6, fontSize: 10.5 }}>Q</span>
        </button>
        <button className="bw-btn bw-btn-secondary bw-btn-sm" aria-label="Search" style={{ width: 34, padding: 0 }} onClick={onSearch}>
          <Search size={14} />
        </button>
        <div style={{ position: "relative" }}>
          <button className="bw-btn bw-btn-secondary bw-btn-sm" aria-label="Notifications" style={{ width: 34, padding: 0, position: "relative" }} onClick={() => setNotifOpen((o) => !o)}>
            <Bell size={14} />
            {todo.counts.unreadNotifications > 0 && (
              <span style={{ position: "absolute", top: 4, right: 5, width: 7, height: 7, borderRadius: 99, background: "var(--bw-red)" }} />
            )}
          </button>
          {notifOpen && <NotificationsPopover onClose={() => setNotifOpen(false)} />}
        </div>
      </div>

      <Row href="/boardwalk/todo/inbox" icon={<InboxIcon size={15} />} label="Inbox" count={todo.counts.inbox} active={pathname.endsWith("/inbox")} />
      <Row
        href="/boardwalk/todo/today"
        icon={<CalendarDays size={15} />}
        label="Today"
        count={todo.counts.today + todo.counts.overdue}
        active={pathname.endsWith("/today")}
      />
      <Row href="/boardwalk/todo/upcoming" icon={<CalendarRange size={15} />} label="Upcoming" count={todo.counts.upcoming} active={pathname.endsWith("/upcoming")} />
      <Row href="/boardwalk/todo/filters" icon={<SlidersHorizontal size={15} />} label="Filters & labels" active={pathname.endsWith("/filters")} />
      <Row href="/boardwalk/todo/completed" icon={<CircleCheck size={15} />} label="Completed" active={pathname.endsWith("/completed")} />

      {/* Favourites */}
      {(favourites.length > 0 || favFilters.length > 0) && (
        <>
          <SectionHeader label="Favourites" open={!collapsed.favourites} onToggle={() => setCollapsed("favourites", !!collapsed.favourites)} />
          {!collapsed.favourites && (
            <>
              {favourites.map((p) => projectRow(p))}
              {favFilters.map((f) => (
                <Row key={f.id} href={`/boardwalk/todo/filter/${f.id}`} icon={<Star size={13} />} label={f.name} active={pathname.includes(`/filter/${f.id}`)} />
              ))}
            </>
          )}
        </>
      )}

      {/* My projects */}
      <SectionHeader
        label="My projects"
        open={!collapsed.mine}
        onToggle={() => setCollapsed("mine", !!collapsed.mine)}
        action={
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Add project" style={{ width: 22, height: 22, padding: 0 }} onClick={() => setProjectModal(true)}>
            <Plus size={12} />
          </button>
        }
      />
      {!collapsed.mine && (
        <>
          {myProjects.length === 0 && (
            <button
              onClick={() => setProjectModal(true)}
              style={{ margin: "2px 10px", padding: "10px 12px", border: "1.5px dashed var(--bw-line-strong)", borderRadius: 9, background: "transparent", color: "var(--bw-ink-soft)", fontSize: 12.5, cursor: "pointer", fontFamily: "var(--bw-font-sans)", textAlign: "left" }}
            >
              Create your first project
            </button>
          )}
          {myProjects.map((p) => projectRow(p))}
        </>
      )}

      {/* Shared projects */}
      {shared.length > 0 && (
        <>
          <SectionHeader label="Shared projects" open={!collapsed.shared} onToggle={() => setCollapsed("shared", !!collapsed.shared)} />
          {!collapsed.shared && shared.map((p) => projectRow(p))}
        </>
      )}

      {projectModal && <ProjectModal onClose={() => setProjectModal(false)} onCreated={(id) => { setProjectModal(false); router.push(`/boardwalk/todo/project/${id}`); }} />}
    </aside>
  );
}
