"use client";

import { Dumbbell } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function AppHeader() {
  const blocks = useAppStore((s) => s.blocks);
  const activeBlock = blocks.find((b) => b.isActive);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-b border-border shadow-[0_1px_0_0_hsl(180_100%_50%/0.08)]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="h-14 flex items-center px-4 gap-3">
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="rounded-sm bg-primary p-1.5">
          <Dumbbell className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-extrabold text-base tracking-tight">IRONCLAD</span>
      </div>

      {activeBlock && (
        <>
          <span className="text-border text-sm">│</span>
          <span className="text-sm text-muted-foreground truncate font-medium">
            {activeBlock.name}
          </span>
        </>
      )}
      </div>
    </header>
  );
}
