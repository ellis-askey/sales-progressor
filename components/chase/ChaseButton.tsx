"use client";

import { useState } from "react";
import { ChaseDrawer } from "./ChaseDrawer";

interface Contact {
  id: string;
  name: string;
  roleType: string;
  email?: string | null;
  phone?: string | null;
}

interface ChaseButtonProps {
  chaseTaskId: string;
  transactionId: string;
  propertyAddress: string;
  milestoneName: string;
  chaseCount: number;
  contacts: Contact[];
  onSent?: () => void;
}

export function ChaseButton({
  chaseTaskId,
  transactionId,
  propertyAddress,
  milestoneName,
  chaseCount,
  contacts,
  onSent,
}: ChaseButtonProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
      >
        Chase
      </button>

      {drawerOpen && (
        <ChaseDrawer
          chaseTaskId={chaseTaskId}
          transactionId={transactionId}
          propertyAddress={propertyAddress}
          milestoneName={milestoneName}
          chaseCount={chaseCount}
          contacts={contacts}
          onClose={() => setDrawerOpen(false)}
          onSent={() => { onSent?.(); setDrawerOpen(false); }}
        />
      )}
    </>
  );
}
