"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  BarChart3,
  Apple,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Dashboard", href: "/dashboard", activeOn: ["/dashboard"] },
  { label: "Train",     href: "/train",     activeOn: ["/train", "/block", "/log"] },
  { label: "Reports",   href: "/reports",   activeOn: ["/reports"] },
  { label: "Nutrition", href: "/nutrition", activeOn: ["/nutrition", "/diet"] },
  { label: "Progress",  href: "/progress",  activeOn: ["/progress"] },
] as const;

const iconMap: Record<string, React.ElementType> = {
  "/dashboard": LayoutDashboard,
  "/train":     Dumbbell,
  "/reports":   BarChart3,
  "/nutrition": Apple,
  "/progress":  TrendingUp,
};

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-background/90 backdrop-blur-md border-t border-border">
      <div className="h-full flex items-center justify-around px-1">
        {tabs.map(({ label, href, activeOn }) => {
          const active = activeOn.some(
            (p) => pathname === p || pathname.startsWith(p + "/")
          );
          const Icon = iconMap[href];

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 h-full min-w-0 gap-0"
              aria-current={active ? "page" : undefined}
            >
              {/* Icon + label inside a pill */}
              <div
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className="h-5 w-5 shrink-0"
                  strokeWidth={active ? 2.5 : 1.75}
                />
                <span
                  className={cn(
                    "text-[10px] leading-none tracking-tight truncate",
                    active ? "font-bold" : "font-medium"
                  )}
                >
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
