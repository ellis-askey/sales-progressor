// Single kill-switch for the Solar Bold Duotone icon migration. The three
// dashboard layouts gate their <IconModeProvider> on this. Flip to `false` to
// instantly revert ALL dashboard icons to the original Phosphor/Lucide set —
// without touching the 267 converted files (the shims default to the original
// icon when the mode is "current"). This is the fast, no-risk rollback.
export const ICON_MIGRATION_ENABLED = true;
