"use client";

import { useEffect, useRef } from "react";
import { markWhatsNewSeenAction } from "@/app/actions/agent-preferences";
import { refreshNavBadges } from "@/lib/agent/nav-badges-client";

// Clears the "What's new" unread dot — but only when the page is ACTUALLY opened
// (a mount effect), never on a hover-prefetch or a navigate-away. Persists the
// server-side seen stamp, then fires the shared nav-badge refresh so the dot
// drops immediately without a full reload. Renders nothing.
export function MarkWhatsNewSeen() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markWhatsNewSeenAction()
      .then(() => refreshNavBadges())
      .catch(() => {});
  }, []);
  return null;
}
