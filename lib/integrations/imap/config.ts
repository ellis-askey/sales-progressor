// IMAP provider presets + settings resolution. Given an email address we can
// usually infer the IMAP host/port for the big providers, so the agent only
// needs to paste an app-password. Anything we don't recognise falls back to
// manual host/port entry. Server-only; no secrets live here.

export type ImapProviderPreset = {
  provider: string; // stored on the connection: "gmail" | "outlook" | ...
  label: string; // human name for the UI
  host: string;
  port: number;
  secure: boolean; // implicit TLS on 993
  // Where the agent creates an app-password (shown as a help link in the UI).
  appPasswordUrl?: string;
  // A one-line hint about that provider's requirement (2FA, enable IMAP, etc.).
  note?: string;
};

// Keyed by the email domain (lowercased).
const PRESETS: Record<string, ImapProviderPreset> = {
  "gmail.com": {
    provider: "gmail",
    label: "Gmail",
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    note: "Needs 2-Step Verification on, then an App Password (not your normal password).",
  },
  "googlemail.com": {
    provider: "gmail",
    label: "Gmail",
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    note: "Needs 2-Step Verification on, then an App Password (not your normal password).",
  },
  "outlook.com": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true },
  "hotmail.com": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true },
  "hotmail.co.uk": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true },
  "live.com": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true },
  "live.co.uk": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true },
  "msn.com": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true },
  "yahoo.com": {
    provider: "yahoo",
    label: "Yahoo Mail",
    host: "imap.mail.yahoo.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://login.yahoo.com/account/security/app-passwords",
    note: "Needs an App Password from your Yahoo account security page.",
  },
  "yahoo.co.uk": {
    provider: "yahoo",
    label: "Yahoo Mail",
    host: "imap.mail.yahoo.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://login.yahoo.com/account/security/app-passwords",
    note: "Needs an App Password from your Yahoo account security page.",
  },
  "ymail.com": { provider: "yahoo", label: "Yahoo Mail", host: "imap.mail.yahoo.com", port: 993, secure: true },
  "aol.com": { provider: "aol", label: "AOL Mail", host: "imap.aol.com", port: 993, secure: true },
  "icloud.com": {
    provider: "icloud",
    label: "iCloud Mail",
    host: "imap.mail.me.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://support.apple.com/102654",
    note: "Needs an app-specific password from appleid.apple.com.",
  },
  "me.com": { provider: "icloud", label: "iCloud Mail", host: "imap.mail.me.com", port: 993, secure: true },
  "mac.com": { provider: "icloud", label: "iCloud Mail", host: "imap.mail.me.com", port: 993, secure: true },
};

export function domainOf(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

/** The preset for a known provider domain, or null if we don't recognise it. */
export function presetForEmail(email: string): ImapProviderPreset | null {
  return PRESETS[domainOf(email)] ?? null;
}

export type ResolvedImapSettings = {
  provider: string;
  host: string;
  port: number;
  secure: boolean;
};

/**
 * Resolve the IMAP settings to connect with. Uses the preset for known
 * providers; otherwise requires the caller to have supplied host (+ optional
 * port). Returns null when we can't determine a host.
 */
export function resolveImapSettings(
  email: string,
  override?: { host?: string; port?: number; secure?: boolean }
): ResolvedImapSettings | null {
  const preset = presetForEmail(email);
  const host = override?.host?.trim() || preset?.host;
  if (!host) return null;
  const port = override?.port ?? preset?.port ?? 993;
  const secure = override?.secure ?? preset?.secure ?? port === 993;
  return { provider: preset?.provider ?? "imap", host, port, secure };
}
