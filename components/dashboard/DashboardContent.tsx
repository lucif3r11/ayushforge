"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  format,
  parseISO,
  differenceInDays,
  isWithinInterval,
  startOfDay,
} from "date-fns";
import {
  Dumbbell,
  Clock,
  Layers,
  BarChart3,
  Plus,
  Activity,
  ArrowRight,
  Flame,
  Drumstick,
  Wheat,
  Droplet,
  ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Block, MacroPlan, WorkoutLog } from "@/lib/types";

// ─── Motion presets ───────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const bentoVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 280, damping: 24 },
  },
};

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function logsInBlock(logs: WorkoutLog[], block: Block): WorkoutLog[] {
  const start = startOfDay(parseISO(block.startDate));
  const end = block.endDate ? startOfDay(parseISO(block.endDate)) : new Date();
  return logs.filter((log) =>
    isWithinInterval(parseISO(log.date), { start, end })
  );
}

function sumLiftingMinutes(logs: WorkoutLog[]): number {
  return logs.reduce((acc, log) => acc + (log.durationMinutes ?? 0), 0);
}

function formatLiftingTime(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function blockProgress(block: Block): { pct: number; label: string } | null {
  const start = parseISO(block.startDate);
  const end = block.endDate ? parseISO(block.endDate) : null;
  if (!end) return null;

  const total = differenceInDays(end, start);
  const elapsed = differenceInDays(new Date(), start);
  const remaining = differenceInDays(end, new Date());

  if (total <= 0) return null;

  const pct = Math.min(100, Math.max(0, ((elapsed + 1) / (total + 1)) * 100));
  const label =
    remaining < 0
      ? "Completed"
      : remaining === 0
        ? "Last day"
        : `${remaining}d remaining`;

  return { pct, label };
}

function macroSnapshot(plan: MacroPlan) {
  const dayPlan = plan.dayPlans[0];
  if (!dayPlan) return null;

  return dayPlan.meals.reduce(
    (acc, meal) => {
      meal.items.forEach((item) => {
        acc.kcal += item.kcal || 0;
        acc.protein += item.protein || 0;
        acc.carbs += item.carbs || 0;
        acc.fat += item.fat || 0;
      });
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// ─── Bento shell ──────────────────────────────────────────────────────────────

function BentoBox({
  children,
  className,
  as: Tag = "div",
  href,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "article";
  href?: string;
}) {
  const shell = (
    <motion.div
      variants={bentoVariants}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "relative overflow-hidden rounded-sm border border-border bg-card",
        "transition-shadow duration-200",
        "hover:border-primary/30 hover:shadow-[0_0_24px_hsl(186_100%_50%/0.08)]",
        href && "cursor-pointer",
        className
      )}
    >
      {children}
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {shell}
      </Link>
    );
  }

  return <Tag>{shell}</Tag>;
}

// ─── Tactical Welcome Vault ───────────────────────────────────────────────────

function WelcomeVault({
  blockName,
  blockPeriod,
  hasBlock,
}: {
  blockName: string | null;
  blockPeriod?: string;
  hasBlock: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <BentoBox className="col-span-2 border-primary/20 bg-card/50 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-4 py-3 min-h-[72px]">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">
            Tactical HUD
          </p>
          <p className="font-data text-lg font-bold leading-tight tabular-nums">
            {format(now, "EEEE, MMM d")}
          </p>
          <p className="font-data text-2xl font-black leading-none text-primary tabular-nums tracking-tight">
            {format(now, "HH:mm:ss")}
          </p>
        </div>

        <div className="text-right min-w-0 shrink">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Active Block
          </p>
          {hasBlock ? (
            <>
              <p className="font-semibold text-sm truncate max-w-[160px] ml-auto">
                {blockName}
              </p>
              {blockPeriod && (
                <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[160px] ml-auto">
                  {blockPeriod}
                </p>
              )}
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wide text-toxic">
                <span className="h-1.5 w-1.5 rounded-full bg-toxic animate-pulse" />
                Online
              </span>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Standby</p>
          )}
        </div>
      </div>
    </BentoBox>
  );
}

// ─── Recent workout row ───────────────────────────────────────────────────────

function RecentWorkoutRow({ log }: { log: WorkoutLog }) {
  const totalSets = log.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const exerciseNames = log.exercises.map((e) => e.exerciseName).slice(0, 2);
  const more = log.exercises.length > 2 ? log.exercises.length - 2 : 0;

  return (
    <Link href="/log">
      <div className="flex items-center gap-3 px-4 py-3 rounded-sm border border-border bg-card hover:bg-secondary/60 transition-colors cursor-pointer">
        <div className="rounded-sm bg-primary/10 p-2 shrink-0 border border-primary/20">
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
        <div className="text-right shrink-0 font-data tabular-nums">
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
    <div className="p-4 space-y-4 max-w-lg mx-auto animate-pulse">
      <div className="h-[72px] rounded-sm bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 h-28 rounded-sm bg-muted" />
        <div className="h-36 rounded-sm bg-muted" />
        <div className="h-36 rounded-sm bg-muted" />
      </div>
      <div className="h-14 rounded-sm bg-muted" />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardContent() {
  const [mounted, setMounted] = useState(false);
  const blocks = useAppStore((s) => s.blocks);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const detailedBlocks = useAppStore((s) => s.detailedBlocks);
  const macroPlan = useAppStore((s) => s.macroPlan);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeBlock = useMemo(
    () => blocks.find((b) => b.isActive) ?? null,
    [blocks]
  );

  const activeDetailedBlock = useMemo(
    () => detailedBlocks[detailedBlocks.length - 1] ?? null,
    [detailedBlocks]
  );

  const blockName =
    activeDetailedBlock?.name ?? activeBlock?.name ?? null;
  const blockPeriod = activeDetailedBlock?.period;
  const hasBlock = Boolean(blockName);

  const scopedLogs = useMemo(
    () => (activeBlock ? logsInBlock(workoutLogs, activeBlock) : workoutLogs),
    [workoutLogs, activeBlock]
  );

  const liftingMinutes = useMemo(
    () => sumLiftingMinutes(scopedLogs),
    [scopedLogs]
  );

  const completedSessions = scopedLogs.length;

  const progress = useMemo(
    () => (activeBlock ? blockProgress(activeBlock) : null),
    [activeBlock]
  );

  const macros = useMemo(() => macroSnapshot(macroPlan), [macroPlan]);

  const recentWorkouts = useMemo(
    () =>
      [...workoutLogs]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3),
    [workoutLogs]
  );

  if (!mounted) return <DashboardSkeleton />;

  return (
    <div className="p-4 pb-6 space-y-6 max-w-lg mx-auto">
      {/* ── Asymmetrical Bento Grid ─────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <WelcomeVault
          blockName={blockName}
          blockPeriod={blockPeriod}
          hasBlock={hasBlock}
        />

        {/* Box 1 — double width: lifting time + block progress */}
        <BentoBox className="col-span-2 p-4 min-h-[112px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Lifting Time Accumulated
              </p>
              <p className="font-data text-4xl sm:text-5xl font-black leading-none text-primary mt-2 tabular-nums drop-shadow-[0_0_18px_hsl(186_100%_50%/0.45)]">
                {formatLiftingTime(liftingMinutes)}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-2">
                {activeBlock ? "Current block scope" : "All-time total"}
              </p>
            </div>
            <Clock className="h-5 w-5 text-primary/50 shrink-0" strokeWidth={1.75} />
          </div>

          {progress && (
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Active Block Progress
                </p>
                <span className="font-data text-[10px] text-primary tabular-nums">
                  {Math.round(progress.pct)}%
                </span>
              </div>
              <div className="h-1 rounded-none bg-border border border-border overflow-hidden">
                <motion.div
                  className="h-full bg-primary shadow-[0_0_8px_hsl(186_100%_50%/0.6)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.4 }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                {progress.label}
              </p>
            </div>
          )}
        </BentoBox>

        {/* Box 2 — square: completed sessions */}
        <BentoBox href="/reports" className="p-3 min-h-[148px] flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Completed Sessions
          </p>
          <div className="relative flex-1 flex items-end overflow-visible">
            <p
              className={cn(
                "font-data font-black leading-[0.85] text-primary tabular-nums",
                "text-[4.5rem] -mb-3 -mr-3 select-none",
                "drop-shadow-[0_0_20px_hsl(186_100%_50%/0.35)]"
              )}
              aria-label={`${completedSessions} completed sessions`}
            >
              {completedSessions}
            </p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
            View reports
            <ChevronRight className="h-3 w-3" />
          </div>
        </BentoBox>

        {/* Box 3 — square: macro overview */}
        <BentoBox href="/nutrition" className="p-3 min-h-[148px] flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Macro Overview
          </p>

          {macros ? (
            <div className="mt-3 space-y-2 flex-1">
              <div className="flex items-center gap-1.5 font-data text-sm font-bold text-foreground">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span className="tabular-nums">{Math.round(macros.kcal)}</span>
                <span className="text-[10px] text-muted-foreground font-sans font-medium">kcal</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-data tabular-nums">
                <span className="flex items-center gap-0.5 text-blue-400">
                  <Drumstick className="h-3 w-3" />
                  {Math.round(macros.protein)}g
                </span>
                <span className="flex items-center gap-0.5 text-amber-400">
                  <Wheat className="h-3 w-3" />
                  {Math.round(macros.carbs)}g
                </span>
                <span className="flex items-center gap-0.5 text-emerald-400">
                  <Droplet className="h-3 w-3" />
                  {Math.round(macros.fat)}g
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center gap-1 py-2">
              <p className="text-xs text-muted-foreground">No macro plan</p>
              <p className="text-[10px] text-primary font-semibold">Tap to configure</p>
            </div>
          )}

          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium mt-auto pt-2">
            Open nutrition
            <ChevronRight className="h-3 w-3" />
          </div>
        </BentoBox>
      </motion.div>

      {/* ── No block CTA ────────────────────────────────────────────────── */}
      {!hasBlock && (
        <div className="rounded-sm border border-dashed border-border bg-card/40 px-4 py-5 text-center space-y-3">
          <div className="h-12 w-12 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Layers className="h-6 w-6 text-primary/70" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-sm">No active training block</p>
            <p className="text-xs text-muted-foreground">
              Import a detailed block to activate the HUD.
            </p>
          </div>
          <Link href="/train">
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Create First Block
            </Button>
          </Link>
        </div>
      )}

      {/* ── Quick actions ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
            Quick Actions
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="space-y-2">
          <Link href="/log" className="block">
            <Button className="w-full h-12 text-sm font-bold gap-2 rounded-sm" size="lg">
              <Dumbbell className="h-4 w-4" />
              Log Workout
            </Button>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/train" className="block">
              <Button variant="outline" className="w-full h-10 gap-2 font-semibold rounded-sm text-xs">
                <Layers className="h-3.5 w-3.5" />
                Training
              </Button>
            </Link>
            <Link href="/reports" className="block">
              <Button variant="outline" className="w-full h-10 gap-2 font-semibold rounded-sm text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Reports
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Recent activity ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
            Recent Activity
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
        {recentWorkouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3 rounded-sm border border-border bg-card/30">
            <div className="h-12 w-12 rounded-sm bg-muted flex items-center justify-center border border-border">
              <Activity className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm">No workouts logged yet</p>
              <p className="text-xs text-muted-foreground">
                Tap &ldquo;Log Workout&rdquo; to get started.
              </p>
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
