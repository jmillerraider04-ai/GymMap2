
import React, { useState } from 'react';
import { List, MoreVertical, Clock, Dumbbell, Plus, Calendar, CheckCircle2, ChevronDown, X, CalendarDays, Search, Layers, ChevronRight, Trash2 } from 'lucide-react';
import { Routine, Workout } from '../types';

interface RoutinesPageProps {
  routines: Routine[];
  setRoutines: (routines: Routine[]) => void;
  workouts: Workout[];
}

const RoutinesPage: React.FC<RoutinesPageProps> = ({ routines, setRoutines, workouts }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editorState, setEditorState] = useState<{
    name: string;
    description: string;
    cycleLength: number;
    schedule: Record<number, string>;
    active: boolean;
  }>({ name: '', description: '', cycleLength: 7, schedule: {}, active: false });

  const [activeDayIdx, setActiveDayIdx] = useState<number | null>(null);

  const startEditing = (routine: Routine) => {
    setEditorState({
      name: routine.name,
      description: routine.description || '',
      cycleLength: routine.cycleLength,
      schedule: routine.schedule,
      active: routine.active
    });
    setEditingRoutineId(routine.id);
    setIsCreating(true);
  };

  const deleteRoutine = () => {
    if (editingRoutineId) {
      setRoutines(routines.filter(r => r.id !== editingRoutineId));
      closeEditor();
    }
  };

  const closeEditor = () => {
    setIsCreating(false);
    setEditingRoutineId(null);
    setEditorState({ name: '', description: '', cycleLength: 7, schedule: {}, active: false });
  };

  const saveRoutine = () => {
    if (!editorState.name) return;
    
    if (editingRoutineId) {
        // Update existing
        const updated = routines.map(r => {
            // If the edited routine is set to active, deactivate others
            if (editorState.active && r.id !== editingRoutineId) {
                return { ...r, active: false };
            }
            if (r.id === editingRoutineId) {
                return {
                    ...r,
                    name: editorState.name,
                    description: editorState.description,
                    cycleLength: editorState.cycleLength,
                    schedule: editorState.schedule,
                    active: editorState.active
                };
            }
            return r;
        });
        setRoutines(updated);
    } else {
        // Create new
        const isFirst = routines.length === 0;
        const newRoutine: Routine = {
          id: Date.now().toString(),
          name: editorState.name,
          description: editorState.description,
          cycleLength: editorState.cycleLength,
          schedule: editorState.schedule,
          active: isFirst, // Default to active if it's the first one
          startDate: new Date().toISOString(),
          currentDay: 0 // Initialize at day 0
        };
        
        // If first is active, ensure others are inactive (redundant but safe)
        const updated = routines.map(r => newRoutine.active ? { ...r, active: false } : r);
        setRoutines([...updated, newRoutine]);
    }
    
    closeEditor();
  };
  
  const handleActivateInEditor = () => {
     setEditorState(prev => ({ ...prev, active: true }));
  };

  const assignWorkout = (workoutId: string) => {
    if (activeDayIdx === null) return;
    setEditorState(prev => ({
      ...prev,
      schedule: { ...prev.schedule, [activeDayIdx]: workoutId }
    }));
    setActiveDayIdx(null);
  };

  const clearDay = (dayIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSchedule = { ...editorState.schedule };
    delete newSchedule[dayIdx];
    setEditorState(prev => ({ ...prev, schedule: newSchedule }));
  };

  const getDayName = (idx: number, length: number) => {
    if (length === 7) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return days[idx];
    }
    return `Day ${idx + 1}`;
  };
  
  if (isCreating) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
         <header className="flex justify-between items-center mb-8 relative">
          <button 
            onClick={closeEditor}
            className="text-gray-500 hover:text-gray-900 font-bold z-10"
          >
            Cancel
          </button>
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
             {editingRoutineId && !editorState.active && (
               <button 
                onClick={handleActivateInEditor}
                className="bg-indigo-50 text-indigo-600 px-12 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-100 transition-colors shadow-sm"
              >
                Activate
              </button>
             )}
             {editorState.active && (
               <div className="bg-emerald-50 text-emerald-600 px-6 py-2 rounded-xl font-bold text-sm border border-emerald-100 flex items-center gap-2">
                 <CheckCircle2 className="w-4 h-4" />
                 Active Routine
               </div>
             )}
          </div>
          
          <div className="z-10">
            <button 
              onClick={saveRoutine}
              disabled={!editorState.name}
              className="text-indigo-600 font-bold disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </header>

        <div className="space-y-8 pb-12">
          {/* Basic Information */}
          <section className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Basic Information</h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Routine Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Weekly Training Program"
                  value={editorState.name}
                  onChange={(e) => setEditorState({...editorState, name: e.target.value})}
                  className="w-full text-base text-gray-900 placeholder-gray-400 outline-none border border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 transition-colors bg-white"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Description</label>
                <textarea 
                  placeholder="Optional description..."
                  value={editorState.description}
                  onChange={(e) => setEditorState({...editorState, description: e.target.value})}
                  className="w-full text-base text-gray-900 placeholder-gray-400 outline-none border border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 transition-colors h-24 resize-none bg-white"
                />
              </div>
            </div>
          </section>

          {/* Cycle Length */}
          <section className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="mb-6">
               <h3 className="text-lg font-bold text-gray-900">Cycle Length</h3>
               <p className="text-gray-500 text-sm mt-1">How many days in your routine cycle?</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {[...Array(14)].map((_, i) => {
                const dayNum = i + 1;
                const isSelected = editorState.cycleLength === dayNum;
                return (
                  <button
                    key={dayNum}
                    onClick={() => setEditorState({...editorState, cycleLength: dayNum})}
                    className={`
                      w-12 h-12 rounded-xl font-bold text-sm transition-all
                      ${isSelected 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'bg-gray-50 text-gray-900 hover:bg-gray-100'}
                    `}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Schedule Workouts */}
          <section className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Schedule Workouts</h3>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">
                {Object.keys(editorState.schedule).length} / {editorState.cycleLength} days
              </span>
            </div>

            <div className="space-y-3">
              {[...Array(editorState.cycleLength)].map((_, idx) => {
                 const workoutId = editorState.schedule[idx];
                 const workout = workouts.find(w => w.id === workoutId);
                 const dayName = getDayName(idx, editorState.cycleLength);

                 return (
                   <div 
                     key={idx} 
                     className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:border-gray-200 transition-colors"
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
                         <CalendarDays className="w-5 h-5" />
                       </div>
                       <div>
                         <p className="text-gray-900 font-bold">{dayName}</p>
                         <p className={`text-sm ${workout ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
                           {workout ? workout.name : 'Rest day'}
                         </p>
                       </div>
                     </div>

                     <div className="flex items-center gap-2">
                       {workout && (
                         <button 
                           onClick={(e) => clearDay(idx, e)}
                           className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                         >
                           <X className="w-5 h-5" />
                         </button>
                       )}
                       <button
                         onClick={() => setActiveDayIdx(idx)}
                         className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                       >
                         {workout ? <><Dumbbell className="w-4 h-4"/> Change</> : <><Plus className="w-4 h-4"/> Add</>}
                       </button>
                     </div>
                   </div>
                 );
              })}
            </div>
          </section>

          {/* Delete Button (Moved to Bottom) */}
          {editingRoutineId && (
            <div className="flex justify-center mt-8">
              <button 
                onClick={deleteRoutine}
                className="flex items-center gap-2 text-red-500 hover:text-red-600 font-bold hover:bg-red-50 px-6 py-3 rounded-xl transition-all w-full md:w-auto justify-center"
              >
                <Trash2 className="w-5 h-5" />
                Delete Routine
              </button>
            </div>
          )}
        </div>

        {/* Workout Selector Modal */}
        {activeDayIdx !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Select Workout</h3>
                <button onClick={() => setActiveDayIdx(null)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                <button 
                  onClick={() => assignWorkout('')} // Rest Day
                  className="w-full p-4 text-center font-bold text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 border border-transparent border-dashed hover:border-gray-200"
                >
                  Rest Day
                </button>
                {workouts.map(w => (
                  <button
                    key={w.id}
                    onClick={() => assignWorkout(w.id)}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-700 transition-colors group text-left"
                  >
                    <span className="font-bold text-gray-900 group-hover:text-indigo-700">{w.name}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide group-hover:text-indigo-400">{w.exercises.length} Ex</span>
                  </button>
                ))}
                {workouts.length === 0 && (
                   <p className="text-center text-gray-400 text-sm py-4">No workouts created yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const filteredRoutines = routines.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Routines</h2>
          <p className="text-gray-500 mt-2 text-lg font-medium">Build and manage your workout programs</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Create Routine
        </button>
      </header>

      {/* Search Bar */}
      <div className="mb-12">
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <Search className="w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search routines..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full outline-none text-gray-900 font-medium placeholder-gray-400 bg-transparent"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredRoutines.map((routine) => (
          <div 
            key={routine.id} 
            onClick={() => startEditing(routine)}
            className="bg-white p-6 rounded-[1.5rem] border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${routine.active ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}>
                <Dumbbell className="w-8 h-8" />
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{routine.name}</h3>
                
                <div className="flex items-center gap-6 text-sm text-gray-500 font-medium">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{routine.cycleLength} days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    <span>{Object.keys(routine.schedule).length} workouts</span>
                  </div>
                  {routine.active && (
                    <span className="text-emerald-600 font-bold text-xs uppercase bg-emerald-50 px-2 py-1 rounded-lg">Active</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-2 text-gray-300 group-hover:text-indigo-500 transition-colors">
              <ChevronRight className="w-6 h-6" />
            </div>
          </div>
        ))}
        
        {/* Empty State */}
        {routines.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-[2.5rem]">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-4">
              <List className="w-8 h-8" />
            </div>
            <h3 className="text-gray-900 font-bold mb-2">No Routines Found</h3>
            <p className="text-gray-400">Create your first routine to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoutinesPage;
