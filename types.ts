
import React from 'react';

export type KnowledgeLevel = 'noobie' | 'advanced';
export type UnitSystem = 'lbs' | 'kg';

export interface Stat {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  color: 'purple' | 'white';
}

export interface QuickActionType {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}

export interface MuscleActivation {
  name: string;
  activation: number; // 0 to 100 percentage
}

export interface BiomechanicAdjustment {
  label: string;
  minLabel: string;
  maxLabel: string;
  affectedMuscles: {
    name: string;
    modifier: number; // Positive = increases with slider, Negative = decreases
  }[];
}

export interface Exercise {
  id: string;
  name: string;
  category: string; // e.g. 'Dumbbell', 'Barbell', 'Kettlebell', 'Bodyweight', 'Cable', 'Smith Machine', 'Machine', 'Hammer Strength', or 'Exercise'
  description: string;
  movementPlane: string;
  resistanceCurve: string;
  resistanceCurveDescription?: string;
  stabilization: number; // Scale of 1-10
  planeOfMotion: string;
  jointActions: string[];
  muscles: MuscleActivation[];
  image?: string;
  adjustments?: BiomechanicAdjustment;
  personalRecord?: string; // e.g. "225 lbs x 5"
}

export interface WorkoutSetTarget {
  sets: string; // "3" or "3-4"
  repRange: string; // "8-12"
  rir?: string; // "1-2"
  rpe?: string; // "8"
}

export interface WorkoutExercise extends Exercise {
  instanceId: string;
  target: WorkoutSetTarget;
  unilateral?: boolean;
  unilateralOrder?: 'lr' | 'rl';
}

export interface Workout {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
  lastPerformed?: string;
  tags?: string[];
  restTime?: string; // Average rest time in seconds
}

export interface Routine {
  id: string;
  name: string;
  description?: string;
  cycleLength: number;
  // Map of day index (0-based) to workout ID
  schedule: Record<number, string>;
  active: boolean;
  startDate: string; // ISO string to calculate current cycle day
  currentDay: number; // 0-based index of the current day in the cycle
}

export interface WorkoutLogSet {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
  rpe?: string;
  rir?: string;
  plateCounts?: Record<number, number>; // weight -> count per side
  side?: 'left' | 'right';
}

export interface ActiveWorkoutSession {
  workoutId: string;
  startTime: string;
  currentExerciseIndex: number;
  logs: Record<string, WorkoutLogSet[]>; // Map exercise instance ID to sets
}
