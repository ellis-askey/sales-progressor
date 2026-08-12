"use client";

// Client wrapper that bridges CommsEntry → ActivityTimeline so newly-added
// comms/notes render IMMEDIATELY (optimistic) instead of waiting for the
// server revalidation round-trip. Without this, the success toast appears
// ~2s before the timeline row shows, which feels broken.
//
// Mechanic: hold an `optimistic` array of pending entries; render them
// merged with the server-supplied `entries` prop. When that prop refreshes
// (server revalidation lands), clear the optimistic array — real data has
// caught up. Worst-case: if the server data hasn't caught up after the
// next prop change, the optimistic row briefly disappears and reappears on
// the following refresh. Acceptable for a UI nicety.

import { useState, useEffect } from "react";
import { ActivityTimeline } from "./ActivityTimeline";
import { CommsEntry } from "./CommsEntry";
import type { ActivityEntry } from "@/lib/services/comms";
import type { CommType, CommMethod } from "@prisma/client";

type Props = {
  entries: ActivityEntry[];
  transactionId: string;
  mosDocUrl?: string | null;
  currentUserId?: string;
  contacts: { id: string; name: string; roleType: string; phone?: string | null }[];
  solicitors?: { id: string; name: string; role: string; phone?: string | null }[];
  canPasteChat?: boolean;
  // For building optimistic entries — these aren't on session client-side,
  // so the parent page passes them in from the server session.
  currentUserName: string;
  currentUserRole: string;
};

export function ActivityTab(props: Props) {
  const [optimistic, setOptimistic] = useState<ActivityEntry[]>([]);

  // Reconcile: when the entries prop refreshes (real data has landed),
  // drop any optimistic entries — they'd be duplicates of the real rows
  // that now exist server-side.
  useEffect(() => {
    setOptimistic([]);
  }, [props.entries]);

  const merged: ActivityEntry[] = [...optimistic, ...props.entries].sort((a, b) => {
    const aAt = a.at ? new Date(a.at).getTime() : 0;
    const bAt = b.at ? new Date(b.at).getTime() : 0;
    return bAt - aAt;
  });

  function handleOptimisticAdd(
    type: CommType,
    method: CommMethod | null,
    content: string,
    contactIds: string[],
  ): void {
    // contactIds carries BOTH vendor/purchaser contact IDs and solicitor
    // contact IDs (CommsEntry lets the agent toggle either pill row).
    // The optimistic render must look both up so the just-added row
    // shows solicitor names too, matching what the timeline service
    // returns once the server-side revalidate lands.
    const contactNames = contactIds
      .map((id) =>
        props.contacts.find((c) => c.id === id)?.name
        ?? props.solicitors?.find((s) => s.id === id)?.name
      )
      .filter((n): n is string => !!n);
    setOptimistic((prev) => [
      {
        kind: "comm",
        id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date(),
        type,
        method,
        content,
        createdById: null,
        createdByName: props.currentUserName,
        createdByImage: null,
        createdByRole: props.currentUserRole,
        contactNames,
        contactIds,
        visibleToClient: false,
        wasEdited: false,
        wasAiGenerated: false,
        isAutomated: false,
        tone: null,
      },
      ...prev,
    ]);
  }

  return (
    <ActivityTimeline
      entries={merged}
      transactionId={props.transactionId}
      mosDocUrl={props.mosDocUrl}
      currentUserId={props.currentUserId}
      contacts={props.contacts}
      solicitors={props.solicitors}
      beforeEntries={
        <CommsEntry
          transactionId={props.transactionId}
          contacts={props.contacts}
          solicitors={props.solicitors}
          canPasteChat={props.canPasteChat}
          onOptimisticAdd={handleOptimisticAdd}
        />
      }
    />
  );
}
