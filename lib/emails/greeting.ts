// Time-based greeting for solicitor-facing emails.
//
// We deliberately do NOT greet by name: the solicitor contact is a single
// free-text `name` field that's sometimes a person, sometimes a firm or a
// team ("Conveyancing Team"), so "Hi {name}" misfires. Greeting by time of
// day is always safe and reads professionally. Uses London local time so it's
// correct year-round through BST/GMT.
export function timeGreeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  return hour < 12 ? "Good morning" : "Good afternoon";
}
