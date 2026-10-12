"use client";

// Notification centre — assignment, mentions, comments, reminders and
// project shares. Opening marks everything read; clicking a row opens the
// task. Also asks (once) for browser-notification permission so reminder
// alerts can surface even when the tab is in the background.

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { formsApi } from "@/lib/forms/client";
import type { NotificationDto } from "@/lib/todo/types";
import { useTodo } from "./TodoProvider";
import { Popover } from "./Pickers";

export function NotificationsPopover({ onClose }: { onClose: () => void }) {
  const todo = useTodo();
  const [items, setItems] = useState<NotificationDto[] | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await formsApi<{ notifications: NotificationDto[] }>("/api/todo/notifications");
      setItems(res.notifications);
      await formsApi("/api/todo/notifications", { method: "POST", body: JSON.stringify({}) });
      todo.refreshCounts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enableBrowserNotifications() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }

  return (
    <Popover onClose={onClose} width={330} align="right">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px 8px" }}>
        <span className="bw-kicker" style={{ fontSize: 10 }}>Notifications</span>
        {typeof Notification !== "undefined" && Notification.permission === "default" && (
          <button className="bw-btn bw-btn-ghost bw-btn-sm" style={{ height: 22, fontSize: 10.5 }} onClick={enableBrowserNotifications}>
            <BellRing size={11} /> Enable browser alerts
          </button>
        )}
      </div>
      <div className="bw-scroll" style={{ maxHeight: 360, overflowY: "auto" }}>
        {items === null && <p className="bw-hint" style={{ padding: 14, textAlign: "center" }}>Loading…</p>}
        {items?.length === 0 && (
          <div style={{ textAlign: "center", padding: "22px 10px" }}>
            <Bell size={20} style={{ color: "var(--bw-ink-faint)", marginBottom: 6 }} />
            <p className="bw-hint" style={{ margin: 0 }}>All quiet. Assignments, mentions and reminders land here.</p>
          </div>
        )}
        {items?.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              if (n.taskId) todo.openTask(n.taskId);
              onClose();
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              border: "none",
              background: n.readAt ? "transparent" : "var(--bw-paper-sunken)",
              borderRadius: 9,
              padding: "9px 10px",
              cursor: n.taskId ? "pointer" : "default",
              marginBottom: 3,
              fontFamily: "var(--bw-font-sans)",
            }}
          >
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: "var(--bw-ink)" }}>
              {n.actorId && <strong>{todo.memberName(n.actorId) || "Someone"} </strong>}
              {n.message}
            </p>
            <p className="bw-hint" style={{ margin: "2px 0 0", fontSize: 11 }}>
              {new Date(n.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </button>
        ))}
      </div>
    </Popover>
  );
}
