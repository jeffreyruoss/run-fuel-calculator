import { FuelItem, FuelType } from './types';
import { Zap, Coffee, Droplet, Cookie, HelpCircle } from 'lucide-react';

export const DEFAULT_TARGET_CARBS = 60;
export const DEFAULT_TARGET_SODIUM = 400; // mg
export const DEFAULT_TARGET_POTASSIUM = 100; // mg
export const MAX_HOURS = 7;

export const FUEL_ICONS = {
  [FuelType.GEL]: Zap,
  [FuelType.CHEW]: Cookie,
  [FuelType.DRINK]: Droplet,
  [FuelType.SOLID]: Coffee, // Using Coffee icon as a placeholder for 'Food/Solid' conceptually
  [FuelType.OTHER]: HelpCircle
};

export const PRESET_FUELS: FuelItem[] = [
  { id: 'ritz-pb', name: 'Ritz PB Sandwich (1)', brand: 'Ritz', carbs: 4, type: FuelType.SOLID, sodium: 48, potassium: 35 },
  { id: 'pretzel-nibs', name: 'Sourdough Nibs (5)', brand: 'Snyder\'s', carbs: 7, type: FuelType.SOLID, sodium: 80, potassium: 20 },
  { id: 'maurten-100', name: 'Gel 100', brand: 'Maurten', carbs: 25, type: FuelType.GEL, sodium: 0, caffeine: 0, potassium: 0 },
  { id: 'maurten-100-caf', name: 'Gel 100 Caf 100', brand: 'Maurten', carbs: 25, type: FuelType.GEL, sodium: 0, caffeine: 100, potassium: 0 },
  { id: 'maurten-160', name: 'Drink Mix 160', brand: 'Maurten', carbs: 39, type: FuelType.DRINK, sodium: 0, potassium: 0 },
  { id: 'maurten-320', name: 'Drink Mix 320', brand: 'Maurten', carbs: 79, type: FuelType.DRINK, sodium: 0, potassium: 0 },
  { id: 'gu-orig', name: 'Original Energy Gel', brand: 'GU', carbs: 22, type: FuelType.GEL, sodium: 60, caffeine: 20, potassium: 40 },
  { id: 'gu-roctane', name: 'Roctane Gel', brand: 'GU', carbs: 21, type: FuelType.GEL, sodium: 180, caffeine: 35, potassium: 40 },
  { id: 'sis-iso', name: 'Go Isotonic Gel', brand: 'SiS', carbs: 22, type: FuelType.GEL, sodium: 10, potassium: 0 },
  { id: 'sis-beta', name: 'Beta Fuel Gel', brand: 'SiS', carbs: 40, type: FuelType.GEL, sodium: 0, potassium: 0 },
  { id: 'clif-blok', name: 'Blok (1 piece)', brand: 'Clif', carbs: 8, type: FuelType.CHEW, sodium: 17, potassium: 20 },
  { id: 'skratch-chew', name: 'Energy Chews (pack)', brand: 'Skratch', carbs: 38, type: FuelType.CHEW, sodium: 160, potassium: 40 },
  { id: 'swedish-fish', name: 'Swedish Fish (1)', brand: 'Candy', carbs: 5, type: FuelType.CHEW, sodium: 5, potassium: 0 },
  { id: 'banana', name: 'Banana (Medium)', brand: 'Whole Food', carbs: 27, type: FuelType.SOLID, sodium: 1, potassium: 422 },
  { id: 'dates', name: 'Medjool Date (1)', brand: 'Whole Food', carbs: 18, type: FuelType.SOLID, sodium: 0, potassium: 167 },
  { id: 'dried-apricot', name: 'Dried Apricot (1)', brand: 'Whole Food', carbs: 5, type: FuelType.SOLID, sodium: 0, potassium: 65 },
  { id: 'gatorade', name: 'Gatorade Endurance (12oz)', brand: 'Gatorade', carbs: 22, type: FuelType.DRINK, sodium: 300, potassium: 140 },
  { id: 'tailwind', name: 'Endurance Fuel (2 scoops)', brand: 'Tailwind', carbs: 50, type: FuelType.DRINK, sodium: 600, potassium: 180 },
  { id: 'precision-30', name: 'PF 30 Gel', brand: 'Precision Fuel', carbs: 30, type: FuelType.GEL, sodium: 0, potassium: 0 },
  { id: 'precision-90', name: 'PF 90 Gel', brand: 'Precision Fuel', carbs: 90, type: FuelType.GEL, sodium: 0, potassium: 0 },
];