import client from "@sendgrid/client";

client.setApiKey(process.env.SENDGRID_API_KEY!);

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
        subdomain: "em",
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
  return sgMail.send({
    from,
    replyTo: replyTo ?? from,
    to,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  });
}
