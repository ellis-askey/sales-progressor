"use client";

import { useState, useTransition } from "react";
import { solicitorStopEmailsAction } from "../actions";

const NAVY = "#0f2740";

export function StopEmailsPanel({
  token,
  address,
  alreadyStopped,
}: {
  token: string;
  address: string;
  alreadyStopped: boolean;
}) {
  const [done, setDone] = useState(alreadyStopped);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <>
        <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: NAVY }}>You&rsquo;re unsubscribed</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#33475b" }}>
          We won&rsquo;t send you any more emails about <strong>{address}</strong>. You can still use any
          links you&rsquo;ve already received. If you&rsquo;d like them back on, just reply to a previous email.
        </p>
      </>
    );
  }

  return (
    <>
      <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: NAVY }}>Stop emails for this matter?</p>
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "#33475b" }}>
        We&rsquo;ll stop sending you progress-confirmation emails about <strong>{address}</strong>. This
        only affects this one matter, and you can still use any links you&rsquo;ve already received.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              await solicitorStopEmailsAction(token);
              setDone(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
            }
          })
        }
        style={{
          background: NAVY,
          color: "#ffffff",
          border: "none",
          fontSize: 14,
          fontWeight: 600,
          padding: "12px 20px",
          borderRadius: 7,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.55 : 1,
        }}
      >
        {pending ? "Saving…" : "Yes, stop these emails"}
      </button>
      {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#c0392b" }}>{error}</p>}
    </>
  );
}
