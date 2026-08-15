// lib/integrations/outlook/config.ts
//
// Server-only configuration + low-level helpers for the Microsoft Outlook
// (Microsoft Graph) integration. Phase 1 = connect only: build the authorize
// URL, exchange the auth code for tokens, and read the connected identity.
// Token refresh and mailbox reads are deliberately NOT implemented yet.
//
// All four values come from the Microsoft Entra app registration and must be
// set in the environment (see .env.example). Nothing here runs on the client.

import "server-only";

// Delegated Graph scopes. `offline_access` is what gets us a refresh token so a
// later phase can keep the connection alive without the user re-consenting.
export const OUTLOOK_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.Read",
  "Mail.Send",
] as const;

export const OUTLOOK_SCOPE_STRING = OUTLOOK_SCOPES.join(" ");

type OutlookConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
};

/** Reads + validates the Microsoft env vars. Throws a clear error if any are missing. */
export function getOutlookConfig(): OutlookConfig {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  const missing = [
    ["MICROSOFT_CLIENT_ID", clientId],
    ["MICROSOFT_CLIENT_SECRET", clientSecret],
    ["MICROSOFT_TENANT_ID", tenantId],
    ["MICROSOFT_REDIRECT_URI", redirectUri],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`[outlook] Missing environment variables: ${missing.join(", ")}`);
  }

  const base = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    tenantId: tenantId!,
    redirectUri: redirectUri!,
    authorizeUrl: `${base}/authorize`,
    tokenUrl: `${base}/token`,
  };
}

/** Whether the integration is configured at all (used to render a helpful UI state). */
export function isOutlookConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MICROSOFT_TENANT_ID &&
      process.env.MICROSOFT_REDIRECT_URI
  );
}

/** Builds the Microsoft authorization-code-flow URL to redirect the user to. */
export function buildAuthorizeUrl(state: string): string {
  const cfg = getOutlookConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    response_mode: "query",
    scope: OUTLOOK_SCOPE_STRING,
    state,
    // Force the account picker/consent so a user who is signed into a different
    // Microsoft account in the browser can choose the right mailbox.
    prompt: "select_account",
  });
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

export type OutlookTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  scope: string;
  token_type: string;
};

/** Exchanges an authorization code for tokens, server-side. Never call from the client. */
export async function exchangeCodeForTokens(code: string): Promise<OutlookTokenResponse> {
  const cfg = getOutlookConfig();
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    scope: OUTLOOK_SCOPE_STRING,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    // Microsoft returns { error, error_description }. Log only the error code,
    // never the response body wholesale (it can echo request params).
    let code = "unknown_error";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) code = data.error;
    } catch {
      /* ignore parse failure */
    }
    throw new Error(`[outlook] Token exchange failed (${res.status}): ${code}`);
  }

  return (await res.json()) as OutlookTokenResponse;
}

export type GraphIdentity = {
  id: string;
  email: string;
  displayName: string | null;
};

/** Calls Graph /me to identify the connected mailbox. */
export async function fetchGraphMe(accessToken: string): Promise<GraphIdentity> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`[outlook] Graph /me failed (${res.status})`);
  }
  const data = (await res.json()) as {
    id: string;
    mail?: string | null;
    userPrincipalName?: string | null;
    displayName?: string | null;
  };
  return {
    id: data.id,
    email: data.mail ?? data.userPrincipalName ?? "",
    displayName: data.displayName ?? null,
  };
}
