"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Dumbbell, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  detailedBlockSessionName,
  flattenDetailedDayExercises,
  type DetailedDayExercise,
} from "@/lib/detailedBlockWorkout";
import type { DetailedBlock, DetailedBlockDay, SetType } from "@/lib/types";

// ─── Local types ───────────────────────────────────────────────────────────────

interface SetRow {
  localId: string;
  weight: string;
  reps: string;
}

interface ExerciseEntry {
  localId: string;
  sourceExerciseId: string;
  exerciseName: string;
  originalExerciseName?: string;
  sectionName: string;
  supersetLabel?: string;
  isBodyweight: boolean;
  defaultWeight: string;
  sets: SetRow[];
}

interface ActiveWorkoutProps {
  block: DetailedBlock;
  day: DetailedBlockDay;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptySet(defaultWeight = ""): SetRow {
  return { localId: uid(), weight: defaultWeight, reps: "" };
}

function initialRepsForSet(targetReps: string): string {
  const match = targetReps.match(/^(\d+)/);
  return match ? match[1] : "";
}

function buildExerciseEntries(exercises: DetailedDayExercise[]): ExerciseEntry[] {
  return exercises.map((ex) => ({
    localId: uid(),
    sourceExerciseId: ex.sourceExerciseId,
    exerciseName: ex.name,
    sectionName: ex.sectionName,
    supersetLabel: ex.supersetLabel,
    isBodyweight: ex.isBodyweight,
    defaultWeight: ex.defaultWeight,
    sets: Array.from({ length: ex.setCount }, () =>
      emptySet(ex.defaultWeight)
    ).map((set, index) =>
      index === 0 ? { ...set, reps: initialRepsForSet(ex.targetReps) } : set
    ),
  }));
}

// ─── Set row ───────────────────────────────────────────────────────────────────

function SetRowInput({
  index,
  set,
  isBodyweight,
  onChange,
  onDelete,
  canDelete,
}: {
  index: number;
  set: SetRow;
  isBodyweight: boolean;
  onChange: (field: "weight" | "reps", value: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold w-5 text-center shrink-0 font-data tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <Input
        type="text"
        inputMode="text"
        placeholder={isBodyweight ? "BW" : "kg"}
        value={set.weight}
        onChange={(e) => onChange("weight", e.target.value)}
        className="h-9 text-center px-2 text-sm font-data min-w-0 flex-1"
      />
      <Input
        type="number"
        inputMode="numeric"
        placeholder="reps"
        value={set.reps}
        onChange={(e) => onChange("reps", e.target.value)}
        className="h-9 text-center px-2 text-sm font-data min-w-0 flex-1"
        min="0"
      />
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        className={cn(
          "h-9 w-8 flex items-center justify-center rounded-sm shrink-0 transition-colors",
          canDelete
            ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            : "text-muted-foreground/30 pointer-events-none"
        )}
        aria-label="Remove set"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  entry,
  onRename,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
}: {
  entry: ExerciseEntry;
  onRename: (name: string) => void;
  onAddSet: () => void;
  onRemoveSet: (setLocalId: string) => void;
  onUpdateSet: (setLocalId: string, field: "weight" | "reps", value: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(entry.exerciseName);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    onRename(trimmed || entry.exerciseName);
    setEditingName(false);
  };

  return (
    <div className="rounded-sm border border-border bg-card px-3.5 py-3 space-y-2.5">
      <div className="flex items-start gap-2 min-w-0">
        <Dumbbell className="h-4 w-4 shrink-0 text-primary mt-0.5" strokeWidth={2} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {editingName ? (
              <Input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") {
                    setNameDraft(entry.exerciseName);
                    setEditingName(false);
                  }
                }}
                className="h-7 text-sm font-semibold px-1.5 flex-1 min-w-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(entry.exerciseName);
                  setEditingName(true);
                }}
                className="text-left min-w-0 flex-1 group"
                title="Tap to rename for this session only"
              >
                <span
                  className={cn(
                    "text-sm font-semibold leading-snug block truncate",
                    entry.originalExerciseName && "italic text-muted-foreground"
                  )}
                >
                  {entry.exerciseName}
                </span>
              </button>
            )}
            {!editingName && (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(entry.exerciseName);
                  setEditingName(true);
                }}
                className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Rename exercise"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {entry.sectionName}
            {entry.supersetLabel ? ` · ${entry.supersetLabel}` : ""}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 pl-6">
        <div className="flex items-center gap-2 px-0 mb-0.5">
          <span className="w-5 shrink-0" />
          <span className="flex-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {entry.isBodyweight ? "bw" : "kg"}
          </span>
          <span className="flex-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            reps
          </span>
          <span className="w-8 shrink-0" />
        </div>

        {entry.sets.map((set, index) => (
          <SetRowInput
            key={set.localId}
            index={index}
            set={set}
            isBodyweight={entry.isBodyweight}
            canDelete={entry.sets.length > 1}
            onChange={(field, value) => onUpdateSet(set.localId, field, value)}
            onDelete={() => onRemoveSet(set.localId)}
          />
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={onAddSet}
          className="w-full h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Plus className="h-3 w-3" />
          Add Set
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ActiveWorkout({ block, day, onClose, onSaved }: ActiveWorkoutProps) {
  const addWorkoutLog = useAppStore((s) => s.addWorkoutLog);
  const startTimeRef = useRef(new Date().toISOString());

  const sessionTitle = useMemo(() => detailedBlockSessionName(block, day), [block, day]);

  const [exercises, setExercises] = useState<ExerciseEntry[]>(() =>
    buildExerciseEntries(flattenDetailedDayExercises(day))
  );

  const totalSets = useMemo(
    () => exercises.reduce((count, ex) => count + ex.sets.length, 0),
    [exercises]
  );

  const renameExercise = useCallback((localId: string, newName: string) => {
    setExercises((prev) =>
      prev.map((entry) => {
        if (entry.localId !== localId) return entry;
        const baseline = entry.originalExerciseName ?? entry.exerciseName;
        if (newName === baseline) {
          return { ...entry, exerciseName: newName, originalExerciseName: undefined };
        }
        return { ...entry, exerciseName: newName, originalExerciseName: baseline };
      })
    );
  }, []);

  const addSet = useCallback((localId: string) => {
    setExercises((prev) =>
      prev.map((entry) => {
        if (entry.localId !== localId) return entry;
        const last = entry.sets[entry.sets.length - 1];
        const nextWeight = last?.weight?.trim() ? last.weight : entry.defaultWeight;
        return { ...entry, sets: [...entry.sets, emptySet(nextWeight)] };
      })
    );
  }, []);

  const removeSet = useCallback((localId: string, setLocalId: string) => {
    setExercises((prev) =>
      prev.map((entry) =>
        entry.localId === localId
          ? { ...entry, sets: entry.sets.filter((set) => set.localId !== setLocalId) }
          : entry
      )
    );
  }, []);

  const updateSet = useCallback(
    (localId: string, setLocalId: string, field: "weight" | "reps", value: string) => {
      setExercises((prev) =>
        prev.map((entry) =>
          entry.localId === localId
            ? {
                ...entry,
                sets: entry.sets.map((set) =>
                  set.localId === setLocalId ? { ...set, [field]: value } : set
                ),
              }
            : entry
        )
      );
    },
    []
  );

  const handleSave = useCallback(() => {
    const validExercises = exercises.filter((entry) =>
      entry.sets.some((set) => set.reps.trim() !== "" && parseInt(set.reps, 10) > 0)
    );

    if (validExercises.length === 0) {
      toast.error("Log at least one set with reps before saving.");
      return;
    }

    const savedSets = validExercises.reduce(
      (count, entry) =>
        count +
        entry.sets.filter(
          (set) =>
            set.reps.trim() !== "" ||
            set.weight.trim() !== ""
        ).length,
      0
    );

    addWorkoutLog({
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: startTimeRef.current,
      endTime: new Date().toISOString(),
      routineName: sessionTitle,
      detailedBlockId: block.id,
      detailedBlockDayId: day.id,
      exercises: validExercises.map((entry) => ({
        id: uid(),
        exerciseId: entry.sourceExerciseId,
        exerciseName: entry.exerciseName,
        ...(entry.originalExerciseName ? { originalExerciseName: entry.originalExerciseName } : {}),
        sets: entry.sets
          .filter((set) => set.reps.trim() !== "" || set.weight.trim() !== "")
          .map((set, index) => ({
            id: uid(),
            setNumber: index + 1,
            type: "normal" as SetType,
            weight: set.weight.trim(),
            reps: parseInt(set.reps, 10) || 0,
          })),
      })),
    });

    toast.success(`Workout saved — ${validExercises.length} exercises, ${savedSets} sets`, {
      description: sessionTitle,
    });

    onSaved();
  }, [exercises, addWorkoutLog, block.id, day.id, sessionTitle, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="shrink-0 border-b border-border px-4 pt-4 pb-3 space-y-2">
        <div className="flex items-start gap-2 max-w-lg mx-auto w-full">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors -ml-1 shrink-0"
            aria-label="Close workout"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Active Workout
            </p>
            <h2 className="text-base font-bold leading-tight truncate">{sessionTitle}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exercises.length} exercises · {totalSets} sets
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Cancel workout"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-lg mx-auto space-y-3">
          {exercises.map((entry) => (
            <ExerciseCard
              key={entry.localId}
              entry={entry}
              onRename={(name) => renameExercise(entry.localId, name)}
              onAddSet={() => addSet(entry.localId)}
              onRemoveSet={(setLocalId) => removeSet(entry.localId, setLocalId)}
              onUpdateSet={(setLocalId, field, value) =>
                updateSet(entry.localId, setLocalId, field, value)
              }
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-background">
        <div className="max-w-lg mx-auto">
          <Button className="w-full h-14 text-base font-semibold" size="lg" onClick={handleSave}>
            Save Workout
          </Button>
        </div>
      </div>
    </div>
  );
}
