
import { Exercise } from '../types';

export const MOCK_EXERCISES: Exercise[] = [
  // =========================================================================
  // SQUAT VARIANTS
  // =========================================================================
  {
    id: 'squat-generic',
    name: 'Squat',
    category: 'Exercise',
    description: 'The fundamental lower body compound movement. Targets the entire lower chain with emphasis on knee and hip extension.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Adductor magnus', activation: 90 },
      { name: 'Gluteus maximus', activation: 80 }
    ]
  },
  {
    id: 'squat-barbell',
    name: 'Back Squat',
    category: 'Barbell',
    description: 'Sagittal compound movement. Torque peaks in deep hip flexion (>70º), prioritizing Adductor Magnus. Quadriceps are the sole knee extensors.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 4,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Adductor magnus', activation: 100 },
      { name: 'Gluteus maximus', activation: 75 },
      { name: 'Erector spinae', activation: 60 }
    ]
  },
  {
    id: 'squat-dumbbell',
    name: 'Goblet Squat',
    category: 'Dumbbell',
    description: 'Anterior-loaded squat. Excellent depth biases Adductor Magnus. Upper Trapezius and Biceps act isometrically to hold weight.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Adductor magnus', activation: 95 },
      { name: 'Gluteus maximus', activation: 50 }
    ]
  },
  {
    id: 'squat-smith',
    name: 'Squat',
    category: 'Smith Machine',
    description: 'Fixed-path squat. Allows for varied foot placement to bias different muscle groups without the stabilization demands of free weights.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 2,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 80 },
      { name: 'Adductor magnus', activation: 70 }
    ]
  },
  {
    id: 'squat-machine',
    name: 'Leg Press',
    category: 'Machine',
    description: 'Compound leg extension. Back support eliminates spinal loading, allowing higher absolute intensity for Quadriceps and Glutes.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 80 },
      { name: 'Adductor magnus', activation: 70 }
    ]
  },

  // =========================================================================
  // BENCH PRESS VARIANTS
  // =========================================================================
  {
    id: 'bench-generic',
    name: 'Bench Press',
    category: 'Exercise',
    description: 'The primary horizontal pressing movement for the upper body. Targets the chest, shoulders, and triceps.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 80 },
      { name: 'Triceps brachii', activation: 70 }
    ]
  },
  {
    id: 'bench-barbell',
    name: 'Bench Press',
    category: 'Barbell',
    description: 'Flat horizontal press. Pectoralis major is the prime mover. Anterior Deltoid assists significantly.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 80 },
      { name: 'Triceps brachii', activation: 80 }
    ]
  },
  {
    id: 'bench-dumbbell',
    name: 'Chest Press',
    category: 'Dumbbell',
    description: 'Flat press. Independent arms increase stabilization demand. Greater ROM than barbell.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Descending',
    stabilization: 7,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 75 },
      { name: 'Triceps brachii', activation: 70 }
    ]
  },
  {
    id: 'bench-machine',
    name: 'Chest Press',
    category: 'Machine',
    description: 'Fixed-path horizontal press. Minimizes stabilization, allowing for maximum focus on the pectorals.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 60 },
      { name: 'Triceps brachii', activation: 60 }
    ]
  },

  // =========================================================================
  // OVERHEAD PRESS VARIANTS
  // =========================================================================
  {
    id: 'ohp-generic',
    name: 'Shoulder Press',
    category: 'Exercise',
    description: 'Vertical pressing movement for the shoulders. Targets the deltoids and triceps.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Flexion', 'Elbow Extension'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Lateral deltoid', activation: 60 },
      { name: 'Triceps brachii', activation: 70 }
    ]
  },
  {
    id: 'ohp-barbell',
    name: 'Overhead Press',
    category: 'Barbell',
    description: 'Vertical press. Anterior Deltoid and Triceps are prime movers. High stabilization from Serratus Anterior and Core.',
    movementPlane: 'Frontal/Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 7,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Flexion', 'Elbow Extension'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Triceps brachii', activation: 85 },
      { name: 'Serratus anterior', activation: 60 }
    ]
  },
  {
    id: 'ohp-dumbbell',
    name: 'Shoulder Press',
    category: 'Dumbbell',
    description: 'Vertical press. Independent weights demand high frontal plane stabilization from Lateral Deltoid and Rotator Cuff.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 8,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Flexion', 'Elbow Extension'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Triceps brachii', activation: 80 },
      { name: 'Lateral deltoid', activation: 55 }
    ]
  },

  // =========================================================================
  // ROW VARIANTS
  // =========================================================================
  {
    id: 'row-generic',
    name: 'Row',
    category: 'Exercise',
    description: 'Horizontal pulling movement for the back. Targets the lats, rhomboids, and traps.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Ascending',
    stabilization: 5,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Extension', 'Scapular Retraction'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Rhomboids', activation: 90 },
      { name: 'Middle trapezius', activation: 85 }
    ]
  },
  {
    id: 'row-barbell',
    name: 'Bent Over Row',
    category: 'Barbell',
    description: 'Horizontal pull. Heavy load on Lats and Traps. Significant isometric demand on Erector Spinae.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Ascending',
    stabilization: 7,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Extension', 'Scapular Retraction'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Rhomboids', activation: 90 },
      { name: 'Middle trapezius', activation: 85 },
      { name: 'Erector spinae', activation: 80 }
    ]
  },
  {
    id: 'row-cable',
    name: 'Seated Row',
    category: 'Cable',
    description: 'Horizontal pull. Constant tension allows for peak contraction focus. Targets mid-back and lats.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Extension', 'Scapular Retraction'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 90 },
      { name: 'Rhomboids', activation: 100 },
      { name: 'Middle trapezius', activation: 95 }
    ]
  },
  {
    id: 'row-hammer',
    name: 'Row',
    category: 'Hammer Strength',
    description: 'Diverging horizontal pull. Unilateral capability allows for correction of imbalances.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 2,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Extension', 'Scapular Retraction'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Rhomboids', activation: 90 },
      { name: 'Middle trapezius', activation: 85 }
    ]
  },

  // =========================================================================
  // DEADLIFT & RDL VARIANTS
  // =========================================================================
  {
    id: 'deadlift-generic',
    name: 'Deadlift',
    category: 'Exercise',
    description: 'The ultimate test of total body strength. Targets the entire posterior chain.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Hip Extension', 'Knee Extension'],
    muscles: [
      { name: 'Erector spinae', activation: 100 },
      { name: 'Gluteus maximus', activation: 90 },
      { name: 'Hamstrings', activation: 70 }
    ]
  },
  {
    id: 'rdl-generic',
    name: 'RDL (Romanian Deadlift)',
    category: 'Exercise',
    description: 'Hip hinge movement focusing on the hamstrings and glutes in the lengthened position.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Gluteus maximus', activation: 80 },
      { name: 'Adductor magnus', activation: 90 }
    ]
  },

  // =========================================================================
  // LATERAL RAISE VARIANTS
  // =========================================================================
  {
    id: 'lat-raise-generic',
    name: 'Lateral Raise',
    category: 'Exercise',
    description: 'Isolation movement for the lateral deltoid. Essential for shoulder width.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Ascending',
    stabilization: 3,
    planeOfMotion: 'Shoulder Abduction',
    jointActions: ['Shoulder Abduction'],
    muscles: [
      { name: 'Lateral deltoid', activation: 100 },
      { name: 'Upper trapezius', activation: 40 }
    ]
  },
  {
    id: 'lat-raise-cable',
    name: 'Lateral Raise',
    category: 'Cable',
    description: 'Shoulder abduction with constant tension. Overloads the lateral deltoid across the entire ROM.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Shoulder Abduction',
    jointActions: ['Shoulder Abduction'],
    muscles: [
      { name: 'Lateral deltoid', activation: 100 },
      { name: 'Supraspinatus', activation: 50 }
    ]
  },

  // =========================================================================
  // BICEPS & TRICEPS VARIANTS
  // =========================================================================
  {
    id: 'curl-generic',
    name: 'Bicep Curl',
    category: 'Exercise',
    description: 'The classic arm isolation movement. Targets the biceps brachii and brachialis.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Bell Curve',
    stabilization: 3,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 70 }
    ]
  },
  {
    id: 'pushdown-generic',
    name: 'Triceps Extension',
    category: 'Exercise',
    description: 'Isolation movement for the triceps. Essential for arm thickness.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 2,
    planeOfMotion: 'Elbow Extension',
    jointActions: ['Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 }
    ]
  },
  {
    id: 'pushdown-cable',
    name: 'Tricep Pushdown',
    category: 'Cable',
    description: 'Elbow extension isolation. Constant tension throughout ROM. Medial and lateral heads are primary.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 2,
    planeOfMotion: 'Elbow Extension',
    jointActions: ['Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 }
    ]
  },

  // =========================================================================
  // LEG ISOLATION VARIANTS
  // =========================================================================
  {
    id: 'leg-ext-generic',
    name: 'Leg Extension',
    category: 'Exercise',
    description: 'Isolation movement for the quadriceps. Overloads the quads in the shortened position.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Knee Extension',
    jointActions: ['Knee Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 }
    ]
  },
  {
    id: 'leg-curl-generic',
    name: 'Lying Hamstring Curl',
    category: 'Exercise',
    description: 'Isolation movement for the hamstrings. Targets knee flexion.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Knee Flexion',
    jointActions: ['Knee Flexion'],
    muscles: [
      { name: 'Hamstrings', activation: 100 }
    ]
  },

  // =========================================================================
  // BODYWEIGHT & PULL-UP VARIANTS
  // =========================================================================
  {
    id: 'pullup-generic',
    name: 'Pull-up',
    category: 'Exercise',
    description: 'The king of upper body pulling. Targets the lats and biceps.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Adduction', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 80 }
    ]
  },
  {
    id: 'pullup-bodyweight',
    name: 'Pull-up',
    category: 'Bodyweight',
    description: 'Vertical pull using bodyweight. Requires significant scapular depression and core stability.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Adduction', 'Scapular Depression', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 80 },
      { name: 'Lower trapezius', activation: 70 }
    ]
  },
  {
    id: 'chinup-bodyweight',
    name: 'Chin-up',
    category: 'Bodyweight',
    description: 'Vertical pull with an underhand grip. Biases the biceps and lower lats.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Adduction', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 90 },
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Lower trapezius', activation: 60 }
    ]
  },

  // =========================================================================
  // BICEP CURL VARIANTS
  // =========================================================================
  {
    id: 'curl-barbell',
    name: 'Bicep Curl',
    category: 'Barbell',
    description: 'Supinated elbow flexion. Fixed hand position forces full supination, maximizing Biceps Brachii recruitment.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Bell Curve',
    stabilization: 3,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 70 },
      { name: 'Forearms', activation: 45 }
    ]
  },
  {
    id: 'curl-dumbbell',
    name: 'Bicep Curl',
    category: 'Dumbbell',
    description: 'Supinated curl. Free rotation allows maximal supination, hitting Biceps Brachii fully.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Bell Curve',
    stabilization: 3,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion', 'Radio-ulnar Supination'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 70 },
      { name: 'Forearms', activation: 40 }
    ]
  },
  {
    id: 'curl-cable',
    name: 'Bicep Curl',
    category: 'Cable',
    description: 'Elbow flexion with constant cable tension. Eliminates the "dead spot" at the bottom and top of the movement.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 3,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 60 }
    ]
  },
  {
    id: 'curl-kettlebell',
    name: 'Bicep Curl',
    category: 'Kettlebell',
    description: 'Elbow flexion with an offset center of mass. Increases demand on the forearms and wrist stabilizers.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Bell Curve',
    stabilization: 4,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 90 },
      { name: 'Forearms', activation: 80 }
    ]
  },
  {
    id: 'curl-machine',
    name: 'Bicep Curl',
    category: 'Machine',
    description: 'Isolated elbow flexion on a fixed path. Maximizes stability for total focus on the biceps.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 80 }
    ]
  },

  // =========================================================================
  // HAMMER CURL VARIANTS
  // =========================================================================
  {
    id: 'hammer-generic',
    name: 'Hammer Curl',
    category: 'Exercise',
    description: 'Neutral grip elbow flexion. Biases the brachialis and brachioradialis.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Bell Curve',
    stabilization: 3,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Brachialis', activation: 100 },
      { name: 'Brachioradialis', activation: 90 },
      { name: 'Biceps brachii', activation: 50 }
    ]
  },
  {
    id: 'hammer-dumbbell',
    name: 'Hammer Curl',
    category: 'Dumbbell',
    description: 'Neutral grip curl using dumbbells. Excellent for building forearm and upper arm thickness.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Bell Curve',
    stabilization: 3,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Brachialis', activation: 100 },
      { name: 'Brachioradialis', activation: 95 },
      { name: 'Forearms', activation: 80 }
    ]
  },
  {
    id: 'hammer-cable',
    name: 'Hammer Curl (Rope)',
    category: 'Cable',
    description: 'Neutral grip curl using a rope attachment. Constant tension biases the brachialis throughout the range.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 3,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Brachialis', activation: 100 },
      { name: 'Brachioradialis', activation: 85 }
    ]
  },

  // =========================================================================
  // PREACHER CURL VARIANTS
  // =========================================================================
  {
    id: 'preacher-generic',
    name: 'Preacher Curl',
    category: 'Exercise',
    description: 'Elbow flexion with arms supported on a bench. Eliminates momentum and biases the short head of the biceps.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 2,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 80 }
    ]
  },
  {
    id: 'preacher-barbell',
    name: 'Preacher Curl',
    category: 'Barbell',
    description: 'Preacher curl using an EZ-bar or straight bar. Provides a stable base for heavy loading.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 2,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 75 }
    ]
  },
  {
    id: 'preacher-dumbbell',
    name: 'Preacher Curl',
    category: 'Dumbbell',
    description: 'Unilateral preacher curl. Allows for better focus on each arm and correction of imbalances.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 3,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 70 }
    ]
  },
  {
    id: 'preacher-cable',
    name: 'Preacher Curl',
    category: 'Cable',
    description: 'Preacher curl using a cable machine. Constant tension, especially at the top of the movement.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 2,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 85 }
    ]
  },
  {
    id: 'preacher-machine',
    name: 'Preacher Curl',
    category: 'Machine',
    description: 'Selectorized preacher curl. Fixed path and cam system provide optimal resistance throughout the ROM.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Biceps brachii', activation: 100 },
      { name: 'Brachialis', activation: 80 }
    ]
  },

  // =========================================================================
  // PREACHER HAMMER CURL VARIANTS
  // =========================================================================
  {
    id: 'preacher-hammer-generic',
    name: 'Preacher Hammer Curl',
    category: 'Exercise',
    description: 'Neutral grip preacher curl. Combines the isolation of the preacher bench with the brachialis focus of the hammer grip.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 2,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Brachialis', activation: 100 },
      { name: 'Brachioradialis', activation: 90 },
      { name: 'Biceps brachii', activation: 40 }
    ]
  },
  {
    id: 'preacher-hammer-dumbbell',
    name: 'Preacher Hammer Curl',
    category: 'Dumbbell',
    description: 'Neutral grip unilateral preacher curl. Excellent for isolating the brachialis without body momentum.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 3,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Brachialis', activation: 100 },
      { name: 'Brachioradialis', activation: 95 }
    ]
  },
  {
    id: 'preacher-hammer-cable',
    name: 'Preacher Hammer Curl',
    category: 'Cable',
    description: 'Neutral grip preacher curl using a cable rope. Constant tension on the brachialis.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 2,
    planeOfMotion: 'Elbow Flexion',
    jointActions: ['Elbow Flexion'],
    muscles: [
      { name: 'Brachialis', activation: 100 },
      { name: 'Brachioradialis', activation: 85 }
    ]
  },

  // =========================================================================
  // TRICEP EXTENSION VARIANTS
  // =========================================================================
  {
    id: 'skullcrusher-barbell',
    name: 'Skullcrusher',
    category: 'Barbell',
    description: 'Lying elbow extension. Stretches the long head of the triceps.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 4,
    planeOfMotion: 'Elbow Extension',
    jointActions: ['Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 }
    ]
  },
  {
    id: 'overhead-ext-dumbbell',
    name: 'Overhead Extension',
    category: 'Dumbbell',
    description: 'Vertical elbow extension. Maximizes stretch on the long head of the triceps.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Elbow Extension',
    jointActions: ['Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 }
    ]
  },
  {
    id: 'overhead-ext-cable',
    name: 'Overhead Extension',
    category: 'Cable',
    description: 'Overhead extension using a cable. Constant tension in the stretched position.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Elbow Extension',
    jointActions: ['Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 }
    ]
  },
  {
    id: 'tricep-mach-press',
    name: 'Tricep Press',
    category: 'Machine',
    description: 'Compound vertical press for triceps. High stability allows for heavy loading.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Elbow Extension', 'Shoulder Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 },
      { name: 'Pectoralis major', activation: 40 }
    ]
  },

  // =========================================================================
  // LATERAL RAISE VARIANTS
  // =========================================================================
  {
    id: 'lat-raise-dumbbell',
    name: 'Lateral Raise',
    category: 'Dumbbell',
    description: 'Shoulder abduction isolation. Peak torque at the top.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Ascending',
    stabilization: 3,
    planeOfMotion: 'Shoulder Abduction',
    jointActions: ['Shoulder Abduction'],
    muscles: [
      { name: 'Lateral deltoid', activation: 100 },
      { name: 'Upper trapezius', activation: 40 }
    ]
  },
  {
    id: 'lat-raise-machine',
    name: 'Lateral Raise',
    category: 'Machine',
    description: 'Fixed-path shoulder abduction. Eliminates momentum and provides consistent tension.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Shoulder Abduction',
    jointActions: ['Shoulder Abduction'],
    muscles: [
      { name: 'Lateral deltoid', activation: 100 },
      { name: 'Upper trapezius', activation: 30 }
    ]
  },

  // =========================================================================
  // LEG CURL VARIANTS
  // =========================================================================
  {
    id: 'leg-curl-standing',
    name: 'Standing Leg Curl',
    category: 'Machine',
    description: 'Unilateral knee flexion isolation. Allows for focused hamstring work.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Knee Flexion',
    jointActions: ['Knee Flexion'],
    muscles: [
      { name: 'Hamstrings', activation: 100 }
    ]
  },

  // =========================================================================
  // CALF RAISE VARIANTS
  // =========================================================================
  {
    id: 'calf-raise-generic',
    name: 'Calf Raise',
    category: 'Exercise',
    description: 'Plantarflexion movement for the calves.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 3,
    planeOfMotion: 'Plantarflexion',
    jointActions: ['Plantarflexion'],
    muscles: [
      { name: 'Gastrocnemius', activation: 100 },
      { name: 'Soleus', activation: 80 }
    ]
  },
  {
    id: 'calf-raise-barbell',
    name: 'Calf Raise',
    category: 'Barbell',
    description: 'Plantarflexion with a barbell. High stabilization demand.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 6,
    planeOfMotion: 'Plantarflexion',
    jointActions: ['Plantarflexion'],
    muscles: [
      { name: 'Gastrocnemius', activation: 100 },
      { name: 'Soleus', activation: 80 }
    ]
  },
  {
    id: 'calf-raise-machine',
    name: 'Standing Calf Raise',
    category: 'Machine',
    description: 'Fixed-path calf raise. Allows for heavy loading with minimal stabilization.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Plantarflexion',
    jointActions: ['Plantarflexion'],
    muscles: [
      { name: 'Gastrocnemius', activation: 100 },
      { name: 'Soleus', activation: 80 }
    ]
  },

  // =========================================================================
  // FACE PULL VARIANTS
  // =========================================================================
  {
    id: 'facepull-generic',
    name: 'Face Pull',
    category: 'Exercise',
    description: 'Horizontal pull with external rotation. Targets the rear delts and rotator cuff.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 3,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Horizontal Abduction', 'Shoulder External Rotation'],
    muscles: [
      { name: 'Posterior deltoid', activation: 100 },
      { name: 'Infraspinatus', activation: 90 }
    ]
  },
  {
    id: 'facepull-cable',
    name: 'Face Pull',
    category: 'Cable',
    description: 'Face pull using a cable machine. Constant tension is ideal for the rear delts.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 3,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Horizontal Abduction', 'Shoulder External Rotation'],
    muscles: [
      { name: 'Posterior deltoid', activation: 100 },
      { name: 'Infraspinatus', activation: 90 }
    ]
  },

  // =========================================================================
  // ADDITIONAL SHOULDER PRESS VARIANTS
  // =========================================================================
  {
    id: 'ohp-cable',
    name: 'Shoulder Press',
    category: 'Cable',
    description: 'Vertical press using cables. Provides constant tension and allows for a more natural converging path.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 6,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Flexion', 'Elbow Extension'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Triceps brachii', activation: 80 },
      { name: 'Lateral deltoid', activation: 50 }
    ]
  },
  {
    id: 'ohp-smith',
    name: 'Shoulder Press',
    category: 'Smith Machine',
    description: 'Fixed-path vertical press. Allows for heavy loading with reduced stabilization needs.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 2,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Flexion', 'Elbow Extension'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Triceps brachii', activation: 85 },
      { name: 'Lateral deltoid', activation: 40 }
    ]
  },
  {
    id: 'ohp-machine',
    name: 'Shoulder Press',
    category: 'Machine',
    description: 'Selectorized vertical press. Optimal for isolating the shoulders with maximum stability.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Flexion', 'Elbow Extension'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Triceps brachii', activation: 75 },
      { name: 'Lateral deltoid', activation: 45 }
    ]
  },

  // =========================================================================
  // ADDITIONAL BENCH PRESS VARIANTS
  // =========================================================================
  {
    id: 'bench-smith',
    name: 'Bench Press',
    category: 'Smith Machine',
    description: 'Fixed-path horizontal press. Allows for safe heavy loading without a spotter.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Descending',
    stabilization: 2,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 70 },
      { name: 'Triceps brachii', activation: 75 }
    ]
  },
  {
    id: 'bench-cable',
    name: 'Chest Press',
    category: 'Cable',
    description: 'Horizontal press using cables. Converging path and constant tension maximize pectoral recruitment.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 6,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 60 },
      { name: 'Triceps brachii', activation: 60 }
    ]
  },

  // =========================================================================
  // CHEST FLY VARIANTS
  // =========================================================================
  {
    id: 'fly-generic',
    name: 'Chest Fly',
    category: 'Exercise',
    description: 'Horizontal adduction isolation movement. Maximizes the stretch and contraction of the pectorals.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Descending',
    stabilization: 4,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 40 }
    ]
  },
  {
    id: 'fly-dumbbell',
    name: 'Chest Fly',
    category: 'Dumbbell',
    description: 'Lying horizontal adduction with dumbbells. Peak tension in the stretched position.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 50 }
    ]
  },
  {
    id: 'fly-cable',
    name: 'Chest Fly',
    category: 'Cable',
    description: 'Standing or lying horizontal adduction with cables. Constant tension throughout the entire ROM.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 5,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 30 }
    ]
  },
  {
    id: 'fly-machine',
    name: 'Chest Fly',
    category: 'Machine',
    description: 'Selectorized horizontal adduction. Fixed path provides maximum stability for pectoral isolation.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 25 }
    ]
  },
  {
    id: 'pec-dec-machine',
    name: 'Pec Dec',
    category: 'Machine',
    description: 'Machine-based horizontal adduction. Often used interchangeably with Chest Fly Machine, focusing on the inner pectoral contraction.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 25 }
    ]
  },

  // =========================================================================
  // SQUAT VARIANTS (EXPANDED)
  // =========================================================================
  {
    id: 'squat-zercher',
    name: 'Zercher Squat',
    category: 'Barbell',
    description: 'Squat with the barbell held in the crooks of the elbows. Massive demand on the core and upper back.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 7,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Erector spinae', activation: 95 },
      { name: 'Gluteus maximus', activation: 80 },
      { name: 'Upper trapezius', activation: 70 }
    ]
  },
  {
    id: 'squat-front-barbell',
    name: 'Front Squat',
    category: 'Barbell',
    description: 'Anterior-loaded squat. Vertical torso biases the quadriceps and requires high thoracic extension strength.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Erector spinae', activation: 90 },
      { name: 'Upper trapezius', activation: 70 }
    ]
  },
  {
    id: 'squat-front-smith',
    name: 'Front Squat',
    category: 'Smith Machine',
    description: 'Fixed-path front squat. Allows for a perfectly vertical torso to maximize quad isolation.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 3,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Erector spinae', activation: 70 }
    ]
  },
  {
    id: 'squat-kettlebell',
    name: 'Goblet Squat',
    category: 'Kettlebell',
    description: 'Anterior-loaded squat with a kettlebell. Excellent for teaching squat mechanics and depth.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Adductor magnus', activation: 90 }
    ]
  },

  // =========================================================================
  // BEHIND THE NECK PRESS VARIANTS
  // =========================================================================
  {
    id: 'btn-press-barbell',
    name: 'Behind the Neck Press',
    category: 'Barbell',
    description: 'Vertical press with the bar starting behind the head. Biases the lateral deltoid more than the front press.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 7,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Abduction', 'Elbow Extension'],
    muscles: [
      { name: 'Lateral deltoid', activation: 100 },
      { name: 'Anterior deltoid', activation: 70 },
      { name: 'Triceps brachii', activation: 80 }
    ]
  },
  {
    id: 'btn-press-smith',
    name: 'Behind the Neck Press',
    category: 'Smith Machine',
    description: 'Fixed-path behind the neck press. Safer for those with limited shoulder stability.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 3,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Abduction', 'Elbow Extension'],
    muscles: [
      { name: 'Lateral deltoid', activation: 100 },
      { name: 'Anterior deltoid', activation: 60 },
      { name: 'Triceps brachii', activation: 75 }
    ]
  },

  // =========================================================================
  // HIP THRUST VARIANTS
  // =========================================================================
  {
    id: 'hip-thrust-generic',
    name: 'Hip Thrust',
    category: 'Exercise',
    description: 'Horizontal hip extension movement. The gold standard for glute isolation.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Ascending',
    stabilization: 3,
    planeOfMotion: 'Hip Extension',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Gluteus maximus', activation: 100 },
      { name: 'Hamstrings', activation: 60 }
    ]
  },
  {
    id: 'hip-thrust-barbell',
    name: 'Hip Thrust',
    category: 'Barbell',
    description: 'Heavy horizontal hip extension. Overloads the shortened position where glute leverage is highest.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Ascending',
    stabilization: 3,
    planeOfMotion: 'Hip Extension',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Gluteus maximus', activation: 100 },
      { name: 'Hamstrings', activation: 60 }
    ]
  },
  {
    id: 'hip-thrust-dumbbell',
    name: 'Hip Thrust',
    category: 'Dumbbell',
    description: 'Horizontal hip extension with a dumbbell. Good for higher rep ranges and metabolic stress.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Ascending',
    stabilization: 4,
    planeOfMotion: 'Hip Extension',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Gluteus maximus', activation: 100 },
      { name: 'Hamstrings', activation: 50 }
    ]
  },
  {
    id: 'hip-thrust-smith',
    name: 'Hip Thrust',
    category: 'Smith Machine',
    description: 'Fixed-path hip thrust. Eliminates the need to balance the bar, allowing for maximum glute focus.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Ascending',
    stabilization: 2,
    planeOfMotion: 'Hip Extension',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Gluteus maximus', activation: 100 },
      { name: 'Hamstrings', activation: 40 }
    ]
  },
  {
    id: 'hip-thrust-machine',
    name: 'Hip Thrust',
    category: 'Machine',
    description: 'Selectorized hip thrust machine. Provides the most stable environment for glute training.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Hip Extension',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Gluteus maximus', activation: 100 },
      { name: 'Hamstrings', activation: 40 }
    ]
  },

  // =========================================================================
  // RDL (ROMANIAN DEADLIFT) VARIANTS
  // =========================================================================
  {
    id: 'rdl-barbell',
    name: 'RDL (Romanian Deadlift)',
    category: 'Barbell',
    description: 'Hip hinge with a barbell. Massive torque in lengthened Hamstrings and Adductor Magnus.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Adductor magnus', activation: 95 },
      { name: 'Erector spinae', activation: 90 },
      { name: 'Gluteus maximus', activation: 75 }
    ]
  },
  {
    id: 'rdl-dumbbell',
    name: 'RDL (Romanian Deadlift)',
    category: 'Dumbbell',
    description: 'Hip hinge with dumbbells. Allows weight to stay closer to center of mass, slightly reducing shear.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Adductor magnus', activation: 95 },
      { name: 'Gluteus maximus', activation: 80 },
      { name: 'Erector spinae', activation: 75 }
    ]
  },
  {
    id: 'rdl-kettlebell',
    name: 'RDL (Romanian Deadlift)',
    category: 'Kettlebell',
    description: 'Hip hinge with kettlebells. Offset center of mass increases stability demand.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Adductor magnus', activation: 95 },
      { name: 'Gluteus maximus', activation: 85 }
    ]
  },
  {
    id: 'rdl-smith',
    name: 'RDL (Romanian Deadlift)',
    category: 'Smith Machine',
    description: 'Fixed-path hip hinge. Allows for precise control of the bar path to maximize hamstring stretch.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 2,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Adductor magnus', activation: 90 },
      { name: 'Gluteus maximus', activation: 70 }
    ]
  },
  {
    id: 'rdl-cable',
    name: 'RDL (Romanian Deadlift)',
    category: 'Cable',
    description: 'Hip hinge using a cable. Constant tension pulling the hips back into the hinge.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Adductor magnus', activation: 95 },
      { name: 'Gluteus maximus', activation: 80 }
    ]
  },

  // =========================================================================
  // SLDL (STIFF LEG DEADLIFT) VARIANTS
  // =========================================================================
  {
    id: 'sldl-generic',
    name: 'SLDL (Stiff Leg Deadlift)',
    category: 'Exercise',
    description: 'Deadlift variant with minimal knee flexion. Targets the hamstrings and lower back intensely.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Erector spinae', activation: 100 },
      { name: 'Gluteus maximus', activation: 70 }
    ]
  },
  {
    id: 'sldl-barbell',
    name: 'SLDL (Stiff Leg Deadlift)',
    category: 'Barbell',
    description: 'Stiff leg deadlift with a barbell. Highest potential for loading the posterior chain.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Erector spinae', activation: 100 },
      { name: 'Gluteus maximus', activation: 75 }
    ]
  },
  {
    id: 'sldl-dumbbell',
    name: 'SLDL (Stiff Leg Deadlift)',
    category: 'Dumbbell',
    description: 'Stiff leg deadlift with dumbbells. Allows for a more natural hand position.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Erector spinae', activation: 90 },
      { name: 'Gluteus maximus', activation: 80 }
    ]
  },
  {
    id: 'sldl-smith',
    name: 'SLDL (Stiff Leg Deadlift)',
    category: 'Smith Machine',
    description: 'Fixed-path stiff leg deadlift. Provides stability for focusing on the hamstring stretch.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 2,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Erector spinae', activation: 80 },
      { name: 'Gluteus maximus', activation: 60 }
    ]
  },
  {
    id: 'sldl-kettlebell',
    name: 'SLDL (Stiff Leg Deadlift)',
    category: 'Kettlebell',
    description: 'Stiff leg deadlift with kettlebells. Offset center of mass increases stability demand on the posterior chain.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension'],
    muscles: [
      { name: 'Hamstrings', activation: 100 },
      { name: 'Erector spinae', activation: 95 },
      { name: 'Gluteus maximus', activation: 80 }
    ]
  },
  // =========================================================================
  // LAT PULLDOWN VARIANTS
  // =========================================================================
  {
    id: 'lat-pulldown-generic',
    name: 'Lat Pulldown',
    category: 'Exercise',
    description: 'Vertical pulling movement for the back. Targets the lats and biceps.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Adduction', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 80 },
      { name: 'Teres major', activation: 70 }
    ]
  },
  {
    id: 'lat-pulldown-cable',
    name: 'Lat Pulldown',
    category: 'Cable',
    description: 'Vertical pull using a cable machine. Constant tension and various handle options allow for specific targeting.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Adduction', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 80 },
      { name: 'Teres major', activation: 70 }
    ]
  },
  {
    id: 'lat-pulldown-machine',
    name: 'Lat Pulldown',
    category: 'Machine',
    description: 'Fixed-path vertical pull. Provides maximum stability for isolating the lats.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Adduction', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 70 },
      { name: 'Teres major', activation: 60 }
    ]
  },
  // =========================================================================
  // DIP VARIANTS
  // =========================================================================
  {
    id: 'dip-generic',
    name: 'Dips',
    category: 'Exercise',
    description: 'Vertical pressing movement for the triceps and chest.',
    movementPlane: 'Sagittal/Frontal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Extension', 'Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 },
      { name: 'Pectoralis major', activation: 80 },
      { name: 'Anterior deltoid', activation: 60 }
    ]
  },
  {
    id: 'dip-bodyweight',
    name: 'Dips',
    category: 'Bodyweight',
    description: 'Vertical press using bodyweight. Requires significant shoulder stability and tricep strength.',
    movementPlane: 'Sagittal/Frontal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Extension', 'Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 },
      { name: 'Pectoralis major', activation: 80 },
      { name: 'Anterior deltoid', activation: 60 }
    ]
  },
  {
    id: 'dip-machine',
    name: 'Dips',
    category: 'Machine',
    description: 'Fixed-path vertical press. Allows for assisted or weighted dips with maximum stability.',
    movementPlane: 'Sagittal/Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Push',
    jointActions: ['Shoulder Extension', 'Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 },
      { name: 'Pectoralis major', activation: 70 },
      { name: 'Anterior deltoid', activation: 50 }
    ]
  },
  // =========================================================================
  // LUNGE VARIANTS
  // =========================================================================
  {
    id: 'lunge-generic',
    name: 'Lunge',
    category: 'Exercise',
    description: 'Unilateral lower body movement. Targets the quads, glutes, and hamstrings.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 7,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 90 },
      { name: 'Hamstrings', activation: 70 }
    ]
  },
  {
    id: 'lunge-bodyweight',
    name: 'Lunge',
    category: 'Bodyweight',
    description: 'Unilateral lower body movement using bodyweight. Excellent for balance and stability.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 7,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 90 },
      { name: 'Hamstrings', activation: 70 }
    ]
  },
  {
    id: 'lunge-dumbbell',
    name: 'Lunge',
    category: 'Dumbbell',
    description: 'Unilateral lower body movement with dumbbells. Increases loading and stabilization demand.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 8,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 95 },
      { name: 'Hamstrings', activation: 75 }
    ]
  },
  {
    id: 'lunge-barbell',
    name: 'Lunge',
    category: 'Barbell',
    description: 'Unilateral lower body movement with a barbell. Allows for heavy loading but requires high stability.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 9,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 95 },
      { name: 'Hamstrings', activation: 80 }
    ]
  },
  // =========================================================================
  // BULGARIAN SPLIT SQUAT VARIANTS
  // =========================================================================
  {
    id: 'bss-generic',
    name: 'Bulgarian Split Squat',
    category: 'Exercise',
    description: 'Rear-foot elevated split squat. Intense unilateral movement targeting the quads and glutes.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 8,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 100 },
      { name: 'Hamstrings', activation: 60 }
    ]
  },
  {
    id: 'bss-bodyweight',
    name: 'Bulgarian Split Squat',
    category: 'Bodyweight',
    description: 'Rear-foot elevated split squat using bodyweight. High stabilization demand.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 8,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 100 },
      { name: 'Hamstrings', activation: 60 }
    ]
  },
  {
    id: 'bss-dumbbell',
    name: 'Bulgarian Split Squat',
    category: 'Dumbbell',
    description: 'Rear-foot elevated split squat with dumbbells. Increases loading and stabilization demand.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 9,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 100 },
      { name: 'Hamstrings', activation: 65 }
    ]
  },
  {
    id: 'bss-barbell',
    name: 'Bulgarian Split Squat',
    category: 'Barbell',
    description: 'Rear-foot elevated split squat with a barbell. Extremely high stability demand.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 10,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 100 },
      { name: 'Hamstrings', activation: 70 }
    ]
  },
  // =========================================================================
  // LEG PRESS VARIANTS
  // =========================================================================
  {
    id: 'leg-press-generic',
    name: 'Leg Press',
    category: 'Exercise',
    description: 'Compound lower body movement using a machine. Targets quads and glutes with high stability.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 80 },
      { name: 'Adductor magnus', activation: 70 }
    ]
  },
  {
    id: 'leg-press-machine-standard',
    name: 'Leg Press',
    category: 'Machine',
    description: 'Standard leg press machine. Provides a safe and stable environment for heavy leg training.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 80 },
      { name: 'Adductor magnus', activation: 70 }
    ]
  },
  // =========================================================================
  // SHOULDER SHRUG VARIANTS
  // =========================================================================
  {
    id: 'shrug-generic',
    name: 'Shoulder Shrug',
    category: 'Exercise',
    description: 'Isolation movement for the upper trapezius.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 3,
    planeOfMotion: 'Scapular Elevation',
    jointActions: ['Scapular Elevation'],
    muscles: [
      { name: 'Upper trapezius', activation: 100 }
    ]
  },
  {
    id: 'shrug-dumbbell',
    name: 'Shoulder Shrug',
    category: 'Dumbbell',
    description: 'Shoulder shrugs with dumbbells. Allows for a more natural hand position and independent movement.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 3,
    planeOfMotion: 'Scapular Elevation',
    jointActions: ['Scapular Elevation'],
    muscles: [
      { name: 'Upper trapezius', activation: 100 }
    ]
  },
  {
    id: 'shrug-barbell',
    name: 'Shoulder Shrug',
    category: 'Barbell',
    description: 'Shoulder shrugs with a barbell. Allows for heavy loading of the traps.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Scapular Elevation',
    jointActions: ['Scapular Elevation'],
    muscles: [
      { name: 'Upper trapezius', activation: 100 }
    ]
  },
  {
    id: 'shrug-machine',
    name: 'Shoulder Shrug',
    category: 'Machine',
    description: 'Shoulder shrugs using a machine. Provides maximum stability for heavy trap training.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Scapular Elevation',
    jointActions: ['Scapular Elevation'],
    muscles: [
      { name: 'Upper trapezius', activation: 100 }
    ]
  },
  // =========================================================================
  // BACK EXTENSION VARIANTS
  // =========================================================================
  {
    id: 'back-ext-generic',
    name: 'Back Extension',
    category: 'Exercise',
    description: 'Isolation movement for the erector spinae and posterior chain.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 3,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension', 'Spinal Extension'],
    muscles: [
      { name: 'Erector spinae', activation: 100 },
      { name: 'Gluteus maximus', activation: 80 },
      { name: 'Hamstrings', activation: 70 }
    ]
  },
  {
    id: 'back-ext-bodyweight',
    name: 'Back Extension',
    category: 'Bodyweight',
    description: 'Back extension using bodyweight on a hyperextension bench.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 3,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Hip Extension', 'Spinal Extension'],
    muscles: [
      { name: 'Erector spinae', activation: 100 },
      { name: 'Gluteus maximus', activation: 80 },
      { name: 'Hamstrings', activation: 70 }
    ]
  },
  {
    id: 'back-ext-machine',
    name: 'Back Extension',
    category: 'Machine',
    description: 'Selectorized back extension machine. Provides a controlled environment for strengthening the lower back.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Hip Hinge',
    jointActions: ['Spinal Extension'],
    muscles: [
      { name: 'Erector spinae', activation: 100 }
    ]
  },
  // =========================================================================
  // CORE VARIANTS
  // =========================================================================
  {
    id: 'plank-generic',
    name: 'Plank',
    category: 'Exercise',
    description: 'Isometric core exercise. Targets the entire abdominal wall and stabilizers.',
    movementPlane: 'Isometric',
    resistanceCurve: 'Consistent',
    stabilization: 10,
    planeOfMotion: 'Core Stability',
    jointActions: ['Isometric Core Contraction'],
    muscles: [
      { name: 'Rectus abdominis', activation: 100 },
      { name: 'Obliques', activation: 80 },
      { name: 'Transverse abdominis', activation: 90 }
    ]
  },
  {
    id: 'plank-bodyweight',
    name: 'Plank',
    category: 'Bodyweight',
    description: 'Isometric core hold using bodyweight. Essential for core strength and stability.',
    movementPlane: 'Isometric',
    resistanceCurve: 'Consistent',
    stabilization: 10,
    planeOfMotion: 'Core Stability',
    jointActions: ['Isometric Core Contraction'],
    muscles: [
      { name: 'Rectus abdominis', activation: 100 },
      { name: 'Obliques', activation: 80 },
      { name: 'Transverse abdominis', activation: 90 }
    ]
  },
  {
    id: 'crunch-generic',
    name: 'Crunch',
    category: 'Exercise',
    description: 'Isolation movement for the rectus abdominis.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 2,
    planeOfMotion: 'Spinal Flexion',
    jointActions: ['Spinal Flexion'],
    muscles: [
      { name: 'Rectus abdominis', activation: 100 }
    ]
  },
  {
    id: 'crunch-bodyweight',
    name: 'Crunch',
    category: 'Bodyweight',
    description: 'Standard abdominal crunch using bodyweight.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 2,
    planeOfMotion: 'Spinal Flexion',
    jointActions: ['Spinal Flexion'],
    muscles: [
      { name: 'Rectus abdominis', activation: 100 }
    ]
  },
  {
    id: 'leg-raise-generic',
    name: 'Leg Raise',
    category: 'Exercise',
    description: 'Core exercise targeting the lower abdominals and hip flexors.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Hip Flexion',
    jointActions: ['Hip Flexion', 'Spinal Flexion'],
    muscles: [
      { name: 'Rectus abdominis', activation: 100 },
      { name: 'Iliopsoas', activation: 90 }
    ]
  },
  {
    id: 'leg-raise-bodyweight',
    name: 'Leg Raise',
    category: 'Bodyweight',
    description: 'Lying or hanging leg raises using bodyweight.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 6,
    planeOfMotion: 'Hip Flexion',
    jointActions: ['Hip Flexion', 'Spinal Flexion'],
    muscles: [
      { name: 'Rectus abdominis', activation: 100 },
      { name: 'Iliopsoas', activation: 90 }
    ]
  },
  // =========================================================================
  // LEG CURL (SEATED) VARIANTS
  // =========================================================================
  {
    id: 'seated-leg-curl-machine',
    name: 'Seated Leg Curl',
    category: 'Machine',
    description: 'Selectorized seated leg curl machine. Provides excellent isolation and stability for the hamstrings. Targets the hamstrings in a more lengthened hip position than lying curls.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Knee Flexion',
    jointActions: ['Knee Flexion'],
    muscles: [
      { name: 'Hamstrings', activation: 100 }
    ]
  },
  // =========================================================================
  // HIP ABDUCTION/ADDUCTION VARIANTS
  // =========================================================================
  {
    id: 'hip-abduction-generic',
    name: 'Hip Abduction',
    category: 'Exercise',
    description: 'Isolation movement for the hip abductors (gluteus medius/minimus).',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Hip Abduction',
    jointActions: ['Hip Abduction'],
    muscles: [
      { name: 'Gluteus medius', activation: 100 },
      { name: 'Gluteus minimus', activation: 90 },
      { name: 'Tensor fasciae latae', activation: 70 }
    ]
  },
  {
    id: 'hip-abduction-machine',
    name: 'Hip Abduction',
    category: 'Machine',
    description: 'Selectorized hip abduction machine. Targets the outer glutes with high stability.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Hip Abduction',
    jointActions: ['Hip Abduction'],
    muscles: [
      { name: 'Gluteus medius', activation: 100 },
      { name: 'Gluteus minimus', activation: 90 },
      { name: 'Tensor fasciae latae', activation: 70 }
    ]
  },
  {
    id: 'hip-adduction-generic',
    name: 'Hip Adduction',
    category: 'Exercise',
    description: 'Isolation movement for the hip adductors.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Hip Adduction',
    jointActions: ['Hip Adduction'],
    muscles: [
      { name: 'Adductor magnus', activation: 100 },
      { name: 'Adductor longus', activation: 90 },
      { name: 'Gracilis', activation: 80 }
    ]
  },
  {
    id: 'hip-adduction-machine',
    name: 'Hip Adduction',
    category: 'Machine',
    description: 'Selectorized hip adduction machine. Targets the inner thighs with high stability.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Hip Adduction',
    jointActions: ['Hip Adduction'],
    muscles: [
      { name: 'Adductor magnus', activation: 100 },
      { name: 'Adductor longus', activation: 90 },
      { name: 'Gracilis', activation: 80 }
    ]
  },
  // =========================================================================
  // OVERHEAD EXTENSION (ADDITIONAL) VARIANTS
  // =========================================================================
  {
    id: 'overhead-ext-generic',
    name: 'Overhead Extension',
    category: 'Exercise',
    description: 'Vertical elbow extension. Targets the long head of the triceps in a stretched position.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Elbow Extension',
    jointActions: ['Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 }
    ]
  },
  {
    id: 'overhead-ext-machine',
    name: 'Overhead Extension',
    category: 'Machine',
    description: 'Selectorized overhead tricep extension machine. Provides maximum stability for isolating the long head.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Elbow Extension',
    jointActions: ['Elbow Extension'],
    muscles: [
      { name: 'Triceps brachii', activation: 100 }
    ]
  },
  // =========================================================================
  // FRONT RAISE VARIANTS
  // =========================================================================
  {
    id: 'front-raise-generic',
    name: 'Front Raise',
    category: 'Exercise',
    description: 'Shoulder flexion isolation. Targets the anterior deltoid.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Ascending',
    stabilization: 4,
    planeOfMotion: 'Shoulder Flexion',
    jointActions: ['Shoulder Flexion'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Lateral deltoid', activation: 40 },
      { name: 'Upper trapezius', activation: 30 }
    ]
  },
  {
    id: 'front-raise-dumbbell',
    name: 'Front Raise',
    category: 'Dumbbell',
    description: 'Shoulder flexion with dumbbells. Allows for independent arm movement and varied grips.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Ascending',
    stabilization: 4,
    planeOfMotion: 'Shoulder Flexion',
    jointActions: ['Shoulder Flexion'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Lateral deltoid', activation: 40 }
    ]
  },
  {
    id: 'front-raise-barbell',
    name: 'Front Raise',
    category: 'Barbell',
    description: 'Shoulder flexion with a barbell. Allows for heavier loading but fixed hand position.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Ascending',
    stabilization: 5,
    planeOfMotion: 'Shoulder Flexion',
    jointActions: ['Shoulder Flexion'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Lateral deltoid', activation: 30 }
    ]
  },
  {
    id: 'front-raise-cable',
    name: 'Front Raise',
    category: 'Cable',
    description: 'Shoulder flexion with constant cable tension. Overloads the anterior deltoid throughout the ROM.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Shoulder Flexion',
    jointActions: ['Shoulder Flexion'],
    muscles: [
      { name: 'Anterior deltoid', activation: 100 },
      { name: 'Lateral deltoid', activation: 40 }
    ]
  },
  // =========================================================================
  // INCLINE PRESS VARIANTS
  // =========================================================================
  {
    id: 'incline-press-generic',
    name: 'Incline Press',
    category: 'Exercise',
    description: 'Horizontal pressing movement at an incline. Biases the clavicular head of the pectoralis major.',
    movementPlane: 'Transverse/Frontal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 80 },
      { name: 'Triceps brachii', activation: 70 }
    ]
  },
  {
    id: 'incline-press-barbell',
    name: 'Incline Press',
    category: 'Barbell',
    description: 'Barbell press on an incline bench. Excellent for building upper chest mass.',
    movementPlane: 'Transverse/Frontal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 80 },
      { name: 'Triceps brachii', activation: 75 }
    ]
  },
  {
    id: 'incline-press-dumbbell',
    name: 'Incline Press',
    category: 'Dumbbell',
    description: 'Dumbbell press on an incline bench. Independent arms allow for a greater ROM and converging path.',
    movementPlane: 'Transverse/Frontal',
    resistanceCurve: 'Descending',
    stabilization: 7,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 75 },
      { name: 'Triceps brachii', activation: 70 }
    ]
  },
  {
    id: 'incline-press-smith',
    name: 'Incline Press',
    category: 'Smith Machine',
    description: 'Fixed-path incline press. Allows for heavy loading with reduced stabilization needs.',
    movementPlane: 'Transverse/Frontal',
    resistanceCurve: 'Descending',
    stabilization: 2,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 70 },
      { name: 'Triceps brachii', activation: 65 }
    ]
  },
  {
    id: 'incline-press-machine',
    name: 'Incline Press',
    category: 'Machine',
    description: 'Selectorized incline press machine. Provides maximum stability for isolating the upper chest.',
    movementPlane: 'Transverse/Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Horizontal Push',
    jointActions: ['Shoulder Horizontal Adduction', 'Elbow Extension'],
    muscles: [
      { name: 'Pectoralis major', activation: 100 },
      { name: 'Anterior deltoid', activation: 60 },
      { name: 'Triceps brachii', activation: 60 }
    ]
  },
  // =========================================================================
  // LAT PULLDOWN (GRIP) VARIANTS
  // =========================================================================
  {
    id: 'wide-lat-pulldown-generic',
    name: 'Wide Grip Lat Pulldown',
    category: 'Exercise',
    description: 'Lat pulldown with a wide grip. Biases the frontal plane and targets the upper/outer lats and teres major.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Adduction', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Teres major', activation: 90 },
      { name: 'Biceps brachii', activation: 70 }
    ]
  },
  {
    id: 'wide-lat-pulldown-cable',
    name: 'Wide Grip Lat Pulldown',
    category: 'Cable',
    description: 'Wide grip pulldown using a cable machine. Constant tension on the lats.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Adduction', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Teres major', activation: 90 },
      { name: 'Biceps brachii', activation: 70 }
    ]
  },
  {
    id: 'wide-lat-pulldown-machine',
    name: 'Wide Grip Lat Pulldown',
    category: 'Machine',
    description: 'Fixed-path wide grip pulldown. Maximizes stability for isolating the lats.',
    movementPlane: 'Frontal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Adduction', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Teres major', activation: 80 },
      { name: 'Biceps brachii', activation: 60 }
    ]
  },
  {
    id: 'narrow-lat-pulldown-generic',
    name: 'Narrow Grip Lat Pulldown',
    category: 'Exercise',
    description: 'Lat pulldown with a narrow/neutral grip. Biases the sagittal plane and targets the lower lats.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Descending',
    stabilization: 5,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Extension', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 85 },
      { name: 'Brachialis', activation: 70 }
    ]
  },
  {
    id: 'narrow-lat-pulldown-cable',
    name: 'Narrow Grip Lat Pulldown',
    category: 'Cable',
    description: 'Narrow grip pulldown using a cable machine. Constant tension through a large ROM.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Extension', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 85 },
      { name: 'Brachialis', activation: 70 }
    ]
  },
  {
    id: 'narrow-lat-pulldown-machine',
    name: 'Narrow Grip Lat Pulldown',
    category: 'Machine',
    description: 'Fixed-path narrow grip pulldown. Maximizes stability for heavy loading.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Pull',
    jointActions: ['Shoulder Extension', 'Elbow Flexion'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 75 },
      { name: 'Brachialis', activation: 60 }
    ]
  },
  // =========================================================================
  // KELSO SHRUG VARIANTS
  // =========================================================================
  {
    id: 'kelso-shrug-generic',
    name: 'Kelso Shrug',
    category: 'Exercise',
    description: 'Scapular retraction isolation performed while bent over. Targets the mid/lower traps and rhomboids.',
    movementPlane: 'Sagittal/Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 5,
    planeOfMotion: 'Scapular Retraction',
    jointActions: ['Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Lower trapezius', activation: 90 },
      { name: 'Rhomboids', activation: 95 }
    ]
  },
  {
    id: 'kelso-shrug-barbell',
    name: 'Kelso Shrug',
    category: 'Barbell',
    description: 'Kelso shrug performed with a barbell. Allows for heavy loading of the mid-back.',
    movementPlane: 'Sagittal/Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 6,
    planeOfMotion: 'Scapular Retraction',
    jointActions: ['Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Lower trapezius', activation: 80 },
      { name: 'Rhomboids', activation: 90 }
    ]
  },
  {
    id: 'kelso-shrug-dumbbell',
    name: 'Kelso Shrug',
    category: 'Dumbbell',
    description: 'Kelso shrug performed with dumbbells. Allows for a more natural hand position and independent movement.',
    movementPlane: 'Sagittal/Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 5,
    planeOfMotion: 'Scapular Retraction',
    jointActions: ['Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Lower trapezius', activation: 90 },
      { name: 'Rhomboids', activation: 95 }
    ]
  },
  {
    id: 'kelso-shrug-cable',
    name: 'Kelso Shrug',
    category: 'Cable',
    description: 'Kelso shrug using a cable machine. Provides constant tension throughout the scapular retraction.',
    movementPlane: 'Sagittal/Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Scapular Retraction',
    jointActions: ['Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Lower trapezius', activation: 90 },
      { name: 'Rhomboids', activation: 95 }
    ]
  },
  {
    id: 'kelso-shrug-machine',
    name: 'Kelso Shrug',
    category: 'Machine',
    description: 'Selectorized machine for Kelso shrugs. Maximizes stability for isolating the mid-back musculature.',
    movementPlane: 'Sagittal/Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Scapular Retraction',
    jointActions: ['Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Lower trapezius', activation: 80 },
      { name: 'Rhomboids', activation: 90 }
    ]
  },
  {
    id: 'kelso-shrug-smith',
    name: 'Kelso Shrug',
    category: 'Smith Machine',
    description: 'Kelso shrug performed on a Smith machine. Fixed path allows for heavy loading with high stability.',
    movementPlane: 'Sagittal/Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 2,
    planeOfMotion: 'Scapular Retraction',
    jointActions: ['Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Lower trapezius', activation: 80 },
      { name: 'Rhomboids', activation: 90 }
    ]
  },
  // =========================================================================
  // REAR DELT FLY VARIANTS
  // =========================================================================
  {
    id: 'rear-delt-fly-generic',
    name: 'Rear Delt Fly',
    category: 'Exercise',
    description: 'Shoulder horizontal abduction isolation. Targets the posterior deltoid.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Ascending',
    stabilization: 3,
    planeOfMotion: 'Shoulder Horizontal Abduction',
    jointActions: ['Shoulder Horizontal Abduction'],
    muscles: [
      { name: 'Posterior deltoid', activation: 100 },
      { name: 'Lateral deltoid', activation: 40 },
      { name: 'Middle trapezius', activation: 50 },
      { name: 'Rhomboids', activation: 50 }
    ]
  },
  {
    id: 'rear-delt-fly-dumbbell',
    name: 'Rear Delt Fly',
    category: 'Dumbbell',
    description: 'Rear delt fly with dumbbells. Peak torque at the top of the movement.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Ascending',
    stabilization: 4,
    planeOfMotion: 'Shoulder Horizontal Abduction',
    jointActions: ['Shoulder Horizontal Abduction'],
    muscles: [
      { name: 'Posterior deltoid', activation: 100 },
      { name: 'Middle trapezius', activation: 50 },
      { name: 'Rhomboids', activation: 50 }
    ]
  },
  {
    id: 'rear-delt-fly-cable',
    name: 'Rear Delt Fly',
    category: 'Cable',
    description: 'Rear delt fly using cables. Constant tension throughout the ROM.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Shoulder Horizontal Abduction',
    jointActions: ['Shoulder Horizontal Abduction'],
    muscles: [
      { name: 'Posterior deltoid', activation: 100 },
      { name: 'Middle trapezius', activation: 60 },
      { name: 'Rhomboids', activation: 60 }
    ]
  },
  {
    id: 'rear-delt-fly-machine',
    name: 'Rear Delt Fly',
    category: 'Machine',
    description: 'Fixed-path rear delt fly (Reverse Pec Dec). Maximizes stability for isolating the posterior deltoid.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Shoulder Horizontal Abduction',
    jointActions: ['Shoulder Horizontal Abduction'],
    muscles: [
      { name: 'Posterior deltoid', activation: 100 },
      { name: 'Middle trapezius', activation: 40 },
      { name: 'Rhomboids', activation: 40 }
    ]
  },
  // =========================================================================
  // LAT ROW VARIANTS
  // =========================================================================
  {
    id: 'lat-row-generic',
    name: 'Lat Row',
    category: 'Exercise',
    description: 'Horizontal pull biased towards shoulder extension. Targets the lats with minimal scapular retraction.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 5,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Extension'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 60 }
    ]
  },
  {
    id: 'lat-row-barbell',
    name: 'Lat Row',
    category: 'Barbell',
    description: 'Bent over row with a focus on pulling to the hips to bias the lats.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 7,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Extension'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Erector spinae', activation: 80 }
    ]
  },
  {
    id: 'lat-row-dumbbell',
    name: 'Lat Row',
    category: 'Dumbbell',
    description: 'Single arm dumbbell row with a focus on shoulder extension and pulling to the hip.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 5,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Extension'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 60 }
    ]
  },
  {
    id: 'lat-row-cable',
    name: 'Lat Row',
    category: 'Cable',
    description: 'Cable row with a focus on shoulder extension to isolate the lats.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Extension'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 60 }
    ]
  },
  {
    id: 'lat-row-machine',
    name: 'Lat Row',
    category: 'Machine',
    description: 'Fixed-path row machine designed to bias the lats through shoulder extension.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Extension'],
    muscles: [
      { name: 'Latissimus dorsi', activation: 100 },
      { name: 'Biceps brachii', activation: 50 }
    ]
  },
  // =========================================================================
  // UPPER BACK ROW VARIANTS
  // =========================================================================
  {
    id: 'upper-back-row-generic',
    name: 'Upper Back Row',
    category: 'Exercise',
    description: 'Horizontal pull biased towards scapular retraction and horizontal abduction. Targets traps and rhomboids.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 5,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Horizontal Abduction', 'Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Rhomboids', activation: 100 },
      { name: 'Rear deltoid', activation: 80 }
    ]
  },
  {
    id: 'upper-back-row-barbell',
    name: 'Upper Back Row',
    category: 'Barbell',
    description: 'Bent over row with a wide grip and elbows out to bias the upper back.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 7,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Horizontal Abduction', 'Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Rhomboids', activation: 100 },
      { name: 'Erector spinae', activation: 80 }
    ]
  },
  {
    id: 'upper-back-row-dumbbell',
    name: 'Upper Back Row',
    category: 'Dumbbell',
    description: 'Dumbbell row with elbows flared to bias the upper back musculature.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 5,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Horizontal Abduction', 'Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Rhomboids', activation: 100 },
      { name: 'Rear deltoid', activation: 80 }
    ]
  },
  {
    id: 'upper-back-row-cable',
    name: 'Upper Back Row',
    category: 'Cable',
    description: 'Cable row with a wide bar and elbows flared to target the upper back.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 4,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Horizontal Abduction', 'Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Rhomboids', activation: 100 },
      { name: 'Rear deltoid', activation: 80 }
    ]
  },
  {
    id: 'upper-back-row-machine',
    name: 'Upper Back Row',
    category: 'Machine',
    description: 'Fixed-path row machine designed to bias the upper back through scapular retraction.',
    movementPlane: 'Transverse',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Horizontal Pull',
    jointActions: ['Shoulder Horizontal Abduction', 'Scapular Retraction'],
    muscles: [
      { name: 'Middle trapezius', activation: 100 },
      { name: 'Rhomboids', activation: 100 },
      { name: 'Rear deltoid', activation: 70 }
    ]
  },
  // =========================================================================
  // HACK SQUAT VARIANTS
  // =========================================================================
  {
    id: 'hack-squat-generic',
    name: 'Hack Squat',
    category: 'Exercise',
    description: 'Machine-based squat variant with a fixed path and angled platform. Targets the quadriceps intensely with high stability.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 70 },
      { name: 'Adductor magnus', activation: 60 }
    ]
  },
  {
    id: 'hack-squat-machine',
    name: 'Hack Squat',
    category: 'Machine',
    description: 'Standard hack squat machine. Provides a stable environment for deep knee flexion and quad isolation.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 70 },
      { name: 'Adductor magnus', activation: 60 }
    ]
  },
  {
    id: 'hack-squat-plate-loaded',
    name: 'Hack Squat',
    category: 'Machine',
    description: 'Plate-loaded hack squat machine. Allows for heavy progressive overload with a natural strength curve.',
    movementPlane: 'Sagittal',
    resistanceCurve: 'Consistent',
    stabilization: 1,
    planeOfMotion: 'Vertical Column',
    jointActions: ['Knee Extension', 'Hip Extension'],
    muscles: [
      { name: 'Quadriceps', activation: 100 },
      { name: 'Gluteus maximus', activation: 70 },
      { name: 'Adductor magnus', activation: 60 }
    ]
  }
];

