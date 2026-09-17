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
  // SMTP submission counterpart, for mailbox SENDING with the same
  // app-password. Absent → we can't derive sending settings automatically and
  // the send option stays unavailable for that connection.
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean; // implicit TLS on 465; false = STARTTLS (587)
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
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "googlemail.com": {
    provider: "gmail",
    label: "Gmail",
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    note: "Needs 2-Step Verification on, then an App Password (not your normal password).",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "outlook.com": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true, smtpHost: "smtp-mail.outlook.com", smtpPort: 587, smtpSecure: false },
  "hotmail.com": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true, smtpHost: "smtp-mail.outlook.com", smtpPort: 587, smtpSecure: false },
  "hotmail.co.uk": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true, smtpHost: "smtp-mail.outlook.com", smtpPort: 587, smtpSecure: false },
  "live.com": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true, smtpHost: "smtp-mail.outlook.com", smtpPort: 587, smtpSecure: false },
  "live.co.uk": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true, smtpHost: "smtp-mail.outlook.com", smtpPort: 587, smtpSecure: false },
  "msn.com": { provider: "outlook", label: "Outlook.com", host: "outlook.office365.com", port: 993, secure: true, smtpHost: "smtp-mail.outlook.com", smtpPort: 587, smtpSecure: false },
  "yahoo.com": {
    provider: "yahoo",
    label: "Yahoo Mail",
    host: "imap.mail.yahoo.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://login.yahoo.com/account/security/app-passwords",
    note: "Needs an App Password from your Yahoo account security page.",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "yahoo.co.uk": {
    provider: "yahoo",
    label: "Yahoo Mail",
    host: "imap.mail.yahoo.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://login.yahoo.com/account/security/app-passwords",
    note: "Needs an App Password from your Yahoo account security page.",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "ymail.com": { provider: "yahoo", label: "Yahoo Mail", host: "imap.mail.yahoo.com", port: 993, secure: true, smtpHost: "smtp.mail.yahoo.com", smtpPort: 465, smtpSecure: true },
  "aol.com": { provider: "aol", label: "AOL Mail", host: "imap.aol.com", port: 993, secure: true, smtpHost: "smtp.aol.com", smtpPort: 465, smtpSecure: true },
  "icloud.com": {
    provider: "icloud",
    label: "iCloud Mail",
    host: "imap.mail.me.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://support.apple.com/102654",
    note: "Needs an app-specific password from appleid.apple.com.",
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecure: false,
  },
  "me.com": { provider: "icloud", label: "iCloud Mail", host: "imap.mail.me.com", port: 993, secure: true, smtpHost: "smtp.mail.me.com", smtpPort: 587, smtpSecure: false },
  "mac.com": { provider: "icloud", label: "iCloud Mail", host: "imap.mail.me.com", port: 993, secure: true, smtpHost: "smtp.mail.me.com", smtpPort: 587, smtpSecure: false },
  "zoho.com": {
    provider: "zoho",
    label: "Zoho Mail",
    host: "imap.zoho.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://accounts.zoho.com/home#security/security_password",
    note: "Needs an app-specific password from your Zoho account's security page (not your normal password).",
    smtpHost: "smtp.zoho.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "zoho.eu": {
    provider: "zoho",
    label: "Zoho Mail",
    host: "imap.zoho.eu",
    port: 993,
    secure: true,
    appPasswordUrl: "https://accounts.zoho.eu/home#security/security_password",
    note: "Needs an app-specific password from your Zoho account's security page (not your normal password).",
    smtpHost: "smtp.zoho.eu",
    smtpPort: 465,
    smtpSecure: true,
  },
  "zohomail.com": {
    provider: "zoho",
    label: "Zoho Mail",
    host: "imap.zoho.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://accounts.zoho.com/home#security/security_password",
    note: "Needs an app-specific password from your Zoho account's security page (not your normal password).",
    smtpHost: "smtp.zoho.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  "zohomail.eu": {
    provider: "zoho",
    label: "Zoho Mail",
    host: "imap.zoho.eu",
    port: 993,
    secure: true,
    appPasswordUrl: "https://accounts.zoho.eu/home#security/security_password",
    note: "Needs an app-specific password from your Zoho account's security page (not your normal password).",
    smtpHost: "smtp.zoho.eu",
    smtpPort: 465,
    smtpSecure: true,
  },
  // eXp UK agent mailboxes are hosted on Zoho Mail's EU org service (confirmed
  // against a live account's settings, 2026-09-17). eXp's IT won't make DNS
  // changes for agents, so the app-password route here is the ONLY way these
  // mailboxes connect — keep this preset working.
  "expuk.com": {
    provider: "zoho",
    label: "eXp UK email (Zoho Mail)",
    host: "imappro.zoho.eu",
    port: 993,
    secure: true,
    appPasswordUrl: "https://accounts.zoho.eu/home#security/security_password",
    note: "Your eXp email runs on Zoho Mail. Needs an app-specific password from your Zoho account's security page (not your normal password). No eXp sign-off needed.",
    // Confirmed against a live eXp UK account's mail settings, 2026-09-17.
    smtpHost: "smtppro.zoho.eu",
    smtpPort: 465,
    smtpSecure: true,
  },
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

export type ResolvedSmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
};

/**
 * Resolve the SMTP submission settings for mailbox SENDING. Mirrors
 * resolveImapSettings: preset for known providers, else the caller's stored
 * override (a connection's smtpHost/smtpPort). Null when neither exists —
 * that mailbox stays receive-only.
 */
export function resolveSmtpSettings(
  email: string,
  override?: { host?: string | null; port?: number | null; secure?: boolean | null }
): ResolvedSmtpSettings | null {
  const preset = presetForEmail(email);
  const host = override?.host?.trim() || preset?.smtpHost;
  if (!host) return null;
  const port = override?.port ?? preset?.smtpPort ?? 465;
  const secure = override?.secure ?? preset?.smtpSecure ?? port === 465;
  return { host, port, secure };
}
