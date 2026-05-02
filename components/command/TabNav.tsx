"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/command/overview",      label: "Overview"     },
  { href: "/command/insights",      label: "Insights"     },
  { href: "/command/growth",        label: "Growth"       },
  { href: "/command/activation",    label: "Activation"   },
  { href: "/command/retention",     label: "Retention"    },
  { href: "/command/activity",      label: "Activity"     },
  { href: "/command/outbound",      label: "Outbound"     },
  { href: "/command/content",       label: "Content"      },
  { href: "/command/experiments",   label: "Experiments"  },
  { href: "/command/automations",   label: "Automations"  },
  { href: "/command/friction",      label: "Friction"     },
  { href: "/command/health",        label: "Health"       },
  { href: "/command/revenue",       label: "Revenue"      },
  { href: "/command/audit",         label: "Audit",        soon: true },
];

export function CommandTabNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 px-8 pb-0 border-b border-white/10 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        if (tab.soon) {
          return (
            <span
              key={tab.href}
              className="text-sm px-3.5 py-2.5 font-medium border-b-2 border-transparent text-white/25 cursor-default whitespace-nowrap -mb-px"
            >
              {tab.label}
            </span>
          );
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-sm px-3.5 py-2.5 font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
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
