"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  DetailedExercise,
  DetailedExerciseGroup,
  DetailedBlockSection,
  DetailedBlockDay,
  ProgressionRow,
  ProgressionTable,
  WeeklyScheduleItem,
  DetailedBlock,
} from "@/lib/types";

export type DetailedBlockImportData = Omit<DetailedBlock, "id" | "createdAt" | "updatedAt">;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function optStr(val: unknown): string | undefined {
  if (typeof val === "string") {
    const t = val.trim();
    return t || undefined;
  }
  if (typeof val === "number" && !isNaN(val)) return String(val);
  return undefined;
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

// ─── Exercise / superset-group parsing ────────────────────────────────────────

function parseExercise(raw: unknown): DetailedExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const name = String(e.name ?? e.exercise ?? e.exerciseName ?? "").trim();
  if (!name) return null;
  return {
    id: uid(),
    name,
    sets: optStr(e.sets ?? e.targetSets),
    reps: optStr(e.reps ?? e.targetReps),
    load: optStr(e.load ?? e.weight ?? e.targetWeight ?? e.intensity ?? e.percent1RM ?? e["%1RM"]),
    rpe: optStr(e.rpe),
    tempo: optStr(e.tempo),
    rest: optStr(e.rest ?? e.restSeconds ?? e.restTime),
    notes: optStr(e.notes ?? e.note),
    formCues: parseStringArray(e.formCues ?? e.cues ?? e.formCue ?? e.cue),
    loadProgression: optStr(e.loadProgression ?? e.progression ?? e.progressionScheme),
  };
}

/** Pulls a back-to-back exercise list out of a group-like object, under any accepted key. */
function nestedExercisesArray(obj: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(obj.exercises)) return obj.exercises;
  if (Array.isArray(obj.pair)) return obj.pair;
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.movements)) return obj.movements;
  return null;
}

const SUPERSET_SECTION_KEYS = new Set([
  "supersets",
  "supersetgroup",
  "supersetgroups",
  "superset_groups",
]);

function isSupersetSectionSource(so: Record<string, unknown>): boolean {
  const typeKey = optStr(so.type)?.toLowerCase();
  const nameKey = optStr(so.name ?? so.title)?.toLowerCase();
  if (typeKey && SUPERSET_SECTION_KEYS.has(typeKey)) return true;
  if (nameKey && SUPERSET_SECTION_KEYS.has(nameKey.replace(/\s+/g, ""))) return true;
  if (nameKey === "superset groups") return true;
  return (
    Array.isArray(so.supersetGroups) &&
    so.supersetGroups.length > 0 &&
    (!Array.isArray(so.exercises) || so.exercises.length === 0)
  );
}

/** Normalises a section/group payload into a flat list of items for `parseExerciseGroups`. */
function asItemList(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.supersetGroups)) return [raw];
  const values = Object.values(obj).filter((v) => v && typeof v === "object");
  if (values.some((v) => nestedExercisesArray(v as Record<string, unknown>) !== null)) {
    return values;
  }
  return null;
}

/** Builds a superset/group descriptor from a group-like object and its already-parsed exercises. */
function buildExerciseGroup(obj: Record<string, unknown>, exs: DetailedExercise[]): DetailedExerciseGroup {
  return {
    id: uid(),
    label: optStr(obj.label ?? obj.group ?? obj.supersetGroup),
    groupName: optStr(obj.groupName ?? obj.group_name ?? obj.name ?? obj.title),
    rounds: optStr(obj.rounds ?? obj.round ?? obj.numRounds ?? obj.numberOfRounds),
    restAfterPair: optStr(
      obj.restAfterPair ??
        obj.rest_after_pair ??
        obj.restAfterRound ??
        obj.restAfterSuperset ??
        obj.restAfter ??
        obj.pairRest ??
        obj.groupRest
    ),
    isSuperset: exs.length > 1,
    exercises: exs,
  };
}

/**
 * Accepts a flat array of exercises (optionally tagged with a `supersetGroup`/
 * `group` key to pair them), an array of explicit groups shaped like
 * { label, exercises: [...] } / { pair: [...] }, or items that wrap one or
 * more such groups via { type: "supersetGroup", supersetGroups: [...] }.
 */
