// Confirmation page after a client hits "pause for a week" in a chase email
// (audit #11). No ID lookup — the resume date rides in the query string
// (harmless), so nothing sensitive is fetched unauthenticated.

import { confirmPauseAction } from "./actions";
import { AuthNoticeShell } from "@/components/ui/AuthNoticeShell";
import { PageTitle } from "@/components/ui/PageTitle";

// no-referrer: the confirm step carries the token in the URL; don't let it leak
// via the Referer header to any external resource.
export const metadata = { title: "Reminders paused", referrer: "no-referrer" } as const;

const CORAL = "#FF6B4A";

function formatUntil(until: string | undefined): string | null {
  if (!until) return null;
  const d = new Date(`${until}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function SuccessTick() {
  return (
    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,107,74,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={CORAL} strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </div>
  );
}

export default async function ChasesPausedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; until?: string; t?: string }>;
}) {
  const { status, until, t } = await searchParams;
  const ok = status === "ok";
  const untilLabel = formatUntil(until);
  // Confirm step from the email link (token present, not yet applied). The pause
  // only fires on the button press, so a link scanner opening this changes nothing.
  const isConfirm = !status && !!t;

  return (
    <AuthNoticeShell>
      {isConfirm ? (
        <>
          <PageTitle
            title="Pause reminders?"
            subtitle="We'll hold off on reminder emails for the next week. You'll still get the important updates about your move."
            style={{ marginBottom: 20 }}
          />
          {/* Flat coral primary (matches the arc Button resting look). Inline +
              a scoped hover so this stays a server component — no client import. */}
          <style dangerouslySetInnerHTML={{ __html: `.chase-pause-btn:hover{background:#E85A35}` }} />
          <form action={confirmPauseAction}>
            <input type="hidden" name="t" value={t} />
            <button
              type="submit"
              className="chase-pause-btn"
              style={{ width: "100%", padding: "13px", borderRadius: 10, background: CORAL, color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", transition: "background 0.12s ease" }}
            >
              Pause for a week
            </button>
          </form>
        </>
      ) : ok ? (
        <div style={{ textAlign: "center" }}>
          <SuccessTick />
          <PageTitle
            title="Reminders paused."
            subtitle={untilLabel
              ? <>We&apos;ll hold off on reminders until <strong>{untilLabel}</strong>.</>
              : "We'll hold off on reminders for the next week."}
            style={{ marginBottom: 12 }}
          />
          <p style={{ margin: 0, fontSize: 13, color: "rgba(45,24,16,0.55)", lineHeight: 1.6 }}>
            You&apos;ll still get the important updates about your move. Reminders start again on their own after that.
          </p>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <PageTitle
            title="Link expired."
            subtitle="That link didn't work. If you'd like to pause reminders, you can do it from your portal menu, or just reply to any of our emails."
          />
        </div>
      )}
    </AuthNoticeShell>
  );
}
