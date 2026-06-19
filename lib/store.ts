"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppData,
  Block,
  Exercise,
  Routine,
  RoutineExercise,
  WorkoutLog,
  DietSupps,
  BodyEntry,
  NutritionPlan,
  MacroPlan,
  DetailedBlock,
  WorkoutImportBlock,
  ConflictStrategy,
} from "./types";
import { weightToInputString } from "./utils";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

interface AppStore extends AppData {
  // Block actions
  addBlock: (block: Omit<Block, "id" | "createdAt">) => string;
  updateBlock: (id: string, updates: Partial<Omit<Block, "id" | "createdAt">>) => void;
  deleteBlock: (id: string) => void;
  setActiveBlock: (id: string) => void;

  // Exercise actions
  addExercise: (exercise: Omit<Exercise, "id" | "createdAt">) => string;
  updateExercise: (id: string, updates: Partial<Omit<Exercise, "id" | "createdAt">>) => void;
  deleteExercise: (id: string) => void;

  // Routine actions
  addRoutine: (routine: Omit<Routine, "id" | "createdAt" | "updatedAt">) => string;
  updateRoutine: (id: string, updates: Partial<Omit<Routine, "id" | "createdAt" | "updatedAt">>) => void;
  deleteRoutine: (id: string) => void;

  // WorkoutLog actions
  addWorkoutLog: (log: Omit<WorkoutLog, "id">) => string;
  updateWorkoutLog: (id: string, updates: Partial<Omit<WorkoutLog, "id">>) => void;
  deleteWorkoutLog: (id: string) => void;

  // DietSupps actions
  addDietSupps: (entry: Omit<DietSupps, "id">) => string;
  updateDietSupps: (id: string, updates: Partial<Omit<DietSupps, "id">>) => void;
  deleteDietSupps: (id: string) => void;

  // BodyEntry actions
  addBodyEntry: (entry: Omit<BodyEntry, "id" | "createdAt">) => string;
  updateBodyEntry: (id: string, updates: Partial<Omit<BodyEntry, "id" | "createdAt">>) => void;
  deleteBodyEntry: (id: string) => void;

  // NutritionPlan action
  setNutritionPlan: (plan: NutritionPlan) => void;

  // MacroPlan action
  setMacroPlan: (plan: MacroPlan) => void;

  // DetailedBlock actions
  addDetailedBlock: (block: Omit<DetailedBlock, "id" | "createdAt" | "updatedAt">) => string;
  replaceDetailedBlock: (id: string, block: Omit<DetailedBlock, "id" | "createdAt" | "updatedAt">) => void;
  deleteDetailedBlock: (id: string) => void;

  // Backup / restore
  importAllData: (data: Omit<AppData, "lastUpdated" | "lastExportedAt">) => void;
  setLastExportedAt: (ts: string) => void;

  // Smart import
  importWorkoutPlanData: (
    importedBlocks: WorkoutImportBlock[],
    conflictChoices: Record<string, ConflictStrategy>
  ) => { blocksAdded: number; blocksUpdated: number; routinesAdded: number; exercisesCreated: number };

  // Utility
  clearAllData: () => void;
}

const DEFAULT_MEALS = [
  { label: "Breakfast",            content: "" },
  { label: "Pre-Workout",          content: "" },
  { label: "Post-Workout",         content: "" },
  { label: "Snacks / Standalones", content: "" },
  { label: "Dinner",               content: "" },
];

const initialState: AppData = {
  blocks: [],
  exercises: [],
  routines: [],
  workoutLogs: [],
  dietSupps: [],
  bodyEntries: [],
  nutritionPlan: {
    dietNotes: "",
    meals: DEFAULT_MEALS,
    suppNotes: "",
    supplements: [],
    updatedAt: new Date().toISOString(),
  },
  macroPlan: {
    dayPlans: [],
    updatedAt: new Date().toISOString(),
  },
  detailedBlocks: [],
  lastUpdated: new Date().toISOString(),
};

