"use client";

// The unified "Log an update" surface. One clean screen (redesign 2026-11-10,
// /dev/log-update-v2): write or dictate what happened, pick how it was
// communicated (Note / Call / Email / WhatsApp / More), and for a comm add
// direction + who it was with, then optionally share it to the client portal.
// "Draft client updates" morphs to the AI draft panel. SAME save path as before
// (logCommAction) and the SAME audience logic. This is a UI re-jig, not a
// behaviour change. Desktop = centred modal, tablet/mobile = up-sliding drawer.

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { DraftForEveryonePanel } from "./DraftForEveryonePanel";
import { PasteWhatsAppPanel, type ImportableContact } from "./PasteWhatsAppPanel";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { logCommAction } from "@/app/actions/comms";
import { ContactAvatar } from "@/components/ui/Avatar";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { AnchoredPanel } from "@/components/ui/Popover";
import { useTextareaDictation } from "@/components/dictation/useDictation";
import { extractFirstName } from "@/lib/contacts/displayName";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import { DesignLabDrawer } from "@/components/glass/DesignLabDrawer";
import { GlassLens } from "@/components/glass/GlassLens";
import { useIsFounder } from "@/components/layout/FounderGate";
import type { CommType, CommMethod } from "@prisma/client";

type Contact = { id: string; name: string; roleType: string; phone?: string | null };
type Solicitor = { id: string; name: string; role: string; phone?: string | null };

type Props = {
  transactionId: string;
  contacts: Contact[];
  solicitors?: Solicitor[];
  canPasteChat?: boolean;
  emailConnected?: boolean;
  canMarkPrivate?: boolean;
  compactTrigger?: boolean;
  onOptimisticAdd?: (type: CommType, method: CommMethod | null, content: string, contactIds: string[]) => void;
  // Embedded mode: the host (standalone Add-note launcher) owns the sheet chrome
  // + property search and renders just the head + body.
  embedded?: boolean;
  propertyHeader?: { line1: string; location: string; photoUrl?: string | null };
  onBackToSearch?: () => void;
  onClose?: () => void;
};

type Screen = "form" | "draft" | "whatsapp";
type Method = "note" | "call" | "email" | "whatsapp" | "sms" | "post" | "voicemail";

