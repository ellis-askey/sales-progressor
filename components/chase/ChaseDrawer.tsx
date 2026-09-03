"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { X, EnvelopeSimple, ChatText, Sparkle, PaperPlaneTilt, CircleNotch, CaretDown, CaretUp, Plus, ArrowSquareOut } from "@phosphor-icons/react";
import { defaultRecipient, recipientRoleLabel, isSolicitorRecipient } from "@/lib/services/chase-recipients";
import { createContactAction } from "@/app/actions/contacts";
import { saveSolicitorsAction } from "@/app/actions/transactions";

type Channel = "email" | "whatsapp";
type Tone = "Friendly" | "Professional" | "Polite Yet Firm" | "Chase Up" | "Urgent" | "Final Reminder";

const TONES: Tone[] = ["Friendly", "Professional", "Polite Yet Firm", "Chase Up", "Urgent", "Final Reminder"];

function autoTone(chaseCount: number): Tone {
  const map: Tone[] = ["Friendly", "Professional", "Polite Yet Firm", "Chase Up", "Urgent", "Final Reminder"];
  return map[Math.min(chaseCount - 1, map.length - 1)] ?? "Friendly";
}

// Tone pill colours are a functional scale — must not theme
const TONE_META: Record<Tone, { pill: string; dot: string }> = {
  "Friendly":        { pill: "#dcfce7", dot: "#16a34a" },
  "Professional":    { pill: "#dbeafe", dot: "#2563eb" },
  "Polite Yet Firm": { pill: "#fef9c3", dot: "#ca8a04" },
  "Chase Up":        { pill: "#ffedd5", dot: "#ea580c" },
  "Urgent":          { pill: "#fee2e2", dot: "#dc2626" },
  "Final Reminder":  { pill: "#fecaca", dot: "#991b1b" },
};

const TONE_DISPLAY: Record<Tone, string> = {
  "Friendly":        "Friendly",
  "Professional":    "Professional",
  "Polite Yet Firm": "Polite yet firm",
  "Chase Up":        "Chase up",
  "Urgent":          "Urgent",
  "Final Reminder":  "Final reminder",
};

interface MilestoneRef {
  chaseTaskId: string;
  name: string;
  chaseCount: number;
}

interface Contact {
  id: string;
  name: string;
  roleType: string;
  email?: string | null;
  phone?: string | null;
  // Set on injected solicitor recipients (see lib/services/chase-recipients.ts).
  // Client contacts arrive without these.
  side?: "vendor" | "purchaser" | null;
  secondaryEmail?: string | null; // solicitor assistant address, auto-CC'd
  firmName?: string | null;       // solicitor firm, for the recipient label
}

interface ChaseDrawerProps {
  chaseTaskId: string;
  transactionId: string;
  propertyAddress: string;
  milestoneName: string;
  chaseCount: number;
  contacts: Contact[];
  milestones?: MilestoneRef[];
  // Default role for the empty-state "add a contact" form, set to the chase's
  // side when the caller knows it (single-side row/early chase). Chase-all leaves
  // it unset and the form defaults to Vendor.
  defaultAddRole?: "vendor" | "purchaser";
  onClose: () => void;
  onSent: () => void;
}

type SendResult = { ok: boolean; emailSent?: boolean; error?: string };

function TonePill({ tone }: { tone: Tone }) {
  const { pill, dot } = TONE_META[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
      background: pill, color: "#1a1a1a",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      {TONE_DISPLAY[tone]}
    </span>
  );
}

function initials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

