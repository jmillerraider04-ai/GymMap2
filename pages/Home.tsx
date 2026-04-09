
import React from 'react';
import { Dumbbell, List, ClipboardList, ChevronRight, Activity, Cpu } from 'lucide-react';
import { Workout, Routine } from '../types';

interface HomeProps {
  onNavigate: (page: any) => void;
  workouts: Workout[];
  routines: Routine[];
  onStartWorkout: (workoutId: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const options = [
    {
      id: 'DASHBOARD',
      title: 'Dashboard',
      icon: <Activity className="w-6 h-6" />,
      color: 'bg-white',
      textColor: 'text-gray-900'
    },
    {
      id: 'BIO_MODEL',
      title: 'Biomechanics',
      icon: <Cpu className="w-6 h-6" />,
      color: 'bg-white',
      textColor: 'text-gray-900',
    },
    {
      id: 'WORKOUTS',
      title: 'Workouts',
      icon: <Dumbbell className="w-6 h-6" />,
      color: 'bg-indigo-600',
      textColor: 'text-white'
    },
    {
      id: 'EXERCISES',
      title: 'Exercises',
      icon: <ClipboardList className="w-6 h-6" />,
      color: 'bg-white',
      textColor: 'text-gray-900',
    },
    {
      id: 'ROUTINES',
      title: 'Routines',
      icon: <List className="w-6 h-6" />,
      color: 'bg-white',
      textColor: 'text-gray-900',
    }
  ];

  return (
    <div className="max-w-md mx-auto px-6 py-12 flex flex-col min-h-[80vh] justify-center animate-in fade-in duration-500">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">GymAp</h1>
        <p className="text-gray-400 font-medium">Focus on your training</p>
      </header>

      <div className="space-y-4">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onNavigate(option.id)}
            className={`
              w-full flex items-center justify-between p-6 rounded-[2rem] transition-all duration-300
              border border-gray-100 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] group
              ${option.color === 'bg-indigo-600' ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white text-gray-900'}
            `}
          >
            <div className="flex items-center gap-6">
              <div className={`
                p-4 rounded-2xl transition-colors
                ${option.color === 'bg-indigo-600' ? 'bg-white/20 text-white' : 'bg-gray-50 text-indigo-600 group-hover:bg-indigo-50'}
              `}>
                {option.icon}
              </div>
              <span className="text-xl font-bold tracking-tight">{option.title}</span>
            </div>
            <ChevronRight className={`w-6 h-6 transition-transform group-hover:translate-x-1 ${option.color === 'bg-indigo-600' ? 'text-white/70' : 'text-gray-300'}`} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default Home;
