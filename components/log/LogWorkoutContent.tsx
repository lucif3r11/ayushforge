"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  Plus,
  Trash2,
  X,
  Search,
  Dumbbell,
  ChevronDown,
  RotateCcw,
  CheckCircle2,
  Layers,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SetType, Routine, WorkoutLog } from "@/lib/types";

// ─── Local types ─────────────────────────────────────────────────────────────

interface SetRow {
  localId: string;
  weight: string;
  reps: string;
  rpe: string;
  notes: string;
}

interface ExerciseEntry {
  localId: string;
  exerciseId: string;
  exerciseName: string;
  sets: SetRow[];
  prefilledFromDate?: string; // set when sets are copied from a prior session
}

interface PickerExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroups?: string[];
  routineName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptySet(): SetRow {
  return { localId: uid(), weight: "", reps: "", rpe: "", notes: "" };
}

function emptyExercise(id: string, name: string, prefillSets = 1): ExerciseEntry {
  return {
    localId: uid(),
    exerciseId: id,
    exerciseName: name,
    sets: Array.from({ length: prefillSets }, emptySet),
  };
}

/** Returns pre-filled sets + source date from the most recent session, or null. */
function getPrefilledSets(
  exerciseId: string,
  logs: WorkoutLog[]
): { sets: SetRow[]; fromDate: string } | null {
  const last = [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((log) => log.exercises.some((ex) => ex.exerciseId === exerciseId));

  if (!last) return null;
  const entry = last.exercises.find((ex) => ex.exerciseId === exerciseId);
  if (!entry || entry.sets.length === 0) return null;

  return {
    sets: entry.sets.map((s) => ({
      localId: uid(),
      weight: s.weight > 0 ? String(s.weight) : "",
      reps: s.reps > 0 ? String(s.reps) : "",
      rpe: s.rpe !== undefined ? String(s.rpe) : "",
      notes: "",
    })),
    fromDate: last.date,
  };
}

// ─── Exercise Picker (bottom sheet) ─────────────────────────────────────────

function ExercisePicker({
  open,
  onClose,
  onSelect,
  alreadyAdded,
  blockRoutines,
  allExercises,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (ex: PickerExercise) => void;
  alreadyAdded: string[];
  blockRoutines: Routine[];
  allExercises: { id: string; name: string; muscleGroups: string[] }[];
}) {
  const [search, setSearch] = useState("");

  const routineExercises: PickerExercise[] = useMemo(() => {
    const seen = new Set<string>();
    const result: PickerExercise[] = [];
    for (const r of blockRoutines) {
      for (const ex of r.exercises) {
        if (!seen.has(ex.exerciseId)) {
          seen.add(ex.exerciseId);
          result.push({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            routineName: r.name,
          });
        }
      }
    }
    return result;
  }, [blockRoutines]);

  const routineExerciseIds = useMemo(
    () => new Set(routineExercises.map((e) => e.exerciseId)),
    [routineExercises]
  );

  const libraryExercises: PickerExercise[] = useMemo(
    () =>
      allExercises
        .filter((e) => !routineExerciseIds.has(e.id))
        .map((e) => ({
          exerciseId: e.id,
          exerciseName: e.name,
          muscleGroups: e.muscleGroups,
        })),
    [allExercises, routineExerciseIds]
  );

  const q = search.toLowerCase();
  const filteredRoutine = routineExercises.filter((e) =>
    e.exerciseName.toLowerCase().includes(q)
  );
  const filteredLibrary = libraryExercises.filter((e) =>
    e.exerciseName.toLowerCase().includes(q)
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-background rounded-t-2xl max-h-[82vh] flex flex-col shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-base font-semibold">Add Exercise</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search exercises…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <Separator />

        {/* List */}
        <div className="overflow-y-auto flex-1 pb-8">
          {filteredRoutine.length === 0 && filteredLibrary.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">
              No exercises found
            </p>
          )}

          {filteredRoutine.length > 0 && (
            <>
              <p className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                From Routine
              </p>
              {filteredRoutine.map((ex) => {
                const added = alreadyAdded.includes(ex.exerciseId);
                return (
                  <button
                    key={ex.exerciseId}
                    disabled={added}
                    onClick={() => {
                      onSelect(ex);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors",
                      "hover:bg-accent active:bg-accent",
                      added && "opacity-40 pointer-events-none"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ex.exerciseName}
                      </p>
                      {ex.routineName && (
                        <p className="text-xs text-muted-foreground">
                          {ex.routineName}
                        </p>
                      )}
                    </div>
                    {added && (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </>
          )}

          {filteredLibrary.length > 0 && (
            <>
              <p className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Exercise Library
              </p>
              {filteredLibrary.map((ex) => {
                const added = alreadyAdded.includes(ex.exerciseId);
                return (
                  <button
                    key={ex.exerciseId}
                    disabled={added}
                    onClick={() => {
                      onSelect(ex);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors",
                      "hover:bg-accent active:bg-accent",
                      added && "opacity-40 pointer-events-none"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ex.exerciseName}
                      </p>
                      {ex.muscleGroups && ex.muscleGroups.length > 0 && (
                        <p className="text-xs text-muted-foreground capitalize">
                          {ex.muscleGroups.slice(0, 2).join(", ")}
                        </p>
                      )}
                    </div>
                    {added && (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* If no exercises at all in library, allow free-text add */}
          {filteredRoutine.length === 0 &&
            filteredLibrary.length === 0 &&
            search.trim().length > 1 && (
              <button
                onClick={() => {
                  onSelect({
                    exerciseId: uid(),
                    exerciseName: search.trim(),
                  });
                  setSearch("");
                }}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-accent transition-colors"
              >
                <Plus className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm">
                  Add &ldquo;{search.trim()}&rdquo;
                </span>
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

// ─── Set Row ─────────────────────────────────────────────────────────────────

function SetRowComponent({
  index,
  set,
  onChange,
  onDelete,
  canDelete,
}: {
  index: number;
  set: SetRow;
  onChange: (field: keyof SetRow, value: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Set number */}
      <span className="text-xs font-semibold text-muted-foreground w-6 text-center shrink-0">
        {index + 1}
      </span>

      {/* Weight */}
      <Input
        type="number"
        inputMode="decimal"
        placeholder="kg"
        value={set.weight}
        onChange={(e) => onChange("weight", e.target.value)}
        className="h-10 text-center px-2 text-sm font-medium min-w-0"
        min="0"
        step="0.5"
      />

      {/* Reps */}
      <Input
        type="number"
        inputMode="numeric"
        placeholder="reps"
        value={set.reps}
        onChange={(e) => onChange("reps", e.target.value)}
        className="h-10 text-center px-2 text-sm font-medium min-w-0"
        min="0"
      />

      {/* RPE */}
      <Input
        type="number"
        inputMode="decimal"
        placeholder="RPE"
        value={set.rpe}
        onChange={(e) => onChange("rpe", e.target.value)}
        className="h-10 text-center px-2 text-sm font-medium min-w-0 w-16 shrink-0"
        min="1"
        max="10"
        step="0.5"
      />

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={cn(
          "h-10 w-10 flex items-center justify-center rounded-lg shrink-0 transition-colors",
          canDelete
            ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            : "text-muted-foreground/30 pointer-events-none"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({
  entry,
  onRemove,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
}: {
  entry: ExerciseEntry;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (setLocalId: string) => void;
  onUpdateSet: (setLocalId: string, field: keyof SetRow, value: string) => void;
}) {
  return (
    <Card>
      {/* Exercise header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Dumbbell className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />
          <h3 className="font-semibold text-sm truncate">{entry.exerciseName}</h3>
        </div>
        <button
          onClick={onRemove}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Pre-fill indicator */}
      {entry.prefilledFromDate && (
        <div className="mx-4 mb-2 flex items-center gap-1.5 rounded-lg bg-blue-500/8 border border-blue-500/20 px-2.5 py-1.5">
          <History className="h-3 w-3 text-blue-500 shrink-0" />
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Pre-filled from {format(parseISO(entry.prefilledFromDate), "MMM d")}
          </span>
        </div>
      )}

      <CardContent className="pt-0 space-y-2 pb-4">
        {/* Column headers */}
        <div className="flex items-center gap-2">
          <span className="w-6 shrink-0" />
          <span className="flex-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            kg
          </span>
          <span className="flex-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            reps
          </span>
          <span className="w-16 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
            rpe
          </span>
          <span className="w-10 shrink-0" />
        </div>

        {/* Set rows */}
        {entry.sets.map((set, i) => (
          <SetRowComponent
            key={set.localId}
            index={i}
            set={set}
            canDelete={entry.sets.length > 1}
            onChange={(field, value) => onUpdateSet(set.localId, field, value)}
            onDelete={() => onRemoveSet(set.localId)}
          />
        ))}

        {/* Add set */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddSet}
          className="w-full h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 mt-1"
        >
          <Plus className="h-3 w-3" />
          Add Set
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── No Active Block ─────────────────────────────────────────────────────────

function NoBlockBanner() {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex items-start gap-3 py-4">
        <Layers className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" strokeWidth={1.75} />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            No active training block
          </p>
          <p className="text-xs text-muted-foreground">
            Exercises from your block&apos;s routines will appear in the picker
            once you create and activate a block.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LogWorkoutContent() {
  const [mounted, setMounted] = useState(false);

  // Store selectors
  const blocks = useAppStore((s) => s.blocks);
  const routines = useAppStore((s) => s.routines);
  const allExercises = useAppStore((s) => s.exercises);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const addWorkoutLog = useAppStore((s) => s.addWorkoutLog);

  // Capture start time once on mount
  const startTimeRef = useRef(new Date().toISOString());

  // Session meta
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [duration, setDuration] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");

  // Exercises logged this session
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);

  // Routine loader UI
  const [routineLoaderOpen, setRoutineLoaderOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Derived
  const activeBlock = useMemo(
    () => blocks.find((b) => b.isActive) ?? null,
    [blocks]
  );

  const blockRoutines = useMemo(
    () =>
      activeBlock
        ? routines.filter((r) => activeBlock.routineIds.includes(r.id))
        : [],
    [activeBlock, routines]
  );

  const alreadyAddedIds = useMemo(
    () => exercises.map((e) => e.exerciseId),
    [exercises]
  );

  // ── Exercise mutations ───────────────────────────────────────────────────

  const addExercise = useCallback((ex: PickerExercise) => {
    const prefill = getPrefilledSets(ex.exerciseId, workoutLogs);
    setExercises((prev) => [
      ...prev,
      {
        localId: uid(),
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        sets: prefill ? prefill.sets : [emptySet()],
        prefilledFromDate: prefill?.fromDate,
      },
    ]);
    setPickerOpen(false);
  }, [workoutLogs]);

  const removeExercise = useCallback((localId: string) => {
    setExercises((prev) => prev.filter((e) => e.localId !== localId));
  }, []);

  const addSet = useCallback((exerciseLocalId: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.localId === exerciseLocalId
          ? { ...e, sets: [...e.sets, emptySet()] }
          : e
      )
    );
  }, []);

  const removeSet = useCallback((exerciseLocalId: string, setLocalId: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.localId === exerciseLocalId
          ? { ...e, sets: e.sets.filter((s) => s.localId !== setLocalId) }
          : e
      )
    );
  }, []);

  const updateSet = useCallback(
    (exerciseLocalId: string, setLocalId: string, field: keyof SetRow, value: string) => {
      setExercises((prev) =>
        prev.map((e) =>
          e.localId === exerciseLocalId
            ? {
                ...e,
                sets: e.sets.map((s) =>
                  s.localId === setLocalId ? { ...s, [field]: value } : s
                ),
              }
            : e
        )
      );
    },
    []
  );

  // Load all exercises from a routine, pre-filling from last session where available
  const loadRoutine = useCallback(
    (routine: Routine) => {
      const entries: ExerciseEntry[] = routine.exercises
        .sort((a, b) => a.order - b.order)
        .map((re) => {
          const prefill = getPrefilledSets(re.exerciseId, workoutLogs);
          if (prefill) {
            return {
              localId: uid(),
              exerciseId: re.exerciseId,
              exerciseName: re.exerciseName,
              sets: prefill.sets,
              prefilledFromDate: prefill.fromDate,
            };
          }
          const parsedReps = parseInt(re.targetReps);
          return {
            localId: uid(),
            exerciseId: re.exerciseId,
            exerciseName: re.exerciseName,
            sets: Array.from({ length: re.targetSets }, () => ({
              localId: uid(),
              weight: re.targetWeight ? String(re.targetWeight) : "",
              reps: !isNaN(parsedReps) ? String(parsedReps) : "",
              rpe: "",
              notes: "",
            })),
          };
        });
      setExercises(entries);
      setRoutineLoaderOpen(false);
    },
    [workoutLogs]
  );

  // ── Save ────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (exercises.length === 0) {
      toast.error("Add at least one exercise before saving.");
      return;
    }

    const validExercises = exercises.filter((e) =>
      e.sets.some((s) => s.reps !== "" && parseInt(s.reps) > 0)
    );

    if (validExercises.length === 0) {
      toast.error("Each exercise needs at least one set with reps logged.");
      return;
    }

    const totalSets = validExercises.reduce((acc, e) => acc + e.sets.length, 0);

    addWorkoutLog({
      date,
      startTime: startTimeRef.current,
      endTime: new Date().toISOString(),
      durationMinutes: duration ? parseInt(duration) : undefined,
      notes: sessionNotes.trim() || undefined,
      exercises: validExercises.map((e) => ({
        id: uid(),
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        sets: e.sets
          .filter((s) => s.reps !== "" || s.weight !== "")
          .map((s, i) => ({
            id: uid(),
            setNumber: i + 1,
            type: "normal" as SetType,
            weight: parseFloat(s.weight) || 0,
            reps: parseInt(s.reps) || 0,
            rpe: s.rpe ? parseFloat(s.rpe) : undefined,
            notes: s.notes.trim() || undefined,
          })),
      })),
    });

    toast.success(
      `Workout saved! ${validExercises.length} exercise${validExercises.length !== 1 ? "s" : ""}, ${totalSets} sets`,
      { description: format(new Date(), "EEEE, MMMM d") }
    );

    // Reset session
    setExercises([]);
    setSessionNotes("");
    setDuration("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    startTimeRef.current = new Date().toISOString();
  }, [exercises, date, duration, sessionNotes, addWorkoutLog]);

  // ── Skeleton ─────────────────────────────────────────────────────────────

  if (!mounted) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto animate-pulse">
        <div className="h-28 rounded-xl bg-muted" />
        <div className="h-10 rounded-xl bg-muted" />
        <div className="h-40 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
      </div>
    );
  }

  const totalSetsLogged = exercises.reduce((a, e) => a + e.sets.length, 0);

  return (
    <>
      <div className="p-4 pb-8 space-y-5 max-w-lg mx-auto">

        {/* ── Page title ─────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Log Workout</h1>
          {exercises.length > 0 && (
            <Badge variant="secondary">
              {exercises.length} ex · {totalSetsLogged} sets
            </Badge>
          )}
        </div>

        {/* ── No active block warning ──────────────────── */}
        {!activeBlock && <NoBlockBanner />}

        {/* ── Session info card ────────────────────────── */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="session-date">Date</Label>
                <Input
                  id="session-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <Label htmlFor="session-duration">Duration (min)</Label>
                <Input
                  id="session-duration"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 60"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  className="h-10"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="session-notes">Session Notes (optional)</Label>
              <Textarea
                id="session-notes"
                placeholder="How are you feeling? Any PRs today?"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Load from routine ────────────────────────── */}
        {blockRoutines.length > 0 && exercises.length === 0 && (
          <div>
            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground shrink-0">or load a routine</span>
              <Separator className="flex-1" />
            </div>

            <div className="mt-3 space-y-2">
              {blockRoutines.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRoutine(r)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:bg-accent transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.exercises.length} exercise
                      {r.exercises.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Exercise entries ─────────────────────────── */}
        {exercises.length > 0 && (
          <div className="space-y-3">
            {exercises.map((entry) => (
              <ExerciseCard
                key={entry.localId}
                entry={entry}
                onRemove={() => removeExercise(entry.localId)}
                onAddSet={() => addSet(entry.localId)}
                onRemoveSet={(sid) => removeSet(entry.localId, sid)}
                onUpdateSet={(sid, field, val) =>
                  updateSet(entry.localId, sid, field, val)
                }
              />
            ))}

            {/* Reset link */}
            <button
              onClick={() => setExercises([])}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <RotateCcw className="h-3 w-3" />
              Clear all exercises
            </button>
          </div>
        )}

        {/* ── Add Exercise button ──────────────────────── */}
        <Button
          variant="outline"
          className="w-full h-12 gap-2 border-dashed"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Exercise
        </Button>

        {/* ── Save button ──────────────────────────────── */}
        <Button
          className="w-full h-14 text-base font-semibold gap-2"
          size="lg"
          onClick={handleSave}
          disabled={exercises.length === 0}
        >
          Save Workout
        </Button>
      </div>

      {/* ── Exercise picker sheet ────────────────────── */}
      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addExercise}
        alreadyAdded={alreadyAddedIds}
        blockRoutines={blockRoutines}
        allExercises={allExercises.map((e) => ({
          id: e.id,
          name: e.name,
          muscleGroups: e.muscleGroups,
        }))}
      />
    </>
  );
}
