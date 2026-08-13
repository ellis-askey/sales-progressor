// Confirmation page after a client hits "pause for a week" in a chase email
// (audit #11). No ID lookup — the resume date rides in the query string
// (harmless), so nothing sensitive is fetched unauthenticated.

export const metadata = { title: "Reminders paused" };

function formatUntil(until: string | undefined): string | null {
  if (!until) return null;
  const d = new Date(`${until}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export default async function ChasesPausedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; until?: string }>;
}) {
  const { status, until } = await searchParams;
  const ok = status === "ok";
  const untilLabel = formatUntil(until);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F8F9FB",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
        color: "#1a1d29",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          background: "#fff",
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: "0 12px 32px rgba(15,23,42,0.08), 0 4px 8px rgba(15,23,42,0.04)",
          textAlign: "center",
        }}
      >
        {ok ? (
          <>
            <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700 }}>Reminders paused</h1>
            <p style={{ margin: "0 0 8px", fontSize: 15, lineHeight: 1.6, color: "#4a5162" }}>
              {untilLabel
                ? <>Got it. We&apos;ll hold off on reminders until <strong>{untilLabel}</strong>.</>
                : <>Got it. We&apos;ll hold off on reminders for the next week.</>}
            </p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#8b91a3" }}>
              You&apos;ll still get the important updates about your move. Reminders start again on their own after that.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700 }}>Link expired</h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#4a5162" }}>
              That link didn&apos;t work. If you&apos;d like to pause reminders, you can do it from your portal menu, or just reply to any of our emails.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
