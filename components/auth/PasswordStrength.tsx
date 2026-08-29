// Password strength meter for the auth pages (register, invited-password,
// reset-password). Only ever shown once the user reaches the 8-char minimum.
// Scored from character variety + length, drawn as four bars in the warm palette.

function scorePassword(pw: string): 1 | 2 | 3 | 4 {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].reduce((n, re) => n + (re.test(pw) ? 1 : 0), 0);
  let s = 1; // Weak — meets the 8-char minimum
  if (classes >= 2 && pw.length >= 8) s = 2; // Fair
  if (classes >= 3 && pw.length >= 10) s = 3; // Good
  if (classes >= 4 && pw.length >= 12) s = 4; // Strong
  return s as 1 | 2 | 3 | 4;
}

const STRENGTH = {
  1: { label: "Weak", color: "#D9682F" },
  2: { label: "Fair", color: "#E0942E" },
  3: { label: "Good", color: "#6FA03A" },
  4: { label: "Strong", color: "#2F9E6B" },
} as const;

export function PasswordStrength({ password }: { password: string }) {
  if (password.length < 8) return null;
  const score = scorePassword(password);
  const meta = STRENGTH[score];
  return (
    <div style={{ marginTop: "8px" }} aria-live="polite">
      <div style={{ display: "flex", gap: "4px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, height: "4px", borderRadius: "2px", background: i <= score ? meta.color : "rgba(61,31,14,0.12)", transition: "background 0.2s ease" }} />
        ))}
      </div>
      <p style={{ fontSize: "11px", color: meta.color, margin: "5px 0 0", fontWeight: 500 }}>
        Password strength: {meta.label}
      </p>
    </div>
  );
}
