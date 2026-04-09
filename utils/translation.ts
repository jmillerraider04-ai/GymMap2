
import { KnowledgeLevel } from '../types';

/**
 * FIXED MUSCLE SET (Rule 1)
 */
export const OFFICIAL_MUSCLES = [
  'Biceps brachii', 'Brachialis', 'Brachioradialis', 'Triceps brachii', 'Forearms',
  'Anterior deltoid', 'Lateral deltoid', 'Posterior deltoid', 'Latissimus dorsi', 
  'Rhomboids', 'Upper trapezius', 'Middle trapezius', 'Lower trapezius', 'Serratus anterior',
  'Erector spinae', 'Rectus abdominis', 'Pectoralis major', 'Upper pectoralis',
  'Quadriceps', 'Hamstrings', 'Adductor magnus', 'Adductors', 'Gluteus maximus', 
  'Gluteus medius', 'Gastrocnemius', 'Soleus', 'Tibialis anterior'
];

// Updated threshold: Any muscle below 30 is left out.
const ACTIVATION_THRESHOLD = 30;

const termMap: Record<string, string> = {
  // Advanced -> Noobie Mappings
  'pectoralis major': 'Chest',
  'upper pectoralis': 'Upper Chest',
  // Group all deltoids to 'Shoulders'
  'anterior deltoid': 'Shoulders',
  'lateral deltoid': 'Shoulders',
  'posterior deltoid': 'Shoulders',
  
  'triceps brachii': 'Back of Arms',
  'biceps brachii': 'Front of Arms',
  'brachialis': 'Arms',
  'brachioradialis': 'Forearms',
  'forearms': 'Grip',
  'latissimus dorsi': 'Lats',
  'rhomboids': 'Upper Back',
  'upper trapezius': 'Traps',
  'middle trapezius': 'Mid Back',
  'lower trapezius': 'Lower Mid Back',
  'erector spinae': 'Lower Back',
  'serratus anterior': 'Serratus', // Renamed from Ribs, handled conditionally below
  'rectus abdominis': 'Abs',
  'gluteus maximus': 'Glutes',
  'gluteus medius': 'Side Glutes',
  'quadriceps': 'Quads',
  'hamstrings': 'Hams',
  'gastrocnemius': 'Calves',
  'soleus': 'Calves',
  'tibialis anterior': 'Shins',
  'adductors': 'Inner Thighs',
  'adductor magnus': 'Inner Thighs',
};

export const translate = (term: string, level: KnowledgeLevel): string => {
  if (level === 'advanced') return term;
  return termMap[term.toLowerCase()] || term;
};

export const simplifyMuscles = (muscles: { name: string; activation: number }[], level: KnowledgeLevel) => {
  // Filter by threshold: If activation is below threshold, exclude it.
  const relevantMuscles = muscles.filter(m => m.activation >= ACTIVATION_THRESHOLD);

  if (level === 'noobie') {
    const groups: Record<string, number> = {};
    relevantMuscles.forEach(m => {
      // Special Logic for Serratus Anterior
      if (m.name.toLowerCase() === 'serratus anterior') {
        // Only include Serratus if it's a "main target" (e.g. >= 50%)
        if (m.activation < 50) return;
      }

      const translated = translate(m.name, 'noobie');
      if (!groups[translated] || m.activation > groups[translated]) {
        groups[translated] = m.activation;
      }
    });
    return Object.entries(groups).map(([name, activation]) => ({ name, activation }));
  }

  return relevantMuscles;
};

export const getActivationColor = (activation: number) => {
  if (activation >= 90) return '#10b981'; // Primary (Emerald)
  if (activation >= 70) return '#34d399'; // Major (Light Emerald)
  if (activation >= 40) return '#60a5fa'; // Secondary (Blue)
  if (activation >= 30) return '#fbbf24'; // Meaningful (Amber)
  return '#e5e7eb'; // Negligible (Gray)
};