function parseExerciseGroups(raw: unknown): DetailedExerciseGroup[] {
  const items = asItemList(raw);
  if (!items) return [];

  const groups: DetailedExerciseGroup[] = [];
  const bySupersetKey = new Map<string, DetailedExerciseGroup>();

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;

    // Wrapper form: { type: "supersetGroup", supersetGroups: [ { groupName, rounds, restAfterPair, exercises: [...] }, ... ] }
    const wrapped = Array.isArray(obj.supersetGroups)
      ? obj.supersetGroups
      : obj.supersetGroups && typeof obj.supersetGroups === "object"
      ? [obj.supersetGroups]
      : null;
    if (wrapped) {
      for (const g of wrapped) {
        if (!g || typeof g !== "object") continue;
        const gObj = g as Record<string, unknown>;
        const nested = nestedExercisesArray(gObj);
        if (!nested) continue;
        const exs = nested.map(parseExercise).filter((x): x is DetailedExercise => x !== null);
        if (exs.length > 0) groups.push(buildExerciseGroup(gObj, exs));
      }
      continue;
    }

    // Single-group form: { label, groupName, rounds, restAfterPair, exercises: [...] }
    const nestedRaw = nestedExercisesArray(obj);
    if (nestedRaw) {
      const exs = nestedRaw.map(parseExercise).filter((x): x is DetailedExercise => x !== null);
      if (exs.length > 0) groups.push(buildExerciseGroup(obj, exs));
      continue;
    }

    // Flat exercise, optionally paired via a shared supersetGroup/group key
    const ex = parseExercise(obj);
    if (!ex) continue;
    const ssKey = optStr(obj.supersetGroup ?? obj.group ?? obj.pairGroup);
    if (ssKey) {
      let g = bySupersetKey.get(ssKey);
      if (!g) {
        g = { id: uid(), label: ssKey, isSuperset: true, exercises: [] };
        bySupersetKey.set(ssKey, g);
        groups.push(g);
      }
      g.exercises.push(ex);
    } else {
      groups.push({ id: uid(), isSuperset: false, exercises: [ex] });
    }
  }

  for (const g of groups) {
    if (g.exercises.length <= 1) g.isSuperset = false;
  }

  // Don't show an exercise both inside a superset and again as a standalone entry.
  const supersetNames = new Set(
    groups.filter((g) => g.isSuperset).flatMap((g) => g.exercises.map((e) => e.name.trim().toLowerCase()))
  );
  return groups.filter((g) => g.isSuperset || !supersetNames.has(g.exercises[0].name.trim().toLowerCase()));
}

// ─── Day / section parsing ─────────────────────────────────────────────────────

const SECTION_KEY_MAP: [string, string][] = [
  ["warmup", "Warm-up"],
  ["warmUp", "Warm-up"],
  ["warm_up", "Warm-up"],
  ["heavyCompounds", "Heavy Compounds"],
  ["heavy_compounds", "Heavy Compounds"],
  ["compounds", "Heavy Compounds"],
  ["unilateral", "Unilateral"],
  ["supersets", "Superset Groups"],
  ["supersetGroup", "Superset Groups"],
  ["supersetGroups", "Superset Groups"],
  ["superset_groups", "Superset Groups"],
  ["accessories", "Accessories"],
  ["accessory", "Accessories"],
  ["core", "Core"],
  ["hyroxFinisher", "Hyrox Finisher"],
  ["hyrox_finisher", "Hyrox Finisher"],
  ["finisher", "Hyrox Finisher"],
  ["cooldown", "Cool-down"],
  ["cool_down", "Cool-down"],
];

const DAY_META_KEYS = new Set([
  "name",
  "label",
  "day",
  "title",
  "focus",
  "estimatedtime",
  "liftingtime",
  "lifting_time",
  "duration",
  "time",
  "sections",
]);

/** Maps a raw section key/type/name (e.g. "supersetGroup") to its canonical display label. */
function sectionLabelForKey(key: unknown): string | undefined {
  if (typeof key !== "string") return undefined;
  const found = SECTION_KEY_MAP.find(([k]) => k.toLowerCase() === key.toLowerCase());
  return found?.[1];
}

function sectionExerciseCount(section: DetailedBlockSection): number {
  const groups = section.supersetGroups?.length ? section.supersetGroups : section.groups;
  return groups.reduce((n, g) => n + g.exercises.length, 0);
}

