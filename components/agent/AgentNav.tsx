"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/agent/hub-preview", label: "Hub ✦" },
  { href: "/agent/dashboard", label: "My Files" },
  { href: "/agent/completions", label: "Completions" },
  { href: "/agent/analytics", label: "Analytics" },
  { href: "/agent/comms", label: "Updates" },
];

export function AgentNav() {
  const pathname = usePathname();
  return (
    <nav style={{ display: "flex", gap: 4 }}>
      {links.map((l) => {
        const active = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? "#2563eb" : "#6b7280",
              padding: "6px 12px",
              borderRadius: 6,
              background: active ? "#eff6ff" : "transparent",
              textDecoration: "none",
              transition: "all 0.15s",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
