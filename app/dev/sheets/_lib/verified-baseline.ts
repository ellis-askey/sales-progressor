// Banked snapshot of the reviewer's /dev/sheets "verified" marks.
//
// Why this exists: verification is stored only in the browser's localStorage
// (key sp:dev-sheets:verified:v1). An incognito window wipes that on close, so
// a review pass could vanish. This file is a version-controlled copy so the
// progress survives anything. useVerification() seeds from it the first time a
// browser opens /dev/sheets (i.e. no localStorage key yet) — e.g. a fresh
// incognito session auto-restores instead of starting blank.
//
// To refresh this snapshot after more reviewing: on /dev/sheets run
//   copy(localStorage.getItem('sp:dev-sheets:verified:v1'))
// in the console, then paste the ids into the array below.
//
// Snapshot taken: 2026-09-11 (41 verified).

export const VERIFIED_BASELINE: string[] = [
  // Drawers
  "bench-drawer",
  "drawer-chain",
  "drawer-add-node",
  "drawer-chase",
  "drawer-intro-call",
  "drawer-stamp-duty",
  "drawer-email-settings",
  "drawer-email-detail",
  "drawer-archived-round",
  "drawer-reconciliation",
  "drawer-account-shell",
  "drawer-member-manage",
  // Modals
  "bench-modal",
  "modal-feedback-widget",
  "modal-add-broker",
  "modal-partner-popup",
  "modal-add-firm",
  "modal-undo-milestone",
  "modal-mortgage",
  "modal-survey-nr-confirm",
  "modal-survey-booking",
  "modal-exchange-celebration",
  "modal-switch-service-type",
  "modal-exchange-day-control",
  "modal-status-control",
  "modal-missing-fee-row",
  "modal-welcome",
  "modal-account-danger-zone",
  // Notifications
  "notice-empty-state",
  "notice-analytics-empty-state",
  "notice-reconcile-later-banner",
  "notice-onboarding-checklist",
  "notice-setup-card",
  "notice-hub-empty-state",
  "notice-hub-empty-welcome-card",
  "notice-no-chain-setup-card",
  "notice-needs-attention-panel",
  "notice-all-files-empty-state",
  "notice-todo-empty-state",
  "notice-partners-empty-state",
  "notice-comms-empty-state",
];
