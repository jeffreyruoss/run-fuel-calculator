import React from 'react';
import { HourPlan, FuelItem } from '../types';
import { FuelCard } from './FuelCard';
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react';

interface HourlyBucketProps {
  hourPlan: HourPlan;
  targetCarbs: number;
  targetSodium: number;
  targetPotassium: number;
  onAddItem: (hourIndex: number) => void;
  onRemoveItem: (hourIndex: number, itemId: string) => void;
  isActive?: boolean;
}

export const HourlyBucket: React.FC<HourlyBucketProps> = ({ 
  hourPlan, 
  targetCarbs, 
  targetSodium,
  targetPotassium,
  onAddItem, 
  onRemoveItem,
  isActive
}) => {
  const totalCarbs = hourPlan.items.reduce((sum, item) => sum + item.carbs, 0);
  const totalSodium = hourPlan.items.reduce((sum, item) => sum + (item.sodium || 0), 0);
  const totalPotassium = hourPlan.items.reduce((sum, item) => sum + (item.potassium || 0), 0);
  
  const percentage = Math.min((totalCarbs / targetCarbs) * 100, 120); // Cap visual at 120%
  
  // Group items by ID to show counts
  const groupedItems = hourPlan.items.reduce((acc, item) => {
      if (!acc[item.id]) {
          acc[item.id] = { item, count: 0 };
      }
      acc[item.id].count += 1;
      return acc;
  }, {} as Record<string, { item: FuelItem; count: number }>);

  const groupedItemsList = Object.values(groupedItems);

  // Color logic for Carbs
  let statusColor = "bg-slate-600";
  let textColor = "text-slate-400";
  let borderColor = "border-slate-700";
  
  if (totalCarbs === 0) {
    // Empty state
  } else if (totalCarbs < targetCarbs * 0.8) {
    statusColor = "bg-yellow-500";
    textColor = "text-yellow-500";
    borderColor = "border-yellow-500/30";
  } else if (totalCarbs > targetCarbs * 1.1) {
    statusColor = "bg-orange-500";
    textColor = "text-orange-500";
    borderColor = "border-orange-500/30";
  } else {
    statusColor = "bg-emerald-500";
    textColor = "text-emerald-500";
    borderColor = "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]";
  }

  return (
    <div className={`rounded-xl border bg-slate-800/40 backdrop-blur-sm transition-all ${borderColor} ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-200">Hour {hourPlan.hourIndex + 1}</h3>
          <div className="flex items-center gap-2">
             <span className={`text-2xl font-black font-mono ${textColor}`}>
              {totalCarbs}
            </span>
            <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
              / {targetCarbs}g Carbs
            </span>
            {totalCarbs >= targetCarbs * 0.9 && totalCarbs <= targetCarbs * 1.1 && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            )}
            {totalCarbs > targetCarbs * 1.1 && (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden mb-3">
          <div 
            className={`h-full transition-all duration-500 ease-out ${statusColor}`} 
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {/* Secondary Metrics */}
        <div className="flex gap-4 mb-4 text-xs">
            <div className={`flex items-center gap-1 ${totalSodium >= targetSodium ? 'text-cyan-400' : 'text-slate-500'}`}>
                <span className="font-bold">Sodium:</span>
                <span>{totalSodium} / {targetSodium}mg</span>
            </div>
            <div className={`flex items-center gap-1 ${totalPotassium >= targetPotassium ? 'text-purple-400' : 'text-slate-500'}`}>
                <span className="font-bold">Potassium:</span>
                <span>{totalPotassium} / {targetPotassium}mg</span>
            </div>
        </div>

        {/* Items List */}
        <div className="space-y-2 min-h-[50px]">
            {groupedItemsList.length === 0 ? (
                <div 
                  onClick={() => onAddItem(hourPlan.hourIndex)}
                  className="h-16 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-sm cursor-pointer hover:border-slate-500 hover:text-slate-300 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" /> Add fuel for Hour {hourPlan.hourIndex + 1}
                </div>
            ) : (
                groupedItemsList.map(({ item, count }) => (
                    <div key={item.id} className="animate-fadeIn">
                        <FuelCard 
                            item={item} 
                            compact
                            count={count} 
                            onRemove={() => onRemoveItem(hourPlan.hourIndex, item.id)} 
                        />
                    </div>
                ))
            )}
        </div>
        
        {/* Footer Add Button (only if items exist) */}
        {groupedItemsList.length > 0 && (
             <button 
                onClick={() => onAddItem(hourPlan.hourIndex)}
                className="w-full mt-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors flex items-center justify-center"
             >
                 <Plus className="w-3 h-3 mr-1.5" /> Add another item
             </button>
        )}
      </div>
    </div>
  );
};