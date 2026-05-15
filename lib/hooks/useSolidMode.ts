"use client";

import { useEffect, useState } from "react";

export function useSolidMode(): boolean {
  const [isSolid, setIsSolid] = useState(false);

  useEffect(() => {
    const check = () => setIsSolid(document.documentElement.hasAttribute("data-solid"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-solid"] });
    return () => observer.disconnect();
  }, []);

  return isSolid;
}
