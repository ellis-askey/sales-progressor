import type { TimelineEntry } from "@/lib/services/portal";
import type { ActorRole } from "@/components/ui/Avatar";

// Universal avatar mapping for a portal timeline row: WHO the row represents,
// so every confirmation surface (the "Since you were last here" recap, the
// Overview "Latest updates" card, the Updates tab) renders the SAME branded
// tsp-avatar via ActorAvatar — coloured by role:
//   seller → blue, buyer → green, progressor/agent → orange, solicitor → grey,
// with the person's uploaded photo overriding the art when we have it.
//
// `viewerSide` gates photos: we never surface the OTHER side's picture across
// the deal, so an other-side client confirmation shows their side colour with
// no photo.
export type TimelineActor = { role: ActorRole; image: string | null; name: string };

export function timelineActor(
  entry: TimelineEntry,
  viewerSide: "vendor" | "purchaser",
): TimelineActor {
  if (entry.type === "milestone") {
    if (entry.confirmedByClient) {
      const role: ActorRole = entry.side === "vendor" ? "seller" : "buyer";
      const image = entry.side === viewerSide ? (entry.confirmedByContactImage ?? null) : null;
      return { role, image, name: entry.helperName ?? "You" };
    }
    if (entry.confirmedBySolicitorFirmName) {
      return { role: "solicitor", image: null, name: entry.confirmedBySolicitorFirmName };
    }
    return { role: "progressor", image: entry.completedByImage ?? null, name: entry.completedByName ?? "Your team" };
  }
  // A document or an agent update — from the team.
  return { role: "progressor", image: null, name: "Your team" };
}
