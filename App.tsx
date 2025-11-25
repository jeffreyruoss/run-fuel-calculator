import React, { useState, useEffect, useMemo } from 'react';
import { UserSettings, HourPlan, FuelItem, FuelType } from './types';
import { PRESET_FUELS, MAX_HOURS } from './constants';
import { FuelCard } from './components/FuelCard';
import { HourlyBucket } from './components/HourlyBucket';
import { searchCustomFood, analyzePlan } from './services/geminiService';
import { loadPlan, loadSettings, savePlan, saveSettings, clearAllData, DEFAULT_SETTINGS } from './services/storageService';
import { fetchLocalWeather } from './services/weatherService';
import { Search, Sparkles, BarChart3, Timer, Loader2, Menu, X, Activity, Plus, Settings, Trash2, RotateCcw, Check, EyeOff, Thermometer, Droplets, MapPin, Calculator } from 'lucide-react';
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
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);

  // --- Persistence Effects ---
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  // --- Init Plan Logic ---
  useEffect(() => {
    const totalHours = Math.ceil(settings.targetTimeHours + settings.targetTimeMinutes / 60);
    setPlan(prev => {
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
      return [...PRESET_FUELS, ...settings.customFuels];
  }, [settings.customFuels]);

  const filteredPresets = useMemo(() => {
    const enabledFuels = allFuels.filter(item => !settings.disabledFuelIds.includes(item.id));
    if (!searchQuery.trim()) return enabledFuels;
    const lower = searchQuery.toLowerCase();
    return enabledFuels.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      (p.brand && p.brand.toLowerCase().includes(lower))
    );
  }, [searchQuery, settings.disabledFuelIds, allFuels]);

  // --- Logic ---

  const calculateTargets = () => {
    // Heuristic Logic for Fueling Targets
    let newCarbs = 60;
    let newSodium = 300;
    let newPotassium = 100;

    // 1. Activity Mode Impact on Carbs
    if (settings.activityMode === 'RACE') {
        newCarbs = 75; // Baseline high for racing
    } else {
        newCarbs = 45; // Lower for Zone 2 training
    }

    // 2. Sweat Profile Impact on Sodium
    // Baselines: Low ~300, Avg ~500, High ~800+
    if (settings.sweatProfile === 'LOW') {
        newSodium = 250;
    } else if (settings.sweatProfile === 'AVERAGE') {
        newSodium = 500;
    } else {
        newSodium = 900; // Salty sweater
    }

    // 3. Weather Impact (Heat & Humidity)
    const { temperatureF, humidity } = settings.weather;

    // Heat Factor
    if (temperatureF > 75) {
        newSodium += 200; // Significant increase in hot weather
        newPotassium += 50;
        // Sometimes heat reduces carb tolerance slightly, but we'll keep performance focus
    } else if (temperatureF > 60) {
        newSodium += 100;
    }

    // Humidity Factor (>60% impedes evaporation, increasing sweat rate)
    if (humidity > 60 && temperatureF > 60) {
        newSodium += 100;
    }

    // Caps
    newCarbs = Math.min(120, Math.max(30, newCarbs));
    newSodium = Math.min(1500, Math.max(0, newSodium));
    newPotassium = Math.min(500, Math.max(0, newPotassium));

    setSettings(prev => ({
        ...prev,
        targetCarbsPerHour: newCarbs,
        targetSodiumPerHour: newSodium,
        targetPotassiumPerHour: newPotassium
    }));

    alert(`Targets Updated!\n\nBased on your ${settings.sweatProfile.toLowerCase()} sweat profile, ${settings.activityMode === 'RACE' ? 'race' : 'training'} intensity, and ${temperatureF}°F weather.\n\nCarbs: ${newCarbs}g\nSodium: ${newSodium}mg\nPotassium: ${newPotassium}mg`);
  };

  const handleFetchWeather = async () => {
      setIsFetchingWeather(true);
      try {
          const data = await fetchLocalWeather();
          setSettings(prev => ({
              ...prev,
              weather: {
                  temperatureF: data.temperatureF,
                  humidity: data.humidity
              }
          }));
      } catch (error) {
          alert("Could not fetch weather. Please ensure location permissions are allowed or enter manually.");
      } finally {
          setIsFetchingWeather(false);
      }
  };

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
      addItemToHour(item, selectedHourIndex);
      setSettings(prev => {
          const exists = prev.customFuels.some(f => f.name.toLowerCase() === item.name.toLowerCase());
          if (exists) return prev;
          return { ...prev, customFuels: [item, ...prev.customFuels] };
      });
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

        <nav className="hidden md:flex items-center gap-4">
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
        
        <button className="md:hidden p-2 text-slate-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

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
              <p className="text-slate-400">Configure physiology, conditions, and targets.</p>
          </div>

          {/* Physiology & Conditions Section */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h3 className="text-lg font-semibold text-white">Physiology & Conditions</h3>
                <button 
                    onClick={calculateTargets}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                >
                    <Calculator className="w-4 h-4" /> Auto-Set Targets
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Activity Mode */}
                 <div className="space-y-3">
                    <label className="text-xs text-slate-500 uppercase font-semibold">Activity Type</label>
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                        <button 
                            onClick={() => setSettings({...settings, activityMode: 'TRAINING_Z2'})}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${settings.activityMode === 'TRAINING_Z2' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Zone 2 Training
                        </button>
                        <button 
                            onClick={() => setSettings({...settings, activityMode: 'RACE'})}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${settings.activityMode === 'RACE' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Race Day
                        </button>
                    </div>
                </div>

                {/* Sweat Profile */}
                <div className="space-y-3">
                    <label className="text-xs text-slate-500 uppercase font-semibold">Sweat Profile</label>
                    <select 
                        value={settings.sweatProfile}
                        onChange={(e) => setSettings({...settings, sweatProfile: e.target.value as any})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="LOW">Low / Non-Salty Sweater</option>
                        <option value="AVERAGE">Average Sweater</option>
                        <option value="HIGH">Heavy / Salty Sweater</option>
                    </select>
                </div>

                {/* Weather Manual / Auto */}
                <div className="space-y-3 md:col-span-2">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-slate-500 uppercase font-semibold">Weather Conditions</label>
                        <button 
                            onClick={handleFetchWeather}
                            disabled={isFetchingWeather}
                            className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-50"
                        >
                            {isFetchingWeather ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                            {isFetchingWeather ? 'Locating...' : 'Get Local Weather'}
                        </button>
                    </div>
                    <div className="flex gap-4">
                        <div className="relative w-full">
                            <Thermometer className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                            <input 
                                type="number" 
                                value={settings.weather.temperatureF}
                                onChange={(e) => setSettings({...settings, weather: { ...settings.weather, temperatureF: Number(e.target.value) }})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-9 pr-8 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="absolute right-3 top-3.5 text-slate-500 text-sm">°F</span>
                        </div>
                        <div className="relative w-full">
                            <Droplets className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                            <input 
                                type="number" 
                                value={settings.weather.humidity}
                                onChange={(e) => setSettings({...settings, weather: { ...settings.weather, humidity: Number(e.target.value) }})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-9 pr-8 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="absolute right-3 top-3.5 text-slate-500 text-sm">%</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">
                        Higher heat and humidity increases sodium requirements.
                    </p>
                </div>
              </div>
          </div>

          {/* Targets Section */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-6">
              <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-3">Race Goals & Targets</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 md:col-span-2">
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
                        min="0" max="1500" step="50"
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

  const renderAnalysisView = () => {
    if (isAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-blue-500" />
          <p className="text-lg animate-pulse">Analyzing nutrition strategy...</p>
        </div>
      );
    }

    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
        <div className="flex flex-col gap-2 mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-slate-400" /> Analysis
            </h2>
            <p className="text-slate-400">Review your fueling strategy against your targets.</p>
        </div>

        {/* Chart Section */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 h-[400px]">
            <h3 className="text-lg font-semibold text-white mb-6">Carbohydrates per Hour</h3>
            <ResponsiveContainer width="100%" height="85%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                        cursor={{ fill: '#334155', opacity: 0.4 }}
                    />
                    <ReferenceLine y={settings.targetCarbsPerHour} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'right', value: 'Target', fill: '#10b981', fontSize: 12 }} />
                    <Bar dataKey="carbs" radius={[4, 4, 0, 0]} maxBarSize={60}>
                         {chartData.map((entry, index) => {
                             const isLow = entry.carbs < settings.targetCarbsPerHour * 0.8;
                             const isHigh = entry.carbs > settings.targetCarbsPerHour * 1.1;
                             return <Cell key={`cell-${index}`} fill={isLow ? '#eab308' : isHigh ? '#f97316' : '#10b981'} />;
                         })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>

        {/* AI Insight Section */}
        {aiAnalysis && (
            <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 rounded-xl p-6 border border-indigo-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles className="w-32 h-32 text-indigo-400" />
                </div>
                <div className="relative z-10">
                    <h3 className="text-lg font-bold text-indigo-300 mb-3 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" /> Coach Insight
                    </h3>
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-line">
                        {aiAnalysis}
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <p className="text-slate-500 text-xs uppercase font-bold mb-1">Total Carbs</p>
                <p className="text-2xl font-mono text-white">
                    {plan.reduce((acc, h) => acc + h.items.reduce((s, i) => s + i.carbs, 0), 0)}g
                </p>
            </div>
             <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <p className="text-slate-500 text-xs uppercase font-bold mb-1">Total Sodium</p>
                <p className="text-2xl font-mono text-cyan-400">
                    {plan.reduce((acc, h) => acc + h.items.reduce((s, i) => s + (i.sodium || 0), 0), 0)}mg
                </p>
            </div>
             <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <p className="text-slate-500 text-xs uppercase font-bold mb-1">Total Caffeine</p>
                <p className="text-2xl font-mono text-yellow-500">
                    {plan.reduce((acc, h) => acc + h.items.reduce((s, i) => s + (i.caffeine || 0), 0), 0)}mg
                </p>
            </div>
        </div>
      </div>
    );
  };

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