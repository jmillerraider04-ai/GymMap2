
import React, { useState, useEffect, useMemo, useRef } from 'react';
import BioMan, { Posture, Vector3, VisualForce, VisualPlane } from '../components/BioMan';
import { Settings2, RotateCcw, MousePointerClick, Move3d, Copy, Lock, Split, Play, Pause, Zap, Scale, Gauge, ChevronLeft, AlertCircle, ArrowDownUp, RefreshCw, ChevronRight, BrainCircuit, Axis3d, Plus, Trash2 } from 'lucide-react';

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

interface PlanarConstraint {
    id: string;
    active: boolean;
    normal: Vector3; // direction the limb CANNOT move in — tip is locked to the plane perpendicular to this
    center: Vector3; // world-space point the plane passes through (distal tip at time of creation)
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
  const [activeTab, setActiveTab] = useState<'kinematics' | 'kinetics' | 'torque' | 'capacities' | 'constraints'>('kinematics');
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
  const [jointCapacities, setJointCapacities] = useState<Record<JointGroup, JointCapacityProfile>>(DEFAULT_CAPACITIES);
  
  const [reactionForces, setReactionForces] = useState<VisualForce[]>([]);
  const [calculatedTorques, setCalculatedTorques] = useState<Record<string, Vector3>>({});
  const [neuralCosts, setNeuralCosts] = useState<Record<string, number>>({});

  const [constraints, setConstraints] = useState<Record<string, PlanarConstraint[]>>({});

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

  // --- CONSTRAINT HELPERS ---
  // Project a proposed local direction for a bone onto the intersection of all
  // active planar constraints for that bone. A constraint is a plane (normal N,
  // center C) that the bone's distal tip must lie on. Since the tip is
  // start + dir*len, the constraint reduces to a fixed value of dir·N in world
  // space. We do a small number of Gauss-Seidel projections when multiple
  // constraints are present (exact for one constraint, approximate for many).
  const projectDirOntoConstraints = (
      boneId: string,
      proposedLocalDir: Vector3,
      basePosture: Posture,
      baseTwists: Record<string, number>
  ): Vector3 => {
      const cons = (constraints[boneId] || []).filter(c => c.active);
      if (cons.length === 0) return proposedLocalDir;
      const kin = calculateKinematics(basePosture, baseTwists);
      const startPos = kin.boneStartPoints[boneId];
      const parentFrame = kin.jointFrames[boneId];
      if (!startPos || !parentFrame) return proposedLocalDir;
      const L = BONE_LENGTHS[boneId] || 0;
      if (L <= 0) return proposedLocalDir;

      const currentLocalDir = basePosture[boneId];
      const currentWorldDir = currentLocalDir ? normalize(localToWorld(parentFrame, currentLocalDir)) : null;
      const proposedWorldDir = normalize(localToWorld(parentFrame, proposedLocalDir));
      let worldDir = proposedWorldDir;

      const projectOne = (N: Vector3, C: Vector3) => {
          const dTarget = dotProduct(sub(C, startPos), N) / L;
          if (Math.abs(dTarget) >= 1) {
              // Plane out of reach; clamp direction toward the plane side.
              const sign = dTarget >= 0 ? 1 : -1;
              worldDir = mul(N, sign);
              return;
          }
          const axial = dotProduct(worldDir, N);
          if (Math.abs(axial - dTarget) < 1e-5) return;
          let lateral = sub(worldDir, mul(N, axial));
          let latMag = magnitude(lateral);
          if (latMag < 1e-5) {
              let arbitrary: Vector3 = { x: 1, y: 0, z: 0 };
              if (Math.abs(dotProduct(arbitrary, N)) > 0.9) arbitrary = { x: 0, y: 1, z: 0 };
              lateral = sub(arbitrary, mul(N, dotProduct(arbitrary, N)));
              latMag = magnitude(lateral);
              if (latMag < 1e-5) return;
          }
          const latUnit = mul(lateral, 1 / latMag);
          const latScale = Math.sqrt(Math.max(0, 1 - dTarget * dTarget));
          worldDir = normalize(add(mul(N, dTarget), mul(latUnit, latScale)));
      };

      const iters = cons.length === 1 ? 1 : 8;
      for (let i = 0; i < iters; i++) {
          for (const c of cons) projectOne(normalize(c.normal), c.center);
      }
      // Reject 180° flips: if the projection landed further from the current
      // direction than the proposal was, the projection crossed to the opposite
      // hemisphere — hard-stop the limb at its current direction instead.
      if (currentWorldDir && currentLocalDir) {
          const currentToProjected = dotProduct(worldDir, currentWorldDir);
          const currentToProposed = dotProduct(proposedWorldDir, currentWorldDir);
          if (currentToProjected < currentToProposed - 0.01) {
              return currentLocalDir;
          }
      }
      return worldToLocal(parentFrame, worldDir);
  };