// Phosphor-ish stroke icon paths (no emoji, no icon imports).
const IC = {
  note: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/><path d="M14 6l3 3"/>',
  phone: '<path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  email: '<path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/>',
  whatsapp: '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><path d="M8.5 8.5c0 4 3 7 7 7"/>',
  sms: '<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/>',
  post: '<path d="M3 7h18v12H3zM3 7l9 6 9-6"/>',
  voicemail: '<circle cx="6.5" cy="13" r="3.5"/><circle cx="17.5" cy="13" r="3.5"/><path d="M6.5 16.5h11"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  sparkle: '<path d="M12 3l1.9 4.7L19 9l-4.3 2.9L15.8 17 12 14.2 8.2 17l1.1-5.1L5 9l5.1-1.3z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7 15h10"/>',
};
function svg(path: string, size = 16, sw = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const METHODS: { key: Method; label: string; icon: string }[] = [
  { key: "note", label: "Note", icon: IC.note },
  { key: "call", label: "Call", icon: IC.phone },
  { key: "email", label: "Email", icon: IC.email },
  { key: "whatsapp", label: "WhatsApp", icon: IC.whatsapp },
];
const MORE: { key: Method; label: string; icon: string }[] = [
  { key: "sms", label: "Text (SMS)", icon: IC.sms },
  { key: "post", label: "Post", icon: IC.post },
  { key: "voicemail", label: "Voicemail", icon: IC.voicemail },
];
const methodWord = (m: Method) => (m === "call" ? "call" : m === "email" ? "email" : m === "whatsapp" ? "WhatsApp" : m === "sms" ? "text" : m === "post" ? "letter" : m === "voicemail" ? "voicemail" : "update");
// Maps the UI method to the CommMethod enum (call → phone, rest 1:1).
const toCommMethod = (m: Method): CommMethod | null => (m === "note" ? null : (m === "call" ? "phone" : m) as CommMethod);

export function LogUpdateModal(props: Props) {
  const { transactionId, contacts, solicitors = [], canPasteChat, canMarkPrivate, compactTrigger, onOptimisticAdd, embedded, propertyHeader, onBackToSearch } = props;

  const { toast } = useAgentToast();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("form");
  const [closing, setClosing] = useState(false);

  // form state
  const [method, setMethod] = useState<Method>("note");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [selected, setSelected] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [share, setShare] = useState(false);
  const [priv, setPriv] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);

  // audience ("who sees this" in the portal), decoupled from participants.
  const [audMode, setAudMode] = useState<"side" | "people">("side");
  const [audSides, setAudSides] = useState<{ seller: boolean; buyer: boolean }>({ seller: false, buyer: true });
  const [audPeople, setAudPeople] = useState<string[]>([]);

  // dictation into the "What happened?" field.
  const taRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useTextareaDictation(taRef, setContent, {
    onError: (k) => toast.error(k === "denied" ? "Microphone access was blocked." : "Dictation isn't supported in this browser."),
  });
  const rec = dictation.status === "listening";
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!rec) return;
    setSecs(0);
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rec]);
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  const moreWrapRef = useRef<HTMLDivElement>(null);
  const whoWrapRef = useRef<HTMLDivElement>(null);

  // ── Design Lab wiring (Ellis only) ──────────────────────────────────────────
  // Tag each surface so the glass Design Lab discovers it and Ellis can design
  // its glass live, then export + bake. No pick → className is "" and the surface
  // is byte-for-byte unchanged. The flask toggle + drawer render ONLY for the
  // founder (useIsFounder is true solely for ellis@thesalesprogressor.co.uk), so
  // nothing design-tool is exposed to any other user, in any environment.
  const showLab = useIsFounder();
  const [labOpen, setLabOpen] = useState(false);
  const gCard = useGlassTag("log-update-card", "Log an update · card");
  const gField = useGlassTag("log-update-field", "Log an update · what-happened field");
  const gMethod = useGlassTag("log-update-method", "Log an update · method pill");
  const gSeg = useGlassTag("log-update-direction", "Log an update · direction segment");
  const gWho = useGlassTag("log-update-who", "Log an update · who selector");
  const gShare = useGlassTag("log-update-share-card", "Log an update · share card");
  const gFooter = useGlassTag("log-update-footer", "Log an update · footer");
  const gSave = useGlassTag("log-update-save", "Log an update · save button");
  const gDraft = useGlassTag("log-update-draft", "Log an update · draft button");
  // Helper: merge a base className with a tag's glass class + data attrs.
  const tagCls = (base: string, t: { className: string }) => (t.className ? `${base} ${t.className}` : base);
  // Lens host style: drop the surface's own background so the page shows through
  // to the lens, and isolate the z-index:-1 lens layer. `positioned` hosts (the
  // centred sheet, the direction segment) keep their own position; static hosts
  // get position:relative so the inset layer anchors to them.
  const lensHost = (lens: boolean, positioned = false): CSSProperties | undefined =>
    lens ? { background: "transparent", isolation: "isolate", ...(positioned ? {} : { position: "relative" }) } : undefined;

  useEffect(() => {
    if (embedded) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, embedded]);

  function openModal() { resetForm(); setScreen("form"); setOpen(true); setClosing(false); }
  function close() { if (embedded) { props.onClose?.(); return; } if (closing) return; setMoreOpen(false); setWhoOpen(false); setClosing(true); }
  function reallyClose() { setOpen(false); setClosing(false); }
  function resetForm() {
    setMethod("note"); setDirection("outbound"); setSelected([]); setContent(""); setShare(false); setPriv(true); setErr(null);
    setAudMode("side"); setAudSides({ seller: false, buyer: true }); setAudPeople([]); setMoreOpen(false); setWhoOpen(false);
  }

  const isNote = method === "note";
  const isComm = !isNote;

  // ── participant / audience side splits (clients + solicitors) ──
  const sellerClients = contacts.filter((c) => c.roleType === "vendor");
  const buyerClients = contacts.filter((c) => c.roleType === "purchaser");
  const otherClients = contacts.filter((c) => c.roleType !== "vendor" && c.roleType !== "purchaser");
  const sellerSols = solicitors.filter((s) => s.role === "Vendor solicitor");
  const buyerSols = solicitors.filter((s) => s.role !== "Vendor solicitor");

  const sellerParticipants: { id: string; name: string; roleType: string }[] = [
    ...sellerClients.map((c) => ({ id: c.id, name: c.name, roleType: c.roleType })),
    ...sellerSols.map((s) => ({ id: s.id, name: s.name, roleType: "solicitor" })),
  ];
  const buyerParticipants: { id: string; name: string; roleType: string }[] = [
    ...buyerClients.map((c) => ({ id: c.id, name: c.name, roleType: c.roleType })),
    ...buyerSols.map((s) => ({ id: s.id, name: s.name, roleType: "solicitor" })),
    ...otherClients.map((c) => ({ id: c.id, name: c.name, roleType: c.roleType })),
  ];

  function sidesOfSelected(): { seller: boolean; buyer: boolean } {
    let seller = false, buyer = false;
    for (const id of selected) {
      if (sellerParticipants.some((c) => c.id === id)) seller = true;
      if (buyerParticipants.some((c) => c.id === id)) buyer = true;
    }
    return { seller, buyer };
  }
  function toggleShare() {
    const next = !share;
    if (next) {
      const d = sidesOfSelected();
      setAudSides(d.seller || d.buyer ? d : { seller: false, buyer: true });
      setAudMode("side"); setAudPeople([]);
    }
    setShare(next);
  }
  function toggleSel(id: string) {
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function saveLog() {
    const text = content.trim();
    if (!text) { setErr("Add a short note of what happened."); return; }
    if (isComm && selected.length === 0) { setErr(`Pick who this ${methodWord(method)} was with.`); return; }
    // Explicit "who sees this" audience, only when sharing a (non-note) comm.
    const audience = isComm && share
      ? (audMode === "people"
          ? audPeople
          : [
              ...(audSides.seller ? sellerClients.map((c) => c.id) : []),
              ...(audSides.buyer ? buyerClients.map((c) => c.id) : []),
            ])
      : [];
    if (isComm && share && audience.length === 0) { setErr("Pick who sees this update."); return; }
    setSaving(true); setErr(null);
    const type: CommType = (isNote ? "internal_note" : direction === "outbound" ? "outbound" : "inbound") as CommType;
    const commMethod = toCommMethod(method);
    try {
      await logCommAction({
        transactionId,
        type,
        method: commMethod,
        contactIds: isNote ? [] : selected,
        content: text,
        visibleToClient: isNote ? false : share,
        sharedWithContactIds: audience,
        businessOnly: isNote && canMarkPrivate ? priv : false,
      });
      onOptimisticAdd?.(type, commMethod, text, isNote ? [] : selected);
      close();
    } catch {
      setErr("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const whatsappContacts: ImportableContact[] = [
    ...contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, roleLabel: c.roleType === "vendor" ? "Vendor" : c.roleType === "purchaser" ? "Purchaser" : "Contact" })),
    ...solicitors.map((s) => ({ id: s.id, name: s.name, phone: s.phone ?? null, roleLabel: s.role })),
  ];

  // ── audience derived state (cross-side heads-up) ──
  const audienceSides = audMode === "side" ? audSides : {
    seller: audPeople.some((id) => sellerClients.some((c) => c.id === id)),
    buyer: audPeople.some((id) => buyerClients.some((c) => c.id === id)),
  };
  const partSides = sidesOfSelected();
  const hasSided = partSides.seller || partSides.buyer;
  const crossSide = hasSided && ((audienceSides.seller && !partSides.seller) || (audienceSides.buyer && !partSides.buyer));
  const audienceEmpty = audMode === "side" ? !audSides.seller && !audSides.buyer : audPeople.length === 0;

  function audienceSummary() {
    if (crossSide) {
      const otherSide = audienceSides.seller && !partSides.seller ? "seller" : "buyer";
      return <>Heads up. This was with the {otherSide === "seller" ? "buyer" : "seller"}, so sharing with the <b>{otherSide}&rsquo;s side</b> shows them a conversation they weren&rsquo;t part of.</>;
    }
    if (audMode === "side") {
      if (audSides.seller && audSides.buyer) return <><b>Both sides</b> will see this in their portal.</>;
      if (audSides.seller) return <>Only the <b>seller&rsquo;s side</b> will see this.</>;
      if (audSides.buyer) return <>Only the <b>buyer&rsquo;s side</b> will see this.</>;
      return <>Pick who sees this, or turn sharing off.</>;
    }
    const names = [...sellerClients, ...buyerClients].filter((c) => audPeople.includes(c.id)).map((c) => extractFirstName(c.name));
    if (names.length === 0) return <>Tick the people who should see this.</>;
    const joined = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return <><b>{joined}</b> will see this{names.length === 1 ? "" : ", and no one else"}.</>;
  }

  // ── pieces ──
  const selectedParticipants = [...sellerParticipants, ...buyerParticipants].filter((c) => selected.includes(c.id));
  const activeMore = MORE.find((m) => m.key === method);

  function methodBtn(m: { key: Method; label: string; icon: string }, caret?: boolean) {
    const on = caret ? !!activeMore : method === m.key;
    const label = caret && activeMore ? activeMore.label : m.label;
    const icon = caret && activeMore ? activeMore.icon : m.icon;
    return (
      <button type="button" {...gMethod.props} className={tagCls("lu-method" + (on ? " on" : ""), gMethod)} style={lensHost(gMethod.lens)} onClick={() => { if (caret) setMoreOpen((v) => !v); else { setMethod(m.key); setMoreOpen(false); } }}>
        {gMethod.lens && <GlassLens radius={9} />}
        <span dangerouslySetInnerHTML={{ __html: svg(icon, 15) }} />
        {label}
        {caret && <span dangerouslySetInnerHTML={{ __html: svg(IC.chevron, 11, 2.4) }} style={{ opacity: 0.7 }} />}
      </button>
    );
  }

  function pickRow(c: { id: string; name: string; roleType: string }) {
    const on = selected.includes(c.id);
    return (
      <button key={c.id} type="button" className="lu-pickrow" onClick={() => toggleSel(c.id)}>
        <span className={"lu-cbx" + (on ? " on" : "")}>{on && <span dangerouslySetInnerHTML={{ __html: svg(IC.check, 11, 3) }} />}</span>
        <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={26} />
        <span style={{ fontSize: 13 }}>{c.name}</span>
      </button>
    );
  }

  const avatarStack = (people: { id: string; name: string; roleType: string }[], on: boolean) => (
    <span className="lu-avastack">
      {people.slice(0, 3).map((c, i) => (
        <span key={c.id} className="lu-avai" style={{ marginLeft: i ? -8 : 0, zIndex: people.length - i, boxShadow: `0 0 0 2px ${on ? "rgba(255,255,255,.9)" : "var(--agent-surface-elevated)"}` }}>
          <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={24} />
        </span>
      ))}
    </span>
  );
  const sideCard = (side: "seller" | "buyer", people: Contact[]) => {
    const on = audSides[side];
    return (
      <button type="button" {...gShare.props} className={tagCls("lu-sidecard lu-" + side + (on ? " on" : ""), gShare)} style={lensHost(gShare.lens)} onClick={() => setAudSides((s) => ({ ...s, [side]: !s[side] }))}>
        {gShare.lens && <GlassLens radius={12} />}
        <span className="lu-cbx">{on && <span dangerouslySetInnerHTML={{ __html: svg(IC.check, 11, 3) }} />}</span>
        {avatarStack(people.map((c) => ({ id: c.id, name: c.name, roleType: c.roleType })), on)}
        <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: on ? "#fff" : "var(--agent-text-primary)" }}>{side === "seller" ? "Seller’s side" : "Buyer’s side"}</span>
          <span style={{ display: "block", fontSize: 11.5, color: on ? "rgba(255,255,255,.82)" : "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{people.map((c) => extractFirstName(c.name)).join(" and ")}</span>
        </span>
      </button>
    );
  };
  const personToggle = (c: Contact, side: "seller" | "buyer") => {
    const on = audPeople.includes(c.id);
    return (
      <button key={c.id} type="button" className={"lu-sidecard lu-" + side + (on ? " on" : "")} style={{ padding: "8px 12px" }} onClick={() => setAudPeople((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}>
        <span className="lu-cbx">{on && <span dangerouslySetInnerHTML={{ __html: svg(IC.check, 11, 3) }} />}</span>
        <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={24} />
        <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 600, color: on ? "#fff" : "var(--agent-text-primary)" }}>{extractFirstName(c.name)}</span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: on ? "rgba(255,255,255,.85)" : "var(--agent-text-muted)" }}>{side === "seller" ? "Seller" : "Buyer"}</span>
      </button>
    );
  };

  const header = propertyHeader ?? null;

  // ── head + body (shared by standalone sheet + embedded host) ──
  const headBody = (
    <>
      <div className="lu-head">
        {embedded && screen === "form" && onBackToSearch ? (
          <button className="lu-ic" onClick={onBackToSearch} aria-label="Back to property search" dangerouslySetInnerHTML={{ __html: svg(IC.back, 16, 2.2) }} />
        ) : screen !== "form" ? (
          <button className="lu-ic" onClick={() => setScreen("form")} aria-label="Back" dangerouslySetInnerHTML={{ __html: svg(IC.back, 16, 2.2) }} />
        ) : null}
        <h2 className="lu-title">{screen === "draft" ? "Draft an update" : screen === "whatsapp" ? "Paste a WhatsApp chat" : "Log an update"}</h2>
        {showLab && (
          <button type="button" className="lu-ic" onClick={() => setLabOpen(true)} aria-label="Open Design Lab" title="Design Lab (local only)" style={{ color: "#5b8cff" }} dangerouslySetInnerHTML={{ __html: svg(IC.flask, 15, 1.9) }} />
        )}
        <button className="lu-ic lu-ic-x" onClick={close} aria-label="Close" dangerouslySetInnerHTML={{ __html: svg(IC.x, 15, 2.2) }} />
      </div>

      <div className="lu-body">
        {screen === "draft" && <DraftForEveryonePanel transactionId={transactionId} contacts={contacts} onClose={close} />}
        {screen === "whatsapp" && <PasteWhatsAppPanel transactionId={transactionId} contacts={whatsappContacts} onClose={() => setScreen("form")} />}

        {screen === "form" && (
          <div className="lu-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {header && (
              <button type="button" className="lu-prophead" onClick={onBackToSearch} title={onBackToSearch ? "Change property" : undefined} style={onBackToSearch ? undefined : { cursor: "default" }}>
                <PropertyThumb photoUrl={header.photoUrl ?? null} size={34} />
                <span className="lu-ph-addr">
                  <span className="lu-ph-l1">{header.line1}</span>
                  {header.location && <span className="lu-ph-l2">{header.location}</span>}
                </span>
                {onBackToSearch && <span className="lu-ph-x" dangerouslySetInnerHTML={{ __html: svg(IC.x, 13, 2.2) }} />}
              </button>
            )}

            {/* what happened */}
            <div>
              <div className="lu-lab">What happened?</div>
              <div {...gField.props} className={tagCls("lu-field" + (rec ? " rec" : ""), gField)} style={lensHost(gField.lens)}>
                {gField.lens && <GlassLens radius={11} />}
                <textarea ref={taRef} className="lu-ta" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add an update, or tap the microphone to dictate…" rows={3} />
                <div className="lu-micwrap">
                  {rec && (
                    <span className="lu-rectag">
                      <span className="lu-wave">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.11}s` }} />)}</span>
                      Recording… {mmss}
                    </span>
                  )}
                  {dictation.status !== "unsupported" && (
                    <button type="button" className={"lu-mic" + (rec ? " on" : "")} onClick={() => dictation.toggle()} aria-label={rec ? "Stop recording" : "Dictate"} dangerouslySetInnerHTML={{ __html: svg(rec ? IC.stop : IC.mic, rec ? 14 : 16, 1.9) }} />
                  )}
                </div>
              </div>
            </div>

            {/* how communicated */}
            <div>
              <div className="lu-lab">How was it communicated?</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {METHODS.map((m) => <span key={m.key}>{methodBtn(m)}</span>)}
                <div ref={moreWrapRef} style={{ position: "relative" }}>
                  {methodBtn({ key: "note", label: "More", icon: IC.more }, true)}
                  <AnchoredPanel anchorRef={moreWrapRef} open={moreOpen} onClose={() => setMoreOpen(false)} placement="bottom-end" width={200} bare zIndex={1600}>
                    {MORE.map((m) => (
                      <button key={m.key} type="button" className="ui-pop-pick" style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={() => { setMethod(m.key); setMoreOpen(false); }}>
                        <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: svg(m.icon, 16) }} />
                        {m.label}
                      </button>
                    ))}
                    {/* Paste-a-WhatsApp-chat lives in here now rather than standing
                        out at the bottom of the modal — a quieter home for a
                        power-user shortcut. */}
                    {canPasteChat && (
                      <>
                        <div style={{ height: 1, background: "var(--agent-border-subtle, rgba(45,24,16,0.09))", margin: "4px 0" }} aria-hidden />
                        <button type="button" className="ui-pop-pick" style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={() => { setScreen("whatsapp"); setMoreOpen(false); }}>
                          <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: svg(IC.whatsapp, 16) }} />
                          Paste a WhatsApp chat
                        </button>
                      </>
                    )}
                  </AnchoredPanel>
                </div>
              </div>
            </div>

            {/* comm: direction + who */}
            {isComm && (
              <div className="lu-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div className="lu-lab">Direction</div>
                  <DirectionSeg value={direction} onChange={setDirection} tagClassName={gSeg.className} tagProps={gSeg.props} tagLens={gSeg.lens} />
                </div>
                <div ref={whoWrapRef} style={{ position: "relative" }}>
                  <div className="lu-lab">Who was this {methodWord(method)} with?</div>
                  <button type="button" {...gWho.props} className={tagCls("lu-whotrigger", gWho)} style={lensHost(gWho.lens)} onClick={() => setWhoOpen((v) => !v)}>
                    {gWho.lens && <GlassLens radius={11} />}
                    {selected.length === 0 ? (
                      <span style={{ color: "var(--agent-text-muted)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span className="lu-usericon" dangerouslySetInnerHTML={{ __html: svg(IC.user, 13, 1.7) }} /> Select contact(s)
                      </span>
                    ) : (
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {selectedParticipants.map((c) => (
                          <span key={c.id} className="lu-chip">
                            <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={18} />
                            {extractFirstName(c.name)}
                            <span className="lu-chipx" onClick={(e) => { e.stopPropagation(); toggleSel(c.id); }} dangerouslySetInnerHTML={{ __html: svg(IC.x, 10, 2.4) }} />
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="lu-usericon" dangerouslySetInnerHTML={{ __html: svg(IC.chevron, 13, 2.2) }} />
                  </button>
                  <AnchoredPanel anchorRef={whoWrapRef} open={whoOpen} onClose={() => setWhoOpen(false)} placement="bottom-start" matchWidth bare zIndex={1600}>
                    <div style={{ padding: "4px 6px 2px", overflowY: "auto", maxHeight: 280 }}>
                      {sellerParticipants.length > 0 && (
                        <div style={{ marginBottom: 4 }}><div className="lu-grouplab">Seller&rsquo;s side</div>{sellerParticipants.map(pickRow)}</div>
                      )}
                      {buyerParticipants.length > 0 && (
                        <div style={{ marginBottom: 4 }}><div className="lu-grouplab">Buyer&rsquo;s side</div>{buyerParticipants.map(pickRow)}</div>
                      )}
                      {sellerParticipants.length + buyerParticipants.length === 0 && <p className="lu-empty">No contacts on this file yet.</p>}
                    </div>
                    <div style={{ padding: 8, borderTop: "0.5px solid var(--agent-border-subtle)" }}>
                      <button type="button" className="lu-btn lu-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setWhoOpen(false)}>Done{selected.length ? ` · ${selected.length} selected` : ""}</button>
                    </div>
                  </AnchoredPanel>
                </div>
              </div>
            )}

            {/* share (comm) or private (note) */}
            {isComm ? (
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                  <button type="button" role="switch" aria-checked={share} className={"lu-switch" + (share ? " on" : "")} onClick={toggleShare} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Share with clients</div>
                    <div style={{ fontSize: 12, color: "var(--agent-text-muted)", marginTop: 1 }}>{share ? "Choose who can see this update in their portal." : "Only your team can see this update."}</div>
                  </div>
                </div>
                {share && (
                  <div className="lu-fade" style={{ marginTop: 12 }}>
                    {sellerClients.length > 0 && buyerClients.length > 0 && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                        <button type="button" className="lu-modebtn" onClick={() => setAudMode((m) => (m === "side" ? "people" : "side"))}>{audMode === "side" ? "Pick specific people" : "Back to whole sides"}</button>
                      </div>
                    )}
                    {audMode === "side" ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {sellerClients.length > 0 && sideCard("seller", sellerClients)}
                        {buyerClients.length > 0 && sideCard("buyer", buyerClients)}
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 7 }}>
                        {sellerClients.map((c) => personToggle(c, "seller"))}
                        {buyerClients.map((c) => personToggle(c, "buyer"))}
                      </div>
                    )}
                    <div className={"lu-summaryline" + (crossSide ? " warn" : "") + (audienceEmpty ? " dim" : "")}>{audienceSummary()}</div>
                  </div>
                )}
              </div>
            ) : canMarkPrivate ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <button type="button" role="switch" aria-checked={priv} className={"lu-switch" + (priv ? " on" : "")} onClick={() => setPriv((v) => !v)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Private to your team</div>
                  <div style={{ fontSize: 12, color: "var(--agent-text-muted)", marginTop: 1 }}>{priv ? "Only your progression team can see this note." : "The agency can see this note too."}</div>
                </div>
              </div>
            ) : null}

            {err && <p className="lu-err">{err}</p>}
          </div>
        )}
      </div>

      {screen === "form" && (
        <div {...gFooter.props} className={tagCls("lu-foot", gFooter)} style={lensHost(gFooter.lens)}>
          {gFooter.lens && <GlassLens radius={0} />}
          <button type="button" {...gDraft.props} className={tagCls("lu-btn lu-ghost", gDraft)} style={lensHost(gDraft.lens)} onClick={() => setScreen("draft")}>
            {gDraft.lens && <GlassLens radius={10} />}
            <span dangerouslySetInnerHTML={{ __html: svg(IC.sparkle, 15, 1.9) }} /> Draft client updates
          </button>
          <button type="button" {...gSave.props} className={tagCls("lu-btn lu-primary lu-grow", gSave)} style={lensHost(gSave.lens)} disabled={saving} onClick={saveLog}>{gSave.lens && <GlassLens radius={10} />}{saving ? "Saving…" : "Save update"}</button>
        </div>
      )}

      {showLab && <DesignLabDrawer open={labOpen} onClose={() => setLabOpen(false)} />}
    </>
  );

  if (embedded) return headBody;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lu-launch">
        <button type="button" className={"lu-trigger" + (compactTrigger ? " lu-trigger-sm" : "")} onClick={openModal}>
          <span dangerouslySetInnerHTML={{ __html: svg(IC.sparkle, compactTrigger ? 13 : 16, 2) }} />
          Log an update
        </button>
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div className="lu-ov" role="dialog" aria-modal="true" aria-label="Log an update" data-closing={closing ? "1" : undefined}>
          <div className="lu-bg" onClick={close} />
          <div {...gCard.props} className={tagCls("lu-sheet" + (closing ? " lu-closing" : ""), gCard)} style={lensHost(gCard.lens, true)} onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) reallyClose(); }}>
            {gCard.lens && <GlassLens radius={18} />}
            <div className="lu-grab" />
            {headBody}
          </div>
        </div>,
        // Portal into the agent shell (not document.body) so the sheet stays
        // inside the [data-theme] token scope so var(--agent-*) resolves in both
        // light and dark. On body the tokens are undefined (transparent sheet).
        (typeof document !== "undefined" && (document.querySelector(".agent-shell-root") as HTMLElement | null)) || document.body,
      )}
    </>
  );
}

// Direction segment with a measured sliding thumb.
function DirectionSeg({ value, onChange, tagClassName = "", tagProps, tagLens = false }: { value: "outbound" | "inbound"; onChange: (v: "outbound" | "inbound") => void; tagClassName?: string; tagProps?: Record<string, string>; tagLens?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-v="${value}"]`) as HTMLElement | null;
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);
  return (
    <div ref={ref} {...tagProps} className={tagClassName ? `lu-seg ${tagClassName}` : "lu-seg"} style={{ position: "relative", ...(tagLens ? { background: "transparent", isolation: "isolate" } : null) }}>
      {tagLens && <GlassLens radius={10} />}
      {thumb && <span className="lu-segthumb" style={{ left: thumb.left, width: thumb.width }} />}
      {(["outbound", "inbound"] as const).map((v) => (
        <button key={v} type="button" data-v={v} className={value === v ? "on" : ""} onClick={() => onChange(v)} style={{ position: "relative", zIndex: 1 }}>
          {v === "outbound" ? "Outbound (made)" : "Inbound (received)"}
        </button>
      ))}
    </div>
  );
}

