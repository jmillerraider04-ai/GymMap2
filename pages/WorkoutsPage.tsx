import React, { useState } from 'react';
import { Play, Clock, Dumbbell, History, Plus, X, Search, ChevronDown, Check, ChevronUp, GripVertical, Settings2, GripHorizontal, User, Trash2 } from 'lucide-react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Workout, WorkoutExercise } from '../types';
import { MOCK_EXERCISES } from '../data/exerciseData';
import NumberInput from '../components/NumberInput';

interface WorkoutsPageProps {
  workouts: Workout[];
  setWorkouts: (workouts: Workout[]) => void;
  onStartWorkout: (workoutId: string) => void;
}

const PRESET_TAGS = [
  'Push', 'Pull', 'Upper', 'Lower', 'Anterior', 'Posterior', 
  'Arms', 'Shoulders + Arms', 'Torso', 'Limbs', 'Chest', 'Back', 'Full Body'
];

export const calculateWorkoutDuration = (workout: Partial<Workout>) => {
  if (!workout.exercises) return 0;
  
  let totalSeconds = 0;
  const restTime = parseInt(workout.restTime || '90') || 0;
  const totalSets = workout.exercises.reduce((sum, ex) => {
    const sets = parseInt(ex.target.sets) || 0;
    return sum + (ex.unilateral ? sets * 2 : sets);
  }, 0);

  workout.exercises.forEach(ex => {
    let sets = parseInt(ex.target.sets) || 0;
    if (ex.unilateral) sets *= 2;
    if (sets === 0) return;

    // Parse reps
    let reps = 10;
    const repMatch = ex.target.repRange.match(/(\d+)(?:\s*-\s*(\d+))?/);
    if (repMatch) {
      const min = parseInt(repMatch[1]);
      const max = repMatch[2] ? parseInt(repMatch[2]) : min;
      reps = (min + max) / 2;
    }

    // Formula: 15s base + diminishing returns per rep
    // Starts at 3s/rep, drops to 1s/rep at 20 reps
    let setDuration = 15;
    for (let i = 1; i <= Math.floor(reps); i++) {
      const repTime = Math.max(1, 3 - (i - 1) * (2 / 19));
      setDuration += repTime;
    }
    const fractionalPart = reps % 1;
    if (fractionalPart > 0) {
      const repTime = Math.max(1, 3 - Math.floor(reps) * (2 / 19));
      setDuration += repTime * fractionalPart;
    }

    totalSeconds += (sets * setDuration);
  });

  if (totalSets > 1) {
    totalSeconds += (totalSets - 1) * restTime;
  }

  return Math.ceil(totalSeconds / 60);
};

interface SortableExerciseItemProps {
  exercise: WorkoutExercise;
  idx: number;
  onRemove: (idx: number) => void;
  onUpdateTarget: (idx: number, field: keyof WorkoutExercise['target'], value: string) => void;
  onUpdateExercise: (idx: number, updates: Partial<WorkoutExercise>) => void;
  onSwapExercise: (idx: number) => void;
}