  const addConstraint = (boneId: string) => {
      const kin = calculateKinematics(posture, twists);
      const tip = kin.boneEndPoints[boneId];
      if (!tip) return;
      const newC: PlanarConstraint = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          active: true,
          normal: { x: 0, y: 0, z: 1 }, // default: frontal plane
          center: tip
      };
      setConstraints(prev => ({ ...prev, [boneId]: [...(prev[boneId] || []), newC] }));
  };

  const updateConstraint = (boneId: string, id: string, updates: Partial<PlanarConstraint>) => {
      setConstraints(prev => ({
          ...prev,
          [boneId]: (prev[boneId] || []).map(c => c.id === id ? { ...c, ...updates } : c)
      }));
  };

  const removeConstraint = (boneId: string, id: string) => {
      setConstraints(prev => ({
          ...prev,
          [boneId]: (prev[boneId] || []).filter(c => c.id !== id)
      }));
  };

  const visualConstraintPlanes = useMemo<VisualPlane[]>(() => {
      const out: VisualPlane[] = [];
      const kin = calculateKinematics(posture, twists);
      (Object.entries(constraints) as [string, PlanarConstraint[]][]).forEach(([boneId, list]) => {
          list.forEach(c => {
              if (!c.active) return;
              // Center follows the current distal tip so the visible square
              // always sits where the bone ends — not where it was when the
              // constraint was first added.
              const tip = kin.boneEndPoints[boneId] || c.center;
              out.push({
                  id: c.id,
                  center: tip,
                  normal: c.normal,
                  size: 80,
                  color: 'rgba(139, 92, 246, 0.2)',
                  boneId
              });
          });
      });
      return out;
  }, [constraints, posture, twists]);

  const getVisualVector = (f: ForceConfig): Vector3 => {
      return { x: f.x * f.magnitude, y: f.y * f.magnitude, z: f.z * f.magnitude };
  };

  const measurements = useMemo<Measurement[]>(() => {
      if (!selectedBone) return [];
      const list: Measurement[] = [];
      const vec = posture[selectedBone];
      if (!vec) return list;

      const fmt = (n: number) => (Math.abs(n) < 0.0005 ? '0.000' : n.toFixed(3));
      const clampedY = Math.max(-1, Math.min(1, vec.y));

      if (/Forearm|Tibia/.test(selectedBone)) {
          // Pure hinge: single flexion angle.
          const angle = Math.round(Math.acos(clampedY) * 180 / Math.PI) || 0;
          const label = selectedBone.includes('Forearm') ? 'Elbow Flexion' : 'Knee Flexion';
          list.push({ label, value: `${angle}°`, subtext: '0° = straight' });
      } else if (/Foot/.test(selectedBone)) {
          // Ankle: single dorsi/plantar angle.
          const angle = Math.round(Math.asin(clampedY) * 180 / Math.PI) || 0;
          list.push({ label: 'Ankle Angle', value: `${angle}°`, subtext: 'Dorsi (+) / Plantar (-)' });
      } else if (selectedBone.includes('Clavicle')) {
          // Scapula: two single-value actions.
          list.push({ label: 'Elevation', value: `${Math.round(-vec.y)}`, subtext: 'Elevate (+) / Depress (-)' });
          list.push({ label: 'Protraction', value: `${Math.round(-vec.z)}`, subtext: 'Protract (+) / Retract (-)' });
      } else {
          // Ball-and-socket (hip/shoulder): raw unit direction vector.
          list.push({ label: 'Dir X', value: fmt(vec.x), subtext: 'Right (+) / Left (-)' });
          list.push({ label: 'Dir Y', value: fmt(vec.y), subtext: 'Down (+) / Up (-)' });
          list.push({ label: 'Dir Z', value: fmt(vec.z), subtext: 'Back (+) / Forward (-)' });

          const hasTwist = /Humerus|Femur/.test(selectedBone);
          if (hasTwist) {
              const absRot = getAbsoluteRotation(selectedBone, posture, twists);
              list.push({ label: 'Rotation', value: `${absRot}°`, subtext: 'Int/Ext (separate axis)' });
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

  const resolveFullPosture = (p: Posture, t: Record<string, number>, source: string): { posture: Posture, twists: Record<string, number> } => {
      let nextP = p;
      let nextT = t;
      if (symmetryMode) {
          nextP = mirrorPosture(nextP, source);
          nextT = mirrorTwists(nextT, source);
      }
      return { posture: nextP, twists: nextT };
  };

  const resolveKinematics = (boneId: string, proposedVector: Vector3, currentPosture: Posture, currentTwists: Record<string, number>): { posture: Posture, twists: Record<string, number> } => {
      const projected = projectDirOntoConstraints(boneId, proposedVector, currentPosture, currentTwists);
      return resolveFullPosture({ ...currentPosture, [boneId]: projected }, currentTwists, boneId);
  };

  const resolveRotation = (boneId: string, proposedTwist: number, currentPosture: Posture, currentTwists: Record<string, number>): { posture: Posture, twists: Record<string, number> } => {
      return resolveFullPosture(currentPosture, { ...currentTwists, [boneId]: proposedTwist }, boneId);
  };

  const handleScapulaChange = (axis: 'elevation' | 'protraction', val: number) => {
      if (!selectedBone || isNaN(val)) return;
      if (isPlaying) setIsPlaying(false);
      const current = posture[selectedBone];
      let newVec = { ...current };
      if (axis === 'elevation') newVec.y = -val;
      else if (axis === 'protraction') newVec.z = -val;
      const resolved = resolveKinematics(selectedBone, newVec, posture, twists);
      updatePostureState(resolved.posture, resolved.twists);
  };

  const handleHingeChange = (val: number) => {
      if (!selectedBone || isNaN(val)) return;
      if (isPlaying) setIsPlaying(false);

      const currentVec = posture[selectedBone];
      if (!currentVec) return;

      const currentAngle = getCurrentHingeAngle(selectedBone);
      const deltaRad = (val - currentAngle) * Math.PI / 180;
      const { x, y, z } = currentVec;
      const cosD = Math.cos(deltaRad);
      const sinD = Math.sin(deltaRad);
      const finalVec = normalize({ x, y: y * cosD - z * sinD, z: y * sinD + z * cosD });

      const resolved = resolveKinematics(selectedBone, finalVec, posture, twists);
      updatePostureState(resolved.posture, resolved.twists);
  };

  const handlePointChange = (axis: keyof Vector3, newValue: number) => {
    if (!selectedBone || !targetPos || isNaN(newValue)) return;
    if (isPlaying) setIsPlaying(false);

    if (selectedBone.includes('Clavicle')) {
        const newVec = { ...posture[selectedBone], [axis]: newValue };
        setTargetPos(newVec);
        const resolved = resolveKinematics(selectedBone, newVec, posture, twists);
        updatePostureState(resolved.posture, resolved.twists);
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
        const currentPole = mul(posture[rootBone], len1);
        const solution = solveTwoBoneIK({x:0,y:0,z:0}, newTarget, len1, len2, currentPole);
        if (solution) {
            const rootFrame = createRootFrame({x:0, y:1, z:0});
            const transported = transportFrame(rootFrame, solution.vec1);
            const childVecLocal = worldToLocal(transported, solution.vec2);
            const nextPosture = { ...posture, [rootBone]: solution.vec1, [childBone]: childVecLocal };
            const resolved = resolveFullPosture(nextPosture, twists, rootBone);
            updatePostureState(resolved.posture, resolved.twists);
        }
        return;
    }

    const newTarget = { ...targetPos, [axis]: internalVal };
    const finalVector = normalize(newTarget);
    setTargetPos(newTarget);
    const resolved = resolveKinematics(selectedBone, finalVector, posture, twists);
    updatePostureState(resolved.posture, resolved.twists);
  };

  const handleRotationChange = (val: number) => {
    if (!selectedBone || isNaN(val)) return;
    if (isPlaying) setIsPlaying(false);

    const limits = ROTATION_LIMITS[selectedBone];
    const clampedVal = limits ? clamp(val, limits.min, limits.max) : val;

    const resolved = resolveRotation(selectedBone, clampedVal, posture, twists);
    updatePostureState(resolved.posture, resolved.twists);
  };

  const isScapula = selectedBone ? selectedBone.includes('Clavicle') : false;
  const isHinge = selectedBone ? /Forearm|Tibia|Foot/.test(selectedBone) : false;

  const getHingeConfig = (bone: string) => {
      if (bone.includes('Forearm')) return { label: 'Elbow Flexion', min: 0, max: 160, default: 0 };
      if (bone.includes('Tibia')) return { label: 'Knee Flexion', min: 0, max: 160, default: 0 };
      if (bone.includes('Foot')) return { label: 'Ankle Dorsi/Plantar', min: -90, max: 90, default: 0 };
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
    setSymmetryMode(false);
    setIsPlaying(false);
    setConstraints({});
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
  }, [selectedBone, poseMode, startPosture, endPosture, targetReferenceBone, skeletalData]);


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
            planes={visualConstraintPlanes}
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
            <button onClick={() => setActiveTab('constraints')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'constraints' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Constraints"><Axis3d className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('kinetics')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'kinetics' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="External Forces"><Zap className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('torque')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'torque' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Analysis"><Scale className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('capacities')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'capacities' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Strength Capacity"><Gauge className="w-5 h-5" /></button>
          </div>

          <div className="flex items-center gap-3 mb-6 shrink-0">
            {activeTab === 'kinematics' && <Settings2 className="w-5 h-5 text-indigo-600" />}
            {activeTab === 'constraints' && <Axis3d className="w-5 h-5 text-violet-600" />}
            {activeTab === 'kinetics' && <Zap className="w-5 h-5 text-orange-500" />}
            {activeTab === 'torque' && <Scale className="w-5 h-5 text-gray-800" />}
            {activeTab === 'capacities' && <Gauge className="w-5 h-5 text-purple-600" />}
            <h3 className="text-lg font-bold text-gray-900">
                {activeTab === 'kinematics' ? 'Motion Editor' :
                 activeTab === 'constraints' ? 'Constraints' :
                 activeTab === 'kinetics' ? 'External Forces' :
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

                        {selectedBone === 'spine' ? (
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl py-8">
                                <Lock className="w-8 h-8 text-gray-300 mb-2" />
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
                            <div className="flex items-center gap-2"><Axis3d className="w-4 h-4 text-indigo-500" /><h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Joint State</h4></div>
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

          {activeTab === 'constraints' && (
              <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-violet-50 p-4 rounded-xl border border-violet-100 mb-6">
                      <p className="text-xs text-violet-900 font-medium leading-relaxed">
                          Each constraint blocks motion in a chosen direction. The limb's distal end is locked to the plane perpendicular to that direction.
                      </p>
                  </div>
                  {!selectedBone || selectedBone === 'spine' ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-gray-100 rounded-3xl min-h-[150px]">
                          <MousePointerClick className="w-10 h-10 text-gray-300 mb-3" />
                          <p className="text-gray-500 font-bold text-sm">Select a limb to<br/>configure constraints.</p>
                      </div>
                  ) : (
                      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                          <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-900 text-sm">{BONE_NAMES[selectedBone]}</span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{(constraints[selectedBone] || []).length} Active</span>
                          </div>
                          <button onClick={() => addConstraint(selectedBone)} className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                              <Plus className="w-4 h-4" /> Add Constraint
                          </button>

                          {(constraints[selectedBone] || []).map((c, idx) => (
                              <div key={c.id} className={`bg-white border rounded-2xl p-4 transition-all ${c.active ? 'border-violet-200 shadow-sm' : 'border-gray-100 opacity-70'}`}>
                                  <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${c.active ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</div>
                                          <span className="font-bold text-gray-900 text-sm">Constraint {idx + 1}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <button
                                              onClick={() => updateConstraint(selectedBone, c.id, { active: !c.active })}
                                              className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${c.active ? 'bg-violet-500' : 'bg-gray-200'}`}
                                          >
                                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${c.active ? 'translate-x-4' : 'translate-x-0'}`} />
                                          </button>
                                          <button onClick={() => removeConstraint(selectedBone, c.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                  </div>

                                  {c.active && (
                                      <div className="space-y-4">
                                          <div>
                                              <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Plane Presets</label>
                                              <div className="flex gap-1">
                                                  <button onClick={() => updateConstraint(selectedBone, c.id, { normal: { x: 0, y: 0, z: 1 } })} className="flex-1 py-1.5 bg-gray-50 hover:bg-violet-50 text-[10px] font-bold text-gray-600 rounded-lg border border-transparent hover:border-violet-200 transition-colors">Frontal</button>
                                                  <button onClick={() => updateConstraint(selectedBone, c.id, { normal: { x: 1, y: 0, z: 0 } })} className="flex-1 py-1.5 bg-gray-50 hover:bg-violet-50 text-[10px] font-bold text-gray-600 rounded-lg border border-transparent hover:border-violet-200 transition-colors">Sagittal</button>
                                                  <button onClick={() => updateConstraint(selectedBone, c.id, { normal: { x: 0, y: 1, z: 0 } })} className="flex-1 py-1.5 bg-gray-50 hover:bg-violet-50 text-[10px] font-bold text-gray-600 rounded-lg border border-transparent hover:border-violet-200 transition-colors">Transverse</button>
                                              </div>
                                          </div>

                                          <div>
                                              <div className="flex justify-between items-center mb-2">
                                                  <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Blocked Direction</label>
                                                  <span className="font-mono text-[9px] text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">[{c.normal.x.toFixed(1)}, {c.normal.y.toFixed(1)}, {c.normal.z.toFixed(1)}]</span>
                                              </div>
                                              <div className="space-y-3">
                                                  {(['x', 'y', 'z'] as const).map(axis => (
                                                      <div key={axis} className="flex items-center gap-3">
                                                          <span className="text-[10px] font-bold text-gray-400 w-2 uppercase">{axis}</span>
                                                          <input
                                                              type="range"
                                                              min="-1" max="1" step="0.1"
                                                              value={c.normal[axis]}
                                                              onChange={(e) => updateConstraint(selectedBone, c.id, { normal: { ...c.normal, [axis]: parseFloat(e.target.value) } })}
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

                          {(!constraints[selectedBone] || constraints[selectedBone].length === 0) && (
                              <div className="text-center py-8 text-gray-400 text-xs">No constraints yet.</div>
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
