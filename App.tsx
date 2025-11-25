
import React, { useState, useEffect, useMemo } from 'react';
import { UserSettings, HourPlan, FuelItem, FuelType } from './types';
import { PRESET_FUELS, MAX_HOURS } from './constants';
import { FuelCard } from './components/FuelCard';
import { HourlyBucket } from './components/HourlyBucket';
import { searchCustomFood, analyzePlan } from './services/geminiService';
import { loadPlan, loadSettings, savePlan, saveSettings, clearAllData, DEFAULT_SETTINGS } from './services/storageService';
import { Search, Sparkles, BarChart3, Timer, Loader2, Menu, X, Activity, Plus, Settings, Trash2, RotateCcw, Check, EyeOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

const App: React.FC = () => {
  // --- State Initialization with Storage ---
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [plan, setPlan] = useState<HourPlan[]>(() => loadPlan() || []);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [customSearchResults, setCustomSearchResults] = useState<FuelItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // UI State
  const [selectedHourIndex, setSelectedHourIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'build' | 'analyze' | 'settings'>('build');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- Persistence Effects ---
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  // --- Init Plan Logic ---
  // Ensure plan size matches target time if plan is empty or resized
  useEffect(() => {
    const totalHours = Math.ceil(settings.targetTimeHours + settings.targetTimeMinutes / 60);
    setPlan(prev => {
        // If loaded from storage and matches length, keep it.
        // If user changed time, resize it.
        if (prev.length === totalHours) return prev;
        
        const newPlan: HourPlan[] = [];
        for (let i = 0; i < totalHours; i++) {
            if (prev[i]) {
                newPlan.push(prev[i]);
            } else {
                newPlan.push({ hourIndex: i, items: [] });
            }
        }
        return newPlan;
    });
  }, [settings.targetTimeHours, settings.targetTimeMinutes]);

  // --- Derived State ---
  const allFuels = useMemo(() => {
      // Combine built-in presets with user's custom fuels
      return [...PRESET_FUELS, ...settings.customFuels];
  }, [settings.customFuels]);

  const filteredPresets = useMemo(() => {
    // 1. Filter out disabled items
    const enabledFuels = allFuels.filter(item => !settings.disabledFuelIds.includes(item.id));
    
    // 2. Filter by search query
    if (!searchQuery.trim()) return enabledFuels;
    const lower = searchQuery.toLowerCase();
    return enabledFuels.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      (p.brand && p.brand.toLowerCase().includes(lower))
    );
  }, [searchQuery, settings.disabledFuelIds, allFuels]);

  // --- Handlers ---

  const addItemToHour = (item: FuelItem, hourIndex: number) => {
    setPlan(prev => prev.map(h => {
      if (h.hourIndex === hourIndex) {
        return { ...h, items: [...h.items, { ...item }] }; 
      }
      return h;
    }));
  };

  const handleAddAiItem = (item: FuelItem) => {
      if (selectedHourIndex === null) return;
      
      // 1. Add to the current hour's plan
      addItemToHour(item, selectedHourIndex);
      
      // 2. Persist to custom fuels library if not already there (simple duplicate check by name)
      setSettings(prev => {
          const exists = prev.customFuels.some(f => f.name.toLowerCase() === item.name.toLowerCase());
          if (exists) return prev;
          
          return {
              ...prev,
              customFuels: [item, ...prev.customFuels] // Add to top
          };
      });

      // 3. Clear search
      setSearchQuery('');
      setCustomSearchResults([]);
  };

  const removeItemFromHour = (hourIndex: number, itemId: string) => {
    setPlan(prev => prev.map(h => {
        if (h.hourIndex === hourIndex) {
            const indexToRemove = h.items.findIndex(i => i.id === itemId);
            if (indexToRemove === -1) return h;
            const newItems = [...h.items];
            newItems.splice(indexToRemove, 1);
            return { ...h, items: newItems };
        }
        return h;
    }));
  };

  const toggleFuelVisibility = (fuelId: string) => {
      setSettings(prev => {
          const isDisabled = prev.disabledFuelIds.includes(fuelId);
          return {
              ...prev,
              disabledFuelIds: isDisabled 
                ? prev.disabledFuelIds.filter(id => id !== fuelId)
                : [...prev.disabledFuelIds, fuelId]
          };
      });
  };

  const deleteCustomFuel = (fuelId: string) => {
      if(confirm('Delete this custom item permanently?')) {
          setSettings(prev => ({
              ...prev,
              customFuels: prev.customFuels.filter(f => f.id !== fuelId),
              disabledFuelIds: prev.disabledFuelIds.filter(id => id !== fuelId)
          }));
      }
  };

  const handleClearPlan = () => {
      if (confirm("Are you sure you want to clear all items from your plan?")) {
          const totalHours = Math.ceil(settings.targetTimeHours + settings.targetTimeMinutes / 60);
          const emptyPlan = Array.from({ length: totalHours }, (_, i) => ({ hourIndex: i, items: [] }));
          setPlan(emptyPlan);
      }
  };

  const handleFactoryReset = () => {
      if (confirm("This will delete all settings, custom foods, and data. Are you sure?")) {
          clearAllData();
          setSettings(DEFAULT_SETTINGS);
          // Plan effect will regenerate empty buckets based on default time
          setPlan([]); 
          setActiveTab('build');
      }
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (searchError) setSearchError(null);
    if (customSearchResults.length > 0) {
        setCustomSearchResults([]);
    }
  };

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    setCustomSearchResults([]);
    
    const result = await searchCustomFood(searchQuery);
    setIsSearching(false);
    
    if (result) {
      setCustomSearchResults([result]);
    } else {
      setSearchError("No AI results found. Try a more specific name.");
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null);
    const result = await analyzePlan(plan, settings);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const getHourItemCount = (itemId: string) => {
    if (selectedHourIndex === null) return 0;
    const hour = plan.find(h => h.hourIndex === selectedHourIndex);
    if (!hour) return 0;
    return hour.items.filter(i => i.id === itemId).length;
  };

  const chartData = plan.map(h => ({
    hour: `Hr ${h.hourIndex + 1}`,
    carbs: h.items.reduce((acc, i) => acc + i.carbs, 0),
    target: settings.targetCarbsPerHour
  }));

  // --- Render Helpers ---

  const renderHeader = () => (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('build')}>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">
            FuelMaster
          </h1>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-4">
             {/* Stats Pill */}
            <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-800 rounded-full border border-slate-700 mr-4">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Timer className="w-4 h-4 text-slate-500" />
                    <span className="font-mono">{settings.targetTimeHours}h {settings.targetTimeMinutes}m</span>
                </div>
                <div className="w-px h-4 bg-slate-700"></div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <span className="font-mono font-bold text-emerald-400">{settings.targetCarbsPerHour}g/hr</span>
                </div>
            </div>

            <button 
                onClick={() => setActiveTab('build')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'build' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
            >
                Builder
            </button>
            <button 
                onClick={() => {
                    setActiveTab('analyze');
                    handleAnalyze();
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'analyze' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
            >
                Analyze
            </button>
             <button 
                onClick={() => setActiveTab('settings')}
                className={`p-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                aria-label="Settings"
            >
                <Settings className="w-5 h-5" />
            </button>
        </nav>
        
        {/* Mobile Menu Toggle */}
        <button className="md:hidden p-2 text-slate-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-800 bg-slate-900 p-4 space-y-4 animate-in slide-in-from-top-5">
                <button 
                    onClick={() => { setActiveTab('build'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-slate-800 text-white font-medium"
                >
                    Plan Builder
                </button>
                <button 
                    onClick={() => { setActiveTab('analyze'); handleAnalyze(); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-slate-800 text-white font-medium"
                >
                    Analyze
                </button>
                <button 
                    onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-slate-800 text-white font-medium flex items-center justify-between"
                >
                    Settings <Settings className="w-4 h-4" />
                </button>
            </div>
        )}
    </header>
  );

  const renderSettingsView = () => (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-fadeIn">
          <div className="flex flex-col gap-2 mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Settings className="w-6 h-6 text-slate-400" /> Settings
              </h2>
              <p className="text-slate-400">Configure your race goals and manage your fuel database.</p>
          </div>

          {/* Targets Section */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-6">
              <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-3">Race Goals</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <label className="text-xs text-slate-500 uppercase font-semibold">Goal Time</label>
                    <div className="flex gap-2">
                        <div className="relative w-full">
                            <input 
                                type="number" 
                                value={settings.targetTimeHours}
                                onChange={(e) => setSettings({...settings, targetTimeHours: Math.max(1, Number(e.target.value))})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="absolute right-3 top-3 text-slate-500 text-sm">hr</span>
                        </div>
                        <div className="relative w-full">
                            <input 
                                type="number" 
                                value={settings.targetTimeMinutes}
                                onChange={(e) => setSettings({...settings, targetTimeMinutes: Math.min(59, Math.max(0, Number(e.target.value)))})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="absolute right-3 top-3 text-slate-500 text-sm">min</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-slate-500 uppercase font-semibold">Carbs Target</label>
                        <span className="text-emerald-400 font-mono text-sm">{settings.targetCarbsPerHour}g/hr</span>
                    </div>
                    <input 
                        type="range" 
                        min="30" max="120" step="5"
                        value={settings.targetCarbsPerHour}
                        onChange={(e) => setSettings({...settings, targetCarbsPerHour: Number(e.target.value)})}
                        className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-slate-500 uppercase font-semibold">Sodium Target</label>
                        <span className="text-cyan-400 font-mono text-sm">{settings.targetSodiumPerHour}mg/hr</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" max="1000" step="50"
                        value={settings.targetSodiumPerHour}
                        onChange={(e) => setSettings({...settings, targetSodiumPerHour: Number(e.target.value)})}
                        className="w-full accent-cyan-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-slate-500 uppercase font-semibold">Potassium Target</label>
                        <span className="text-purple-400 font-mono text-sm">{settings.targetPotassiumPerHour}mg/hr</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" max="500" step="10"
                        value={settings.targetPotassiumPerHour}
                        onChange={(e) => setSettings({...settings, targetPotassiumPerHour: Number(e.target.value)})}
                        className="w-full accent-purple-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
              </div>
          </div>

          {/* Manage Fuels Section */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-6">
               <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-3">Manage Presets</h3>
               <p className="text-sm text-slate-400">Toggle items to hide them from the fuel picker.</p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                   {PRESET_FUELS.map(fuel => {
                       const isDisabled = settings.disabledFuelIds.includes(fuel.id);
                       return (
                           <div 
                                key={fuel.id} 
                                onClick={() => toggleFuelVisibility(fuel.id)}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isDisabled ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-600 hover:border-slate-500'}`}
                           >
                               <span className={`text-sm font-medium ${isDisabled ? 'text-slate-500' : 'text-slate-200'}`}>
                                   {fuel.name}
                               </span>
                               {isDisabled ? (
                                   <EyeOff className="w-4 h-4 text-slate-600" />
                               ) : (
                                   <Check className="w-4 h-4 text-emerald-500" />
                               )}
                           </div>
                       );
                   })}
               </div>
          </div>
          
           {/* Custom Fuels Section */}
           {settings.customFuels.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-6">
                    <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-3">My Custom Items</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {settings.customFuels.map(fuel => {
                            const isDisabled = settings.disabledFuelIds.includes(fuel.id);
                            return (
                                <div 
                                        key={fuel.id} 
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isDisabled ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-600'}`}
                                >
                                    <div 
                                        className="flex-1 cursor-pointer flex items-center justify-between mr-2"
                                        onClick={() => toggleFuelVisibility(fuel.id)}
                                    >
                                        <span className={`text-sm font-medium truncate ${isDisabled ? 'text-slate-500' : 'text-slate-200'}`}>
                                            {fuel.name}
                                        </span>
                                        {isDisabled ? (
                                            <EyeOff className="w-4 h-4 text-slate-600 shrink-0" />
                                        ) : (
                                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        )}
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); deleteCustomFuel(fuel.id); }}
                                        className="p-1.5 rounded-md hover:bg-red-900/50 text-slate-500 hover:text-red-400"
                                        title="Delete Permanently"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
           )}

          {/* Data Management Section */}
          <div className="bg-red-900/10 rounded-xl p-6 border border-red-900/30 space-y-6">
              <h3 className="text-lg font-semibold text-red-200 border-b border-red-900/30 pb-3">Danger Zone</h3>
              
              <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={handleClearPlan}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-950 hover:bg-red-900 text-red-400 border border-red-900/50 rounded-lg transition-colors text-sm font-medium"
                  >
                      <Trash2 className="w-4 h-4" /> Clear Current Plan
                  </button>
                  
                  <button 
                    onClick={handleFactoryReset}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-transparent hover:bg-red-950/50 text-red-400 border border-red-900/50 rounded-lg transition-colors text-sm font-medium"
                  >
                      <RotateCcw className="w-4 h-4" /> Reset All Data
                  </button>
              </div>
          </div>
      </div>
  );

  const renderAnalysisView = () => (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-fadeIn">
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-blue-500" /> Fueling Analysis
              </h2>
              
              <div className="h-80 w-full mb-8">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{top: 20, right: 30, left: 0, bottom: 0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="hour" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                            cursor={{fill: '#334155', opacity: 0.4}}
                        />
                        <ReferenceLine y={settings.targetCarbsPerHour} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Target', fill: '#10b981', fontSize: 12, position: 'right' }} />
                        <Bar dataKey="carbs" radius={[4, 4, 0, 0]}>
                             {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={
                                    entry.carbs < entry.target * 0.8 ? '#eab308' : 
                                    entry.carbs > entry.target * 1.1 ? '#f97316' : '#10b981'
                                } />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-600"></div>
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" /> AI Coach Insights
                    </h3>
                    {isAnalyzing ? (
                         <div className="flex items-center gap-2 text-slate-400 py-4">
                             <Loader2 className="w-5 h-5 animate-spin" /> Analyzing your nutrition strategy...
                         </div>
                    ) : (
                        <p className="text-slate-300 leading-relaxed">
                            {aiAnalysis || "Click 'Analyze Plan' to get personalized feedback on your strategy."}
                        </p>
                    )}
              </div>
          </div>
      </div>
  );

  // --- Main Render ---

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {renderHeader()}
      
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-slate-900/30 relative custom-scrollbar">
            {activeTab === 'analyze' && renderAnalysisView()}
            {activeTab === 'settings' && renderSettingsView()}
            {activeTab === 'build' && (
                <div className="p-4 md:p-8 max-w-5xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {plan.map((hour) => (
                            <HourlyBucket 
                                key={hour.hourIndex}
                                hourPlan={hour}
                                targetCarbs={settings.targetCarbsPerHour}
                                targetSodium={settings.targetSodiumPerHour}
                                targetPotassium={settings.targetPotassiumPerHour}
                                onAddItem={(idx) => {
                                    setSelectedHourIndex(idx);
                                }}
                                onRemoveItem={removeItemFromHour}
                                isActive={selectedHourIndex === hour.hourIndex}
                            />
                        ))}
                        
                        <button 
                            onClick={() => setSettings(s => ({...s, targetTimeHours: s.targetTimeHours + 1}))}
                            className="min-h-[200px] rounded-xl border border-dashed border-slate-800 hover:border-slate-600 bg-slate-900/20 flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-slate-700 flex items-center justify-center mb-3 transition-colors">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="font-medium">Add Hour</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
      </main>

      {/* Item Picker Modal */}
      {selectedHourIndex !== null && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
                    <h3 className="font-bold text-lg">Add Fuel to Hour {selectedHourIndex + 1}</h3>
                    <button onClick={() => setSelectedHourIndex(null)} className="p-2 hover:bg-slate-700 rounded-full text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-4 border-b border-slate-800 bg-slate-900">
                     <form onSubmit={handleAiSearch} className="relative">
                        <input 
                            type="text" 
                            placeholder="Search foods..." 
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchQuery}
                            onChange={handleSearchInput}
                            autoFocus
                        />
                        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                         {isSearching && <Loader2 className="w-4 h-4 text-blue-500 absolute right-3.5 top-3.5 animate-spin" />}
                    </form>
                     
                     {customSearchResults.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-xs font-bold text-blue-400 uppercase mb-2">AI Search Result</h4>
                            {customSearchResults.map(item => (
                                <FuelCard 
                                    key={item.id} 
                                    item={item}
                                    compact={true} 
                                    onAdd={() => handleAddAiItem(item)}
                                    count={getHourItemCount(item.id)}
                                    showSingleCount={true}
                                />
                            ))}
                        </div>
                    )}

                    {searchError && (
                        <p className="text-xs text-red-400 mt-2 text-center">{searchError}</p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900 custom-scrollbar">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">
                        {searchQuery ? 'Matching Items' : 'Available Fuels'}
                    </h4>
                    
                    {filteredPresets.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                             {searchQuery ? (
                                <>
                                    <p>No matches found in library.</p>
                                    <p className="text-xs mt-1 text-slate-600">Hit Enter to search AI</p>
                                </>
                             ) : (
                                <p>All items hidden. Check Settings.</p>
                             )}
                        </div>
                    ) : (
                        filteredPresets.map(item => (
                            <FuelCard 
                                key={item.id} 
                                item={item}
                                compact={true}
                                onAdd={() => {
                                    addItemToHour(item, selectedHourIndex);
                                }}
                                count={getHourItemCount(item.id)}
                                showSingleCount={true}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;