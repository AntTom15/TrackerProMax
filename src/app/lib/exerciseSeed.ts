import type { Exercise } from './types';

// Built-in exercise database (~80 popular movements).
// Users will eventually be able to upload their own, community-voted,
// mirroring the food database — for now this ships with the app.
const ex = (
  id: string,
  name: string,
  kind: Exercise['kind'],
  muscles: Exercise['muscles'],
  equipment: Exercise['equipment']
): Exercise => ({ id, name, kind, muscles, equipment });

export const SEED_EXERCISES: Exercise[] = [
  // ---- Chest ----
  ex('e1', 'Barbell Bench Press', 'strength', ['Chest', 'Triceps', 'Shoulders'], 'Barbell'),
  ex('e2', 'Incline Barbell Bench Press', 'strength', ['Chest', 'Shoulders', 'Triceps'], 'Barbell'),
  ex('e3', 'Dumbbell Bench Press', 'strength', ['Chest', 'Triceps', 'Shoulders'], 'Dumbbell'),
  ex('e4', 'Incline Dumbbell Press', 'strength', ['Chest', 'Shoulders', 'Triceps'], 'Dumbbell'),
  ex('e5', 'Dumbbell Fly', 'strength', ['Chest'], 'Dumbbell'),
  ex('e6', 'Cable Crossover', 'strength', ['Chest'], 'Cable'),
  ex('e7', 'Push-Up', 'strength', ['Chest', 'Triceps', 'Core'], 'Bodyweight'),
  ex('e8', 'Dip (Chest Lean)', 'strength', ['Chest', 'Triceps'], 'Bodyweight'),
  ex('e9', 'Machine Chest Press', 'strength', ['Chest', 'Triceps'], 'Machine'),
  ex('e10', 'Pec Deck', 'strength', ['Chest'], 'Machine'),

  // ---- Back ----
  ex('e11', 'Deadlift', 'strength', ['Back', 'Glutes', 'Hamstrings'], 'Barbell'),
  ex('e12', 'Pull-Up', 'strength', ['Back', 'Biceps'], 'Bodyweight'),
  ex('e13', 'Chin-Up', 'strength', ['Back', 'Biceps'], 'Bodyweight'),
  ex('e14', 'Lat Pulldown', 'strength', ['Back', 'Biceps'], 'Cable'),
  ex('e15', 'Barbell Row', 'strength', ['Back', 'Biceps'], 'Barbell'),
  ex('e16', 'Dumbbell Row', 'strength', ['Back', 'Biceps'], 'Dumbbell'),
  ex('e17', 'Seated Cable Row', 'strength', ['Back', 'Biceps'], 'Cable'),
  ex('e18', 'T-Bar Row', 'strength', ['Back'], 'Barbell'),
  ex('e19', 'Rack Pull', 'strength', ['Back', 'Glutes'], 'Barbell'),
  ex('e20', 'Straight-Arm Pulldown', 'strength', ['Back'], 'Cable'),
  ex('e21', 'Back Extension', 'strength', ['Back', 'Glutes', 'Hamstrings'], 'Bodyweight'),

  // ---- Shoulders ----
  ex('e22', 'Overhead Press', 'strength', ['Shoulders', 'Triceps'], 'Barbell'),
  ex('e23', 'Seated Dumbbell Shoulder Press', 'strength', ['Shoulders', 'Triceps'], 'Dumbbell'),
  ex('e24', 'Lateral Raise', 'strength', ['Shoulders'], 'Dumbbell'),
  ex('e25', 'Cable Lateral Raise', 'strength', ['Shoulders'], 'Cable'),
  ex('e26', 'Front Raise', 'strength', ['Shoulders'], 'Dumbbell'),
  ex('e27', 'Rear Delt Fly', 'strength', ['Shoulders', 'Back'], 'Dumbbell'),
  ex('e28', 'Face Pull', 'strength', ['Shoulders', 'Back'], 'Cable'),
  ex('e29', 'Arnold Press', 'strength', ['Shoulders', 'Triceps'], 'Dumbbell'),
  ex('e30', 'Upright Row', 'strength', ['Shoulders', 'Back'], 'Barbell'),
  ex('e31', 'Barbell Shrug', 'strength', ['Back', 'Shoulders'], 'Barbell'),

  // ---- Biceps ----
  ex('e32', 'Barbell Curl', 'strength', ['Biceps'], 'Barbell'),
  ex('e33', 'Dumbbell Curl', 'strength', ['Biceps'], 'Dumbbell'),
  ex('e34', 'Hammer Curl', 'strength', ['Biceps', 'Forearms'], 'Dumbbell'),
  ex('e35', 'Preacher Curl', 'strength', ['Biceps'], 'Machine'),
  ex('e36', 'Incline Dumbbell Curl', 'strength', ['Biceps'], 'Dumbbell'),
  ex('e37', 'Cable Curl', 'strength', ['Biceps'], 'Cable'),
  ex('e38', 'Concentration Curl', 'strength', ['Biceps'], 'Dumbbell'),

  // ---- Triceps ----
  ex('e39', 'Close-Grip Bench Press', 'strength', ['Triceps', 'Chest'], 'Barbell'),
  ex('e40', 'Triceps Pushdown', 'strength', ['Triceps'], 'Cable'),
  ex('e41', 'Overhead Triceps Extension', 'strength', ['Triceps'], 'Dumbbell'),
  ex('e42', 'Skull Crusher', 'strength', ['Triceps'], 'Barbell'),
  ex('e43', 'Triceps Dip', 'strength', ['Triceps', 'Chest'], 'Bodyweight'),
  ex('e44', 'Cable Overhead Extension', 'strength', ['Triceps'], 'Cable'),

  // ---- Forearms ----
  ex('e45', 'Wrist Curl', 'strength', ['Forearms'], 'Barbell'),
  ex('e46', 'Reverse Curl', 'strength', ['Forearms', 'Biceps'], 'Barbell'),
  ex('e47', "Farmer's Carry", 'strength', ['Forearms', 'Full Body'], 'Dumbbell'),

  // ---- Quads ----
  ex('e48', 'Barbell Back Squat', 'strength', ['Quads', 'Glutes', 'Core'], 'Barbell'),
  ex('e49', 'Front Squat', 'strength', ['Quads', 'Core', 'Glutes'], 'Barbell'),
  ex('e50', 'Leg Press', 'strength', ['Quads', 'Glutes'], 'Machine'),
  ex('e51', 'Hack Squat', 'strength', ['Quads', 'Glutes'], 'Machine'),
  ex('e52', 'Bulgarian Split Squat', 'strength', ['Quads', 'Glutes'], 'Dumbbell'),
  ex('e53', 'Walking Lunge', 'strength', ['Quads', 'Glutes'], 'Dumbbell'),
  ex('e54', 'Leg Extension', 'strength', ['Quads'], 'Machine'),
  ex('e55', 'Goblet Squat', 'strength', ['Quads', 'Glutes', 'Core'], 'Kettlebell'),

  // ---- Hamstrings / Glutes ----
  ex('e56', 'Romanian Deadlift', 'strength', ['Hamstrings', 'Glutes', 'Back'], 'Barbell'),
  ex('e57', 'Lying Leg Curl', 'strength', ['Hamstrings'], 'Machine'),
  ex('e58', 'Seated Leg Curl', 'strength', ['Hamstrings'], 'Machine'),
  ex('e59', 'Hip Thrust', 'strength', ['Glutes', 'Hamstrings'], 'Barbell'),
  ex('e60', 'Glute Bridge', 'strength', ['Glutes', 'Hamstrings'], 'Bodyweight'),
  ex('e61', 'Good Morning', 'strength', ['Hamstrings', 'Back', 'Glutes'], 'Barbell'),
  ex('e62', 'Cable Kickback', 'strength', ['Glutes'], 'Cable'),
  ex('e63', 'Sumo Deadlift', 'strength', ['Glutes', 'Quads', 'Back'], 'Barbell'),

  // ---- Calves ----
  ex('e64', 'Standing Calf Raise', 'strength', ['Calves'], 'Machine'),
  ex('e65', 'Seated Calf Raise', 'strength', ['Calves'], 'Machine'),
  ex('e66', 'Single-Leg Calf Raise', 'strength', ['Calves'], 'Bodyweight'),

  // ---- Core ----
  ex('e67', 'Plank', 'strength', ['Core'], 'Bodyweight'),
  ex('e68', 'Hanging Leg Raise', 'strength', ['Core'], 'Bodyweight'),
  ex('e69', 'Cable Crunch', 'strength', ['Core'], 'Cable'),
  ex('e70', 'Russian Twist', 'strength', ['Core'], 'Bodyweight'),
  ex('e71', 'Ab Wheel Rollout', 'strength', ['Core'], 'Other'),
  ex('e72', 'Side Plank', 'strength', ['Core'], 'Bodyweight'),
  ex('e73', 'Sit-Up', 'strength', ['Core'], 'Bodyweight'),

  // ---- Full body / Olympic ----
  ex('e74', 'Clean and Press', 'strength', ['Full Body', 'Shoulders'], 'Barbell'),
  ex('e75', 'Kettlebell Swing', 'strength', ['Full Body', 'Glutes', 'Hamstrings'], 'Kettlebell'),
  ex('e76', 'Thruster', 'strength', ['Full Body', 'Quads', 'Shoulders'], 'Barbell'),
  ex('e77', 'Burpee', 'strength', ['Full Body', 'Core'], 'Bodyweight'),

  // ---- Cardio ----
  ex('e78', 'Treadmill Run', 'cardio', ['Full Body'], 'Cardio Machine'),
  ex('e79', 'Treadmill Incline Walk', 'cardio', ['Full Body'], 'Cardio Machine'),
  ex('e80', 'Outdoor Run', 'cardio', ['Full Body'], 'Bodyweight'),
  ex('e81', 'Stationary Bike', 'cardio', ['Quads', 'Full Body'], 'Cardio Machine'),
  ex('e82', 'Rowing Machine', 'cardio', ['Full Body', 'Back'], 'Cardio Machine'),
  ex('e83', 'Stair Climber', 'cardio', ['Quads', 'Glutes'], 'Cardio Machine'),
  ex('e84', 'Elliptical', 'cardio', ['Full Body'], 'Cardio Machine'),
  ex('e85', 'Jump Rope', 'cardio', ['Full Body', 'Calves'], 'Other'),
  ex('e86', 'Swimming', 'cardio', ['Full Body'], 'Other'),
  ex('e87', 'Cycling (Outdoor)', 'cardio', ['Quads', 'Full Body'], 'Other'),
];

export const MUSCLE_GROUPS: Exercise['muscles'] = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Full Body',
];
