"use client";

// Self-contained WhatsApp-group control for a file: the trigger button(s) plus
// the group-setup modal. Lifted out of ContactsSection's header (founder ask,
// 2026-10-21) so it can sit on the People card's toggle row, opposite the
// Clients/Professionals tabs, while the setup/edit flow stays identical.
//   - No group link saved → one "Set up WhatsApp group" button opening the modal.
//   - Link saved → "WhatsApp group" opens the group directly; the pencil beside
//     it re-opens the modal to change the link.
// Responsive labels reuse the existing .contacts-wagroup-full/-short classes.

import { useState } from "react";
import { WhatsappLogo, PencilSimple } from "@phosphor-icons/react";
import { WhatsappGroupModal } from "./WhatsappGroupModal";

export function WhatsAppGroupControl({
  transactionId,
  address,
  contacts,
  currentInviteUrl,
}: {
  transactionId: string;
  address: string;
  contacts: { id: string; name: string; phone: string | null; roleType: string }[];
  currentInviteUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {currentInviteUrl ? (
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          <a
            href={currentInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            title="Open the WhatsApp group"
          >
            <WhatsappLogo size={13} weight="fill" style={{ color: "#25D366" }} />
            WhatsApp group
          </a>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px" }}
            aria-label="Change the WhatsApp group link"
            title="Change the WhatsApp group link"
          >
            <PencilSimple size={12} weight="regular" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          title="Set up a WhatsApp group for this sale"
        >
          <WhatsappLogo size={13} weight="fill" style={{ color: "#25D366" }} />
          <span className="contacts-wagroup-full">Set up WhatsApp group</span>
          <span className="contacts-wagroup-short">WhatsApp group</span>
        </button>
      )}

      <WhatsappGroupModal
        open={open}
        onClose={() => setOpen(false)}
        transactionId={transactionId}
        address={address}
        contacts={contacts}
        currentInviteUrl={currentInviteUrl}
      />
    </>
  );
}
