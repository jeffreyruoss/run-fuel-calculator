
export enum FuelType {
  GEL = 'GEL',
  CHEW = 'CHEW',
  DRINK = 'DRINK',
  SOLID = 'SOLID',
  OTHER = 'OTHER'
}

export type SweatProfile = 'LOW' | 'AVERAGE' | 'HIGH';
export type ActivityMode = 'RACE' | 'TRAINING_Z2';

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
  
  // Physiology & Conditions
  sweatProfile: SweatProfile;
  activityMode: ActivityMode;
  weather: {
    temperatureF: number;
    humidity: number; // percentage
  };

  // Targets
  targetCarbsPerHour: number; // e.g., 60g or 90g
  targetSodiumPerHour: number;
  targetPotassiumPerHour: number;
  
  weight?: number; // kg, optional for AI advice
  disabledFuelIds: string[]; // List of IDs of fuels the user wants to hide
  customFuels: FuelItem[]; // List of custom items added by the user
}

export interface AiAdvice {
  suggestion: string;
  type: 'success' | 'warning' | 'info';
}
