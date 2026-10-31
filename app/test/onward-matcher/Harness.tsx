"use client";

// Client wrapper for the /test harness: renders the real matcher and persists
// the agent's matches through saveOnwardPersonTiesAction.

import { useState } from "react";
import { OnwardPeopleMatcher, type MatchContact } from "@/components/chain/OnwardPeopleMatcher";
import { saveOnwardPersonTiesAction } from "@/app/actions/onward-people";

export function OnwardMatcherHarness({
  transactionId,
  ourAddress,
  neighbourAddress,
  ourContacts,
  theirContacts,
}: {
  transactionId: string;
  ourAddress: string;
  neighbourAddress: string;
  ourContacts: MatchContact[];
  theirContacts: MatchContact[];
}) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onSave(pairs: Record<string, string | null>) {
    setSaving(true);
    setResult(null);
    try {
      const tiePairs = Object.entries(pairs)
        .filter((e): e is [string, string] => !!e[1])
        .map(([ourContactId, theirContactId]) => ({ ourContactId, theirContactId }));
      const res = await saveOnwardPersonTiesAction(transactionId, tiePairs);
      setResult(
        res.ok
          ? `Saved ${res.tied} match${res.tied === 1 ? "" : "es"}. Those people can now confirm their onward steps from their sale portal.`
          : `Couldn't save: ${res.error}`,
      );
    } catch (e) {
      setResult("Something went wrong saving the matches.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <OnwardPeopleMatcher
        ourAddress={ourAddress}
        neighbourAddress={neighbourAddress}
        ourContacts={ourContacts}
        theirContacts={theirContacts}
        onSave={onSave}
        saving={saving}
      />
      {result && (
        <p style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--agent-success)" }}>{result}</p>
      )}
    </>
  );
}
