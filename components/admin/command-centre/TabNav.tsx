"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/command-centre",              label: "Overview"     },
  { href: "/admin/command-centre/signals",      label: "Signals"      },
  { href: "/admin/command-centre/experiments",  label: "Experiments"  },
  { href: "/admin/command-centre/deployments",  label: "Deployments"  },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 px-8 pb-0 border-b border-white/10">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/admin/command-centre"
            ? pathname === "/admin/command-centre"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-sm px-4 py-2.5 font-medium border-b-2 transition-colors -mb-px ${
              isActive
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
