
import React, { useState } from 'react';
import { 
  Dumbbell, 
  ClipboardList, 
  List, 
  Menu, 
  X, 
  ChevronRight,
  Search,
  Home as HomeIcon,
  Activity,
  User,
  Cpu
} from 'lucide-react';
import ExercisesPage from './pages/ExercisesPage';
import WorkoutsPage from './pages/WorkoutsPage';
import RoutinesPage from './pages/RoutinesPage';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ActiveWorkoutPage from './pages/ActiveWorkoutPage';
import BioModelPage from './pages/BioModelPage';
import { KnowledgeLevel, Workout, Routine, UnitSystem } from './types';

enum Page {
  HOME = 'HOME',
  DASHBOARD = 'DASHBOARD',
  WORKOUTS = 'WORKOUTS',
  EXERCISES = 'EXERCISES',
  ROUTINES = 'ROUTINES',
  PROFILE = 'PROFILE',
  ACTIVE_WORKOUT = 'ACTIVE_WORKOUT',
  BIO_MODEL = 'BIO_MODEL'
}

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>(Page.HOME);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [knowledgeLevel, setKnowledgeLevel] = useState<KnowledgeLevel>('advanced');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('lbs');

  // Shared Data State
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  
  // Active Session State
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);

  const startWorkout = (workoutId: string) => {
    setActiveWorkoutId(workoutId);
    setActivePage(Page.ACTIVE_WORKOUT);
  };

  const handleFinishWorkout = () => {
    // Logic to advance the routine if the active workout is part of it
    const activeRoutineIndex = routines.findIndex(r => r.active);
    
    if (activeRoutineIndex !== -1 && activeWorkoutId) {
      const updatedRoutines = [...routines];
      const routine = updatedRoutines[activeRoutineIndex];
      
      // Advance day index, wrapping around cycle length
      routine.currentDay = (routine.currentDay + 1) % routine.cycleLength;
      
      setRoutines(updatedRoutines);
    }
    
    setActiveWorkoutId(null);
    setActivePage(Page.DASHBOARD);
  };

  const navItems = [
    { id: Page.HOME, label: 'Home', icon: <HomeIcon className="w-5 h-5" /> },
    { id: Page.DASHBOARD, label: 'Dashboard', icon: <Activity className="w-5 h-5" /> },
    { id: Page.BIO_MODEL, label: 'Biomechanics', icon: <Cpu className="w-5 h-5" /> },
    { id: Page.WORKOUTS, label: 'Workouts', icon: <Dumbbell className="w-5 h-5" /> },
    { id: Page.EXERCISES, label: 'Exercises', icon: <ClipboardList className="w-5 h-5" /> },
    { id: Page.ROUTINES, label: 'Routines', icon: <List className="w-5 h-5" /> },
    { id: Page.PROFILE, label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  const renderContent = () => {
    switch (activePage) {
      case Page.HOME:
        return (
          <Home 
            onNavigate={(pageId) => setActivePage(pageId as Page)} 
            workouts={workouts}
            routines={routines}
            onStartWorkout={startWorkout}
          />
        );
      case Page.DASHBOARD:
        return <Dashboard workouts={workouts} routines={routines} onStartWorkout={startWorkout} />;
      case Page.WORKOUTS:
        return <WorkoutsPage workouts={workouts} setWorkouts={setWorkouts} onStartWorkout={startWorkout} />;
      case Page.ROUTINES:
        return <RoutinesPage routines={routines} setRoutines={setRoutines} workouts={workouts} />;
      case Page.EXERCISES:
        return <ExercisesPage knowledgeLevel={knowledgeLevel} />;
      case Page.BIO_MODEL:
        return <BioModelPage />;
      case Page.PROFILE:
        return (
          <Profile 
            knowledgeLevel={knowledgeLevel} 
            setKnowledgeLevel={setKnowledgeLevel}
            unitSystem={unitSystem}
            setUnitSystem={setUnitSystem}
          />
        );
      case Page.ACTIVE_WORKOUT:
        const workout = workouts.find(w => w.id === activeWorkoutId);
        if (!workout) return <Home onNavigate={(pageId) => setActivePage(pageId as Page)} workouts={workouts} routines={routines} onStartWorkout={startWorkout} />;
        return (
          <ActiveWorkoutPage 
            workout={workout} 
            onFinish={handleFinishWorkout} 
            unitSystem={unitSystem}
            knowledgeLevel={knowledgeLevel}
          />
        );
      default:
        return (
          <Home 
            onNavigate={(pageId) => setActivePage(pageId as Page)} 
            workouts={workouts}
            routines={routines}
            onStartWorkout={startWorkout}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans">
      {/* Header - Hide header in active workout for immersion */}
      {activePage !== Page.ACTIVE_WORKOUT && (
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 lg:px-12 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button onClick={() => setActivePage(Page.HOME)} className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100 transition-transform hover:scale-105">
              <Dumbbell className="text-white w-5 h-5" />
            </button>
            <span className="text-xl font-bold text-gray-900 tracking-tight">GymAp</span>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-3 text-gray-400 hover:text-gray-600 transition-colors">
              <Search className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-3 hover:bg-gray-50 rounded-xl transition-colors text-gray-900"
              aria-label="Open Menu"
            >
              <Menu className="w-7 h-7" />
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>

      {/* Right-side Pop-out Menu Overlay */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* Right-side Pop-out Menu Drawer */}
      <aside 
        className={`fixed top-0 right-0 bottom-0 w-80 bg-[#0a0a0a] z-[60] shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.4, 0, 0.2, 1)] ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full p-6 pt-10">
          <div className="flex items-center justify-between mb-10 px-4">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Menu</span>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="p-2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActivePage(item.id);
                  setIsMenuOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all duration-300 group
                  ${activePage === item.id 
                    ? 'bg-indigo-600 text-white shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)]' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'}
                `}
              >
                <div className="flex items-center gap-5">
                  <span className={activePage === item.id ? 'text-white' : 'text-gray-500 group-hover:text-indigo-400 transition-colors'}>
                    {item.icon}
                  </span>
                  <span className="font-semibold text-[17px]">{item.label}</span>
                </div>
                {activePage === item.id && <ChevronRight className="w-5 h-5 opacity-70" />}
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-white/10">
            <div className="px-6 py-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
              <p className="text-xs font-bold opacity-70 mb-1">PRO ACCESS</p>
              <p className="text-sm font-bold">Unlock Advanced Analytics</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default App;
