import client from "@sendgrid/client";
import { applyDevEmailRedirect } from "@/lib/email";

client.setApiKey(process.env.SENDGRID_API_KEY!);

// TSP-specific, collision-resistant labels for domain authentication. SendGrid's
// defaults ("em" return path, "s1"/"s2" DKIM selectors) collide when an agency's
// domain is already authenticated with a *different* SendGrid account, because
// both accounts generate identical host names. Using our own return path +
// custom DKIM selector lets TSP's authentication coexist alongside an existing
// one without touching any of the other account's DNS records. Both must satisfy
// SendGrid's rules: the return path is a DNS label; custom_dkim_selector is
// exactly 3 alphanumeric characters.
const TSP_RETURN_PATH_SUBDOMAIN = "tsp";
const TSP_DKIM_SELECTOR = "tsp";

export type CnameRecord = {
  host: string;
  data: string;
  type: "cname";
};

export type AuthDomainResult = {
  id: number;
  cnameRecords: CnameRecord[];
  alreadyValid?: boolean;
};

export type ValidateResult = {
  valid: boolean;
  dkimValid: boolean;
  spfValid: boolean;
};

function parseDnsRecords(dns: Record<string, { host: string; data: string; type: string }>): CnameRecord[] {
  return Object.values(dns)
    .filter((r) => r.type === "cname")
    .map((r) => ({ host: r.host, data: r.data, type: "cname" as const }));
}

/** Look up an existing authenticated domain in SendGrid by domain name. */
async function getExistingAuthenticatedDomain(domain: string): Promise<AuthDomainResult> {
  const [, body] = await client.request({
    method: "GET",
    url: "/v3/whitelabel/domains",
  });

  const list = (body as Array<Record<string, unknown>>);
  const match = list.find((d) => d.domain === domain);
  if (!match) throw new Error(`Domain ${domain} not found in SendGrid`);

  const dns = (match.dns ?? {}) as Record<string, { host: string; data: string; type: string }>;
  return {
    id: match.id as number,
    cnameRecords: parseDnsRecords(dns),
    alreadyValid: match.valid === true,
  };
}

/** Create an authenticated domain in SendGrid. Returns domain ID + CNAME records. */
export async function createAuthenticatedDomain(
  domain: string
): Promise<AuthDomainResult> {
  try {
    const [, body] = await client.request({
      method: "POST",
      url: "/v3/whitelabel/domains",
      body: {
        domain,
        subdomain: TSP_RETURN_PATH_SUBDOMAIN,
        custom_dkim_selector: TSP_DKIM_SELECTOR,
        automatic_security: true,
        custom_spf: false,
        default: false,
      },
    });

    const data = body as Record<string, unknown>;
    const dns = data.dns as Record<string, { host: string; data: string; type: string }>;
    return { id: data.id as number, cnameRecords: parseDnsRecords(dns) };
  } catch {
    // Domain already exists in SendGrid — look it up instead
    return getExistingAuthenticatedDomain(domain);
  }
}

/**
 * Delete an authenticated domain from SendGrid by its whitelabel ID. Used only
 * to reset a *pending* authentication whose records collided with an existing
 * SendGrid account — never call this for a verified domain, which has live DNS
 * mail flowing through it. The caller is responsible for that guard.
 */
export async function deleteAuthenticatedDomain(sendgridDomainId: number): Promise<void> {
  await client.request({
    method: "DELETE",
    url: `/v3/whitelabel/domains/${sendgridDomainId}`,
  });
}

/** Ask SendGrid to validate the DNS records for an authenticated domain. */
export async function validateAuthenticatedDomain(
  sendgridDomainId: number
): Promise<ValidateResult> {
  const [, body] = await client.request({
    method: "POST",
    url: `/v3/whitelabel/domains/${sendgridDomainId}/validate`,
  });

  const data = body as Record<string, unknown>;
  const results = (data.validation_results ?? {}) as Record<
    string,
    { valid: boolean }
  >;

  const dkimValid = results.dkim1?.valid === true || results.dkim2?.valid === true;
  const spfValid = results.mail_cname?.valid === true;
  const valid = dkimValid && spfValid;

  return { valid, dkimValid, spfValid };
}

/** Send a transactional email via SendGrid using a verified sender address. */
export async function sendFromVerifiedAddress({
  from,
  to,
  subject,
  text,
  html,
  replyTo,
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}) {
  const sgMail = (await import("@sendgrid/mail")).default;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  return sgMail.send(applyDevEmailRedirect({
    from,
    replyTo: replyTo ?? from,
    to,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  }));
}
