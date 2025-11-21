import React, { useState, useEffect, useMemo } from 'react';
import { UserSettings, HourPlan, FuelItem } from './types';
import { PRESET_FUELS, MAX_HOURS, DEFAULT_TARGET_CARBS, DEFAULT_TARGET_SODIUM, DEFAULT_TARGET_POTASSIUM } from './constants';
import { FuelCard } from './components/FuelCard';
import { HourlyBucket } from './components/HourlyBucket';
import { searchCustomFood, analyzePlan } from './services/geminiService';
import { Search, Sparkles, BarChart3, Timer, Loader2, Menu, X, Activity, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

const App: React.FC = () => {
  // --- State ---
  const [settings, setSettings] = useState<UserSettings>({
    targetTimeHours: 3,
    targetTimeMinutes: 30,
    targetCarbsPerHour: DEFAULT_TARGET_CARBS,
    targetSodiumPerHour: DEFAULT_TARGET_SODIUM,
    targetPotassiumPerHour: DEFAULT_TARGET_POTASSIUM
  });
  
  const [plan, setPlan] = useState<HourPlan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customSearchResults, setCustomSearchResults] = useState<FuelItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // UI State
  const [selectedHourIndex, setSelectedHourIndex] = useState<number | null>(null); // If null, we are in "View All" mode, or selecting via drag (simplified to click)
  const [activeTab, setActiveTab] = useState<'build' | 'analyze'>('build');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- Init Plan based on Time ---
  useEffect(() => {
    const totalHours = Math.ceil(settings.targetTimeHours + settings.targetTimeMinutes / 60);
    // Preserve existing items if resizing, or just create new empty buckets
    setPlan(prev => {
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
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return PRESET_FUELS;
    const lower = searchQuery.toLowerCase();
    return PRESET_FUELS.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      (p.brand && p.brand.toLowerCase().includes(lower))
    );
  }, [searchQuery]);

  // --- Handlers ---

  const addItemToHour = (item: FuelItem, hourIndex: number) => {
    setPlan(prev => prev.map(h => {
      if (h.hourIndex === hourIndex) {
        // Deep copy item to avoid reference issues
        return { ...h, items: [...h.items, { ...item }] }; 
      }
      return h;
    }));
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

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (searchError) setSearchError(null);
    // Clear AI results if the user changes the query to avoid confusion
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

  // Helper to get item count in the currently selected hour
  const getHourItemCount = (itemId: string) => {
    if (selectedHourIndex === null) return 0;
    const hour = plan.find(h => h.hourIndex === selectedHourIndex);
    if (!hour) return 0;
    return hour.items.filter(i => i.id === itemId).length;
  };

  // --- Chart Data Preparation ---
  const chartData = plan.map(h => ({
    hour: `Hr ${h.hourIndex + 1}`,
    carbs: h.items.reduce((acc, i) => acc + i.carbs, 0),
    target: settings.targetCarbsPerHour
  }));

  // --- Sub-Components for App Layout ---

  const renderHeader = () => (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            FuelMaster
          </h1>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-800 rounded-full border border-slate-700">
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
                onClick={() => {
                    setActiveTab(activeTab === 'build' ? 'analyze' : 'build');
                    if(activeTab === 'build') handleAnalyze();
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'analyze' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
                {activeTab === 'build' ? 'Analyze Plan' : 'Back to Builder'}
            </button>
        </nav>
        
        {/* Mobile Menu Toggle */}
        <button className="md:hidden p-2 text-slate-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

        {/* Mobile Settings Drawer */}
        {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-800 bg-slate-900 p-4 space-y-4 animate-in slide-in-from-top-5">
                <div className="space-y-2">
                    <label className="text-xs text-slate-500 uppercase font-semibold">Goal Time</label>
                    <div className="flex gap-2">
                         <input 
                            type="number" 
                            value={settings.targetTimeHours}
                            onChange={(e) => setSettings({...settings, targetTimeHours: Number(e.target.value)})}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                        />
                        <span className="text-slate-500 py-2">h</span>
                         <input 
                            type="number" 
                            value={settings.targetTimeMinutes}
                            onChange={(e) => setSettings({...settings, targetTimeMinutes: Number(e.target.value)})}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                        />
                         <span className="text-slate-500 py-2">m</span>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-slate-500 uppercase font-semibold">Target Carbs</label>
                        <span className="text-emerald-400 font-mono text-sm">{settings.targetCarbsPerHour}g/hr</span>
                    </div>
                    <input 
                        type="range" 
                        min="30" max="120" step="5"
                        value={settings.targetCarbsPerHour}
                        onChange={(e) => setSettings({...settings, targetCarbsPerHour: Number(e.target.value)})}
                        className="w-full accent-emerald-500"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-slate-500 uppercase font-semibold">Target Sodium</label>
                        <span className="text-cyan-400 font-mono text-sm">{settings.targetSodiumPerHour}mg/hr</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" max="1000" step="50"
                        value={settings.targetSodiumPerHour}
                        onChange={(e) => setSettings({...settings, targetSodiumPerHour: Number(e.target.value)})}
                        className="w-full accent-cyan-500"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-slate-500 uppercase font-semibold">Target Potassium</label>
                        <span className="text-purple-400 font-mono text-sm">{settings.targetPotassiumPerHour}mg/hr</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" max="500" step="10"
                        value={settings.targetPotassiumPerHour}
                        onChange={(e) => setSettings({...settings, targetPotassiumPerHour: Number(e.target.value)})}
                        className="w-full accent-purple-500"
                    />
                </div>
            </div>
        )}
    </header>
  );

  const renderAnalysisView = () => (
      <div className="p-6 max-w-4xl mx-auto space-y-8 animate-fadeIn">
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
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-900/30 relative">
            
            {activeTab === 'analyze' ? (
                renderAnalysisView()
            ) : (
                <div className="p-4 md:p-8 max-w-5xl mx-auto">
                    {/* Hours Grid */}
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
                        
                         {/* Add Hour Button (Dynamic extension) */}
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

      {/* Item Picker Modal (When an hour is clicked) */}
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
                     
                     {/* AI Result in Modal */}
                     {customSearchResults.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-xs font-bold text-blue-400 uppercase mb-2">AI Search Result</h4>
                            {customSearchResults.map(item => (
                                <FuelCard 
                                    key={item.id} 
                                    item={item}
                                    compact={true} 
                                    onAdd={() => {
                                        addItemToHour(item, selectedHourIndex);
                                        setSearchQuery('');
                                        setCustomSearchResults([]);
                                    }}
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

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">
                        {searchQuery ? 'Matching Presets' : 'Common Fuels'}
                    </h4>
                    
                    {filteredPresets.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                             <p>No local matches.</p>
                             <p className="text-xs mt-1 text-slate-600">Hit Enter to search AI</p>
                        </div>
                    ) : (
                        filteredPresets.map(item => (
                            <FuelCard 
                                key={item.id} 
                                item={item}
                                compact={true}
                                onAdd={() => {
                                    addItemToHour(item, selectedHourIndex);
                                    // Keep modal open to add more items
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