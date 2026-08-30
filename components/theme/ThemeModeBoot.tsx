// Server component. Renders an inline <script> that runs BEFORE React
// hydrates, setting data-theme + the elevra-bg class on <html> so the
// first paint has the right background. Without this the page would
// flash on the default theme for one frame while the client hook resolves.
// Elevra-backgrounds pass, 2026-08-08.
//
// The script also registers a matchMedia listener so that when the user's
// mode is "system", flipping the OS from light to dark updates the app
// live without a reload. The toggle component (ThemeModeToggle) mutates
// the shared window flag this listener reads, so the listener knows the
// current mode without re-mounting.
//
// Mounted in AgentShell + AppShell in commit C. Keep this component
// server-only — it must render before hydration begins.

import type { ThemeMode } from "@/lib/agent/theme-mode";

export function ThemeModeBoot({
  initialMode,
  initialAuroraOpacity = 100,
}: {
  initialMode: ThemeMode;
  // Per-user aurora intensity 0–100. Applied here pre-paint as --aurora-opacity
  // (0–1) so the background starts at the saved level with no flash.
  initialAuroraOpacity?: number;
}) {
  // Everything below runs as a string in the client's HTML head, so keep
  // it dependency-free and defensive. Both values are embedded via
  // JSON.stringify — always plain literals, no user-controlled input.
  const script = `
(function() {
  try {
    var initial = ${JSON.stringify(initialMode)};
    var auroraOpacity = ${JSON.stringify(initialAuroraOpacity)};
    var w = window;
    var mq = w.matchMedia('(prefers-color-scheme: dark)');
    w.__salesProgressorThemeMode__ = initial;
    document.documentElement.style.setProperty('--aurora-opacity', String(Math.max(0, Math.min(100, auroraOpacity)) / 100));
    var apply = function() {
      var mode = w.__salesProgressorThemeMode__;
      var resolved = (mode === 'light' || mode === 'dark')
        ? mode
        : (mq.matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.add('elevra-bg');
    };
    apply();
    mq.addEventListener('change', function() {
      if (w.__salesProgressorThemeMode__ === 'system') apply();
    });
  } catch (e) { /* ignore — CSS default kicks in */ }
})();
`;
  // `async` makes React 19 treat this as a hoistable head resource (moved to
  // <head>, deduped) instead of a body script — which silences the dev warning
  // "Encountered a script tag while rendering React component". `async` is
  // ignored by the browser for inline scripts, so it still runs pre-paint.
  return <script async dangerouslySetInnerHTML={{ __html: script }} />;
}
