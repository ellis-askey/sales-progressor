"use client";

// Self-contained WhatsApp-group control for a file: the trigger button plus the
// group-setup modal. Lifted out of ContactsSection's header (founder ask,
// 2026-10-21) so it can sit on the People card's toggle row.
//
// Per-side groups (2026-11-10): seller and buyer get SEPARATE groups, so the
// button opens the modal and the modal's seller/buyer switch handles each side.
// Label reflects whether either side's group is set up yet.

import { useState } from "react";
import { WhatsappLogo } from "@phosphor-icons/react";
import { WhatsappGroupModal } from "./WhatsappGroupModal";

export function WhatsAppGroupControl({
  transactionId,
  address,
  contacts,
  sellerUrl,
  buyerUrl,
}: {
  transactionId: string;
  address: string;
  contacts: { id: string; name: string; phone: string | null; roleType: string }[];
  sellerUrl: string | null;
  buyerUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const anySet = !!sellerUrl || !!buyerUrl;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        title={anySet ? "Manage the WhatsApp groups for this sale" : "Set up a WhatsApp group for this sale"}
      >
        <WhatsappLogo size={13} weight="fill" style={{ color: "#25D366" }} />
        <span className="contacts-wagroup-full">{anySet ? "WhatsApp group" : "Set up WhatsApp group"}</span>
        <span className="contacts-wagroup-short">WhatsApp group</span>
      </button>

      <WhatsappGroupModal
        open={open}
        onClose={() => setOpen(false)}
        transactionId={transactionId}
        address={address}
        contacts={contacts}
        sellerUrl={sellerUrl}
        buyerUrl={buyerUrl}
      />
    </>
  );
}
