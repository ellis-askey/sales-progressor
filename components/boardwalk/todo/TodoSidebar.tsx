"use client";

// Desktop sidebar — second-pass: Todoist-density rows (28px), slim add-task
// control, My tasks smart view, collapsible sections, collapse-to-rail
// toggle, hover add-project.

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus, Search, Inbox as InboxIcon, CalendarDays, CalendarRange, CircleCheck,
  ChevronDown, Star, SlidersHorizontal, Bell, Hash, UserRound, PanelLeftClose,
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
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  color?: string;
}) {
  return (
    <Link href={href} className="bw-side-row" data-active={active}>
      <span style={{ display: "flex", color: color ?? (active ? "var(--bw-brand)" : "var(--bw-ink-soft)") }}>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {count !== undefined && count > 0 && (
        <span style={{ fontSize: 11, fontWeight: 650, color: "var(--bw-ink-faint)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
      )}
    </Link>
  );
}

function SectionHeader({ label, open, onToggle, action }: { label: string; open: boolean; onToggle: () => void; action?: React.ReactNode }) {
  return (
    <div className="bw-side-section" style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px 1px", marginTop: 12 }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", padding: 0, flex: 1, fontFamily: "var(--bw-font-sans)" }}
      >
        <span className="bw-kicker" style={{ fontSize: 9.5 }}>{label}</span>
        <ChevronDown size={10} style={{ color: "var(--bw-ink-faint)", transform: open ? "none" : "rotate(-90deg)", transition: "transform 160ms ease" }} />
      </button>
      {action}
    </div>
  );
}

export function TodoSidebar({ onSearch, onCollapse }: { onSearch: () => void; onCollapse: () => void }) {
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

  const projectRow = (p: (typeof todo.projects)[number]) => (
    <Row
      key={p.id}
      href={`/boardwalk/todo/project/${p.id}`}
      icon={<Hash size={13.5} strokeWidth={2.4} />}
      color={p.color}
      label={p.name}
      count={todo.counts.byProject[p.id]}
      active={pathname.includes(`/project/${p.id}`)}
    />
  );

  return (
    <aside
      className="bw-scroll"
      style={{
        width: 248,
        minWidth: 212,
        flexShrink: 0,
        borderRight: "1px solid var(--bw-line)",
        background: "var(--bw-paper-raised)",
        overflowY: "auto",
        padding: "12px 9px 36px",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {/* Top controls */}
      <div style={{ display: "flex", gap: 5, marginBottom: 9, alignItems: "center" }}>
        <button
          className="bw-btn bw-btn-primary bw-btn-sm"
          style={{ flex: 1, justifyContent: "flex-start", gap: 7, height: 31 }}
          onClick={() => todo.openQuickAdd()}
        >
          <Plus size={13.5} /> Add task
          <span style={{ marginLeft: "auto", opacity: 0.55, fontSize: 10 }}>Q</span>
        </button>
        <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Search" title="Search ( / )" style={{ width: 30, height: 30, padding: 0 }} onClick={onSearch}>
          <Search size={13.5} />
        </button>
        <div style={{ position: "relative" }}>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Notifications" style={{ width: 30, height: 30, padding: 0, position: "relative" }} onClick={() => setNotifOpen((o) => !o)}>
            <Bell size={13.5} />
            {todo.counts.unreadNotifications > 0 && (
              <span style={{ position: "absolute", top: 4, right: 4, width: 6.5, height: 6.5, borderRadius: 99, background: "var(--bw-red)" }} />
            )}
          </button>
          {notifOpen && <NotificationsPopover onClose={() => setNotifOpen(false)} />}
        </div>
        <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Collapse sidebar" title="Collapse sidebar" style={{ width: 30, height: 30, padding: 0 }} onClick={onCollapse}>
          <PanelLeftClose size={13.5} />
        </button>
      </div>

      <Row href="/boardwalk/todo/inbox" icon={<InboxIcon size={14}  />} label="Inbox" count={todo.counts.inbox} active={pathname.endsWith("/inbox")} />
      <Row
        href="/boardwalk/todo/today"
        icon={<CalendarDays size={14} />}
        label="Today"
        count={todo.counts.today + todo.counts.overdue}
        active={pathname.endsWith("/today")}
      />
      <Row href="/boardwalk/todo/upcoming" icon={<CalendarRange size={14} />} label="Upcoming" count={todo.counts.upcoming} active={pathname.endsWith("/upcoming")} />
      <Row href="/boardwalk/todo/smart/my-tasks" icon={<UserRound size={14} />} label="My tasks" active={pathname.endsWith("/smart/my-tasks")} />
      <Row href="/boardwalk/todo/filters" icon={<SlidersHorizontal size={14} />} label="Filters & labels" active={pathname.endsWith("/filters")} />
      <Row href="/boardwalk/todo/completed" icon={<CircleCheck size={14} />} label="Completed" active={pathname.endsWith("/completed")} />

      {/* Favourites */}
      {(favourites.length > 0 || favFilters.length > 0) && (
        <>
          <SectionHeader label="Favourites" open={!collapsed.favourites} onToggle={() => setCollapsed("favourites", !!collapsed.favourites)} />
          {!collapsed.favourites && (
            <>
              {favourites.map((p) => projectRow(p))}
              {favFilters.map((f) => (
                <Row key={f.id} href={`/boardwalk/todo/filter/${f.id}`} icon={<Star size={12.5} />} label={f.name} active={pathname.includes(`/filter/${f.id}`)} />
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
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Add project" style={{ width: 20, height: 20, padding: 0 }} onClick={() => setProjectModal(true)}>
            <Plus size={11} />
          </button>
        }
      />
      {!collapsed.mine && (
        <>
          {myProjects.length === 0 && (
            <button
              onClick={() => setProjectModal(true)}
              style={{ margin: "2px 9px", padding: "8px 10px", border: "1.5px dashed var(--bw-line-strong)", borderRadius: 8, background: "transparent", color: "var(--bw-ink-soft)", fontSize: 12, cursor: "pointer", fontFamily: "var(--bw-font-sans)", textAlign: "left" }}
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
