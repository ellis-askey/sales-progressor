"use client";

import { useEffect } from "react";

// Opening a file should land at the top. The file shell is a layout that stays
// mounted across tab navigation, and the client router restores the previous
// scroll position when you return to a cached file — so clicking into a file
// (e.g. from search) could leave you part-way down the page. Resetting on the
// transaction id means: a NEW file scrolls to top, but switching tabs within the
// same file (id unchanged) does not, so it never fights in-file navigation.
export function ScrollTopOnFileChange({ id }: { id: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [id]);
  return null;
}
