// Admin-only Sentry verification page. Throws a server-side AND client-side
// error on demand so you can confirm both runtimes are reporting to Sentry.
// Direct URL only, not linked from anywhere. Delete once Sentry is confirmed
// working in production.

import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { ClientErrorButton } from "./ClientErrorButton";
import { throwServerError } from "./actions";

export default async function SentryTestPage({
  searchParams,
}: {
  searchParams: Promise<{ trigger?: string }>;
}) {
  const session = await requireSession();
  if (session.user.role !== "admin" && session.user.role !== "superadmin") {
    redirect("/dashboard");
  }

  const { trigger } = await searchParams;
  if (trigger === "server") {
    // This throws synchronously during the server render — Sentry should
    // capture it as a server error and the page renders the error boundary.
    throw new Error("SENTRY_TEST_SERVER_RENDER — intentional, verifying Sentry server capture");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Sentry verification</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Three buttons, three runtimes. Click each, then check the Sentry
        dashboard — all three should appear within seconds. Once confirmed,
        delete <code>app/admin/sentry-test/</code> and this page entirely.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 1. Client-side error — throws in the browser, captured by sentry.client.config */}
        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>1. Client-side error (browser)</h2>
          <p style={{ fontSize: 14, color: "#666", margin: "8px 0" }}>
            Throws in the React event handler. Should show in Sentry tagged{" "}
            <code>runtime: browser</code>.
          </p>
          <ClientErrorButton />
        </div>

        {/* 2. Server render error — link triggers the throw above */}
        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>2. Server render error</h2>
          <p style={{ fontSize: 14, color: "#666", margin: "8px 0" }}>
            Throws during server component render. Should show in Sentry tagged{" "}
            <code>runtime: nodejs</code>. Page will hit the error boundary.
          </p>
          <a
            href="?trigger=server"
            style={{ display: "inline-block", padding: "8px 16px", background: "#ef4444", color: "white", borderRadius: 6, textDecoration: "none" }}
          >
            Trigger server render error
          </a>
        </div>

        {/* 3. Server action error — fires via form action, captured server-side */}
        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>3. Server action error</h2>
          <p style={{ fontSize: 14, color: "#666", margin: "8px 0" }}>
            Throws inside a server action. Should show in Sentry tagged{" "}
            <code>runtime: nodejs</code>.
          </p>
          <form action={throwServerError}>
            <button
              type="submit"
              style={{ padding: "8px 16px", background: "#f59e0b", color: "white", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Trigger server action error
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
