"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  ArrowLeft,
  Check,
  Ban,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, isBodyweightExercise } from "@/lib/utils";
import type { SetType, Routine, WorkoutLog } from "@/lib/types";

// ─── Local types ─────────────────────────────────────────────────────────────

// String-valued fields that can be edited via onChange
type EditableSetField = "weight" | "reps" | "rpe" | "notes";

interface SetRow {
  localId: string;
  weight: string;
  reps: string;
  rpe: string;
  notes: string;
  done: boolean;
}

interface ExerciseEntry {
  localId: string;
  exerciseId: string;
  exerciseName: string;
  sets: SetRow[];
  prefilledFromDate?: string;
  skipped: boolean;
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
  return { localId: uid(), weight: "", reps: "", rpe: "", notes: "", done: false };
}

function emptyExercise(id: string, name: string, prefillSets = 1): ExerciseEntry {
  return {
    localId: uid(),
    exerciseId: id,
    exerciseName: name,
    sets: Array.from({ length: prefillSets }, emptySet),
    skipped: false,
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
      done: false,
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
  onToggleDone,
  canDelete,
  isBodyweight,
}: {
  index: number;
  set: SetRow;
  onChange: (field: EditableSetField, value: string) => void;
  onDelete: () => void;
  onToggleDone: () => void;
  canDelete: boolean;
  isBodyweight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-1 transition-colors",
        set.done && "bg-green-500/5"
      )}
    >
      {/* Completion toggle */}
      <button
        onClick={onToggleDone}
        className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 border-2",
          set.done
            ? "bg-green-500 border-green-500 text-white"
            : "border-muted-foreground/30 text-transparent hover:border-primary/60"
        )}
        aria-label={set.done ? "Mark set incomplete" : "Mark set complete"}
      >
        <Check className="h-3 w-3" />
      </button>

      {/* Set number */}
      <span
        className={cn(
          "text-xs font-semibold w-5 text-center shrink-0 tabular-nums",
          set.done ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        )}
      >
        {index + 1}
      </span>

      {/* Weight or BW badge */}
      {isBodyweight ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-md px-2 py-1">
            BW
          </span>
        </div>
      ) : (
        <Input
          type="number"
          inputMode="decimal"
          placeholder="kg"
          value={set.weight}
          onChange={(e) => onChange("weight", e.target.value)}
          className={cn(
            "h-10 text-center px-2 text-sm font-medium min-w-0 transition-opacity",
            set.done && "opacity-60"
          )}
          min="0"
          step="0.5"
        />
      )}

      {/* Reps */}
      <Input
        type="number"
        inputMode="numeric"
        placeholder="reps"
        value={set.reps}
        onChange={(e) => onChange("reps", e.target.value)}
        className={cn(
          "h-10 text-center px-2 text-sm font-medium min-w-0 transition-opacity",
          set.done && "opacity-60"
        )}
        min="0"
      />

      {/* RPE */}
      <Input
        type="number"
        inputMode="decimal"
        placeholder="RPE"
        value={set.rpe}
        onChange={(e) => onChange("rpe", e.target.value)}
        className={cn(
          "h-10 text-center px-2 text-sm font-medium min-w-0 w-16 shrink-0 transition-opacity",
          set.done && "opacity-60"
        )}
        min="1"
        max="10"
        step="0.5"
      />

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={cn(
          "h-10 w-9 flex items-center justify-center rounded-lg shrink-0 transition-colors",
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
  onSkip,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onToggleSetDone,
  isBodyweight,
}: {
  entry: ExerciseEntry;
  onRemove: () => void;
  onSkip: () => void;
  onAddSet: () => void;
  onRemoveSet: (setLocalId: string) => void;
  onUpdateSet: (setLocalId: string, field: EditableSetField, value: string) => void;
  onToggleSetDone: (setLocalId: string) => void;
  isBodyweight?: boolean;
}) {
  const doneCount = entry.sets.filter((s) => s.done).length;
  const allDone = doneCount === entry.sets.length && entry.sets.length > 0;

  // ── Skipped state — compact collapsed row ─────────────────────────────────
  if (entry.skipped) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border/60 bg-muted/20 opacity-60">
        <Ban className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground line-through flex-1 truncate">
          {entry.exerciseName}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">
          Skipped
        </Badge>
        <button
          onClick={onSkip}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium shrink-0 transition-colors"
        >
          <Undo2 className="h-3 w-3" />
          Restore
        </button>
      </div>
    );
  }

  // ── Active state ──────────────────────────────────────────────────────────
  return (
    <Card className={cn(allDone && "border-green-500/30")}>
      {/* Exercise header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Dumbbell
              className={cn(
                "h-4 w-4 shrink-0",
                allDone ? "text-green-500" : "text-primary"
              )}
              strokeWidth={2}
            />
            <h3 className="font-semibold text-sm truncate">{entry.exerciseName}</h3>
          </div>
          {doneCount > 0 && (
            <p
              className={cn(
                "text-xs ml-6 mt-0.5 font-medium",
                allDone
                  ? "text-green-600 dark:text-green-400"
                  : "text-muted-foreground"
              )}
            >
              {allDone ? "✓ All sets done" : `${doneCount} / ${entry.sets.length} sets done`}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 ml-2">
          <button
            onClick={onSkip}
            title="Skip this exercise today"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            title="Remove from this session"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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

      <CardContent className="pt-0 space-y-2 pb-5">
        {/* Column headers */}
        <div className="flex items-center gap-2 px-1 mb-1">
          <span className="w-6 shrink-0" /> {/* completion toggle */}
          <span className="w-5 shrink-0" /> {/* set number */}
          <span className="flex-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {isBodyweight ? "bw" : "kg"}
          </span>
          <span className="flex-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            reps
          </span>
          <span className="w-16 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
            rpe
          </span>
          <span className="w-9 shrink-0" />
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
            onToggleDone={() => onToggleSetDone(set.localId)}
            isBodyweight={isBodyweight}
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
  const router = useRouter();
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

  // Derived session progress
  const activeExercises = useMemo(
    () => exercises.filter((e) => !e.skipped),
    [exercises]
  );
  const totalSets = useMemo(
    () => activeExercises.reduce((a, e) => a + e.sets.length, 0),
    [activeExercises]
  );
  const doneSets = useMemo(
    () => exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0),
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
        skipped: false,
      },
    ]);
    setPickerOpen(false);
  }, [workoutLogs]);

  const removeExercise = useCallback((localId: string) => {
    setExercises((prev) => prev.filter((e) => e.localId !== localId));
  }, []);

  const skipExercise = useCallback((localId: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.localId === localId ? { ...e, skipped: !e.skipped } : e
      )
    );
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
    (
      exerciseLocalId: string,
      setLocalId: string,
      field: EditableSetField,
      value: string
    ) => {
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

  const toggleSetDone = useCallback(
    (exerciseLocalId: string, setLocalId: string) => {
      setExercises((prev) =>
        prev.map((e) =>
          e.localId === exerciseLocalId
            ? {
                ...e,
                sets: e.sets.map((s) =>
                  s.localId === setLocalId ? { ...s, done: !s.done } : s
                ),
              }
            : e
        )
      );
    },
    []
  );

  // Load all exercises from a routine, pre-filling from last session
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
              skipped: false,
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
              done: false,
            })),
            skipped: false,
          };
        });
      setExercises(entries);
    },
    [workoutLogs]
  );

  // ── Save ────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    // Only consider non-skipped exercises
    const active = exercises.filter((e) => !e.skipped);

    if (active.length === 0) {
      toast.error("Add at least one exercise before saving.");
      return;
    }

    const validExercises = active.filter((e) =>
      e.sets.some((s) => s.reps !== "" && parseInt(s.reps) > 0)
    );

    if (validExercises.length === 0) {
      toast.error("Log at least one set with reps before saving.");
      return;
    }

    const savedSets = validExercises.reduce(
      (acc, e) =>
        acc + e.sets.filter((s) => s.reps !== "" || s.weight !== "").length,
      0
    );

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

    const skippedCount = exercises.filter((e) => e.skipped).length;
    toast.success(
      `Workout saved — ${validExercises.length} exercise${validExercises.length !== 1 ? "s" : ""}, ${savedSets} sets`,
      {
        description:
          skippedCount > 0
            ? `${skippedCount} skipped exercise${skippedCount !== 1 ? "s" : ""} not included`
            : format(new Date(), "EEEE, MMMM d"),
      }
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
        <div className="h-10 rounded-xl bg-muted" />
        <div className="h-28 rounded-xl bg-muted" />
        <div className="h-10 rounded-xl bg-muted" />
        <div className="h-48 rounded-xl bg-muted" />
        <div className="h-14 rounded-xl bg-muted" />
      </div>
    );
  }

  const skippedCount = exercises.filter((e) => e.skipped).length;

  return (
    <>
      <div className="px-4 pt-6 pb-12 space-y-6 max-w-lg mx-auto">

        {/* ── Page header ─────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.back()}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors -ml-1"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold">Log Workout</h1>
          </div>

          {exercises.length > 0 && (
            <Badge
              variant={doneSets > 0 && doneSets === totalSets ? "default" : "secondary"}
              className="tabular-nums"
            >
              {doneSets > 0 ? `${doneSets}/${totalSets} done` : `${activeExercises.length} ex · ${totalSets} sets`}
            </Badge>
          )}
        </div>

        {/* ── No active block warning ──────────────────── */}
        {!activeBlock && <NoBlockBanner />}

        {/* ── Session info card ────────────────────────── */}
        <Card>
          <CardContent className="pt-6 pb-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {/* Date */}
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="session-date" className="text-xs font-medium">Date</Label>
                <Input
                  id="session-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 text-sm"
                />
              </div>

              {/* Duration */}
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="session-duration" className="text-xs font-medium">Duration</Label>
                <Input
                  id="session-duration"
                  type="number"
                  inputMode="numeric"
                  placeholder="minutes"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  className="h-11 text-sm"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="session-notes">Notes (optional)</Label>
              <Textarea
                id="session-notes"
                placeholder="How did it feel? Any PRs?"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Load from routine ────────────────────────── */}
        {blockRoutines.length > 0 && exercises.length === 0 && (
          <div>
            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground shrink-0 px-1">or load a routine</span>
              <Separator className="flex-1" />
            </div>

            <div className="mt-4 space-y-2.5">
              {blockRoutines.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRoutine(r)}
                  className="w-full flex items-center justify-between px-4 py-4 rounded-xl border border-border hover:bg-accent active:bg-accent transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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

        {/* ── Exercise list ────────────────────────────── */}
        {exercises.length > 0 && (
          <div className="space-y-3">
            {/* Section label */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Exercises
              </span>
              {skippedCount > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {skippedCount} skipped
                </span>
              )}
            </div>

            {/* Cards */}
            {exercises.map((entry) => {
              const exRecord = allExercises.find((e) => e.id === entry.exerciseId);
              const bw = isBodyweightExercise(entry.exerciseName, exRecord?.category);
              return (
                <ExerciseCard
                  key={entry.localId}
                  entry={entry}
                  isBodyweight={bw}
                  onRemove={() => removeExercise(entry.localId)}
                  onSkip={() => skipExercise(entry.localId)}
                  onAddSet={() => addSet(entry.localId)}
                  onRemoveSet={(sid) => removeSet(entry.localId, sid)}
                  onUpdateSet={(sid, field, val) =>
                    updateSet(entry.localId, sid, field, val)
                  }
                  onToggleSetDone={(sid) => toggleSetDone(entry.localId, sid)}
                />
              );
            })}

            {/* Reset session */}
            <button
              onClick={() => setExercises([])}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mx-auto pt-1"
            >
              <RotateCcw className="h-3 w-3" />
              Clear session
            </button>
          </div>
        )}

        {/* ── Add Exercise ─────────────────────────────── */}
        <Button
          variant="outline"
          className="w-full h-12 gap-2 border-dashed"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Exercise
        </Button>

        {/* ── Save ─────────────────────────────────────── */}
        <Button
          className="w-full h-14 text-base font-semibold gap-2"
          size="lg"
          onClick={handleSave}
          disabled={activeExercises.length === 0}
        >
          {activeExercises.length > 0
            ? `Save Workout · ${activeExercises.length} exercise${activeExercises.length !== 1 ? "s" : ""}`
            : "Save Workout"}
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
