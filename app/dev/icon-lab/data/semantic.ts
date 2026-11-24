// The representative comparison set: real TSP meanings (drawn from the audited
// inventory) rendered identically across every family so the differences are
// obvious. `phosphor` is the real Phosphor export name actually used in the app;
// `emoji` is the native-emoji equivalent; `tone` drives the colourful families
// so they aren't all one hue (brief §7).

export type SemanticIcon = {
  key: string;
  label: string;
  category: string;
  phosphor: string; // real @phosphor-icons/react export name
  emoji: string;
  tone: string; // hex, for colour-driven families
};

export const SEMANTIC: SemanticIcon[] = [
  { key: "property", label: "Property", category: "property", phosphor: "House", emoji: "🏠", tone: "#0ea5e9" },
  { key: "buyer", label: "Buyer", category: "people", phosphor: "ShoppingBag", emoji: "🛍️", tone: "#8b5cf6" },
  { key: "seller", label: "Seller", category: "people", phosphor: "Storefront", emoji: "🏪", tone: "#a855f7" },
  { key: "solicitor", label: "Solicitor", category: "people", phosphor: "Scales", emoji: "⚖️", tone: "#6366f1" },
  { key: "mortgage", label: "Mortgage", category: "money", phosphor: "Bank", emoji: "🏦", tone: "#22c55e" },
  { key: "documents", label: "Documents", category: "documents", phosphor: "FileText", emoji: "📄", tone: "#0891b2" },
  { key: "email", label: "Email", category: "communications", phosphor: "EnvelopeSimple", emoji: "✉️", tone: "#10b981" },
  { key: "whatsapp", label: "WhatsApp", category: "communications", phosphor: "WhatsappLogo", emoji: "💬", tone: "#25d366" },
  { key: "calendar", label: "Calendar", category: "actions", phosphor: "CalendarBlank", emoji: "📅", tone: "#3b82f6" },
  { key: "tasks", label: "Tasks", category: "tasks", phosphor: "ListChecks", emoji: "📋", tone: "#14b8a6" },
  { key: "reminders", label: "Reminders", category: "statuses", phosphor: "Bell", emoji: "🔔", tone: "#f59e0b" },
  { key: "chain", label: "Chain", category: "property", phosphor: "LinkSimple", emoji: "🔗", tone: "#0ea5e9" },
  { key: "milestones", label: "Milestones", category: "milestones", phosphor: "Flag", emoji: "🚩", tone: "#f59e0b" },
  { key: "exchange", label: "Exchange", category: "milestones", phosphor: "ArrowsLeftRight", emoji: "🔁", tone: "#f97316" },
  { key: "completion", label: "Completion", category: "milestones", phosphor: "Key", emoji: "🔑", tone: "#eab308" },
  { key: "settings", label: "Settings", category: "settings", phosphor: "GearSix", emoji: "⚙️", tone: "#64748b" },
  { key: "add", label: "Add", category: "actions", phosphor: "Plus", emoji: "➕", tone: "#3b82f6" },
  { key: "edit", label: "Edit", category: "actions", phosphor: "PencilSimple", emoji: "✏️", tone: "#3b82f6" },
  { key: "delete", label: "Remove", category: "actions", phosphor: "Trash", emoji: "🗑️", tone: "#ef4444" },
  { key: "warning", label: "Warning", category: "statuses", phosphor: "Warning", emoji: "⚠️", tone: "#f59e0b" },
  { key: "success", label: "Success", category: "statuses", phosphor: "CheckCircle", emoji: "✅", tone: "#22c55e" },
  { key: "search", label: "Search", category: "actions", phosphor: "MagnifyingGlass", emoji: "🔍", tone: "#3b82f6" },
  { key: "phone", label: "Phone", category: "communications", phosphor: "Phone", emoji: "📞", tone: "#10b981" },
  { key: "people", label: "People", category: "people", phosphor: "UsersThree", emoji: "👥", tone: "#8b5cf6" },
  { key: "money", label: "Money", category: "money", phosphor: "CurrencyGbp", emoji: "💷", tone: "#22c55e" },
];

export const CATEGORY_TONE: Record<string, string> = {
  navigation: "#6366f1", property: "#0ea5e9", people: "#8b5cf6", documents: "#0891b2",
  communications: "#10b981", milestones: "#f59e0b", tasks: "#14b8a6", actions: "#3b82f6",
  statuses: "#ef4444", money: "#22c55e", settings: "#64748b",
};
