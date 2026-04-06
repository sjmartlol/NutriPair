// services/bmrCalculator.ts
// Uses the Mifflin-St Jeor equation (most accurate modern formula)

export type Gender = 'male' | 'female';
export type Goal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface BMRInput {
  gender: Gender;
  age: number;
  weightLbs: number;
  heightFeet: number;
  heightInches: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface BMRResult {
  bmr: number;
  tdee: number;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  deficit: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,       // Little or no exercise
  light: 1.375,         // Light exercise 1-3 days/week
  moderate: 1.55,       // Moderate exercise 3-5 days/week
  active: 1.725,        // Hard exercise 6-7 days/week
  very_active: 1.9,     // Very hard exercise, physical job
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  light: 'Light (exercise 1-3 days/week)',
  moderate: 'Moderate (exercise 3-5 days/week)',
  active: 'Active (hard exercise 6-7 days/week)',
  very_active: 'Very Active (intense exercise daily)',
};

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -500,     // ~1 lb/week loss
  maintain: 0,
  gain: 300,      // lean gain
};

const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Lose weight (~1 lb/week)',
  maintain: 'Maintain weight',
  gain: 'Gain muscle',
};

export { ACTIVITY_LABELS, GOAL_LABELS };

export function calculateBMR(input: BMRInput): BMRResult {
  // Convert to metric
  const weightKg = input.weightLbs * 0.453592;
  const heightCm = (input.heightFeet * 12 + input.heightInches) * 2.54;

  // Mifflin-St Jeor equation
  let bmr: number;
  if (input.gender === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * input.age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * input.age - 161;
  }

  bmr = Math.round(bmr);

  // Total Daily Energy Expenditure
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activityLevel]);

  // Adjust for goal
  const deficit = GOAL_ADJUSTMENTS[input.goal];
  const calorieGoal = Math.max(1200, Math.round(tdee + deficit));

  // Calculate macro goals based on goal type
  let proteinPerLb: number;
  let fatPercent: number;

  if (input.goal === 'lose') {
    proteinPerLb = 1.0;    // Higher protein to preserve muscle
    fatPercent = 0.25;
  } else if (input.goal === 'gain') {
    proteinPerLb = 0.9;
    fatPercent = 0.25;
  } else {
    proteinPerLb = 0.8;
    fatPercent = 0.3;
  }

  const proteinGoal = Math.round(input.weightLbs * proteinPerLb);
  const fatGoal = Math.round((calorieGoal * fatPercent) / 9);
  const proteinCalories = proteinGoal * 4;
  const fatCalories = fatGoal * 9;
  const carbsGoal = Math.round((calorieGoal - proteinCalories - fatCalories) / 4);

  return {
    bmr,
    tdee,
    calorieGoal,
    proteinGoal,
    carbsGoal: Math.max(0, carbsGoal),
    fatGoal,
    deficit,
  };
}