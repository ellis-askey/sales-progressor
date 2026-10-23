"use client";

// The unified "Log an update" surface (docs/active/log-an-update/SPEC.md). One
// button opens a centred modal (desktop) / up-sliding drawer (tablet+mobile)
// that does everything the old CommsEntry composer did — Draft for everyone,
// log a comm, paste a WhatsApp chat, and add a note — reusing the exact same
// panels + actions. The record → review flow lands in Phase 3; its button is
// deliberately absent until it's real (no dead controls).

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { DraftForEveryonePanel } from "./DraftForEveryonePanel";
import { PasteWhatsAppPanel, type ImportableContact } from "./PasteWhatsAppPanel";
import { VoiceNotePanel } from "./VoiceNotePanel";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { logCommAction } from "@/app/actions/comms";
import { ContactAvatar } from "@/components/ui/Avatar";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { extractFirstName, nameWithoutTitle } from "@/lib/contacts/displayName";
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
  // Smaller trigger for tight homes (Overview card header row, critique #295) —
  // height sits between the full trigger and the segment pills beside it.
  compactTrigger?: boolean;
  onOptimisticAdd?: (type: CommType, method: CommMethod | null, content: string, contactIds: string[]) => void;
  // Embedded mode (critique #275): render only the head + body (no trigger, no
  // own overlay/sheet) so a host — the standalone "Add note" launcher — can own
  // the sheet and morph into this from a property search. The host provides the
  // sheet chrome + the CSS (LOG_UPDATE_CSS).
  embedded?: boolean;
  // Pinned property row at the top (embedded mode), with a control that returns
  // to the host's property search.
  propertyHeader?: { line1: string; location: string; photoUrl?: string | null };
  onBackToSearch?: () => void;
  // Called when the surface should close (embedded mode delegates closing to the
  // host, which animates its own sheet out).
  onClose?: () => void;
};

type Screen = "home" | "draft" | "record" | "whatsapp" | "log" | "note";
type LogChannel = "email" | "phone" | "sms" | "voicemail" | "post";

type LogItem = { key: LogChannel | "note" | "whatsapp"; title: string; sub: string; icon: string };

