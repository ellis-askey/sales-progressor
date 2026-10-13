"use client";

// Critique #237: the first-run sequence for an agent who just CLAIMED a chain
// sale. The chain welcome shows first (?newUser=1, gated inside
// ClaimWelcomeModal); when it closes, the chase set-up welcome
// (SelfManagedWelcomeModal variant="claim") follows, WHATEVER route they took:
//   - "I'll do this later" / X / backdrop → chases show immediately
//   - "Set up {address}" → the reconcile modal opens; chases show when it
//     closes (finished or abandoned — ReconcileLaterBanner dispatches
//     sp:reconcile-closed either way)
// The claiming signup marks the ordinary first-login welcome as seen, so this
// is the ONLY place a claiming director is shown the chase toggles.

import { useEffect, useRef, useState } from "react";
import { ClaimWelcomeModal, type ChainMember } from "@/components/transaction/ClaimWelcomeModal";
import { SelfManagedWelcomeModal } from "@/components/agent/SelfManagedWelcomeModal";
import type { ProgressorChasePrefs } from "@/lib/services/progressor-chase-prefs";
import type { ThemeMode } from "@/lib/agent/theme-mode";

type Props = {
  address: string;
  originatorAgency?: string;
  members?: ChainMember[];
  connectedCount?: number;
  // Chase set-up (null when the viewer can't save prefs — e.g. not a director —
  // in which case this renders exactly the old chain-welcome-only behaviour).
  chaseSetup: {
    userName: string;
    initialPrefs: ProgressorChasePrefs;
    themeMode: ThemeMode;
  } | null;
};

export function ClaimFirstRunFlow({ address, originatorAgency, members, connectedCount, chaseSetup }: Props) {
  const [showChases, setShowChases] = useState(false);
  const armedForReconcile = useRef(false);

  useEffect(() => {
    function onReconcileClosed() {
      if (!armedForReconcile.current) return;
      armedForReconcile.current = false;
      setShowChases(true);
    }
    window.addEventListener("sp:reconcile-closed", onReconcileClosed);
    return () => window.removeEventListener("sp:reconcile-closed", onReconcileClosed);
  }, []);

  function handleWelcomeClosed(via: "setup" | "later") {
    if (!chaseSetup) return;
    if (via === "setup") {
      // The reconcile modal is opening — wait for it to close.
      armedForReconcile.current = true;
    } else {
      setShowChases(true);
    }
  }

  return (
    <>
      <ClaimWelcomeModal
        address={address}
        originatorAgency={originatorAgency}
        members={members}
        connectedCount={connectedCount}
        onClosed={handleWelcomeClosed}
      />
      {chaseSetup && showChases && (
        <SelfManagedWelcomeModal
          variant="claim"
          propertyAddress={address}
          userName={chaseSetup.userName}
          initialPrefs={chaseSetup.initialPrefs}
          themeMode={chaseSetup.themeMode}
          onClosed={() => setShowChases(false)}
        />
      )}
    </>
  );
}
