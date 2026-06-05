"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { format, parseISO, differenceInDays, isWithinInterval, startOfDay } from "date-fns";
import {
  Dumbbell,
  Layers,
  BarChart3,
  Plus,
  Target,
  Activity,
  CalendarDays,
  ChevronRight,
  Flame,
  ArrowRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Block, WorkoutLog } from "@/lib/types";

// ─── Shared section label ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
        {children}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── Stat computation ─────────────────────────────────────────────────────────

interface BlockStats {
  totalWorkouts: number;
  totalSets: number;
  avgRpe: number | null;
}

function computeBlockStats(logs: WorkoutLog[], block: Block): BlockStats {
  const start = startOfDay(parseISO(block.startDate));
  const end = block.endDate ? startOfDay(parseISO(block.endDate)) : new Date();
  const inBlock = logs.filter((log) =>
    isWithinInterval(parseISO(log.date), { start, end })
  );

  const totalWorkouts = inBlock.length;
  const totalSets = inBlock.reduce(
    (acc, log) => acc + log.exercises.reduce((ea, ex) => ea + ex.sets.length, 0),
    0
  );

  const rpeValues: number[] = [];
  inBlock.forEach((log) =>
    log.exercises.forEach((ex) =>
      ex.sets.forEach((s) => { if (s.rpe !== undefined) rpeValues.push(s.rpe); })
    )
  );
  const avgRpe =
    rpeValues.length > 0
      ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length
      : null;

  return { totalWorkouts, totalSets, avgRpe };
}

// ─── Active block hero card ───────────────────────────────────────────────────

function ActiveBlockCard({ block, stats }: { block: Block; stats: BlockStats }) {
  const start = parseISO(block.startDate);
  const end = block.endDate ? parseISO(block.endDate) : null;
  const today = new Date();
  const elapsed = differenceInDays(today, start);
  const total = end ? differenceInDays(end, start) : null;
  const remaining = end ? differenceInDays(end, today) : null;

  return (
    <div className="hero-gradient card-elevated rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60 mb-1.5">
              Active Block
            </p>
            <h2 className="text-2xl font-black leading-tight truncate text-white">
              {block.name}
            </h2>
          </div>
          <Link href="/train">
            <button className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          </Link>
        </div>

        {/* Goal */}
        <div className="flex items-start gap-2 mt-3">
          <Target className="h-3.5 w-3.5 mt-0.5 shrink-0 text-white/60" />
          <p className="text-sm text-white/85 leading-snug">{block.goal}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 border-t border-white/15">
        {[
          { label: "Workouts", value: stats.totalWorkouts },
          { label: "Sets",     value: stats.totalSets },
          { label: "Avg RPE",  value: stats.avgRpe !== null ? stats.avgRpe.toFixed(1) : "—" },
        ].map(({ label, value }, i) => (
          <div
            key={label}
            className={cn(
              "px-4 py-3 text-center",
              i < 2 && "border-r border-white/15"
            )}
          >
            <p className="text-lg font-black text-white leading-none">{value}</p>
            <p className="text-[10px] text-white/55 font-medium mt-0.5 uppercase tracking-wide">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {total !== null && (
        <div className="px-5 pb-4 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-white/55 font-medium">
              {format(start, "MMM d")}
            </span>
            <Badge className="bg-white/15 text-white border-0 text-[10px]">
              {remaining !== null && remaining >= 0
                ? remaining === 0 ? "Last day" : `${remaining}d left`
                : remaining !== null ? "Completed"
                : `Day ${elapsed + 1}`}
            </Badge>
            {end && (
              <span className="text-[10px] text-white/55 font-medium">
                {format(end, "MMM d")}
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-white/15">
            <div
              className="h-1.5 rounded-full bg-white transition-all"
              style={{
                width: `${Math.min(100, Math.max(2, ((elapsed + 1) / (total + 1)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── No block empty state ─────────────────────────────────────────────────────

function NoBlockCard() {
  return (
    <Card className="border border-border/60">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-5">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Layers className="h-8 w-8 text-primary/70" strokeWidth={1.5} />
        </div>
        <div className="space-y-1.5">
          <p className="font-bold text-base">No active training block</p>
          <p className="text-sm text-muted-foreground max-w-[200px]">
            Set up your first block to start tracking progress.
          </p>
        </div>
        <Link href="/train">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Block
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Block stat card ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card className="border-l-2 border-l-primary">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.75} />
        </div>
        <p className="text-3xl font-black leading-none tracking-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground font-medium">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Recent workout row ───────────────────────────────────────────────────────

function RecentWorkoutRow({ log }: { log: WorkoutLog }) {
  const totalSets = log.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const exerciseNames = log.exercises.map((e) => e.exerciseName).slice(0, 2);
  const more = log.exercises.length > 2 ? log.exercises.length - 2 : 0;

  return (
    <Link href="/log">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors cursor-pointer">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Dumbbell className="h-4 w-4 text-primary" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">
            {log.routineName ?? "Free Workout"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {exerciseNames.join(", ")}
            {more > 0 ? ` +${more} more` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold">{format(parseISO(log.date), "MMM d")}</p>
          <p className="text-[10px] text-muted-foreground">{totalSets} sets</p>
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto animate-pulse">
      <div className="h-44 rounded-xl bg-muted" />
      <div className="space-y-3">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted" />)}
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="h-14 rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 rounded-xl bg-muted" />
          <div className="h-12 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardContent() {
  const [mounted, setMounted] = useState(false);
  const blocks = useAppStore((s) => s.blocks);
  const workoutLogs = useAppStore((s) => s.workoutLogs);

  useEffect(() => { setMounted(true); }, []);

  const activeBlock = useMemo(() => blocks.find((b) => b.isActive) ?? null, [blocks]);
  const stats = useMemo(
    () => (activeBlock ? computeBlockStats(workoutLogs, activeBlock) : null),
    [workoutLogs, activeBlock]
  );
  const recentWorkouts = useMemo(
    () => [...workoutLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [workoutLogs]
  );

  if (!mounted) return <DashboardSkeleton />;

  return (
    <div className="p-4 pb-6 space-y-7 max-w-lg mx-auto">

      {/* Active block hero */}
      {activeBlock ? (
        <ActiveBlockCard block={activeBlock} stats={stats!} />
      ) : (
        <NoBlockCard />
      )}

      {/* Quick actions */}
      <section>
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="space-y-3">
          <Link href="/log" className="block">
            <Button className="w-full h-14 text-base font-bold gap-3 shadow-sm" size="lg">
              <Dumbbell className="h-5 w-5" />
              Log Workout
            </Button>
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/train" className="block">
              <Button variant="outline" className="w-full h-12 gap-2 font-semibold">
                <Layers className="h-4 w-4" />
                Training
              </Button>
            </Link>
            <Link href="/reports" className="block">
              <Button variant="outline" className="w-full h-12 gap-2 font-semibold">
                <BarChart3 className="h-4 w-4" />
                Reports
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <SectionLabel>Recent Activity</SectionLabel>
        {recentWorkouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <Activity className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm">No workouts logged yet</p>
              <p className="text-xs text-muted-foreground">Tap "Log Workout" above to get started.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.map((log) => (
              <RecentWorkoutRow key={log.id} log={log} />
            ))}
            {workoutLogs.length > 3 && (
              <Link href="/reports">
                <button className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 font-medium">
                  View all {workoutLogs.length} sessions
                  <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
