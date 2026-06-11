"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Dumbbell,
  Plus,
  ChevronRight,
  Target,
  CalendarDays,
  Layers,
  ListChecks,
  PlayCircle,
  FileJson,
  ChevronDown,
  X,
  Zap,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import WorkoutPlanImporter from "@/components/train/WorkoutPlanImporter";
import DetailedBlockView from "@/components/train/DetailedBlockView";
import type { Block, Routine, RoutineExercise } from "@/lib/types";

const LS_VIEW_MODE_KEY = "ironclad-train-view-mode";
type ViewMode = "routines" | "blocks";

// ─── Active block banner ──────────────────────────────────────────────────────

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

function BlockStrip({ block }: { block: Block }) {
  const start = parseISO(block.startDate);
  const end = block.endDate ? parseISO(block.endDate) : null;
  const today = new Date();
  const elapsed = differenceInDays(today, start);
  const total = end ? differenceInDays(end, start) : null;
  const remaining = end ? differenceInDays(end, today) : null;

  return (
    <div className="hero-gradient card-elevated rounded-xl overflow-hidden">
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60 mb-1.5">
              Active Block
            </p>
            <p className="text-2xl font-black leading-tight truncate text-white">{block.name}</p>
          </div>
          {remaining !== null && remaining >= 0 ? (
            <Badge className="bg-white/15 text-white border-0 shrink-0">
              {remaining === 0 ? "Last day" : `${remaining}d left`}
            </Badge>
          ) : remaining !== null ? (
            <Badge className="bg-white/15 text-white border-0 shrink-0">Done</Badge>
          ) : (
            <Badge className="bg-white/15 text-white border-0 shrink-0">Day {elapsed + 1}</Badge>
          )}
        </div>

        <div className="flex items-start gap-2">
          <Target className="h-3.5 w-3.5 mt-0.5 shrink-0 text-white/60" />
          <p className="text-sm text-white/85 leading-snug">{block.goal}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-white/70">
            <CalendarDays className="h-3 w-3" />
            <span className="text-[11px]">
              {format(start, "MMM d")}
              {end ? ` – ${format(end, "MMM d, yyyy")}` : " · Ongoing"}
            </span>
          </div>
          {total !== null && (
            <div className="h-1.5 rounded-full bg-white/15">
              <div
                className="h-1.5 rounded-full bg-white transition-all"
                style={{
                  width: `${Math.min(100, Math.max(2, ((elapsed + 1) / (total + 1)) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Exercise grouping ────────────────────────────────────────────────────────

type SingleGroup = { type: "single"; ex: RoutineExercise };
type SupersetGroup = { type: "superset"; label: string; exs: RoutineExercise[] };
type ExerciseGroup = SingleGroup | SupersetGroup;

function groupExercises(exercises: RoutineExercise[]): ExerciseGroup[] {
  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  const supersetCollected = new Map<string, RoutineExercise[]>();
  for (const ex of sorted) {
    if (ex.supersetGroup) {
      const arr = supersetCollected.get(ex.supersetGroup) ?? [];
      arr.push(ex);
      supersetCollected.set(ex.supersetGroup, arr);
    }
  }
  const seen = new Set<string>();
  const groups: ExerciseGroup[] = [];
  for (const ex of sorted) {
    if (ex.supersetGroup) {
      if (!seen.has(ex.supersetGroup)) {
        seen.add(ex.supersetGroup);
        groups.push({ type: "superset", label: ex.supersetGroup, exs: supersetCollected.get(ex.supersetGroup)! });
      }
    } else {
      groups.push({ type: "single", ex });
    }
  }
  return groups;
}

// ─── Routine card ─────────────────────────────────────────────────────────────

function RoutineCard({ routine }: { routine: Routine }) {
  const [expanded, setExpanded] = useState(false);
  const groups = useMemo(() => groupExercises(routine.exercises), [routine.exercises]);
  let singleCounter = 0;

  return (
    <Card>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-4 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="rounded-lg bg-primary/10 p-1.5 shrink-0">
            <ListChecks className="h-4 w-4 text-primary" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{routine.name}</p>
            <p className="text-xs text-muted-foreground">
              {routine.exercises.length} exercise{routine.exercises.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {expanded && (
        <>
          <Separator />
          <CardContent className="pt-3 pb-4 space-y-2">
            {groups.map((group) => {
              if (group.type === "superset") {
                return (
                  <div
                    key={`ss-${group.label}`}
                    className="rounded-lg border border-primary/25 bg-primary/5 px-3 pt-2.5 pb-3 space-y-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-primary/70">
                        Superset
                      </span>
                      <div className="flex-1 h-px bg-primary/15" />
                    </div>
                    {group.exs.map((ex, j) => (
                      <div key={ex.exerciseId} className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-xs font-bold text-primary/60 shrink-0 mt-0.5 w-4">
                            {String.fromCharCode(65 + j)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm leading-snug">{ex.exerciseName}</p>
                            {ex.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{ex.notes}</p>
                            )}
                            {ex.tempo && (
                              <p className="text-xs text-muted-foreground mt-0.5">Tempo {ex.tempo}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2 mt-0.5 whitespace-nowrap">
                          {ex.targetSets} × {ex.targetReps}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }

              const idx = ++singleCounter;
              const ex = group.ex;
              return (
                <div key={ex.exerciseId} className="flex items-start justify-between py-1">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-xs text-muted-foreground w-4 text-right shrink-0 mt-0.5">
                      {idx}.
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm leading-snug">{ex.exerciseName}</p>
                      {ex.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{ex.notes}</p>
                      )}
                      {ex.tempo && (
                        <p className="text-xs text-muted-foreground mt-0.5">Tempo {ex.tempo}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2 mt-0.5 whitespace-nowrap">
                    {ex.targetSets} × {ex.targetReps}
                  </span>
                </div>
              );
            })}
            <div className="pt-2">
              <Link href="/log">
                <Button className="w-full gap-2" size="sm">
                  <PlayCircle className="h-4 w-4" />
                  Start This Routine
                </Button>
              </Link>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

// ─── Block list item (all-blocks section) ─────────────────────────────────────

function BlockListItem({
  block,
  isActive,
  onActivate,
}: {
  block: Block;
  isActive: boolean;
  onActivate: () => void;
}) {
  const start = block.startDate ? parseISO(block.startDate) : null;
  const end = block.endDate ? parseISO(block.endDate) : null;

  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
      <div
        className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
          isActive ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{block.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {block.goal}
          {start && (
            <span className="opacity-60">
              {" · "}
              {format(start, "MMM d")}
              {end ? ` – ${format(end, "MMM d")}` : ""}
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0">
        {isActive ? (
          <Badge variant="default" className="text-xs h-6">
            Active
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={onActivate}
          >
            <Zap className="h-3 w-3" />
            Activate
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Create block inline form ─────────────────────────────────────────────────

function CreateBlockForm({ onClose }: { onClose: () => void }) {
  const addBlock = useAppStore((s) => s.addBlock);
  const setActiveBlock = useAppStore((s) => s.setActiveBlock);

  const today = format(new Date(), "yyyy-MM-dd");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [makeActive, setMakeActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Block name is required";
    if (!goal.trim()) errs.goal = "Goal is required";
    if (!startDate) errs.startDate = "Start date is required";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const id = addBlock({
      name: name.trim(),
      goal: goal.trim(),
      startDate,
      endDate: endDate || undefined,
      routineIds: [],
      isActive: false,
    });
    if (makeActive) setActiveBlock(id);
    toast.success(`Block "${name.trim()}" created!`);
    onClose();
  }, [name, goal, startDate, endDate, makeActive, addBlock, setActiveBlock, onClose]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">New Training Block</CardTitle>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pb-6">
        {/* Block Name */}
        <div className="space-y-2">
          <Label htmlFor="block-name">Block Name</Label>
          <Input
            id="block-name"
            placeholder="e.g. PPL Power Phase"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
            className={`h-11${errors.name ? " border-destructive" : ""}`}
          />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
        </div>

        {/* Goal */}
        <div className="space-y-2">
          <Label htmlFor="block-goal">Goal</Label>
          <Input
            id="block-goal"
            placeholder="e.g. Build strength and muscle"
            value={goal}
            onChange={(e) => { setGoal(e.target.value); setErrors((p) => ({ ...p, goal: "" })); }}
            className={`h-11${errors.goal ? " border-destructive" : ""}`}
          />
          {errors.goal && <p className="text-xs text-destructive mt-1">{errors.goal}</p>}
        </div>

        {/* Dates — side by side, items-start prevents cross-column misalignment */}
        <div className="grid grid-cols-2 gap-4 items-start">
          <div className="space-y-2">
            <Label htmlFor="block-start">Start Date</Label>
            <Input
              id="block-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-end">
              End Date
              <span className="ml-1 font-normal text-muted-foreground text-xs">(opt)</span>
            </Label>
            <Input
              id="block-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-11"
            />
          </div>
        </div>

        {/* Active checkbox */}
        <label className="flex items-center gap-3 cursor-pointer select-none rounded-lg border border-border px-4 py-3.5">
          <input
            type="checkbox"
            checked={makeActive}
            onChange={(e) => setMakeActive(e.target.checked)}
            className="h-4 w-4 accent-primary rounded shrink-0"
          />
          <div>
            <p className="text-sm font-medium">Set as active block</p>
            <p className="text-xs text-muted-foreground">Start logging workouts against this block</p>
          </div>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1 h-11" onClick={handleSubmit}>
            Create Block
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Import plan collapsible section ─────────────────────────────────────────

function ImportPlanSection({
  onDetailedBlockImported,
}: {
  onDetailedBlockImported: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-muted p-1.5 shrink-0">
            <FileJson className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Import Plan</p>
            <p className="text-xs text-muted-foreground">Drag & drop a workout plan JSON</p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <>
          <Separator />
          <CardContent className="pt-4 pb-4">
            <WorkoutPlanImporter onDetailedBlockImported={onDetailedBlockImported} />
          </CardContent>
        </>
      )}
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TrainSkeleton() {
  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto animate-pulse">
      <div className="h-6 w-24 rounded bg-muted" />
      <div className="h-36 rounded-xl bg-muted" />
      <div className="h-4 w-20 rounded bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-muted" />
      ))}
      <div className="h-14 rounded-xl bg-muted" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrainContent() {
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("routines");

  const blocks = useAppStore((s) => s.blocks);
  const routines = useAppStore((s) => s.routines);
  const detailedBlocks = useAppStore((s) => s.detailedBlocks);
  const setActiveBlock = useAppStore((s) => s.setActiveBlock);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(LS_VIEW_MODE_KEY);
    if (saved === "routines" || saved === "blocks") setViewMode(saved);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(LS_VIEW_MODE_KEY, mode);
  }, []);

  const activeBlock = useMemo(() => blocks.find((b) => b.isActive) ?? null, [blocks]);

  const blockRoutines = useMemo(
    () =>
      activeBlock
        ? routines
            .filter((r) => activeBlock.routineIds.includes(r.id))
            .sort(
              (a, b) =>
                activeBlock.routineIds.indexOf(a.id) - activeBlock.routineIds.indexOf(b.id)
            )
        : [],
    [activeBlock, routines]
  );

  const otherBlocks = useMemo(
    () => blocks.filter((b) => !b.isActive),
    [blocks]
  );

  const handleActivate = useCallback(
    (id: string, name: string) => {
      setActiveBlock(id);
      toast.success(`"${name}" is now your active block.`);
    },
    [setActiveBlock]
  );

  if (!mounted) return <TrainSkeleton />;

  return (
    <div className="p-4 pb-8 space-y-5 max-w-lg mx-auto">

      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Train</h1>
        <div className="flex gap-2">
          {viewMode === "routines" && (
            creating ? (
              <Button size="sm" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                New Block
              </Button>
            )
          )}
          <Link href="/log">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Dumbbell className="h-3.5 w-3.5" />
              Free Log
            </Button>
          </Link>
        </div>
      </div>

      {/* ── View mode toggle ──────────────────────────── */}
      <div className="flex gap-1.5">
        <button
          onClick={() => handleViewModeChange("routines")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
            viewMode === "routines"
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          )}
        >
          <ListChecks className="h-4 w-4" />
          Routines
        </button>
        <button
          onClick={() => handleViewModeChange("blocks")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
            viewMode === "blocks"
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          )}
        >
          <Layers className="h-4 w-4" />
          Detailed Blocks
          {detailedBlocks.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">
              {detailedBlocks.length}
            </Badge>
          )}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-3 px-0.5">
        {viewMode === "routines"
          ? "Simple sets/reps routines, organized into training blocks."
          : "Rich, day-by-day plans with tempo, RPE, supersets, and progression tables."}
      </p>

      {viewMode === "blocks" ? (
        <DetailedBlockView />
      ) : (
        <>
      {/* ── Create block inline form ──────────────────── */}
      {creating && (
        <CreateBlockForm onClose={() => setCreating(false)} />
      )}

      {/* ── Empty state (no blocks at all) ───────────── */}
      {blocks.length === 0 && !creating && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Layers className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">No training blocks yet</p>
              <p className="text-sm text-muted-foreground max-w-[220px]">
                Create a block or import a plan to get started.
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="gap-2" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                Create Block
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Active block strip ────────────────────────── */}
      {activeBlock && <BlockStrip block={activeBlock} />}

      {/* ── No active block banner (blocks exist but none active) ── */}
      {blocks.length > 0 && !activeBlock && !creating && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            No active block — activate one below to start tracking.
          </p>
        </div>
      )}

      {/* ── Routines for active block ─────────────────── */}
      {activeBlock && (
        <section>
          <SectionLabel>Routines in this block</SectionLabel>
          {blockRoutines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ListChecks className="h-7 w-7 text-primary/60" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm">No routines yet</p>
                <p className="text-xs text-muted-foreground">Import a plan or add routines to this block.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {blockRoutines.map((r) => (
                <RoutineCard key={r.id} routine={r} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── All blocks list ───────────────────────────── */}
      {blocks.length > 0 && (
        <section>
          <SectionLabel>{activeBlock ? "Other Blocks" : "Your Blocks"}</SectionLabel>
          {(activeBlock ? otherBlocks : blocks).length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">
              No other blocks. Import a plan or create one above.
            </p>
          ) : (
            <div className="space-y-2">
              {(activeBlock ? otherBlocks : blocks).map((b) => (
                <BlockListItem
                  key={b.id}
                  block={b}
                  isActive={b.isActive}
                  onActivate={() => handleActivate(b.id, b.name)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Import Plan ───────────────────────────────── */}
      <ImportPlanSection
        onDetailedBlockImported={() => handleViewModeChange("blocks")}
      />
        </>
      )}

      {/* ── Log Workout CTA ───────────────────────────── */}
      <Link href="/log" className="block">
        <Button className="w-full h-14 text-base font-semibold gap-3" size="lg">
          <Dumbbell className="h-5 w-5" />
          Log Workout
        </Button>
      </Link>
    </div>
  );
}
