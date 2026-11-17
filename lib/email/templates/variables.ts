// Dynamic variables for user-authored email templates (composer templates).
//
// Stable keys are the persistence identity; labels are display-only. A variable
// lives in the stored template body as an atomic token span:
//   <span data-token="KEY" class="et-var" contenteditable="false">Label</span>
// Resolution targets those [data-token] spans directly (never a fragile string
// replace against rendered HTML) and happens client-side at insert / preview
// time via renderTemplateBody. Client-safe: no server imports, no React.

export const TEMPLATE_VAR_KEYS = [
  "property_address",
  "buyer_name",
  "seller_name",
  "agent_name",
  "target_exchange_date",
  "target_completion_date",
] as const;

export type TemplateVarKey = (typeof TEMPLATE_VAR_KEYS)[number];

export type TemplateVarIcon = "home" | "buyer" | "seller" | "agent" | "calendar";

export const TEMPLATE_VARIABLES: { key: TemplateVarKey; label: string; icon: TemplateVarIcon }[] = [
  { key: "property_address", label: "Property address", icon: "home" },
  { key: "buyer_name", label: "Buyer name", icon: "buyer" },
  { key: "seller_name", label: "Seller name", icon: "seller" },
  { key: "agent_name", label: "Agent name", icon: "agent" },
  { key: "target_exchange_date", label: "Target exchange date", icon: "calendar" },
  { key: "target_completion_date", label: "Target completion date", icon: "calendar" },
];

const LABELS = Object.fromEntries(TEMPLATE_VARIABLES.map((v) => [v.key, v.label])) as Record<TemplateVarKey, string>;

export function templateVarLabel(key: TemplateVarKey): string {
  return LABELS[key] ?? key;
}

export function isTemplateVarKey(k: string): k is TemplateVarKey {
  return (TEMPLATE_VAR_KEYS as readonly string[]).includes(k);
}

// Resolved values for a specific file. A string = render it. `null` = the value
// is genuinely missing for this file (we never invent it). A key absent from the
// map = not resolvable in this context (treated as missing too).
export type TemplateVarValues = Partial<Record<TemplateVarKey, string | null>>;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The atomic token span the editor inserts (Insert variable). contenteditable
// false so it behaves as one unit and is removed with a single backspace.
export function varTokenHtml(key: TemplateVarKey): string {
  return `<span data-token="${key}" class="et-var" contenteditable="false">${escapeHtml(templateVarLabel(key))}</span>`;
}

export type RenderMode = "email" | "preview";

// Resolve the stored body HTML against values. Walks [data-token] spans and
// swaps each for its resolved value; surrounding rich-text formatting is left
// untouched. Returns the resolved HTML and the set of variable keys that were
// missing. Browser-only (uses DOMParser); on the server it returns the body
// unchanged (resolution is always a client concern here).
export function renderTemplateBody(
  html: string,
  values: TemplateVarValues,
  mode: RenderMode,
): { html: string; missing: TemplateVarKey[] } {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return { html, missing: [] };
  }
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const missing = new Set<TemplateVarKey>();
  doc.querySelectorAll<HTMLElement>("[data-token]").forEach((el) => {
    const key = el.getAttribute("data-token") || "";
    if (!isTemplateVarKey(key)) {
      el.replaceWith(doc.createTextNode(el.textContent || ""));
      return;
    }
    const v = values[key];
    if (typeof v === "string" && v.trim()) {
      el.replaceWith(doc.createTextNode(v));
      return;
    }
    missing.add(key);
    if (mode === "preview") {
      const span = doc.createElement("span");
      span.className = "et-var-missing";
      span.textContent = `${templateVarLabel(key)} — not set`;
      el.replaceWith(span);
    } else {
      // Email: never emit raw {token} syntax. A clearly-bracketed label is the
      // safe fallback if the caller inserts without supplying a missing value.
      el.replaceWith(doc.createTextNode(`[${templateVarLabel(key)}]`));
    }
  });
  return { html: doc.body.innerHTML, missing: Array.from(missing) };
}

// Which variable keys a stored body actually uses (for missing-value prompts).
export function tokensInBody(html: string): TemplateVarKey[] {
  const found = new Set<TemplateVarKey>();
  const re = /data-token="([a-z_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (isTemplateVarKey(m[1])) found.add(m[1]);
  }
  return Array.from(found);
}