function parseSection(so: Record<string, unknown>): DetailedBlockSection | null {
  const rawName = optStr(so.name ?? so.title);
  const sname =
    sectionLabelForKey(rawName) ?? rawName ?? sectionLabelForKey(so.type) ?? "Section";
  const sectionType = optStr(so.type);

  if (isSupersetSectionSource(so)) {
    let supersetGroups = parseExerciseGroups(so.supersetGroups);
    if (supersetGroups.length === 0) {
      supersetGroups = parseExerciseGroups(so);
    }
    if (supersetGroups.length === 0) return null;
    return {
      id: uid(),
      name: sname,
      type: sectionType ?? "supersetGroup",
      groups: [],
      supersetGroups,
    };
  }

  let groups = parseExerciseGroups(so.exercises ?? so.items ?? so.groups);
  if (groups.length === 0 && so.supersetGroups) {
    groups = parseExerciseGroups(so.supersetGroups);
  }
  if (groups.length === 0) return null;

  return { id: uid(), name: sname, type: sectionType, groups };
}

function parseDay(raw: unknown, index: number): DetailedBlockDay | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const name = optStr(d.name ?? d.day ?? d.title) ?? `Day ${index + 1}`;
  const label = optStr(d.label ?? d.focus);
  const estimatedTime = optStr(d.estimatedTime ?? d.liftingTime ?? d.lifting_time ?? d.duration ?? d.time);

  const sections: DetailedBlockSection[] = [];
  const seen = new Set<string>();

  if (Array.isArray(d.sections)) {
    for (const s of d.sections) {
      if (!s || typeof s !== "object") continue;
      const section = parseSection(s as Record<string, unknown>);
      if (section && !seen.has(section.name.toLowerCase())) {
        sections.push(section);
        seen.add(section.name.toLowerCase());
      }
    }
  }

  // Named day-level keys (e.g. heavyCompounds, supersetGroups) — preserve JSON key order.
  for (const key of Object.keys(d)) {
    if (DAY_META_KEYS.has(key.toLowerCase())) continue;
    const label = sectionLabelForKey(key);
    if (!label || seen.has(label.toLowerCase())) continue;
    const raw = d[key];
    if (!raw) continue;

    if (SUPERSET_SECTION_KEYS.has(key.toLowerCase())) {
      let supersetGroups = parseExerciseGroups(raw);
      if (supersetGroups.length === 0 && raw && typeof raw === "object" && !Array.isArray(raw)) {
        supersetGroups = parseExerciseGroups((raw as Record<string, unknown>).supersetGroups);
      }
      if (supersetGroups.length > 0) {
        sections.push({
          id: uid(),
          name: label,
          type: "supersetGroup",
          groups: [],
          supersetGroups,
        });
        seen.add(label.toLowerCase());
      }
      continue;
    }

    const groups = parseExerciseGroups(raw);
    if (groups.length > 0) {
      sections.push({ id: uid(), name: label, type: key, groups });
      seen.add(label.toLowerCase());
    }
  }

  if (sections.length === 0) return null;
  return { id: uid(), name, label, estimatedTime, sections };
}

// ─── Weekly schedule / global instructions / progression parsing ─────────────

function parseWeeklySchedule(raw: unknown): WeeklyScheduleItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") {
          const m = item.split(/[:—-]/);
          return { day: (m[0] ?? "").trim(), label: m.slice(1).join(":").trim() };
        }
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          return {
            day: String(o.day ?? o.name ?? "").trim(),
            label: String(o.label ?? o.focus ?? o.workout ?? o.session ?? "").trim(),
          };
        }
        return { day: "", label: "" };
      })
      .filter((x) => x.day);
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .map(([day, label]) => ({ day, label: String(label ?? "").trim() }))
      .filter((x) => x.day);
  }
  return [];
}

function parseGlobalInstructions(raw: unknown): {
  beforeEverySession: string[];
  dayAddOns: Record<string, string[]>;
} {
  if (!raw || typeof raw !== "object") return { beforeEverySession: [], dayAddOns: {} };
  const o = raw as Record<string, unknown>;
  const beforeEverySession = parseStringArray(o.beforeEverySession ?? o.beforeEvery ?? o.before);
  const dayAddOnsRaw = o.dayAddOns ?? o.addOns ?? o.dayAddOn;
  const dayAddOns: Record<string, string[]> = {};
  if (dayAddOnsRaw && typeof dayAddOnsRaw === "object" && !Array.isArray(dayAddOnsRaw)) {
    for (const [day, val] of Object.entries(dayAddOnsRaw as Record<string, unknown>)) {
      const arr = parseStringArray(val);
      if (arr.length > 0) dayAddOns[day] = arr;
    }
  }
  return { beforeEverySession, dayAddOns };
}

