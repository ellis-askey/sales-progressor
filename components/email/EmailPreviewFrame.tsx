"use client";

// A sandboxed iframe that renders a real email's HTML and grows to fit it, so
// the whole email shows in one piece (no fixed height, no awkward inner scroll)
// and the surrounding drawer/modal scrolls as a single surface.
//
// sandbox="allow-same-origin" (but NOT allow-scripts) lets the parent read the
// rendered document height to size the frame, while still executing none of the
// email's markup as script. The HTML is our own trusted template output.
// previewSrcDoc makes the fixed 560px inbox card fluid so it fills the width.

import { useCallback, useRef, useState } from "react";
import { previewSrcDoc } from "@/lib/email/preview-srcdoc";

export function EmailPreviewFrame({
  html,
  title = "Email preview",
  minHeight = 200,
}: {
  html: string;
  title?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);

  const measure = useCallback(() => {
    const doc = ref.current?.contentDocument;
    const h = doc?.body?.scrollHeight ?? doc?.documentElement?.scrollHeight ?? 0;
    if (h > 0) setHeight(Math.max(minHeight, h + 4));
  }, [minHeight]);

  const onLoad = useCallback(() => {
    measure();
    // Images (agency logo, agent photo) can reflow after the initial load —
    // re-measure a couple of times so the frame settles at the true height.
    const t1 = setTimeout(measure, 200);
    const t2 = setTimeout(measure, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [measure]);

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={previewSrcDoc(html)}
      sandbox="allow-same-origin"
      onLoad={onLoad}
      scrolling="no"
      style={{ width: "100%", height, border: "none", background: "#fff", display: "block" }}
    />
  );
}
