"use client";

import { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const C_LINE = "hsl(173 58% 39%)";  // teal — weight
const C_BAR  = "hsl(12 76% 61%)";   // orange — volume

interface ProgressPoint {
  date: string;
  weight: number;
  volume: number;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-muted-foreground">
        {payload[0].value}
        {unit ?? ""}
      </p>
    </div>
  );
}

export default function ExerciseProgress() {
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const [selectedId, setSelectedId] = useState("");

  // All exercises that appear in at least one log, sorted by frequency
  const loggedExercises = useMemo(() => {
    const names = new Map<string, string>();
    const freq  = new Map<string, number>();
    workoutLogs.forEach((l) =>
      l.exercises.forEach((ex) => {
        names.set(ex.exerciseId, ex.exerciseName);
        freq.set(ex.exerciseId, (freq.get(ex.exerciseId) ?? 0) + 1);
      })
    );
    return [...names.entries()]
      .sort((a, b) => (freq.get(b[0]) ?? 0) - (freq.get(a[0]) ?? 0))
      .map(([id, name]) => ({ id, name }));
  }, [workoutLogs]);

  // Default to the most-logged exercise
  useEffect(() => {
    if (!selectedId && loggedExercises.length > 0) {
      setSelectedId(loggedExercises[0].id);
    }
  }, [loggedExercises, selectedId]);

  const progressData: ProgressPoint[] = useMemo(() => {
    if (!selectedId) return [];
    return [...workoutLogs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((l) => l.exercises.some((ex) => ex.exerciseId === selectedId))
      .map((log) => {
        const ex = log.exercises.find((e) => e.exerciseId === selectedId)!;
        const valid = ex.sets.filter((s) => s.weight > 0 && s.reps > 0);
        const maxWeight = valid.length > 0 ? Math.max(...valid.map((s) => s.weight)) : 0;
        const volume   = Math.round(valid.reduce((a, s) => a + s.weight * s.reps, 0));
        return { date: format(parseISO(log.date), "MMM d"), weight: maxWeight, volume };
      });
  }, [selectedId, workoutLogs]);

  const selectedName = loggedExercises.find((e) => e.id === selectedId)?.name ?? "";

  if (loggedExercises.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.25} />
          <p className="text-xs text-muted-foreground">
            Log exercises to see per-exercise progress charts.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasEnough = progressData.length >= 2;

  return (
    <div className="space-y-3">
      {/* Exercise selector */}
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {loggedExercises.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>

      {/* Weight progression */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weight Progression</CardTitle>
          <CardDescription className="text-xs">
            {selectedName} · best weight per session ·{" "}
            {progressData.length} session{progressData.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {!hasEnough ? (
            <div className="h-36 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
              Log this exercise in 2+ sessions to see progression.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart
                data={progressData.slice(-12)}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
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
                  stroke={C_LINE}
                  strokeWidth={2}
                  dot={{ fill: C_LINE, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Volume per session */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Volume per Session</CardTitle>
          <CardDescription className="text-xs">
            {selectedName} · total kg lifted (weight × reps across all sets)
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {progressData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-muted-foreground">
              No data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={progressData.slice(-12)}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
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
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  content={<ChartTooltip unit=" kg" />}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar
                  dataKey="volume"
                  fill={C_BAR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
