import type { SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import { titleCaseKeepAcronyms, normalizePhone, validateHandlerContact } from "@/lib/utils";

// Auto-fill a solicitor from a memo-of-sale extraction.
//
// A solicitor handler is a SHARED record and every automated chase / client
// email relies on it having a direct line AND an email. So this never silently
// creates an incomplete handler: if the memo didn't give us both, we resolve
// the firm but leave the handler PENDING (carried on the selection's
// pendingHandler). The picker then shows an inline "finish adding" prompt so the
// user supplies the missing detail and clicks Add, at which point the handler is
// created complete. Only a fully-detailed extraction is saved automatically.
//
// Returns "new" (handler created), "existing" (matched a saved handler or
// firm-only), "pending" (firm resolved, handler awaiting a missing detail), or
// false (couldn't resolve the firm).
export async function autoFillSolicitor(
  firmName: string,
  contact: { name?: string | null; phone?: string | null; email?: string | null },
  setSolicitor: (v: SolicitorSelection | null) => void,
): Promise<"new" | "existing" | "pending" | false> {
  // The draft we hold on the selection when the extraction is incomplete.
  const draft = () => ({
    name: contact.name ? titleCaseKeepAcronyms(contact.name) : "",
    phone: normalizePhone(contact.phone ?? ""),
    email: contact.email?.trim().toLowerCase() || "",
  });
  const hasHandler = !!contact.name?.trim();
  // Complete = we have a name AND both a valid phone and email.
  const complete = hasHandler && validateHandlerContact(contact.phone, contact.email) === null;

  try {
    const searchRes = await fetch(`/api/solicitor-firms?q=${encodeURIComponent(firmName)}`, { cache: "no-store" });
    if (!searchRes.ok) return false;
    const firms: { id: string; name: string }[] = await searchRes.json();
    const exact = firms.find(f => f.name.toLowerCase().trim() === firmName.toLowerCase().trim());

    if (exact) {
      const base: SolicitorSelection = { firmId: exact.id, firmName: exact.name, contactId: null, contactName: null, phone: null, email: null };
      if (!hasHandler) {
        setSolicitor(base);
        return "existing";
      }
      // Firm exists and the memo named a handler — reuse an existing handler if
      // one matches (never edit shared data), otherwise create it when complete.
      const handlersRes = await fetch(`/api/solicitor-firms/${exact.id}/handlers`, { cache: "no-store" });
      const handlers: { id: string; name: string; phone: string | null; email: string | null }[] = handlersRes.ok ? await handlersRes.json() : [];
      const existingHandler = handlers.find(h => h.name.toLowerCase().trim() === contact.name!.toLowerCase().trim());
      if (existingHandler) {
        setSolicitor({ ...base, contactId: existingHandler.id, contactName: existingHandler.name, phone: existingHandler.phone, email: existingHandler.email });
        return "existing";
      }
      if (complete) {
        const createRes = await fetch(`/api/solicitor-firms/${exact.id}/handlers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: titleCaseKeepAcronyms(contact.name!), phone: normalizePhone(contact.phone ?? ""), email: contact.email?.trim().toLowerCase() || null }),
        });
        if (createRes.ok) {
          const h = await createRes.json();
          setSolicitor({ ...base, contactId: h.id, contactName: h.name, phone: h.phone, email: h.email });
          return "new";
        }
      }
      // Incomplete (or the complete create failed) — hold the handler pending.
      setSolicitor({ ...base, pendingHandler: draft() });
      return "pending";
    }

    // Firm doesn't exist yet.
    if (complete) {
      const createRes = await fetch("/api/solicitor-firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: titleCaseKeepAcronyms(firmName),
          handler: { name: titleCaseKeepAcronyms(contact.name!), phone: normalizePhone(contact.phone ?? ""), email: contact.email?.trim().toLowerCase() || null },
        }),
      });
      if (!createRes.ok) return false;
      const newFirm = await createRes.json();
      const h = newFirm.handlers?.[0] ?? null;
      setSolicitor({ firmId: newFirm.id, firmName: newFirm.name, contactId: h?.id ?? null, contactName: h?.name ?? null, phone: h?.phone ?? null, email: h?.email ?? null });
      return "new";
    }

    // New firm but the handler is incomplete (or absent). Create the firm only
    // (a name is harmless and lets the user finish the handler inline), and hold
    // the handler pending if the memo named one.
    const createRes = await fetch("/api/solicitor-firms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: titleCaseKeepAcronyms(firmName) }),
    });
    if (!createRes.ok) return false;
    const newFirm = await createRes.json();
    setSolicitor({
      firmId: newFirm.id,
      firmName: newFirm.name,
      contactId: null,
      contactName: null,
      phone: null,
      email: null,
      pendingHandler: hasHandler ? draft() : null,
    });
    return hasHandler ? "pending" : "existing";
  } catch (err) {
    console.error("[autoFillSolicitor]", firmName, err);
    return false;
  }
}
