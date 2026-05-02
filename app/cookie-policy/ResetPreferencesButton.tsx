"use client";

export function ResetPreferencesButton() {
  return (
    <button
      onClick={() => {
        localStorage.removeItem("cookie-consent");
        document.cookie = "cookie-consent=; max-age=0; path=/";
        window.location.reload();
      }}
      style={{
        background: "none",
        border: "1px solid #ccc",
        borderRadius: "6px",
        padding: "6px 14px",
        fontSize: "13px",
        cursor: "pointer",
        color: "#555",
      }}
    >
      Reset cookie preferences
    </button>
  );
}
