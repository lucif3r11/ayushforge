export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "full_body"
  | "cardio"
  | "other";

export type ExerciseCategory = "compound" | "isolation" | "cardio" | "mobility";

export type SetType = "normal" | "warmup" | "drop" | "failure";

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  category: ExerciseCategory;
  notes?: string;
  createdAt: string;
}

export interface SetLog {
  id: string;
  setNumber: number;
  type: SetType;
  /** Free-form weight/load, e.g. "80", "BW", "BW + 10kg", "Assisted". */
  weight: string;
  reps: number;
  rpe?: number;
  notes?: string;
}

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  /** Set when the exercise name was edited for this logged session only —
   *  the original routine / Detailed Block exercise is unaffected. */
  originalExerciseName?: string;
  sets: SetLog[];
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  routineId?: string;
  routineName?: string;
  date: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  exercises: ExerciseLog[];
  bodyweight?: number;
  notes?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
}

export interface RoutineExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  targetWeight?: number;
  restSeconds?: number;
  notes?: string;
  order: number;
  supersetGroup?: string;
  tempo?: string;
  progressionScheme?: string;
}

export interface Routine {
  id: string;
  blockId?: string;
  name: string;
  description?: string;
  exercises: RoutineExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface Block {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate?: string;
  routineIds: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Supplement {
  name: string;
  doseAmount: string;
  doseUnit: string;
  timing: string;
  notes?: string;
}

export interface Meal {
  name: string;
  time?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  notes?: string;
}

export interface DietSupps {
  id: string;
  date: string;
  targetCalories?: number;
  targetProteinG?: number;
  meals: Meal[];
  supplements: Supplement[];
  waterMl?: number;
  notes?: string;
}

export interface NutritionSupplement {
  id: string;
  name: string;
  dose: string;      // e.g. "5 g", "2 capsules"
  timing: string;    // e.g. "Morning with breakfast"
  notes?: string;
}

export interface DietMeal {
  label: string;     // "Breakfast", "Pre-Workout", etc.
  content: string;
}

export const DAY_TYPE_KEYS = [
  "vegTraining",
  "eggTraining",
  "wednesday",
  "sunday",
] as const;

export type DayTypeKey = (typeof DAY_TYPE_KEYS)[number];

export interface NutritionPlan {
  dietNotes: string;
  meals: DietMeal[];
  suppNotes: string;
  supplements: NutritionSupplement[];
  /** Per-day-type meal plans; keyed by DayTypeKey */
  dayTypePlans?: Partial<Record<DayTypeKey, DietMeal[]>>;
  updatedAt: string;
}

// ─── Structured macro plan ────────────────────────────────────────────────────
// See Ironclad_Nutrition_Format.md for the import JSON shape.

export interface MacroFoodItem {
  id: string;
  name: string;
  quantity: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

export interface MacroMeal {
  id: string;
  name: string;
  items: MacroFoodItem[];
  notes?: string;
}

export type MacroDayType = "vegetarian" | "eggetarian" | "refeed" | "sunday";

export interface MacroDayPlan {
  id: string;
  dayType: MacroDayType;
  label?: string;
  meals: MacroMeal[];
}

export interface MacroPlan {
  dayPlans: MacroDayPlan[];
  updatedAt: string;
}

// ─── Detailed training block (advanced import) ───────────────────────────────
// See Ironclad_DetailedBlock_Format.md for the import JSON shape.

export interface DetailedExercise {
  id: string;
  name: string;
  sets?: string;
  reps?: string;
  load?: string;
  rpe?: string;
  tempo?: string;
  rest?: string;
  notes?: string;
  formCues?: string[];
  loadProgression?: string;
}

/** A single exercise, or a superset pair/group of exercises performed back-to-back. */
export interface DetailedExerciseGroup {
  id: string;
  label?: string;
  isSuperset: boolean;
  exercises: DetailedExercise[];
}

export interface DetailedBlockSection {
  id: string;
  name: string;
  groups: DetailedExerciseGroup[];
}

export interface DetailedBlockDay {
  id: string;
  name: string;
  label?: string;
  estimatedTime?: string;
  sections: DetailedBlockSection[];
}

export interface ProgressionRow {
  week: string;
  load?: string;
  sets?: string;
  reps?: string;
  rpe?: string;
  notes?: string;
}

export interface ProgressionTable {
  id: string;
  lift: string;
  rows: ProgressionRow[];
}

export interface WeeklyScheduleItem {
  day: string;
  label: string;
}

export interface DetailedBlock {
  id: string;
  name: string;
  period?: string;
  focus?: string;
  targets: string[];
  weeklySchedule: WeeklyScheduleItem[];
  beforeEverySession: string[];
  dayAddOns: Record<string, string[]>;
  days: DetailedBlockDay[];
  progressionTables: ProgressionTable[];
  createdAt: string;
  updatedAt: string;
}

export interface BodyEntry {
  id: string;
  date: string;           // "YYYY-MM-DD"
  weight: number;         // kg
  bmi: number;
  pbf?: number;           // body fat %
  smm?: number;           // skeletal muscle mass kg
  inBodyScore?: number;
  visceralFat?: number;   // level (typically 1-20)
  notes?: string;
  createdAt: string;
}

export interface AppData {
  blocks: Block[];
  exercises: Exercise[];
  routines: Routine[];
  workoutLogs: WorkoutLog[];
  dietSupps: DietSupps[];
  bodyEntries: BodyEntry[];
  nutritionPlan: NutritionPlan;
  macroPlan: MacroPlan;
  detailedBlocks: DetailedBlock[];
  lastUpdated: string;
  lastExportedAt?: string;
}

/** Shape of the JSON file produced by Export */
export interface BackupFile {
  version: number;
  appName: "Ironclad";
  exportedAt: string;
  data: Omit<AppData, "lastUpdated" | "lastExportedAt">;
}

// ─── Workout Plan Import ───────────────────────────────────────────────────────

export interface WorkoutImportExercise {
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  targetWeight?: number;
  restSeconds?: number;
  notes?: string;
  order?: number;
  supersetGroup?: string;
  tempo?: string;
  progressionScheme?: string;
}

export interface WorkoutImportRoutine {
  name: string;
  description?: string;
  exercises: WorkoutImportExercise[];
}

export interface WorkoutImportBlock {
  name: string;
  goal: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  routines: WorkoutImportRoutine[];
}

export type ConflictStrategy = "merge" | "replace";