// Phosphor-ish stroke icon paths (no emoji markers).
const IC = {
  email: '<path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/>',
  phone: '<path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  sms: '<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/>',
  voicemail: '<circle cx="6.5" cy="13" r="3.5"/><circle cx="17.5" cy="13" r="3.5"/><path d="M6.5 16.5h11"/>',
  post: '<path d="M3 7h18v12H3zM3 7l9 6 9-6"/>',
  whatsapp: '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><path d="M8.5 8.5c0 4 3 7 7 7"/>',
  note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  sparkle: '<path d="M12 3l1.9 4.7L19 9l-4.3 2.9L15.8 17 12 14.2 8.2 17l1.1-5.1L5 9l5.1-1.3z"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
};
function svg(path: string, size = 18, sw = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export function LogUpdateModal(props: Props) {
  const { transactionId, contacts, solicitors = [], canPasteChat, emailConnected, canMarkPrivate, compactTrigger, onOptimisticAdd, embedded, propertyHeader, onBackToSearch } = props;

  const { toast } = useAgentToast();
  // Embedded mode is always "open" (the host renders it only when it wants it);
  // its own open/closing machinery is only used for the standalone trigger. It
  // opens on the full "home" menu, same as the file — just morphed in from the
  // host's property search (critique #275).
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [channel, setChannel] = useState<LogChannel>("phone");
  const [moreOpen, setMoreOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // log/note form state
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [selected, setSelected] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [share, setShare] = useState(false);
  const [priv, setPriv] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // "Who sees this" audience (Phase 6c) — decoupled from the participant picker.
  const [audMode, setAudMode] = useState<"side" | "people">("side");
  const [audSides, setAudSides] = useState<{ seller: boolean; buyer: boolean }>({ seller: false, buyer: true });
  const [audPeople, setAudPeople] = useState<string[]>([]);
  const [eyeKey, setEyeKey] = useState(0); // bump to replay the eye flash
  const wasBothRef = useRef(false);

  useEffect(() => {
    // Embedded: the host owns the overlay + Escape handling.
    if (embedded) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, embedded]);

  function openModal() { resetForm(); setScreen("home"); setMoreOpen(false); setClosing(false); setOpen(true); }
  // Animate out (reverse of the entry), then unmount on animationend. Embedded
  // mode delegates to the host's onClose (it animates its own sheet out).
  function close() { if (embedded) { props.onClose?.(); return; } if (closing) return; setMoreOpen(false); setClosing(true); }
  function reallyClose() { setOpen(false); setClosing(false); }
  function goHome() { setMoreOpen(false); setScreen("home"); }
  function resetForm() {
    setDirection("outbound"); setSelected([]); setContent(""); setShare(false); setPriv(true); setErr(null);
    setAudMode("side"); setAudSides({ seller: false, buyer: true }); setAudPeople([]);
  }

  // Which sides the logged participants are on (clients OR solicitors). Drives the
  // default audience and the cross-side warning.
  function sidesOfSelected(): { seller: boolean; buyer: boolean } {
    let seller = false, buyer = false;
    for (const id of selected) {
      if (sellerClients.some((c) => c.id === id) || sellerSols.some((s) => s.id === id)) seller = true;
      if (buyerClients.some((c) => c.id === id) || buyerSols.some((s) => s.id === id)) buyer = true;
    }
    return { seller, buyer };
  }

  // Flicking Share on pre-selects the side(s) the comm was logged with.
  function toggleShare() {
    const next = !share;
    if (next) {
      const d = sidesOfSelected();
      setAudSides(d.seller || d.buyer ? d : { seller: false, buyer: true });
      setAudMode("side"); setAudPeople([]);
    }
    setShare(next);
  }

  const whatsappContacts: ImportableContact[] = [
    ...contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, roleLabel: c.roleType === "vendor" ? "Vendor" : c.roleType === "purchaser" ? "Purchaser" : "Contact" })),
    ...solicitors.map((s) => ({ id: s.id, name: s.name, phone: s.phone ?? null, roleLabel: s.role })),
  ];

  const LOG_ITEMS: LogItem[] = [
    ...(!emailConnected ? ([{ key: "email", title: "Log an email", sub: "One you sent or received", icon: IC.email }] as LogItem[]) : []),
    { key: "phone", title: "Log a call", sub: "A call you made or took", icon: IC.phone },
    { key: "sms", title: "Log a text", sub: "An SMS to a number", icon: IC.sms },
    { key: "note", title: "Add a note", sub: "Just for your team", icon: IC.note },
    { key: "post", title: "Log post", sub: "A letter sent or received", icon: IC.post },
    ...(canPasteChat ? ([{ key: "whatsapp", title: "Paste a WhatsApp chat", sub: "From outside the tracked chat", icon: IC.whatsapp }] as LogItem[]) : []),
    { key: "voicemail", title: "Log a voicemail", sub: "A message you left", icon: IC.voicemail },
  ];

  function pick(key: LogItem["key"]) {
    setMoreOpen(false);
    if (key === "whatsapp") { setScreen("whatsapp"); return; }
    if (key === "note") { resetForm(); setScreen("note"); return; }
    resetForm();
    setChannel(key);
    setScreen("log");
  }

  function toggleSel(id: string) {
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function saveLog(isNote: boolean) {
    const text = content.trim();
    if (!text) { setErr("Add a short note of what was said."); return; }
    if (!isNote && selected.length === 0) { setErr("Pick who this was with."); return; }
    // The explicit "who sees this" audience — only when sharing a (non-note) comm.
    const audience = !isNote && share
      ? (audMode === "people"
          ? audPeople
          : [
              ...(audSides.seller ? sellerClients.map((c) => c.id) : []),
              ...(audSides.buyer ? buyerClients.map((c) => c.id) : []),
            ])
      : [];
    if (!isNote && share && audience.length === 0) { setErr("Pick who sees this update."); return; }
    setSaving(true); setErr(null);
    const type: CommType = (isNote ? "internal_note" : direction === "outbound" ? "outbound" : "inbound") as CommType;
    const method: CommMethod | null = isNote ? null : (channel as CommMethod);
    try {
      await logCommAction({
        transactionId,
        type,
        method,
        contactIds: isNote ? [] : selected,
        content: text,
        visibleToClient: isNote ? false : share,
        sharedWithContactIds: audience,
        businessOnly: isNote && canMarkPrivate ? priv : false,
      });
      onOptimisticAdd?.(type, method, text, isNote ? [] : selected);
      close();
    } catch {
      setErr("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const titles: Record<Screen, string> = { home: "Log an update", draft: "Updates for each side", record: "Record a note", whatsapp: "Paste a WhatsApp chat", log: titleForChannel(channel), note: "Add a note" };

  function finishVoice(s: { milestones: number; todos: number; sends: number; enquiry: boolean }) {
    close();
    const bits: string[] = [];
    if (s.sends) bits.push(`sent ${s.sends} update${s.sends === 1 ? "" : "s"}`);
    const fileCount = s.milestones + s.todos + (s.enquiry ? 1 : 0);
    if (fileCount) bits.push(`made ${fileCount} change${fileCount === 1 ? "" : "s"} to the file`);
    const sentence = bits.join(", ").replace(/^./, (c) => c.toUpperCase());
    toast.success(bits.length ? `${sentence}.` : "Saved to the file.");
  }

  const clients = contacts;

  // Phase 4 — recipient layout: seller's side left, buyer's side right.
  // Solicitors split the same way (anything not a vendor solicitor sits on the
  // buyer side, matching the existing sideTint convention). Contacts that are
  // neither vendor nor purchaser fall into a full-width "other" group so no one
  // is ever dropped from the picker.
  const sellerClients = clients.filter((c) => c.roleType === "vendor");
  const buyerClients = clients.filter((c) => c.roleType === "purchaser");
  const otherClients = clients.filter((c) => c.roleType !== "vendor" && c.roleType !== "purchaser");
  const sellerSols = solicitors.filter((s) => s.role === "Vendor solicitor");
  const buyerSols = solicitors.filter((s) => s.role !== "Vendor solicitor");

  const clientPill = (c: Contact) => (
    <button key={c.id} className="lum-pill" aria-pressed={selected.includes(c.id)} onClick={() => toggleSel(c.id)}>
      <span className="lum-av"><ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={22} /><span className="lum-chk" dangerouslySetInnerHTML={{ __html: svg('<path d="M20 6 9 17l-5-5"/>', 9, 3.2) }} /></span>
      {/* Full name on the participant pills (critique #253) — "Sarah Bennett",
          or "Mrs Harvey" when only a title + surname is on file. */}
      {nameWithoutTitle(c.name)}
    </button>
  );
  const solPill = (s: Solicitor, tint: "vendor" | "purchaser") => (
    <button key={s.id} className="lum-pill" aria-pressed={selected.includes(s.id)} onClick={() => toggleSel(s.id)}>
      <span className="lum-av"><ContactAvatar contact={{ name: s.name, roleType: "solicitor" }} sideTint={tint} size={22} /><span className="lum-chk" dangerouslySetInnerHTML={{ __html: svg('<path d="M20 6 9 17l-5-5"/>', 9, 3.2) }} /></span>
      {s.name}
    </button>
  );

  // ── "Who sees this" derived state ──
  const audienceSides = audMode === "side" ? audSides : {
    seller: audPeople.some((id) => sellerClients.some((c) => c.id === id)),
    buyer: audPeople.some((id) => buyerClients.some((c) => c.id === id)),
  };
  const partSides = sidesOfSelected();
  // Cross-side heads-up only once the comm actually HAS a side — with no
  // participants picked yet, the default audience (buyer) would otherwise claim
  // "this was logged with the seller" before anyone was chosen (critique #252).
  const hasSidedParticipants = partSides.seller || partSides.buyer;
  const crossSide = hasSidedParticipants && ((audienceSides.seller && !partSides.seller) || (audienceSides.buyer && !partSides.buyer));
  const bothSel = audienceSides.seller && audienceSides.buyer;

  useEffect(() => {
    if (bothSel && !crossSide && !wasBothRef.current) setEyeKey((k) => k + 1);
    wasBothRef.current = bothSel && !crossSide;
  }, [bothSel, crossSide]);

  // Stacked per-side avatars — tighter overlap as the count grows.
  const avatarStack = (people: Contact[]) => {
    const ov = people.length <= 2 ? 10 : people.length === 3 ? 14 : 17;
    return (
      <span className="lum-avastack">
        {people.map((c, i) => (
          <span key={c.id} className="lum-avai" style={{ marginLeft: i ? -ov : 0, zIndex: people.length - i }}>
            <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={26} />
          </span>
        ))}
      </span>
    );
  };
  const sideChip = (side: "seller" | "buyer", people: Contact[]) => (
    <button type="button" className={"lum-sidechip lum-" + side + (audSides[side] ? " on" : "")} aria-pressed={audSides[side]} onClick={() => setAudSides((s) => ({ ...s, [side]: !s[side] }))}>
      {avatarStack(people)}
      <span className="lum-sctext">
        <span className="lum-scname">{side === "seller" ? "Seller’s side" : "Buyer’s side"}</span>
        <span className="lum-scsub">{people.map((c) => extractFirstName(c.name)).join(", ")}</span>
      </span>
      <span className="lum-sctick" dangerouslySetInnerHTML={{ __html: svg('<path d="M20 6 9 17l-5-5"/>', 11, 3.4) }} />
    </button>
  );
  const personRow = (c: Contact, side: "seller" | "buyer") => {
    const on = audPeople.includes(c.id);
    return (
      <button key={c.id} type="button" className={"lum-prow lum-" + side + (on ? " on" : "")} aria-pressed={on} onClick={() => setAudPeople((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}>
        <span className="lum-avai"><ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={24} /></span>
        {/* First name only here (critique #253) — matches the side cards above. */}
        <span className="lum-prname">{extractFirstName(c.name)}</span>
        <span className="lum-prside">{side === "seller" ? "Seller" : "Buyer"}</span>
        <span className="lum-sctick" dangerouslySetInnerHTML={{ __html: svg('<path d="M20 6 9 17l-5-5"/>', 10, 3.4) }} />
      </button>
    );
  };
  function audienceSummary() {
    if (crossSide) {
      const otherSide = audienceSides.seller && !partSides.seller ? "seller" : "buyer";
      return <>Heads up. This was logged with the {otherSide === "seller" ? "buyer" : "seller"}, so sharing with the <b>{otherSide}’s side</b> shows them a conversation they weren’t part of.</>;
    }
    if (audMode === "side") {
      if (audSides.seller && audSides.buyer) return <><b>Both sides</b> will see this in their portal.</>;
      if (audSides.seller) return <>Only the <b>seller’s side</b> will see this.</>;
      if (audSides.buyer) return <>Only the <b>buyer’s side</b> will see this.</>;
      return <>Pick who sees this, or turn sharing off.</>;
    }
    const names = [...sellerClients, ...buyerClients].filter((c) => audPeople.includes(c.id)).map((c) => extractFirstName(c.name));
    if (names.length === 0) return <>Tick the people who should see this.</>;
    const joined = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return <><b>{joined}</b> will see this{names.length === 1 ? "" : ", and no one else"}.</>;
  }
  const audienceEmpty = audMode === "side" ? !audSides.seller && !audSides.buyer : audPeople.length === 0;

  // Head + body — shared by the standalone sheet and the embedded host (#275).
  const headBody = (
    <>
      <div className="lum-head">
        {embedded && screen === "home" && onBackToSearch ? (
          <button className="lum-ic" onClick={onBackToSearch} aria-label="Back to property search" dangerouslySetInnerHTML={{ __html: svg(IC.back, 16, 2.2) }} />
        ) : screen !== "home" ? (
          <button className="lum-ic" onClick={goHome} aria-label="Back" dangerouslySetInnerHTML={{ __html: svg(IC.back, 16, 2.2) }} />
        ) : null}
        <h2 className="lum-title">{titles[screen]}</h2>
        <button className="lum-ic lum-ic-x" onClick={close} aria-label="Close" dangerouslySetInnerHTML={{ __html: svg(IC.x, 15, 2.2) }} />
      </div>

      <div className="lum-body">
        {embedded && propertyHeader && (
          // Pinned property + a control that animates back to the search (#275).
          <button type="button" className="lum-prophead" onClick={onBackToSearch} title="Change property">
            <PropertyThumb photoUrl={propertyHeader.photoUrl ?? null} size={30} />
            <span className="lum-ph-addr">
              <span className="lum-ph-l1">{propertyHeader.line1}</span>
              {propertyHeader.location && <span className="lum-ph-l2">{propertyHeader.location}</span>}
            </span>
            <span className="lum-ph-x" dangerouslySetInnerHTML={{ __html: svg(IC.x, 13, 2.2) }} />
          </button>
        )}
              {screen === "home" && (
                <div className="lum-fade">
                  <p className="lum-eyebrow">Tell your clients, or log what happened</p>
                  <div className="lum-rowwrap">
                    <div className="lum-row">
                      <button className="lum-btn lum-primary" onClick={() => setScreen("draft")}>
                        <span dangerouslySetInnerHTML={{ __html: svg(IC.sparkle, 15, 2) }} /> Draft for everyone
                      </button>
                      <button className="lum-btn lum-more" onClick={(e) => { e.stopPropagation(); setMoreOpen((v) => !v); }}>
                        <span dangerouslySetInnerHTML={{ __html: svg(IC.list, 15, 2) }} /> Log <span dangerouslySetInnerHTML={{ __html: svg(IC.chevron, 12, 2.4) }} />
                      </button>
                      <button className="lum-btn lum-record" onClick={() => setScreen("record")}>
                        <span className="lum-recava" dangerouslySetInnerHTML={{ __html: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg>' }} />
                        <span className="lum-rectxt">Record it</span>
                      </button>
                    </div>
                    {moreOpen && (
                      <div className="lum-menu">
                        {LOG_ITEMS.map((it) => (
                          <button key={it.key} className="lum-mm" onClick={() => pick(it.key)}>
                            <span className="lum-mmic" dangerouslySetInnerHTML={{ __html: svg(it.icon, 18) }} />
                            <span><span className="lum-mmt">{it.title}</span><span className="lum-mms">{it.sub}</span></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="lum-help">Draft turns one sentence into the right update for each side and a file note. Nothing goes out until you send.</p>
                  <div className="lum-logsection">
                    <div className="lum-divider" />
                    <p className="lum-eyebrow">Or log something that's happened</p>
                    <div className="lum-grid">
                      {LOG_ITEMS.map((it) => (
                        <button key={it.key} className="lum-tile" onClick={() => pick(it.key)}>
                          <span className="lum-tileic" dangerouslySetInnerHTML={{ __html: svg(it.icon, 20) }} />
                          <span className="lum-tilet">{it.title}</span>
                          <span className="lum-tiles">{it.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {screen === "draft" && (
                <div className="lum-fade">
                  <DraftForEveryonePanel transactionId={transactionId} contacts={clients} onClose={close} />
                </div>
              )}

              {screen === "record" && (
                <VoiceNotePanel transactionId={transactionId} contacts={clients} onDone={finishVoice} />
              )}

              {screen === "whatsapp" && (
                <div className="lum-fade">
                  <PasteWhatsAppPanel transactionId={transactionId} contacts={whatsappContacts} onClose={goHome} />
                </div>
              )}

              {(screen === "log" || screen === "note") && (
                <div className="lum-fade">
                  {screen === "log" && (
                    <>
                      <p className="lum-eyebrow">Direction</p>
                      <div className="lum-seg">
                        <button aria-pressed={direction === "outbound"} onClick={() => setDirection("outbound")}>Outbound (sent)</button>
                        <button aria-pressed={direction === "inbound"} onClick={() => setDirection("inbound")}>Inbound (received)</button>
                      </div>
                      <p className="lum-eyebrow" style={{ marginTop: 18 }}>Who</p>
                      <div className="lum-who">
                        <div className="lum-whocol">
                          <span className="lum-wholab">Seller&rsquo;s side</span>
                          <div className="lum-pills">
                            {sellerClients.map(clientPill)}
                            {sellerSols.map((s) => solPill(s, "vendor"))}
                            {sellerClients.length + sellerSols.length === 0 && <span className="lum-whoempty">No one on this side yet</span>}
                          </div>
                        </div>
                        <div className="lum-whocol">
                          <span className="lum-wholab">Buyer&rsquo;s side</span>
                          <div className="lum-pills">
                            {buyerClients.map(clientPill)}
                            {buyerSols.map((s) => solPill(s, "purchaser"))}
                            {buyerClients.length + buyerSols.length === 0 && <span className="lum-whoempty">No one on this side yet</span>}
                          </div>
                        </div>
                      </div>
                      {otherClients.length > 0 && (
                        <div className="lum-pillgroup" style={{ marginTop: 14 }}>
                          <span className="lum-grouplab">Other contacts</span>
                          <div className="lum-pills">{otherClients.map(clientPill)}</div>
                        </div>
                      )}
                      <p className="lum-eyebrow" style={{ marginTop: 18 }}>What was said</p>
                    </>
                  )}
                  <textarea className="lum-ta" value={content} onChange={(e) => setContent(e.target.value)} placeholder={screen === "note" ? "Add an internal note…" : "What was discussed or communicated?"} rows={screen === "note" ? 4 : 3} />
                  {screen === "log" && (
                    <>
                      <div className="lum-togline">
                        <button className="lum-sw" aria-pressed={share} onClick={toggleShare} />
                        <span className="lum-swlab">{share ? "Visible in client portal" : "Share with client"}</span>
                      </div>
                      {share && (
                        <div className="lum-wst">
                          <div className="lum-wsthead">
                            <span className="lum-wsttitle">Who sees this</span>
                            {sellerClients.length > 0 && buyerClients.length > 0 && (
                              <button type="button" className="lum-modebtn" onClick={() => setAudMode((m) => (m === "side" ? "people" : "side"))}>
                                {audMode === "side" ? "Pick specific people" : "Back to whole sides"}
                              </button>
                            )}
                          </div>
                          {audMode === "side" ? (
                            <div className="lum-sides">
                              {sellerClients.length > 0 && sideChip("seller", sellerClients)}
                              {buyerClients.length > 0 && sideChip("buyer", buyerClients)}
                            </div>
                          ) : (
                            <div className="lum-people">
                              {sellerClients.map((c) => personRow(c, "seller"))}
                              {buyerClients.map((c) => personRow(c, "buyer"))}
                            </div>
                          )}
                          <div className={"lum-summaryline" + (crossSide ? " warn" : "") + (audienceEmpty ? " dim" : "")}>
                            <span key={eyeKey} className="lum-eye" dangerouslySetInnerHTML={{ __html: crossSide
                              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>'
                              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' }} />
                            <span className="lum-stext">{audienceSummary()}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {screen === "note" && canMarkPrivate && (
                    <div className="lum-togline">
                      <button className="lum-sw" aria-pressed={priv} onClick={() => setPriv((v) => !v)} />
                      <span className="lum-swlab">{priv ? "Private to your team" : "Visible to the agent"}</span>
                    </div>
                  )}
                  {err && <p className="lum-err">{err}</p>}
                  <div className="lum-sendbar">
                    <button className="lum-btn lum-primary lum-wide" disabled={saving} onClick={() => saveLog(screen === "note")}>
                      {saving ? "Saving…" : screen === "note" ? "Save note" : "Save"}
                    </button>
                  </div>
                </div>
              )}
      </div>
    </>
  );

  // Embedded: the host (Add-note launcher) owns the overlay + sheet + grab; we
  // render just the head + body so it can morph in from a property search (#275).
  if (embedded) return headBody;

  return (
    <>
      {/* Styles live here (always mounted) so the trigger button is styled even
          when the modal is closed. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lum-launch">
        <button type="button" className={"lum-trigger" + (compactTrigger ? " lum-trigger-sm" : "")} onClick={openModal}>
          <span dangerouslySetInnerHTML={{ __html: svg(IC.sparkle, compactTrigger ? 13 : 16, 2) }} />
          Log an update
        </button>
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div className="lum-ov" role="dialog" aria-modal="true" aria-label="Log an update" data-closing={closing ? "1" : undefined}>
          <div className="lum-bg" onClick={close} />
          <div className={"lum-sheet" + (closing ? " lum-closing" : "")} data-tall={moreOpen ? "1" : undefined} onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) reallyClose(); }}>
            <div className="lum-grab" />
            {headBody}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function titleForChannel(c: LogChannel): string {
  return c === "email" ? "Log an email" : c === "phone" ? "Log a call" : c === "sms" ? "Log a text" : c === "voicemail" ? "Log a voicemail" : "Log post";
}

const CSS = `
.lum-ov { position:fixed; inset:0; z-index:1500; font-family:var(--font-geist-sans, -apple-system, system-ui, sans-serif); } /* escalated layer — must clear the agent topbar (200) / sidebar (100), critique #292 */
.lum-bg { position:absolute; inset:0; background:rgba(45,24,16,.42); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); animation:lum-bgf .26s ease both; }
@keyframes lum-bgf { from { opacity:0 } to { opacity:1 } }
.lum-sheet { position:absolute; display:flex; flex-direction:column; overflow:hidden; background:linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.66)), var(--agent-bg-paper, #FFFBF5); border:1px solid rgba(255,255,255,.5); box-shadow:0 24px 70px -24px rgba(40,24,16,.5), 0 8px 24px rgba(45,24,16,.12); }
/* Desktop: centred modal */
.lum-sheet { top:50%; left:50%; width:min(600px, calc(100vw - 48px)); max-height:min(88vh,760px); border-radius:16px; transform:translate(-50%,-48%) scale(.97); opacity:0; animation:lum-in .3s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes lum-in { to { transform:translate(-50%,-50%) scale(1); opacity:1 } }
.lum-grab { display:none; }
/* Tablet + mobile: bottom drawer */
@media (max-width:1024px) {
  .lum-sheet { top:auto; left:0; right:0; bottom:0; width:100%; max-width:none; max-height:92vh; border-radius:18px 18px 0 0; transform:translateY(100%); opacity:1; animation:lum-up .36s cubic-bezier(.22,1,.36,1) forwards; transition:min-height .32s cubic-bezier(.22,1,.36,1); }
  @keyframes lum-up { to { transform:translateY(0) } }
  .lum-sheet[data-tall="1"] { min-height:76vh; }
  .lum-grab { display:block; width:40px; height:4px; border-radius:999px; background:var(--agent-border-strong, rgba(45,24,16,.18)); margin:9px auto 2px; }
}
.lum-head { display:flex; align-items:center; gap:10px; padding:16px 18px 12px; }
.lum-title { font-size:17px; font-weight:700; letter-spacing:-.01em; margin:0; flex:1; color:var(--agent-text-primary,#2D1810); }
.lum-ic { width:30px; height:30px; border-radius:999px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); background:rgba(255,255,255,.6); display:grid; place-items:center; cursor:pointer; color:var(--agent-text-secondary,#5A3A28); flex:0 0 auto; transition:background .14s, color .14s; }
.lum-ic:hover { background:#fff; color:var(--agent-text-primary,#2D1810); }
.lum-body { padding:4px 18px 20px; overflow-y:auto; }
@media (max-width:1024px) { .lum-body { padding-bottom:calc(20px + env(safe-area-inset-bottom)); } }
/* Pinned property + change-property control, embedded "Add note" flow (#275). */
.lum-prophead { display:flex; align-items:center; gap:10px; width:100%; margin:0 0 14px; padding:8px 10px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; background:rgba(255,255,255,.5); cursor:pointer; font:inherit; text-align:left; transition:border-color .14s, background .14s; }
.lum-prophead:hover { border-color:var(--agent-coral,#FF8A65); background:#fff; }
.lum-ph-addr { flex:1; min-width:0; display:flex; flex-direction:column; }
.lum-ph-l1 { font-size:13px; font-weight:650; color:var(--agent-text-primary,#2D1810); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lum-ph-l2 { font-size:11px; color:var(--agent-text-muted,rgba(45,24,16,.55)); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lum-ph-x { width:22px; height:22px; border-radius:999px; display:grid; place-items:center; color:var(--agent-text-muted,rgba(45,24,16,.55)); background:rgba(45,24,16,.05); flex:0 0 auto; transition:color .14s, background .14s; }
.lum-prophead:hover .lum-ph-x { color:var(--agent-coral-darker); background:var(--agent-coral-bg-tint,rgba(255,138,101,.12)); }
/* Property search (step 1 of the standalone Add-note launcher). */
.anb-search { display:flex; align-items:center; gap:9px; background:transparent; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; padding:10px 13px; transition:border-color .15s; }
.anb-search:focus-within { border-color:var(--agent-coral-deep,#FF6B4A); }
.anb-search input { flex:1; border:none; outline:none; background:none; font-family:inherit; font-size:13.5px; color:var(--agent-text-primary,#2D1810); }
/* The pill shows focus via its own border — kill the inner element outline so it
   doesn't draw a second square inside (matches .lum-ta:focus-visible). */
.anb-search input:focus-visible { outline:none; }
.anb-results { margin-top:10px; display:flex; flex-direction:column; gap:4px; }
.anb-mi { display:flex; align-items:center; gap:10px; width:100%; padding:8px 10px; border:1px solid transparent; border-radius:10px; background:transparent; font:inherit; text-align:left; cursor:pointer; transition:background .12s, border-color .12s; }
.anb-mi:hover { background:var(--agent-coral-bg-tint,rgba(255,138,101,.08)); border-color:var(--agent-coral,#FF8A65); }
.anb-mi-addr { min-width:0; display:flex; flex-direction:column; }
.anb-mi-l1 { font-size:13px; font-weight:600; color:var(--agent-text-primary,#2D1810); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.anb-mi-l2 { font-size:11px; color:var(--agent-text-muted,rgba(45,24,16,.55)); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.anb-empty { padding:14px 10px; font-size:12.5px; color:var(--agent-text-muted,rgba(45,24,16,.55)); }
.lum-fade { animation:lum-fade .24s ease both; }
@keyframes lum-fade { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
.lum-eyebrow { font-size:10.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--agent-text-muted,rgba(45,24,16,.55)); margin:0 0 10px; }
.lum-help { font-size:12px; color:var(--agent-text-muted,rgba(45,24,16,.55)); line-height:1.55; margin:12px 0 0; }
.lum-divider { height:1px; background:var(--agent-border-subtle,rgba(45,24,16,.06)); margin:20px 0; }
.lum-trigger { display:inline-flex; align-items:center; gap:9px; font:inherit; font-size:14px; font-weight:600; color:#fff; border:0; cursor:pointer; padding:11px 18px; border-radius:12px; background:linear-gradient(180deg,var(--agent-coral) 0%,var(--agent-coral-deep) 100%); box-shadow:0 2px 0 var(--agent-coral-darker), 0 6px 16px rgba(var(--agent-coral-rgb),.30), inset 0 1px 0 rgba(255,255,255,.3); transition:filter .14s, transform .14s; }
.lum-trigger:hover { filter:brightness(1.04); } .lum-trigger:active { transform:translateY(1px); }
.lum-trigger-sm { font-size:12px; padding:6px 12px; border-radius:10px; gap:7px; box-shadow:0 1px 0 var(--agent-coral-darker), 0 4px 10px rgba(var(--agent-coral-rgb),.24), inset 0 1px 0 rgba(255,255,255,.3); }
.lum-rowwrap { position:relative; }
.lum-row { display:flex; gap:9px; flex-wrap:wrap; }
.lum-btn { display:inline-flex; align-items:center; gap:8px; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; padding:10px 15px; border-radius:8px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); background:rgba(255,255,255,.6); color:var(--agent-text-primary,#2D1810); transition:all .14s; }
.lum-btn:hover { background:#fff; border-color:var(--agent-border-strong,rgba(45,24,16,.18)); }
.lum-primary { color:#fff; border-color:transparent; background:linear-gradient(180deg,var(--agent-coral) 0%,var(--agent-coral-deep) 100%); box-shadow:0 2px 0 var(--agent-coral-darker), 0 6px 16px rgba(var(--agent-coral-rgb),.30), inset 0 1px 0 rgba(255,255,255,.3); }
.lum-primary:hover { filter:brightness(1.04); background:linear-gradient(180deg,var(--agent-coral) 0%,var(--agent-coral-deep) 100%); }
.lum-primary:disabled { opacity:.5; cursor:not-allowed; filter:none; }
.lum-wide { width:100%; justify-content:center; padding:13px; font-size:14.5px; }
.lum-more { display:none; }
@media (max-width:1024px) { .lum-more { display:inline-flex; } .lum-logsection { display:none; } }
.lum-menu { margin-top:10px; background:var(--agent-surface-elevated,#fff); border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; box-shadow:0 8px 24px rgba(45,24,16,.12); overflow:hidden; animation:lum-fade .18s ease both; }
.lum-mm { display:flex; align-items:center; gap:12px; width:100%; padding:12px 14px; border:0; background:transparent; font:inherit; text-align:left; cursor:pointer; border-bottom:1px solid var(--agent-border-subtle,rgba(45,24,16,.06)); }
.lum-mm:last-child { border-bottom:0; } .lum-mm:hover { background:var(--agent-coral-bg-tint,rgba(255,138,101,.08)); }
.lum-mmic { color:var(--agent-text-secondary,#5A3A28); display:grid; place-items:center; flex:0 0 auto; }
.lum-mmt { font-size:13.5px; font-weight:600; display:block; color:var(--agent-text-primary,#2D1810); } .lum-mms { font-size:11.5px; color:var(--agent-text-muted,rgba(45,24,16,.55)); }
.lum-grid { display:grid; grid-template-columns:repeat(12,1fr); gap:8px; }
.lum-grid .lum-tile:nth-child(-n+4) { grid-column:span 3; }
.lum-grid .lum-tile:nth-child(n+5) { grid-column:span 4; }
.lum-tile { display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:13px 12px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; background:rgba(255,255,255,.5); cursor:pointer; text-align:left; font:inherit; transition:all .14s; }
.lum-tile:hover { background:#fff; border-color:var(--agent-coral,#FF8A65); transform:translateY(-1px); box-shadow:0 4px 12px rgba(var(--agent-coral-base-rgb),.12); }
.lum-tileic { color:var(--agent-text-secondary,#5A3A28); display:grid; place-items:center; }
.lum-tilet { font-size:12.5px; font-weight:600; line-height:1.25; color:var(--agent-text-primary,#2D1810); }
.lum-tiles { font-size:11px; color:var(--agent-text-muted,rgba(45,24,16,.55)); line-height:1.35; }
.lum-seg { display:inline-flex; background:rgba(255,255,255,.5); border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:999px; padding:3px; gap:2px; }
.lum-seg button { border:0; background:transparent; font:inherit; font-size:12.5px; font-weight:600; color:var(--agent-text-muted,rgba(45,24,16,.55)); padding:6px 13px; border-radius:999px; cursor:pointer; transition:all .16s; }
.lum-seg button[aria-pressed="true"] { background:#fff; color:var(--agent-text-primary,#2D1810); box-shadow:0 1px 3px rgba(0,0,0,.08); }
.lum-seg button:hover:not([aria-pressed="true"]) { color:var(--agent-text-primary,#2D1810); }
.lum-pillgroup { margin-top:10px; }
.lum-grouplab { display:block; font-size:12px; font-weight:600; color:var(--agent-text-muted,rgba(45,24,16,.55)); margin-bottom:7px; }
/* Who — seller's side (left) / buyer's side (right), hairline between. */
.lum-who { display:grid; grid-template-columns:1fr 1fr; gap:16px; position:relative; }
.lum-who::before { content:""; position:absolute; top:2px; bottom:2px; left:50%; width:1px; background:var(--agent-border-subtle,rgba(45,24,16,.08)); transform:translateX(-.5px); }
.lum-whocol { min-width:0; }
.lum-wholab { display:block; font-size:10.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--agent-text-muted,rgba(45,24,16,.55)); margin-bottom:9px; }
.lum-whoempty { font-size:12px; font-style:italic; color:var(--agent-text-disabled,rgba(45,24,16,.35)); }
/* Under ~800px: stack the two sides with a labelled hairline, no ambiguous gap. */
@media (max-width:800px) {
  .lum-who { grid-template-columns:1fr; gap:0; }
  .lum-who::before { display:none; }
  .lum-who .lum-whocol + .lum-whocol { border-top:1px solid var(--agent-border-subtle,rgba(45,24,16,.08)); margin-top:14px; padding-top:14px; }
}
.lum-pills { display:flex; gap:7px; flex-wrap:wrap; }
.lum-pill { display:inline-flex; align-items:center; gap:8px; font:inherit; font-size:12.5px; font-weight:600; padding:4px 13px 4px 4px; border-radius:999px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); background:#fff; color:var(--agent-text-primary,#2D1810); cursor:pointer; transition:border-color .14s, transform .14s, box-shadow .14s; }
.lum-pill:hover { border-color:var(--agent-coral-deep,#FF6B4A); }
.lum-pill[aria-pressed="true"] { border-color:var(--agent-coral-deep,#FF6B4A); transform:translateY(-1px); box-shadow:0 3px 10px rgba(var(--agent-coral-base-rgb),.2); }
.lum-av { position:relative; display:grid; place-items:center; flex:0 0 auto; }
.lum-chk { position:absolute; right:-4px; bottom:-4px; width:14px; height:14px; border-radius:999px; background:var(--agent-coral-deep,#FF6B4A); border:1.5px solid #fff; display:grid; place-items:center; color:#fff; }
.lum-pill[aria-pressed="false"] .lum-chk { display:none; }
.lum-ta { width:100%; margin-top:6px; background:rgba(255,255,255,.55); border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:8px; padding:11px 13px; color:var(--agent-text-primary,#2D1810); font:inherit; font-size:14px; line-height:1.55; resize:vertical; box-sizing:border-box; }
.lum-ta:hover:not(:focus) { border-color:var(--agent-border-strong,rgba(45,24,16,.18)); }
.lum-ta:focus { outline:none; border-color:var(--agent-coral-deep,#FF6B4A); background:rgba(255,255,255,.8); }
.lum-ta::placeholder { color:var(--agent-text-disabled,rgba(45,24,16,.35)); }
.lum-togline { display:flex; align-items:center; gap:10px; margin-top:14px; }
.lum-swlab { font-size:13px; color:var(--agent-text-secondary,#5A3A28); }
.lum-sw { position:relative; width:40px; height:23px; border-radius:999px; background:var(--agent-border-strong,rgba(45,24,16,.18)); border:0; cursor:pointer; flex:0 0 auto; transition:background .18s; padding:0; }
.lum-sw[aria-pressed="true"] { background:linear-gradient(180deg,var(--agent-coral) 0%,var(--agent-coral-deep) 100%); }
.lum-sw::after { content:""; position:absolute; top:2.5px; left:2.5px; width:18px; height:18px; border-radius:999px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.25); transition:transform .18s; }
.lum-sw[aria-pressed="true"]::after { transform:translateX(17px); }
.lum-sw:hover { filter:brightness(1.06); }
/* "Who sees this" audience control (Phase 6c). Seller = blue, buyer = green,
   matching the real per-side avatar tones in components/ui/Avatar.tsx. */
.lum-wst { margin-top:14px; padding:14px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; background:rgba(255,255,255,.4); animation:lum-fade .22s ease both; }
.lum-wsthead { display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:11px; }
.lum-wsttitle { font-size:12.5px; font-weight:700; color:var(--agent-text-primary,#2D1810); }
.lum-modebtn { font:inherit; font-size:12px; font-weight:600; color:var(--agent-coral-deep,#F04E2C); background:none; border:0; cursor:pointer; padding:2px; transition:opacity .14s; }
.lum-modebtn:hover { opacity:.72; }
.lum-sides { display:flex; gap:9px; flex-wrap:wrap; }
.lum-sidechip { flex:1 1 0; min-width:150px; display:flex; align-items:center; gap:11px; cursor:pointer; padding:11px 13px; border-radius:12px; border:1.5px solid var(--agent-border-default,rgba(45,24,16,.1)); background:#fff; font:inherit; text-align:left; transition:border-color .16s, transform .16s, box-shadow .16s, background .16s; }
.lum-sidechip:hover { transform:translateY(-1px); }
.lum-avastack { display:flex; align-items:center; flex:0 0 auto; }
.lum-avai { position:relative; border-radius:999px; overflow:hidden; flex:0 0 auto; box-shadow:0 0 0 2px #fff, 0 1px 2px rgba(0,0,0,.14); line-height:0; }
.lum-sctext { flex:1; min-width:0; }
.lum-scname { display:block; font-size:13px; font-weight:650; color:var(--agent-text-primary,#2D1810); line-height:1.25; }
.lum-scsub { display:block; font-size:11px; color:var(--agent-text-muted,rgba(45,24,16,.55)); line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lum-sctick { width:20px; height:20px; border-radius:999px; border:1.5px solid var(--agent-border-default,rgba(45,24,16,.1)); display:grid; place-items:center; color:#fff; flex:0 0 auto; transform:scale(.9); transition:all .16s; }
.lum-sctick svg { opacity:0; transform:scale(.5); transition:all .18s cubic-bezier(.3,1.5,.5,1); }
.lum-sidechip.lum-seller:hover, .lum-prow.lum-seller:hover { border-color:#2E6DB4; }
.lum-sidechip.lum-buyer:hover, .lum-prow.lum-buyer:hover { border-color:#1E9273; }
.lum-sidechip.lum-seller.on { background:linear-gradient(180deg,#2E6DB4,#0C447C); border-color:#0C447C; box-shadow:0 6px 16px -6px rgba(12,68,124,.5); }
.lum-sidechip.lum-buyer.on { background:linear-gradient(180deg,#1E9273,#085041); border-color:#085041; box-shadow:0 6px 16px -6px rgba(8,80,65,.5); }
.lum-sidechip.on .lum-scname { color:#fff; } .lum-sidechip.on .lum-scsub { color:rgba(255,255,255,.82); }
.lum-sidechip.on .lum-avai { box-shadow:0 0 0 2px rgba(255,255,255,.9), 0 1px 2px rgba(0,0,0,.2); }
.lum-sidechip.on .lum-sctick, .lum-prow.on .lum-sctick { background:#fff; border-color:#fff; transform:scale(1); }
.lum-sidechip.lum-seller.on .lum-sctick, .lum-prow.lum-seller.on .lum-sctick { color:#0C447C; }
.lum-sidechip.lum-buyer.on .lum-sctick, .lum-prow.lum-buyer.on .lum-sctick { color:#085041; }
.lum-sidechip.on .lum-sctick svg, .lum-prow.on .lum-sctick svg { opacity:1; transform:scale(1); }
.lum-people { display:flex; flex-direction:column; gap:7px; }
.lum-prow { display:flex; align-items:center; gap:10px; cursor:pointer; padding:8px 11px; border-radius:10px; border:1.5px solid var(--agent-border-default,rgba(45,24,16,.1)); background:#fff; font:inherit; text-align:left; transition:border-color .16s, transform .16s, background .16s; }
.lum-prow:hover { transform:translateY(-1px); }
.lum-prow .lum-avai { box-shadow:0 0 0 2px #fff, 0 1px 2px rgba(0,0,0,.12); }
.lum-prname { flex:1; font-size:13px; font-weight:600; color:var(--agent-text-primary,#2D1810); }
.lum-prside { font-size:9px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:2px 7px; border-radius:6px; }
.lum-prow.lum-seller .lum-prside { color:#2E6DB4; background:rgba(46,109,180,.1); }
.lum-prow.lum-buyer .lum-prside { color:#1E9273; background:rgba(30,146,115,.1); }
.lum-prow.lum-seller.on { background:linear-gradient(180deg,#2E6DB4,#0C447C); border-color:#0C447C; }
.lum-prow.lum-buyer.on { background:linear-gradient(180deg,#1E9273,#085041); border-color:#085041; }
.lum-prow.on .lum-prname { color:#fff; }
.lum-prow.on .lum-prside { background:rgba(255,255,255,.22); color:#fff; }
.lum-prow.on .lum-avai { box-shadow:0 0 0 2px rgba(255,255,255,.9); }
.lum-summaryline { display:flex; align-items:center; gap:9px; margin-top:13px; min-height:20px; }
.lum-eye { width:17px; height:17px; flex:0 0 auto; color:var(--agent-coral-deep,#F04E2C); display:grid; place-items:center; animation:lum-eyeflash .5s ease; }
.lum-eye svg { width:17px; height:17px; }
.lum-summaryline.dim .lum-eye { color:var(--agent-text-disabled,rgba(45,24,16,.35)); }
.lum-summaryline.warn .lum-eye { color:#C0392B; }
@keyframes lum-eyeflash { 0%{transform:scale(1)} 30%{transform:scale(1.35); filter:drop-shadow(0 0 6px rgba(var(--agent-coral-rgb),.55))} 100%{transform:scale(1); filter:none} }
.lum-stext { font-size:12.5px; color:var(--agent-text-secondary,#5A3A28); line-height:1.4; }
.lum-stext b { color:var(--agent-text-primary,#2D1810); font-weight:650; }
.lum-summaryline.warn .lum-stext { color:#C0392B; }
.lum-summaryline.warn .lum-stext b { color:#A5281B; }
.lum-err { margin:10px 0 0; font-size:12.5px; color:#c0392b; }
.lum-sendbar { position:sticky; bottom:0; background:linear-gradient(180deg, rgba(255,251,245,0), var(--agent-bg-paper,#FFFBF5) 32%); padding:14px 0 2px; margin-top:8px; }
.lum-ov :focus-visible { outline:2px solid var(--agent-coral-deep,#FF6B4A); outline-offset:2px; }
.lum-ta:focus-visible { outline:none; }
.lum-record:hover { border-color:#294A73; background:#fff; }
.lum-recava { width:22px; height:22px; border-radius:999px; display:grid; place-items:center; color:#fff; background:linear-gradient(180deg,#294A73 0%,#163152 100%); box-shadow:inset 0 1px 0 rgba(255,255,255,.18); flex:0 0 auto; }
.lum-rectxt { color:#163152; }
.lum-rec { text-align:center; }
.lum-listen { display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; letter-spacing:.01em; color:var(--agent-text-muted,rgba(45,24,16,.55)); margin:6px auto 8px; }
.lum-listen[data-on="1"] { color:var(--agent-coral-darker); }
.lum-blip { width:10px; height:10px; border-radius:999px; background:radial-gradient(circle at 34% 30%, #ffffff 0%, rgba(255,255,255,.55) 20%, #c9b9af 62%, #a7968c 100%); box-shadow:inset 0 0 0 .5px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.18); }
.lum-listen[data-on="1"] .lum-blip { background:radial-gradient(circle at 34% 28%, #ffffff 0%, rgba(255,255,255,.7) 16%, var(--agent-coral) 44%, var(--agent-coral-deep) 100%); box-shadow:inset 0 0 0 .5px rgba(255,255,255,.5), 0 0 0 4px rgba(var(--agent-coral-rgb),.14), 0 1px 3px rgba(var(--agent-coral-rgb),.4); animation:lum-blip 1.2s ease-in-out infinite; }
@keyframes lum-blip { 0%,100%{opacity:1} 50%{opacity:.25} }
.lum-rectime { font-size:34px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--agent-text-primary,#2D1810); margin:2px 0; }
.lum-wave { display:flex; align-items:center; justify-content:center; gap:3px; height:40px; margin:6px 0; }
.lum-wave span { width:3px; border-radius:999px; background:var(--agent-coral,#FF8A65); opacity:.85; height:12%; }
.lum-wave.on span { animation:lum-wav .9s ease-in-out infinite; }
@keyframes lum-wav { 0%,100%{height:14%} 50%{height:82%} }
/* Live mic-driven bars (Phase 5): heights set inline per frame, smoothed. */
.lum-wave.live span { animation:none; transition:height .08s linear; }
.lum-recbtns { display:flex; gap:9px; margin-top:14px; justify-content:center; }
.lum-shimmer { width:40px; height:40px; border-radius:999px; margin:0 auto; border:3px solid var(--agent-coral-bg-tint,rgba(255,138,101,.18)); border-top-color:var(--agent-coral-deep); animation:lum-spin .8s linear infinite; }
@keyframes lum-spin { to { transform:rotate(360deg) } }
.lum-checkrow { display:flex; align-items:flex-start; gap:11px; padding:11px 12px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; margin-top:8px; background:rgba(255,255,255,.5); cursor:pointer; transition:border-color .14s, background .14s; }
.lum-checkrow:hover { border-color:var(--agent-coral,#FF8A65); background:#fff; }
.lum-checkrow .lum-cbx { width:21px; height:21px; border-radius:6px; border:1.5px solid var(--agent-border-strong,rgba(45,24,16,.18)); display:grid; place-items:center; color:#fff; flex:0 0 auto; margin-top:1px; transition:all .14s; }
.lum-checkrow[aria-pressed="true"] .lum-cbx { background:#10B981; border-color:#10B981; }
.lum-checkrow[aria-pressed="false"] .lum-cbx svg { display:none; }
.lum-checkrow[aria-pressed="false"] { opacity:.6; }
.lum-cr-t { font-size:13.5px; font-weight:600; color:var(--agent-text-primary,#2D1810); }
.lum-cr-s { font-size:12px; color:var(--agent-text-muted,rgba(45,24,16,.55)); font-weight:500; }
.lum-sidecard { border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; padding:14px; margin-top:12px; background:rgba(255,255,255,.5); transition:opacity .2s; }
.lum-sidecard.off { opacity:.55; }
.lum-sc-head { display:flex; align-items:center; gap:8px; margin-bottom:9px; }
.lum-sc-eye { font-size:10.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
.lum-sc-eye.seller { color:#4F46E5; } .lum-sc-eye.buyer { color:#BE185D; } .lum-sc-eye.note { color:var(--agent-text-tertiary,#7A4A2E); }
.lum-sub { text-align:center; font-size:11.5px; color:var(--agent-text-muted,rgba(45,24,16,.55)); margin:8px 0 0; }
/* Close (X) — tinted hover + the X rotates. */
.lum-ic-x svg { transition:transform .2s ease; }
.lum-ic-x:hover { background:var(--agent-coral-bg-tint,rgba(255,138,101,.12)); color:var(--agent-coral-darker); border-color:var(--agent-coral,#FF8A65); }
.lum-ic-x:hover svg { transform:rotate(90deg); }
/* Start-recording button: border lights coral, mic icon pulses on hover. */
.lum-recbtn:hover { border-color:var(--agent-coral,#FF8A65); color:var(--agent-coral-darker); }
.lum-recbtn svg { transition:transform .18s ease; }
.lum-recbtn:hover svg { animation:lum-mic 1s ease-in-out infinite; }
@keyframes lum-mic { 0%,100%{transform:scale(1)} 50%{transform:scale(1.16)} }
/* Exit animation — reverse of the entry. */
.lum-sheet.lum-closing { animation:lum-out .24s cubic-bezier(.4,0,1,1) forwards; }
@keyframes lum-out { from { transform:translate(-50%,-50%) scale(1); opacity:1 } to { transform:translate(-50%,-48%) scale(.97); opacity:0 } }
@media (max-width:1024px) { .lum-sheet.lum-closing { animation:lum-down .3s cubic-bezier(.4,0,1,1) forwards; } }
@keyframes lum-down { from { transform:translateY(0) } to { transform:translateY(100%) } }
.lum-ov[data-closing="1"] .lum-bg { animation:lum-bgout .24s ease forwards; }
@keyframes lum-bgout { to { opacity:0 } }
@media (prefers-reduced-motion:reduce) { .lum-ov * { animation-duration:.001ms !important; transition-duration:.001ms !important; } }
`;

// The standalone "Add note" launcher injects this so its property-search step +
// sheet chrome are styled before the embedded LogUpdateModal mounts (#275).
export const LOG_UPDATE_CSS = CSS;
