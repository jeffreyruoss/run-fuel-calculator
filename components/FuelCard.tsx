import React from 'react';
import { FuelItem } from '../types';
import { Trash2 } from 'lucide-react';

interface FuelCardProps {
  item: FuelItem;
  onAdd?: (item: FuelItem) => void;
  onRemove?: (id: string) => void;
  compact?: boolean;
  count?: number;
  showSingleCount?: boolean;
}

export const FuelCard: React.FC<FuelCardProps> = ({ item, onAdd, onRemove, compact, count = 1, showSingleCount }) => {
  const isInteractive = !!onAdd;

  const baseClasses = "relative group flex items-center justify-between rounded-lg border transition-all duration-200 w-full text-left";
  
  const styleClasses = compact 
    ? "bg-slate-800/50 border-slate-700 p-2.5 text-sm" 
    : "bg-slate-800 border-slate-700 p-4";

  const interactiveClasses = isInteractive
    ? "cursor-pointer hover:bg-slate-700 hover:border-blue-500 hover:shadow-md active:scale-[0.98]"
    : "";

  // Show badge if count > 1 (standard) OR if we explicitly want to show single counts (e.g. in picker modal)
  const shouldShowCount = count > 1 || (count > 0 && showSingleCount);

  return (
    <div 
      onClick={() => isInteractive && onAdd && onAdd(item)}
      className={`${baseClasses} ${styleClasses} ${interactiveClasses}`}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onAdd && onAdd(item);
        }
      }}
    >
      <div className="flex flex-col w-full mr-8">
        <div className="flex items-baseline gap-2 justify-between w-full">
             <div className="flex items-center gap-2 overflow-hidden">
                 <h4 className={`font-semibold text-slate-100 truncate ${compact ? 'text-sm' : 'text-base'}`}>
                    {item.name}
                </h4>
                {shouldShowCount && (
                    <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                        x{count}
                    </span>
                )}
             </div>
            <span className={`font-mono font-bold text-emerald-400 shrink-0 ${compact ? 'text-xs' : 'text-sm'}`}>
                <span className="text-slate-500 font-sans font-normal mr-1">Carbs:</span>{item.carbs}g
            </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-slate-400">
             {(!compact || !item.brand) && item.brand && (
                <span className="mr-1">{item.brand}</span>
             )}
             {(item.sodium || 0) > 0 && (
                 <span className="flex items-center gap-1">
                    <span className="text-cyan-500 font-medium">Sodium:</span> {item.sodium}mg
                 </span>
            )}
             {(item.potassium || 0) > 0 && (
                 <span className="flex items-center gap-1">
                    <span className="text-purple-500 font-medium">Potassium:</span> {item.potassium}mg
                 </span>
            )}
             {(item.caffeine || 0) > 0 && (
                 <span className="flex items-center gap-0.5">
                    <span className="text-yellow-500 font-medium">⚡</span> {item.caffeine}mg
                 </span>
            )}
        </div>
      </div>

      {onRemove && (
        <button 
          onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
          aria-label="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};