function parseProgressionRows(raw: unknown): ProgressionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r, idx): ProgressionRow | null => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      let week: string;
      if (typeof o.week === "number") week = `Week ${o.week}`;
      else if (typeof o.week === "string" && o.week.trim()) {
        week = /^\d+$/.test(o.week.trim()) ? `Week ${o.week.trim()}` : o.week.trim();
      } else if (typeof o.label === "string" && o.label.trim()) week = o.label.trim();
      else week = `Week ${idx + 1}`;
      return {
        week,
        load: optStr(o.load ?? o.weight ?? o.intensity),
        sets: optStr(o.sets),
        reps: optStr(o.reps),
        rpe: optStr(o.rpe),
        notes: optStr(o.notes),
      };
    })
    .filter((r): r is ProgressionRow => r !== null);
}

function parseProgressionTables(raw: unknown): ProgressionTable[] {
  if (Array.isArray(raw)) {
    return raw
      .map((t) => {
        if (!t || typeof t !== "object") return null;
        const o = t as Record<string, unknown>;
        const lift = String(o.lift ?? o.exercise ?? o.name ?? "").trim();
        if (!lift) return null;
        const rows = parseProgressionRows(o.rows ?? o.weeks);
        if (rows.length === 0) return null;
        return { id: uid(), lift, rows };
      })
      .filter((t): t is ProgressionTable => t !== null);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .map(([lift, rows]) => ({ id: uid(), lift, rows: parseProgressionRows(rows) }))
      .filter((t) => t.rows.length > 0);
  }
  return [];
}

// ─── Top-level file parsing ────────────────────────────────────────────────────

export function parseDetailedBlockFile(raw: unknown): DetailedBlockImportData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.type !== "detailed_block") return null;

  const name = optStr(obj.name ?? obj.blockName ?? obj.title) ?? "Untitled Block";
  const period = optStr(obj.period ?? obj.duration ?? obj.dates);
  const focus = optStr(obj.focus ?? obj.goal);
  const targets = parseStringArray(obj.targets ?? obj.target ?? obj.goals);
  const weeklySchedule = parseWeeklySchedule(obj.weeklySchedule ?? obj.schedule ?? obj.masterSchedule);
  const { beforeEverySession, dayAddOns } = parseGlobalInstructions(obj.globalInstructions ?? obj.instructions);

  const daysRaw = Array.isArray(obj.days) ? obj.days : [];
  const days = daysRaw.map((d, i) => parseDay(d, i)).filter((d): d is DetailedBlockDay => d !== null);
  if (days.length === 0) return null;

  const progressionTables = parseProgressionTables(obj.progressionTables ?? obj.progression ?? obj.progressions);

  return { name, period, focus, targets, weeklySchedule, beforeEverySession, dayAddOns, days, progressionTables };
}

/** Explains why `parseDetailedBlockFile` returned null, for user-facing error messages. */
export function describeDetailedBlockIssue(raw: unknown): { title: string; description: string } {
  if (!raw || typeof raw !== "object") {
    return {
      title: "Could not read this file.",
      description: "Expected a JSON object with a \"detailed_block\" type.",
    };
  }
  const obj = raw as Record<string, unknown>;

  if (obj.type !== "detailed_block") {
    const type = typeof obj.type === "string" ? obj.type : undefined;
    if (type === "workout-plan" || type === "workout_only" || (Array.isArray(obj.blocks) && !type)) {
      return {
        title: "This is a simple routine plan, not a Detailed Block.",
        description: 'Use the "Import Plan" section in the Routines tab instead.',
      };
    }
    if (type === "nutrition-plan" || type === "nutrition_only" || type === "macro-plan") {
      return {
        title: "This is a nutrition/macro plan, not a Detailed Block.",
        description: "Import it from the Nutrition tab instead.",
      };
    }
    return {
      title: type ? `Unrecognized type "${type}".` : "Missing or unrecognized \"type\" field.",
      description: 'Expected { "type": "detailed_block", "days": [...] } — see Ironclad_DetailedBlock_Format.md.',
    };
  }

  if (!Array.isArray(obj.days) || obj.days.length === 0) {
    return {
      title: "No training days found.",
      description: 'A detailed block needs a non-empty "days" array — see Ironclad_DetailedBlock_Format.md.',
    };
  }

  return {
    title: "Couldn't parse any training days.",
    description: "Check that each day has at least one recognised section (e.g. heavyCompounds, supersetGroups, core).",
  };
}

// ─── Totals helper ────────────────────────────────────────────────────────────

