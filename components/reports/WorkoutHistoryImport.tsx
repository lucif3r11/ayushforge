"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { weightToInputString } from "@/lib/utils";
import type { SetType } from "@/lib/types";

// ─── Exported file shape ──────────────────────────────────────────────────────

interface ExportedSet {
  setNumber: number;
  weight?: string | number;
  reps: number;
  rpe?: number;
  notes?: string;
}

interface ExportedExercise {
  name: string;
  notes?: string;
  sets: ExportedSet[];
}

interface ExportedSession {
  date: string;
  durationMinutes?: number;
  notes?: string;
  exercises: ExportedExercise[];
}

interface WorkoutExportFile {
  sessions: ExportedSession[];
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidExport(obj: unknown): obj is WorkoutExportFile {
  if (!obj || typeof obj !== "object") return false;
  const f = obj as Record<string, unknown>;
  if (!Array.isArray(f.sessions)) return false;
  if (f.sessions.length > 0) {
    const first = f.sessions[0] as Record<string, unknown>;
    if (typeof first.date !== "string") return false;
    if (!Array.isArray(first.exercises)) return false;
  }
  return true;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkoutHistoryImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<WorkoutExportFile | null>(null);
  const [importing, setImporting] = useState(false);

  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const addWorkoutLog = useAppStore((s) => s.addWorkoutLog);

  const existingDates = useMemo(
    () => new Set(workoutLogs.map((l) => l.date)),
    [workoutLogs]
  );

  const newCount = pending
    ? pending.sessions.filter((s) => !existingDates.has(s.date)).length
    : 0;
  const dupCount = pending ? pending.sessions.length - newCount : 0;

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      if (!isValidExport(parsed)) {
        toast.error("Invalid file format.", {
          description: "Make sure you're uploading an Ironclad workout history export.",
        });
        return;
      }
      if (parsed.sessions.length === 0) {
        toast.info("No sessions found in this file.");
        return;
      }
      setPending(parsed);
    } catch {
      toast.error("Could not read the file.", {
        description: "Make sure it's a valid JSON file.",
      });
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    setImporting(true);

    try {
      // Snapshot current dates so we can also handle intra-file duplicates
      const seen = new Set(workoutLogs.map((l) => l.date));
      let added = 0;
      let skipped = 0;

      for (const session of pending.sessions) {
        if (seen.has(session.date)) {
          skipped++;
          continue;
        }
        addWorkoutLog({
          date: session.date,
          startTime: `${session.date}T00:00:00.000Z`,
          durationMinutes: session.durationMinutes,
          notes: session.notes || undefined,
          exercises: session.exercises.map((ex) => ({
            id: uid(),
            exerciseId: uid(),
            exerciseName: ex.name,
            notes: ex.notes || undefined,
            sets: ex.sets.map((s) => ({
              id: uid(),
              setNumber: s.setNumber,
              type: "normal" as SetType,
              weight: weightToInputString(s.weight),
              reps: s.reps ?? 0,
              rpe: s.rpe,
              notes: s.notes || undefined,
            })),
          })),
        });
        seen.add(session.date);
        added++;
      }

      setPending(null);
      toast.success(
        `${added} session${added !== 1 ? "s" : ""} imported!`,
        {
          description:
            skipped > 0
              ? `${skipped} skipped — a session already exists on that date.`
              : undefined,
        }
      );
    } catch {
      toast.error("Import failed. The file may be corrupted.");
    } finally {
      setImporting(false);
    }
  }, [pending, workoutLogs, addWorkoutLog]);

  return (
    <>
      {/* Hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFile}
      />

      {/* Trigger button */}
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        Import Workout History
      </Button>

      {/* Inline confirmation — appears below both buttons (w-full breaks to own row) */}
      {pending && (
        <div className="w-full rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">
                Import {pending.sessions.length} session
                {pending.sessions.length !== 1 ? "s" : ""}?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {newCount > 0
                  ? `${newCount} new session${newCount !== 1 ? "s" : ""} will be added.`
                  : "All sessions already exist — nothing will be added."}
                {dupCount > 0 &&
                  ` ${dupCount} will be skipped (already logged on that date).`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setPending(null)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-primary-foreground border-0"
              onClick={handleConfirm}
              disabled={importing || newCount === 0}
            >
              {importing ? "Importing…" : newCount === 0 ? "Nothing to import" : "Import"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
