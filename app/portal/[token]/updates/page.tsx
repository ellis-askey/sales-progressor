import { notFound } from "next/navigation";
import { getPortalData, getPortalUpdates } from "@/lib/services/portal";
import { P } from "@/components/portal/portal-ui";

const METHOD_ICONS: Record<string, string> = {
  email:     "✉️",
  phone:     "📞",
  sms:       "💬",
  voicemail: "📱",
  whatsapp:  "💬",
  post:      "📮",
};

const METHOD_LABELS: Record<string, string> = {
  email:     "Email",
  phone:     "Phone call",
  sms:       "SMS",
  voicemail: "Voicemail",
  whatsapp:  "WhatsApp",
  post:      "Post",
};

function groupLabel(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return "This week";
  if (diffDays < 14) return "Last week";

  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

type UpdateEntry = { id: string; content: string; createdAt: Date; method: string | null };

function groupUpdates(updates: UpdateEntry[]): { label: string; items: UpdateEntry[] }[] {
  const groups: { label: string; items: UpdateEntry[] }[] = [];
  const seen = new Set<string>();

  for (const u of updates) {
    const label = groupLabel(u.createdAt);
    if (!seen.has(label)) {
      seen.add(label);
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1].items.push(u);
  }

  return groups;
}

export default async function PortalUpdatesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();

  const { contact, transaction } = data;
  const updates = await getPortalUpdates(transaction.id);
  const saleWord = contact.roleType === "vendor" ? "sale" : "purchase";
  const groups = groupUpdates(updates);

  return (
    <div className="space-y-5">
      {updates.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-10 text-center"
          style={{ background: P.card, boxShadow: P.shadow }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
            style={{ background: P.primaryLight }}
          >
            💬
          </div>
          <p className="text-[16px] font-semibold mb-1" style={{ color: P.textPrimary }}>
            No updates yet
          </p>
          <p className="text-[14px]" style={{ color: P.textSecondary }}>
            Your agent will post {saleWord} updates here as things progress.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            {/* Date group label */}
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-2 px-1"
              style={{ color: P.textMuted }}
            >
              {group.label}
            </p>

            {/* Update cards */}
            <div className="space-y-2">
              {group.items.map((u) => (
                <div
                  key={u.id}
                  className="rounded-2xl px-5 py-4"
                  style={{ background: P.card, boxShadow: P.shadowSm }}
                >
                  {/* Method badge */}
                  {u.method && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[13px]">{METHOD_ICONS[u.method] ?? "📋"}</span>
                      <span
                        className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: P.textMuted }}
                      >
                        {METHOD_LABELS[u.method] ?? u.method}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <p
                    className="text-[14px] leading-relaxed whitespace-pre-line"
                    style={{ color: P.textPrimary }}
                  >
                    {u.content}
                  </p>

                  {/* Timestamp */}
                  <p className="text-[12px] mt-2" style={{ color: P.textMuted }}>
                    {new Date(u.createdAt).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {" · "}
                    {new Date(u.createdAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
