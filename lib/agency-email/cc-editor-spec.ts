// lib/agency-email/cc-editor-spec.ts
//
// Client-safe field metadata for the Command Centre Tier-2 default editors.
// Drives one generic form so we don't hand-roll four dark editors. Pure data
// (no prisma / no server-only) so both the CC page and the client editor import
// it. The field keys match the content shapes in lib/agency-email/templates.ts.

export type TemplateFieldSpec = { key: string; label: string; kind: "text" | "textarea" | "list"; hint?: string };
export type CcVariantSpec = { templateKey: string; variant: string; label: string; fields: TemplateFieldSpec[] };
export type CcTemplateSpec = { key: string; label: string; blurb: string; variants: CcVariantSpec[] };

const COMPLETION_FIELDS: TemplateFieldSpec[] = [
  { key: "subject", label: "Subject", kind: "text" },
  { key: "opening", label: "Opening", kind: "textarea" },
  { key: "bullets", label: "What to expect on completion day", kind: "list" },
];

export const CC_EMAIL_TEMPLATES: CcTemplateSpec[] = [
  {
    key: "completion_pack",
    label: "Completion pack",
    blurb: "Sent to the client once contracts exchange: the completion-day checklist.",
    variants: [
      { templateKey: "completion_pack", variant: "purchaser", label: "Buyer", fields: COMPLETION_FIELDS },
      { templateKey: "completion_pack", variant: "vendor", label: "Seller", fields: COMPLETION_FIELDS },
    ],
  },
  {
    key: "post_completion",
    label: "Post-completion",
    blurb: "A thank you and what to do after completion. Not sending yet; the send trigger lands in a follow-up.",
    variants: [
      { templateKey: "post_completion", variant: "purchaser", label: "Buyer", fields: COMPLETION_FIELDS },
      { templateKey: "post_completion", variant: "vendor", label: "Seller", fields: COMPLETION_FIELDS },
    ],
  },
  {
    key: "exchange_day_client",
    label: "Exchange day",
    blurb: "Sent to the client on exchange day: a morning note and a later authority nudge.",
    variants: [
      {
        templateKey: "exchange_day_client",
        variant: "morning",
        label: "Morning note",
        fields: [
          { key: "subject", label: "Subject", kind: "text" },
          { key: "paragraphs", label: "Paragraphs", kind: "list" },
        ],
      },
      {
        templateKey: "exchange_day_client",
        variant: "authority",
        label: "Authority nudge",
        fields: [
          { key: "subject", label: "Subject", kind: "text" },
          { key: "intro", label: "Paragraphs (before the button)", kind: "list" },
          { key: "closing", label: "Closing (after the button)", kind: "textarea" },
        ],
      },
    ],
  },
  {
    key: "client_chase",
    label: "Chase reminder",
    blurb: "The body lists outstanding items automatically; only the subject and optional opening/closing lines are set here.",
    variants: [
      {
        templateKey: "client_chase",
        variant: "default",
        label: "",
        fields: [
          { key: "subject", label: "Subject", kind: "text", hint: "Leave blank to use the rotating default subjects." },
          { key: "intro", label: "Opening line", kind: "textarea", hint: "Optional. Shown just under the greeting." },
          { key: "outro", label: "Closing line", kind: "textarea", hint: "Optional. Shown under the reminder." },
        ],
      },
    ],
  },
  {
    key: "weekly_update",
    label: "Weekly update",
    blurb: "The body is an AI draft per sale; only the subject, optional opening/closing lines and the tone are set here.",
    variants: [
      {
        templateKey: "weekly_update",
        variant: "default",
        label: "",
        fields: [
          { key: "subject", label: "Subject", kind: "text", hint: "Leave blank to use the default subject." },
          { key: "intro", label: "Opening line", kind: "textarea", hint: "Optional." },
          { key: "toneGuidance", label: "Tone (guides the AI draft)", kind: "textarea", hint: "Hard voice + privacy rules always win." },
          { key: "closing", label: "Closing line", kind: "textarea", hint: "Optional." },
        ],
      },
    ],
  },
];

export const CC_TOKENS_NOTE =
  "Blanks like {address}, {firstName} and {completionDate} are filled in per sale when the email sends. Leave them in place.";
