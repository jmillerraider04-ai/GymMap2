
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import ExerciseCard from '../components/ExerciseCard';
import ExerciseDetail from '../components/ExerciseDetail';
import { Exercise, KnowledgeLevel } from '../types';
import { MOCK_EXERCISES } from '../data/exerciseData';

interface ExercisesPageProps {
  knowledgeLevel: KnowledgeLevel;
}

const ExercisesPage: React.FC<ExercisesPageProps> = ({ knowledgeLevel }) => {
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExercises = MOCK_EXERCISES.filter(exercise => 
    exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    exercise.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exercise.muscles.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Movement Library</h2>
          <p className="text-gray-500 mt-2 text-lg font-medium">Verified Biomechanics & Anatomy</p>
        </div>
        
        <div className="flex-1 max-w-xl relative">
          <input 
            type="text" 
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-100 px-6 py-4 pl-12 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-900 placeholder-gray-400 font-medium"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredExercises.map(exercise => (
          <ExerciseCard 
            key={exercise.id} 
            exercise={exercise} 
            knowledgeLevel={knowledgeLevel}
            onViewDetails={setSelectedExercise} 
          />
        ))}
        {filteredExercises.length === 0 && (
          <div className="col-span-full text-center py-20">
            <p className="text-gray-400 text-lg">No exercises found.</p>
          </div>
        )}
      </div>

      {selectedExercise && (
        <ExerciseDetail 
          exercise={selectedExercise} 
          knowledgeLevel={knowledgeLevel}
          onClose={() => setSelectedExercise(null)} 
        />
      )}
    </div>
  );
};

export default ExercisesPage;