function migrateWorkoutLogs(logs: WorkoutLog[]): WorkoutLog[] {
  return logs.map((log) => ({
    ...log,
    exercises: log.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        weight: weightToInputString(s.weight as string | number | undefined),
      })),
    })),
  }));
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Block actions
      addBlock: (block) => {
        const id = generateId();
        set((state) => ({
          blocks: [...state.blocks, { ...block, id, createdAt: now() }],
          lastUpdated: now(),
        }));
        return id;
      },
      updateBlock: (id, updates) =>
        set((state) => ({
          blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
          lastUpdated: now(),
        })),
      deleteBlock: (id) =>
        set((state) => ({
          blocks: state.blocks.filter((b) => b.id !== id),
          lastUpdated: now(),
        })),
      setActiveBlock: (id) =>
        set((state) => ({
          blocks: state.blocks.map((b) => ({ ...b, isActive: b.id === id })),
          lastUpdated: now(),
        })),

      // Exercise actions
      addExercise: (exercise) => {
        const id = generateId();
        set((state) => ({
          exercises: [...state.exercises, { ...exercise, id, createdAt: now() }],
          lastUpdated: now(),
        }));
        return id;
      },
      updateExercise: (id, updates) =>
        set((state) => ({
          exercises: state.exercises.map((e) => (e.id === id ? { ...e, ...updates } : e)),
          lastUpdated: now(),
        })),
      deleteExercise: (id) =>
        set((state) => ({
          exercises: state.exercises.filter((e) => e.id !== id),
          lastUpdated: now(),
        })),

      // Routine actions
      addRoutine: (routine) => {
        const id = generateId();
        const ts = now();
        set((state) => ({
          routines: [...state.routines, { ...routine, id, createdAt: ts, updatedAt: ts }],
          lastUpdated: ts,
        }));
        return id;
      },
      updateRoutine: (id, updates) =>
        set((state) => ({
          routines: state.routines.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: now() } : r
          ),
          lastUpdated: now(),
        })),
      deleteRoutine: (id) =>
        set((state) => ({
          routines: state.routines.filter((r) => r.id !== id),
          // also unlink from any block that references it
          blocks: state.blocks.map((b) => ({
            ...b,
            routineIds: b.routineIds.filter((rid) => rid !== id),
          })),
          lastUpdated: now(),
        })),

      // WorkoutLog actions
      addWorkoutLog: (log) => {
        const id = generateId();
        set((state) => ({
          workoutLogs: [...state.workoutLogs, { ...log, id }],
          lastUpdated: now(),
        }));
        return id;
      },
      updateWorkoutLog: (id, updates) =>
        set((state) => ({
          workoutLogs: state.workoutLogs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
          lastUpdated: now(),
        })),
      deleteWorkoutLog: (id) =>
        set((state) => ({
          workoutLogs: state.workoutLogs.filter((l) => l.id !== id),
          lastUpdated: now(),
        })),

      // DietSupps actions
      addDietSupps: (entry) => {
        const id = generateId();
        set((state) => ({
          dietSupps: [...state.dietSupps, { ...entry, id }],
          lastUpdated: now(),
        }));
        return id;
      },
      updateDietSupps: (id, updates) =>
        set((state) => ({
          dietSupps: state.dietSupps.map((d) => (d.id === id ? { ...d, ...updates } : d)),
          lastUpdated: now(),
        })),
      deleteDietSupps: (id) =>
        set((state) => ({
          dietSupps: state.dietSupps.filter((d) => d.id !== id),
          lastUpdated: now(),
        })),

      // BodyEntry actions
      addBodyEntry: (entry) => {
        const id = generateId();
        set((state) => ({
          bodyEntries: [...state.bodyEntries, { ...entry, id, createdAt: now() }],
          lastUpdated: now(),
        }));
        return id;
      },
      updateBodyEntry: (id, updates) =>
        set((state) => ({
          bodyEntries: state.bodyEntries.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
          lastUpdated: now(),
        })),
      deleteBodyEntry: (id) =>
        set((state) => ({
          bodyEntries: state.bodyEntries.filter((e) => e.id !== id),
          lastUpdated: now(),
        })),

      // NutritionPlan action
      setNutritionPlan: (plan) =>
        set({ nutritionPlan: { ...plan, updatedAt: now() }, lastUpdated: now() }),

      // MacroPlan action
      setMacroPlan: (plan) =>
        set({ macroPlan: { ...plan, updatedAt: now() }, lastUpdated: now() }),

      // DetailedBlock actions
      addDetailedBlock: (block) => {
        const id = generateId();
        const ts = now();
        set((state) => ({
          detailedBlocks: [...state.detailedBlocks, { ...block, id, createdAt: ts, updatedAt: ts }],
          lastUpdated: ts,
        }));
        return id;
      },
      replaceDetailedBlock: (id, block) =>
        set((state) => ({
          detailedBlocks: state.detailedBlocks.map((b) =>
            b.id === id ? { ...block, id, createdAt: b.createdAt, updatedAt: now() } : b
          ),
          lastUpdated: now(),
        })),
      deleteDetailedBlock: (id) =>
        set((state) => ({
          detailedBlocks: state.detailedBlocks.filter((b) => b.id !== id),
          lastUpdated: now(),
        })),

      // Backup / restore
      importAllData: (data) =>
        set({
          blocks:        data.blocks        ?? [],
          exercises:     data.exercises     ?? [],
          routines:      data.routines      ?? [],
          workoutLogs:   data.workoutLogs   ?? [],
          dietSupps:     data.dietSupps     ?? [],
          bodyEntries:   data.bodyEntries   ?? [],
          nutritionPlan: data.nutritionPlan ?? initialState.nutritionPlan,
          macroPlan:     data.macroPlan     ?? initialState.macroPlan,
          detailedBlocks: data.detailedBlocks ?? [],
          lastUpdated:   now(),
        }),
      setLastExportedAt: (ts) => set({ lastExportedAt: ts }),

      // Smart import — atomically merges/replaces blocks, routines, exercises
      importWorkoutPlanData: (importedBlocks, conflictChoices) => {
        const state = get();
        const ts = now();

        let newBlocks = [...state.blocks];
        let newRoutines = [...state.routines];
        let newExercises = [...state.exercises];

        let blocksAdded = 0;
        let blocksUpdated = 0;
        let routinesAdded = 0;
        let exercisesCreated = 0;

        for (const importBlock of importedBlocks) {
          const existingBlock = newBlocks.find(
            (b) => b.name.toLowerCase() === importBlock.name.toLowerCase()
          );
          const choice: ConflictStrategy = existingBlock
            ? (conflictChoices[importBlock.name] ?? "merge")
            : "merge";

          // Resolve blockId before creating routines
          const blockId = existingBlock ? existingBlock.id : generateId();

          // Find or create exercise records for all exercises in this block
          const exerciseNameToId: Record<string, string> = {};
          for (const routine of importBlock.routines) {
            for (const ex of routine.exercises) {
              const name = ex.exerciseName.trim();
              if (!name) continue;
              if (exerciseNameToId[name.toLowerCase()]) continue;
              const existing = newExercises.find(
                (e) => e.name.toLowerCase() === name.toLowerCase()
              );
              if (existing) {
                exerciseNameToId[name.toLowerCase()] = existing.id;
              } else {
                const newId = generateId();
                newExercises = [
                  ...newExercises,
                  { id: newId, name, muscleGroups: ["other"], category: "compound", createdAt: ts },
                ];
                exercisesCreated++;
                exerciseNameToId[name.toLowerCase()] = newId;
              }
            }
          }

          // Create routine records
          const newRoutineIds: string[] = [];
          for (const importRoutine of importBlock.routines) {
            const routineId = generateId();
            const exercises: RoutineExercise[] = importRoutine.exercises.map((ex, idx) => ({
              exerciseId: exerciseNameToId[ex.exerciseName.trim().toLowerCase()] ?? generateId(),
              exerciseName: ex.exerciseName.trim(),
              targetSets: ex.targetSets ?? 3,
              targetReps: ex.targetReps ?? "8-12",
              targetWeight: ex.targetWeight,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
              order: ex.order ?? idx,
              supersetGroup: ex.supersetGroup,
              tempo: ex.tempo,
              progressionScheme: ex.progressionScheme,
            }));
            newRoutines = [
              ...newRoutines,
              { id: routineId, blockId, name: importRoutine.name, description: importRoutine.description, exercises, createdAt: ts, updatedAt: ts },
            ];
            newRoutineIds.push(routineId);
            routinesAdded++;
          }

          // Apply block strategy
          if (!existingBlock) {
            newBlocks = [
              ...newBlocks,
              {
                id: blockId,
                name: importBlock.name,
                goal: importBlock.goal,
                startDate: importBlock.startDate ?? ts.slice(0, 10),
                endDate: importBlock.endDate,
                notes: importBlock.notes,
                routineIds: newRoutineIds,
                isActive: false,
                createdAt: ts,
              },
            ];
            blocksAdded++;
          } else if (choice === "replace") {
            const oldRids = new Set(existingBlock.routineIds);
            newRoutines = newRoutines.filter((r) => !oldRids.has(r.id));
            newBlocks = newBlocks.map((b) =>
              b.id === blockId
                ? { ...b, goal: importBlock.goal, startDate: importBlock.startDate ?? b.startDate, endDate: importBlock.endDate, notes: importBlock.notes, routineIds: newRoutineIds }
                : b
            );
            blocksUpdated++;
          } else {
            // merge: append new routines to existing block
            newBlocks = newBlocks.map((b) =>
              b.id === blockId ? { ...b, routineIds: [...b.routineIds, ...newRoutineIds] } : b
            );
            blocksUpdated++;
          }
        }

        set({ blocks: newBlocks, routines: newRoutines, exercises: newExercises, lastUpdated: ts });
        return { blocksAdded, blocksUpdated, routinesAdded, exercisesCreated };
      },

      // Utility
      clearAllData: () =>
        set({ ...initialState, lastUpdated: now() }),
    }),
    {
      name: "ironclad-data",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persisted, _version) => {
        const state = persisted as AppData;
        if (state.workoutLogs?.length) {
          state.workoutLogs = migrateWorkoutLogs(state.workoutLogs);
        }
        return state as AppStore;
      },
    }
  )
);