// "a" / "a and b" / "a, b and c" — for the signature-completion nudge.
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function ChaseDrawer({
  chaseTaskId,
  transactionId,
  propertyAddress,
  milestoneName,
  chaseCount,
  contacts: contactsProp,
  milestones,
  defaultAddRole,
  onClose,
  onSent,
}: ChaseDrawerProps) {
  const isMulti = Array.isArray(milestones) && milestones.length > 1;
  const effectiveChaseCount = isMulti
    ? Math.max(...milestones!.map((m) => m.chaseCount))
    : chaseCount;
  const nextChaseNumber = effectiveChaseCount + 1;

  // Contacts added inline via the empty-state "add a contact" form, merged on top
  // of the caller's list so a freshly-added recipient is immediately selectable
  // without leaving the drawer.
  const [addedContacts, setAddedContacts] = useState<Contact[]>([]);
  // Dedupe by id: once the server action's revalidation lands, the new contact
  // also arrives via contactsProp, so drop any local copy already present.
  const contacts = (() => {
    const seen = new Set(contactsProp.map((c) => c.id));
    return [...contactsProp, ...addedContacts.filter((c) => !seen.has(c.id))];
  })();

  // Inline add-party form (only shown when there's no one to send to). Option A:
  // choose WHO first, the right fields follow. People (seller/buyer/broker) are
  // Contact rows; a solicitor is a firm + handler in its own table with a side.
  const [showAddForm, setShowAddForm] = useState(false);
  const [addParty, setAddParty] = useState<"seller" | "buyer" | "broker" | "solicitor">(
    defaultAddRole === "purchaser" ? "buyer" : "seller",
  );
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  // Solicitor light-create fields
  const [solSide, setSolSide] = useState<"vendor" | "purchaser">(defaultAddRole ?? "vendor");
  const [solFirm, setSolFirm] = useState("");
  const [solHandler, setSolHandler] = useState("");
  const [solEmail, setSolEmail] = useState("");
  const [solPhone, setSolPhone] = useState("");
  const [solSecondary, setSolSecondary] = useState("");
  const [solMore, setSolMore] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Recipient candidates = any contact we can reach. Contacts arrive already
  // scoped to the chase's side by the caller, with that side's solicitor injected
  // (see lib/services/chase-recipients.ts). The "To" selector drives the whole
  // send: who it goes to, which channels are available, and the CC.
  const recipientCandidates = contacts.filter((c) => c.email || c.phone);
  const initialRecipient = defaultRecipient(contacts);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(initialRecipient?.id ?? null);
  const selectedRecipient =
    recipientCandidates.find((c) => c.id === selectedRecipientId) ?? initialRecipient;
  const recipientIsSolicitor = selectedRecipient ? isSolicitorRecipient(selectedRecipient) : false;

  // Same-side solicitor available to CC when a CLIENT is the recipient. Excludes
  // whoever is already the primary recipient. This is the real SolicitorContact
  // (FK-sourced) — the old contacts.find(roleType==="solicitor") was dead on real
  // files because solicitors aren't Contact rows.
  const ccSolicitorContact =
    contacts.find((c) => c.roleType === "solicitor" && c.email && c.id !== selectedRecipient?.id) ?? null;

  // Display contact in header property card — mirrors the selected recipient.
  const displayContact = selectedRecipient ?? contacts[0] ?? null;

  const { theme } = usePortalTheme();

  const [channel, setChannel] = useState<Channel>("email");
  const [tone, setTone] = useState<Tone>(autoTone(nextChaseNumber));
  const [toneMenuOpen, setToneMenuOpen] = useState(false);
  const [toneMenuClosing, setToneMenuClosing] = useState(false);
  const [toneMenuPos, setToneMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const toneMenuRef = useRef<HTMLDivElement>(null);

  function closeToneMenu() { setToneMenuClosing(true); setToneMenuOpen(false); }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (toneMenuRef.current && !toneMenuRef.current.contains(e.target as Node)) closeToneMenu();
    }
    function handleScroll() { closeToneMenu(); }
    if (toneMenuOpen) {
      document.addEventListener("mousedown", handle);
      window.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [toneMenuOpen]);
  // "To" recipient menu (portal dropdown, mirrors the Tone menu pattern below).
  const [toMenuOpen, setToMenuOpen] = useState(false);
  const [toMenuClosing, setToMenuClosing] = useState(false);
  const [toMenuPos, setToMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const toMenuRef = useRef<HTMLDivElement>(null);
  function closeToMenu() { setToMenuClosing(true); setToMenuOpen(false); }
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (toMenuRef.current && !toMenuRef.current.contains(e.target as Node)) closeToMenu();
    }
    function handleScroll() { closeToMenu(); }
    if (toMenuOpen) {
      document.addEventListener("mousedown", handle);
      window.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [toMenuOpen]);

  // Selecting a solicitor forces Email (solicitors are never WhatsApp'd).
  function selectRecipient(id: string) {
    setSelectedRecipientId(id);
    closeToMenu();
    const next = recipientCandidates.find((c) => c.id === id) ?? null;
    if (next && isSolicitorRecipient(next) && channel === "whatsapp") {
      switchChannel("email");
    }
  }

  const [ccOn, setCcOn] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useAgentToast();
  const [generatedContext, setGeneratedContext] = useState<{ primaryContact: { name: string; role: string } | null } | null>(null);

  // White-label sign-off we append when we send it. Fetched once so the agent
  // sees exactly how the email signs off, plus any pieces still to fill in.
  const [signature, setSignature] = useState<{ html: string; missing: string[] } | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => {
      fetch(`/api/chase/signature-preview?transactionId=${transactionId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (active && d) setSignature(d); })
        .catch(() => {});
    };
    load();
    // Refetch when the agent comes back to this tab (e.g. after editing their
    // profile in another tab) so the sign-off updates without a manual refresh.
    const onReturn = () => { if (document.visibilityState !== "hidden") load(); };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      active = false;
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [transactionId]);

  // Channel crossfade — displayChannel lags channel by 120ms so content fades
  // out before swapping. Channel buttons update immediately (driven by channel).
  const [displayChannel, setDisplayChannel] = useState<Channel>("email");
  const [contentFading, setContentFading] = useState(false);

  // Generation-ID ref: incrementing on channel switch invalidates any in-flight
  // AI generation so its result is silently discarded rather than populating
  // the message field for the wrong channel.
  const generationIdRef = useRef(0);

  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  function doClose() {
    if (!closing) {
      setClosing(true);
      closeTimer.current = setTimeout(onClose, 200);
    }
  }

  // Logic (validation/send) uses channel. Rendering of swappable content uses
  // displayChannel so the old content is still visible during fade-out.
  //
  // CC is symmetric and defaults OFF (opt-in): when the solicitor is the
  // recipient you can CC the client(s); when a client is the recipient you can CC
  // this side's solicitor. Either way it's a toggle the agent turns on when
  // needed. The solicitor's own assistant (secondaryEmail) is always CC'd on
  // solicitor sends, independent of the toggle (platform convention).
  const clientCcContacts = contacts.filter(
    (c) => ["vendor", "purchaser", "broker"].includes(c.roleType) && c.email && c.id !== selectedRecipient?.id,
  );
  const ccContacts = recipientIsSolicitor
    ? clientCcContacts
    : (ccSolicitorContact ? [ccSolicitorContact] : []);
  const ccEmails = ccContacts.map((c) => c.email).filter((e): e is string => !!e);
  const ccLabel = recipientIsSolicitor
    ? (clientCcContacts.length === 1 ? clientCcContacts[0].name : `${clientCcContacts.length} clients`)
    : (ccSolicitorContact?.name ?? "");
  const ccRoleWord = recipientIsSolicitor ? "client" : "solicitor";

  const showCcToggle = channel === "email" && ccEmails.length > 0;
  const displayShowCcToggle = displayChannel === "email" && ccEmails.length > 0;
  const assistantCc =
    recipientIsSolicitor && selectedRecipient?.secondaryEmail ? [selectedRecipient.secondaryEmail] : [];
  const effectiveCc = [...assistantCc, ...(showCcToggle && ccOn ? ccEmails : [])];
  // WhatsApp is unavailable for solicitor recipients (email only) and for a
  // recipient with no phone number on file.
  const waAvailable = !recipientIsSolicitor && !!selectedRecipient?.phone;

  // Shared fade style applied to elements that differ between channels
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const swapFade: React.CSSProperties = {
    opacity: contentFading ? 0 : 1,
    transition: prefersReducedMotion ? "none" : "opacity 120ms ease",
  };

  const addInputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10,
    fontSize: 12.5, border: "0.5px solid var(--agent-border-subtle)", outline: "none",
    background: "var(--agent-surface-glass)", color: "var(--agent-text-primary)", fontFamily: "inherit",
  };

  const PARTY_TO_ROLE = { seller: "vendor", buyer: "purchaser", broker: "broker" } as const;

  function resetAddForm() {
    setShowAddForm(false);
    setAddName(""); setAddEmail(""); setAddPhone("");
    setSolFirm(""); setSolHandler(""); setSolEmail(""); setSolPhone(""); setSolSecondary(""); setSolMore(false);
  }

  // Add a party without leaving the drawer, then select them as the recipient.
  // People go through createContactAction; a solicitor branches off to its own
  // firm+handler create (see handleAddSolicitor).
  async function handleAddContact() {
    setAddError(null);
    if (addParty === "solicitor") { await handleAddSolicitor(); return; }
    if (!addName.trim() || (!addEmail.trim() && !addPhone.trim())) {
      setAddError("Add a name and an email or phone.");
      return;
    }
    setAddSaving(true);
    try {
      const created = await createContactAction({
        propertyTransactionId: transactionId,
        name: addName.trim(),
        email: addEmail.trim() || null,
        phone: addPhone.trim() || null,
        roleType: PARTY_TO_ROLE[addParty],
      });
      const c: Contact = {
        id: created.id, name: created.name, roleType: created.roleType,
        email: created.email, phone: created.phone,
      };
      setAddedContacts((prev) => [...prev, c]);
      setSelectedRecipientId(c.id);
      resetAddForm();
      toast.success("Contact added");
    } catch (err) {
      setAddError(
        err instanceof Error && err.message === "DUPLICATE_CONTACT_FIELD"
          ? "That email or phone is already on another contact for this file."
          : "Couldn't add the contact. Try again.",
      );
    } finally {
      setAddSaving(false);
    }
  }

  // Solicitor light-create: find-or-create the firm + handler, attach it to the
  // right side of the file, then select it. Firm + handler + email is the minimum
  // to email them; phone / assistant email are optional extras.
  async function handleAddSolicitor() {
    if (!solFirm.trim() || !solHandler.trim() || !solEmail.trim()) {
      setAddError("Firm, handler name and email are needed to email a solicitor.");
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch("/api/solicitor-firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: solFirm.trim(),
          handler: {
            name: solHandler.trim(),
            email: solEmail.trim(),
            phone: solPhone.trim() || null,
            secondaryEmail: solSecondary.trim() || null,
          },
        }),
      });
      if (!res.ok) { setAddError("Couldn't add the solicitor. Try again."); return; }
      const firm = (await res.json()) as {
        id: string; name: string;
        handlers: Array<{ id: string; name: string; email: string | null; phone: string | null; secondaryEmail: string | null }>;
      };
      const handler =
        firm.handlers.find((h) => h.name.toLowerCase().trim() === solHandler.toLowerCase().trim()) ??
        firm.handlers[firm.handlers.length - 1];
      if (!handler) { setAddError("Couldn't add the solicitor. Try again."); return; }

      await saveSolicitorsAction(
        transactionId,
        solSide === "vendor"
          ? { vendorSolicitorFirmId: firm.id, vendorSolicitorContactId: handler.id }
          : { purchaserSolicitorFirmId: firm.id, purchaserSolicitorContactId: handler.id },
      );

      const c: Contact = {
        id: handler.id, name: handler.name, roleType: "solicitor",
        email: handler.email, phone: handler.phone,
        side: solSide, secondaryEmail: handler.secondaryEmail, firmName: firm.name,
      };
      setAddedContacts((prev) => [...prev, c]);
      setSelectedRecipientId(c.id);
      resetAddForm();
      toast.success("Solicitor added");
    } catch {
      setAddError("Couldn't add the solicitor. Try again.");
    } finally {
      setAddSaving(false);
    }
  }

  // Split a "Subject: …\n\nbody" message into parts (mirrors parseEmailMessage on
  // the server) so the mailto handoff carries a real subject.
  function splitSubjectBody(raw: string): { subject: string | null; body: string } {
    const m = raw.match(/^\s*subject:\s*(.+)(?:\r?\n)([\s\S]*)$/i);
    if (m) return { subject: m[1].trim(), body: m[2].trim() };
    return { subject: null, body: raw.trim() };
  }

  // Open the agent's own mail app with the chase ready to send, and log it as a
  // chase on faith (same trust model as the WhatsApp handoff). For agents who
  // don't want us sending on their behalf, or haven't set up a sending address.
  async function handleOpenInMyEmail(): Promise<void> {
    if (!message.trim() || !selectedRecipient?.email) return;
    setIsSending(true);
    setError(null);
    const wasAiGenerated = generatedText.length > 0;
    const wasEdited = wasAiGenerated && message !== generatedText;
    const contactIds = recipientIsSolicitor || !selectedRecipient ? [] : [selectedRecipient.id];
    const taskIdsToLog = isMulti ? milestones!.map((m) => m.chaseTaskId) : [chaseTaskId];
    try {
      for (const taskId of taskIdsToLog) {
        const commRes = await fetch("/api/comms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId, chaseTaskId: taskId, type: "outbound", method: "email",
            contactIds, content: message,
            generatedText: wasAiGenerated ? generatedText : undefined,
            tone, wasAiGenerated, wasEdited,
          }),
        });
        if (!commRes.ok) {
          const err = await commRes.json();
          setError(err.error ?? "Couldn't log this. Try again");
          setIsSending(false);
          return;
        }
      }
      const { subject, body } = splitSubjectBody(message);
      const subj = subject
        ? (subject.includes(propertyAddress) ? subject : `${subject} (${propertyAddress})`)
        : `Chase: ${propertyAddress}`;
      const params = new URLSearchParams();
      if (effectiveCc.length) params.set("cc", effectiveCc.join(","));
      params.set("subject", subj);
      params.set("body", body);
      const query = params.toString().replace(/\+/g, "%20");
      window.location.href = `mailto:${selectedRecipient.email}?${query}`;
      toast.success("Opened in your email");
      onSent();
      onClose();
    } catch {
      setError("Couldn't open your email. Try again.");
    } finally {
      setIsSending(false);
    }
  }

  function switchChannel(next: Channel) {
    if (next === channel) return;
    setChannel(next);                   // buttons: immediate active-state update
    generationIdRef.current++;          // invalidate any in-flight generation
    setIsGenerating(false);
    setError(null);
    setContentFading(true);
    setTimeout(() => {
      setDisplayChannel(next);          // swap rendered content at midpoint
      setContentFading(false);          // fade back in
    }, 120);
  }

  async function handleGenerate() {
    const genId = ++generationIdRef.current;
    setIsGenerating(true);
    setError(null);
    try {
      // Tell the generator who this is going to so the draft is written for the
      // right recipient (solicitor vs client), while the milestone still drives
      // the chase's purpose. Every chased task belongs to the same file, so the
      // selected recipient always resolves against that transaction.
      const recipientFields = selectedRecipient
        ? { recipientId: selectedRecipient.id, recipientRole: selectedRecipient.roleType }
        : {};
      const body = isMulti
        ? { chaseTaskIds: milestones!.map((m) => m.chaseTaskId), channel, tone, includeCc: showCcToggle && ccOn, ...recipientFields }
        : { chaseTaskId, channel, tone, includeCc: showCcToggle && ccOn, ...recipientFields };
      const res = await fetch("/api/ai/generate-chase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (generationIdRef.current !== genId) return;
      if (res.status === 429) { setError(data.message ?? "Too many requests. Wait a few minutes and try again."); return; }
      if (!res.ok) { setError(data.error ?? "Couldn't generate. Try again"); return; }
      setGeneratedText(data.generated);
      setMessage(data.generated);
      setGeneratedContext(data.context);
    } catch {
      if (generationIdRef.current !== genId) return;
      setError("Something went wrong. Try again.");
    } finally {
      if (generationIdRef.current === genId) setIsGenerating(false);
    }
  }

  async function handleSend(): Promise<void> {
    if (!message.trim()) return;
    if (channel === "email" && !selectedRecipient?.email) {
      setError("No email address on file. Add one to a contact first.");
      return;
    }
    if (channel === "whatsapp" && !selectedRecipient?.phone) {
      setError("No phone number on file for this recipient.");
      return;
    }
    setIsSending(true);
    setError(null);

    const wasAiGenerated = generatedText.length > 0;
    const wasEdited = wasAiGenerated && message !== generatedText;
    // Log against the recipient's Contact row. Solicitor recipients live in a
    // separate table (SolicitorContact) whose ids must never be written into
    // contactIds (see lib/services/comms.ts:708-724), so they log with none.
    const contactIds = recipientIsSolicitor || !selectedRecipient ? [] : [selectedRecipient.id];
    const taskIdsToLog = isMulti ? milestones!.map((m) => m.chaseTaskId) : [chaseTaskId];

    try {
      for (const taskId of taskIdsToLog) {
        const commRes = await fetch("/api/comms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId,
            chaseTaskId: taskId,
            type: "outbound",
            method: channel,
            contactIds,
            content: message,
            generatedText: wasAiGenerated ? generatedText : undefined,
            tone,
            wasAiGenerated,
            wasEdited,
          }),
        });
        if (!commRes.ok) {
          const err = await commRes.json();
          setError(err.error ?? "Couldn't log this. Try again");
          setIsSending(false);
          return;
        }
      }

      if (channel === "email") {
        const recipient = selectedRecipient;
        if (recipient?.email) {
          const emailRes = await fetch("/api/chase/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chaseTaskId,
              transactionId,
              toEmail: recipient.email,
              toName: recipient.name,
              messageText: message,
              ccEmails: effectiveCc,
            }),
          });
          const emailData: SendResult = await emailRes.json();
          if (!emailRes.ok) {
            const msg = emailRes.status === 429
              ? (emailData as { message?: string }).message ?? "Too many emails sent. Wait a few minutes before sending more."
              : `Logged, but the email didn't send: ${emailData.error ?? "unknown error"}`;
            setError(msg);
            onSent();
            onClose();
            return;
          }
        }
      }

      if (channel === "whatsapp") {
        if (selectedRecipient?.phone) {
          const phone = selectedRecipient.phone.replace(/\D/g, "");
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
        }
      }

      // Toast first so it lands in the same beat as the drawer close.
      toast.success("Chase sent");
      onSent();
      onClose();
    } catch {
      setError("Couldn't send. Try again.");
      toast.error("Couldn't send chase. Try again or check the recipient");
    } finally {
      setIsSending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 flex justify-end" data-theme={theme} style={{ zIndex: 1000 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", animation: "agent-backdrop-in 200ms ease both" }}
        onClick={doClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 flex flex-col h-full"
        style={{
          width: "min(440px, 100vw)",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing
            ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards"
            : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isMulti ? `Chase all · ${milestones!.length} steps` : milestoneName}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
              <span>Chase #{nextChaseNumber}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <TonePill tone={tone} />
            </p>
          </div>
          <button onClick={doClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm">
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* ── Property + contact card ─────────────────────────────── */}
        <div style={{ padding: "12px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
          <div style={{
            background: "var(--agent-surface-glass)", border: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)",
            borderRadius: 14, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 2px 12px rgba(var(--agent-coral-rgb), 0.10)",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, rgba(var(--agent-coral-rgb), 0.10), rgba(var(--agent-coral-rgb), 0.04))",
              border: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
            }}>🏠</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                {propertyAddress}
              </p>
              {displayContact && (
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(var(--agent-coral-rgb), 0.10)", border: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "var(--agent-coral-deep)", flexShrink: 0 }}>
                    {initials(displayContact.name)}
                  </span>
                  {displayContact.name}
                  <span style={{ color: "var(--agent-text-tertiary)", textTransform: "capitalize" }}>· {displayContact.roleType}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable config + message area ───────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Recipient selector */}
          <div style={{ padding: "14px 20px 12px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
            <p className="agent-section-label" style={{ margin: "0 0 8px" }}>To</p>
            {recipientCandidates.length <= 1 ? (
              selectedRecipient ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "0.5px solid var(--agent-border-subtle)", background: "var(--agent-surface-glass)" }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: "rgba(var(--agent-coral-rgb), 0.10)", border: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--agent-coral-deep)" }}>{initials(selectedRecipient.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedRecipient.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>{recipientRoleLabel(selectedRecipient)}</p>
                  </div>
                </div>
              ) : !showAddForm ? (
                // Empty state — no one on file to send to. Inline add so the agent
                // never has to leave the drawer to fix it.
                <div className="agent-reveal-in">
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--agent-text-muted)" }}>No one on file to send to yet.</p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", borderRadius: 10, border: "0.5px solid var(--agent-border-subtle)", background: "var(--agent-surface-glass)", color: "var(--agent-text-muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 140ms" }}
                  >
                    <Plus size={14} weight="bold" /> Add someone
                  </button>
                </div>
              ) : (
                // Option A — choose WHO first, the right fields follow.
                <div className="agent-section-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Party chooser */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-tertiary)" }}>People on the sale</p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {([["seller", "Seller"], ["buyer", "Buyer"], ["broker", "Broker"]] as const).map(([p, label]) => {
                          const active = addParty === p;
                          return (
                            <button
                              key={p}
                              onClick={() => { setAddParty(p); setAddError(null); }}
                              style={{
                                flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
                                border: active ? "1.5px solid var(--agent-coral-deep)" : "0.5px solid var(--agent-border-subtle)",
                                background: active ? "rgba(var(--agent-coral-rgb), 0.08)" : "var(--agent-surface-glass)",
                                color: active ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
                                cursor: "pointer", transition: "all 140ms",
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-tertiary)" }}>Professional</p>
                      <button
                        onClick={() => { setAddParty("solicitor"); setAddError(null); }}
                        style={{
                          width: "100%", padding: "8px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
                          border: addParty === "solicitor" ? "1.5px solid var(--agent-coral-deep)" : "0.5px solid var(--agent-border-subtle)",
                          background: addParty === "solicitor" ? "rgba(var(--agent-coral-rgb), 0.08)" : "var(--agent-surface-glass)",
                          color: addParty === "solicitor" ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
                          cursor: "pointer", transition: "all 140ms",
                        }}
                      >
                        Solicitor
                      </button>
                    </div>
                  </div>

                  {/* Fields — keyed on people-vs-solicitor so switching re-runs the reveal */}
                  <div key={addParty === "solicitor" ? "sol" : "person"} className="agent-reveal-in" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {addParty === "solicitor" ? (
                      <>
                        <div style={{ display: "flex", gap: 6 }}>
                          {([["vendor", "Seller’s solicitor"], ["purchaser", "Buyer’s solicitor"]] as const).map(([s, label]) => (
                            <button
                              key={s}
                              onClick={() => setSolSide(s)}
                              style={{
                                flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                                border: solSide === s ? "1.5px solid var(--agent-coral-deep)" : "0.5px solid var(--agent-border-subtle)",
                                background: solSide === s ? "rgba(var(--agent-coral-rgb), 0.08)" : "var(--agent-surface-glass)",
                                color: solSide === s ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
                                cursor: "pointer", transition: "all 140ms",
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <input className="agent-focus" value={solFirm} onChange={(e) => setSolFirm(e.target.value)} placeholder="Firm" style={addInputStyle} />
                        <input className="agent-focus" value={solHandler} onChange={(e) => setSolHandler(e.target.value)} placeholder="Handler name" style={addInputStyle} />
                        <input className="agent-focus" value={solEmail} onChange={(e) => setSolEmail(e.target.value)} placeholder="Email" type="email" style={addInputStyle} />
                        {solMore ? (
                          <>
                            <input className="agent-focus" value={solPhone} onChange={(e) => setSolPhone(e.target.value)} placeholder="Phone (optional)" style={addInputStyle} />
                            <input className="agent-focus" value={solSecondary} onChange={(e) => setSolSecondary(e.target.value)} placeholder="Assistant email (optional)" type="email" style={addInputStyle} />
                          </>
                        ) : (
                          <button onClick={() => setSolMore(true)} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, fontSize: 11, color: "var(--agent-coral-deep)", cursor: "pointer", fontWeight: 600 }}>
                            + Phone, assistant email
                          </button>
                        )}
                        <p style={{ margin: 0, fontSize: 10.5, color: "var(--agent-text-tertiary)" }}>Solicitors are emailed. We’ll add them to this file.</p>
                      </>
                    ) : (
                      <>
                        <input className="agent-focus" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name" style={addInputStyle} />
                        <input className="agent-focus" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Email" type="email" style={addInputStyle} />
                        <input className="agent-focus" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="Phone (optional)" style={addInputStyle} />
                      </>
                    )}
                  </div>

                  {addError && (
                    <p style={{ margin: 0, fontSize: 11, color: "#dc2626" }}>{addError}</p>
                  )}
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => { resetAddForm(); setAddError(null); }}
                      style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "0.5px solid var(--agent-border-subtle)", background: "var(--agent-surface-glass)", color: "var(--agent-text-muted)", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddContact}
                      disabled={addSaving}
                      style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: addSaving ? "rgba(var(--agent-coral-rgb), 0.4)" : "linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))", color: "white", cursor: addSaving ? "not-allowed" : "pointer" }}
                    >
                      {addSaving ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div style={{ position: "relative" }} ref={toMenuRef}>
                <button
                  onClick={() => {
                    if (!toMenuOpen && !toMenuClosing && toMenuRef.current) {
                      const r = toMenuRef.current.getBoundingClientRect();
                      setToMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
                    }
                    if (toMenuOpen) { closeToMenu(); } else { setToMenuClosing(false); setToMenuOpen(true); }
                  }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderRadius: 10, border: "0.5px solid var(--agent-border-subtle)", background: "var(--agent-surface-glass)", cursor: "pointer", transition: "border-color 140ms" }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: "rgba(var(--agent-coral-rgb), 0.10)", border: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--agent-coral-deep)" }}>{selectedRecipient ? initials(selectedRecipient.name) : "?"}</span>
                    <span style={{ minWidth: 0, textAlign: "left" }}>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedRecipient?.name ?? "Choose recipient"}</span>
                      <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)" }}>{selectedRecipient ? recipientRoleLabel(selectedRecipient) : ""}</span>
                    </span>
                  </span>
                  <span style={{ color: "var(--agent-text-muted)", display: "flex", flexShrink: 0 }}>
                    {toMenuOpen ? <CaretUp size={13} /> : <CaretDown size={13} />}
                  </span>
                </button>
                {(toMenuOpen || toMenuClosing) && toMenuPos && typeof document !== "undefined" && createPortal(
                  <div
                    data-theme={theme}
                    className={toMenuClosing ? "agent-dropdown-out" : "agent-dropdown-in"}
                    onAnimationEnd={() => { if (toMenuClosing) setToMenuClosing(false); }}
                    style={{ position: "fixed", top: toMenuPos.top, left: toMenuPos.left, width: toMenuPos.width, zIndex: 9999, background: "var(--agent-surface-elevated)", backdropFilter: "blur(20px)", borderRadius: 12, border: "0.5px solid var(--agent-border-subtle)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden" }}
                  >
                    {recipientCandidates.map((c) => {
                      const sol = isSolicitorRecipient(c);
                      return (
                        <button
                          key={c.id}
                          onClick={() => selectRecipient(c.id)}
                          style={{ width: "100%", textAlign: "left", padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, background: selectedRecipientId === c.id ? "rgba(var(--agent-coral-rgb), 0.10)" : "transparent", border: "none", cursor: "pointer", transition: "background 100ms" }}
                        >
                          <span style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: sol ? "rgba(37,99,235,0.10)" : "rgba(var(--agent-coral-rgb), 0.10)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: sol ? "#2563eb" : "var(--agent-coral-deep)" }}>{initials(c.name)}</span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                            <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)" }}>{recipientRoleLabel(c)}{sol ? " · email only" : ""}</span>
                          </span>
                          {selectedRecipientId === c.id && <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--agent-coral-deep)" }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>,
                  document.body
                )}
              </div>
            )}
          </div>

          {/* Channel selector */}
          <div style={{ padding: "14px 20px 12px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
            <p className="agent-section-label" style={{ margin: "0 0 8px" }}>Send via</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {/* Email tab */}
              <button
                onClick={() => switchChannel("email")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                  border: channel === "email" ? "1.5px solid var(--agent-coral-deep)" : "0.5px solid var(--agent-border-subtle)",
                  background: channel === "email" ? "linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))" : "var(--agent-surface-glass)",
                  color: channel === "email" ? "white" : "var(--agent-text-muted)",
                  cursor: "pointer", transition: "all 150ms",
                  boxShadow: channel === "email" ? "0 4px 16px rgba(var(--agent-coral-rgb), 0.28)" : "none",
                }}
              >
                <EnvelopeSimple size={15} weight={channel === "email" ? "fill" : "regular"} /> Email
              </button>
              {/* WhatsApp tab — semantic green, must not theme. Disabled for
                  solicitor recipients (email only) and recipients with no phone. */}
              <button
                onClick={() => { if (waAvailable) switchChannel("whatsapp"); }}
                disabled={!waAvailable}
                title={recipientIsSolicitor ? "Solicitors are emailed" : (!selectedRecipient?.phone ? "No phone number on file" : undefined)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                  border: channel === "whatsapp" ? "1.5px solid #22c55e" : "0.5px solid var(--agent-border-subtle)",
                  background: channel === "whatsapp" ? "linear-gradient(135deg, #22c55e, #4ade80)" : "var(--agent-surface-glass)",
                  color: channel === "whatsapp" ? "white" : "var(--agent-text-muted)",
                  cursor: waAvailable ? "pointer" : "not-allowed",
                  opacity: waAvailable ? 1 : 0.5,
                  transition: "all 150ms",
                  boxShadow: channel === "whatsapp" ? "0 4px 16px rgba(34,197,94,0.25)" : "none",
                }}
              >
                <ChatText size={15} weight={channel === "whatsapp" ? "fill" : "regular"} /> WhatsApp
              </button>
            </div>

            {/* Why WhatsApp is off — only when a solicitor is the recipient */}
            {recipientIsSolicitor && (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
                Solicitors are emailed, so WhatsApp is off for this recipient.
              </p>
            )}

            {/* CC toggle — fades with channel swap; uses displayShowCcToggle so
                old content is still visible during the 120ms fade-out */}
            {displayShowCcToggle && (
              <button
                onClick={() => setCcOn((v) => !v)}
                style={{
                  ...swapFade,
                  marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 10,
                  border: ccOn ? "0.5px solid rgba(var(--agent-coral-rgb), 0.18)" : "0.5px solid var(--agent-border-subtle)",
                  background: ccOn ? "rgba(var(--agent-coral-rgb), 0.05)" : "var(--agent-surface-glass)",
                  cursor: "pointer", transition: "all 140ms",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: ccOn ? "var(--agent-coral-deep)" : "var(--agent-text-muted)" }}>
                  CC {ccLabel} <span style={{ fontWeight: 400, opacity: 0.7 }}>({ccRoleWord})</span>
                </span>
                <span style={{
                  width: 34, height: 18, borderRadius: 9, display: "flex", alignItems: "center",
                  background: ccOn ? "var(--agent-coral-deep)" : "var(--agent-border-subtle)", transition: "background 140ms", flexShrink: 0,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: "50%", background: "white",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.20)",
                    marginLeft: ccOn ? 16 : 2, transition: "margin-left 140ms",
                  }} />
                </span>
              </button>
            )}

          </div>

          {/* Tone selector */}
          <div style={{ padding: "12px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p className="agent-section-label" style={{ margin: 0 }}>Tone</p>
              <span style={{ fontSize: 10, color: "var(--agent-text-tertiary)" }}>Auto-selected — change if needed</span>
            </div>
            <div style={{ position: "relative" }} ref={toneMenuRef}>
              <button
                onClick={() => {
                  if (!toneMenuOpen && !toneMenuClosing && toneMenuRef.current) {
                    const r = toneMenuRef.current.getBoundingClientRect();
                    setToneMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
                  }
                  if (toneMenuOpen) { closeToneMenu(); } else { setToneMenuClosing(false); setToneMenuOpen(true); }
                }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 10, border: "0.5px solid var(--agent-border-subtle)",
                  background: "var(--agent-surface-glass)", cursor: "pointer", transition: "border-color 140ms",
                }}
              >
                <TonePill tone={tone} />
                <span style={{ color: "var(--agent-text-muted)", display: "flex" }}>
                  {toneMenuOpen ? <CaretUp size={13} /> : <CaretDown size={13} />}
                </span>
              </button>
              {(toneMenuOpen || toneMenuClosing) && toneMenuPos && typeof document !== "undefined" && createPortal(
                <div
                  data-theme={theme}
                  className={toneMenuClosing ? "agent-dropdown-out" : "agent-dropdown-in"}
                  onAnimationEnd={() => { if (toneMenuClosing) setToneMenuClosing(false); }}
                  style={{
                    position: "fixed", top: toneMenuPos.top, left: toneMenuPos.left, width: toneMenuPos.width,
                    zIndex: 9999,
                    background: "var(--agent-surface-elevated)", backdropFilter: "blur(20px)",
                    borderRadius: 12, border: "0.5px solid var(--agent-border-subtle)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden",
                  }}
                >
                  {TONES.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTone(t); closeToneMenu(); }}
                      style={{
                        width: "100%", textAlign: "left", padding: "9px 12px",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: tone === t ? "rgba(var(--agent-coral-rgb), 0.10)" : "transparent",
                        border: "none", cursor: "pointer", transition: "background 100ms",
                      }}
                    >
                      <TonePill tone={t} />
                      {t === autoTone(nextChaseNumber) && (
                        <span style={{ fontSize: 10, color: "var(--agent-text-tertiary)" }}>Recommended</span>
                      )}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Message area */}
          <div style={{ flex: 1, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "11px 0", borderRadius: 12,
                background: isGenerating
                  ? "rgba(var(--agent-coral-rgb), 0.40)"
                  : "linear-gradient(135deg, var(--agent-coral-deep) 0%, var(--agent-coral-light) 100%)",
                border: "none", color: "white", fontSize: 13, fontWeight: 700,
                cursor: isGenerating ? "not-allowed" : "pointer",
                boxShadow: isGenerating ? "none" : "0 4px 20px rgba(var(--agent-coral-rgb), 0.32)",
                transition: "all 160ms", letterSpacing: "0.01em",
              }}
            >
              {isGenerating
                ? <><CircleNotch size={15} className="animate-spin" />Generating…</>
                : <><Sparkle size={15} weight="fill" />Generate message</>}
            </button>

            {generatedContext?.primaryContact && (
              <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center" }}>
                For <span style={{ fontWeight: 600, color: "var(--agent-text-primary)" }}>{generatedContext.primaryContact.name}</span>
                <span style={{ color: "var(--agent-text-tertiary)" }}> ({generatedContext.primaryContact.role})</span>
              </p>
            )}

            {/* agent-focus class handles themed focus ring — replaces inline onFocus/onBlur handlers */}
            <textarea
              className="agent-focus"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={channel === "email" ? "Generate a message or type your own…" : "Generate a WhatsApp message or type your own…"}
              rows={11}
              style={{
                width: "100%", boxSizing: "border-box", resize: "none",
                padding: "12px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                border: "0.5px solid var(--agent-border-subtle)", outline: "none",
                background: "var(--agent-surface-glass)",
                color: "var(--agent-text-primary)",
                fontFamily: "inherit",
                transition: "border-color 140ms",
              }}
            />

            {generatedText && message !== generatedText && message.length > 0 && (
              <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center" }}>Edited</p>
            )}

            {error && (
              <div style={{ background: "#fef2f2", border: "0.5px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
                {error}
              </div>
            )}

            {/* White-label sign-off preview — how the email signs off when we
                send it (the "Open in my email" path uses your own client's
                signature instead). Renders only the fields on file. */}
            {channel === "email" && signature && (
              <div style={{ marginTop: 2 }}>
                <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-tertiary)" }}>How it signs off</p>
                <div
                  style={{ background: "#ffffff", border: "0.5px solid var(--agent-border-subtle)", borderRadius: 10, padding: "12px 14px", overflowX: "auto" }}
                  dangerouslySetInnerHTML={{ __html: signature.html }}
                />
                {(() => {
                  const personal = signature.missing.filter((m) => m !== "agency logo");
                  if (personal.length === 0) return null;
                  return (
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>
                      Add your {formatList(personal)} to finish your signature.{" "}
                      <a href="/agent/account/profile" target="_blank" rel="noreferrer" style={{ color: "var(--agent-coral-deep)", fontWeight: 600 }}>Update profile</a>
                    </p>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Scroll-fade — the compose area is often taller than the drawer, so
              the message box can sit below the fold. This sticky fade dissolves
              the last sliver of content into the footer, cueing "there's more to
              scroll". pointer-events:none so it never blocks the textarea. */}
          <div aria-hidden style={{
            position: "sticky", bottom: 0, height: 30, marginTop: -30, flexShrink: 0,
            background: "linear-gradient(to top, var(--agent-surface-elevated), transparent)",
            pointerEvents: "none",
          }} />
        </div>

        {/* ── Footer / Send ── Design Lab glass v3 (Standard glass) ──── */}
        <div className="glass-v03" style={{
          padding: "14px 20px 18px",
          border: "none",
          borderTop: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)",
        }}>
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
              border: "none", cursor: !message.trim() || isSending ? "not-allowed" : "pointer",
              transition: "all 160ms",
              ...(channel === "whatsapp"
                ? {
                    // WhatsApp green — semantic channel colour, must not theme
                    background: !message.trim() || isSending ? "rgba(34,197,94,0.35)" : "linear-gradient(135deg, #22c55e, #4ade80)",
                    color: "white",
                    boxShadow: !message.trim() || isSending ? "none" : "0 4px 20px rgba(34,197,94,0.28)",
                  }
                : {
                    background: !message.trim() || isSending
                      ? "rgba(var(--agent-coral-rgb), 0.35)"
                      : "linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))",
                    color: "white",
                    boxShadow: !message.trim() || isSending ? "none" : "0 4px 20px rgba(var(--agent-coral-rgb), 0.28)",
                  }),
            }}
          >
            {isSending
              ? <><CircleNotch size={15} className="animate-spin" />Sending…</>
              : <><PaperPlaneTilt size={15} weight="fill" />{channel === "whatsapp" ? "Send via WhatsApp" : "Send chase"}</>}
          </button>

          {/* Second path: hand off to the agent's own mail app. Email channel only.
              Sends from their inbox, logged on faith (same as the WhatsApp handoff). */}
          {channel === "email" && (
            <>
              <button
                onClick={handleOpenInMyEmail}
                disabled={!message.trim() || !selectedRecipient?.email || isSending}
                title="Opens your own email app with this ready to send"
                style={{
                  marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "11px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                  border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)",
                  color: (!message.trim() || !selectedRecipient?.email) ? "var(--agent-text-tertiary)" : "var(--agent-text-primary)",
                  cursor: (!message.trim() || !selectedRecipient?.email || isSending) ? "not-allowed" : "pointer",
                  transition: "all 150ms",
                }}
              >
                <ArrowSquareOut size={15} weight="bold" /> Open in my email
              </button>
              <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--agent-text-tertiary)", textAlign: "center", lineHeight: 1.45 }}>
                Sends from your own inbox. We’ll log it as chased.
              </p>
            </>
          )}

          {/* Recipient / action summary */}
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center", lineHeight: 1.5 }}>
            {channel === "whatsapp"
              ? (selectedRecipient?.phone
                  ? `We'll log this and open WhatsApp to ${selectedRecipient.name}`
                  : "No phone on file for this recipient")
              : (() => {
                  if (!selectedRecipient?.email) return "No email on file. This will be logged, not sent";
                  const ccPart = effectiveCc.length ? ` · CC: ${effectiveCc[0]}` : "";
                  return `To: ${selectedRecipient.email}${ccPart}`;
                })()}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
