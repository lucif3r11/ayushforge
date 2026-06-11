"use client";

import { useState, useEffect, useMemo } from "react";
import PdfExport from "./PdfExport";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  format,
  parse,
  parseISO,
  addDays,
  startOfWeek,
  differenceInDays,
  isWithinInterval,
  startOfDay,
} from "date-fns";
import {
  BarChart3,
  Dumbbell,
  Activity,
  Flame,
  Trophy,
  Layers,
  TrendingUp,
  CalendarDays,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { parseWeightKg } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import WorkoutHistory from "@/components/reports/WorkoutHistory";
import ExerciseProgress from "@/components/reports/ExerciseProgress";
import WorkoutHistoryImport from "@/components/reports/WorkoutHistoryImport";
import type { Block, WorkoutLog } from "@/lib/types";

// ─── Colour tokens (match globals.css chart vars) ────────────────────────────

const C1 = "hsl(12 76% 61%)";   // --chart-1  orange-red
const C2 = "hsl(173 58% 39%)";  // --chart-2  teal
const C3 = "hsl(43 74% 66%)";   // --chart-4  amber
const C4 = "hsl(220 70% 50%)";  // --chart-1 dark  blue (dark mode chart-1)

// ─── Data computations ────────────────────────────────────────────────────────

interface WeekVolume {
  week: string;      // "Jun 2–8"
  volume: number;    // kg × reps
}

function parseLocalDate(dateStr: string): Date {
  return parse(dateStr, "yyyy-MM-dd", new Date());
}

function computeWeeklyVolume(logs: WorkoutLog[]): WeekVolume[] {
  const volumeMap = new Map<string, number>();
  const labelMap = new Map<string, string>();

  logs.forEach((log) => {
    const weekStart = startOfWeek(parseLocalDate(log.date), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    const label = `${format(weekStart, "MMM d")}–${format(addDays(weekStart, 6), "d")}`;
    labelMap.set(key, label);
    const vol = log.exercises.reduce(
      (a, ex) => a + ex.sets.reduce((b, s) => b + parseWeightKg(s.weight) * s.reps, 0),
      0
    );
    volumeMap.set(key, (volumeMap.get(key) ?? 0) + vol);
  });

  const keys = Array.from(volumeMap.keys()).sort();
  return keys.map((key) => ({
    week: labelMap.get(key)!,
    volume: Math.round(volumeMap.get(key) ?? 0),
  }));
}

interface RpePoint {
  date: string;
  rpe: number;
}

function computeRpeTrend(logs: WorkoutLog[]): RpePoint[] {
  return logs
    .map((log) => {
      const vals = log.exercises
        .flatMap((ex) => ex.sets)
        .filter((s) => s.rpe !== undefined)
        .map((s) => s.rpe!);
      if (vals.length === 0) return null;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { date: format(parseISO(log.date), "MMM d"), rpe: parseFloat(avg.toFixed(1)) };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date)) as RpePoint[];
}

interface StrengthPoint {
  date: string;
  weight: number;
}

interface PREntry {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  e1rm: number; // Epley estimate
}

function epley(w: number, r: number) {
  return r === 1 ? w : Math.round(w * (1 + r / 30));
}

function computePRs(logs: WorkoutLog[]): PREntry[] {
  const map = new Map<string, PREntry>();
  [...logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((log) => {
      log.exercises.forEach((ex) => {
        ex.sets.forEach((s) => {
          const w = parseWeightKg(s.weight);
          if (w <= 0 || s.reps <= 0) return;
          const e1rm = epley(w, s.reps);
          const cur = map.get(ex.exerciseId);
          if (!cur || e1rm > cur.e1rm) {
            map.set(ex.exerciseId, {
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              weight: w,
              reps: s.reps,
              date: log.date,
              e1rm,
            });
          }
        });
      });
    });
  return Array.from(map.values()).sort((a, b) => b.e1rm - a.e1rm);
}

function computeStrengthProgression(
  logs: WorkoutLog[],
  exerciseId: string
): StrengthPoint[] {
  return logs
    .filter((l) => l.exercises.some((ex) => ex.exerciseId === exerciseId))
    .map((log) => {
      const ex = log.exercises.find((e) => e.exerciseId === exerciseId)!;
      const maxW = Math.max(...ex.sets.map((s) => parseWeightKg(s.weight)).filter((w) => w > 0));
      return { date: format(parseISO(log.date), "MMM d"), weight: maxW };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getBlockStats(logs: WorkoutLog[], block: Block) {
  const start = startOfDay(parseISO(block.startDate));
  const end = block.endDate ? startOfDay(parseISO(block.endDate)) : new Date();
  const inBlock = logs.filter((l) =>
    isWithinInterval(parseISO(l.date), { start, end })
  );
  const sets = inBlock.reduce(
    (a, l) => a + l.exercises.reduce((b, ex) => b + ex.sets.length, 0),
    0
  );
  const duration = block.endDate
    ? differenceInDays(parseISO(block.endDate), parseISO(block.startDate))
    : differenceInDays(new Date(), parseISO(block.startDate));
  return { workouts: inBlock.length, sets, duration };
}

// ─── Reusable components ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
        {children}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="border-l-2 border-l-primary">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.75} />
        </div>
        <p className="text-3xl font-black leading-none tracking-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground font-medium">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
  empty,
  emptyMessage,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  empty: boolean;
  emptyMessage?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {empty ? (
          <div className="h-40 flex flex-col items-center justify-center text-center gap-2">
            <BarChart3 className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.25} />
            <p className="text-xs text-muted-foreground">
              {emptyMessage ?? "Log workouts to see this chart."}
            </p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// Custom tooltip with card-like styling
function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          {p.value}
          {unit ?? ""}
        </p>
      ))}
    </div>
  );
}

// ─── Block summary card ───────────────────────────────────────────────────────

function BlockSummaryCard({
  block,
  stats,
}: {
  block: Block;
  stats: ReturnType<typeof getBlockStats>;
}) {
  const start = parseISO(block.startDate);
  const end = block.endDate ? parseISO(block.endDate) : null;

  return (
    <Card className={block.isActive ? "border-primary/40 bg-primary/5" : undefined}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{block.name}</p>
              {block.isActive && (
                <Badge className="text-[10px] h-4 px-1.5">Active</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {block.goal}
            </p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {format(start, "MMM d")}
            {end ? ` – ${format(end, "MMM d")}` : " · Ongoing"}
          </span>
          <span className="text-border">·</span>
          <span>{stats.duration}d</span>
        </div>

        <Separator className="mb-3" />

        {/* Mini stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold leading-none">{stats.workouts}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Workouts</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold leading-none">{stats.sets}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Sets</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PR entry row ─────────────────────────────────────────────────────────────

function PRRow({ pr, rank }: { pr: PREntry; rank: number }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-base w-6 text-center shrink-0">
        {rank < 3 ? medals[rank] : <span className="text-xs text-muted-foreground font-medium">{rank + 1}</span>}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{pr.exerciseName}</p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(pr.date), "MMM d, yyyy")}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">
          {pr.weight}
          <span className="text-xs font-normal text-muted-foreground"> kg</span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          {pr.reps} rep{pr.reps !== 1 ? "s" : ""} · e1RM {pr.e1rm}kg
        </p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReportsSkeleton() {
  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-28 rounded bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}
      </div>
      <div className="h-52 rounded-xl bg-muted" />
      <div className="h-52 rounded-xl bg-muted" />
      <div className="h-40 rounded-xl bg-muted" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportsContent() {
  const [mounted, setMounted] = useState(false);

  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const blocks = useAppStore((s) => s.blocks);

  useEffect(() => { setMounted(true); }, []);

  const handleExportWorkouts = useMemo(() => () => {
    if (workoutLogs.length === 0) {
      toast.error("No workouts to export yet.");
      return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      totalSessions: workoutLogs.length,
      sessions: [...workoutLogs]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((log) => ({
          date: log.date,
          durationMinutes: log.durationMinutes,
          notes: log.notes,
          exercises: log.exercises.map((ex) => ({
            name: ex.exerciseName,
            notes: ex.notes,
            sets: ex.sets.map((s) => ({
              setNumber: s.setNumber,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
              notes: s.notes,
            })),
          })),
        })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `ironclad-workouts-${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${workoutLogs.length} workout session${workoutLogs.length !== 1 ? "s" : ""}!`);
  }, [workoutLogs]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const sorted = useMemo(
    () => [...workoutLogs].sort((a, b) => a.date.localeCompare(b.date)),
    [workoutLogs]
  );

  const totalWorkouts = workoutLogs.length;
  const totalSets = useMemo(
    () => workoutLogs.reduce((a, l) => a + l.exercises.reduce((b, ex) => b + ex.sets.length, 0), 0),
    [workoutLogs]
  );

  const allRpe = useMemo(() => {
    const vals = workoutLogs.flatMap((l) =>
      l.exercises.flatMap((ex) => ex.sets.filter((s) => s.rpe !== undefined).map((s) => s.rpe!))
    );
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  }, [workoutLogs]);

  const weeklyVolume = useMemo(() => computeWeeklyVolume(sorted), [sorted]);
  const rpeTrend = useMemo(() => computeRpeTrend(sorted), [sorted]);
  const prs = useMemo(() => computePRs(workoutLogs), [workoutLogs]);

  // Strength progression: pick the exercise with the most log appearances
  const topExercise = useMemo(() => {
    const freq = new Map<string, { name: string; count: number }>();
    workoutLogs.forEach((l) =>
      l.exercises.forEach((ex) => {
        const cur = freq.get(ex.exerciseId);
        freq.set(ex.exerciseId, {
          name: ex.exerciseName,
          count: (cur?.count ?? 0) + 1,
        });
      })
    );
    return [...freq.entries()].sort((a, b) => b[1].count - a[1].count)[0] ?? null;
  }, [workoutLogs]);

  const strengthData = useMemo(
    () => (topExercise ? computeStrengthProgression(sorted, topExercise[0]) : []),
    [sorted, topExercise]
  );

  const sortedBlocks = useMemo(
    () =>
      [...blocks].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [blocks]
  );

  if (!mounted) return <ReportsSkeleton />;

  const hasLogs = workoutLogs.length > 0;
  const hasBlocks = blocks.length > 0;

  return (
    <div className="p-4 pb-8 space-y-6 max-w-lg mx-auto">

      {/* ── Header ──────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track your progress over time
        </p>
      </div>

      {/* ── Key Stats ───────────────────────────────── */}
      <section>
        <SectionTitle>Key Stats</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Workouts"
            value={totalWorkouts}
            sub="all time"
            icon={Dumbbell}
          />
          <StatCard
            label="Sets"
            value={totalSets}
            sub="all time"
            icon={Activity}
          />
          <StatCard
            label="Avg RPE"
            value={allRpe ?? "—"}
            sub={allRpe ? "/ 10" : "no RPE logged yet"}
            icon={Flame}
          />
          <StatCard
            label="PRs tracked"
            value={prs.length}
            sub={prs.length > 0 ? `best: ${prs[0]?.exerciseName.slice(0, 14)}` : "log sets to track"}
            icon={Trophy}
          />
        </div>
      </section>

      {/* ── Weekly Volume Chart ──────────────────────── */}
      <section>
        <SectionTitle>Weekly Volume</SectionTitle>
        <ChartCard
          title="Volume (kg × reps)"
          description="Total weekly load lifted across all exercises"
          empty={weeklyVolume.length === 0}
          emptyMessage="Log workouts to see your weekly volume."
        >
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={weeklyVolume.slice(-8)}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip
                content={<ChartTooltip unit=" kg" />}
                cursor={{ fill: "hsl(var(--muted))" }}
              />
              <Bar dataKey="volume" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* ── Strength Progression Chart ───────────────── */}
      <section>
        <SectionTitle>Strength Progression</SectionTitle>
        <ChartCard
          title={topExercise ? topExercise[1].name : "Top Exercise"}
          description={
            topExercise
              ? `Best weight per session · ${topExercise[1].count} session${topExercise[1].count !== 1 ? "s" : ""}`
              : "Most-logged exercise over time"
          }
          empty={strengthData.length < 2}
          emptyMessage="Log the same exercise across multiple sessions to see progression."
        >
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={strengthData}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                content={<ChartTooltip unit=" kg" />}
                cursor={{ stroke: "hsl(var(--border))" }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke={C2}
                strokeWidth={2}
                dot={{ fill: C2, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* ── RPE Trend Chart ──────────────────────────── */}
      <section>
        <SectionTitle>Session RPE Trend</SectionTitle>
        <ChartCard
          title="Average RPE per Session"
          description="How hard you've been training over time"
          empty={rpeTrend.length < 2}
          emptyMessage="Log RPE on your sets to see training intensity trends."
        >
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart
              data={rpeTrend.slice(-12)}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="rpeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C3} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C3} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[4, 10]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="rpe"
                stroke={C3}
                strokeWidth={2}
                fill="url(#rpeGrad)"
                dot={{ fill: C3, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* ── Exercise Progress (per-exercise charts) ──── */}
      <section>
        <SectionTitle>Exercise Progress</SectionTitle>
        <ExerciseProgress />
      </section>

      {/* ── Personal Records ─────────────────────────── */}
      <section>
        <SectionTitle>Personal Records</SectionTitle>
        {prs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <Trophy className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.25} />
              <p className="text-xs text-muted-foreground">
                Your best lifts will appear here once you start logging.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-3 pb-2 divide-y divide-border">
              {prs.slice(0, 8).map((pr, i) => (
                <PRRow key={pr.exerciseId} pr={pr} rank={i} />
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Block History ────────────────────────────── */}
      <section>
        <SectionTitle>Block History</SectionTitle>
        {!hasBlocks ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <Layers className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.25} />
              <p className="text-xs text-muted-foreground">
                Create training blocks in the Train tab to see them here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedBlocks.map((block) => (
              <BlockSummaryCard
                key={block.id}
                block={block}
                stats={getBlockStats(workoutLogs, block)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Workout History (delete / edit) ──────────── */}
      <section>
        <SectionTitle>Workout History</SectionTitle>
        <WorkoutHistory />
      </section>

      {/* ── Export Reports ────────────────────────────── */}
      <section>
        <SectionTitle>Export Reports</SectionTitle>
        <div className="space-y-3">
          <PdfExport />
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Download className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <p className="text-sm font-medium">Workout History</p>
                    <p className="text-xs text-muted-foreground">
                      Export all logged sessions as JSON, or restore from a previous
                      export — includes dates, exercises, sets, weight, reps, RPE, and
                      notes.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={handleExportWorkouts}
                      disabled={workoutLogs.length === 0}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export Workouts JSON
                    </Button>
                    <WorkoutHistoryImport />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
