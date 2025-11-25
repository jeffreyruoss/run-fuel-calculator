
import { HourPlan, UserSettings } from '../types';
import { DEFAULT_TARGET_CARBS, DEFAULT_TARGET_SODIUM, DEFAULT_TARGET_POTASSIUM } from '../constants';

const KEYS = {
  PLAN: 'mfm_plan',
  SETTINGS: 'mfm_settings',
};

export const DEFAULT_SETTINGS: UserSettings = {
  targetTimeHours: 3,
  targetTimeMinutes: 30,
  targetCarbsPerHour: DEFAULT_TARGET_CARBS,
  targetSodiumPerHour: DEFAULT_TARGET_SODIUM,
  targetPotassiumPerHour: DEFAULT_TARGET_POTASSIUM,
  disabledFuelIds: [],
  customFuels: []
};

export const savePlan = (plan: HourPlan[]) => {
  try {
    localStorage.setItem(KEYS.PLAN, JSON.stringify(plan));
    console.log(`[Storage] Saved plan with ${plan.length} hours`);
  } catch (e) {
    console.warn('Failed to save plan to local storage', e);
  }
};

export const loadPlan = (): HourPlan[] | null => {
  try {
    const data = localStorage.getItem(KEYS.PLAN);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

export const saveSettings = (settings: UserSettings) => {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    console.log(`[Storage] Saved settings (Target: ${settings.targetCarbsPerHour}g/hr)`);
  } catch (e) {
    console.warn('Failed to save settings to local storage', e);
  }
};

export const loadSettings = (): UserSettings => {
  try {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (!data) return DEFAULT_SETTINGS;
    
    // Merge with default to ensure new fields (like customFuels) exist if loading old data
    const parsed = JSON.parse(data);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const clearAllData = () => {
  localStorage.removeItem(KEYS.PLAN);
  localStorage.removeItem(KEYS.SETTINGS);
  console.log('[Storage] All data cleared');
};