import type {
  DetailedBlock,
  DetailedBlockDay,
  DetailedBlockSection,
  DetailedExercise,
  DetailedExerciseGroup,
} from "./types";
import { defaultExerciseWeight } from "./utils";

export interface DetailedDayExercise {
  sourceExerciseId: string;
  name: string;
  sectionName: string;
  setCount: number;
  targetReps: string;
  defaultWeight: string;
  isBodyweight: boolean;
  notes?: string;
  supersetLabel?: string;
}

function isSupersetSection(section: DetailedBlockSection): boolean {
  const t = section.type?.toLowerCase();
  if (t && (t === "supersetgroup" || t === "supersetgroups" || t === "supersets")) return true;
  return !!(section.supersetGroups && section.supersetGroups.length > 0);
}

function sectionGroups(section: DetailedBlockSection): DetailedExerciseGroup[] {
  if (isSupersetSection(section) && section.supersetGroups && section.supersetGroups.length > 0) {
    return section.supersetGroups;
  }
  return section.groups;
}

export function parseDetailedSetCount(ex: DetailedExercise): number {
  const fromSets = ex.sets?.trim();
  if (fromSets) {
    const n = parseInt(fromSets, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }

  const combined = ex.setsReps?.trim();
  if (combined) {
    const match = combined.match(/^(\d+)\s*[×xX]\s*/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > 0) return n;
    }
    const n = parseInt(combined, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }

  return 1;
}

export function parseDetailedTargetReps(ex: DetailedExercise): string {
  const combined = ex.setsReps?.trim();
  if (combined) {
    const match = combined.match(/^\d+\s*[×xX]\s*(.+)$/);
    if (match) return match[1].trim();
  }
  return ex.reps?.trim() ?? "";
}

function setCountForExercise(group: DetailedExerciseGroup, ex: DetailedExercise): number {
  const rounds = group.rounds ? parseInt(group.rounds, 10) : Number.NaN;
  if (group.isSuperset && !Number.isNaN(rounds) && rounds > 0) return rounds;
  return parseDetailedSetCount(ex);
}

function exerciseDefaultWeight(ex: DetailedExercise): { weight: string; isBodyweight: boolean } {
  const weight = defaultExerciseWeight(ex.name, undefined, ex.load, ex.loadProgression, ex.notes);
  return { weight, isBodyweight: weight === "BW" };
}

/** Flattens every exercise from a detailed block day into log-ready rows. */
export function flattenDetailedDayExercises(day: DetailedBlockDay): DetailedDayExercise[] {
  const result: DetailedDayExercise[] = [];

  for (const section of day.sections) {
    for (const group of sectionGroups(section)) {
      const supersetSection = isSupersetSection(section);
      const showAsSuperset = supersetSection || group.isSuperset;

      for (const ex of group.exercises) {
        const { weight, isBodyweight } = exerciseDefaultWeight(ex);
        result.push({
          sourceExerciseId: ex.id,
          name: ex.name,
          sectionName: section.name,
          setCount: setCountForExercise({ ...group, isSuperset: showAsSuperset }, ex),
          targetReps: parseDetailedTargetReps(ex),
          defaultWeight: weight,
          isBodyweight,
          notes: ex.notes,
          supersetLabel: showAsSuperset ? group.label ?? group.groupName : undefined,
        });
      }
    }
  }

  return result;
}

export function detailedBlockSessionName(block: DetailedBlock, day: DetailedBlockDay): string {
  const dayLabel = day.label ? `${day.name} · ${day.label}` : day.name;
  return `${block.name} — ${dayLabel}`;
}

export function findDetailedBlockDay(
  block: DetailedBlock,
  dayId: string
): { day: DetailedBlockDay; dayIndex: number } | null {
  const dayIndex = block.days.findIndex((d) => d.id === dayId);
  if (dayIndex < 0) return null;
  return { day: block.days[dayIndex], dayIndex };
}
