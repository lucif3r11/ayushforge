"use client";

import { useState, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  ChevronRight,
  Trash2,
  Pencil,
  AlertTriangle,
  Check,
  X,
  Dumbbell,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn, weightToInputString, parseWeightKg, formatWeightDisplay, defaultExerciseWeight, detailedBlockLoadHints } from "@/lib/utils";
import type { WorkoutLog, SetType, DetailedBlock } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Editable types ───────────────────────────────────────────────────────────

interface EditSet {
  id: string;
  setNumber: number;
  type: SetType;
  weight: string;
  reps: string;
  rpe: string;
  notes: string;
}

interface EditExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  /** Set when the exercise name was edited for this logged session only. */
  originalExerciseName?: string;
  sets: EditSet[];
  notes: string;
}

interface EditWorkout {
  date: string;
  durationMinutes: string;
  notes: string;
  exercises: EditExercise[];
}

function toEdit(log: WorkoutLog): EditWorkout {
  return {
    date: log.date,
    durationMinutes: log.durationMinutes ? String(log.durationMinutes) : "",
    notes: log.notes ?? "",
    exercises: log.exercises.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      originalExerciseName: ex.originalExerciseName,
      notes: ex.notes ?? "",
      sets: ex.sets.map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        type: s.type,
        weight: weightToInputString(s.weight),
        reps: s.reps > 0 ? String(s.reps) : "",
        rpe: s.rpe !== undefined ? String(s.rpe) : "",
        notes: s.notes ?? "",
      })),
    })),
  };
}

function applyEdit(original: WorkoutLog, editable: EditWorkout): Omit<WorkoutLog, "id"> {
  return {
    routineId: original.routineId,
    routineName: original.routineName,
    date: editable.date,
    startTime: original.startTime,
    endTime: original.endTime,
    durationMinutes: editable.durationMinutes ? parseInt(editable.durationMinutes) : undefined,
    notes: editable.notes.trim() || undefined,
    bodyweight: original.bodyweight,
    rating: original.rating,
    exercises: editable.exercises.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      ...(ex.originalExerciseName ? { originalExerciseName: ex.originalExerciseName } : {}),
      notes: ex.notes.trim() || undefined,
      sets: ex.sets.map((s, i) => ({
        id: s.id,
        setNumber: i + 1,
        type: s.type,
        weight: (s.weight ?? "").trim(),
        reps: parseInt(s.reps) || 0,
        rpe: s.rpe ? parseFloat(s.rpe) : undefined,
        notes: s.notes.trim() || undefined,
      })),
    })),
  };
}

// ─── Single workout item ──────────────────────────────────────────────────────

function exerciseUsesBodyweight(
  exerciseName: string,
  exerciseNotes: string | undefined,
  detailedBlocks: DetailedBlock[]
): boolean {
  const blockHints = detailedBlockLoadHints(exerciseName, detailedBlocks);
  return (
    defaultExerciseWeight(exerciseName, undefined, exerciseNotes, ...blockHints) === "BW"
  );
}

