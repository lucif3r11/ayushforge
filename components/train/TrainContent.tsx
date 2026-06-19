"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import DetailedBlockView from "@/components/train/DetailedBlockView";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TrainSkeleton() {
  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto animate-pulse">
      <div className="h-6 w-24 rounded bg-muted" />
      <div className="h-48 rounded-xl bg-muted" />
      <div className="h-14 rounded-xl bg-muted" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrainContent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <TrainSkeleton />;

  return (
    <div className="p-4 pb-8 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Train</h1>
        <Link href="/log">
          <Button size="sm" variant="outline" className="gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" />
            Free Log
          </Button>
        </Link>
      </div>

      <DetailedBlockView />

      <Link href="/log" className="block">
        <Button className="w-full h-14 text-base font-semibold gap-3" size="lg">
          <Dumbbell className="h-5 w-5" />
          Log Workout
        </Button>
      </Link>
    </div>
  );
}