const CSS = `
.lu-ov { position:fixed; inset:0; z-index:1500; font-family:var(--font-geist-sans, -apple-system, system-ui, sans-serif); }
.lu-bg { position:absolute; inset:0; background:rgba(0,0,0,0.38); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); animation:lu-bgf .26s ease both; }
@keyframes lu-bgf { from { opacity:0 } to { opacity:1 } }
.lu-ov[data-closing="1"] .lu-bg { animation:lu-bgout .24s ease both; }
@keyframes lu-bgout { from { opacity:1 } to { opacity:0 } }
.lu-sheet { position:absolute; display:flex; flex-direction:column; overflow:hidden; background:var(--agent-surface-elevated); border:0.5px solid var(--agent-border-default); box-shadow:0 24px 70px -20px rgba(0,0,0,.45); }
.lu-sheet { top:50%; left:50%; width:min(560px, calc(100vw - 40px)); max-height:min(90vh,820px); border-radius:18px; transform:translate(-50%,-48%) scale(.98); opacity:0; animation:lu-in .28s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes lu-in { to { transform:translate(-50%,-50%) scale(1); opacity:1 } }
.lu-sheet.lu-closing { animation:lu-out .22s cubic-bezier(.4,0,1,1) forwards; }
@keyframes lu-out { from { transform:translate(-50%,-50%) scale(1); opacity:1 } to { transform:translate(-50%,-48%) scale(.98); opacity:0 } }
.lu-grab { display:none; }
@media (max-width:1024px) {
  .lu-sheet { top:auto; left:0; right:0; bottom:0; width:100%; max-width:none; max-height:94vh; border-radius:20px 20px 0 0; transform:translateY(100%); opacity:1; animation:lu-up .34s cubic-bezier(.22,1,.36,1) forwards; }
  @keyframes lu-up { to { transform:translateY(0) } }
  .lu-sheet.lu-closing { animation:lu-down .28s cubic-bezier(.4,0,1,1) forwards; }
  @keyframes lu-down { from { transform:translateY(0) } to { transform:translateY(100%) } }
  .lu-grab { display:block; width:40px; height:4px; border-radius:999px; background:var(--agent-border-strong); margin:9px auto 2px; }
}
.lu-head { display:flex; align-items:center; gap:10px; padding:16px 18px 12px; }
.lu-title { font-size:16.5px; font-weight:700; letter-spacing:-.01em; margin:0; flex:1; color:var(--agent-text-primary); }
.lu-ic { width:30px; height:30px; border-radius:999px; border:0.5px solid var(--agent-border-default); background:var(--agent-surface-elevated); display:grid; place-items:center; cursor:pointer; color:var(--agent-text-secondary); flex:0 0 auto; transition:background .14s, color .14s; }
.lu-ic:hover { background:var(--agent-hover-shade); color:var(--agent-text-primary); }
.lu-ic-x svg { transition:transform .2s ease; }
.lu-ic-x:hover svg { transform:rotate(90deg); }
.lu-body { padding:0 18px 18px; overflow-y:auto; }
@media (max-width:1024px) { .lu-body { padding-bottom:calc(18px + env(safe-area-inset-bottom)); } }
.lu-fade { animation:lu-fade .22s cubic-bezier(.22,1,.36,1) both; }
@keyframes lu-fade { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:none } }
.lu-lab { font-size:11.5px; font-weight:600; color:var(--agent-text-secondary); margin-bottom:8px; }

.lu-prophead { display:flex; align-items:center; gap:11px; width:100%; padding:9px 11px; border:0.5px solid var(--agent-border-default); border-radius:12px; background:var(--agent-surface-elevated); font:inherit; text-align:left; transition:border-color .14s; }
.lu-prophead[title]:hover { border-color:var(--agent-coral); }
.lu-ph-addr { flex:1; min-width:0; display:flex; flex-direction:column; }
.lu-ph-l1 { font-size:13.5px; font-weight:650; color:var(--agent-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lu-ph-l2 { font-size:11.5px; color:var(--agent-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lu-ph-x { width:22px; height:22px; border-radius:999px; display:grid; place-items:center; color:var(--agent-text-muted); background:var(--agent-hover-shade); flex:0 0 auto; }

.lu-field { position:relative; border:1px solid var(--agent-border-default); border-radius:11px; background:var(--agent-surface-elevated); transition:border-color .16s, box-shadow .16s; }
.lu-field:focus-within { border-color:var(--agent-coral-deep); }
.lu-field.rec { border-color:var(--agent-coral-deep); box-shadow:0 0 0 3px rgba(var(--agent-coral-rgb),.12); }
.lu-ta { width:100%; box-sizing:border-box; border:0; background:transparent; resize:vertical; padding:11px 48px 11px 13px; font:inherit; font-size:14px; line-height:1.55; color:var(--agent-text-primary); outline:none; min-height:74px; }
.lu-ta::placeholder { color:var(--agent-text-muted); }
.lu-micwrap { position:absolute; right:9px; bottom:9px; display:flex; align-items:center; gap:8px; pointer-events:none; }
.lu-micwrap > * { pointer-events:auto; }
.lu-rectag { display:inline-flex; align-items:center; gap:7px; font-size:11.5px; font-weight:600; color:var(--agent-coral-deep); }
.lu-wave { display:inline-flex; align-items:center; gap:2px; height:15px; }
.lu-wave span { width:2.5px; height:28%; border-radius:999px; background:var(--agent-coral-deep); animation:lu-wav .9s ease-in-out infinite; }
@keyframes lu-wav { 0%,100%{height:28%} 50%{height:100%} }
.lu-mic { width:32px; height:32px; border-radius:999px; display:grid; place-items:center; cursor:pointer; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated); color:var(--agent-text-secondary); transition:all .15s; }
.lu-mic:hover { border-color:var(--agent-coral); color:var(--agent-coral-deep); }
.lu-mic.on { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); color:#fff; }

.lu-method { display:inline-flex; align-items:center; gap:6px; font:inherit; font-size:12.5px; font-weight:600; padding:7px 12px; border-radius:9px; cursor:pointer; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated); color:var(--agent-text-secondary); transition:all .15s; }
.lu-method:hover { border-color:var(--agent-coral); color:var(--agent-text-primary); }
.lu-method.on { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); color:#fff; box-shadow:0 2px 8px rgba(var(--agent-coral-rgb),.28); }

.lu-seg { display:inline-flex; gap:3px; padding:3px; border-radius:10px; background:var(--agent-surface-nested, rgba(15,23,42,.05)); border:1px solid var(--agent-border-subtle); }
.lu-seg button { border:0; background:transparent; font:inherit; font-size:12.5px; font-weight:600; color:var(--agent-text-muted); padding:6px 13px; border-radius:7px; cursor:pointer; transition:color .15s; }
.lu-seg button.on { color:#fff; }
.lu-seg button:hover:not(.on) { color:var(--agent-text-primary); }
.lu-segthumb { position:absolute; top:3px; bottom:3px; border-radius:7px; background:var(--agent-coral-deep); box-shadow:0 1px 3px rgba(var(--agent-coral-rgb),.3); transition:left .24s cubic-bezier(.4,0,.2,1), width .24s cubic-bezier(.4,0,.2,1); z-index:0; }

.lu-whotrigger { display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; min-height:42px; padding:7px 11px; border-radius:11px; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated); font:inherit; font-size:13px; cursor:pointer; text-align:left; transition:border-color .15s; }
.lu-whotrigger:hover { border-color:var(--agent-coral); }
.lu-usericon { display:inline-flex; color:var(--agent-text-muted); flex:0 0 auto; }
.lu-chip { display:inline-flex; align-items:center; gap:6px; padding:3px 7px 3px 4px; border-radius:999px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); font-size:12.5px; font-weight:600; color:var(--agent-text-primary); }
.lu-chipx { display:inline-flex; width:16px; height:16px; border-radius:999px; align-items:center; justify-content:center; color:var(--agent-text-muted); }
.lu-chipx:hover { background:var(--agent-hover-shade); color:var(--agent-text-primary); }

.lu-grouplab { font-size:11.5px; font-weight:650; color:var(--agent-text-muted); padding:7px 8px 4px; }
.lu-empty { padding:14px 10px; font-size:12.5px; color:var(--agent-text-muted); }
.lu-pickrow { display:flex; align-items:center; gap:10px; width:100%; padding:7px 8px; border:0; border-radius:9px; background:transparent; font:inherit; cursor:pointer; text-align:left; transition:background .12s; }
.lu-pickrow:hover { background:var(--agent-hover-shade); }
.lu-cbx { width:19px; height:19px; border-radius:6px; border:1.5px solid var(--agent-border-strong); display:grid; place-items:center; color:#fff; flex:0 0 auto; transition:all .14s; }
.lu-cbx.on { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); }
/* The who-picker renders inside a body-portalled .ui-pop, which is outside the
   shell's --agent-* scope but defines --ui-ink (flipped for dark). Re-point the
   picker rows to --ui-ink so they read correctly in BOTH themes. Sheet-side
   copies of these classes keep their --agent-* tokens (shell scope). */
.ui-pop .lu-grouplab { color:rgba(var(--ui-ink),.55); }
.ui-pop .lu-empty { color:rgba(var(--ui-ink),.5); }
.ui-pop .lu-pickrow { color:rgb(var(--ui-ink)); }
.ui-pop .lu-pickrow:hover { background:rgba(var(--ui-ink),.06); }
.ui-pop .lu-cbx { border-color:rgba(var(--ui-ink),.32); }

.lu-switch { position:relative; width:38px; height:22px; flex:0 0 auto; border-radius:999px; border:0; cursor:pointer; background:var(--agent-border-strong); transition:background .18s; padding:0; margin-top:1px; }
.lu-switch.on { background:var(--agent-coral-deep); }
.lu-switch::after { content:""; position:absolute; top:2.5px; left:2.5px; width:17px; height:17px; border-radius:999px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.25); transition:transform .18s; }
.lu-switch.on::after { transform:translateX(16px); }
.lu-modebtn { font:inherit; font-size:12px; font-weight:600; color:var(--agent-coral-deep); background:none; border:0; cursor:pointer; padding:2px; }
.lu-modebtn:hover { opacity:.72; }

.lu-avastack { display:flex; align-items:center; flex:0 0 auto; }
.lu-avai { position:relative; border-radius:999px; line-height:0; flex:0 0 auto; transition:box-shadow .15s; }
.lu-sidecard { display:flex; align-items:center; gap:11px; width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--agent-border-default); background:transparent; cursor:pointer; font:inherit; transition:border-color .15s, background .15s, box-shadow .15s; }
.lu-sidecard:hover { border-color:var(--agent-coral); }
.lu-sidecard.lu-seller.on { background:linear-gradient(180deg,#2E6DB4,#0C447C); border-color:#0C447C; box-shadow:0 8px 18px -8px rgba(12,68,124,.5); }
.lu-sidecard.lu-buyer.on { background:linear-gradient(180deg,#1E9273,#085041); border-color:#085041; box-shadow:0 8px 18px -8px rgba(8,80,65,.5); }
.lu-sidecard.on .lu-cbx { background:#fff; border-color:#fff; }
.lu-sidecard.lu-seller.on .lu-cbx { color:#0C447C; }
.lu-sidecard.lu-buyer.on .lu-cbx { color:#085041; }
.lu-summaryline { font-size:12.5px; color:var(--agent-text-secondary); line-height:1.45; margin-top:12px; }
.lu-summaryline b { color:var(--agent-text-primary); font-weight:650; }
.lu-summaryline.warn { color:#C0392B; }
.lu-summaryline.warn b { color:#A5281B; }
.lu-summaryline.dim { color:var(--agent-text-muted); }

.lu-err { margin:0; font-size:12.5px; color:#C0392B; }

.lu-foot { display:flex; gap:10px; padding:14px 18px; border-top:0.5px solid var(--agent-border-subtle); background:var(--agent-surface-elevated); }
.lu-btn { display:inline-flex; align-items:center; gap:8px; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; padding:11px 15px; border-radius:10px; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated); color:var(--agent-text-primary); transition:all .14s; }
.lu-btn:hover { border-color:var(--agent-border-strong); }
.lu-ghost svg { color:var(--agent-coral-deep); }
.lu-grow { flex:1; justify-content:center; }
.lu-primary { color:#fff; border-color:transparent; background:linear-gradient(180deg,var(--agent-coral) 0%,var(--agent-coral-deep) 100%); box-shadow:0 2px 0 var(--agent-coral-darker), 0 6px 16px rgba(var(--agent-coral-rgb),.28), inset 0 1px 0 rgba(255,255,255,.3); }
.lu-primary:hover { filter:brightness(1.04); border-color:transparent; }
.lu-primary:disabled { opacity:.55; cursor:not-allowed; filter:none; }

.lu-trigger { display:inline-flex; align-items:center; gap:9px; font:inherit; font-size:14px; font-weight:600; color:#fff; border:0; cursor:pointer; padding:11px 18px; border-radius:12px; background:linear-gradient(180deg,var(--agent-coral) 0%,var(--agent-coral-deep) 100%); box-shadow:0 2px 0 var(--agent-coral-darker), 0 6px 16px rgba(var(--agent-coral-rgb),.30), inset 0 1px 0 rgba(255,255,255,.3); transition:filter .14s, transform .14s; }
.lu-trigger:hover { filter:brightness(1.04); } .lu-trigger:active { transform:translateY(1px); }
.lu-trigger-sm { font-size:12px; padding:6px 12px; border-radius:10px; gap:7px; }
/* Property-search step (standalone Add-note launcher). */
.lu-eyebrow { font-size:10.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--agent-text-muted); margin:4px 0 10px; }
.anb-search { display:flex; align-items:center; gap:9px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:12px; padding:10px 13px; transition:border-color .15s; }
.anb-search:focus-within { border-color:var(--agent-coral-deep); }
.anb-search input { flex:1; border:none; outline:none; background:none; font-family:inherit; font-size:13.5px; color:var(--agent-text-primary); }
.anb-search input:focus-visible { outline:none; }
.anb-results { margin-top:10px; display:flex; flex-direction:column; gap:4px; }
.anb-mi { display:flex; align-items:center; gap:10px; width:100%; padding:8px 10px; border:1px solid transparent; border-radius:10px; background:transparent; font:inherit; text-align:left; cursor:pointer; transition:background .12s, border-color .12s; }
.anb-mi:hover { background:var(--agent-hover-shade); border-color:var(--agent-border-subtle); }
.anb-mi-addr { min-width:0; display:flex; flex-direction:column; }
.anb-mi-l1 { font-size:13px; font-weight:600; color:var(--agent-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.anb-mi-l2 { font-size:11px; color:var(--agent-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.anb-empty { padding:14px 10px; font-size:12.5px; color:var(--agent-text-muted); }
.lu-ov :focus-visible { outline:2px solid var(--agent-coral-deep); outline-offset:2px; }
.lu-ta:focus-visible { outline:none; }
@media (prefers-reduced-motion:reduce) { .lu-ov *, .lu-wave span { animation-duration:.001ms !important; transition-duration:.001ms !important; } }
`;

// Standalone "Add note" launcher injects this so its property-search chrome is
// styled before the embedded LogUpdateModal mounts.
export const LOG_UPDATE_CSS = CSS;
