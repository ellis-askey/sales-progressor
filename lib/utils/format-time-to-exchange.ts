// Countdown to the predicted exchange, shown in the file sidebar's "Time to
// exchange" row. Deliberately soft: exchange is never "overdue" (it exchanges
// when it exchanges), so once the estimate passes we say "Any day now" rather
// than counting up an overdue figure. The leading "~" carries the "it's an
// estimate, it can move" meaning without a sentence of explanation.

export function formatTimeToExchange(
  predicted: Date | null | undefined,
  weeksFallback: number,
): { text: string; amber: boolean } {
  const days = predicted
    ? Math.ceil((predicted.getTime() - Date.now()) / 86400000)
    : weeksFallback * 7;

  if (days <= 0) return { text: "Any day now", amber: true };

  const w = Math.floor(days / 7);
  const d = days % 7;
  const parts = [
    w > 0 ? `${w} week${w === 1 ? "" : "s"}` : "",
    d > 0 ? `${d} day${d === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return { text: `~${parts.join(", ") || "1 day"}`, amber: days <= 14 };
}
