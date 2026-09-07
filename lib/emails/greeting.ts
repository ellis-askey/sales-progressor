// Time-based greeting, London local time so it's correct year-round through
// BST/GMT. Three bands: morning < 12:00, afternoon 12:00-16:59, evening >= 17:00.
//
// Used for solicitor-facing emails (where we deliberately do NOT greet by name:
// the contact `name` is sometimes a person, sometimes a firm or a "Conveyancing
// Team", so "Hi {name}" misfires) AND injected into AI chase generation so the
// model never guesses the time of day (it has no clock and always said "morning").
export function timeGreeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