const SortableExerciseItem: React.FC<SortableExerciseItemProps> = ({ 
  exercise, 
  idx, 
  onRemove, 
  onUpdateTarget,
  onUpdateExercise,
  onSwapExercise
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: exercise.instanceId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all group/item ${isDragging ? 'shadow-xl ring-2 ring-indigo-500/20' : ''}`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <button 
            {...attributes} 
            {...listeners}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-indigo-600 transition-all cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <div className="cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => onSwapExercise(idx)}>
            <h3 className="font-bold text-gray-900 text-lg">{exercise.name}</h3>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{exercise.category}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => onUpdateExercise(idx, { unilateral: !exercise.unilateral, unilateralOrder: exercise.unilateralOrder || 'lr' })}
              className={`p-2 rounded-lg transition-all flex items-center gap-2 ${exercise.unilateral ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-200'}`}
              title="Toggle Unilateral Tracking"
            >
              <div className="relative w-4 h-4 overflow-hidden">
                <div className="absolute inset-0 w-[50%] overflow-hidden">
                  <User className="w-4 h-4" />
                </div>
              </div>
            </button>
            {exercise.unilateral && (
              <div className="flex gap-1 ml-1 pr-1">
                <button
                  onClick={() => onUpdateExercise(idx, { unilateralOrder: 'lr' })}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${exercise.unilateralOrder === 'lr' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                >
                  L→R
                </button>
                <button
                  onClick={() => onUpdateExercise(idx, { unilateralOrder: 'rl' })}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${exercise.unilateralOrder === 'rl' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                >
                  R→L
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">Sets</label>
          <div className="h-12">
            <NumberInput 
              value={exercise.target.sets}
              onChange={(val) => onUpdateTarget(idx, 'sets', val)}
              min={1}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">Rep Range</label>
          <input 
            type="text" 
            value={exercise.target.repRange}
            onChange={(e) => onUpdateTarget(idx, 'repRange', e.target.value)}
            className="w-full h-12 bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">RIR</label>
          <div className="h-12">
             <NumberInput 
              value={exercise.target.rir || ''}
              onChange={(val) => onUpdateTarget(idx, 'rir', val)}
              placeholder="0-5"
              min={0}
              max={10}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">RPE</label>
          <div className="h-12">
            <NumberInput 
              value={exercise.target.rpe || ''}
              onChange={(val) => onUpdateTarget(idx, 'rpe', val)}
              placeholder="1-10"
              min={1}
              max={10}
            />
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
        <button 
          onClick={() => onRemove(idx)} 
          className="text-red-500 hover:text-red-600 text-sm font-bold uppercase tracking-wider transition-all px-4 py-2 rounded-xl hover:bg-red-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
};

const WorkoutsPage: React.FC<WorkoutsPageProps> = ({ workouts, setWorkouts, onStartWorkout }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [workoutSearch, setWorkoutSearch] = useState('');
  const [editorState, setEditorState] = useState<{
    name: string;
    exercises: WorkoutExercise[];
    tag: string;
    restTime: string;
  }>({ name: '', exercises: [], tag: '', restTime: '90' });
  
  // State to store the workout configuration before a preset was selected
  const [prePresetState, setPrePresetState] = useState<{
    name: string;
    exercises: WorkoutExercise[];
    restTime: string;
  } | null>(null);

  const [exerciseSearch, setExerciseSearch] = useState('');
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [swappingExerciseIdx, setSwappingExerciseIdx] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = editorState.exercises.findIndex((ex) => ex.instanceId === active.id);
      const newIndex = editorState.exercises.findIndex((ex) => ex.instanceId === over.id);

      setEditorState((prev) => ({
        ...prev,
        exercises: arrayMove(prev.exercises, oldIndex, newIndex),
      }));
    }
  };

  const getExercisesForPreset = (tag: string): WorkoutExercise[] => {
    const ids: string[] = [];
    const t = tag.toLowerCase();
    
    if (t === 'push') ids.push('bench-barbell', 'ohp-barbell', 'incline-press-dumbbell', 'lateral-raise-dumbbell', 'skullcrusher-barbell');
    else if (t === 'pull') ids.push('deadlift-generic', 'row-barbell', 'row-dumbbell', 'curl-barbell', 'hammer-curl-dumbbell');
    else if (t === 'upper') ids.push('bench-barbell', 'row-barbell', 'ohp-barbell', 'row-machine');
    else if (t === 'lower') ids.push('squat-barbell', 'rdl-barbell', 'lunge-dumbbell', 'squat-dumbbell');
    else if (t === 'anterior') ids.push('squat-front-barbell', 'bench-barbell', 'ohp-barbell', 'bss-dumbbell');
    else if (t === 'posterior') ids.push('deadlift-generic', 'row-barbell', 'hip-thrust-barbell', 'rear-delt-fly-dumbbell');
    else if (t === 'arms') ids.push('curl-barbell', 'skullcrusher-barbell', 'hammer-curl-dumbbell', 'triceps-extension-overhead-dumbbell');
    else if (t === 'shoulders + arms') ids.push('ohp-barbell', 'lateral-raise-dumbbell', 'curl-barbell', 'triceps-extension-overhead-dumbbell');
    else if (t === 'torso') ids.push('bench-barbell', 'row-barbell', 'ohp-barbell', 'deadlift-generic');
    else if (t === 'limbs') ids.push('squat-barbell', 'curl-barbell', 'lunge-dumbbell', 'skullcrusher-barbell');
    else if (t === 'chest') ids.push('bench-barbell', 'incline-press-dumbbell', 'fly-dumbbell');
    else if (t === 'back') ids.push('deadlift-generic', 'row-barbell', 'row-dumbbell', 'shrug-dumbbell');
    else if (t === 'full body') ids.push('squat-barbell', 'bench-barbell', 'row-barbell', 'ohp-barbell', 'rdl-barbell', 'curl-barbell');
    
    // Fallback if no specific mapping found, just pick 3 random exercises (shouldn't happen with current tags)
    if (ids.length === 0) {
      return MOCK_EXERCISES.slice(0, 3).map(ex => ({
        ...ex,
        instanceId: Date.now().toString() + Math.random(),
        target: { sets: '3', repRange: '8-12', rir: '', rpe: '' }
      }));
    }

    return ids.map(id => {
      const ex = MOCK_EXERCISES.find(e => e.id === id);
      if (!ex) return null;
      return {
        ...ex,
        instanceId: Date.now().toString() + Math.random(),
        target: { sets: '3', repRange: '8-12', rir: '', rpe: '' }
      };
    }).filter(e => e !== null) as WorkoutExercise[];
  };

  const startCreating = (preset?: string) => {
    setPrePresetState(null);
    setEditingWorkoutId(null);
    setEditorState({
      name: preset ? `${preset} Workout` : '',
      exercises: preset ? getExercisesForPreset(preset) : [],
      tag: preset || '',
      restTime: '90'
    });
    setIsCreating(true);
    setSwappingExerciseIdx(null);
  };

  const startEditing = (workout: Workout) => {
    setPrePresetState(null);
    setEditingWorkoutId(workout.id);
    setEditorState({
      name: workout.name,
      exercises: workout.exercises,
      tag: workout.tags?.[0] || '',
      restTime: workout.restTime || '90'
    });
    setIsCreating(true);
    setSwappingExerciseIdx(null);
  };

  const togglePreset = (tag: string) => {
    if (editorState.tag === tag) {
      // Deselecting: Revert to pre-preset state
      if (prePresetState) {
        setEditorState(prev => ({
          ...prev,
          name: prePresetState.name,
          exercises: prePresetState.exercises,
          restTime: prePresetState.restTime,
          tag: ''
        }));
      } else {
        // Fallback (shouldn't happen if logic is correct)
        setEditorState(prev => ({ ...prev, tag: '' }));
      }
      setPrePresetState(null);
    } else {
      // Selecting new preset
      
      // If we are NOT currently in a preset, save the current state
      if (!editorState.tag) {
        setPrePresetState({
          name: editorState.name,
          exercises: editorState.exercises,
          restTime: editorState.restTime
        });
      }
      // If we ARE already in a preset, we don't update prePresetState
      // because we want to revert to the ORIGINAL user state, not the previous preset state.

      const newExercises = getExercisesForPreset(tag);
      setEditorState(prev => ({
        ...prev,
        name: `${tag} Workout`,
        exercises: newExercises,
        tag: tag
      }));
    }
  };

  const addExercise = (exerciseId: string) => {
    const exercise = MOCK_EXERCISES.find(e => e.id === exerciseId);
    if (!exercise) return;

    if (swappingExerciseIdx !== null) {
      const newExercises = [...editorState.exercises];
      newExercises[swappingExerciseIdx] = {
        ...exercise,
        instanceId: newExercises[swappingExerciseIdx].instanceId,
        target: { ...newExercises[swappingExerciseIdx].target }
      };
      setEditorState(prev => ({ ...prev, exercises: newExercises }));
      setSwappingExerciseIdx(null);
      setIsAddingExercise(false);
      setExerciseSearch('');
      return;
    }

    const newExercise: WorkoutExercise = {
      ...exercise,
      instanceId: Date.now().toString(),
      target: {
        sets: '3',
        repRange: '8-12',
        rir: '',
        rpe: ''
      }
    };

    setEditorState(prev => ({
      ...prev,
      exercises: [...prev.exercises, newExercise]
    }));
    setIsAddingExercise(false);
    setExerciseSearch('');
  };

  const updateExerciseTarget = (idx: number, field: keyof WorkoutExercise['target'], value: string) => {
    const newExercises = [...editorState.exercises];
    newExercises[idx] = {
      ...newExercises[idx],
      target: {
        ...newExercises[idx].target,
        [field]: value
      }
    };
    setEditorState(prev => ({ ...prev, exercises: newExercises }));
  };

  const updateExercise = (idx: number, updates: Partial<WorkoutExercise>) => {
    const newExercises = [...editorState.exercises];
    newExercises[idx] = {
      ...newExercises[idx],
      ...updates
    };
    setEditorState(prev => ({ ...prev, exercises: newExercises }));
  };

  const removeExercise = (idx: number) => {
    setEditorState(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== idx)
    }));
  };

  const bulkUpdate = (field: keyof WorkoutExercise['target'], value: string) => {
    if (!value) return;
    const newExercises = editorState.exercises.map(ex => ({
      ...ex,
      target: {
        ...ex.target,
        [field]: value
      }
    }));
    setEditorState(prev => ({ ...prev, exercises: newExercises }));
  };

  const saveWorkout = () => {
    if (!editorState.name) return;
    
    if (editingWorkoutId) {
      const updatedWorkouts = workouts.map(w => 
        w.id === editingWorkoutId 
          ? { ...w, name: editorState.name, exercises: editorState.exercises, tags: editorState.tag ? [editorState.tag] : [], restTime: editorState.restTime }
          : w
      );
      setWorkouts(updatedWorkouts);
    } else {
      const newWorkout: Workout = {
        id: Date.now().toString(),
        name: editorState.name,
        exercises: editorState.exercises,
        tags: editorState.tag ? [editorState.tag] : [],
        restTime: editorState.restTime
      };
      setWorkouts([...workouts, newWorkout]);
    }
    setIsCreating(false);
    setEditingWorkoutId(null);
  };

  if (isCreating) {
    const filteredExercises = MOCK_EXERCISES.filter(e => 
      e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
      e.category.toLowerCase().includes(exerciseSearch.toLowerCase())
    );

    const totalSets = editorState.exercises.reduce((sum, ex) => sum + (parseInt(ex.target.sets) || 0), 0);
    const estimatedDuration = calculateWorkoutDuration({
      exercises: editorState.exercises,
      restTime: editorState.restTime
    });

    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="flex justify-between items-center mb-8">
          <button 
            onClick={() => setIsCreating(false)}
            className="text-gray-500 hover:text-gray-900 font-bold"
          >
            Cancel
          </button>
          <h2 className="text-2xl font-black uppercase tracking-tight">{editingWorkoutId ? 'Edit Workout' : 'New Workout'}</h2>
          <div className="w-16"></div>
        </header>

        <div className="space-y-8">
          {/* Name Input Section */}
          <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <label className="text-sm font-bold text-gray-900 mb-2 block">Workout Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Heavy Upper Body"
                  value={editorState.name}
                  onChange={(e) => setEditorState({...editorState, name: e.target.value})}
                  className="w-full text-lg font-medium text-gray-900 placeholder-gray-400 outline-none border border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 transition-colors bg-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-900 mb-2 block">Avg. Rest (sec)</label>
                <NumberInput 
                  value={editorState.restTime}
                  onChange={(val) => setEditorState({...editorState, restTime: val})}
                  min={0}
                  max={600}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {PRESET_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => togglePreset(tag)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors ${editorState.tag === tag ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Exercises Header */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end px-2">
              <h3 className="text-xl font-bold text-gray-900">Exercises</h3>
              <div className="flex flex-wrap gap-2 justify-end">
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {editorState.exercises.length} exercises
                </span>
                <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {totalSets} total sets
                </span>
                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ~{estimatedDuration} min
                </span>
              </div>
            </div>

            {/* Bulk Update Section */}
            {editorState.exercises.length > 1 && (
              <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/50">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Bulk Update All Exercises</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-indigo-700/60 mb-1.5 block uppercase">Sets</label>
                    <NumberInput 
                      value=""
                      onChange={(val) => bulkUpdate('sets', val)}
                      placeholder="All"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-indigo-700/60 mb-1.5 block uppercase">Rep Range</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 8-12"
                      className="w-full h-10 bg-white border border-indigo-100 rounded-lg px-3 text-sm text-gray-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                      onBlur={(e) => bulkUpdate('repRange', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && bulkUpdate('repRange', (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-indigo-700/60 mb-1.5 block uppercase">RIR</label>
                    <NumberInput 
                      value=""
                      onChange={(val) => bulkUpdate('rir', val)}
                      placeholder="All"
                      min={0}
                      max={10}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-indigo-700/60 mb-1.5 block uppercase">RPE</label>
                    <NumberInput 
                      value=""
                      onChange={(val) => bulkUpdate('rpe', val)}
                      placeholder="All"
                      min={1}
                      max={10}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Exercises List */}
          <div className="space-y-4">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={editorState.exercises.map(ex => ex.instanceId)}
                strategy={verticalListSortingStrategy}
              >
                {editorState.exercises.map((exercise, idx) => (
                  <SortableExerciseItem 
                    key={exercise.instanceId}
                    exercise={exercise}
                    idx={idx}
                    onRemove={removeExercise}
                    onUpdateTarget={updateExerciseTarget}
                    onUpdateExercise={updateExercise}
                    onSwapExercise={(idx) => {
                      setSwappingExerciseIdx(idx);
                      setIsAddingExercise(true);
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Add Exercise Button/Modal */}
            {(isAddingExercise || swappingExerciseIdx !== null) ? (
              <div className="bg-white p-6 rounded-[2rem] border border-indigo-100 shadow-lg animate-in fade-in zoom-in-95 mt-4">
                 <div className="flex items-center justify-between mb-4">
                   <h4 className="text-sm font-bold text-gray-900 uppercase tracking-tight">
                     {swappingExerciseIdx !== null ? 'Swap Exercise' : 'Add Exercise'}
                   </h4>
                   <button onClick={() => { setIsAddingExercise(false); setSwappingExerciseIdx(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                 </div>
                 <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-xl mb-4">
                   <Search className="w-5 h-5 text-gray-400" />
                   <input 
                    type="text" 
                    placeholder="Search exercises..." 
                    className="bg-transparent outline-none w-full font-medium text-gray-900"
                    autoFocus
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                   />
                 </div>
                 <div className="max-h-60 overflow-y-auto space-y-2">
                   {filteredExercises.map(ex => (
                     <button 
                      key={ex.id}
                      onClick={() => addExercise(ex.id)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 font-medium text-gray-700 transition-colors flex justify-between items-center"
                     >
                       <span className="text-gray-900">{ex.name}</span>
                       <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{ex.category}</span>
                     </button>
                   ))}
                 </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAddingExercise(true)}
                className="w-full py-4 rounded-[1.5rem] border-2 border-dashed border-gray-200 text-gray-900 font-bold hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <Plus className="w-5 h-5" /> Add Exercise
              </button>
            )}
          </div>
        </div>

        {/* Save Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 lg:static lg:bg-transparent lg:border-0 lg:p-0 lg:mt-12">
          <button 
            onClick={saveWorkout}
            disabled={!editorState.name}
            className="w-full bg-[#86efac] hover:bg-[#4ade80] text-emerald-900 py-4 rounded-xl font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            Save Workout
          </button>
        </div>
        {/* Spacer for fixed bottom bar on mobile */}
        <div className="h-24 lg:hidden"></div>
      </div>
    );
  }

  const filteredWorkouts = workouts.filter(w => w.name.toLowerCase().includes(workoutSearch.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Workouts</h2>
          <p className="text-gray-500 mt-2 text-lg font-medium">Record and analyze your sessions</p>
        </div>
        <button 
          onClick={() => startCreating()}
          className="bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      {/* Search Bar (Replaces Presets) */}
      <div className="mb-12">
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <Search className="w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search workouts..." 
            value={workoutSearch}
            onChange={(e) => setWorkoutSearch(e.target.value)}
            className="w-full outline-none text-gray-900 font-medium placeholder-gray-400 bg-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {filteredWorkouts.map(workout => (
           <div key={workout.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
             <div className="flex justify-between items-start mb-6">
                <div className="flex gap-2">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Dumbbell className="w-6 h-6" />
                  </div>
                  <button 
                    onClick={() => startEditing(workout)}
                    className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    <Settings2 className="w-6 h-6" />
                  </button>
                </div>
                {workout.tags?.[0] && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                    {workout.tags[0]}
                  </span>
                )}
             </div>
             <h3 className="text-xl font-bold text-gray-900 mb-2">{workout.name}</h3>
             <div className="flex items-center gap-4 mb-6">
               <p className="text-gray-500 text-sm font-medium">{workout.exercises.length} Exercises</p>
               {workout.restTime && (
                 <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                   <Clock className="w-3 h-3" />
                   <span>Est. {calculateWorkoutDuration(workout)}m</span>
                 </div>
               )}
             </div>
             <div className="space-y-3">
               {workout.exercises.slice(0, 3).map((ex, i) => (
                 <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                   <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                   <span className="truncate">{ex.name}</span>
                 </div>
               ))}
               {workout.exercises.length > 3 && (
                 <p className="text-xs text-gray-400 font-bold pl-4">+{workout.exercises.length - 3} more</p>
               )}
             </div>
             <button 
               onClick={() => onStartWorkout(workout.id)}
               className="w-full mt-8 bg-gray-50 text-indigo-600 py-3 rounded-xl font-bold text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors"
             >
               Start Workout
             </button>
           </div>
        ))}
        
        {/* Empty State if no workouts */}
        {workouts.length === 0 && (
          <div className="lg:col-span-3 py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-100 rounded-[3rem]">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
              <Dumbbell className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Workouts Created</h3>
            <p className="text-gray-400 max-w-sm">Create your first custom workout to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutsPage;