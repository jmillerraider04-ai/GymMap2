
import React, { useState, useEffect, useMemo, useRef } from 'react';
import BioMan, { Posture, Vector3, VisualForce, VisualConstraint, VisualPlane } from '../components/BioMan';
import { Settings2, RotateCcw, MousePointerClick, Move3d, Copy, Anchor, Lock, Split, Play, Pause, Zap, Scale, Gauge, ChevronLeft, AlertCircle, ArrowDownUp, RefreshCw, ChevronRight, BrainCircuit, Axis3d, Plus, Trash2, Globe2, X, CheckCircle2 } from 'lucide-react';

const DEFAULT_POSTURE: Posture = {
  lClavicle: { x: -25, y: 0, z: 0 },
  rClavicle: { x: 25, y: 0, z: 0 },
  lHumerus: { x: 0, y: 1, z: 0 },
  lForearm: { x: 0, y: 1, z: 0 },
  rHumerus: { x: 0, y: 1, z: 0 },
  rForearm: { x: 0, y: 1, z: 0 },
  lFemur: { x: 0, y: 1, z: 0 },
  lTibia: { x: 0, y: 1, z: 0 },
  lFoot: { x: 0, y: 0, z: -1 },
  rFemur: { x: 0, y: 1, z: 0 },
  rTibia: { x: 0, y: 1, z: 0 },
  rFoot: { x: 0, y: 0, z: -1 },
};

const DEFAULT_TWISTS: Record<string, number> = {
  lHumerus: 0, rHumerus: 0,
  lFemur: 0, rFemur: 0,
  lForearm: 0, rForearm: 0,
  lTibia: 0, rTibia: 0,
  lFoot: 0, rFoot: 0
};

const ROTATION_LIMITS: Record<string, { min: number, max: number }> = {
  lHumerus: { min: -90, max: 90 }, // Neg=Internal, Pos=External
  rHumerus: { min: -90, max: 90 },
  lFemur: { min: -45, max: 45 },
  rFemur: { min: -45, max: 45 },
  lForearm: { min: -90, max: 90 },
  rForearm: { min: -90, max: 90 },
  lTibia: { min: -20, max: 20 },
  rTibia: { min: -20, max: 20 }
};

const BONE_NAMES: Record<string, string> = {
  spine: 'Spine',
  lClavicle: 'Left Scapula',
  rClavicle: 'Right Scapula',
  lHumerus: 'Left Upper Arm',
  lForearm: 'Left Forearm',
  rHumerus: 'Right Upper Arm',
  rForearm: 'Right Forearm',
  lFemur: 'Left Thigh',
  lTibia: 'Left Shin',
  lFoot: 'Left Foot',
  rFemur: 'Right Thigh',
  rTibia: 'Right Shin',
  rFoot: 'Right Foot',
};

const BONE_LENGTHS: Record<string, number> = {
  lClavicle: 25, rClavicle: 25,
  lHumerus: 44, lForearm: 39,
  rHumerus: 44, rForearm: 39,
  lFemur: 54, lTibia: 49, lFoot: 20,
  rFemur: 54, rTibia: 49, rFoot: 20
};

const CONFIG = {
  TORSO_LEN: 60,
  HIP_WIDTH: 20
};

const BONE_CONSTRAINTS: Record<string, { x?: [number, number], y?: [number, number], z?: [number, number] }> = {
  lFemur: { x: [-1, 1], y: [-1, 1], z: [-1, 1] },
  rFemur: { x: [-1, 1], y: [-1, 1], z: [-1, 1] },
  lHumerus: { x: [-1, 1], y: [-1, 1], z: [-1, 1] },
  rHumerus: { x: [-1, 1], y: [-1, 1], z: [-1, 1] },
  lTibia: { x: [-0.5, 0.5], y: [-1, 1], z: [-1, 1] }, 
  rTibia: { x: [-0.5, 0.5], y: [-1, 1], z: [-1, 1] },
  lForearm: { x: [-0.5, 0.5], y: [-1, 1], z: [-1, 1] },
  rForearm: { x: [-0.5, 0.5], y: [-1, 1], z: [-1, 1] },
  lFoot: { x: [-0.3, 0.3], y: [-0.7, 0.7], z: [-1, 0.1] },
  rFoot: { x: [-0.3, 0.3], y: [-0.7, 0.7], z: [-1, 0.1] },
  lClavicle: { x: [-25, -25], y: [-15, 10], z: [-15, 10] },
  rClavicle: { x: [25, 25], y: [-15, 10], z: [-15, 10] }
};

interface Measurement {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
  isDim?: boolean;
}

interface ForceConfig {
    id: string;
    name: string;
    boneId: string; 
    position: number;
    x: number;
    y: number;
    z: number;
    magnitude: number;
    mirrorId?: string;
}

interface ConstraintConfig {
    id: string;
    type: 'vector' | 'path';
    boneId: string;
    position: number;
    mirrorId?: string;
    restrictions: Vector3[];
}

interface PlanarConstraint {
    id: string;
    active: boolean;
    normal: Vector3;
    center: Vector3;
}

interface Frame {
    x: Vector3;
    y: Vector3;
    z: Vector3;
}

type JointGroup = 'Shoulder' | 'Elbow' | 'Hip' | 'Knee' | 'Ankle' | 'Scapula' | 'Spine';

interface CapacityConfig {
    base: number;
    specific: number;
    angle: number;
}

interface JointCapacityProfile {
    [action: string]: CapacityConfig;
}

const createCap = (base: number, specific: number = base, angle: number = 90): CapacityConfig => ({ base, specific, angle });

const DEFAULT_CAPACITIES: Record<JointGroup, JointCapacityProfile> = {
    'Shoulder': {
        'flexion': createCap(40, 80, 0),
        'extension': createCap(50, 95, 45),
        'abduction': createCap(35, 70, 75),
        'adduction': createCap(50, 95, 75),
        'horizontalAbduction': createCap(35, 65, 90),
        'horizontalAdduction': createCap(45, 90, 90),
        'internalRotation': createCap(40, 70, 0),
        'externalRotation': createCap(25, 45, 0)
    },
    'Elbow': {
        'flexion': createCap(30, 60, 90),
        'extension': createCap(40, 75, 75),
    },
    'Hip': {
        'flexion': createCap(55, 110, 0),
        'extension': createCap(95, 215, 40),
        'abduction': createCap(90, 150, 20),
        'adduction': createCap(75, 125, 0),
        'internalRotation': createCap(35, 60, 0),
        'externalRotation': createCap(30, 50, 0)
    },
    'Knee': {
        'flexion': createCap(45, 105, 40),
        'extension': createCap(75, 165, 60),
    },
    'Ankle': {
        'plantarflexion': createCap(65, 105, 15),
        'dorsiflexion': createCap(35, 35, 0)
    },
    'Scapula': {
        'elevation': createCap(40, 65, 0),
        'depression': createCap(25, 45, 0),
        'protraction': createCap(25, 45, 0),
        'retraction': createCap(30, 55, 0)
    },
    'Spine': {
        'flexion': createCap(110, 190, 0),
        'extension': createCap(140, 260, 25),
        'lateralFlexion': createCap(70, 130, 0),
        'rotation': createCap(70, 120, 0)
    }
};

const normalize = (v: Vector3): Vector3 => {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 1, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};

const crossProduct = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});

const dotProduct = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const magnitude = (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

// --- VECTOR MATH HELPERS ---
const sub = (a: Vector3, b: Vector3) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vector3, b: Vector3) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (v: Vector3, s: number) => ({ x: v.x * s, y: v.y * s, z: v.z * s });

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const rotateAroundAxis = (v: Vector3, axis: Vector3, angleDeg: number): Vector3 => {
  if (Math.abs(angleDeg) < 0.001) return v;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const k = normalize(axis);
  const kDotV = dotProduct(k, v);
  const kxV = crossProduct(k, v);
  const oneMinusCos = 1 - cos;
  
  return {
      x: v.x*cos + kxV.x*sin + k.x*kDotV*oneMinusCos,
      y: v.y*cos + kxV.y*sin + k.y*kDotV*oneMinusCos,
      z: v.z*cos + kxV.z*sin + k.z*kDotV*oneMinusCos
  };
};

const applyShortestArcRotation = (src: Vector3, dst: Vector3, toRotate: Vector3): Vector3 => {
  const s = normalize(src);
  const d = normalize(dst);
  const dot = dotProduct(s, d);
  if (dot > 0.9999) return toRotate;
  if (dot < -0.9999) {
      let axis = { x: 1, y: 0, z: 0 };
      if (Math.abs(s.x) > 0.9) axis = { x: 0, y: 1, z: 0 };
      const proj = dotProduct(axis, s);
      axis = { x: axis.x - s.x*proj, y: axis.y - s.y*proj, z: axis.z - s.z*proj };
      return rotateAroundAxis(toRotate, axis, 180);
  }
  const axis = crossProduct(s, d);
  const angleDeg = Math.acos(dot) * 180 / Math.PI;
  return rotateAroundAxis(toRotate, axis, angleDeg);
};

const getOppositeBone = (boneId: string): string | null => {
    if (boneId.startsWith('l')) return 'r' + boneId.slice(1);
    if (boneId.startsWith('r')) return 'l' + boneId.slice(1);
    return null;
};

// --- MATH HELPERS FOR IK ---
const createRootFrame = (dir: Vector3 = {x: 0, y: 1, z: 0}): Frame => {
    const u = normalize(dir);
    const neutralUp = { x: 0, y: 1, z: 0 };
    const neutralRight = { x: 1, y: 0, z: 0 };
    const neutralBack = { x: 0, y: 0, z: 1 };
    const right = applyShortestArcRotation(neutralUp, u, neutralRight);
    const back = applyShortestArcRotation(neutralUp, u, neutralBack);
    return { x: right, y: u, z: back };
};
const twistFrame = (frame: Frame, angleDeg: number): Frame => {
    if (!angleDeg || angleDeg === 0) return frame;
    return { x: rotateAroundAxis(frame.x, frame.y, angleDeg), y: frame.y, z: rotateAroundAxis(frame.z, frame.y, angleDeg) };
};
const localToWorld = (parentFrame: Frame, localVec: Vector3): Vector3 => {
    return {
        x: localVec.x * parentFrame.x.x + localVec.y * parentFrame.y.x + localVec.z * parentFrame.z.x,
        y: localVec.x * parentFrame.x.y + localVec.y * parentFrame.y.y + localVec.z * parentFrame.z.y,
        z: localVec.x * parentFrame.x.z + localVec.y * parentFrame.y.z + localVec.z * parentFrame.z.z
    };
};
const worldToLocal = (parentFrame: Frame, worldVec: Vector3): Vector3 => {
    return {
        x: dotProduct(worldVec, parentFrame.x),
        y: dotProduct(worldVec, parentFrame.y),
        z: dotProduct(worldVec, parentFrame.z)
    };
};
const transportFrame = (prevFrame: Frame, newDir: Vector3): Frame => {
    const u = normalize(newDir);
    const newRight = applyShortestArcRotation(prevFrame.y, u, prevFrame.x);
    const newBack = applyShortestArcRotation(prevFrame.y, u, prevFrame.z);
    return { x: newRight, y: u, z: newBack };
};

const solveTwoBoneIK = (
    root: Vector3, 
    target: Vector3, 
    l1: number, 
    l2: number, 
    pole: Vector3 
): { vec1: Vector3, vec2: Vector3 } | null => {
    const axis = normalize(sub(target, root));
    const dist = magnitude(sub(target, root));
    
    if (dist > l1 + l2 - 0.001) {
        // Unreachable: point at target
        return { vec1: axis, vec2: axis }; 
    }
    
    // Law of cosines to find angle at joint 1
    const cosAlpha = (l1*l1 + dist*dist - l2*l2) / (2 * l1 * dist);
    const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
    
    // Plane normal
    let normal = normalize(crossProduct(axis, pole));
    if (magnitude(normal) < 0.01) {
         // Pole is collinear with axis
         normal = normalize(crossProduct(axis, {x:0, y:1, z:0}));
    }
    
    // Rotate axis by alpha around normal to get bone1
    const vec1 = rotateAroundAxis(axis, normal, alpha * 180 / Math.PI);
    
    // Calculate Joint Position
    const jointPos = add(root, mul(vec1, l1));
    
    // Vec2 is direction from Joint to Target
    const vec2Global = normalize(sub(target, jointPos));
    
    return { vec1, vec2: vec2Global };
};

// --- ROTATION UTILS ---
const getAbsoluteRotation = (boneId: string, currentPosture: Posture, currentTwists: Record<string, number>): number => {
    return currentTwists[boneId] || 0;
};

// --- INTERPOLATION UTILS ---
const interpolateVector = (start: Vector3, end: Vector3, t: number): Vector3 => ({
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
});

const interpolateScalar = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
};

const mirrorPosture = (posture: Posture, sourceBoneId: string): Posture => {
    const isLeft = sourceBoneId.startsWith('l');
    const prefix = isLeft ? 'l' : 'r';
    const oppPrefix = isLeft ? 'r' : 'l';
    const next = { ...posture };
    Object.keys(posture).forEach(boneId => {
        if (boneId.startsWith(prefix)) {
            const opp = oppPrefix + boneId.slice(1);
            const vec = posture[boneId];
            if (vec) {
                next[opp] = { x: -vec.x, y: vec.y, z: vec.z };
            }
        }
    });
    return next;
};

const mirrorTwists = (twists: Record<string, number>, sourceBoneId: string): Record<string, number> => {
    const isLeft = sourceBoneId.startsWith('l');
    const prefix = isLeft ? 'l' : 'r';
    const oppPrefix = isLeft ? 'r' : 'l';
    const next = { ...twists };
    Object.keys(twists).forEach(boneId => {
        if (boneId.startsWith(prefix)) {
            const opp = oppPrefix + boneId.slice(1);
            // Negate twist for mirroring internal/external rotation
            next[opp] = -twists[boneId];
        }
    });
    return next;
};

const BioModelPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'kinematics' | 'kinetics' | 'constraints' | 'torque' | 'capacities' | 'dof'>('kinematics');
  const [poseMode, setPoseMode] = useState<'start' | 'end'>('start');
  const [startPosture, setStartPosture] = useState<Posture>(DEFAULT_POSTURE);
  const [endPosture, setEndPosture] = useState<Posture>(DEFAULT_POSTURE);
  const [startTwists, setStartTwists] = useState<Record<string, number>>(DEFAULT_TWISTS);
  const [endTwists, setEndTwists] = useState<Record<string, number>>(DEFAULT_TWISTS);
  const [posture, setPosture] = useState<Posture>(DEFAULT_POSTURE);
  const [twists, setTwists] = useState<Record<string, number>>(DEFAULT_TWISTS);
  const [selectedBone, setSelectedBone] = useState<string | null>(null);
  const [targetPos, setTargetPos] = useState<Vector3 | null>(null);
  const [targetReferenceBone, setTargetReferenceBone] = useState<string | null>(null);
  
  const [symmetryMode, setSymmetryMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | null>(null);
  const [forces, setForces] = useState<ForceConfig[]>([]);
  const [editingForceId, setEditingForceId] = useState<string | null>(null);
  const [constraints, setConstraints] = useState<ConstraintConfig[]>([]);
  const [editingConstraintId, setEditingConstraintId] = useState<string | null>(null);
  const [jointCapacities, setJointCapacities] = useState<Record<JointGroup, JointCapacityProfile>>(DEFAULT_CAPACITIES);
  
  const [reactionForces, setReactionForces] = useState<VisualForce[]>([]);
  const [calculatedTorques, setCalculatedTorques] = useState<Record<string, Vector3>>({});
  const [neuralCosts, setNeuralCosts] = useState<Record<string, number>>({});

  // UPDATED: Support array of constraints per bone
  const [hybridConstraints, setHybridConstraints] = useState<Record<string, PlanarConstraint[]>>({});
  const [bypassConstraints, setBypassConstraints] = useState(false);

  const calculateKinematics = (currentPosture: Posture, currentTwists: Record<string, number>) => {
    const locations: Record<string, Vector3> = {};
    const boneEndPoints: Record<string, Vector3> = {};
    const boneStartPoints: Record<string, Vector3> = {};
    const jointFrames: Record<string, Frame> = {};

    locations['Spine'] = { x: 0, y: CONFIG.TORSO_LEN/2, z: 0 };
    const neckBase = { x: 0, y: -CONFIG.TORSO_LEN/2, z: 0 }; 
    
    boneStartPoints['spine'] = neckBase;
    boneEndPoints['spine'] = locations['Spine'];

    const lClavOffset = currentPosture['lClavicle'] || { x: -25, y: 0, z: 0 };
    const rClavOffset = currentPosture['rClavicle'] || { x: 25, y: 0, z: 0 };

    locations['lShoulder'] = { x: neckBase.x + lClavOffset.x, y: neckBase.y + lClavOffset.y, z: neckBase.z + lClavOffset.z };
    locations['rShoulder'] = { x: neckBase.x + rClavOffset.x, y: neckBase.y + rClavOffset.y, z: neckBase.z + rClavOffset.z };
    
    boneEndPoints['lClavicle'] = locations['lShoulder'];
    boneEndPoints['rClavicle'] = locations['rShoulder'];

    locations['lHip'] = { x: -CONFIG.HIP_WIDTH, y: CONFIG.TORSO_LEN/2, z: 0 };
    locations['rHip'] = { x: CONFIG.HIP_WIDTH, y: CONFIG.TORSO_LEN/2, z: 0 };

    const rootFrame = createRootFrame({x: 0, y: 1, z: 0});
    jointFrames['lClavicle'] = rootFrame;
    jointFrames['rClavicle'] = rootFrame;
    jointFrames['lShoulder'] = rootFrame;
    jointFrames['rShoulder'] = rootFrame;
    jointFrames['lHip'] = rootFrame;
    jointFrames['rHip'] = rootFrame;

    const calculateChain = (name: string, child: string, grandChild: string, start: Vector3, parentFrame: Frame, len1: number, len2: number, len3: number) => {
        let frame1Base: Frame;
        const dir1Local = currentPosture[name];
        const dir1World = localToWorld(parentFrame, dir1Local);

        if (name.includes('Humerus')) {
            const u = normalize(dir1World);
            const neutralUp = { x: 0, y: 1, z: 0 };
            const neutralRight = { x: 1, y: 0, z: 0 };
            const neutralBack = { x: 0, y: 0, z: 1 };
            const right = applyShortestArcRotation(neutralUp, u, neutralRight);
            const back = applyShortestArcRotation(neutralUp, u, neutralBack);
            frame1Base = { x: mul(right, -1), y: u, z: mul(back, -1) };
        } else if (name.includes('Femur')) {
            frame1Base = createRootFrame(dir1World);
        } else {
            frame1Base = transportFrame(parentFrame, dir1World);
        }
        
        jointFrames[name] = parentFrame; 
        
        let twist = currentTwists[name] || 0;
        // Removed: if (name.startsWith('l')) twist = -twist; 
        // Mirroring is now handled by mirrorTwists and the coordinate system

        const frame1Twisted = twistFrame(frame1Base, twist);
        const end1 = { x: start.x + frame1Twisted.y.x * len1, y: start.y + frame1Twisted.y.y * len1, z: start.z + frame1Twisted.y.z * len1 };
        boneStartPoints[name] = start;
        boneEndPoints[name] = end1;
        
        jointFrames[child] = frame1Twisted;

        let end2 = end1;
        let frame2Twisted = frame1Twisted;
        if (child) {
            const dir2Local = currentPosture[child];
            const dir2World = localToWorld(frame1Twisted, dir2Local); 
            const frame2Base = transportFrame(frame1Twisted, dir2World);
            frame2Twisted = twistFrame(frame2Base, currentTwists[child] || 0);
            end2 = { x: end1.x + frame2Twisted.y.x * len2, y: end1.y + frame2Twisted.y.y * len2, z: end1.z + frame2Twisted.y.z * len2 };
            boneStartPoints[child] = end1;
            boneEndPoints[child] = end2;
            jointFrames[grandChild] = frame2Twisted;
        }
        if (grandChild) {
             const dir3Local = currentPosture[grandChild] || {x:0, y:0, z:1};
             const dir3World = localToWorld(frame2Twisted, dir3Local);
             const frame3Base = transportFrame(frame2Twisted, dir3World);
             const frame3Twisted = twistFrame(frame3Base, currentTwists[grandChild] || 0);
             const end3 = { x: end2.x + frame3Twisted.y.x * len3, y: end2.y + frame3Twisted.y.y * len3, z: end2.z + frame3Twisted.y.z * len3 };
             boneStartPoints[grandChild] = end2;
             boneEndPoints[grandChild] = end3;
        }
    };

    calculateChain('lFemur', 'lTibia', 'lFoot', locations['lHip'], rootFrame, BONE_LENGTHS.lFemur, BONE_LENGTHS.lTibia, BONE_LENGTHS.lFoot);
    calculateChain('rFemur', 'rTibia', 'rFoot', locations['rHip'], rootFrame, BONE_LENGTHS.rFemur, BONE_LENGTHS.rTibia, BONE_LENGTHS.rFoot);
    calculateChain('lHumerus', 'lForearm', '', locations['lShoulder'], rootFrame, BONE_LENGTHS.lHumerus, BONE_LENGTHS.lForearm, 0);
    calculateChain('rHumerus', 'rForearm', '', locations['rShoulder'], rootFrame, BONE_LENGTHS.rHumerus, BONE_LENGTHS.rForearm, 0);

    return { locations, boneEndPoints, boneStartPoints, jointFrames };
  };

  // Compute lockedPlanes for visualization
  const lockedPlanes = useMemo(() => {
    const planes: VisualPlane[] = [];
    const kinematics = calculateKinematics(posture, twists);
    (Object.entries(hybridConstraints) as [string, PlanarConstraint[]][]).forEach(([boneId, constraints]) => {
        if (!constraints) return;
        constraints.forEach(c => {
            if (c.active) {
                // Place the plane at the distal end of the bone
                const distalEnd = kinematics.boneEndPoints[boneId] || c.center;
                planes.push({
                    id: c.id,
                    center: distalEnd,
                    normal: c.normal,
                    size: 100, 
                    color: 'rgba(139, 92, 246, 0.2)',
                    boneId: boneId
                });
            }
        });
    });
    return planes;
  }, [hybridConstraints, posture, twists]);

  const selectedBoneConstraint = useMemo(() => 
    constraints.find(c => c.boneId === selectedBone), 
  [constraints, selectedBone]);

  const hasConstraint = (boneId: string) => constraints.some(c => c.boneId === boneId);

  // --- HELPER FUNCTIONS FOR CONSTRAINTS ---
  const addHybridConstraint = (boneId: string) => {
    const kinematics = calculateKinematics(posture, twists);
    const currentTip = kinematics.boneEndPoints[boneId];
    const currentStart = kinematics.boneStartPoints[boneId];
    
    // Default normal is the bone's current direction in world space
    let initialNormal = { x: 1, y: 0, z: 0 };
    if (currentTip && currentStart) {
        initialNormal = normalize(sub(currentTip, currentStart));
    }

    setHybridConstraints(prev => {
        const list = prev[boneId] || [];
        const newConstraint: PlanarConstraint = {
            id: Date.now().toString(),
            active: true,
            normal: initialNormal,
            center: currentTip || { x: 0, y: 0, z: 0 } 
        };
        return { ...prev, [boneId]: [...list, newConstraint] };
    });
  };

  const updatePlanarConstraint = (boneId: string, id: string, updates: Partial<PlanarConstraint>) => {
    setHybridConstraints(prev => {
        const list = prev[boneId] || [];
        return {
            ...prev,
            [boneId]: list.map(c => c.id === id ? { ...c, ...updates } : c)
        };
    });
  };

  const removePlanarConstraint = (boneId: string, id: string) => {
    setHybridConstraints(prev => {
        const list = prev[boneId] || [];
        return {
            ...prev,
            [boneId]: list.filter(c => c.id !== id)
        };
    });
  };

  const getVisualVector = (f: ForceConfig): Vector3 => {
      return { x: f.x * f.magnitude, y: f.y * f.magnitude, z: f.z * f.magnitude };
  };

  const measurements = useMemo<Measurement[]>(() => {
      if (!selectedBone) return [];
      const list: Measurement[] = [];
      const vec = posture[selectedBone];
      if (vec) {
        if (selectedBone.includes('Femur')) {
            const angle = Math.round(Math.acos(vec.y) * 180 / Math.PI);
            list.push({ label: 'Hip Angle', value: `${angle}°`, subtext: 'Relative' });
            
            const absRot = getAbsoluteRotation(selectedBone, posture, twists);
            list.push({ label: 'Rotation', value: `${absRot}°`, subtext: 'Int/Ext' });
        } else if (selectedBone.includes('Humerus')) {
             const angle = Math.round(Math.acos(vec.y) * 180 / Math.PI);
             list.push({ label: 'Shoulder Angle', value: `${angle}°`, subtext: 'Relative' });
             
             const absRot = getAbsoluteRotation(selectedBone, posture, twists);
             list.push({ label: 'Rotation', value: `${absRot}°`, subtext: 'Int/Ext' });
        }
      }
      return list;
  }, [selectedBone, posture, twists]);

  const BONE_ORDER = ['lClavicle', 'rClavicle', 'lHumerus', 'rHumerus', 'lFemur', 'rFemur', 'lForearm', 'rForearm', 'lTibia', 'rTibia', 'lFoot', 'rFoot'];

  const BONE_PARENTS: Record<string, string | undefined> = {
    lClavicle: undefined,
    rClavicle: undefined,
    lHumerus: 'lClavicle',
    rHumerus: 'rClavicle',
    lForearm: 'lHumerus',
    rForearm: 'rHumerus',
    lFemur: undefined,
    rFemur: undefined,
    lTibia: 'lFemur',
    rTibia: 'rFemur',
    lFoot: 'lTibia',
    rFoot: 'rTibia'
  };

  const solveConstraints = (tempPosture: Posture, currentTwists: Record<string, number>, lockedBoneIds?: string[]): { posture: Posture, twists: Record<string, number> } => {
      let correctedPosture = { ...tempPosture };
      let correctedTwists = { ...currentTwists };
      let changed = false;

      // Iterative solver for multiple planes (10 passes for better convergence)
      for (let i = 0; i < 10; i++) {
          BONE_ORDER.forEach(boneId => {
              if (lockedBoneIds?.includes(boneId)) return; // Skip the bones being actively moved
              
              // Also skip if bone is locked by a vector constraint
              let isLocked = constraints.some(c => c.boneId === boneId && c.type === 'vector' && c.restrictions.length > 0);
              if (!isLocked && symmetryMode) {
                  const opposite = getOppositeBone(boneId);
                  if (opposite) {
                      isLocked = constraints.some(c => c.boneId === opposite && c.type === 'vector' && c.restrictions.length > 0);
                  }
              }
              if (isLocked) return;
              
              const activeConstraints: (PlanarConstraint & { isChild?: boolean; childId?: string })[] = [];
              const directConstraints = hybridConstraints[boneId] || [];
              directConstraints.forEach(c => { if (c.active) activeConstraints.push(c); });

              if (symmetryMode) {
                  const oppositeBone = getOppositeBone(boneId);
                  if (oppositeBone) {
                      const oppositeConstraints = hybridConstraints[oppositeBone] || [];
                      oppositeConstraints.forEach(c => {
                          if (c.active) {
                              activeConstraints.push({
                                  ...c,
                                  id: c.id + '_mirrored',
                                  normal: { x: -c.normal.x, y: c.normal.y, z: c.normal.z },
                                  center: { x: -c.center.x, y: c.center.y, z: c.center.z }
                              });
                          }
                      });
                  }
              }

              const childBoneId = BONE_ORDER.find(b => BONE_PARENTS[b] === boneId);
              if (childBoneId && lockedBoneIds?.includes(childBoneId)) {
                  const directChildConstraints = hybridConstraints[childBoneId] || [];
                  directChildConstraints.forEach(c => {
                      if (c.active) activeConstraints.push({ ...c, isChild: true, childId: childBoneId });
                  });
                  
                  if (symmetryMode) {
                      const oppositeChild = getOppositeBone(childBoneId);
                      if (oppositeChild) {
                          const oppositeChildConstraints = hybridConstraints[oppositeChild] || [];
                          oppositeChildConstraints.forEach(c => {
                              if (c.active) {
                                  activeConstraints.push({
                                      ...c,
                                      id: c.id + '_mirrored',
                                      isChild: true,
                                      childId: childBoneId,
                                      normal: { x: -c.normal.x, y: c.normal.y, z: c.normal.z },
                                      center: { x: -c.center.x, y: c.center.y, z: c.center.z }
                                  });
                              }
                          });
                      }
                  }
              }
              
              if (activeConstraints.length === 0) return;

              const kinematics = calculateKinematics(correctedPosture, correctedTwists);
              const startPos = kinematics.boneStartPoints[boneId];
              const parentFrame = kinematics.jointFrames[boneId];
              
              if (!startPos || !parentFrame) return;

              let proposedLocal = correctedPosture[boneId];
              let proposedTwist = correctedTwists[boneId] || 0;

              activeConstraints.forEach(config => {
                  const N = normalize(config.normal);
                  const P_lock = config.center;

                  let currentTip: Vector3;
                  let len: number;

                  if (config.isChild && config.childId) {
                      // Recompute the child's world position from the current proposedLocal rather than
                      // using stale kinematics. This ensures push and pull directions are treated
                      // identically, fixing the one-direction asymmetry in bench-press-style constraints.
                      const currentWorldParentDir = normalize(localToWorld(parentFrame, proposedLocal));
                      const currentChildStart = add(startPos, mul(currentWorldParentDir, BONE_LENGTHS[boneId] || 0));

                      // Reconstruct the child frame exactly as calculateChain does
                      let currentChildFrame: Frame;
                      if (boneId.includes('Humerus')) {
                          const u = currentWorldParentDir;
                          const right = applyShortestArcRotation({ x: 0, y: 1, z: 0 }, u, { x: 1, y: 0, z: 0 });
                          const back = applyShortestArcRotation({ x: 0, y: 1, z: 0 }, u, { x: 0, y: 0, z: 1 });
                          currentChildFrame = twistFrame({ x: mul(right, -1), y: u, z: mul(back, -1) }, proposedTwist);
                      } else if (boneId.includes('Femur')) {
                          currentChildFrame = twistFrame(createRootFrame(currentWorldParentDir), proposedTwist);
                      } else {
                          currentChildFrame = twistFrame(transportFrame(parentFrame, currentWorldParentDir), proposedTwist);
                      }

                      const childLocalDir = correctedPosture[config.childId];
                      const childWorldDir = normalize(localToWorld(currentChildFrame, childLocalDir));
                      currentTip = add(currentChildStart, mul(childWorldDir, BONE_LENGTHS[config.childId] || 0));
                      len = magnitude(sub(currentTip, startPos));
                  } else {
                      len = BONE_LENGTHS[boneId] || 0;
                      const worldDir = localToWorld(parentFrame, proposedLocal);
                      currentTip = add(startPos, mul(worldDir, len));
                  }

                  const vToTip = sub(currentTip, P_lock);
                  const dist = dotProduct(vToTip, N);

                  // Bilateral enforcement: solve if we are off the plane in either direction
                  if (Math.abs(dist) < 0.01) return; 

                  const vToStart = sub(startPos, P_lock);
                  const distStart = dotProduct(vToStart, N);
                  const circleCenter = sub(startPos, mul(N, distStart));

                  const radSq = (len * len) - (distStart * distStart);
                  let finalTip: Vector3;

                  if (radSq < 0) {
                      const dirToPlane = mul(N, -Math.sign(distStart));
                      finalTip = add(startPos, mul(dirToPlane, len));
                  } else {
                      const radius = Math.sqrt(radSq);
                      const vToProposed = sub(currentTip, P_lock);
                      const distProposed = dotProduct(vToProposed, N);
                      const proposedOnPlane = sub(currentTip, mul(N, distProposed));
                      const vCenterToProposed = sub(proposedOnPlane, circleCenter);
                      const mag = magnitude(vCenterToProposed);
                      
                      if (mag < 0.001) {
                          let arbitrary = crossProduct(N, {x:1, y:0, z:0});
                          if (magnitude(arbitrary) < 0.01) arbitrary = crossProduct(N, {x:0, y:1, z:0});
                          finalTip = add(circleCenter, mul(normalize(arbitrary), radius));
                      } else {
                          finalTip = add(circleCenter, mul(vCenterToProposed, radius / mag));
                      }
                  }

                  // 1. Adjust Posture (Direction)
                  const finalWorldDir = normalize(sub(finalTip, startPos));
                  const currentWorldDir = normalize(sub(currentTip, startPos));
                  
                  const worldDir = localToWorld(parentFrame, proposedLocal);
                  const rotatedWorldDir = applyShortestArcRotation(currentWorldDir, finalWorldDir, worldDir);
                  let nextLocal = worldToLocal(parentFrame, rotatedWorldDir);

                  // Enforce Joint Limits during solving (Two-pass clamping to fix normalization overshoot)
                  const bounds = BONE_CONSTRAINTS[boneId];
                  if (bounds) {
                      // Pass 1: Initial clamp to bounds
                      if (bounds.x) nextLocal.x = Math.max(bounds.x[0], Math.min(bounds.x[1], nextLocal.x));
                      if (bounds.y) nextLocal.y = Math.max(bounds.y[0], Math.min(bounds.y[1], nextLocal.y));
                      if (bounds.z) nextLocal.z = Math.max(bounds.z[0], Math.min(bounds.z[1], nextLocal.z));
                      
                      // Normalize to unit vector
                      nextLocal = normalize(nextLocal);
                      
                      // Pass 2: Final clamp to ensure strict adherence (fixes normalization overshoot)
                      if (bounds.x) nextLocal.x = Math.max(bounds.x[0], Math.min(bounds.x[1], nextLocal.x));
                      if (bounds.y) nextLocal.y = Math.max(bounds.y[0], Math.min(bounds.y[1], nextLocal.y));
                      if (bounds.z) nextLocal.z = Math.max(bounds.z[0], Math.min(bounds.z[1], nextLocal.z));
                  }
                  proposedLocal = nextLocal;

                  // 2. Adjust Twist (Internal/External Rotation)
                  if (config.isChild && config.childId) {
                      const axis = normalize(localToWorld(parentFrame, proposedLocal));
                      const vTip = sub(currentTip, startPos);
                      const vTarget = sub(finalTip, startPos);
                      
                      const vTipProj = sub(vTip, mul(axis, dotProduct(vTip, axis)));
                      const vTargetProj = sub(vTarget, mul(axis, dotProduct(vTarget, axis)));
                      
                      if (magnitude(vTipProj) > 0.1 && magnitude(vTargetProj) > 0.1) {
                          const nTip = normalize(vTipProj);
                          const nTarget = normalize(vTargetProj);
                          
                          let angle = Math.acos(Math.max(-1, Math.min(1, dotProduct(nTip, nTarget))));
                          const cross = crossProduct(nTip, nTarget);
                          if (dotProduct(cross, axis) < 0) angle = -angle;
                          
                          const twistDelta = (angle * 180) / Math.PI;
                          proposedTwist += twistDelta * 0.4; // Slightly lower damping for better reach
                          
                          if (ROTATION_LIMITS[boneId]) {
                              proposedTwist = clamp(proposedTwist, ROTATION_LIMITS[boneId].min, ROTATION_LIMITS[boneId].max);
                          }
                      }
                  }

                  changed = true;
              });
              
              correctedPosture[boneId] = proposedLocal;
              correctedTwists[boneId] = proposedTwist;
          });
      }

      return { posture: correctedPosture, twists: correctedTwists };
  };

  // Improved Planar and Joint Violation Check
  const checkConstraintViolation = (
        proposedTwists: Record<string, number>, 
        proposedPosture: Posture,
        referenceTwists: Record<string, number>,
        referencePosture: Posture
    ) => {
        const kProp = calculateKinematics(proposedPosture, proposedTwists);
        const kRef = calculateKinematics(referencePosture, referenceTwists);
        
        // 1. Planar Constraints
        for (const boneId of BONE_ORDER) {
            const direct = hybridConstraints[boneId] || [];
            const active = direct.filter(c => c.active);
            
            if (symmetryMode) {
                const opposite = getOppositeBone(boneId);
                if (opposite) {
                    const oppConstraints = hybridConstraints[opposite] || [];
                    oppConstraints.forEach(c => {
                        if (c.active) {
                            active.push({
                                ...c,
                                id: c.id + '_mirrored',
                                normal: { x: -c.normal.x, y: c.normal.y, z: c.normal.z },
                                center: { x: -c.center.x, y: c.center.y, z: c.center.z }
                            });
                        }
                    });
                }
            }

            if (!active.length) continue;
            
            const tipProp = kProp.boneEndPoints[boneId];
            const tipRef = kRef.boneEndPoints[boneId];
            if (!tipProp || !tipRef) continue;
            
            for (const c of active) {
                const N = normalize(c.normal);
                const vProp = sub(tipProp, c.center);
                const distProp = dotProduct(vProp, N);
                
                const vRef = sub(tipRef, c.center);
                const distRef = dotProduct(vRef, N);
                
                // Bilateral Violation: Block if we are moving further away from the plane
                // Threshold 0.05 for contact.
                if (Math.abs(distProp) > 0.05 && Math.abs(distProp) > Math.abs(distRef) + 0.001) {
                    return true;
                }
            }
        }

        // 2. Joint Limits
        for (const boneId of BONE_ORDER) {
            // Check Vector Constraints (as locks)
            let constraint = constraints.find(c => c.boneId === boneId);
            if (!constraint && symmetryMode) {
                const opposite = getOppositeBone(boneId);
                if (opposite) {
                    constraint = constraints.find(c => c.boneId === opposite);
                }
            }
            
            if (constraint && constraint.type === 'vector' && constraint.restrictions.length > 0) {
                const vecProp = proposedPosture[boneId];
                const vecRef = referencePosture[boneId];
                if (vecProp && vecRef) {
                    if (magnitude(sub(vecProp, vecRef)) > 0.001) return true;
                }
            }

            const vecProp = proposedPosture[boneId];
            const vecRef = referencePosture[boneId];
            const bounds = BONE_CONSTRAINTS[boneId];
            if (bounds && vecProp && vecRef) {
                if (bounds.x) {
                    if (vecProp.x < bounds.x[0] && vecProp.x < vecRef.x - 0.01) return true;
                    if (vecProp.x > bounds.x[1] && vecProp.x > vecRef.x + 0.01) return true;
                }
                if (bounds.y) {
                    if (vecProp.y < bounds.y[0] && vecProp.y < vecRef.y - 0.01) return true;
                    if (vecProp.y > bounds.y[1] && vecProp.y > vecRef.y + 0.01) return true;
                }
                if (bounds.z) {
                    if (vecProp.z < bounds.z[0] && vecProp.z < vecRef.z - 0.01) return true;
                    if (vecProp.z > bounds.z[1] && vecProp.z > vecRef.z + 0.01) return true;
                }
            }
            
            const twistProp = proposedTwists[boneId];
            const twistRef = referenceTwists[boneId];
            const rotBounds = ROTATION_LIMITS[boneId];
            if (rotBounds && twistProp !== undefined && twistRef !== undefined) {
                if (twistProp < rotBounds.min && twistProp < twistRef - 0.1) return true;
                if (twistProp > rotBounds.max && twistProp > twistRef + 0.1) return true;
            }
        }

        return false;
    };

  const validateConfiguration = (p: Posture, t: Record<string, number>): boolean => {
      const k = calculateKinematics(p, t);
      
      // 1. Check Planar Constraints (with slight tolerance)
      for (const boneId of BONE_ORDER) {
          const direct = hybridConstraints[boneId] || [];
          const active = direct.filter(c => c.active);
          
          if (symmetryMode) {
              const opposite = getOppositeBone(boneId);
              if (opposite) {
                  const oppConstraints = hybridConstraints[opposite] || [];
                  oppConstraints.forEach(c => {
                      if (c.active) {
                          active.push({
                              ...c,
                              id: c.id + '_mirrored',
                              normal: { x: -c.normal.x, y: c.normal.y, z: c.normal.z },
                              center: { x: -c.center.x, y: c.center.y, z: c.center.z }
                          });
                      }
                  });
              }
          }

          if (!active.length) continue;
          const tip = k.boneEndPoints[boneId];
          if (!tip) continue;
          
          for (const config of active) {
              const N = normalize(config.normal);
              const v = sub(tip, config.center);
              const dist = Math.abs(dotProduct(v, N));
              
              // Use a slightly more generous threshold for validation than solving
              if (dist > 2.0) return false;
          }
      }

      // 2. Check Joint Limits
      for (const boneId of BONE_ORDER) {
          const vec = p[boneId];
          const bounds = BONE_CONSTRAINTS[boneId];
          if (bounds && vec) {
              if (bounds.x && (vec.x < bounds.x[0] - 0.05 || vec.x > bounds.x[1] + 0.05)) return false;
              if (bounds.y && (vec.y < bounds.y[0] - 0.05 || vec.y > bounds.y[1] + 0.05)) return false;
              if (bounds.z && (vec.z < bounds.z[0] - 0.05 || vec.z > bounds.z[1] + 0.05)) return false;
          }
          
          const twist = t[boneId];
          const rotBounds = ROTATION_LIMITS[boneId];
          if (rotBounds && twist !== undefined) {
              if (twist < rotBounds.min - 1 || twist > rotBounds.max + 1) return false;
          }
      }

      return true;
  };

  const validatePosture = (p: Posture, t?: Record<string, number>): boolean => {
      return validateConfiguration(p, t || twists);
  };

  const updatePostureState = (p: Posture, t: Record<string, number>) => {
      if (poseMode === 'start') {
          setStartPosture(p);
          setStartTwists(t);
      } else {
          setEndPosture(p);
          setEndTwists(t);
      }
      setPosture(p);
      setTwists(t);
  };

  const updateTwistState = (updater: (prev: Record<string, number>) => Record<string, number>) => {
      if (poseMode === 'start') { setStartTwists(updater); setTwists(updater); } 
      else { setEndTwists(updater); setTwists(updater); }
  };

  const skeletalData = useMemo(() => {
    return calculateKinematics(posture, twists);
  }, [posture, twists]);

  const applyConstraints = (boneId: string, proposedVec: Vector3): Vector3 => {
      let filtered = proposedVec;
      let constraint = constraints.find(c => c.boneId === boneId);
      
      if (!constraint && symmetryMode) {
          const opposite = getOppositeBone(boneId);
          if (opposite) {
              const oppConstraint = constraints.find(c => c.boneId === opposite);
              if (oppConstraint) {
                  // For 'vector' type, it just blocks movement.
                  constraint = oppConstraint;
              }
          }
      }

      if (constraint && constraint.type === 'vector' && constraint.restrictions.length > 0) {
           filtered = posture[boneId]; 
      }
      return filtered;
  };

  const findSafeInteractionValue = (
      startVal: number,
      targetVal: number,
      checkFn: (val: number) => boolean
  ): number => {
      // 1. Optimistic check
      if (checkFn(targetVal)) return targetVal;

      // 2. Binary search for the closest valid value
      let low = startVal;
      let high = targetVal;
      let safe = startVal;
      let foundValid = false;

      // Even if startVal is invalid, we try to find a valid point in the range
      if (checkFn(startVal)) {
          foundValid = true;
          safe = startVal;
      }

      for (let i = 0; i < 10; i++) {
          const mid = low + (high - low) / 2;
          if (checkFn(mid)) {
              safe = mid;
              foundValid = true;
              // If we are moving from invalid to valid, we want the one closest to target
              // If we are moving from valid to invalid, we want the one closest to target
              low = mid;
          } else {
              high = mid;
          }
      }

      // If we never found a valid value, we have to stay at startVal (or try to move anyway?)
      // But staying at startVal is what causes "stuck" if startVal is also invalid.
      // However, if solveConstraints is robust, startVal should rarely be invalid.
      return safe;
  };

  const checkConstraintViolationLegacy = (boneId: string, proposedLocalVec: Vector3) => {
      if (bypassConstraints) return false;
      const constraint = constraints.find(c => c.boneId === boneId);
      if (!constraint || !skeletalData) return false;
      return false; 
  };

  const resolveFullPosture = (p: Posture, t: Record<string, number>, locked: string[], source: string): { posture: Posture, twists: Record<string, number> } | null => {
      let nextP = p;
      let nextT = t;
      if (symmetryMode) {
          nextP = mirrorPosture(nextP, source);
          nextT = mirrorTwists(nextT, source);
      }
      const lockedIds = symmetryMode ? [...locked, ...locked.map(getOppositeBone).filter(Boolean) as string[]] : locked;
      const solvedResult = solveConstraints(nextP, nextT, lockedIds);
      let finalP = solvedResult.posture;
      let finalT = solvedResult.twists;
      if (symmetryMode) {
          finalP = mirrorPosture(finalP, source);
          finalT = mirrorTwists(finalT, source);
      }
      
      // Use the smarter violation check instead of a strict static validation.
      // This allows moving OUT of invalid states while preventing moving DEEPER into them.
      if (!checkConstraintViolation(finalT, finalP, twists, posture)) {
          return { posture: finalP, twists: finalT };
      }
      return null;
  };

  const resolveKinematics = (boneId: string, proposedVector: Vector3, currentPosture: Posture, currentTwists: Record<string, number>): { posture: Posture, twists: Record<string, number> } | null => {
      return resolveFullPosture({ ...currentPosture, [boneId]: proposedVector }, currentTwists, [boneId], boneId);
  };

  const resolveRotation = (boneId: string, proposedTwist: number, currentPosture: Posture, currentTwists: Record<string, number>): { posture: Posture, twists: Record<string, number> } | null => {
      return resolveFullPosture(currentPosture, { ...currentTwists, [boneId]: proposedTwist }, [boneId], boneId);
  };

  const handleScapulaChange = (axis: 'elevation' | 'protraction', val: number) => {
      if (!selectedBone || isNaN(val)) return;
      if (isPlaying) setIsPlaying(false);
      const current = posture[selectedBone];
      let newVec = { ...current };
      if (axis === 'elevation') newVec.y = -val;
      else if (axis === 'protraction') newVec.z = -val; 
      
      newVec = applyConstraints(selectedBone, newVec);

      const startVec = posture[selectedBone];
      const safeT = findSafeInteractionValue(0, 1, (t) => {
          const testVec = interpolateVector(startVec, newVec, t);
          const resolved = resolveKinematics(selectedBone, testVec, posture, twists);
          return resolved !== null;
      });

      const finalSafeVec = interpolateVector(startVec, newVec, safeT);
      const resolved = resolveKinematics(selectedBone, finalSafeVec, posture, twists);
      if (!resolved) return; 

      updatePostureState(resolved.posture, resolved.twists);
  };

  const handleHingeChange = (val: number) => {
      if (!selectedBone || isNaN(val)) return;
      if (isPlaying) setIsPlaying(false);

      const currentP = poseMode === 'start' ? startPosture : endPosture;
      const currentT = poseMode === 'start' ? startTwists : endTwists;

      const currentAngle = getCurrentHingeAngle(selectedBone);
      const safeAngle = findSafeInteractionValue(currentAngle, val, (testAngle) => {
          const rad = (testAngle * Math.PI) / 180;
          let testVec = { x: 0, y: 0, z: 0 };
          if (selectedBone.includes('Foot')) {
              testVec = { x: 0, y: Math.sin(rad), z: -Math.cos(rad) };
          } else if (selectedBone.includes('Tibia')) {
              // Knees bend backwards (negative Z)
              testVec = { x: 0, y: Math.cos(rad), z: -Math.sin(rad) };
          } else {
              // Elbows bend forwards (positive Z)
              testVec = { x: 0, y: Math.cos(rad), z: Math.sin(rad) };
          }
          
          const resolved = resolveKinematics(selectedBone, testVec, currentP, currentT);
          return resolved !== null;
      });

      const rad = (safeAngle * Math.PI) / 180;
      let newVec = { x: 0, y: 0, z: 0 };
      if (selectedBone.includes('Foot')) {
          newVec = { x: 0, y: Math.sin(rad), z: -Math.cos(rad) };
      } else {
          newVec = { x: 0, y: Math.cos(rad), z: Math.sin(rad) };
      }
      
      const constrainedVec = applyConstraints(selectedBone, newVec);
      const resolved = resolveKinematics(selectedBone, constrainedVec, currentP, currentT);
      if (!resolved) return;

      updatePostureState(resolved.posture, resolved.twists);
  };

  const handlePointChange = (axis: keyof Vector3, newValue: number) => {
    if (!selectedBone || !targetPos || isNaN(newValue)) return;
    if (isPlaying) setIsPlaying(false);

    if (selectedBone.includes('Clavicle')) {
        const newVec = { ...posture[selectedBone], [axis]: newValue };
        const constrained = applyConstraints(selectedBone, newVec);
        setTargetPos(constrained);
        
        const startVec = posture[selectedBone];
        const safeT = findSafeInteractionValue(0, 1, (t) => {
            const testVec = interpolateVector(startVec, constrained, t);
            const resolved = resolveKinematics(selectedBone, testVec, posture, twists);
            return resolved !== null;
        });

        const finalSafeVec = interpolateVector(startVec, constrained, safeT);
        const resolved = resolveKinematics(selectedBone, finalSafeVec, posture, twists);
        if (resolved) {
            updatePostureState(resolved.posture, resolved.twists);
        }
        return;
    }

    const internalVal = -newValue; 
    
    if (targetReferenceBone) {
        const newTarget = { ...targetPos, [axis]: internalVal };
        setTargetPos(newTarget); 
        const rootBone = targetReferenceBone;
        const childBone = selectedBone;
        const len1 = BONE_LENGTHS[rootBone];
        const len2 = BONE_LENGTHS[childBone];
        
        const kinematics = calculateKinematics(posture, twists);
        const startTip = kinematics.boneEndPoints[childBone];

        const safeT = findSafeInteractionValue(0, 1, (t) => {
            const testTarget = interpolateVector(startTip, newTarget, t);
            const currentPole = mul(posture[rootBone], len1); 
            const solution = solveTwoBoneIK({x:0,y:0,z:0}, testTarget, len1, len2, currentPole);
            if (!solution) return false;
            
            const rootFrame = createRootFrame({x:0, y:1, z:0});
            const transported = transportFrame(rootFrame, solution.vec1);
            const childVecLocal = worldToLocal(transported, solution.vec2);
            
            const nextPosture = { ...posture, [rootBone]: solution.vec1, [childBone]: childVecLocal };
            const resolved = resolveFullPosture(nextPosture, twists, [rootBone, childBone], rootBone);
            return resolved !== null;
        });

        const finalTarget = interpolateVector(startTip, newTarget, safeT);
        const currentPole = mul(posture[rootBone], len1); 
        const solution = solveTwoBoneIK({x:0,y:0,z:0}, finalTarget, len1, len2, currentPole);
        
        if (solution) {
            const rootFrame = createRootFrame({x:0, y:1, z:0});
            const transported = transportFrame(rootFrame, solution.vec1);
            const childVecLocal = worldToLocal(transported, solution.vec2);
            
            const nextPosture = { ...posture, [rootBone]: solution.vec1, [childBone]: childVecLocal };
            const resolved = resolveFullPosture(nextPosture, twists, [rootBone, childBone], rootBone);
            if (resolved) {
                updatePostureState(resolved.posture, resolved.twists);
            }
        }
        return;
    }

    // Default: Single bone rotation or non-IK
    let newTarget = { ...targetPos, [axis]: internalVal };
    const constrainedTarget = applyConstraints(selectedBone, newTarget);
    setTargetPos(constrainedTarget);
    let direction = normalize(constrainedTarget);
    const bounds = BONE_CONSTRAINTS[selectedBone] || {};
    let constrained = { ...direction };
    
    // Pass 1: Initial clamp to joint limits
    if (bounds.x) constrained.x = Math.max(bounds.x[0], Math.min(bounds.x[1], constrained.x));
    if (bounds.y) constrained.y = Math.max(bounds.y[0], Math.min(bounds.y[1], constrained.y));
    if (bounds.z) constrained.z = Math.max(bounds.z[0], Math.min(bounds.z[1], constrained.z));
    
    // Normalize to unit vector
    let finalVector = normalize(constrained);
    
    // Pass 2: Final clamp to ensure strict adherence (fixes normalization overshoot)
    if (bounds.x) finalVector.x = Math.max(bounds.x[0], Math.min(bounds.x[1], finalVector.x));
    if (bounds.y) finalVector.y = Math.max(bounds.y[0], Math.min(bounds.y[1], finalVector.y));
    if (bounds.z) finalVector.z = Math.max(bounds.z[0], Math.min(bounds.z[1], finalVector.z));

    const startVec = posture[selectedBone] || { x: 0, y: 1, z: 0 };
    const safeT = findSafeInteractionValue(0, 1, (t) => {
        const testVec = normalize(interpolateVector(startVec, finalVector, t));
        const resolved = resolveKinematics(selectedBone, testVec, posture, twists);
        return resolved !== null;
    });

    const finalSafeVec = normalize(interpolateVector(startVec, finalVector, safeT));
    const resolved = resolveKinematics(selectedBone, finalSafeVec, posture, twists);
    if (!resolved) return; 

    updatePostureState(resolved.posture, resolved.twists);
  };

  const handleRotationChange = (val: number) => {
    if (!selectedBone || isNaN(val)) return;
    if (isPlaying) setIsPlaying(false);
    
    const currentP = poseMode === 'start' ? startPosture : endPosture;
    const currentT = poseMode === 'start' ? startTwists : endTwists;

    let allowedVal = val;
    if (ROTATION_LIMITS[selectedBone]) {
        allowedVal = clamp(val, ROTATION_LIMITS[selectedBone].min, ROTATION_LIMITS[selectedBone].max);
    }

    const startVal = currentT[selectedBone] || 0;

    const safeTwist = findSafeInteractionValue(startVal, allowedVal, (testTwist) => {
        const resolved = resolveRotation(selectedBone, testTwist, currentP, currentT);
        return resolved !== null;
    });

    const resolved = resolveRotation(selectedBone, safeTwist, currentP, currentT);
    if (!resolved) return;

    updatePostureState(resolved.posture, resolved.twists);
  };

  const isScapula = selectedBone ? selectedBone.includes('Clavicle') : false;
  const isHinge = selectedBone ? /Forearm|Tibia|Foot/.test(selectedBone) : false;

  const getHingeConfig = (bone: string) => {
      const isConstrained = hasConstraint(bone);
      if (bone.includes('Forearm')) return { label: 'Elbow Flexion', min: 0, max: 160, default: 0 };
      if (bone.includes('Tibia')) return { label: 'Knee Flexion', min: 0, max: 160, default: 0 };
      if (bone.includes('Foot')) return { label: 'Ankle Dorsi/Plantar', min: isConstrained ? -50 : -90, max: isConstrained ? 50 : 90, default: 0 };
      return null;
  };

  const getCurrentHingeAngle = (bone: string) => {
      const vec = posture[bone] || { x: 0, y: 1, z: 0 };
      const clampedY = Math.max(-1, Math.min(1, vec.y));
      if (bone.includes('Foot')) return Math.round(Math.asin(clampedY) * 180 / Math.PI) || 0; 
      return Math.round(Math.acos(clampedY) * 180 / Math.PI) || 0;
  };

  const displayTwist = useMemo(() => {
    if (!selectedBone) return 0;
    const twist = twists[selectedBone] ?? 0;
    return isNaN(twist) ? 0 : Math.round(twist * 10) / 10;
  }, [selectedBone, twists]);

  // --- FORCE & CONSTRAINT MANAGEMENT ---
  const addNewForce = () => {
    const newForce: ForceConfig = { id: Date.now().toString(), name: 'New Force', boneId: selectedBone || 'rForearm', position: 1, x: 0, y: -1, z: 0, magnitude: 10 };
    setForces([...forces, newForce]);
    setEditingForceId(newForce.id);
    setActiveTab('kinetics');
  };
  
  const updateForce = (id: string, field: keyof ForceConfig, value: any) => {
    if (typeof value === 'number' && isNaN(value)) return;
    setForces(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };
  
  const deleteForce = (id: string) => { setForces(prev => prev.filter(f => f.id !== id)); };

  const addNewConstraint = () => {
    const boneId = selectedBone || 'rForearm';
    const currentLocal = posture[boneId];
    if (!currentLocal) return;
    const capturedVector = { ...currentLocal };

    const newConstraint: ConstraintConfig = { 
        id: Date.now().toString(), 
        type: 'vector', 
        boneId: boneId, 
        position: 1, 
        restrictions: [capturedVector] 
    };
    setConstraints([...constraints, newConstraint]);
    setEditingConstraintId(newConstraint.id);
  };
  
  const updateConstraint = (id: string, field: keyof ConstraintConfig, value: any) => {
    setConstraints(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const updateConstraintRestriction = (id: string, index: number, axis: keyof Vector3, value: number) => {
      if (isNaN(value)) return;
      setConstraints(prev => prev.map(c => {
          if (c.id !== id) return c;
          const newRestrictions = [...c.restrictions];
          if (newRestrictions[index]) {
              newRestrictions[index] = { ...newRestrictions[index], [axis]: value };
          }
          return { ...c, restrictions: newRestrictions };
      }));
  };

  const addConstraintRestriction = (id: string) => {
      setConstraints(prev => prev.map(c => {
          if (c.id !== id) return c;
          const currentLocal = posture[c.boneId] || {x:0, y:1, z:0};
          return { ...c, restrictions: [...c.restrictions, {...currentLocal}] };
      }));
  };

  const removeConstraintRestriction = (id: string, index: number) => {
      setConstraints(prev => prev.map(c => {
          if (c.id !== id) return c;
          return { ...c, restrictions: c.restrictions.filter((_, i) => i !== index) };
      }));
  };
  
  const deleteConstraint = (id: string) => { setConstraints(prev => prev.filter(c => c.id !== id)); };

  const toggleSymmetry = () => setSymmetryMode(prev => !prev);

  const resetModel = () => {
    setStartPosture(DEFAULT_POSTURE);
    setEndPosture(DEFAULT_POSTURE);
    setStartTwists(DEFAULT_TWISTS);
    setEndTwists(DEFAULT_TWISTS);
    setPosture(DEFAULT_POSTURE);
    setTwists(DEFAULT_TWISTS);
    setSelectedBone(null);
    setTargetPos(null);
    setTargetReferenceBone(null);
    setForces([]);
    setConstraints([]);
    setSymmetryMode(false);
    setIsPlaying(false);
    setHybridConstraints({});
  };

  const handleBoneSelect = (boneId: string) => {
    if (selectedBone === boneId) {
        setSelectedBone(null);
        setTargetPos(null);
        setTargetReferenceBone(null);
    } else {
        setSelectedBone(boneId);
        const boneIsHinge = /Forearm|Tibia|Foot/.test(boneId);
        
        if (boneIsHinge) {
            setTargetPos(null);
        } else {
            const currentP = poseMode === 'start' ? startPosture : endPosture;
            const vec = currentP[boneId];
            if (vec) {
                 if (boneId.includes('Clavicle')) {
                     setTargetPos({ ...vec });
                 } else {
                     const len = BONE_LENGTHS[selectedBone] || 100;
                     setTargetPos({ x: vec.x * len, y: vec.y * len, z: vec.z * len });
                 }
            } else {
                setTargetPos(null);
            }
        }

        if (boneId === 'lFoot') setTargetReferenceBone('lFemur');
        else if (boneId === 'rFoot') setTargetReferenceBone('rFemur');
        else if (boneId === 'lForearm') setTargetReferenceBone('lHumerus');
        else if (boneId === 'rForearm') setTargetReferenceBone('rHumerus');
        else setTargetReferenceBone(null);
    }
  };

  const switchPoseMode = (mode: 'start' | 'end') => {
      setPoseMode(mode);
      if (mode === 'start') {
          setPosture(startPosture);
          setTwists(startTwists);
      } else {
          setPosture(endPosture);
          setTwists(endTwists);
      }
      setTargetPos(null);
  };

  const copyStartToEnd = () => {
      setEndPosture(startPosture);
      setEndTwists(startTwists);
      if (poseMode === 'end') {
          setPosture(startPosture);
          setTwists(startTwists);
      }
  };

  const updateCapacity = (group: JointGroup, action: string, field: keyof CapacityConfig, value: number) => {
    if (isNaN(value)) return;
    setJointCapacities(prev => ({
        ...prev,
        [group]: {
            ...prev[group],
            [action]: {
                ...prev[group][action],
                [field]: value
            }
        }
    }));
  };

  const currentElevationDeg = useMemo(() => {
    if (!selectedBone || !isScapula) return 0;
    const vec = posture[selectedBone];
    const val = vec ? Math.round(-vec.y) : 0;
    return isNaN(val) ? 0 : val;
  }, [selectedBone, posture, isScapula]);

  const currentProtractionDeg = useMemo(() => {
    if (!selectedBone || !isScapula) return 0;
    const vec = posture[selectedBone];
    const val = vec ? Math.round(-vec.z) : 0;
    return isNaN(val) ? 0 : val;
  }, [selectedBone, posture, isScapula]);

  // ANIMATION LOOP
  useEffect(() => {
    if (isPlaying) {
      const startTime = Date.now();
      const cycleDuration = 3000;
      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const phase = (elapsed % cycleDuration) / cycleDuration;
        let t = 0;
        if (phase < 0.5) { t = phase * 2; } else { t = 2 - (phase * 2); }
        const newPosture: Posture = {};
        const newTwists: Record<string, number> = {};
        Object.keys(startPosture).forEach(boneId => {
            const startV = startPosture[boneId];
            const endV = endPosture[boneId] || startV;
            newPosture[boneId] = interpolateVector(startV, endV, t);
        });
        const allTwistKeys = new Set([...Object.keys(startTwists), ...Object.keys(endTwists)]);
        allTwistKeys.forEach(boneId => {
            const startT = startTwists[boneId] || 0;
            const endT = endTwists[boneId] || 0;
            newTwists[boneId] = interpolateScalar(startT, endT, t);
        });
        setPosture(newPosture);
        setTwists(newTwists);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (poseMode === 'start') { setPosture(startPosture); setTwists(startTwists); } 
      else { setPosture(endPosture); setTwists(endTwists); }
    }
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, startPosture, endPosture, startTwists, endTwists, poseMode]);

  // INITIALIZE TARGET POS ON SELECTION
  const prevSelection = useRef<string | null>(null);
  const prevMode = useRef<string>('start');

  useEffect(() => {
    const selectionChanged = selectedBone !== prevSelection.current;
    const modeChanged = poseMode !== prevMode.current;
    
    if (selectionChanged || modeChanged) {
        prevSelection.current = selectedBone;
        prevMode.current = poseMode;

        if (!selectedBone) {
            setTargetPos(null);
            return;
        }

        if (/Forearm|Tibia/.test(selectedBone)) {
            setTargetPos(null);
            return;
        }

        const currentP = poseMode === 'start' ? startPosture : endPosture;

        if (targetReferenceBone && skeletalData) {
             const rootStart = skeletalData.boneStartPoints[targetReferenceBone];
             const limbEnd = skeletalData.boneEndPoints[selectedBone];
             if (rootStart && limbEnd) {
                 setTargetPos(sub(limbEnd, rootStart));
             }
        } else {
             const vec = currentP[selectedBone];
             if (vec) {
                 if (selectedBone.includes('Clavicle')) {
                     setTargetPos({ ...vec });
                 } else {
                     const len = BONE_LENGTHS[selectedBone] || 100;
                     setTargetPos({ x: vec.x * len, y: vec.y * len, z: vec.z * len });
                 }
             }
        }
    }
  }, [selectedBone, poseMode, startPosture, endPosture, targetReferenceBone, skeletalData, hybridConstraints]);

  // DEFINED HERE TO FIX REFERENCE ERROR
  const intentCoords = useMemo(() => {
    if (!targetPos) return { x: 0, y: 0, z: 0 };
    const x = -Math.round(targetPos.x);
    const y = -Math.round(targetPos.y);
    const z = -Math.round(targetPos.z);
    return { 
        x: isNaN(x) ? 0 : x, 
        y: isNaN(y) ? 0 : y, 
        z: isNaN(z) ? 0 : z 
    };
  }, [targetPos]);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col px-4 pb-4 overflow-hidden">
      <style>{`
      input[type=range].bio-range {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        height: 20px;
        cursor: pointer;
        width: 100%;
        margin: 0;
        vertical-align: middle;
      }
      input[type=range].bio-range::-webkit-slider-runnable-track {
        width: 100%;
        height: 6px;
        background: #e5e7eb;
        border-radius: 999px;
        border: none;
        transform: translateY(7px);
      }
      input[type=range].bio-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: currentColor;
        margin-top: -5px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        transition: transform 0.1s;
      }
      input[type=range].bio-range:active::-webkit-slider-thumb {
        transform: scale(1.1);
      }
      `}</style>
      <header className="flex justify-between items-center py-2 shrink-0">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Biomechanics</h2>
          <p className="text-gray-400 text-sm font-medium">Interactive Model</p>
        </div>
        <div className="flex gap-2">
            <button onClick={toggleSymmetry} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border shadow-sm ${symmetryMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`} title="Toggle Universal Mirroring">
                <Split className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wide hidden sm:inline">Symmetry</span>
            </button>
            <button onClick={resetModel} className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm" title="Reset Model">
                <RotateCcw className="w-4 h-4" />
            </button>
        </div>
      </header>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 bg-gray-50 rounded-[2rem] border border-gray-200 shadow-inner relative overflow-hidden group">
          <BioMan 
            posture={posture} 
            twists={twists} 
            externalForces={forces.map(f => ({
                id: f.id,
                boneId: f.boneId,
                position: f.position,
                vector: getVisualVector(f),
                color: '#ef4444'
            }))}
            reactionForces={reactionForces} 
            constraints={constraints} 
            planes={lockedPlanes}
            selectedBone={selectedBone} 
            onSelectBone={handleBoneSelect} 
            targetPos={targetPos} 
            targetReferenceBone={targetReferenceBone} 
          />
          <div className="absolute bottom-6 left-6 pointer-events-none">
            <span className="bg-white/90 backdrop-blur-md text-gray-500 text-xs font-bold px-4 py-2 rounded-full shadow-sm flex items-center gap-2 border border-gray-200"><Move3d className="w-4 h-4 text-gray-400" />Drag to Rotate</span>
          </div>
          <div className="absolute top-6 left-6 pointer-events-none flex flex-col gap-2">
             {symmetryMode && (<div className="bg-indigo-600/90 backdrop-blur-md border border-indigo-500 rounded-xl p-3 shadow-lg flex items-center gap-3"><Split className="w-4 h-4 text-white" /><span className="text-[10px] font-bold text-white uppercase tracking-wider">Universal Mirroring Active</span></div>)}
          </div>
        </div>

        <div className="w-96 bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm overflow-y-auto shrink-0 flex flex-col">
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6 flex-wrap gap-1">
            <button onClick={() => setActiveTab('kinematics')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'kinematics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Motion"><ArrowDownUp className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('dof')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'dof' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Degrees of Freedom"><Axis3d className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('kinetics')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'kinetics' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="External Forces"><Zap className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('constraints')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'constraints' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Constraints"><Anchor className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('torque')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'torque' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Analysis"><Scale className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('capacities')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'capacities' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Strength Capacity"><Gauge className="w-5 h-5" /></button>
          </div>

          <div className="flex items-center gap-3 mb-6 shrink-0">
            {activeTab === 'kinematics' && <Settings2 className="w-5 h-5 text-indigo-600" />}
            {activeTab === 'dof' && <Axis3d className="w-5 h-5 text-violet-600" />}
            {activeTab === 'kinetics' && <Zap className="w-5 h-5 text-orange-500" />}
            {activeTab === 'constraints' && <Anchor className="w-5 h-5 text-emerald-600" />}
            {activeTab === 'torque' && <Scale className="w-5 h-5 text-gray-800" />}
            {activeTab === 'capacities' && <Gauge className="w-5 h-5 text-purple-600" />}
            <h3 className="text-lg font-bold text-gray-900">
                {activeTab === 'kinematics' ? 'Motion Editor' : 
                 activeTab === 'dof' ? 'Degrees of Freedom' :
                 activeTab === 'kinetics' ? 'External Forces' : 
                 activeTab === 'constraints' ? 'Kinematic Constraints' : 
                 activeTab === 'capacities' ? 'Joint Capacities' : 'Joint Analysis'}
            </h3>
          </div>

          {activeTab === 'kinematics' && (
             <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pose Timeline</span>
                        <div className="flex gap-2">
                            <button onClick={copyStartToEnd} className="bg-white border border-gray-200 text-gray-500 p-1.5 rounded-lg hover:text-indigo-600 hover:border-indigo-200 transition-colors" title="Copy Start to End"><Copy className="w-3 h-3" /></button>
                        </div>
                    </div>
                    <div className="flex gap-1 bg-gray-200 p-1 rounded-xl mb-4">
                        <button onClick={() => switchPoseMode('start')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${poseMode === 'start' && !isPlaying ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Start Pose</button>
                        <button onClick={() => switchPoseMode('end')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${poseMode === 'end' && !isPlaying ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>End Pose</button>
                    </div>
                    <button onClick={() => setIsPlaying(!isPlaying)} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${isPlaying ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{isPlaying ? "Pause Animation" : "Play Loop"}</button>
                </div>
                {!selectedBone ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-gray-100 rounded-3xl min-h-[150px]"><MousePointerClick className="w-10 h-10 text-gray-300 mb-3" /><p className="text-gray-500 font-bold text-sm">Select a limb to<br/>edit position.</p></div>
                ) : (
                    <div className="flex-1 space-y-8 overflow-y-auto pr-1">
                        <div className="flex items-center justify-between"><span className="font-bold text-gray-900 text-sm">{BONE_NAMES[selectedBone]}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{poseMode === 'start' ? 'Start' : 'End'} Editing</span></div>
                        
                        {selectedBoneConstraint && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3 mb-2">
                                <Anchor className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-700">
                                    {selectedBoneConstraint.type === 'path' ? 'Direction Locked' : 'Movement Constrained'}
                                </span>
                            </div>
                        )}
                        
                        {selectedBone === 'spine' ? (
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl py-8">
                                <Anchor className="w-8 h-8 text-gray-300 mb-2" />
                                <p className="text-xs font-bold text-gray-400 text-center uppercase tracking-wide">Static Root Segment</p>
                                <p className="text-[10px] text-gray-300 text-center mt-1">Movement not supported</p>
                            </div>
                        ) : isHinge ? (
                            <div>
                                {(() => {
                                    const cfg = getHingeConfig(selectedBone);
                                    if (!cfg) return null;
                                    const currentAngle = getCurrentHingeAngle(selectedBone);
                                    return (
                                        <>
                                            <div className="flex justify-between mb-2"><label className="font-bold text-gray-700 text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>{cfg.label}</label><span className="font-mono text-gray-500 font-bold text-xs">{currentAngle}°</span></div>
                                            <input type="range" min={cfg.min} max={cfg.max} step="1" value={currentAngle} onChange={(e) => handleHingeChange(parseInt(e.target.value))} className="bio-range w-full text-indigo-600"/>
                                        </>
                                    );
                                })()}
                            </div>
                        ) : isScapula ? (
                            <>
                                <div><div className="flex justify-between mb-2"><label className="font-bold text-gray-700 text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>Elevation / Depression</label><span className="font-mono text-gray-500 font-bold text-xs">{currentElevationDeg}</span></div><div className="flex items-center gap-2"><span className="text-[10px] text-gray-400 font-bold">Depress (-10)</span><input type="range" min="-10" max="20" step="1" value={currentElevationDeg} onChange={(e) => handleScapulaChange('elevation', parseFloat(e.target.value))} className="bio-range w-full text-indigo-600"/><span className="text-[10px] text-gray-400 font-bold">Elevate (20)</span></div></div>
                                <div><div className="flex justify-between mb-2"><label className="font-bold text-gray-700 text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span>Protraction / Retraction</label><span className="font-mono text-gray-500 font-bold text-xs">{currentProtractionDeg}</span></div><div className="flex items-center gap-2"><span className="text-[10px] text-gray-400 font-bold">Retract (-15)</span><input type="range" min="-15" max="20" step="1" value={currentProtractionDeg} onChange={(e) => handleScapulaChange('protraction', parseFloat(e.target.value))} className="bio-range w-full text-orange-600"/><span className="text-[10px] text-gray-400 font-bold">Protract (20)</span></div></div>
                            </>
                        ) : (
                        <>
                            {targetReferenceBone && (
                                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-bold mb-4 flex items-center gap-2">
                                    <Move3d className="w-3 h-3" />
                                    <span>Chain IK Active: Moving {BONE_NAMES[selectedBone]} relative to {BONE_NAMES[targetReferenceBone]}</span>
                                </div>
                            )}
                            <div><div className="flex justify-between mb-2"><label className="font-bold text-gray-700 text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span>X Axis (Left/Right)</label><span className="font-mono text-gray-500 font-bold text-xs">{intentCoords.x}</span></div><input type="range" min="-150" max="150" step="1" value={intentCoords.x} onChange={(e) => handlePointChange('x', parseFloat(e.target.value))} className="bio-range w-full text-gray-900"/></div>
                            <div><div className="flex justify-between mb-2"><label className="font-bold text-gray-700 text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span>Y Axis (Down/Up)</label><span className="font-mono text-gray-500 font-bold text-xs">{intentCoords.y}</span></div><input type="range" min="-150" max="150" step="1" value={intentCoords.y} onChange={(e) => handlePointChange('y', parseFloat(e.target.value))} className="bio-range w-full text-gray-900"/></div>
                            <div><div className="flex justify-between mb-2"><label className="font-bold text-gray-700 text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Z Axis (Ext/Flex)</label><span className="font-mono text-gray-500 font-bold text-xs">{intentCoords.z}</span></div><input type="range" min="-150" max="150" step="1" value={intentCoords.z} onChange={(e) => handlePointChange('z', parseFloat(e.target.value))} className="bio-range w-full text-gray-900"/></div>
                            <div className="pt-4 mt-4 border-t border-gray-100">
                                <div className="flex justify-between mb-2">
                                    <label className="font-bold text-gray-700 text-xs flex items-center gap-2"><RefreshCw className="w-3 h-3 text-orange-500" />Rotation (Int/Ext)</label>
                                    <span className="font-mono text-gray-500 font-bold text-xs">{displayTwist}°</span>
                                </div>
                                <input 
                                    type="range" 
                                    min={ROTATION_LIMITS[selectedBone]?.min ?? -90} 
                                    max={ROTATION_LIMITS[selectedBone]?.max ?? 90} 
                                    step="1" 
                                    value={displayTwist} 
                                    onChange={(e) => handleRotationChange(parseFloat(e.target.value))} 
                                    className="bio-range w-full text-orange-500"
                                />
                                {ROTATION_LIMITS[selectedBone] && (
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[9px] font-bold text-gray-400">{ROTATION_LIMITS[selectedBone].min}° (Int)</span>
                                        <span className="text-[9px] font-bold text-gray-400">{ROTATION_LIMITS[selectedBone].max}° (Ext)</span>
                                    </div>
                                )}
                            </div>
                        </>
                        )}
                        <div className="mt-4 pt-6 border-t border-gray-100 space-y-4">
                            <div className="flex items-center gap-2"><Globe2 className="w-4 h-4 text-indigo-500" /><h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Clinical Angles</h4></div>
                            <div className="space-y-2">
                                {measurements.map((m, idx) => (
                                    <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${m.isDim ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100'}`}><div className="flex items-center gap-2">{m.isDim && <AlertCircle className="w-3 h-3 text-gray-400" />}<span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{m.label}</span></div><div className="text-right"><span className="block text-lg font-black text-gray-900 leading-none">{m.value}</span><span className={`text-[10px] font-bold uppercase tracking-wider ${m.highlight ? 'text-indigo-600' : 'text-gray-400'}`}>{m.subtext}</span></div></div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
             </div>
          )}

          {activeTab === 'dof' && (
              <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-violet-50 p-4 rounded-xl border border-violet-100 mb-6">
                      <p className="text-xs text-violet-900 font-medium leading-relaxed">
                          Define custom planar constraints to restrict joint movement to specific axes.
                      </p>
                  </div>
                  {!selectedBone ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-gray-100 rounded-3xl min-h-[150px]">
                          <MousePointerClick className="w-10 h-10 text-gray-300 mb-3" />
                          <p className="text-gray-500 font-bold text-sm">Select a joint to<br/>configure degrees of freedom.</p>
                      </div>
                  ) : (
                      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                          <button onClick={() => addHybridConstraint(selectedBone)} className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all flex items-center justify-center gap-2 mb-2">
                              <Plus className="w-4 h-4" /> Add Plane
                          </button>
                          
                          {hybridConstraints[selectedBone]?.map((config, index) => (
                              <div key={config.id} className={`bg-white border rounded-2xl p-4 transition-all duration-300 ${config.active ? 'border-violet-200 shadow-sm' : 'border-gray-100 opacity-70'}`}>
                                  <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${config.active ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                                              {index + 1}
                                          </div>
                                          <span className="font-bold text-gray-900 text-sm">Plane {index + 1}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <button 
                                              onClick={() => updatePlanarConstraint(selectedBone, config.id, { active: !config.active })}
                                              className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${config.active ? 'bg-violet-500' : 'bg-gray-200'}`}
                                          >
                                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${config.active ? 'translate-x-4' : 'translate-x-0'}`} />
                                          </button>
                                          <button onClick={() => removePlanarConstraint(selectedBone, config.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                  </div>

                                  {config.active && (
                                      <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                                          <div>
                                              <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Quick Presets</label>
                                              <div className="flex gap-1">
                                                  <button onClick={() => updatePlanarConstraint(selectedBone, config.id, { normal: { x: 0, y: 0, z: 1 } })} className="flex-1 py-1.5 bg-gray-50 hover:bg-violet-50 text-[10px] font-bold text-gray-600 rounded-lg border border-transparent hover:border-violet-200 transition-colors">Frontal</button>
                                                  <button onClick={() => updatePlanarConstraint(selectedBone, config.id, { normal: { x: 1, y: 0, z: 0 } })} className="flex-1 py-1.5 bg-gray-50 hover:bg-violet-50 text-[10px] font-bold text-gray-600 rounded-lg border border-transparent hover:border-violet-200 transition-colors">Sagittal</button>
                                                  <button onClick={() => updatePlanarConstraint(selectedBone, config.id, { normal: { x: 0, y: 1, z: 0 } })} className="flex-1 py-1.5 bg-gray-50 hover:bg-violet-50 text-[10px] font-bold text-gray-600 rounded-lg border border-transparent hover:border-violet-200 transition-colors">Transverse</button>
                                              </div>
                                          </div>
                                          
                                          <div>
                                              <div className="flex justify-between items-center mb-2">
                                                  <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Normal Vector</label>
                                                  <span className="font-mono text-[9px] text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">[{config.normal.x.toFixed(1)}, {config.normal.y.toFixed(1)}, {config.normal.z.toFixed(1)}]</span>
                                              </div>
                                              <div className="space-y-3">
                                                  {(['x', 'y', 'z'] as const).map(axis => (
                                                      <div key={axis} className="flex items-center gap-3">
                                                          <span className="text-[10px] font-bold text-gray-400 w-2 uppercase">{axis}</span>
                                                          <input 
                                                              type="range" 
                                                              min="-1" max="1" step="0.1" 
                                                              value={config.normal[axis]} 
                                                              onChange={(e) => updatePlanarConstraint(selectedBone, config.id, { normal: { ...config.normal, [axis]: parseFloat(e.target.value) } })}
                                                              className="bio-range w-full text-violet-500"
                                                          />
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ))}
                          
                          {(!hybridConstraints[selectedBone] || hybridConstraints[selectedBone].length === 0) && (
                              <div className="text-center py-8 text-gray-400 text-xs">
                                  No constraints added yet.
                              </div>
                          )}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'kinetics' && (
              <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                  {editingForceId ? (
                      <div className="flex-1 flex flex-col">
                         <div className="flex items-center gap-2 mb-6"><button onClick={() => setEditingForceId(null)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5 text-gray-600" /></button><h4 className="font-bold text-gray-900">Edit Force</h4></div>
                         <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                             {(() => {
                                 const f = forces.find(f => f.id === editingForceId);
                                 if (!f) return null;
                                 return (
                                     <>
                                        <div><label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Force Name</label><input type="text" value={f.name} onChange={(e) => updateForce(f.id, 'name', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:border-orange-500"/></div>
                                        <div><label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Acting On</label><div className="relative"><select value={f.boneId} onChange={(e) => updateForce(f.id, 'boneId', e.target.value)} className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-700 outline-none focus:border-orange-500">{Object.entries(BONE_NAMES).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}</select><ChevronLeft className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 -rotate-90 pointer-events-none" /></div></div>
                                        <div><label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Application Point</label><div className="flex items-center gap-4"><span className="text-xs font-bold text-gray-500">Proximal</span><input type="range" min="0" max="1" step="0.05" value={isNaN(f.position) ? 0.5 : f.position} onChange={(e) => updateForce(f.id, 'position', parseFloat(e.target.value))} className="flex-1 bio-range text-orange-500"/><span className="text-xs font-bold text-gray-500">Distal</span></div></div>
                                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl"><div className="flex justify-between mb-2"><label className="font-bold text-orange-800 text-xs">Force (N)</label><span className="font-mono text-orange-600 font-bold text-xs">{f.magnitude} N</span></div><input type="range" min="1" max="30" step="1" value={isNaN(f.magnitude) ? 10 : f.magnitude} onChange={(e) => updateForce(f.id, 'magnitude', parseFloat(e.target.value))} className="bio-range w-full text-orange-500"/></div>
                                        <div><label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-4 block">Direction Vector</label><div className="space-y-4">{['x', 'y', 'z'].map(axis => (<div key={axis}><div className="flex justify-between mb-1"><label className="font-bold text-gray-500 text-xs uppercase">{axis} Axis</label><span className="font-mono text-gray-400 text-xs">{f[axis as keyof ForceConfig]}</span></div><input type="range" min="-1" max="1" step="0.1" value={isNaN(f[axis as keyof ForceConfig] as number) ? 0 : f[axis as keyof ForceConfig] as number} onChange={(e) => updateForce(f.id, axis as keyof ForceConfig, parseFloat(e.target.value))} className="bio-range w-full text-gray-900"/></div>))}</div></div>
                                        <div className="pt-8"><button onClick={() => deleteForce(f.id)} className="w-full py-3 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Delete Force</button></div>
                                     </>
                                 );
                             })()}
                         </div>
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col">
                          {forces.length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-gray-100 rounded-3xl mb-4"><Zap className="w-8 h-8 text-orange-300 mb-2" /><p className="text-gray-400 font-bold text-sm">No external forces.</p></div>) : (<div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">{forces.map(f => (<button key={f.id} onClick={() => setEditingForceId(f.id)} className="w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group text-left bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200"><div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-orange-500 text-white"><Zap className="w-5 h-5" /></div><div><span className="block font-bold text-sm text-gray-900">{f.name}</span><span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{BONE_NAMES[f.boneId]}</span></div></div><div className="text-right"><span className="block font-bold text-gray-900 text-xs">{f.magnitude} N</span><ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-orange-400 ml-auto" /></div></button>))}</div>)}
                          <div className="space-y-3"><button onClick={addNewForce} className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-200 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Add Force</button></div>
                      </div>
                  )}
              </div>
          )}
          
          {activeTab === 'constraints' && (
              <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                  {editingConstraintId ? (
                      <div className="flex-1 flex flex-col">
                         <div className="flex items-center gap-2 mb-6"><button onClick={() => setEditingConstraintId(null)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5 text-gray-600" /></button><h4 className="font-bold text-gray-900">Edit Constraint</h4></div>
                         <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                             {(() => {
                                 const c = constraints.find(c => c.id === editingConstraintId);
                                 if (!c) return null;
                                 return (
                                     <>
                                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-4"><p className="text-xs text-emerald-800 font-medium leading-relaxed">
                                            {c.type === 'vector' ? 'Defined vectors are BLOCKED. Useful for limiting ROM (e.g. Stop extension at 0°).' : 'Defined vectors are the PATH. The joint is LOCKED to this direction.'}
                                        </p></div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Constraint Type</label>
                                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                                <button onClick={() => updateConstraint(c.id, 'type', 'vector')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${c.type === 'vector' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Block Direction</button>
                                                <button onClick={() => updateConstraint(c.id, 'type', 'path')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${c.type === 'path' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Lock Path</button>
                                            </div>
                                        </div>
                                        <div><label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Constrained Bone</label><div className="relative"><select value={c.boneId} onChange={(e) => updateConstraint(c.id, 'boneId', e.target.value)} className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-700 outline-none focus:border-emerald-500">{Object.entries(BONE_NAMES).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}</select><ChevronLeft className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 -rotate-90 pointer-events-none" /></div></div>
                                        <div>
                                            <div className="flex justify-between items-center mb-2"><label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 block">Constraint Vectors</label><button onClick={() => addConstraintRestriction(c.id)} className="text-emerald-600 text-xs font-bold hover:underline">+ Add Current</button></div>
                                            <div className="space-y-3">
                                                {c.restrictions.map((r, idx) => (
                                                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                                                        <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-bold text-gray-500 uppercase">Vector {idx + 1}</span><button onClick={() => removeConstraintRestriction(c.id, idx)} className="text-red-400 hover:text-red-500"><X className="w-3 h-3" /></button></div>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {(['x', 'y', 'z'] as const).map(axis => (<div key={axis} className="bg-white rounded border border-gray-100 p-1"><input type="number" step="0.1" value={isNaN(r[axis]) ? 0 : r[axis]} onChange={(e) => updateConstraintRestriction(c.id, idx, axis, parseFloat(e.target.value))} className="w-full text-center text-xs font-mono outline-none text-gray-600" /></div>))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="pt-8"><button onClick={() => deleteConstraint(c.id)} className="w-full py-3 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Delete Constraint</button></div>
                                     </>
                                 );
                             })()}
                         </div>
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col">
                          {constraints.length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-gray-100 rounded-3xl mb-4"><Anchor className="w-8 h-8 text-emerald-300 mb-2" /><p className="text-gray-400 font-bold text-sm">No constraints active.</p></div>) : (<div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">{constraints.map(c => (<button key={c.id} onClick={() => setEditingConstraintId(c.id)} className="w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group text-left bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200"><div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-emerald-500 text-white"><Anchor className="w-5 h-5" /></div><div><span className="block font-bold text-sm text-gray-900">{BONE_NAMES[c.boneId]}</span><span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{c.type === 'vector' ? 'Block Vector' : 'Lock Path'}</span></div></div><div className="text-right"><ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-400 ml-auto" /></div></button>))}</div>)}
                          <div className="space-y-3"><button onClick={addNewConstraint} className="w-full py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Add Constraint</button></div>
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'torque' && (
               <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-gray-100 rounded-3xl min-h-[150px] animate-in fade-in slide-in-from-right-4 duration-300">
                   <BrainCircuit className="w-10 h-10 text-gray-300 mb-3" />
                   <p className="text-gray-500 font-bold text-sm">Torque Analysis<br/>Coming Soon</p>
               </div>
          )}
          
          {activeTab === 'capacities' && (
               <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                   <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6">
                       <p className="text-xs text-purple-900 font-medium leading-relaxed">
                           Define the base and specific strength capacities for each joint action to drive the "Challenge" metric.
                       </p>
                   </div>
                   <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                       {Object.entries(jointCapacities).map(([group, actions]) => (
                           <div key={group}>
                               <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide mb-3 sticky top-0 bg-white py-2 border-b border-gray-100">{group}</h4>
                               <div className="space-y-4">
                                   {Object.entries(actions).map(([action, config]) => (
                                       <div key={action} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                           <div className="flex justify-between items-center mb-2">
                                               <span className="text-xs font-bold text-gray-700 capitalize">{action.replace(/([A-Z])/g, ' $1').trim()}</span>
                                           </div>
                                           <div className="grid grid-cols-2 gap-4 mb-2">
                                               <div>
                                                   <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Base (Nm)</label>
                                                   <input type="number" value={isNaN(config.base) ? 0 : config.base} onChange={(e) => updateCapacity(group as JointGroup, action, 'base', parseFloat(e.target.value))} className="w-full text-xs font-medium bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-purple-500" />
                                               </div>
                                               <div>
                                                   <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Peak (Nm)</label>
                                                   <input type="number" value={isNaN(config.specific) ? 0 : config.specific} onChange={(e) => updateCapacity(group as JointGroup, action, 'specific', parseFloat(e.target.value))} className="w-full text-xs font-medium bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-purple-500" />
                                               </div>
                                           </div>
                                            <div>
                                               <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Peak Angle (°)</label>
                                               <div className="flex items-center gap-2">
                                                   <input type="range" min="0" max="180" value={isNaN(config.angle) ? 0 : config.angle} onChange={(e) => updateCapacity(group as JointGroup, action, 'angle', parseFloat(e.target.value))} className="flex-1 bio-range text-purple-500" />
                                                   <span className="text-[10px] font-mono font-bold text-gray-500 w-8 text-right">{isNaN(config.angle) ? 0 : config.angle}°</span>
                                               </div>
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BioModelPage;
