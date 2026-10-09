"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivitySquare,
  AudioLines,
  Bot,
  LayoutGrid,
  ListChecks,
  PhoneCall,
  Plug,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ACCENTS, type Accent } from "./ui";

const NAV: { href: string; label: string; icon: LucideIcon; accent: Accent }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, accent: "lilac" },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound, accent: "pink" },
  { href: "/dashboard/calls", label: "Calls", icon: PhoneCall, accent: "mint" },
  { href: "/dashboard/tasks", label: "Tasks", icon: ListChecks, accent: "amber" },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug, accent: "sky" },
  { href: "/dashboard/voice-stack", label: "Voice stack", icon: AudioLines, accent: "pink" },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: ActivitySquare, accent: "coral" },
  { href: "/dashboard/playground", label: "Playground", icon: Bot, accent: "lilac" },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Sidebar (desktop) / scrollable chip row (mobile) navigation. */
export default function DashboardNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname() ?? "";
  const vertical = orientation === "vertical";
  return (
    <nav aria-label="Dashboard">
      <ul className={vertical ? "space-y-1.5" : "flex gap-2 overflow-x-auto pb-1"}>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const a = ACCENTS[item.accent];
          const Icon = item.icon;
          return (
            <li key={item.href} className={vertical ? undefined : "shrink-0"}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring flex items-center gap-3 rounded-2xl font-bold transition-all duration-200 ${
                  vertical ? "px-3 py-2.5 text-[15px]" : "px-3.5 py-2 text-sm"
                } ${active ? "text-[color:var(--color-slate)]" : "text-[color:var(--color-slate)]/60 hover:text-[color:var(--color-slate)]"}`}
                style={
                  active
                    ? {
                        background: "#FFFCF7",
                        boxShadow:
                          "6px 8px 18px -10px rgba(38,52,69,0.35), inset -3px -3px 8px rgba(38,52,69,0.07), inset 4px 4px 9px rgba(255,255,255,0.9)",
                      }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white transition-transform duration-200"
                  style={{
                    background: active
                      ? `linear-gradient(145deg, ${a.light} 0%, ${a.base} 70%)`
                      : `linear-gradient(145deg, ${a.soft} 0%, ${a.light} 100%)`,
                    boxShadow: active
                      ? `0 6px 12px -8px ${a.base}, inset -2px -3px 6px rgba(0,0,0,0.12), inset 2px 2px 5px rgba(255,255,255,0.55)`
                      : "inset 2px 2px 5px rgba(255,255,255,0.7)",
                    color: active ? "#fff" : a.ink,
                  }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.4} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
