// Shared SLA display for how long an outsourced file has been waiting to be
// assigned an SP progressor. Amber once it has waited 48 hours, red at 72.
// Used by both hub cards (legacy AttentionCard + kinetic InternalOnlyCards).

export type AssignWaitLevel = "ok" | "amber" | "red";

export function assignWaitBadge(since: Date): { text: string; level: AssignWaitLevel } {
  const hours = (Date.now() - new Date(since).getTime()) / 3600000;
  const level: AssignWaitLevel = hours >= 72 ? "red" : hours >= 48 ? "amber" : "ok";
  let text: string;
  if (hours < 1) text = "just now";
  else if (hours < 24) text = `${Math.floor(hours)}h`;
  else {
    const d = Math.floor(hours / 24);
    const h = Math.floor(hours % 24);
    text = h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  return { text, level };
}
