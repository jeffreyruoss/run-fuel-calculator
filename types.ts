export enum FuelType {
  GEL = 'GEL',
  CHEW = 'CHEW',
  DRINK = 'DRINK',
  SOLID = 'SOLID',
  OTHER = 'OTHER'
}

export interface FuelItem {
  id: string;
  name: string;
  brand?: string;
  carbs: number; // grams per serving
  caffeine?: number; // mg
  sodium?: number; // mg
  potassium?: number; // mg
  type: FuelType;
  isCustom?: boolean;
}

export interface HourPlan {
  hourIndex: number; // 0 for Hour 1, 1 for Hour 2, etc.
  items: FuelItem[];
}

export interface UserSettings {
  targetTimeHours: number;
  targetTimeMinutes: number;
  targetCarbsPerHour: number; // e.g., 60g or 90g
  targetSodiumPerHour: number;
  targetPotassiumPerHour: number;
  weight?: number; // kg, optional for AI advice
}

export interface AiAdvice {
  suggestion: string;
  type: 'success' | 'warning' | 'info';
}