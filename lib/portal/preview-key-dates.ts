// Example "Key dates" values for the Client-portal SETTINGS preview only (the
// card an agency director / SP owner sees when toggling "Key dates" on/off). Kept
// relative to now and computed server-side per request, so the example never
// shows a stale, past-dated target as real time moves on. Not used on any real
// client portal — those read the sale's actual dates.

export type ExampleKeyDates = { targetDate: Date; estimateDate: Date; daysUntilPredicted: number };

export function examplePreviewKeyDates(now: Date = new Date()): ExampleKeyDates {
  const add = (days: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  };
  // ~6-7 weeks ahead: a believable mid-sale 12-week target + estimated exchange,
  // always comfortably in the future.
  return { targetDate: add(42), estimateDate: add(49), daysUntilPredicted: 49 };
}
