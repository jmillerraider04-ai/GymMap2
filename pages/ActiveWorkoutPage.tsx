import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, ChevronDown, Scale, ArrowRight, Trophy, RefreshCcw, Gauge, Trash2, AlertTriangle, X, Check } from 'lucide-react';
import { Workout, WorkoutLogSet, UnitSystem, KnowledgeLevel } from '../types';
import NumberInput from '../components/NumberInput';

interface ActiveWorkoutPageProps {
  workout: Workout;
  onFinish: () => void;
  unitSystem: UnitSystem;
  knowledgeLevel: KnowledgeLevel;
}

type InputMode = 'weight' | 'plates';
type IntensityMode = 'OFF' | 'RIR' | 'RPE';

interface ValidationIssue {
  exerciseInstanceId: string;
  exerciseName: string;
  setId: string;
  setIndex: number;
  missingField: 'weight' | 'reps';
}

const ActiveWorkoutPage: React.FC<ActiveWorkoutPageProps> = ({ workout, onFinish, unitSystem, knowledgeLevel }) => {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [logs, setLogs] = useState<Record<string, WorkoutLogSet[]>>({});
  const [focusedSetId, setFocusedSetId] = useState<string | null>(null);
  
  // Validation State
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  // View Modes
  const [inputMode, setInputMode] = useState<InputMode>('weight');
  const [intensityMode, setIntensityMode] = useState<IntensityMode>('RIR');
  const [includeBar, setIncludeBar] = useState(true);

  // Guard clause
  if (!workout || !workout.exercises || workout.exercises.length === 0) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Empty Workout</h2>
        <button onClick={onFinish} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">Go Back</button>
      </div>
    );
  }

  const currentExercise = workout.exercises[exerciseIndex];

  // Auto-detect Intensity Mode based on Targets
  useEffect(() => {
    const target = currentExercise.target;
    const hasRpe = !!target.rpe;
    const hasRir = !!target.rir;

    if (hasRpe && hasRir) {
      setIntensityMode('RIR');
    } else if (hasRpe) {
      setIntensityMode('RPE');
    } else {
      setIntensityMode('RIR');
    }
  }, [currentExercise]);

  // Auto-detect mode based on exercise category
  useEffect(() => {
    if (currentExercise.category === 'Barbell' || currentExercise.category === 'Plate Loaded') {
      setInputMode('plates');
    } else {
      setInputMode('weight');
    }
  }, [exerciseIndex, currentExercise]);

  // Initialize sets
  useEffect(() => {
    if (currentExercise && !logs[currentExercise.instanceId]) {
      const targetSets = parseInt(currentExercise.target.sets) || 3;
      const initialSets: WorkoutLogSet[] = [];
      
      if (currentExercise.unilateral) {
        const order = currentExercise.unilateralOrder || 'lr';
        for (let i = 0; i < targetSets; i++) {
          if (order === 'lr') {
            initialSets.push(
              { id: `${Date.now()}-${i}-l`, weight: '', reps: '', completed: false, rpe: '', rir: '', plateCounts: {}, side: 'left' },
              { id: `${Date.now()}-${i}-r`, weight: '', reps: '', completed: false, rpe: '', rir: '', plateCounts: {}, side: 'right' }
            );
          } else {
            initialSets.push(
              { id: `${Date.now()}-${i}-r`, weight: '', reps: '', completed: false, rpe: '', rir: '', plateCounts: {}, side: 'right' },
              { id: `${Date.now()}-${i}-l`, weight: '', reps: '', completed: false, rpe: '', rir: '', plateCounts: {}, side: 'left' }
            );
          }
        }
      } else {
        for (let i = 0; i < targetSets; i++) {
          initialSets.push({
            id: Date.now().toString() + i,
            weight: '',
            reps: '',
            completed: false,
            rpe: '',
            rir: '',
            plateCounts: {}
          });
        }
      }
      setLogs(prev => ({ ...prev, [currentExercise.instanceId]: initialSets }));
    }
  }, [exerciseIndex, currentExercise]);

  const updateSet = (exerciseId: string, setId: string, field: keyof WorkoutLogSet, value: any) => {
    setLogs(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map(set => 
        set.id === setId ? { ...set, [field]: value } : set
      )
    }));
  };

  const deleteSet = (exerciseId: string, setId: string) => {
    setLogs(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].filter(set => set.id !== setId)
    }));
    // Remove from validation issues if present
    setValidationIssues(prev => prev.filter(issue => issue.setId !== setId));
  };

  const handleWeightFocus = (exerciseId: string, setId: string, currentIndex: number) => {
    setFocusedSetId(setId);
    
    // Auto-fill logic: if current weight is empty and previous set exists, copy it
    const currentSets = logs[exerciseId];
    if (currentSets && currentIndex > 0) {
      const currentSet = currentSets[currentIndex];
      const previousSet = currentSets[currentIndex - 1];
      
      if (!currentSet.weight && previousSet.weight) {
        updateSet(exerciseId, setId, 'weight', previousSet.weight);
        // Also copy plate counts if in plate mode
        if (inputMode === 'plates' && previousSet.plateCounts) {
           setLogs(prev => ({
            ...prev,
            [exerciseId]: prev[exerciseId].map(set => 
              set.id === setId ? { ...set, plateCounts: { ...previousSet.plateCounts } } : set
            )
          }));
        }
      }
    }
  };

  const updatePlateCount = (plateWeight: number) => {
    if (!focusedSetId) return;
    
    // Determine which exercise the focused set belongs to (usually current, but could be tricky if we support multi-view later. For now assume current)
    // Optimization: Just search in currentExercise first.
    let targetExerciseId = currentExercise.instanceId;
    let setExists = logs[targetExerciseId]?.some(s => s.id === focusedSetId);
    
    // Fallback search if not in current (unlikely given UI flow, but good for safety)
    if (!setExists) {
      const found = Object.keys(logs).find(key => logs[key].some(s => s.id === focusedSetId));
      if (found) targetExerciseId = found;
      else return; 
    }

    const currentSets = logs[targetExerciseId];
    const set = currentSets.find(s => s.id === focusedSetId);
    if (!set) return;

    const currentCounts = set.plateCounts || {};
    const newCount = (currentCounts[plateWeight] || 0) + 1;
    const newCounts = { ...currentCounts, [plateWeight]: newCount };

    // Calculate new total weight
    const barWeight = includeBar ? (unitSystem === 'lbs' ? 45 : 20) : 0;
    const plateTotal = Object.entries(newCounts).reduce((acc, [wt, count]) => acc + (parseFloat(wt) * (count as number)), 0);
    const totalWeight = barWeight + (plateTotal * 2);

    setLogs(prev => ({
      ...prev,
      [targetExerciseId]: prev[targetExerciseId].map(s => 
        s.id === focusedSetId ? { ...s, plateCounts: newCounts, weight: totalWeight.toString() } : s
      )
    }));
  };

  const resetPlates = () => {
    if (!focusedSetId) return;
     let targetExerciseId = currentExercise.instanceId;
     // (Same fallback logic as above)
     if (!logs[targetExerciseId]?.some(s => s.id === focusedSetId)) {
        const found = Object.keys(logs).find(key => logs[key].some(s => s.id === focusedSetId));
        if (found) targetExerciseId = found;
        else return;
     }

    const barWeight = includeBar ? (unitSystem === 'lbs' ? 45 : 20) : 0;
    
    setLogs(prev => ({
      ...prev,
      [targetExerciseId]: prev[targetExerciseId].map(s => 
        s.id === focusedSetId ? { ...s, plateCounts: {}, weight: barWeight.toString() } : s
      )
    }));
  };

  const handlePlateCounterDone = () => {
    if (!focusedSetId) return;
    
    const currentSets = logs[currentExercise.instanceId];
    const currentIndex = currentSets.findIndex(s => s.id === focusedSetId);
    
    if (currentIndex === -1) {
        setFocusedSetId(null);
        return;
    }

    const currentSet = currentSets[currentIndex];

    // Logic to find next empty field
    // 1. Check current set reps
    if (!currentSet.reps) {
        setFocusedSetId(null);
        setTimeout(() => {
            const el = document.getElementById(`reps-${currentSet.id}`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 50);
        return;
    }

    // 2. Look for subsequent sets with empty weight or reps
    for (let i = currentIndex + 1; i < currentSets.length; i++) {
        const nextSet = currentSets[i];
        if (!nextSet.weight) {
            if (inputMode === 'plates') {
                // Keep modal open, switch to next set
                setFocusedSetId(nextSet.id);
                setTimeout(() => {
                     const el = document.getElementById(`weight-${nextSet.id}`);
                     el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
            } else {
                setFocusedSetId(null);
                setTimeout(() => {
                    const el = document.getElementById(`weight-${nextSet.id}`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 50);
            }
            return;
        }
        if (!nextSet.reps) {
             setFocusedSetId(null);
             setTimeout(() => {
                 const el = document.getElementById(`reps-${nextSet.id}`);
                 if (el) {
                     el.focus();
                     el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }
             }, 50);
             return;
        }
    }
    
    setFocusedSetId(null);
  };

  const addSet = () => {
    const newSets: WorkoutLogSet[] = [];
    if (currentExercise.unilateral) {
      const order = currentExercise.unilateralOrder || 'lr';
      if (order === 'lr') {
        newSets.push(
          { id: `${Date.now()}-l`, weight: '', reps: '', completed: false, side: 'left' },
          { id: `${Date.now()}-r`, weight: '', reps: '', completed: false, side: 'right' }
        );
      } else {
        newSets.push(
          { id: `${Date.now()}-r`, weight: '', reps: '', completed: false, side: 'right' },
          { id: `${Date.now()}-l`, weight: '', reps: '', completed: false, side: 'left' }
        );
      }
    } else {
      newSets.push({
        id: Date.now().toString(),
        weight: '',
        reps: '',
        completed: false
      });
    }
    setLogs(prev => ({
      ...prev,
      [currentExercise.instanceId]: [...prev[currentExercise.instanceId], ...newSets]
    }));
  };

  const cycleIntensityMode = () => {
    const modes: IntensityMode[] = ['RIR', 'RPE'];
    const nextIndex = (modes.indexOf(intensityMode) + 1) % modes.length;
    setIntensityMode(modes[nextIndex]);
  };

  const validateAndFinish = () => {
    const issues: ValidationIssue[] = [];

    // Scan all exercises in the workout
    workout.exercises.forEach(ex => {
      const exLogs = logs[ex.instanceId] || [];
      exLogs.forEach((set, idx) => {
        const hasWeight = set.weight !== '';
        const hasReps = set.reps !== '';

        // If one is filled but not the other, it's an issue
        // (If both are empty, we assume the user skipped the set intentionally)
        if ((hasWeight && !hasReps) || (!hasWeight && hasReps)) {
          issues.push({
            exerciseInstanceId: ex.instanceId,
            exerciseName: ex.name,
            setId: set.id,
            setIndex: idx + 1,
            missingField: hasWeight ? 'reps' : 'weight'
          });
        }
      });
    });

    if (issues.length > 0) {
      setValidationIssues(issues);
      setShowValidationModal(true);
    } else {
      onFinish();
    }
  };

  const handleNext = () => {
    if (exerciseIndex < workout.exercises.length - 1) {
      setExerciseIndex(prev => prev + 1);
      setFocusedSetId(null);
    } else {
      validateAndFinish();
    }
  };

  const handlePrev = () => {
    if (exerciseIndex > 0) {
      setExerciseIndex(prev => prev - 1);
      setFocusedSetId(null);
    }
  };

  const plateOptions = unitSystem === 'lbs' 
    ? [45, 35, 25, 10, 5, 2.5] 
    : [20, 15, 10, 5, 2.5, 1.25];

  // Grid Template: Always 3 columns to keep headers stable
  const gridTemplate = '1.4fr 1fr 1fr';

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col relative pb-48">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={validateAndFinish} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{workout.name}</h1>
              <p className="text-sm text-gray-500 font-medium">Exercise {exerciseIndex + 1} of {workout.exercises.length}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-1 px-6 pb-4">
          {workout.exercises.map((_, idx) => (
             <div key={idx} className={`h-1.5 flex-1 rounded-full ${idx <= exerciseIndex ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-2 lg:px-6 py-6 space-y-6">
        
        {/* Exercise Card */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-4 lg:p-8">
          <div className="mb-8 px-2">
             <h2 className="text-2xl font-black text-gray-900 mb-2">{currentExercise.name}</h2>
             {currentExercise.personalRecord ? (
                <p className="text-indigo-600 font-bold text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  PR: {currentExercise.personalRecord}
                </p>
             ) : (
                <p className="text-gray-400 font-medium text-sm">No PR recorded yet</p>
             )}
          </div>
          
          <div className="space-y-3">
             {/* Header Row */}
             <div className="grid gap-3 px-4 mb-2" style={{ gridTemplateColumns: gridTemplate }}>
               <button 
                 onClick={() => setInputMode(prev => prev === 'weight' ? 'plates' : 'weight')}
                 className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2 hover:text-indigo-600 transition-colors group text-left"
               >
                 {inputMode === 'plates' ? 'Plates' : `Weight (${unitSystem})`}
                 <Scale className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 transition-colors" />
               </button>
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Reps</span>
               <button 
                 onClick={cycleIntensityMode}
                 className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2 hover:text-indigo-600 transition-colors group text-left"
               >
                 {intensityMode}
                 <Gauge className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 transition-colors" />
               </button>
             </div>

             {logs[currentExercise.instanceId]?.map((set, idx) => {
               const isActive = focusedSetId === set.id;
               const isComplete = set.weight !== '' && set.reps !== '';
               const barWeightPlaceholder = unitSystem === 'lbs' ? "45" : "20";
               const standardWeightPlaceholder = unitSystem === 'lbs' ? "135" : "60";

               return (
                 <div key={set.id} className="space-y-1">
                   {set.side && (
                     <div className="flex items-center gap-1 px-4">
                       <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${set.side === 'left' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                         {set.side}
                       </span>
                       {!currentExercise.unilateral && <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Set {Math.floor(idx / 2) + 1}</span>}
                     </div>
                   )}
                   <div 
                      className={`grid gap-3 items-center p-3 rounded-2xl transition-all border ${isComplete ? 'bg-emerald-50/50 border-emerald-100' : 'bg-transparent border-transparent'}`}
                      style={{ gridTemplateColumns: gridTemplate }}
                   >
                     {/* Weight Input */}
                     <div 
                      className="relative h-14"
                      onClick={() => {
                        if (focusedSetId !== set.id) {
                           handleWeightFocus(currentExercise.instanceId, set.id, idx);
                        }
                      }}
                     >
                       <NumberInput 
                         id={`weight-${set.id}`}
                         value={set.weight}
                         onChange={(val) => updateSet(currentExercise.instanceId, set.id, 'weight', val)}
                         readOnly={inputMode === 'plates'} 
                         placeholder={inputMode === 'plates' ? barWeightPlaceholder : standardWeightPlaceholder}
                         className={`${isActive ? 'ring-2 ring-indigo-500/20 border-indigo-500' : ''}`}
                       />
                     </div>

                     {/* Reps Input */}
                     <div className="relative h-14">
                       <NumberInput
                         id={`reps-${set.id}`}
                         value={set.reps}
                         onChange={(val) => {
                           updateSet(currentExercise.instanceId, set.id, 'reps', val);
                           setFocusedSetId(null);
                          }}
                         placeholder="0"
                       />
                     </div>

                     {/* Intensity Input (RIR/RPE) */}
                     {intensityMode !== 'OFF' && (
                        <div className="relative h-14">
                          <NumberInput
                            value={intensityMode === 'RPE' ? (set.rpe || '') : (set.rir || '')}
                            onChange={(val) => {
                              updateSet(currentExercise.instanceId, set.id, intensityMode === 'RPE' ? 'rpe' : 'rir', val);
                              setFocusedSetId(null);
                            }}
                            placeholder={intensityMode === 'RPE' ? '8' : '2'}
                          />
                        </div>
                     )}
                   </div>
                 </div>
               );
             })}
          </div>

          <button onClick={addSet} className="w-full py-4 mt-6 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 font-bold flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-200 transition-all">
            <Plus className="w-5 h-5" /> Add Set
          </button>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="p-6 bg-white border-t border-gray-100 sticky bottom-0 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-3xl mx-auto flex gap-4">
          {exerciseIndex > 0 && (
             <button onClick={handlePrev} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98]">Previous</button>
          )}
          <button 
            onClick={handleNext}
            className={`flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
          >
            {exerciseIndex === workout.exercises.length - 1 ? "Finish Workout" : "Next Exercise"}
            {exerciseIndex < workout.exercises.length - 1 && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Plate Counter Bottom Sheet */}
      {focusedSetId && inputMode === 'plates' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 rounded-t-[2rem] shadow-2xl z-50 p-6 animate-in slide-in-from-bottom duration-300">
           <div className="max-w-3xl mx-auto">
             <div className="flex justify-between items-center mb-4">
                <div>
                   <h3 className="text-gray-900 font-bold text-lg">Plate Counters</h3>
                   <p className="text-xs text-gray-500 uppercase tracking-wide">Adding to one side ({includeBar ? 'Bar included' : 'No bar'})</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const next = !includeBar;
                      setIncludeBar(next);
                      // Recalculate current set weight if we change bar setting
                      if (focusedSetId) {
                        setLogs(prev => {
                          const targetExerciseId = Object.keys(prev).find(key => prev[key].some(s => s.id === focusedSetId));
                          if (!targetExerciseId) return prev;
                          const barWeight = next ? (unitSystem === 'lbs' ? 45 : 20) : 0;
                          return {
                            ...prev,
                            [targetExerciseId]: prev[targetExerciseId].map(s => {
                              if (s.id !== focusedSetId) return s;
                              const plateTotal = Object.entries(s.plateCounts || {}).reduce((acc, [wt, count]) => acc + (parseFloat(wt) * (count as number)), 0);
                              return { ...s, weight: (barWeight + plateTotal * 2).toString() };
                            })
                          };
                        });
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${includeBar ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {includeBar ? 'Excl. Bar' : 'Incl. Bar'}
                  </button>
                  <button onClick={resetPlates} className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-100 transition-colors">
                    <RefreshCcw className="w-4 h-4" /> Reset
                  </button>
                </div>
             </div>
             
             <div className="grid grid-cols-3 gap-3">
               {plateOptions.map((plate) => {
                 // We need to access the set generically, even if focusedSetId is global
                 // The helper function updatePlateCount handles the finding logic internally
                 // But for display, we do a quick check in current log first
                 const allSets = (Object.values(logs) as WorkoutLogSet[][]).reduce((acc, val) => acc.concat(val), [] as WorkoutLogSet[]);
                 const currentSet = logs[currentExercise.instanceId]?.find(s => s.id === focusedSetId) 
                    || allSets.find(s => s.id === focusedSetId);
                 
                 const count = currentSet?.plateCounts?.[plate] || 0;
                 const isSelected = count > 0;
                 
                 return (
                  <button
                    key={plate}
                    onClick={() => updatePlateCount(plate)}
                    className={`
                      flex flex-col items-center justify-center h-20 rounded-2xl transition-all shadow-md relative group
                      ${isSelected 
                        ? 'bg-gray-800 border-2 border-indigo-500 shadow-indigo-500/20' 
                        : 'bg-gray-900 border-2 border-transparent hover:bg-gray-800'}
                      text-white active:scale-95
                    `}
                  >
                    <span className="text-2xl font-black tracking-tight">{plate}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{unitSystem}</span>
                    
                    {count > 0 && (
                      <div className="absolute -top-2 -right-2 w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        <span className="text-xs font-bold">{count}</span>
                      </div>
                    )}
                  </button>
                 );
               })}
             </div>
             <button 
                onClick={handlePlateCounterDone} 
                className="w-full mt-4 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 hover:text-gray-900 transition-colors"
             >
                Done
             </button>
           </div>
        </div>
      )}

      {/* Validation Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-6 animate-in fade-in zoom-in-95 flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 mb-6 text-amber-500">
               <AlertTriangle className="w-8 h-8" />
               <h3 className="text-xl font-bold text-gray-900">Incomplete Sets ({validationIssues.length})</h3>
            </div>
            
            <p className="text-gray-500 mb-6 text-sm">
              It looks like you missed some sets. You can fill them out here if it was a mistake.
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
               {validationIssues.map((issue, idx) => {
                 // Look up the specific set value to display current state
                 const set = logs[issue.exerciseInstanceId]?.find(s => s.id === issue.setId);
                 if (!set) return null;

                 return (
                   <div key={`${issue.setId}-${idx}`} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                     <div className="flex justify-between items-start mb-3">
                       <div>
                         <h4 className="font-bold text-gray-900">{issue.exerciseName}</h4>
                         <p className="text-xs text-gray-500 font-bold uppercase">Set {issue.setIndex}</p>
                       </div>
                     </div>
                     
                     <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Weight</label>
                          <NumberInput 
                            value={set.weight}
                            onChange={(val) => updateSet(issue.exerciseInstanceId, issue.setId, 'weight', val)}
                            placeholder="Required"
                            className={!set.weight ? 'border-amber-400 ring-2 ring-amber-400/20' : ''}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Reps</label>
                          <NumberInput 
                            value={set.reps}
                            onChange={(val) => updateSet(issue.exerciseInstanceId, issue.setId, 'reps', val)}
                            placeholder="Required"
                             className={!set.reps ? 'border-amber-400 ring-2 ring-amber-400/20' : ''}
                          />
                        </div>
                     </div>
                   </div>
                 );
               })}
               {validationIssues.length === 0 && (
                 <div className="text-center py-8 text-emerald-600 font-bold flex flex-col items-center gap-2">
                   <Check className="w-8 h-8" />
                   All sets completed!
                 </div>
               )}
            </div>

            <div className="mt-6 flex gap-3">
               <button 
                 onClick={() => setShowValidationModal(false)}
                 className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold"
               >
                 Cancel
               </button>
               <button 
                 onClick={onFinish}
                 className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700"
               >
                 Confirm
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveWorkoutPage;