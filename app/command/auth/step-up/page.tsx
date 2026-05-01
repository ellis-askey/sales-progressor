export const dynamic = "force-dynamic";

export default function StepUpPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorMessages: Record<string, string> = {
    wrong_code: "Incorrect code — try again.",
    rate_limited: "Too many failed attempts. Try again in 15 minutes.",
    missing: "Please enter your 6-digit code.",
  };
  const errorMsg = searchParams.error ? (errorMessages[searchParams.error] ?? "Verification failed.") : null;

  return (
    <main style={{ padding: "2rem", maxWidth: 400, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
        Verify your identity
      </h1>
      <p style={{ marginBottom: "1rem", color: "#555" }}>
        Enter the 6-digit code from your authenticator app to continue.
      </p>
      {errorMsg && (
        <p style={{ color: "#c00", marginBottom: "1rem", fontWeight: 600 }}>{errorMsg}</p>
      )}
      <form action="/api/command/auth/step-up" method="POST">
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
          Authenticator code
        </label>
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          style={{ fontSize: "1.25rem", letterSpacing: "0.3em", padding: "0.5rem", width: "10rem" }}
        />
        <button
          type="submit"
          style={{
            display: "block",
            marginTop: "1rem",
            padding: "0.6rem 1.5rem",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Verify
        </button>
      </form>
    </main>
  );
}
