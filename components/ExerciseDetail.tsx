
import React, { useState, useMemo } from 'react';
import { X, Compass, Activity, Zap } from 'lucide-react';
import { Exercise, KnowledgeLevel } from '../types';
import { translate, simplifyMuscles, getActivationColor } from '../utils/translation';

interface ExerciseDetailProps {
  exercise: Exercise;
  knowledgeLevel: KnowledgeLevel;
  onClose: () => void;
}

const ExerciseDetail: React.FC<ExerciseDetailProps> = ({ exercise, knowledgeLevel, onClose }) => {
  const [adjustmentValue, setAdjustmentValue] = useState(50);
  
  const adjustedMuscles = useMemo(() => {
    if (!exercise.adjustments) return exercise.muscles;
    return exercise.muscles.map(m => {
      const adjustment = exercise.adjustments?.affectedMuscles.find(adj => adj.name === m.name);
      if (!adjustment) return m;
      const shift = ((adjustmentValue - 50) / 50) * adjustment.modifier;
      return { ...m, activation: Math.max(0, Math.min(100, m.activation + shift)) };
    });
  }, [exercise.muscles, exercise.adjustments, adjustmentValue]);

  // simplifyMuscles handles the 30% filter logic
  const simplified = simplifyMuscles(adjustedMuscles, knowledgeLevel)
    .sort((a, b) => b.activation - a.activation);

  return (
    <div className="fixed inset-0 z-[70] bg-[#F9FAFB] lg:p-12 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="max-w-5xl mx-auto bg-white min-h-screen lg:min-h-0 lg:rounded-[3rem] shadow-2xl relative overflow-hidden border border-gray-100">
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 z-10 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X className="w-6 h-6 text-gray-600" />
        </button>

        <div className="p-8 lg:p-16">
          <header className="mb-12">
            <div className="flex items-center gap-4 mb-4">
               <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">{exercise.name}</h1>
               <span className="bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg">
                {exercise.category}
              </span>
            </div>
            <p className="text-gray-600 max-w-2xl text-lg leading-relaxed font-medium">
              {exercise.description}
            </p>
          </header>

          {/* Muscles Targeted Section */}
          <section className="bg-gray-50 border border-gray-100 rounded-[2.5rem] p-10 mb-12">
            <div className="flex items-center gap-3 mb-8">
              <Zap className="w-5 h-5 text-indigo-500" />
              <h3 className="text-gray-800 font-bold uppercase tracking-widest text-[10px]">Muscles Targeted</h3>
            </div>
            
            <div className="max-w-2xl">
              <div className="space-y-4">
                {simplified.map(m => (
                  <div key={m.name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm transition-all hover:scale-[1.01]">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-900 font-black uppercase text-[11px] tracking-tight">{m.name}</span>
                      <span className="text-gray-400 font-bold text-[10px]">{Math.round(m.activation)}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-700 ease-out"
                        style={{ width: `${m.activation}%`, backgroundColor: getActivationColor(m.activation) }}
                      />
                    </div>
                  </div>
                ))}
                {simplified.length === 0 && (
                  <p className="text-gray-400 italic text-sm px-2">No muscle activation detected above 30% threshold.</p>
                )}
              </div>
            </div>
          </section>

          {/* Movement Details Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Plane of Motion Card */}
            <div className="bg-[#F4F7FF] border border-indigo-100 rounded-[2.5rem] p-10 flex flex-col justify-start">
              <div className="flex items-center gap-3 mb-6">
                <Compass className="w-5 h-5 text-indigo-500" />
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Plane of Motion</span>
                  <div className="h-[1px] bg-indigo-200/50 flex-1" />
                </div>
              </div>
              <h4 className="text-3xl font-black text-gray-900 uppercase">
                {translate(exercise.movementPlane, knowledgeLevel)}
              </h4>
            </div>

            {/* Resistance Profile Card */}
            <div className="bg-[#FFF9F2] border border-orange-100 rounded-[2.5rem] p-10 flex flex-col justify-start">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-orange-500" />
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-orange-600 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Resistance Profile</span>
                  <div className="h-[2px] bg-orange-200/50 flex-1" />
                </div>
              </div>
              <h4 className="text-3xl font-black text-gray-900 uppercase leading-tight mb-2">
                {exercise.resistanceCurve}
              </h4>
              {exercise.resistanceCurveDescription && (
                <p className="text-gray-500 font-medium text-sm tracking-tight">{exercise.resistanceCurveDescription}</p>
              )}
            </div>
          </div>

          {/* Simplified Stability Meter - Repositioned to Bottom */}
          <section className="pt-8 border-t border-gray-100">
            <h3 className="text-gray-900 font-black uppercase tracking-widest text-[10px] mb-4">Stability</h3>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden p-1 shadow-inner border border-gray-50">
              <div 
                className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${exercise.stabilization * 10}%` }}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ExerciseDetail;
