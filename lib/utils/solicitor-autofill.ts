import type { SolicitorSelection } from "@/components/solicitors/SolicitorPicker";

export async function autoFillSolicitor(
  firmName: string,
  contact: { name?: string | null; phone?: string | null; email?: string | null },
  setSolicitor: (v: SolicitorSelection | null) => void,
): Promise<"new" | "existing" | false> {
  try {
    const searchRes = await fetch(`/api/solicitor-firms?q=${encodeURIComponent(firmName)}`, { cache: "no-store" });
    if (!searchRes.ok) return false;
    const firms: { id: string; name: string }[] = await searchRes.json();
    const exact = firms.find(f => f.name.toLowerCase().trim() === firmName.toLowerCase().trim());

    if (exact) {
      let selection: SolicitorSelection = { firmId: exact.id, firmName: exact.name, contactId: null, contactName: null, phone: null, email: null };
      if (contact.name?.trim()) {
        const handlersRes = await fetch(`/api/solicitor-firms/${exact.id}/handlers`, { cache: "no-store" });
        const handlers: { id: string; name: string; phone: string | null; email: string | null }[] = handlersRes.ok ? await handlersRes.json() : [];
        const existingHandler = handlers.find(h => h.name.toLowerCase().trim() === contact.name!.toLowerCase().trim());
        if (existingHandler) {
          selection = { ...selection, contactId: existingHandler.id, contactName: existingHandler.name, phone: existingHandler.phone, email: existingHandler.email };
        } else {
          const createRes = await fetch(`/api/solicitor-firms/${exact.id}/handlers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: contact.name.trim(), phone: contact.phone?.trim() || null, email: contact.email?.trim() || null }),
          });
          if (createRes.ok) {
            const h = await createRes.json();
            selection = { ...selection, contactId: h.id, contactName: h.name, phone: h.phone, email: h.email };
          }
        }
      }
      setSolicitor(selection);
      return "existing";
    }

    const createRes = await fetch("/api/solicitor-firms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: firmName.trim(),
        ...(contact.name?.trim() ? { handler: { name: contact.name.trim(), phone: contact.phone?.trim() || null, email: contact.email?.trim() || null } } : {}),
      }),
    });
    if (!createRes.ok) return false;
    const newFirm = await createRes.json();
    const h = newFirm.handlers?.[0] ?? null;
    setSolicitor({ firmId: newFirm.id, firmName: newFirm.name, contactId: h?.id ?? null, contactName: h?.name ?? null, phone: h?.phone ?? null, email: h?.email ?? null });
    return "new";
  } catch (err) {
    console.error("[autoFillSolicitor]", firmName, err);
    return false;
  }
}
