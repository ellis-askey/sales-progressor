// Pure SMTP error classification (no nodemailer / server-only imports) so it's
// unit-testable in isolation, mirroring lib/integrations/imap/sent-mailbox.ts.
//
// Nodemailer errors carry `code` (e.g. "EAUTH", "ETIMEDOUT", "ECONNECTION") and,
// for server rejections, `responseCode` (the SMTP status: 4xx transient, 5xx
// permanent) plus `response` (the server's text). We classify three ways:
//   - user-safe message for the connect UI / smtpLastError
//   - auth failure? → the app-password is wrong or revoked (worth auto-disable)
//   - transient?    → worth retrying from the send queue

export type SmtpErrorLike = {
  message?: string;
  code?: string | number;
  responseCode?: number;
  response?: string;
  command?: string;
};

function textOf(err: unknown): string {
  const e = (err ?? {}) as SmtpErrorLike;
  return `${e.message ?? ""} ${e.response ?? ""} ${String(e.code ?? "")}`.toLowerCase();
}

/** True when the server rejected the LOGIN itself — wrong/revoked app-password. */
export function isSmtpAuthFailure(err: unknown): boolean {
  const e = (err ?? {}) as SmtpErrorLike;
  if (e.code === "EAUTH") return true;
  if (e.responseCode === 535 || e.responseCode === 534) return true;
  const text = textOf(err);
  return text.includes("authentication failed") || text.includes("invalid credentials") || text.includes("username and password not accepted");
}

/**
 * True when a send failure is worth retrying later. SMTP semantics: 4xx is
 * "try again later", 5xx is permanent; anything without a responseCode is a
 * network/timeout problem, which is transient. Auth failures are permanent
 * (retrying a revoked password can't help).
 */
export function isTransientSmtpError(err: unknown): boolean {
  if (isSmtpAuthFailure(err)) return false;
  const e = (err ?? {}) as SmtpErrorLike;
  if (typeof e.responseCode !== "number") return true;
  return e.responseCode >= 400 && e.responseCode < 500;
}

/** A short, user-safe reason for the connect UI and the smtpLastError field. */
export function classifySmtpError(err: unknown): string {
  if (isSmtpAuthFailure(err))
    return "We couldn't sign in to send. Check that you used an app-password, not your normal password.";
  const e = (err ?? {}) as SmtpErrorLike;
  const text = textOf(err);
  if (typeof e.responseCode === "number" && e.responseCode >= 400 && e.responseCode < 500)
    return "The mail server is busy or has hit a sending limit. We'll retry shortly.";
  if (typeof e.responseCode === "number" && e.responseCode >= 500)
    return "The mail server refused this email.";
  if (text.includes("timeout") || text.includes("timed out") || text.includes("etimedout"))
    return "The mail server didn't respond. Check the server details and try again.";
  if (text.includes("enotfound") || text.includes("getaddrinfo") || text.includes("econnrefused") || text.includes("econnection"))
    return "We couldn't reach that mail server. Check the server address and port.";
  if (text.includes("certificate") || text.includes("tls") || text.includes("ssl"))
    return "Secure connection to the mail server failed.";
  return "We couldn't send through that mailbox. Please check the details and try again.";
}
