
import React, { useMemo, useState } from 'react';
import { Activity, Calendar, Target, MapPin, Dumbbell, Play, Search, Map, X, Clock, ChevronRight } from 'lucide-react';
import StatCard from '../components/StatCard';
import QuickAction from '../components/QuickAction';
import { Workout, Routine } from '../types';
import { calculateWorkoutDuration } from './WorkoutsPage';

interface DashboardProps {
  workouts: Workout[];
  routines: Routine[];
  onStartWorkout: (workoutId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ workouts, routines, onStartWorkout }) => {
  const [isWorkoutSelectorOpen, setIsWorkoutSelectorOpen] = useState(false);
  const activeRoutine = routines.find(r => r.active);
  
  const todaysWorkout = useMemo(() => {
    if (!activeRoutine) return null;
    const start = new Date(activeRoutine.startDate).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    // Calculate current day in cycle (0-based)
    const currentDayIdx = diffDays % activeRoutine.cycleLength;
    const workoutId = activeRoutine.schedule[currentDayIdx];
    return workouts.find(w => w.id === workoutId);
  }, [activeRoutine, workouts]);

  const stats = [
    {
      label: 'Total Workouts',
      value: '0',
      subtext: '',
      icon: <Activity className="w-6 h-6" />,
      color: 'purple' as const
    },
    {
      label: 'This Week',
      value: '0',
      subtext: 'workouts completed',
      icon: <Calendar className="w-6 h-6" />,
      color: 'white' as const
    },
    {
      label: 'My Routines',
      value: routines.length,
      subtext: 'custom programs',
      icon: <Target className="w-6 h-6" />,
      color: 'white' as const
    },
    {
      label: 'Gyms Available',
      value: '1',
      subtext: 'with detailed equipment',
      icon: <MapPin className="w-6 h-6" />,
      color: 'white' as const
    }
  ];

  const quickActions = [
    {
      label: 'Start New Workout',
      icon: <Play className="w-4 h-4" />,
      primary: true,
      onClick: () => setIsWorkoutSelectorOpen(true)
    },
    {
      label: 'Browse Routines',
      icon: <Target className="w-4 h-4" />,
      onClick: () => console.log('Browse Routines')
    },
    {
      label: 'Find Gyms Near You',
      icon: <Map className="w-4 h-4" />,
      onClick: () => console.log('Find Gyms')
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Welcome back</h1>
        <p className="text-gray-500 mt-2 text-lg">Track your fitness journey with precision</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col h-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Quick Actions</h2>
          <div className="space-y-4">
            {quickActions.map((action, idx) => (
              <QuickAction key={idx} {...action} />
            ))}
          </div>
        </div>

        {/* Up Next / Recent Workouts */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900">Up Next</h2>
            {activeRoutine && (
               <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wide">
                 {activeRoutine.name}
               </span>
            )}
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            {todaysWorkout ? (
              <div className="w-full">
                <div className="bg-indigo-600 text-white p-8 rounded-[2rem] shadow-lg shadow-indigo-200 text-left mb-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-white/20 transition-all"/>
                  <p className="text-indigo-200 font-bold text-xs uppercase tracking-widest mb-2">Recommended for Today</p>
                  <h3 className="text-3xl font-black mb-4">{todaysWorkout.name}</h3>
                  <div className="flex items-center gap-4 text-sm font-medium opacity-80 mb-8">
                     <span className="flex items-center gap-2"><Dumbbell className="w-4 h-4"/> {todaysWorkout.exercises.length} Exercises</span>
                     <span className="flex items-center gap-2"><Clock className="w-4 h-4"/> {calculateWorkoutDuration(todaysWorkout)} min</span>
                  </div>
                  <button 
                    onClick={() => onStartWorkout(todaysWorkout.id)}
                    className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-transform"
                  >
                    Start Now
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-gray-50 p-6 rounded-full mb-6">
                  <Dumbbell className="w-12 h-12 text-gray-300" />
                </div>
                <p className="text-gray-400 font-medium text-lg mb-8">
                  {activeRoutine ? "Rest Day" : "No active routine found"}
                </p>
                <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                  {activeRoutine ? "Browse Library" : "Create Routine"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Workout Selection Modal */}
      {isWorkoutSelectorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsWorkoutSelectorOpen(false)}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Select Workout</h2>
                <p className="text-gray-500 text-sm font-medium">Choose a workout to start your session</p>
              </div>
              <button 
                onClick={() => setIsWorkoutSelectorOpen(false)}
                className="p-3 hover:bg-white rounded-2xl transition-colors text-gray-400 hover:text-gray-600 shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
              {workouts.length > 0 ? (
                workouts.map(workout => (
                  <button
                    key={workout.id}
                    onClick={() => {
                      onStartWorkout(workout.id);
                      setIsWorkoutSelectorOpen(false);
                    }}
                    className="w-full group flex items-center justify-between p-6 rounded-3xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left"
                  >
                    <div className="flex items-center gap-6">
                      <div className="bg-indigo-100 text-indigo-600 p-4 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Dumbbell className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 mb-1">{workout.name}</h4>
                        <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                          <span>{workout.exercises.length} Exercises</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {calculateWorkoutDuration(workout)} min
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Dumbbell className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Workouts Found</h3>
                  <p className="text-gray-500 mb-8 max-w-xs mx-auto">Create your first workout in the Workouts tab to get started.</p>
                </div>
              )}
            </div>
            
            <div className="p-8 bg-gray-50/50 border-t border-gray-100">
              <p className="text-center text-gray-400 text-sm font-medium">
                Tip: You can create custom routines to automate your schedule.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