function countExercises(days: DetailedBlockDay[]): number {
  return days.reduce((acc, d) => acc + d.sections.reduce((a, s) => a + sectionExerciseCount(s), 0), 0);
}

// ─── Preview card ─────────────────────────────────────────────────────────────

function DayPreview({ day }: { day: DetailedBlockDay }) {
  const [expanded, setExpanded] = useState(false);
  const exCount = day.sections.reduce((a, s) => a + sectionExerciseCount(s), 0);

  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Dumbbell className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">
              {day.name}
              {day.label ? ` — ${day.label}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {day.sections.length} section{day.sections.length !== 1 ? "s" : ""} · {exCount} exercise
              {exCount !== 1 ? "s" : ""}
              {day.estimatedTime ? ` · ~${day.estimatedTime}` : ""}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pl-6"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? "Hide" : "Show"} sections
      </button>

      {expanded && (
        <div className="pl-6 space-y-1.5">
          {day.sections.map((s) => (
            <div key={s.id} className="text-xs">
              <span className="font-medium text-foreground">{s.name}</span>
              <span className="text-muted-foreground">
                {" — "}
                {sectionExerciseCount(s)} exercise
                {sectionExerciseCount(s) !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Step = "idle" | "preview" | "success";

export default function DetailedBlockImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<DetailedBlockImportData | null>(null);

  const addDetailedBlock = useAppStore((s) => s.addDetailedBlock);

  const processFile = useCallback((file: File) => {
    file.text().then((text) => {
      try {
        const raw = JSON.parse(text);
        const data = parseDetailedBlockFile(raw);

        if (!data) {
          const { title, description } = describeDetailedBlockIssue(raw);
          toast.error(title, { description });
          return;
        }

        setParsed(data);
        setStep("preview");
      } catch {
        toast.error("Could not parse the file.", {
          description: "Make sure it's a valid JSON file.",
        });
      }
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleConfirm = useCallback(() => {
    if (!parsed) return;
    setImporting(true);
    try {
      addDetailedBlock(parsed);
      setStep("success");
      toast.success("Detailed block imported!");
    } catch {
      toast.error("Import failed.");
    } finally {
      setImporting(false);
    }
  }, [parsed, addDetailedBlock]);

  const handleReset = useCallback(() => {
    setParsed(null);
    setStep("idle");
  }, []);

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === "success" && parsed) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              Detailed block imported!
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {parsed.days.length} day{parsed.days.length !== 1 ? "s" : ""} ·{" "}
              {countExercises(parsed.days)} exercise{countExercises(parsed.days) !== 1 ? "s" : ""}
              {parsed.progressionTables.length > 0
                ? ` · ${parsed.progressionTables.length} progression table${parsed.progressionTables.length !== 1 ? "s" : ""}`
                : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
          Import Another Block
        </Button>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if (step === "preview" && parsed) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{parsed.name}</p>
            <p className="text-xs text-muted-foreground">
              {parsed.days.length} day{parsed.days.length !== 1 ? "s" : ""} detected
              {parsed.period ? ` · ${parsed.period}` : ""}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {parsed.targets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {parsed.targets.map((t, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          {parsed.days.map((d) => (
            <DayPreview key={d.id} day={d} />
          ))}
        </div>

        {parsed.progressionTables.length > 0 && (
          <div className="flex items-center gap-1.5 px-1">
            <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              {parsed.progressionTables.length} progression table
              {parsed.progressionTables.length !== 1 ? "s" : ""}:{" "}
              {parsed.progressionTables.map((t) => t.lift).join(", ")}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleReset} disabled={importing}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 gap-1.5" onClick={handleConfirm} disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Import Block
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Idle (drop zone) ──────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 cursor-pointer select-none transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <div className={cn("rounded-full p-3 transition-colors", dragOver ? "bg-primary/10" : "bg-muted")}>
          <Upload className={cn("h-5 w-5 transition-colors", dragOver ? "text-primary" : "text-muted-foreground")} />
        </div>
        <div className="text-center pointer-events-none">
          <p className="text-sm font-medium">
            {dragOver ? "Drop to import" : "Drop detailed block here"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            or click to select a .json file
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <p className="text-xs text-muted-foreground text-center">
        Accepts{" "}
        <code className="bg-muted px-1 py-0.5 rounded text-xs">detailed_block</code>{" "}
        JSON — see <span className="font-medium">Ironclad_DetailedBlock_Format.md</span> for the spec.
      </p>
    </div>
  );
}
