
import React from 'react';
import { Dumbbell, ChevronRight } from 'lucide-react';
import { Exercise, KnowledgeLevel } from '../types';
import { simplifyMuscles, getActivationColor } from '../utils/translation';

interface ExerciseCardProps {
  exercise: Exercise;
  knowledgeLevel: KnowledgeLevel;
  onViewDetails: (exercise: Exercise) => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, knowledgeLevel, onViewDetails }) => {
  // Use simplified muscle list for minimalist display and sort by activation descending
  const simplified = simplifyMuscles(exercise.muscles, knowledgeLevel)
    .sort((a, b) => b.activation - a.activation);

  return (
    <div className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm flex flex-col h-full group transition-all hover:shadow-md">
      <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
        <Dumbbell className="w-20 h-20 text-gray-300" />
      </div>
      
      <div className="p-8 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <button 
            onClick={() => onViewDetails(exercise)}
            className="text-left group/title"
          >
            <h3 className="text-2xl font-bold text-gray-900 leading-tight group-hover/title:text-indigo-600 transition-colors flex items-center gap-2">
              {exercise.name}
              <ChevronRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover/title:opacity-100 group-hover/title:translate-x-0 transition-all text-indigo-400" />
            </h3>
          </button>
          <span className="bg-gray-100 text-gray-800 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg whitespace-nowrap">
            {exercise.category}
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-6">
          {simplified.slice(0, 3).map((m) => (
            <span 
              key={m.name} 
              style={{ backgroundColor: getActivationColor(m.activation) }}
              className="text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl shadow-sm uppercase tracking-tight"
            >
              {m.name}
            </span>
          ))}
        </div>
        
        <p className="text-gray-500 line-clamp-2 text-sm leading-relaxed mb-6">
          {exercise.description}
        </p>

        {/* Simplified Stability Meter at the bottom of the card */}
        <div className="mt-auto pt-6 border-t border-gray-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Stability</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${exercise.stabilization * 10}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseCard;
