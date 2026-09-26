// File-page tab content entrance (ij13f6). A tiny server-component wrapper that
// applies the .file-tab-enter CSS animation (fade + rise) to a tab's content.
// Pure CSS: the animation runs once when the element mounts, and because each
// tab is its own route segment the content remounts on navigation, so it
// replays every time you switch tabs. Respects prefers-reduced-motion.
export function TabEnter({ children }: { children: React.ReactNode }) {
  return <div className="file-tab-enter">{children}</div>;
}
