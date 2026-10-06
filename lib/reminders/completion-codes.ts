// Completion milestones (seller VM20 / buyer PM27). Completion is no longer
// surfaced as a reminder (critique 2026-10-05): it's owned by the Completions
// page, with a single hub Diary mention and a bespoke exchange→completion block
// on the file page. These codes are excluded from every reminder read surface
// (the Reminders page, the file-page Reminders tab, and the hub "Needs your
// attention" card) so the same completion never shows as both a reminder and a
// completion. Completion steps never sent chase emails anyway (they're marked
// "a phone call, not an email"), so nothing automated is lost.
export const COMPLETION_REMINDER_CODES = ["VM20", "PM27"] as const;
