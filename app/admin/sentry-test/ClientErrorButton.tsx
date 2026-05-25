"use client";

export function ClientErrorButton() {
  return (
    <button
      type="button"
      onClick={() => {
        throw new Error("SENTRY_TEST_CLIENT — intentional, verifying Sentry client capture");
      }}
      style={{
        padding: "8px 16px",
        background: "#3b82f6",
        color: "white",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      Trigger client-side error
    </button>
  );
}
