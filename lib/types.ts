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
  weight: number;
  reps: number;
  rpe?: number;
  notes?: string;
}

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
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
}

export interface MacroMeal {
  id: string;
  name: string;
  items: MacroFoodItem[];
}

export type MacroDayType = "vegetarian" | "eggetarian";

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
