// The single live chase for a reminder.
//
// A reminder log should only ever have one pending ChaseTask, but an old race
// occasionally left a stray second one. When that happened the UI's plain
// `.find(pending)` could pick the un-chased stray and make a genuinely-chased
// row read "Not chased yet" (see 14 Cedar Green, 2026-09). This picks the
// MOST-PROGRESSED pending chase instead — most chased, then most recently
// chased, then latest due — so a duplicate can never make a row lie about its
// state. With the normal one-pending case it just returns that one.

export type ChaseLike = {
  status: string;
  chaseCount?: number | null;
  lastChasedAt?: Date | string | null;
  dueDate?: Date | string | null;
};

function ms(d: Date | string | null | undefined): number {
  return d ? new Date(d).getTime() : 0;
}

function moreProgressed(a: ChaseLike, b: ChaseLike): boolean {
  const ac = a.chaseCount ?? 0;
  const bc = b.chaseCount ?? 0;
  if (ac !== bc) return ac > bc;
  const al = ms(a.lastChasedAt);
  const bl = ms(b.lastChasedAt);
  if (al !== bl) return al > bl;
  return ms(a.dueDate) > ms(b.dueDate);
}

export function pickLiveChase<T extends ChaseLike>(tasks: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const t of tasks) {
    if (t.status !== "pending") continue;
    if (!best || moreProgressed(t, best)) best = t;
  }
  return best;
}
