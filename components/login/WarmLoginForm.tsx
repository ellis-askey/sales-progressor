"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function WarmLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await signIn("credentials", { email: email.trim(), password, redirect: false })
    setLoading(false)
    if (result?.error || !result?.ok) {
      setError("Incorrect email or password.")
    } else {
      router.push("/")
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.50)",
    border: "0.5px solid rgba(255,255,255,0.70)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#3D1F0E",
    fontSize: "14px",
    outline: "none",
    transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
  }

  return (
    <>
      <style>{`
        .wi::placeholder { color: rgba(61,31,14,0.42); }
        .wi:focus {
          background: rgba(255,255,255,0.62) !important;
          border-color: rgba(255,255,255,0.95) !important;
          box-shadow: 0 0 0 3px rgba(255,138,101,0.16);
        }
        .wi-pw { padding-right: 42px !important; }
        .wbtn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(216,90,53,0.45) !important;
        }
        .wbtn:active:not(:disabled) { transform: scale(0.98); }
        .wlink:hover { color: #3D1F0E !important; }
        .wcreate:hover { color: #B0432A !important; }
      `}</style>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#7A4A2E", marginBottom: "6px", letterSpacing: "0.01em" }}>
            Email address
          </label>
          <input
            className="wi"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@agency.co.uk"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#7A4A2E", marginBottom: "6px", letterSpacing: "0.01em" }}>
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              className="wi wi-pw"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(61,31,14,0.40)", padding: 0, display: "flex" }}
            >
              {showPassword ? (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <p style={{ fontSize: "12px", color: "#8B2500", background: "rgba(255,210,190,0.55)", padding: "8px 12px", borderRadius: "8px", margin: 0 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link href="/forgot-password" className="wlink" style={{ fontSize: "11px", color: "#7A4A2E", textDecoration: "none", transition: "color 0.12s ease" }}>
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          className="wbtn"
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            background: loading || !email.trim() || !password ? "rgba(220,90,55,0.45)" : "#D85A35",
            color: "white",
            fontSize: "14px",
            fontWeight: 500,
            border: "none",
            cursor: loading || !email.trim() || !password ? "not-allowed" : "pointer",
            boxShadow: "0 4px 20px rgba(216,90,53,0.35)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#7A4A2E", margin: 0 }}>
          Estate agent?{" "}
          <Link href="/register" className="wcreate" style={{ color: "#D2553A", fontWeight: 500, textDecoration: "none", transition: "color 0.12s ease" }}>
            Create an account
          </Link>
        </p>

      </form>
    </>
  )
}