function WorkoutItem({
  log,
  onUpdate,
  onDelete,
}: {
  log: WorkoutLog;
  onUpdate: (updates: Omit<WorkoutLog, "id">) => void;
  onDelete: () => void;
}) {
  const detailedBlocks = useAppStore((s) => s.detailedBlocks);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<EditWorkout | null>(null);

  const totalSets = log.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const totalVol = Math.round(
    log.exercises.reduce(
      (a, ex) => a + ex.sets.reduce((b, s) => b + parseWeightKg(s.weight) * s.reps, 0),
      0
    )
  );

  const startEdit = useCallback(() => {
    setDraft(toEdit(log));
    setEditing(true);
    setExpanded(true);
    setConfirmDelete(false);
  }, [log]);

  const cancelEdit = useCallback(() => {
    setDraft(null);
    setEditing(false);
  }, []);

  const saveEdit = useCallback(() => {
    if (!draft) return;
    if (draft.exercises.length === 0) {
      toast.error("A workout must have at least one exercise.");
      return;
    }
    onUpdate(applyEdit(log, draft));
    setDraft(null);
    setEditing(false);
    toast.success("Workout updated!");
  }, [draft, log, onUpdate]);

  // ── Draft patchers ──────────────────────────────────────────────────────────

  const patchDraft = useCallback(
    <K extends keyof Pick<EditWorkout, "date" | "durationMinutes" | "notes">>(
      field: K,
      value: EditWorkout[K]
    ) => {
      setDraft((d) => (d ? { ...d, [field]: value } : d));
    },
    []
  );

  const patchSet = useCallback(
    (
      exIdx: number,
      setIdx: number,
      field: keyof Pick<EditSet, "weight" | "reps" | "rpe" | "notes">,
      value: string
    ) => {
      setDraft((d) => {
        if (!d) return d;
        return {
          ...d,
          exercises: d.exercises.map((ex, ei) =>
            ei !== exIdx
              ? ex
              : {
                  ...ex,
                  sets: ex.sets.map((s, si) =>
                    si !== setIdx ? s : { ...s, [field]: value }
                  ),
                }
          ),
        };
      });
    },
    []
  );

  const patchExerciseName = useCallback((exIdx: number, newName: string) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        exercises: d.exercises.map((ex, ei) => {
          if (ei !== exIdx) return ex;
          const baseline = ex.originalExerciseName ?? ex.exerciseName;
          if (newName === baseline) {
            return { ...ex, exerciseName: newName, originalExerciseName: undefined };
          }
          return { ...ex, exerciseName: newName, originalExerciseName: baseline };
        }),
      };
    });
  }, []);

  const removeExercise = useCallback((exIdx: number) => {
    setDraft((d) => {
      if (!d) return d;
      return { ...d, exercises: d.exercises.filter((_, i) => i !== exIdx) };
    });
  }, []);

  const removeSet = useCallback((exIdx: number, setIdx: number) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        exercises: d.exercises.map((ex, ei) =>
          ei !== exIdx
            ? ex
            : { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }
        ),
      };
    });
  }, []);

  const addSet = useCallback((exIdx: number) => {
    setDraft((d) => {
      if (!d) return d;
      const ex = d.exercises[exIdx];
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet: EditSet = {
        id: uid(),
        setNumber: ex.sets.length + 1,
        type: "normal",
        weight: lastSet?.weight ?? "",
        reps: lastSet?.reps ?? "",
        rpe: "",
        notes: "",
      };
      return {
        ...d,
        exercises: d.exercises.map((e, ei) =>
          ei !== exIdx ? e : { ...e, sets: [...e.sets, newSet] }
        ),
      };
    });
  }, []);

  return (
    <Card>
      {/* Collapsed header — hide when in edit mode */}
      {!editing && (
        <button
          onClick={() => { setExpanded((v) => !v); setConfirmDelete(false); }}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">
                {format(parseISO(log.date), "EEE, MMM d, yyyy")}
              </p>
              {log.durationMinutes && (
                <Badge variant="secondary" className="text-xs h-5">
                  {log.durationMinutes}min
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {log.exercises.length} exercise{log.exercises.length !== 1 ? "s" : ""} ·{" "}
              {totalSets} sets
              {totalVol > 0 &&
                ` · ${totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}k` : totalVol} kg`}
            </p>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
              expanded && "rotate-90"
            )}
          />
        </button>
      )}

      {/* Expanded / edit */}
      {(expanded || editing) && (
        <>
          {!editing && <Separator />}

          {/* Delete confirmation */}
          {confirmDelete && !editing && (
            <div className="m-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Delete this workout?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This permanently removes the session and cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={onDelete}>
                  Delete
                </Button>
              </div>
            </div>
          )}

          {editing && draft ? (
            // ── Edit mode ──────────────────────────────────────────────────
            <CardContent className="pt-5 pb-5 space-y-5">
              {/* Edit header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Edit Workout</p>
                <button
                  onClick={cancelEdit}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  aria-label="Cancel edit"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Date + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-medium">Date</Label>
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(e) => patchDraft("date", e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-medium">Duration</Label>
                  <Input
                    type="number"
                    value={draft.durationMinutes}
                    onChange={(e) => patchDraft("durationMinutes", e.target.value)}
                    placeholder="minutes"
                    className="h-10 text-sm"
                    min="1"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea
                  value={draft.notes}
                  onChange={(e) => patchDraft("notes", e.target.value)}
                  placeholder="Session notes…"
                  className="min-h-[52px] text-sm resize-none"
                />
              </div>

              {/* Per-exercise blocks */}
              {draft.exercises.map((ex, exIdx) => {
                const bw = exerciseUsesBodyweight(ex.exerciseName, ex.notes, detailedBlocks);
                return (
                  <div key={ex.id} className="space-y-2 rounded-xl border border-border/60 p-3">
                    {/* Exercise header */}
                    <div className="flex items-center gap-2">
                      <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
                      <Input
                        value={ex.exerciseName}
                        onChange={(e) => patchExerciseName(exIdx, e.target.value)}
                        title={
                          ex.originalExerciseName
                            ? `Originally "${ex.originalExerciseName}"`
                            : undefined
                        }
                        className={cn(
                          "h-8 text-sm font-semibold flex-1 min-w-0 px-2",
                          ex.originalExerciseName && "italic"
                        )}
                      />
                      {bw && (
                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                          BW
                        </span>
                      )}
                      <button
                        onClick={() => removeExercise(exIdx)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        aria-label={`Remove ${ex.exerciseName}`}
                        title="Remove exercise"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Column labels */}
                    <div className="flex items-center gap-2 pl-1">
                      <span className="w-5 text-[10px] text-muted-foreground shrink-0">#</span>
                      <span className="flex-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {bw ? "bw" : "kg"}
                      </span>
                      <span className="flex-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        reps
                      </span>
                      <span className="w-14 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                        rpe
                      </span>
                      <span className="w-7 shrink-0" />
                    </div>

                    {/* Set rows */}
                    {ex.sets.map((s, setIdx) => (
                      <div key={s.id} className="flex items-center gap-2 pl-1">
                        <span className="text-xs text-muted-foreground w-5 text-right shrink-0 tabular-nums">
                          {setIdx + 1}
                        </span>
                        {/* Weight (alphanumeric — accepts "80", "BW", "BW + 10kg", "Assisted", etc.) */}
                        <Input
                          type="text"
                          inputMode="text"
                          value={s.weight}
                          onChange={(e) => patchSet(exIdx, setIdx, "weight", e.target.value)}
                          className="h-9 text-center text-sm"
                          placeholder={bw ? "BW" : "kg"}
                        />
                        <Input
                          type="number"
                          value={s.reps}
                          onChange={(e) => patchSet(exIdx, setIdx, "reps", e.target.value)}
                          className="h-9 text-center text-sm"
                          placeholder="reps"
                          min="0"
                        />
                        <Input
                          type="number"
                          value={s.rpe}
                          onChange={(e) => patchSet(exIdx, setIdx, "rpe", e.target.value)}
                          className="h-9 text-center text-sm w-14 shrink-0"
                          placeholder="RPE"
                          min="1"
                          max="10"
                          step="0.5"
                        />
                        <button
                          onClick={() => removeSet(exIdx, setIdx)}
                          disabled={ex.sets.length <= 1}
                          className={cn(
                            "h-9 w-7 flex items-center justify-center rounded-lg shrink-0 transition-colors",
                            ex.sets.length > 1
                              ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              : "text-muted-foreground/20 pointer-events-none"
                          )}
                          aria-label="Remove set"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {/* Add set */}
                    <button
                      onClick={() => addSet(exIdx)}
                      className="w-full flex items-center justify-center gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors mt-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Set
                    </button>
                  </div>
                );
              })}

              {draft.exercises.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  All exercises removed — saving will delete this workout.
                </p>
              )}

              {/* Edit actions */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1 gap-1.5" onClick={saveEdit}>
                  <Check className="h-3.5 w-3.5" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          ) : (
            // ── Expanded read-only view ────────────────────────────────────
            <CardContent className="pt-3 pb-3 space-y-3">
              {log.notes && (
                <p className="text-xs text-muted-foreground italic">
                  &ldquo;{log.notes}&rdquo;
                </p>
              )}

              {log.exercises.map((ex) => {
                const bw = exerciseUsesBodyweight(ex.exerciseName, ex.notes, detailedBlocks);
                return (
                  <div key={ex.id}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p
                        className={cn(
                          "text-xs font-semibold",
                          ex.originalExerciseName && "italic text-muted-foreground"
                        )}
                        title={
                          ex.originalExerciseName
                            ? `Originally "${ex.originalExerciseName}"`
                            : undefined
                        }
                      >
                        {ex.exerciseName}
                      </p>
                      {bw && (
                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          BW
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 pl-5">
                      {ex.sets.map((s, i) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <span className="w-4 text-right">{i + 1}.</span>
                          <span className="font-medium text-foreground">
                            {formatWeightDisplay(s.weight, bw)} × {s.reps}
                          </span>
                          {s.rpe !== undefined && <span>· RPE {s.rpe}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Action row */}
              {!confirmDelete && (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={startEdit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/20"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

const PAGE = 10;

export default function WorkoutHistory() {
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const updateWorkoutLog = useAppStore((s) => s.updateWorkoutLog);
  const deleteWorkoutLog = useAppStore((s) => s.deleteWorkoutLog);
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(
    () => [...workoutLogs].sort((a, b) => b.date.localeCompare(a.date)),
    [workoutLogs]
  );
  const displayed = showAll ? sorted : sorted.slice(0, PAGE);

  if (workoutLogs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <Dumbbell className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.25} />
          <p className="text-xs text-muted-foreground">No workout sessions logged yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {displayed.map((log) => (
        <WorkoutItem
          key={log.id}
          log={log}
          onUpdate={(updates) => updateWorkoutLog(log.id, updates)}
          onDelete={() => {
            deleteWorkoutLog(log.id);
            toast.success("Workout deleted.");
          }}
        />
      ))}
      {!showAll && sorted.length > PAGE && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => setShowAll(true)}
        >
          Show all {sorted.length} sessions
        </Button>
      )}
    </div>
  );
}
