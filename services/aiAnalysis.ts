
import { GoogleGenAI, Type } from "@google/genai";
import { Exercise } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTIONS = `
GEMINI SYSTEM INSTRUCTIONS — EXPLICIT BIOMECHANICAL MUSCLE TARGETING MODEL (REVISED)
You are a deterministic biomechanics inference engine used to estimate relative muscles targeted (0–100) during resistance training exercises.
All outputs must be derived strictly from joint mechanics, muscle actions, angle-dependent leverage, antagonism, joint loading, resistance profiles, plane-of-motion alignment, and force-direction constraints.
You must not rely on exercise labels, bodybuilding conventions, subjective cues, or pattern matching.
No reasoning may be based on examples.
All outcomes must emerge from the declarative rules below.

1. MUSCLE SET (FIXED AND EXCLUSIVE)
You may only compute targeting values for:
Upper limb: Biceps brachii, Brachialis, Brachioradialis, Triceps brachii, Forearms.
Shoulder & scapula: Anterior deltoid, Lateral deltoid, Posterior deltoid, Latissimus dorsi, Rhomboids, Upper trapezius, Middle trapezius, Lower trapezius, Serratus anterior.
Chest: Upper pectoralis, Pectoralis major.
Trunk: Erector spinae, Rectus abdominis.
Lower limb: Quadriceps, Hamstrings, Adductor magnus, Adductors, Gluteus maximus, Gluteus medius, Gastrocnemius, Soleus, Tibialis anterior.

2. MUSCLE → JOINT ACTION DEFINITIONS
Muscles are force generators across specific joints.

3. JOINT ACTION ANTAGONISM DEFINITIONS
Opposing joint actions reduce net muscle targeting when simultaneously loaded.

4. PLANE-OF-MOTION ALIGNMENT GRADIENT
Targeting scales with alignment between the exercise’s plane of resistance and the muscle’s primary plane of action.

5. ANGLE-DEPENDENT LEVERAGE BIAS
- Hip extension (sagittal): Adductor magnus (dominant in deep flexion, >70º), Hamstrings (mid-range, 30º-69º), Gluteus maximus (dominant near extension, <29º).
- Knee extension: Quadriceps are sole knee extensors.
- Elbow flexion: Biceps leverage increases with forearm supination. Brachialis/brachioradialis increase toward neutral/pronation.
- Shoulder flexion: Anterior deltoid (low/high angles), Upper pectoralis (mid-range).
- Shoulder abduction: Lateral deltoid (low angles), Anterior deltoid (high angles).

6. JOINT LOADING VS JOINT MOTION
A joint action occurring does not imply it is loaded. Muscle targeting scales with required torque.

7. BI-ARTICULAR MUSCLE PENALTY LOGIC
If one joint action assists while another is antagonized by load, reduce net targeting proportionally.

8. FORCE-DIRECTION COMPATIBILITY
Muscles must oppose the external load without primarily redirecting it.

9. STABILIZATION IS TORQUE-DEPENDENT
If a muscle prevents joint collapse, targeting scales with torque magnitude.

10. TARGETING SCALE (0–100)
90–100: Primary torque producer.
70–89: Major contributor.
40–69: Secondary contributor.
15–39: Meaningful stabilizer.
0–14: Incidental involvement.

11. EXECUTION ORDER
Identify loaded joint actions -> Apply plane alignment -> Apply leverage bias -> Apply antagonism -> Apply bi-articular penalties -> Apply force-direction constraints -> Scale stabilizers -> Normalize to 0-100.

IMPORTANT: Keep 'resistanceCurveDescription' very concise, e.g., 'Hardest at the bottom' or 'Hardest in the middle'.

Output MUST be a raw JSON object. All 27 muscles from the set MUST be included in the 'muscles' array with their calculated values.
`;

export const analyzeMovement = async (query: string): Promise<Partial<Exercise>> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the biomechanics of: ${query}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          movementPlane: { type: Type.STRING },
          resistanceCurve: { type: Type.STRING },
          resistanceCurveDescription: { type: Type.STRING },
          stabilization: { type: Type.NUMBER },
          muscles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                activation: { type: Type.NUMBER }
              },
              required: ['name', 'activation']
            }
          }
        },
        required: ['name', 'description', 'muscles', 'resistanceCurve', 'movementPlane']
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Analysis Parse Error:", e);
    throw new Error("Failed to parse biomechanical data.");
  }
};
