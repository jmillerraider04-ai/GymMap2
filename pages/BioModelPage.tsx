
import React, { useState, useEffect, useMemo, useRef } from 'react';
import BioMan, { Posture, Vector3, VisualForce, VisualPlane } from '../components/BioMan';
import { Settings2, RotateCcw, MousePointerClick, Move3d, Copy, Lock, Split, Play, Pause, Zap, Scale, Gauge, ChevronLeft, AlertCircle, ArrowDownUp, RefreshCw, ChevronRight, BrainCircuit, Axis3d, Plus, Trash2, TrendingUp } from 'lucide-react';

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

// Resistance profile: piecewise-linear curve mapping timeline position
// t ∈ [0, 1] (start → end of the exercise ROM) to a multiplier on force
// magnitude. Models cams, banded resistance, leveraged machine profiles,
// or any situation where the "weight" changes through the movement.
// Default (no profile) = constant multiplier of 1.0.
interface ResistanceProfile {
    points: { t: number; multiplier: number }[];
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
    // Point-tracking (cable) mode: force always aims from attachment toward pulley
    pulley?: Vector3;
    // Bone-local direction mode: when true, the (x, y, z) vector is
    // interpreted in the bone's local joint frame and transformed to world
    // space at each pose. Models lever machines where the handle swings
    // with the limb, so the force direction tracks with the bone rather
    // than staying fixed in world space. Cable (pulley) overrides this.
    localFrame?: boolean;
    // When true AND localFrame is true, the bone's IR/ER twist is excluded
    // from the local frame computation. The force rotates with the bone's
    // gross swing (flexion, abduction, etc.) but NOT with its axial twist.
    // This is the typical lever-machine behavior: the handle pivots as the
    // lever swings, but the handle doesn't spin around the shaft. Without
    // this, small twist changes (which can occur even in non-rotation
    // exercises due to how IR/ER is defined) cause the force to rotate
    // unexpectedly.
    localFrameIgnoreTwist?: boolean;
    // Resistance profile: magnitude multiplier as a function of ROM t.
    profile?: ResistanceProfile;
}

interface BoneConstraint {
    id: string;
    active: boolean;
    type: 'planar' | 'arc' | 'fixed';
    position?: number; // 0 (proximal) to 1 (distal) — where along the bone (default 1)
    // Planar fields
    normal: Vector3;   // direction the limb CANNOT move in
    center: Vector3;   // world-space point the constraint passes through
    // Arc fields (used when type === 'arc')
    pivot?: Vector3;   // world-space center of rotation (machine axle)
    axis?: Vector3;    // rotation axis direction
    radius?: number;   // distance from pivot to tip (computed at creation)
    // Symmetry mirroring: if set, the constraint on the opposite-side bone
    // sharing this same mirrorId stays in sync with this one.
    mirrorId?: string;
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

interface ActionAxis {
    positiveAction: string;
    negativeAction: string;
    axis: Vector3;
    isBoneAxis?: boolean;  // true for IR/ER — axis computed from current bone direction
    // When true, the axis is interpreted in WORLD space and skips the
    // jointFrame local-to-world transformation. Used for actions like
    // horizontal ab/ad that are defined relative to the world orientation
    // (transverse plane of a standing person), not the joint's local frame.
    // Without this flag, horizontal ab/ad's local Y axis would alias to the
    // humerus bone axis in the joint frame and collide with IR/ER.
    useWorldAxis?: boolean;
}

interface JointActionDemand {
    boneId: string;
    jointGroup: JointGroup;
    action: string;
    torqueMagnitude: number;
    effort: number;
}

interface TorqueDistributionResult {
    demands: JointActionDemand[];
    totalEffort: number;
    limitingAction: JointActionDemand | null;
    rawTorques: Record<string, Vector3>;
    // Net transmitted force at each bone's proximal joint, in world space.
    // Computed by walking the chain from each applied force up to the root
    // and summing the force vector, plus Phase B constraint reaction forces
    // (λ·n) at every ancestor of a constrained bone. Used by the limb force
    // arrow visualization so the user can see at a glance what each joint
    // is actually resisting once constraints have done their work.
    jointForces: Record<string, Vector3>;
}

// --- JOINT LIMITS ---
//
// Per joint-action pair, store the passive end-range in degrees. When the
// physics engine wires this up, torque components pushing the joint past
// min or max become "passively absorbed" (bone/capsule/ligament) and drop
// out of the muscle demand calculation. The UI treats the positive-action
// direction as "positive angle" and negative-action as "negative angle",
// so a joint like Elbow (Flexion = positive, Extension = negative) has
// limits like { min: 0, max: 160 }.
//
// The data model supports sophistication that the first-pass UI may hide:
//
//   softZone   - an optional end-range width (degrees) where resistance
//                ramps linearly from 0 at (limit - softZone) to full at
//                the limit. 0 or undefined means a perfectly hard stop.
//
//   coupling   - optional linear coupling to another joint action's live
//                angle. The effective limit becomes
//                    limit + slope * couplingAction.currentAngle
//                so e.g. hip flexion limit can fall as knee extends.
//                Null means independent limits.
//
// Keyed by "${JointGroup}.${positiveAction}" — limits are shared bilaterally
// (left and right share the same anatomy), so we don't key by bone.
interface JointLimitCoupling {
    dependsOn: string;   // "${JointGroup}.${positiveAction}" of the coupling source
    slopeMin: number;    // degrees shift in min per degree of source
    slopeMax: number;    // degrees shift in max per degree of source
}
interface JointLimit {
    min: number;
    max: number;
    softZone?: number;
    coupling?: JointLimitCoupling;
}
type JointLimitsMap = Record<string, JointLimit>;

const createCap = (base: number, specific: number = base, angle: number = 90): CapacityConfig => ({ base, specific, angle });

// Evaluate a capacity at a given joint angle. Uses cosine interpolation
// between `base` (strength at the worst position) and `specific` (strength
// at the optimal `angle`). The curve is a smooth bell centered at `angle`:
//
//   cap(θ) = base + (specific - base) × ½(1 + cos(π × |θ - angle| / 180))
//
//   θ = angle     →  cos(0) = 1       →  cap = specific  (peak)
//   θ = angle±90  →  cos(π/2) = 0     →  cap = (base+specific)/2  (mid)
//   θ = angle±180 →  cos(π) = -1      →  cap = base  (weakest)
//
// This is a deliberate simplification — real strength curves aren't
// perfectly cosine-shaped — but it's the right shape (bell, smooth, peaked
// at mid-range) and only uses the three numbers already in CapacityConfig.
const evaluateCapacity = (cap: CapacityConfig, currentAngle: number): number => {
    const dist = Math.min(Math.abs(currentAngle - cap.angle), 180);
    const blend = 0.5 + 0.5 * Math.cos(dist * Math.PI / 180);
    return Math.max(cap.base + (cap.specific - cap.base) * blend, 0.001);
};

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

// Default joint limits. Key scheme:
//   "${group}.action.${positiveActionName}" — action-based dimension
//   "${group}.dir.${x|y|z}"                 — direction-component dimension
//
// Bilateral normalization: limits are stored in RIGHT-side convention for
// dir.x (since +X is body-right in model coordinates). Left-side bones
// negate their x before comparison, so the same limit table serves both.
// Y/Z/action values have no bilateral flip — they're already symmetric
// across the sagittal plane (both arms flex forward to -z, both elevate
// up to -y, both flex about the mediolateral X axis).
//
// All numbers are approximate population ROM for a healthy adult. Users
// can edit these in the Joint Limits tab if they need something different.
const DEFAULT_JOINT_LIMITS: JointLimitsMap = {
    // --- Scapula (clavicle offset, model-unit cm, y-down) ---
    'Scapula.dir.y': { min: -15, max: 10 },
    'Scapula.dir.z': {
        min: -15, max: 10,
        // "Retraction limit increases slightly as the scapula elevates."
        // elevation = dir.y decreasing (more negative).  dir.z.min is the
        // retraction stop; we want it to decrease (more retraction) as y
        // decreases. effective.min = min + slopeMin * source.currentValue
        //   y =   0  →  eff.min = -15            (neutral)
        //   y = -10  →  eff.min = -15 + 0.5*-10 = -20  (5 more retraction)
        coupling: { dependsOn: 'Scapula.dir.y', slopeMin: 0.5, slopeMax: 0 },
    },

    // --- Shoulder (humerus unit direction, right-normalized) ---
    // Right arm at rest is (0, 1, 0). Full abduction ≈ (1, 0, 0).
    // Cross-body adduction reaches ≈ (-0.4, 0.9, 0) at ~25°.
    // Overhead (y = -1) is hit via flexion or abduction.
    // Forward flexion tip reaches (0, 0, -1); further overhead curls back.
    // Backward extension ≈ 60° → z ≈ +0.87.
    'Shoulder.dir.x': { min: -0.4, max: 1.02 },
    'Shoulder.dir.y': { min: -1.02, max: 1.02 },
    'Shoulder.dir.z': { min: -1.02, max: 0.9 },
    'Shoulder.action.External Rotation': { min: -90, max: 90 },

    // --- Elbow hinge. The slider emits 0-160 meaning "degrees of flexion"
    // and the drag handler uses that value directly as a stored-angle
    // target, so the joint limit has to be in THAT same space: 0 straight,
    // 160 fully flexed. positiveAction = Extension is a SEPARATE convention
    // for demand labeling — it controls whether a positive torque component
    // gets labeled "Extension" or "Flexion", and is independent of which
    // direction the stored hinge angle calls positive. The two conventions
    // happen to disagree here, which is fine as long as nothing mixes them.
    'Elbow.action.Extension': { min: 0, max: 160 },

    // --- Spine (fixed in the model today; defined for static analysis) ---
    'Spine.action.Flexion':          { min: -30, max: 80 },
    'Spine.action.Lateral Flexion L':{ min: -35, max: 35 },
    'Spine.action.Rotation L':       { min: -45, max: 45 },

    // --- Hip (femur unit direction, right-normalized) ---
    // Standing rest: (0, 1, 0). Flexion forward curls y toward -0.5 with
    // z → -0.85 at ~120°. Extension back reaches z ≈ 0.3 at ~20°.
    // Abduction out to ≈ 45° gives x ≈ 0.7. Cross-midline adduction ≈ -0.35.
    'Hip.dir.x': { min: -0.35, max: 0.75 },
    'Hip.dir.y': { min: -0.55, max: 1.02 },
    'Hip.dir.z': { min: -0.9,  max: 0.4  },
    'Hip.action.External Rotation': { min: -45, max: 45 },

    // --- Knee hinge. Same as Elbow — limit is in slider space (0=straight, 160=full flex). ---
    'Knee.action.Extension': { min: 0, max: 160 },

    // --- Ankle hinge. positiveAction = Dorsi Flexion. ---
    'Ankle.action.Dorsi Flexion': { min: -50, max: 30 },
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

// Build the mirrored force payload (same values, X components negated,
// boneId flipped). Returns everything EXCEPT id / mirrorId so callers can
// set those based on their own pairing logic.
const mirrorForceData = (f: ForceConfig): Omit<ForceConfig, 'id' | 'mirrorId'> => {
    const opp = getOppositeBone(f.boneId) || f.boneId;
    return {
        name: f.name,
        boneId: opp,
        position: f.position,
        x: -f.x,
        y: f.y,
        z: f.z,
        magnitude: f.magnitude,
        pulley: f.pulley ? { x: -f.pulley.x, y: f.pulley.y, z: f.pulley.z } : undefined,
        // Carry over all optional force features so the mirrored side
        // stays in sync with the source side's configuration.
        localFrame: f.localFrame,
        localFrameIgnoreTwist: f.localFrameIgnoreTwist,
        profile: f.profile ? { points: f.profile.points.map(p => ({ ...p })) } : undefined,
    };
};

// Build the mirrored constraint payload. X components of normal/center/pivot/axis
// are negated so the constraint lives on the opposite side of the body plane.
// `position` (where along the bone the constraint applies, 0=proximal, 1=distal)
// is preserved as-is — it's a scalar that doesn't depend on side. Dropping it
// here used to default the mirror to position=1 (distal), which produced an
// asymmetric pair whenever the source had been moved to any non-default spot
// on its bone (e.g., a proximal foot constraint mirrored to a distal mirror),
// breaking Phase C's equilibrium in symmetry mode.
const mirrorConstraintData = (c: BoneConstraint): Omit<BoneConstraint, 'id' | 'mirrorId'> => {
    return {
        active: c.active,
        type: c.type,
        position: c.position,
        normal: { x: -c.normal.x, y: c.normal.y, z: c.normal.z },
        center: { x: -c.center.x, y: c.center.y, z: c.center.z },
        pivot: c.pivot ? { x: -c.pivot.x, y: c.pivot.y, z: c.pivot.z } : undefined,
        axis: c.axis ? { x: -c.axis.x, y: c.axis.y, z: c.axis.z } : undefined,
        radius: c.radius,
    };
};

// Wholesale symmetry sync for forces: discards all forces whose bone starts
// with the opposite-side prefix, then regenerates them as mirrors of the
// source side. Non-sided forces (e.g. spine) pass through untouched.
const syncForcesFromSide = (list: ForceConfig[], sourceSide: 'r' | 'l'): ForceConfig[] => {
    const sourceForces = list.filter(f => f.boneId.startsWith(sourceSide));
    const nonSided = list.filter(f => !f.boneId.startsWith('r') && !f.boneId.startsWith('l'));
    const promoted = sourceForces.map(f => ({ ...f, mirrorId: undefined as string | undefined }));
    const mirrors: ForceConfig[] = sourceForces.map(f => ({
        ...mirrorForceData(f),
        id: 'm_' + f.id + '_' + Math.random().toString(36).slice(2, 6),
        mirrorId: f.id,
    }));
    return [...promoted, ...mirrors, ...nonSided];
};

// Wholesale symmetry sync for constraints: discards all opposite-side
// constraint lists, then regenerates them as mirrors of the source side.
const syncConstraintsFromSide = (
    map: Record<string, BoneConstraint[]>,
    sourceSide: 'r' | 'l'
): Record<string, BoneConstraint[]> => {
    const oppSide = sourceSide === 'r' ? 'l' : 'r';
    const next: Record<string, BoneConstraint[]> = {};
    Object.entries(map).forEach(([boneId, list]) => {
        if (boneId.startsWith(oppSide)) return; // wipe opposite-side
        next[boneId] = list.map(c => ({ ...c, mirrorId: undefined }));
    });
    Object.entries(map).forEach(([boneId, list]) => {
        if (!boneId.startsWith(sourceSide)) return;
        const oppBone = getOppositeBone(boneId);
        if (!oppBone) return;
        next[oppBone] = list.map(c => ({
            ...mirrorConstraintData(c),
            id: 'mc_' + c.id + '_' + Math.random().toString(36).slice(2, 6),
            mirrorId: c.id,
        }));
    });
    return next;
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
// Checkpoint-based frame for humerus/femur. Base: shortest-arc from
// {0,1,0} to bone direction. Above-horizontal correction: smoothly twists
// the frame from 0° at the horizon to 180° at overhead, proportional to
// how "coronal" the arm direction is. This ensures:
//   arm at side → forearm FWD     90° abd → FWD
//   90° flex → UP                 overhead → BACK
//   90° ext → DOWN
// with gradual transitions between all checkpoints (smoothstep ramp so
// 50% of the correction occurs at the midpoint in degrees).
const createAbsoluteFrame = (boneDir: Vector3, flipAxes: boolean): Frame => {
    const u = normalize(boneDir);
    const ref = { x: 0, y: 1, z: 0 };
    const right = applyShortestArcRotation(ref, u, { x: 1, y: 0, z: 0 });
    const back = applyShortestArcRotation(ref, u, { x: 0, y: 0, z: 1 });
    let frame: Frame;
    if (flipAxes) {
        frame = { x: mul(right, -1), y: u, z: mul(back, -1) };
    } else {
        frame = { x: right, y: u, z: back };
    }
    // Above-horizontal correction: for coronal-plane motion the shortest-arc
    // preserves the forearm's forward direction all the way to overhead, then
    // snaps at the antipodal singularity. This correction smoothly twists
    // from 0° at the horizon to 180° at overhead so the forearm gradually
    // rotates from FWD to BACK. Sagittal-plane motion (which the shortest-arc
    // already handles correctly) gets no correction.
    if (u.y < 0) {
        const hSq = u.x * u.x + u.z * u.z;
        if (hSq > 1e-8) {
            const excess = Math.acos(Math.max(-1, Math.min(1, u.y))) - Math.PI / 2;
            const t = Math.min(excess / (Math.PI / 2), 1);
            const ramp = t * t * (3 - 2 * t); // smoothstep: 50% at midpoint
            const signedCoronal = u.x * Math.abs(u.x) / hSq;
            frame = twistFrame(frame, ramp * -180 * signedCoronal);
        }
    }
    return frame;
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

// --- SOLVER / ANALYSIS TOLERANCES ---
// Module-scope because calculateTorqueDistribution (declared early in the
// component body) is invoked from a useMemo that fires before the in-body
// const declarations run, so these need to live outside the closure to
// avoid a Temporal Dead Zone error.
const SOLVER_TOL_SCALE = 0.0005;
const SOLVER_MIN_TOL = 0.01;

// --- HINGE BONE HELPERS ---
// Hinge bones (forearm/tibia/foot) live on a 1-DOF arc in the parent's local
// y-z plane. Module-scope so they're available in both calculateTorqueDistribution
// (used inside a useMemo that fires before in-body const declarations run) and
// solveConstraintsAccommodating.
const isHingeBone = (b: string) => /Forearm|Tibia|Foot/.test(b);
const hingeAngleToDir = (b: string, theta: number): Vector3 => {
    if (b.includes('Foot')) return { x: 0, y: Math.sin(theta), z: -Math.cos(theta) };
    return { x: 0, y: Math.cos(theta), z: Math.sin(theta) };
};
const dirToHingeAngle = (b: string, d: Vector3): number => {
    if (b.includes('Foot')) return Math.atan2(d.y, -d.z);
    return Math.atan2(d.z, d.y);
};

// --- INTERPOLATION UTILS ---
const interpolateVector = (start: Vector3, end: Vector3, t: number): Vector3 => ({
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
});

// Spherical linear interpolation for unit direction vectors. Gives constant
// angular velocity along the great circle between start and end — the bone
// tip sweeps degrees-per-tick linearly in t, so at fixed playback t-rate
// every slider moves at a speed proportional to its total delta. Falls back
// to linear lerp for near-parallel or near-antipodal cases.
const slerpDirection = (start: Vector3, end: Vector3, t: number): Vector3 => {
    const d = start.x * end.x + start.y * end.y + start.z * end.z;
    const clamped = Math.max(-1, Math.min(1, d));
    const omega = Math.acos(clamped);
    const sinO = Math.sin(omega);
    if (sinO < 1e-4) {
        // Degenerate: lerp and renormalize.
        const v = interpolateVector(start, end, t);
        const m = Math.hypot(v.x, v.y, v.z) || 1;
        return { x: v.x / m, y: v.y / m, z: v.z / m };
    }
    const a = Math.sin((1 - t) * omega) / sinO;
    const b = Math.sin(t * omega) / sinO;
    return {
        x: a * start.x + b * end.x,
        y: a * start.y + b * end.y,
        z: a * start.z + b * end.z,
    };
};

const interpolateScalar = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
};

// Evaluate a resistance profile at timeline position t. Returns the
// magnitude multiplier (piecewise-linear interpolation between control
// points). If profile is undefined/empty, returns 1.0 (flat profile).
const evaluateProfile = (profile: ResistanceProfile | undefined, t: number): number => {
    if (!profile || profile.points.length === 0) return 1;
    if (profile.points.length === 1) return profile.points[0].multiplier;
    const pts = profile.points; // assume sorted by t ascending
    if (t <= pts[0].t) return pts[0].multiplier;
    if (t >= pts[pts.length - 1].t) return pts[pts.length - 1].multiplier;
    for (let i = 0; i < pts.length - 1; i++) {
        if (t >= pts[i].t && t <= pts[i + 1].t) {
            const frac = (t - pts[i].t) / (pts[i + 1].t - pts[i].t);
            return pts[i].multiplier + frac * (pts[i + 1].multiplier - pts[i].multiplier);
        }
    }
    return 1;
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
  const [activeTab, setActiveTab] = useState<'kinematics' | 'kinetics' | 'torque' | 'timeline' | 'capacities' | 'constraints' | 'limits'>('kinematics');
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
  // Current ROM position for resistance profile evaluation. 0 = start pose,
  // 1 = end pose. Updated by pose-mode switch and playback animation.
  const [currentRomT, setCurrentRomT] = useState(0);
  const animationRef = useRef<number | null>(null);
  const [forces, setForces] = useState<ForceConfig[]>([]);
  const [editingForceId, setEditingForceId] = useState<string | null>(null);
  const [jointCapacities, setJointCapacities] = useState<Record<JointGroup, JointCapacityProfile>>(DEFAULT_CAPACITIES);
  const [jointLimits, setJointLimits] = useState<JointLimitsMap>(DEFAULT_JOINT_LIMITS);
  // Joint Analysis tab display mode:
  //   '1rm-local' — normalize so the hardest action at the current pose reads
  //                 100%. Interprets the pose as "loaded to 1RM right now."
  //                 Cross-joint comparable, no ROM scan required.
  //   'raw'       — show raw effort (torque/capacity) as-is. Only meaningful if
  //                 the user has calibrated f.magnitude to match the capacity
  //                 table's unit scale, which defaults don't.
  const [torqueDisplayMode, setTorqueDisplayMode] = useState<'1rm-local' | 'raw'>('1rm-local');
  
  // Removed reactionForces state — replaced by the jointForceArrows memo
  // below which derives net proximal force per bone from torqueDistribution.
  const [calculatedTorques, setCalculatedTorques] = useState<Record<string, Vector3>>({});
  const [neuralCosts, setNeuralCosts] = useState<Record<string, number>>({});

  const [constraints, setConstraints] = useState<Record<string, BoneConstraint[]>>({});

  const calculateKinematics = (currentPosture: Posture, currentTwists: Record<string, number>) => {
    const locations: Record<string, Vector3> = {};
    const boneEndPoints: Record<string, Vector3> = {};
    const boneStartPoints: Record<string, Vector3> = {};
    const jointFrames: Record<string, Frame> = {};

    const pelvisPos = { x: 0, y: CONFIG.TORSO_LEN / 2, z: 0 };
    const neckBase = { x: 0, y: -CONFIG.TORSO_LEN / 2, z: 0 };
    locations['Spine'] = pelvisPos;

    boneStartPoints['spine'] = pelvisPos;
    boneEndPoints['spine'] = neckBase;

    const lClavOffset = currentPosture['lClavicle'] || { x: -25, y: 0, z: 0 };
    const rClavOffset = currentPosture['rClavicle'] || { x: 25, y: 0, z: 0 };

    locations['lShoulder'] = { x: neckBase.x + lClavOffset.x, y: neckBase.y + lClavOffset.y, z: neckBase.z + lClavOffset.z };
    locations['rShoulder'] = { x: neckBase.x + rClavOffset.x, y: neckBase.y + rClavOffset.y, z: neckBase.z + rClavOffset.z };

    boneStartPoints['lClavicle'] = neckBase;
    boneStartPoints['rClavicle'] = neckBase;
    boneEndPoints['lClavicle'] = locations['lShoulder'];
    boneEndPoints['rClavicle'] = locations['rShoulder'];

    locations['lHip'] = { x: -CONFIG.HIP_WIDTH, y: pelvisPos.y, z: 0 };
    locations['rHip'] = { x: CONFIG.HIP_WIDTH, y: pelvisPos.y, z: 0 };

    const rootFrame = createRootFrame({x: 0, y: 1, z: 0});
    jointFrames['spine'] = rootFrame;
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
            frame1Base = createAbsoluteFrame(dir1World, true);
        } else if (name.includes('Femur')) {
            frame1Base = createAbsoluteFrame(dir1World, false);
        } else {
            frame1Base = transportFrame(parentFrame, dir1World);
        }
        
        jointFrames[name] = parentFrame; 
        
        let twist = currentTwists[name] || 0;
        // ISB offset: align the twist=0 reference with the ISB "plane of
        // elevation" convention so the slider reads ISB axial rotation.
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
  // Pure validity guard: applies the proposed bone direction (and its mirror,
  // if symmetry is on) to a hypothetical posture, recomputes the entire
  // kinematic chain, and checks EVERY active constraint on EVERY bone — not
  // just the moved bone. If any constraint would be violated at the proposal
  // OR anywhere along the slerp arc from current to proposed, the motion is
  // rejected and the bone stays put. No projection, no sliding, no IK.
  const projectDirOntoConstraints = (
      boneId: string,
      proposedLocalDir: Vector3,
      basePosture: Posture,
      baseTwists: Record<string, number>
  ): Vector3 => {
      // Collect all active constraints across all bones.
      const allCons: { boneId: string; c: BoneConstraint }[] = [];
      (Object.entries(constraints) as [string, BoneConstraint[]][]).forEach(([bid, list]) => {
          for (const c of list) if (c.active) allCons.push({ boneId: bid, c });
      });
      if (allCons.length === 0) return proposedLocalDir;

      const currentLocalDir = basePosture[boneId];
      if (!currentLocalDir) return proposedLocalDir;

      const buildPosture = (dir: Vector3): Posture => {
          let p: Posture = { ...basePosture, [boneId]: dir };
          if (symmetryMode) p = mirrorPosture(p, boneId);
          return p;
      };

      const violates = (samplePosture: Posture): boolean => {
          const kin = calculateKinematics(samplePosture, baseTwists);
          for (const { boneId: bid, c } of allCons) {
              const tip = getConstraintPoint(bid, c, kin);
              if (!tip) continue;
              const L = BONE_LENGTHS[bid] || 0;
              const TOL = Math.max(SOLVER_MIN_TOL, L * SOLVER_TOL_SCALE);
              if (c.type === 'arc' && c.pivot && c.axis && c.radius !== undefined) {
                  const toTip = sub(tip, c.pivot);
                  const axisN = normalize(c.axis);
                  const axialDist = dotProduct(toTip, axisN);
                  const inPlane = sub(toTip, mul(axisN, axialDist));
                  const radialErr = magnitude(inPlane) - c.radius;
                  if (Math.abs(radialErr) > TOL || Math.abs(axialDist) > TOL) return true;
              } else {
                  const N = normalize(c.normal);
                  if (Math.abs(dotProduct(sub(tip, c.center), N)) > TOL) return true;
              }
          }
          return false;
      };

      // Slerp between current and proposed local directions and sample the
      // arc. Local-frame slerp is fine here because at every sample we rebuild
      // the full posture and recompute world-space kinematics for the check.
      const a = currentLocalDir;
      const b = proposedLocalDir;
      const dotAB = Math.max(-1, Math.min(1, dotProduct(a, b)));
      const theta = Math.acos(dotAB);
      const N_SAMPLES = 24;
      if (theta < 1e-5) {
          return violates(buildPosture(b)) ? a : b;
      }
      const sinT = Math.sin(theta);
      for (let i = 1; i <= N_SAMPLES; i++) {
          const s = i / N_SAMPLES;
          const wa = Math.sin((1 - s) * theta) / sinT;
          const wb = Math.sin(s * theta) / sinT;
          const d = normalize({
              x: wa * a.x + wb * b.x,
              y: wa * a.y + wb * b.y,
              z: wa * a.z + wb * b.z
          });
          if (violates(buildPosture(d))) return a;
      }
      return b;
  };

  // Project pivot along axis so the arc plane passes through the tip.
  // Returns the adjusted pivot and the in-plane radius.
  const snapArcToTip = (rawPivot: Vector3, axis: Vector3, tip: Vector3): { pivot: Vector3; radius: number } => {
      const axisN = normalize(axis);
      const offset = dotProduct(sub(tip, rawPivot), axisN);
      const pivot = add(rawPivot, mul(axisN, offset));
      const radius = magnitude(sub(tip, pivot));
      return { pivot, radius };
  };

  // Determine source side from an edited bone id: 'l'/'r' prefix, else null.
  const sideOf = (boneId: string): 'l' | 'r' | null => {
      if (boneId.startsWith('l')) return 'l';
      if (boneId.startsWith('r')) return 'r';
      return null;
  };

  // Wholesale sync: after ANY edit on a side, wipe the opposite side's
  // posture, twists, forces, and constraints and regenerate them from the
  // source side. Each handler for positioning/forces/constraints should call
  // this after its primary state update so a single nudge mirrors the whole
  // pose, not just the edited domain.
  //
  // Updates BOTH the live posture/twists AND the active keyframe (start or
  // end) so that switching pose modes or triggering playback doesn't reveal
  // stale asymmetric keyframes.
  const applyWholesaleSync = (src: 'l' | 'r') => {
      // mirrorPosture/mirrorTwists key off the first character of their
      // sourceBoneId argument, so passing the side letter alone is enough.
      setPosture(prev => mirrorPosture(prev, src));
      setTwists(prev => mirrorTwists(prev, src));
      if (poseMode === 'start') {
          setStartPosture(prev => mirrorPosture(prev, src));
          setStartTwists(prev => mirrorTwists(prev, src));
      } else {
          setEndPosture(prev => mirrorPosture(prev, src));
          setEndTwists(prev => mirrorTwists(prev, src));
      }
      setForces(prev => syncForcesFromSide(prev, src));
      setConstraints(prev => syncConstraintsFromSide(prev, src));
  };

  // World-space point where a constraint applies, interpolated along the bone.
  const getConstraintPoint = (boneId: string, c: BoneConstraint, kin: ReturnType<typeof calculateKinematics>): Vector3 | null => {
      const seg = kin.boneStartPoints[boneId];
      const end = kin.boneEndPoints[boneId];
      if (!seg || !end) return null;
      return add(seg, mul(sub(end, seg), c.position ?? 1));
  };

  const addConstraint = (boneId: string, type: 'planar' | 'arc' | 'fixed' = 'planar') => {
      const kin = calculateKinematics(posture, twists);
      const tip = kin.boneEndPoints[boneId];
      if (!tip) return;
      const baseId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
      let newC: BoneConstraint;
      if (type === 'fixed') {
          newC = {
              id: baseId, active: true, type: 'fixed',
              normal: { x: 0, y: 0, z: 0 }, // unused but required by interface
              center: tip,
          };
      } else if (type === 'arc') {
          const start = kin.boneStartPoints[boneId];
          const rawPivot = start || { x: 0, y: 0, z: 0 };
          const axis = { x: 0, y: 0, z: 1 };
          const { pivot, radius } = snapArcToTip(rawPivot, axis, tip);
          newC = {
              id: baseId, active: true, type: 'arc',
              normal: axis, center: tip,
              pivot, axis, radius,
          };
      } else {
          newC = {
              id: baseId, active: true, type: 'planar',
              normal: { x: 0, y: 0, z: 1 },
              center: tip,
          };
      }
      setConstraints(prev => ({ ...prev, [boneId]: [...(prev[boneId] || []), newC] }));
      const src = sideOf(boneId);
      if (symmetryMode && src) applyWholesaleSync(src);
  };

  const updateConstraint = (boneId: string, id: string, updates: Partial<BoneConstraint>) => {
      setConstraints(prev => {
          const sourceList = (prev[boneId] || []).map(c => c.id === id ? { ...c, ...updates } : c);
          return { ...prev, [boneId]: sourceList };
      });
      const src = sideOf(boneId);
      if (symmetryMode && src) applyWholesaleSync(src);
  };

  const removeConstraint = (boneId: string, id: string) => {
      setConstraints(prev => ({
          ...prev,
          [boneId]: (prev[boneId] || []).filter(c => c.id !== id),
      }));
      const src = sideOf(boneId);
      if (symmetryMode && src) applyWholesaleSync(src);
  };

  const visualConstraintPlanes = useMemo<VisualPlane[]>(() => {
      const out: VisualPlane[] = [];
      const kin = calculateKinematics(posture, twists);
      (Object.entries(constraints) as [string, BoneConstraint[]][]).forEach(([boneId, list]) => {
          list.forEach(c => {
              if (!c.active) return;
              if (c.type === 'fixed') {
                  // Fixed point: show 3 small orthogonal planes as a visual
                  // "pin" marker at the locked position. Use a smaller size
                  // and distinct color (rose) so it reads as "locked here."
                  const pt = c.center;
                  const SZ = 20;
                  out.push({ id: c.id + '-fx', center: pt, normal: { x: 1, y: 0, z: 0 }, size: SZ, color: 'rgba(244, 63, 94, 0.25)', boneId });
                  out.push({ id: c.id + '-fy', center: pt, normal: { x: 0, y: 1, z: 0 }, size: SZ, color: 'rgba(244, 63, 94, 0.25)', boneId });
                  out.push({ id: c.id + '-fz', center: pt, normal: { x: 0, y: 0, z: 1 }, size: SZ, color: 'rgba(244, 63, 94, 0.25)', boneId });
              } else if (c.type === 'arc' && c.pivot && c.axis && c.radius !== undefined) {
                  out.push({
                      id: c.id,
                      center: c.pivot,
                      normal: c.axis,
                      size: c.radius * 2,
                      color: 'rgba(245, 158, 11, 0.2)',
                      boneId,
                      type: 'arc',
                      pivot: c.pivot,
                      axis: c.axis,
                      radius: c.radius
                  });
              } else {
                  const tip = getConstraintPoint(boneId, c, kin) || c.center;
                  out.push({
                      id: c.id,
                      center: tip,
                      normal: c.normal,
                      size: 80,
                      color: 'rgba(139, 92, 246, 0.2)',
                      boneId
                  });
              }
          });
      });
      return out;
  }, [constraints, posture, twists]);

  // Force direction with explicit kinematics (avoids recalculating).
  const getForceDirectionWithKin = (f: ForceConfig, kin: ReturnType<typeof calculateKinematics>, bTwists?: Record<string, number>): Vector3 => {
      // Cable mode: direction always from attachment point toward pulley.
      // Takes priority over localFrame (cable direction is world-space by
      // definition — the cable goes to a fixed point in the room).
      if (f.pulley) {
          const seg = kin.boneStartPoints[f.boneId];
          const end = kin.boneEndPoints[f.boneId];
          if (seg && end) {
              const attachPt = add(seg, mul(sub(end, seg), f.position));
              const towardPulley = sub(f.pulley, attachPt);
              const len = magnitude(towardPulley);
              if (len > 0.001) return mul(towardPulley, 1 / len);
          }
      }
      const raw = normalize({ x: f.x, y: f.y, z: f.z });
      // Bone-local mode: interpret (x, y, z) as a direction in the bone's
      // OWN local frame (Y = bone axis, X = perpendicular "hinge" axis,
      // Z = flex direction) and transform to world space. As the bone moves,
      // the force direction rotates with it — models lever-type machines
      // where the handle is rigidly attached to the limb.
      //
      // NOTE: jointFrames[boneId] stores the bone's PARENT frame, not the
      // bone's own frame. We need to transport the parent frame to the
      // bone's current direction and apply its twist to get the bone's
      // own frame. This is the same computation calculateChain does, just
      // reconstructed here from the stored kinematics.
      if (f.localFrame) {
          const parentFrame = kin.jointFrames[f.boneId];
          const bs = kin.boneStartPoints[f.boneId];
          const be = kin.boneEndPoints[f.boneId];
          if (parentFrame && bs && be) {
              const boneWorldDir = normalize(sub(be, bs));
              const boneFrame = transportFrame(parentFrame, boneWorldDir);
              // When localFrameIgnoreTwist is set, use the pre-twist frame
              // so the force tracks the bone's swing but not its axial
              // rotation. This is the common lever-machine behavior.
              const frame = f.localFrameIgnoreTwist
                  ? boneFrame
                  : twistFrame(boneFrame, bTwists?.[f.boneId] || 0);
              return normalize({
                  x: raw.x * frame.x.x + raw.y * frame.y.x + raw.z * frame.z.x,
                  y: raw.x * frame.x.y + raw.y * frame.y.y + raw.z * frame.z.y,
                  z: raw.x * frame.x.z + raw.y * frame.y.z + raw.z * frame.z.z,
              });
          }
      }
      return raw;
  };

  const getForceDirection = (f: ForceConfig): Vector3 => {
      return getForceDirectionWithKin(f, calculateKinematics(posture, twists), twists);
  };

  const getVisualVector = (f: ForceConfig): Vector3 => {
      const dir = getForceDirection(f);
      return mul(dir, f.magnitude);
  };

  // --- TORQUE DISTRIBUTION ---
  // Gaussian elimination for small linear systems (Phase B optimization)
  // Convert an action label like "Horizontal Adduction" to camelCase
  // ("horizontalAdduction") to match the keys in DEFAULT_CAPACITIES.
  const actionKey = (name: string): string =>
      name.split(' ').map((w, i) => {
          if (w.length === 0) return w;
          const lower = w.toLowerCase();
          return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
      }).join('');

  const solveSmall = (M: number[][], b: number[]): number[] => {
      const n = b.length;
      if (n === 0) return [];
      if (n === 1) return Math.abs(M[0][0]) > 1e-12 ? [b[0] / M[0][0]] : [0];
      const A = M.map(r => [...r]); const rhs = [...b];
      for (let c = 0; c < n; c++) {
          let mr = c, mv = Math.abs(A[c][c]);
          for (let r = c+1; r < n; r++) if (Math.abs(A[r][c]) > mv) { mr = r; mv = Math.abs(A[r][c]); }
          if (mv < 1e-12) continue;
          [A[c], A[mr]] = [A[mr], A[c]]; [rhs[c], rhs[mr]] = [rhs[mr], rhs[c]];
          for (let r = c+1; r < n; r++) { const f = A[r][c]/A[c][c]; for (let j = c; j < n; j++) A[r][j] -= f*A[c][j]; rhs[r] -= f*rhs[c]; }
      }
      const x = new Array(n).fill(0);
      for (let i = n-1; i >= 0; i--) { let s = rhs[i]; for (let j = i+1; j < n; j++) s -= A[i][j]*x[j]; x[i] = Math.abs(A[i][i]) > 1e-12 ? s/A[i][i] : 0; }
      return x;
  };

  const calculateTorqueDistribution = (
      currentPosture: Posture,
      currentTwists: Record<string, number>,
      currentForces: ForceConfig[],
      capacities: Record<JointGroup, JointCapacityProfile>,
      activeConstraints?: Record<string, BoneConstraint[]>,
      // Current ROM position [0, 1] for resistance profile evaluation.
      // Defaults to 0 (start pose) when not provided.
      currentT: number = 0
  ): TorqueDistributionResult => {
      const kin = calculateKinematics(currentPosture, currentTwists);

      // --- Freefall gate ---
      // Without ANY active constraint on ANY bone, the figure is floating
      // in space. Every applied force just accelerates the center of mass —
      // no joint needs to resist anything, so demands are identically zero.
      // This is the physically correct behavior: you can't have shoulder
      // demand from a hand force unless something below (or on) the shoulder
      // provides a reaction. Constraints are that "something."
      const hasAnyConstraint = activeConstraints && Object.values(activeConstraints).some(
          (list: BoneConstraint[]) => list.some(c => c.active)
      );
      if (!hasAnyConstraint) {
          return { demands: [], totalEffort: 0, limitingAction: null, rawTorques: {}, jointForces: {} };
      }

      const rawTorques: Record<string, Vector3> = {};

      // Joint center for torque calculations. For most bones, the proximal
      // endpoint (boneStartPoints) is the right point. For the spine,
      // flexion/extension/lateral-flexion/rotation happen continuously along
      // the vertebral column; the representative moment-arm point is the
      // middle of the column (between pelvis and ribcage), not the pelvis.
      const jointTorqueCenter = (bone: string): Vector3 | null => {
          if (bone === 'spine') {
              const s = kin.boneStartPoints['spine'];
              const e = kin.boneEndPoints['spine'];
              if (!s || !e) return null;
              return { x: (s.x + e.x) * 0.5, y: (s.y + e.y) * 0.5, z: (s.z + e.z) * 0.5 };
          }
          return kin.boneStartPoints[bone] ?? null;
      };

      // Accumulate torque at each joint from all forces, and net linear
      // force at each scapula (clavicle) since scapulae translate, not rotate.
      const scapulaForces: Record<string, Vector3> = {};

      // Net transmitted force at each bone's proximal joint — the sum of
      // every applied force vector (and, later, constraint reactions) on
      // the chain distal to and including this bone. Visualized as arrows
      // at the limb's proximal tip so the user can verify that each joint
      // is feeling the full load after all physics (constraints + chain
      // transmission). Scaled by f.magnitude because the user sees absolute
      // force magnitudes in the Kinetics tab and expects arrow length to
      // reflect them.
      const jointForces: Record<string, Vector3> = {};

      // Total applied force and its moment about the world origin. Used by
      // Phase B to impose whole-body equilibrium: Σ F_applied + Σ λ_i n_i = 0
      // and Σ r × F_applied + Σ r_pin × (λ_i n_i) = 0. Without those, the
      // solver silently lets an "invisible root mount" absorb any unbalanced
      // load, so e.g. an arm-side force never translates into leg-pin
      // reactions and the hip/torso muscles that would really hold the
      // pelvis read zero.
      let totalAppliedForce: Vector3 = { x: 0, y: 0, z: 0 };
      let totalAppliedMoment: Vector3 = { x: 0, y: 0, z: 0 };

      for (const f of currentForces) {
          const seg = kin.boneStartPoints[f.boneId];
          const end = kin.boneEndPoints[f.boneId];
          if (!seg || !end) continue;

          const attachPt = add(seg, mul(sub(end, seg), f.position));
          const forceDir = getForceDirectionWithKin(f, kin, currentTwists);
          const chain = getChainToRoot(f.boneId);

          // Effective magnitude: base magnitude × resistance profile at the
          // current ROM position. This is the "weight you feel" at this frame,
          // and it scales EVERYTHING: torque, scapula force, joint force.
          // Under the 1RM model, individual magnitudes are in arbitrary units
          // but RELATIVE magnitudes between forces matter when there are
          // multiple forces contributing to different joints.
          const baseMag = f.magnitude || 1;
          const profileMult = evaluateProfile(f.profile, currentT);
          const effectiveMag = baseMag * profileMult;
          const scaledForce = mul(forceDir, effectiveMag);

          totalAppliedForce = add(totalAppliedForce, scaledForce);
          totalAppliedMoment = add(totalAppliedMoment, crossProduct(attachPt, scaledForce));

          for (const bone of chain) {
              const prevJ = jointForces[bone] || { x: 0, y: 0, z: 0 };
              jointForces[bone] = add(prevJ, scaledForce);

              if (bone.includes('Clavicle')) {
                  // Scapula: accumulate linear force scaled by effective
                  // magnitude so multi-force relative weighting is correct.
                  const prev = scapulaForces[bone] || { x: 0, y: 0, z: 0 };
                  scapulaForces[bone] = add(prev, scaledForce);
              } else {
                  const jointCenter = jointTorqueCenter(bone);
                  if (!jointCenter) continue;
                  const momentArm = sub(attachPt, jointCenter);
                  const torque = crossProduct(momentArm, scaledForce);
                  const prev = rawTorques[bone] || { x: 0, y: 0, z: 0 };
                  rawTorques[bone] = add(prev, torque);
              }
          }
      }

      // Decompose into joint actions using the joint's LOCAL frame axes.
      // For joints with IR/ER (bone-axis action), subtract the bone-axis
      // component from the torque BEFORE projecting onto the other axes.
      // This prevents double-counting when the bone axis aligns with one
      // of the other action axes (e.g., at neutral, bone axis = Y axis,
      // so without subtraction both horiz abd/add and IR/ER would capture
      // the same torque component).
      const demands: JointActionDemand[] = [];
      for (const [bone, torqueVec] of Object.entries(rawTorques)) {
          const jointGroup = BONE_TO_JOINT_GROUP[bone];
          if (!jointGroup) continue;
          const actions = JOINT_ACTIONS[jointGroup];
          if (!actions) continue;

          const jointFrame = kin.jointFrames[bone];

          // Check if this joint has a bone-axis (IR/ER) action and compute
          // the residual torque after removing the bone-axis component.
          let boneAxis: Vector3 | null = null;
          const hasBoneAxisAction = actions.some(a => a.isBoneAxis);
          if (hasBoneAxisAction) {
              const bs = kin.boneStartPoints[bone], be = kin.boneEndPoints[bone];
              if (bs && be) boneAxis = normalize(sub(be, bs));
          }
          // Residual torque = torque minus bone-axis component (for non-bone-axis actions)
          const residualTorque = boneAxis
              ? sub(torqueVec, mul(boneAxis, dotProduct(torqueVec, boneAxis)))
              : torqueVec;

          for (const act of actions) {
              let axis: Vector3;
              if (act.isBoneAxis) {
                  if (!boneAxis) continue;
                  axis = boneAxis;
              } else if (act.useWorldAxis) {
                  // Skip jointFrame transform — axis is already in world space.
                  axis = normalize(act.axis);
              } else if (jointFrame) {
                  axis = normalize({
                      x: act.axis.x * jointFrame.x.x + act.axis.y * jointFrame.y.x + act.axis.z * jointFrame.z.x,
                      y: act.axis.x * jointFrame.x.y + act.axis.y * jointFrame.y.y + act.axis.z * jointFrame.z.y,
                      z: act.axis.x * jointFrame.x.z + act.axis.y * jointFrame.y.z + act.axis.z * jointFrame.z.z,
                  });
              } else {
                  axis = act.axis;
              }

              // IR/ER uses the full torque; other actions use the residual
              // (with bone-axis component removed to prevent double-counting)
              const torqueForProjection = act.isBoneAxis ? torqueVec : residualTorque;
              let component = dotProduct(torqueForProjection, axis);

              const isLeft = bone.startsWith('l');
              if (isLeft && (act.isBoneAxis || Math.abs(act.axis.y) > 0.5 || Math.abs(act.axis.z) > 0.5)) {
                  component = -component;
              }
              const action = component > 0 ? act.positiveAction : act.negativeAction;
              const torqueMag = Math.abs(component);
              if (torqueMag < 0.01) continue;

              // Joint-limit zeroing: if the joint is at its passive end-range
              // stop AND the torque is pushing further into that stop, the
              // passive anatomy (ligaments/capsule/bony contact) absorbs the
              // load and the muscle demand drops to zero. Skip this demand.
              //
              //   Hinges (elbow/knee/ankle): action-based limit on hinge angle.
              //   Twists (IR/ER):            action-based limit on twist angle.
              //   2-DOF ball-sockets:        dir-based limits + motion gradient.
              const dims = limitDimensionsForGroup(jointGroup);
              let blockedByLimit = false;
              if (/Forearm|Tibia|Foot/.test(bone)) {
                  const ad = dims.find(d => d.kind === 'action');
                  if (ad) {
                      const eff = getEffectiveLimit(ad.key, bone, currentPosture, currentTwists);
                      if (eff) {
                          const curAngle = getActionAngle(bone, act, currentPosture, currentTwists);
                          if (curAngle >= eff.max - 1 && component > 0) blockedByLimit = true;
                          if (curAngle <= eff.min + 1 && component < 0) blockedByLimit = true;
                      }
                  }
              } else if (act.isBoneAxis) {
                  const td = dims.find(d => d.kind === 'action' && d.action?.isBoneAxis);
                  if (td) {
                      const eff = getEffectiveLimit(td.key, bone, currentPosture, currentTwists);
                      if (eff) {
                          const curAngle = getActionAngle(bone, act, currentPosture, currentTwists);
                          if (curAngle >= eff.max - 1 && component > 0) blockedByLimit = true;
                          if (curAngle <= eff.min + 1 && component < 0) blockedByLimit = true;
                      }
                  }
              } else {
                  // 2-DOF: check each DIR limit. The motion of the bone tip
                  // under a positive rotation about `axis` is axis × boneDir.
                  // If the torque direction (sign of component) pushes further
                  // into a limited component, zero the demand.
                  const boneDir = currentPosture[bone];
                  if (boneDir) {
                      const motionRaw = crossProduct(axis, boneDir);
                      const sign = component > 0 ? 1 : -1;
                      for (const dim of dims) {
                          if (dim.kind !== 'dir' || !dim.component) continue;
                          const eff = getEffectiveLimit(dim.key, bone, currentPosture, currentTwists);
                          if (!eff) continue;
                          const val = getDimensionValue(dim, bone, currentPosture, currentTwists);
                          let motionC = motionRaw[dim.component] * sign;
                          if (dim.component === 'x' && bone.startsWith('l')) motionC = -motionC;
                          if (val >= eff.max - 0.02 && motionC > 0.01) { blockedByLimit = true; break; }
                          if (val <= eff.min + 0.02 && motionC < -0.01) { blockedByLimit = true; break; }
                      }
                  }
              }
              if (blockedByLimit) continue;

              // Look up capacity for effort calculation. Capacity is
              // position-dependent: evaluateCapacity interpolates between
              // base and specific using the current joint action angle.
              const cap = capacities[jointGroup]?.[actionKey(action)] ||
                          capacities[jointGroup]?.[action] ||
                          null;
              const actionAngle = getActionAngle(bone, act, currentPosture, currentTwists);
              const capValue = cap ? evaluateCapacity(cap, actionAngle) : 1;
              const effort = torqueMag / capValue;

              const side = bone.startsWith('l') ? 'Left' : bone.startsWith('r') ? 'Right' : '';
              demands.push({
                  boneId: bone,
                  jointGroup,
                  action: `${side} ${jointGroup} ${action}`.trim(),
                  torqueMagnitude: torqueMag,
                  effort,
              });
          }
      }


      // Scapula force decomposition: project net force onto scapula action axes
      for (const [bone, forceVec] of Object.entries(scapulaForces)) {
          const jointGroup = BONE_TO_JOINT_GROUP[bone];
          if (!jointGroup) continue;
          const actions = JOINT_ACTIONS[jointGroup];
          if (!actions) continue;

          for (const act of actions) {
              const axis = act.axis; // scapula axes are world-space (Y and Z)
              const component = dotProduct(forceVec, axis);
              // No left-side flip: protraction/retraction are anatomically
              // the same direction on both sides (+Z = both scapulas moving
              // forward = both protracting). The mirror step flips X, not
              // Z, so +Z on the right maps to +Z on the left, and both
              // should produce the same action label.
              const action = component > 0 ? act.positiveAction : act.negativeAction;
              const forceMag = Math.abs(component);
              if (forceMag < 0.01) continue;

              // Scapula joint limits: clavicle offset already lives in the
              // same coordinate space as the action axis, so the motion
              // gradient is just the axis itself (no cross product). If the
              // offset is at a dir.y or dir.z limit and the force pushes
              // further into it, zero the demand.
              {
                  const dims = limitDimensionsForGroup(jointGroup);
                  const sign = component > 0 ? 1 : -1;
                  let blockedByLimit = false;
                  for (const dim of dims) {
                      if (dim.kind !== 'dir' || !dim.component) continue;
                      const eff = getEffectiveLimit(dim.key, bone, currentPosture, currentTwists);
                      if (!eff) continue;
                      const val = getDimensionValue(dim, bone, currentPosture, currentTwists);
                      const motionC = axis[dim.component] * sign;
                      if (val >= eff.max - 0.5 && motionC > 0.01) { blockedByLimit = true; break; }
                      if (val <= eff.min + 0.5 && motionC < -0.01) { blockedByLimit = true; break; }
                  }
                  if (blockedByLimit) continue;
              }

              const cap = capacities[jointGroup]?.[action.toLowerCase().replace(/ /g, '')] ||
                          capacities[jointGroup]?.[action] || null;
              const scapAngle = getActionAngle(bone, act, currentPosture, currentTwists);
              const capValue = cap ? evaluateCapacity(cap, scapAngle) : 1;
              const effort = forceMag / capValue;

              const side = bone.startsWith('l') ? 'Left' : bone.startsWith('r') ? 'Right' : '';
              demands.push({
                  boneId: bone,
                  jointGroup,
                  action: `${side} ${jointGroup} ${action}`.trim(),
                  torqueMagnitude: forceMag,
                  effort,
              });
          }
      }

      // Sort by torque magnitude descending
      demands.sort((a, b) => b.torqueMagnitude - a.torqueMagnitude);

      // Filter near-zero (< 1% of max), but exempt scapula demands since
      // their linear force units aren't comparable to torque magnitudes.
      const maxMag = demands.length > 0 ? demands[0].torqueMagnitude : 0;
      const filtered = demands.filter(d =>
          d.jointGroup === 'Scapula' || d.torqueMagnitude > maxMag * 0.01
      );

      const totalMag = filtered.reduce((s, d) => s + d.torqueMagnitude, 0);
      const totalEffort = filtered.reduce((s, d) => s + d.effort, 0);
      const limitingAction = filtered.length > 0 ? filtered.reduce((max, d) => d.effort > max.effort ? d : max, filtered[0]) : null;


      // --- Unified constraint-reaction optimization ---
      //
      // Physics, stated plainly:
      //   • Applied forces create moments at every joint in their chain to
      //     the root (Phase A, already above — populates rawTorques).
      //   • Active constraints produce reaction forces. A constraint at
      //     point q with reaction direction n contributes a moment at
      //     joint J iff J is an ancestor of the constraint's bone
      //     (equivalently, the constraint bone is in J's distal sub-tree).
      //   • Each joint's muscle torque demand is the net moment at that
      //     joint. The system of reaction magnitudes (λ) is statically
      //     indeterminate when multiple constraints provide overlapping
      //     DOFs; the muscles distribute load by picking the λ that
      //     minimizes total neural effort Σ((τ0 + λ·sens)/cap)².
      //
      // This single pass subsumes the old Phase B (force-chain coupling)
      // and Phase C (support-reaction propagation). No branch-specific
      // code paths, no "is the force fully absorbed?" guards. Every
      // constraint, whether on the force's chain or on a distant support,
      // participates in the same optimization and the ancestor check
      // determines what it affects.
      if (activeConstraints) {
          const kin2 = calculateKinematics(currentPosture, currentTwists);

          type ConstraintRef = {
              n: Vector3;
              center: Vector3;
              tip: Vector3;
              constrainedBone: string;
              ancestors: Set<string>; // joints whose demand this reaction affects
          };
          const consRefs: ConstraintRef[] = [];

          // Build consRefs from EVERY active constraint. Each one's
          // ancestors set = the bone + all ancestors up to root. That
          // defines which joints feel its reaction.
          for (const [bid, list] of Object.entries(activeConstraints) as [string, BoneConstraint[]][]) {
              const activeList = list.filter(c => c.active);
              if (activeList.length === 0) continue;
              const ancestors = new Set<string>();
              {
                  let cur: string | undefined = bid;
                  while (cur) { ancestors.add(cur); cur = BONE_PARENTS[cur]; }
              }
              for (const c of activeList) {
                  const tipB = getConstraintPoint(bid, c, kin2);
                  if (!tipB) continue;
                  if (c.type === 'fixed') {
                      consRefs.push({ n: { x: 1, y: 0, z: 0 }, center: c.center, tip: tipB, constrainedBone: bid, ancestors });
                      consRefs.push({ n: { x: 0, y: 1, z: 0 }, center: c.center, tip: tipB, constrainedBone: bid, ancestors });
                      consRefs.push({ n: { x: 0, y: 0, z: 1 }, center: c.center, tip: tipB, constrainedBone: bid, ancestors });
                  } else if (c.type === 'planar') {
                      const n = normalize(c.normal);
                      if (magnitude(n) > 0.1) consRefs.push({ n, center: c.center, tip: tipB, constrainedBone: bid, ancestors });
                  } else if (c.type === 'arc' && c.pivot && c.axis && c.radius !== undefined) {
                      const axisN = normalize(c.axis);
                      if (magnitude(axisN) > 0.1) consRefs.push({ n: axisN, center: c.pivot, tip: tipB, constrainedBone: bid, ancestors });
                      const relTip = sub(tipB, c.pivot);
                      const axComp = dotProduct(relTip, axisN);
                      const radial = sub(relTip, mul(axisN, axComp));
                      const radMag = magnitude(radial);
                      if (radMag > 0.1) {
                          const radN = { x: radial.x / radMag, y: radial.y / radMag, z: radial.z / radMag };
                          consRefs.push({ n: radN, center: c.pivot, tip: tipB, constrainedBone: bid, ancestors });
                      }
                  }
              }
          }

          if (consRefs.length > 0) {
              type CouplingCol = {
                  boneId: string; jointGroup: JointGroup; act: ActionAxis;
                  tau0: number; cap: number; sens: number[];
                  isLeft: boolean;
              };
              const cols: CouplingCol[] = [];

              // Build a column for every (bone, action) pair across the whole
              // skeleton. tau0 comes from Phase A's rawTorques (already
              // globally accumulated from all forces). sens[i] = moment of
              // reaction i at this joint, zeroed when the constraint bone
              // is not in this joint's sub-tree.
              for (const bone of Object.keys(BONE_PARENTS)) {
                  const jg = BONE_TO_JOINT_GROUP[bone];
                  if (!jg) continue;
                  const acts = JOINT_ACTIONS[jg];
                  if (!acts) continue;

                  if (jg === 'Scapula') {
                      // Scapula: translation DOFs at the clavicle. The
                      // scapula's "demand" is the net linear force on it,
                      // projected onto each action axis. A constraint
                      // reaction contributes IFF the clavicle is an ancestor
                      // of the constraint's bone (reaction is transmitted
                      // up the chain through the clavicle).
                      const isLeft = bone.startsWith('l');
                      const forceVec = scapulaForces[bone] || { x: 0, y: 0, z: 0 };
                      for (const act of acts) {
                          const tau0 = dotProduct(forceVec, act.axis);
                          const actName = tau0 > 0 ? act.positiveAction : act.negativeAction;
                          const capLk = capacities[jg]?.[actionKey(actName)] || capacities[jg]?.[actName] || null;
                          const capVal = capLk ? evaluateCapacity(capLk, getActionAngle(bone, act, currentPosture, currentTwists)) : 1;
                          const sens: number[] = [];
                          for (const cref of consRefs) {
                              if (!cref.ancestors.has(bone)) { sens.push(0); continue; }
                              sens.push(dotProduct(cref.n, act.axis));
                          }
                          cols.push({ boneId: bone, jointGroup: jg, act, tau0, cap: capVal, sens, isLeft });
                      }
                      continue;
                  }

                  // Rotational joint.
                  const jf = kin2.jointFrames[bone];
                  const jc = bone === 'spine'
                      ? (() => {
                          const s = kin2.boneStartPoints['spine'];
                          const e = kin2.boneEndPoints['spine'];
                          return (s && e) ? { x: (s.x + e.x) * 0.5, y: (s.y + e.y) * 0.5, z: (s.z + e.z) * 0.5 } : null;
                      })()
                      : kin2.boneStartPoints[bone];
                  if (!jc || !jf) continue;
                  const isLeft = bone.startsWith('l');

                  // Bone axis for IR/ER residualisation (unchanged pattern).
                  let boneAx: Vector3 | null = null;
                  if (acts.some(a => a.isBoneAxis)) {
                      const bs = kin2.boneStartPoints[bone], be = kin2.boneEndPoints[bone];
                      if (bs && be) boneAx = normalize(sub(be, bs));
                  }
                  const rawTau = rawTorques[bone] || { x: 0, y: 0, z: 0 };
                  const residTau = boneAx ? sub(rawTau, mul(boneAx, dotProduct(rawTau, boneAx))) : rawTau;

                  for (const act of acts) {
                      let worldAxis: Vector3;
                      if (act.isBoneAxis) {
                          if (!boneAx) continue;
                          worldAxis = boneAx;
                      } else if (act.useWorldAxis) {
                          worldAxis = normalize(act.axis);
                      } else {
                          worldAxis = normalize({
                              x: act.axis.x*jf.x.x + act.axis.y*jf.y.x + act.axis.z*jf.z.x,
                              y: act.axis.x*jf.x.y + act.axis.y*jf.y.y + act.axis.z*jf.z.y,
                              z: act.axis.x*jf.x.z + act.axis.y*jf.y.z + act.axis.z*jf.z.z,
                          });
                      }

                      const tauSrc = act.isBoneAxis ? rawTau : residTau;
                      let tau0 = dotProduct(tauSrc, worldAxis);
                      if (isLeft && (act.isBoneAxis || Math.abs(act.axis.y) > 0.5 || Math.abs(act.axis.z) > 0.5)) tau0 = -tau0;

                      const actName = tau0 > 0 ? act.positiveAction : act.negativeAction;
                      const capLk = capacities[jg]?.[actionKey(actName)] || capacities[jg]?.[actName] || null;
                      const capVal = capLk ? evaluateCapacity(capLk, getActionAngle(bone, act, currentPosture, currentTwists)) : 1;

                      const sens: number[] = [];
                      for (const cref of consRefs) {
                          if (!cref.ancestors.has(bone)) { sens.push(0); continue; }
                          const rArm = sub(cref.tip, jc);
                          const rxn = crossProduct(rArm, cref.n);
                          let s = dotProduct(rxn, worldAxis);
                          if (!act.isBoneAxis && boneAx) {
                              const bAxDotAxis = dotProduct(boneAx, worldAxis);
                              const rxnDotBAx = dotProduct(rxn, boneAx);
                              s -= bAxDotAxis * rxnDotBAx;
                          }
                          if (isLeft && (act.isBoneAxis || Math.abs(act.axis.y) > 0.5 || Math.abs(act.axis.z) > 0.5)) s = -s;
                          sens.push(s);
                      }
                      cols.push({ boneId: bone, jointGroup: jg, act, tau0, cap: capVal, sens, isLeft });
                  }
              }

              if (cols.length > 0) {
                  const N = consRefs.length;

                  // Minimize Σ ((tau0 + λ·sens)/cap)² — muscle neural drive —
                  // subject to two classes of hard equality constraints:
                  //
                  //   (a) Whole-body equilibrium: Σ F + Σ λ n = 0 and
                  //       Σ r × F + Σ r_pin × λ n = 0. These plug the
                  //       "invisible root mount" hole. Without them, min-
                  //       effort picks λ = 0 whenever the force's subtree
                  //       is disjoint from the constraint subtree, silently
                  //       assigning the unbalanced load to an imaginary
                  //       pelvis fixity and leaving hip/spine muscles at
                  //       zero even though physically they must hold the
                  //       pelvis against the pinned legs. Making real pins
                  //       carry the load surfaces those reactions through
                  //       sens as correct hip/spine demand.
                  //
                  //   (b) Structural-absorption of locked hinge joints:
                  //       τ = 0 at any hinge col (elbow / knee / ankle)
                  //       whose single muscle-actuated axis is kinematically
                  //       killed by the constraint set — detected as the
                  //       sens column not lying in the span of the other
                  //       cols' sens. These joints have no torso-side
                  //       interpretation (both of their attached bones live
                  //       inside one limb subtree), so when the limb is
                  //       rigidized at both ends the bending moment is
                  //       absorbed structurally by the bone/ligament, not
                  //       by the muscle. Multi-axis pelvis-adjacent joints
                  //       (hip, shoulder, spine, scapula) are not subject
                  //       to this rule — their muscles are what hold the
                  //       root against the pinned limbs.
                  //
                  //   [AtWA     A_H      A_bal^T] [λ]   [AtWb  ]
                  //   [A_H^T    0        0      ] [μ] = [-b_H  ]
                  //   [A_bal    0        0      ] [ν]   [b_bal ]
                  const AtWA: number[][] = Array.from({length: N}, () => new Array(N).fill(0));
                  const AtWb: number[] = new Array(N).fill(0);
                  for (let i = 0; i < N; i++) {
                      for (let j = 0; j < N; j++) {
                          let s = 0;
                          for (const c of cols) s += c.sens[i] * c.sens[j] / (c.cap * c.cap);
                          AtWA[i][j] = s;
                      }
                      let r = 0;
                      for (const c of cols) r += c.sens[i] * c.tau0 / (c.cap * c.cap);
                      AtWb[i] = -r;
                  }
                  for (let i = 0; i < N; i++) AtWA[i][i] += 1e-8;

                  const balanceRows: number[][] = [];
                  const balanceRhs: number[] = [];
                  for (const axis of ['x', 'y', 'z'] as const) {
                      balanceRows.push(consRefs.map(c => c.n[axis]));
                      balanceRhs.push(-totalAppliedForce[axis]);
                  }
                  for (const axis of ['x', 'y', 'z'] as const) {
                      balanceRows.push(consRefs.map(c => crossProduct(c.tip, c.n)[axis]));
                      balanceRhs.push(-totalAppliedMoment[axis]);
                  }
                  const B = balanceRows.length;

                  // Hinge joints whose sens column is linearly independent
                  // of the others' are structurally-locked. Gram-Schmidt
                  // test: if the residual after projecting sens_k onto the
                  // span of {sens_j : j ≠ k} is ~0, DOF is live (some
                  // virtual δq ∈ null(J_c) has a nonzero k-th component).
                  // If the residual survives, k is frozen — and if the col
                  // is a hinge, muscle at k is zero by structural absorption.
                  const hingeGroups = new Set<JointGroup>(['Elbow', 'Knee', 'Ankle']);
                  const hingeFrozenIdx: number[] = [];
                  for (let k = 0; k < cols.length; k++) {
                      if (!hingeGroups.has(cols[k].jointGroup)) continue;
                      const v = cols[k].sens;
                      const m = v.length;
                      let vNormSq = 0;
                      for (let i = 0; i < m; i++) vNormSq += v[i] * v[i];
                      const vNorm = Math.sqrt(vNormSq);
                      if (vNorm < 1e-9) continue;
                      const ortho: number[][] = [];
                      for (let j = 0; j < cols.length; j++) {
                          if (j === k) continue;
                          const b = cols[j].sens;
                          const r = b.slice();
                          for (const q of ortho) {
                              let p = 0;
                              for (let i = 0; i < m; i++) p += r[i] * q[i];
                              for (let i = 0; i < m; i++) r[i] -= p * q[i];
                          }
                          let rn2 = 0;
                          for (let i = 0; i < m; i++) rn2 += r[i] * r[i];
                          const rn = Math.sqrt(rn2);
                          let bNormSq = 0;
                          for (let i = 0; i < m; i++) bNormSq += b[i] * b[i];
                          if (rn > 1e-9 * Math.max(1, Math.sqrt(bNormSq))) {
                              for (let i = 0; i < m; i++) r[i] /= rn;
                              ortho.push(r);
                          }
                      }
                      const residual = v.slice();
                      for (const q of ortho) {
                          let p = 0;
                          for (let i = 0; i < m; i++) p += residual[i] * q[i];
                          for (let i = 0; i < m; i++) residual[i] -= p * q[i];
                      }
                      let resSq = 0;
                      for (let i = 0; i < m; i++) resSq += residual[i] * residual[i];
                      if (Math.sqrt(resSq) > 1e-6 * vNorm) hingeFrozenIdx.push(k);
                  }
                  const H = hingeFrozenIdx.length;

                  const dim = N + H + B;
                  const M: number[][] = Array.from({length: dim}, () => new Array(dim).fill(0));
                  const RHS: number[] = new Array(dim).fill(0);
                  for (let i = 0; i < N; i++) {
                      for (let j = 0; j < N; j++) M[i][j] = AtWA[i][j];
                      RHS[i] = AtWb[i];
                  }
                  for (let k = 0; k < H; k++) {
                      const c = cols[hingeFrozenIdx[k]];
                      for (let i = 0; i < N; i++) {
                          M[i][N + k] = c.sens[i];
                          M[N + k][i] = c.sens[i];
                      }
                      RHS[N + k] = -c.tau0;
                  }
                  for (let b = 0; b < B; b++) {
                      for (let i = 0; i < N; i++) {
                          M[i][N + H + b] = balanceRows[b][i];
                          M[N + H + b][i] = balanceRows[b][i];
                      }
                      RHS[N + H + b] = balanceRhs[b];
                  }
                  const sol = solveSmall(M, RHS);
                  const lam = sol.slice(0, N);

                  // Propagate each reaction into jointForces for arrow viz.
                  for (let i = 0; i < N; i++) {
                      const cref = consRefs[i];
                      const Rmag = lam[i];
                      if (Math.abs(Rmag) < 1e-9) continue;
                      const Rvec = mul(cref.n, Rmag);
                      for (const bone of getChainToRoot(cref.constrainedBone)) {
                          const prevJ = jointForces[bone] || { x: 0, y: 0, z: 0 };
                          jointForces[bone] = add(prevJ, Rvec);
                      }
                  }

                  // Writeback for every col. Frozen cols naturally get
                  // newTau ≈ 0 from the KKT constraint; any Phase A entry
                  // there is overwritten with zero magnitude and dropped by
                  // the downstream `> phaseAMax * 0.01` filter.
                  for (const c of cols) {
                      let newTau = c.tau0;
                      for (let i = 0; i < N; i++) newTau += lam[i] * c.sens[i];
                      const newMag = Math.abs(newTau);

                      const side = c.isLeft ? 'Left' : c.boneId.startsWith('r') ? 'Right' : '';
                      const newAction = newTau >= 0 ? c.act.positiveAction : c.act.negativeAction;
                      const oldAction = c.tau0 >= 0 ? c.act.positiveAction : c.act.negativeAction;
                      const newFullName = `${side} ${c.jointGroup} ${newAction}`.trim();
                      const oldFullName = `${side} ${c.jointGroup} ${oldAction}`.trim();

                      const di = filtered.findIndex(d =>
                          d.boneId === c.boneId &&
                          (d.action === oldFullName || d.action === newFullName));

                      if (di >= 0) {
                          filtered[di].torqueMagnitude = newMag;
                          filtered[di].effort = newMag / c.cap;
                          filtered[di].action = newFullName;
                      } else if (newMag > 0.01) {
                          filtered.push({
                              boneId: c.boneId,
                              jointGroup: c.jointGroup,
                              action: newFullName,
                              torqueMagnitude: newMag,
                              effort: newMag / c.cap,
                          });
                      }
                  }
              }
          }
      }


      // --- Path-validity filter ---
      //
      // A joint only "sees" load when something in its distal sub-tree is
      // either pushing on it (applied force) or pulling on it (constraint
      // reaction). Equivalently: valid bones = ancestors of any force bone
      // ∪ ancestors of any constraint bone. Any joint outside this set
      // cannot possibly have nonzero demand regardless of λ.
      //
      // We deliberately do NOT try to filter bones "above an absorbing
      // constraint" via LCA logic — with disjoint kinematic sub-trees
      // (legs siblings of spine), that logic spuriously drops everything.
      // The KKT-constrained Phase B already zeros out demand at joints
      // whose virtual motion is absorbed, and the magnitude threshold
      // below removes the noise.
      const forceBones = new Set(currentForces.map(f => f.boneId));
      const constraintBones = new Set<string>();
      if (activeConstraints) {
          for (const [bid, list] of Object.entries(activeConstraints) as [string, BoneConstraint[]][]) {
              if (list.some(c => c.active)) constraintBones.add(bid);
          }
      }

      const ancestorCache = new Map<string, Set<string>>();
      const getAncestors = (b: string): Set<string> => {
          if (ancestorCache.has(b)) return ancestorCache.get(b)!;
          const s = new Set<string>();
          let cur: string | undefined = b;
          while (cur) { s.add(cur); cur = BONE_PARENTS[cur]; }
          ancestorCache.set(b, s);
          return s;
      };

      const validBones = new Set<string>();
      for (const fb of forceBones) for (const b of getAncestors(fb)) validBones.add(b);
      for (const cb of constraintBones) for (const b of getAncestors(cb)) validBones.add(b);

      // Final filter: path validity + near-zero noise removal.
      const phaseAMax = maxMag;
      const finalFiltered = filtered.filter(d => {
          if (!validBones.has(d.boneId)) return false;
          if (d.jointGroup === 'Scapula' && Math.abs(d.torqueMagnitude) > 0.01) return true;
          return d.torqueMagnitude > phaseAMax * 0.01;
      });

      // Recompute summary stats after all phases
      const finalTotalEffort = finalFiltered.reduce((s, d) => s + d.effort, 0);
      const finalLimiting = finalFiltered.length > 0 ? finalFiltered.reduce((max, d) => d.effort > max.effort ? d : max, finalFiltered[0]) : null;

      return { demands: finalFiltered, totalEffort: finalTotalEffort, limitingAction: finalLimiting, rawTorques, jointForces };
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

  // Kinematic parent tree. Used throughout the pipeline — Phase A force-chain
  // walks, constraint ancestor sets for the sens calc, path-validity LCA,
  // solver influence chains. This MUST match the actual kinematics so that
  // a virtual rotation of bone B moves exactly the world points that B's
  // rotation really moves. Specifically: legs parent off the fixed pelvis
  // (rootFrame) in calculateKinematics, NOT off the spine — spine rotation
  // moves ribcage/arms, never the femur. Encoding legs as spine's children
  // here gave the sens calc fictitious coupling between spine rotations and
  // leg-pin reactions, which in turn let spine cols span the knee's sens
  // direction and kept kinematically-locked knees classified live. Legs are
  // siblings of spine, both rooted at the pelvis.
  const BONE_PARENTS: Record<string, string | undefined> = {
    spine: undefined,
    lClavicle: 'spine',
    rClavicle: 'spine',
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

  const BONE_TO_JOINT_GROUP: Record<string, JointGroup> = {
    spine: 'Spine',
    lClavicle: 'Scapula', rClavicle: 'Scapula',
    lHumerus: 'Shoulder', rHumerus: 'Shoulder',
    lForearm: 'Elbow',   rForearm: 'Elbow',
    lFemur: 'Hip',       rFemur: 'Hip',
    lTibia: 'Knee',      rTibia: 'Knee',
    lFoot: 'Ankle',      rFoot: 'Ankle',
  };

  const JOINT_ACTIONS: Record<JointGroup, ActionAxis[]> = {
    'Scapula': [
        { positiveAction: 'Elevation', negativeAction: 'Depression', axis: {x:0,y:1,z:0} },
        { positiveAction: 'Protraction', negativeAction: 'Retraction', axis: {x:0,y:0,z:1} },
    ],
    'Shoulder': [
        { positiveAction: 'Flexion', negativeAction: 'Extension', axis: {x:1,y:0,z:0} },
        { positiveAction: 'Abduction', negativeAction: 'Adduction', axis: {x:0,y:0,z:1} },
        // Horizontal ab/ad is rotation about the WORLD vertical. Using the
        // local frame Y would alias to the bone axis (frame.y) and collide
        // with IR/ER, silently zeroing this action's demand via the residual
        // subtraction. World Y avoids that.
        { positiveAction: 'Horizontal Abduction', negativeAction: 'Horizontal Adduction', axis: {x:0,y:1,z:0}, useWorldAxis: true },
        { positiveAction: 'External Rotation', negativeAction: 'Internal Rotation', axis: {x:0,y:0,z:0}, isBoneAxis: true },
    ],
    'Elbow': [
        // positiveAction = Extension. dirToHingeAngle (atan2(z, y)) returns a
        // POSITIVE angle when the forearm rotates backward past straight
        // (toward hyperextension) and a NEGATIVE angle as it flexes forward
        // toward the shoulder. A +X torque (the action axis) similarly rotates
        // the forearm in the +Z direction = extension. Keeping positiveAction
        // in sync with that convention means the demand label ("Flexion" vs
        // "Extension") comes out right when we write:
        //     component > 0 ? positiveAction : negativeAction
        // The tradeoff is that the Joint Limits tab shows the stored range
        // as {min: -160, max: 0} (negative = flexion), which is slightly
        // counter-intuitive visually but physically consistent with everything
        // else in the pipeline.
        { positiveAction: 'Extension', negativeAction: 'Flexion', axis: {x:1,y:0,z:0} },
    ],
    'Spine': [
        { positiveAction: 'Flexion', negativeAction: 'Extension', axis: {x:1,y:0,z:0} },
        { positiveAction: 'Lateral Flexion L', negativeAction: 'Lateral Flexion R', axis: {x:0,y:0,z:1} },
        { positiveAction: 'Rotation L', negativeAction: 'Rotation R', axis: {x:0,y:1,z:0} },
    ],
    'Hip': [
        { positiveAction: 'Flexion', negativeAction: 'Extension', axis: {x:1,y:0,z:0} },
        { positiveAction: 'Abduction', negativeAction: 'Adduction', axis: {x:0,y:0,z:1} },
        // Same rationale as shoulder — world vertical avoids bone-axis collision.
        { positiveAction: 'Horizontal Abduction', negativeAction: 'Horizontal Adduction', axis: {x:0,y:1,z:0}, useWorldAxis: true },
        { positiveAction: 'External Rotation', negativeAction: 'Internal Rotation', axis: {x:0,y:0,z:0}, isBoneAxis: true },
    ],
    'Knee': [
        // Same convention as Elbow — positiveAction = Extension because
        // dirToHingeAngle is positive for backward rotation (hyperextension)
        // and negative for forward flexion. See the Elbow comment for the
        // full rationale.
        { positiveAction: 'Extension', negativeAction: 'Flexion', axis: {x:1,y:0,z:0} },
    ],
    'Ankle': [
        { positiveAction: 'Dorsi Flexion', negativeAction: 'Plantar Flexion', axis: {x:1,y:0,z:0} },
    ],
  };

  // Map each joint group to its representative bones for left and right
  // sides. Spine is excluded because it's fixed in the model.
  const GROUP_BONES: Record<JointGroup, { left: string; right: string } | null> = {
      'Scapula':  { left: 'lClavicle', right: 'rClavicle' },
      'Shoulder': { left: 'lHumerus',  right: 'rHumerus'  },
      'Elbow':    { left: 'lForearm',  right: 'rForearm'  },
      'Spine':    null,
      'Hip':      { left: 'lFemur',    right: 'rFemur'    },
      'Knee':     { left: 'lTibia',    right: 'rTibia'    },
      'Ankle':    { left: 'lFoot',     right: 'rFoot'     },
  };

  // Current live angle of a joint action, in degrees. Positive means the
  // joint is rotating in the positiveAction direction of the ActionAxis.
  //
  // Hinges (elbow/knee/ankle) use dirToHingeAngle directly — they have
  // exactly one DOF, so the action "angle" is unambiguous.
  //
  // isBoneAxis actions (IR/ER) come from the twist value.
  //
  // Ball-socket actions project the bone direction onto the plane
  // perpendicular to the action's axis, compute the signed angle from a
  // neutral direction in that plane, and return it. This is a simplified
  // metric — it doesn't follow clinical convention for coupled actions
  // like horizontal ab/ad at non-neutral abduction — but it's consistent
  // and reversible, which is what matters for limit comparisons.
  //
  // For left-side bones, the sign is flipped on the Z and Y axes so both
  // sides report the same positive direction (e.g. abduction always reads
  // positive regardless of side). X-axis rotations (flexion) are
  // bilaterally symmetric and don't need flipping.
  const getActionAngle = (
      boneId: string,
      action: ActionAxis,
      curPosture: Posture,
      curTwists: Record<string, number>
  ): number => {
      if (action.isBoneAxis) {
          const raw = curTwists[boneId] || 0;
          // Twists are stored raw for left, negated for right (see
          // handleRotationChange). Display positive = external rotation
          // for both sides by flipping right.
          return boneId.startsWith('l') ? raw : -raw;
      }
      if (/Forearm|Tibia|Foot/.test(boneId)) {
          const dir = curPosture[boneId];
          if (!dir) return 0;
          return dirToHingeAngle(boneId, dir) * 180 / Math.PI;
      }
      const dir = curPosture[boneId];
      if (!dir) return 0;
      const axisN = normalize(action.axis);
      const neutral = { x: 0, y: 1, z: 0 };
      // Project both into the plane perpendicular to the action axis.
      const dirPerp = sub(dir, mul(axisN, dotProduct(dir, axisN)));
      const neutralPerp = sub(neutral, mul(axisN, dotProduct(neutral, axisN)));
      if (magnitude(dirPerp) < 1e-6 || magnitude(neutralPerp) < 1e-6) return 0;
      const a = normalize(dirPerp);
      const b = normalize(neutralPerp);
      const cosA = clamp(dotProduct(a, b), -1, 1);
      const cross = crossProduct(b, a);
      const sign = Math.sign(dotProduct(cross, axisN)) || 1;
      let angleDeg = Math.acos(cosA) * sign * 180 / Math.PI;
      // Bilateral flip: for left-side bones, negate actions whose axis is
      // perpendicular to the sagittal plane (Z or Y components). X-axis
      // actions are symmetric across the body's midline.
      if (boneId.startsWith('l') && Math.abs(axisN.x) < 0.5) {
          angleDeg = -angleDeg;
      }
      return angleDeg;
  };

  // A limit dimension is a single scalar axis that a user can bound. It's
  // either an ACTION angle (hinge or twist, in degrees) or a DIRECTION
  // component (raw x/y/z of the bone's stored vector). Each joint group
  // advertises its own list of dimensions: ball-sockets expose dir.x/y/z
  // plus an IR/ER action; hinges expose their single action; scapula
  // exposes dir.y/z on the clavicle offset.
  interface LimitDimension {
      kind: 'action' | 'dir';
      key: string;                  // matches JointLimitsMap keys
      label: string;                // e.g. "Flexion / Extension", "DIR X (left / right)"
      action?: ActionAxis;          // defined when kind === 'action'
      component?: 'x' | 'y' | 'z';  // defined when kind === 'dir'
      displayMin: number;           // visualization track bounds
      displayMax: number;
      unit: '°' | '';
  }

  const limitDimensionsForGroup = (group: JointGroup): LimitDimension[] => {
      if (group === 'Shoulder' || group === 'Hip') {
          const twist = JOINT_ACTIONS[group].find(a => a.isBoneAxis);
          const dirs: LimitDimension[] = [
              { kind: 'dir', key: `${group}.dir.x`, label: 'DIR X  (lateral / medial)', component: 'x', displayMin: -1.1, displayMax: 1.1, unit: '' },
              { kind: 'dir', key: `${group}.dir.y`, label: 'DIR Y  (down / up)',        component: 'y', displayMin: -1.1, displayMax: 1.1, unit: '' },
              { kind: 'dir', key: `${group}.dir.z`, label: 'DIR Z  (back / forward)',   component: 'z', displayMin: -1.1, displayMax: 1.1, unit: '' },
          ];
          if (twist) {
              dirs.push({
                  kind: 'action',
                  key: `${group}.action.${twist.positiveAction}`,
                  label: `${twist.positiveAction} / ${twist.negativeAction}`,
                  action: twist,
                  displayMin: -120, displayMax: 120, unit: '°',
              });
          }
          return dirs;
      }
      if (group === 'Scapula') {
          return [
              { kind: 'dir', key: 'Scapula.dir.y', label: 'DIR Y  (elevation / depression)',  component: 'y', displayMin: -20, displayMax: 15, unit: '' },
              { kind: 'dir', key: 'Scapula.dir.z', label: 'DIR Z  (retraction / protraction)', component: 'z', displayMin: -20, displayMax: 15, unit: '' },
          ];
      }
      // Hinges (Elbow/Knee/Ankle) and Spine: action-based.
      return JOINT_ACTIONS[group].map(action => ({
          kind: 'action' as const,
          key: `${group}.action.${action.positiveAction}`,
          label: `${action.positiveAction} / ${action.negativeAction}`,
          action,
          displayMin: -200,
          displayMax: 200,
          unit: '°' as const,
      }));
  };

  // Live value of a dimension for a given bone, BILATERALLY NORMALIZED.
  // Left-side bones get their x component flipped on DIR X so both sides
  // share one limits table. Action dimensions already handle bilateral
  // sign via getActionAngle.
  const getDimensionValue = (
      dim: LimitDimension,
      boneId: string,
      curPosture: Posture,
      curTwists: Record<string, number>,
  ): number => {
      if (dim.kind === 'dir' && dim.component) {
          const v = curPosture[boneId];
          if (!v) return 0;
          let raw = v[dim.component];
          if (dim.component === 'x' && boneId.startsWith('l')) raw = -raw;
          return raw;
      }
      if (dim.kind === 'action' && dim.action) {
          return getActionAngle(boneId, dim.action, curPosture, curTwists);
      }
      return 0;
  };

  // Reverse the bilateral flip: given a normalized target value, return
  // what should actually be written to the stored posture component.
  const denormalizeDimValue = (
      dim: LimitDimension,
      boneId: string,
      normalized: number,
  ): number => {
      if (dim.kind === 'dir' && dim.component === 'x' && boneId.startsWith('l')) {
          return -normalized;
      }
      return normalized;
  };

  // Bone → joint group lookup. Runs once per call; cheap for our bone count.
  const getBoneJointGroup = (boneId: string): JointGroup | null => {
      for (const [group, sides] of Object.entries(GROUP_BONES) as [JointGroup, { left: string; right: string } | null][]) {
          if (sides && (sides.left === boneId || sides.right === boneId)) return group;
      }
      return null;
  };

  // Resolve effective limits for a dimension at a given bone, applying any
  // coupling relative to the live source value. Returns the hard-stop
  // min/max AFTER coupling has been applied — i.e. the values the physics
  // should enforce right now. softZone is passed through unchanged.
  const getEffectiveLimit = (
      dimKey: string,
      boneId: string,
      curPosture: Posture,
      curTwists: Record<string, number>,
  ): { min: number; max: number; softZone?: number } | null => {
      const limit = jointLimits[dimKey];
      if (!limit) return null;
      let effMin = limit.min;
      let effMax = limit.max;
      if (limit.coupling) {
          // Find the source dimension to compute the live source value.
          const entry = allLimitDimensions.find(d => d.dim.key === limit.coupling!.dependsOn);
          if (entry) {
              const srcBones = GROUP_BONES[entry.group];
              if (srcBones) {
                  // Use the same side's source bone when possible to keep
                  // coupling local to one side of the body.
                  const srcBone = boneId.startsWith('l') ? srcBones.left : srcBones.right;
                  const srcVal = getDimensionValue(entry.dim, srcBone, curPosture, curTwists);
                  effMin = limit.min + limit.coupling.slopeMin * srcVal;
                  effMax = limit.max + limit.coupling.slopeMax * srcVal;
              }
          }
      }
      return { min: effMin, max: effMax, softZone: limit.softZone };
  };

  // Clamp a normalized value against a dimension's effective limits for
  // a given bone. Used by drag handlers to refuse slider movement past
  // the hard stop. Returns the input unchanged if no limit is configured.
  const clampNormalizedToLimit = (
      dim: LimitDimension,
      boneId: string,
      normalizedValue: number,
      curPosture: Posture,
      curTwists: Record<string, number>,
  ): number => {
      const eff = getEffectiveLimit(dim.key, boneId, curPosture, curTwists);
      if (!eff) return normalizedValue;
      return clamp(normalizedValue, eff.min, eff.max);
  };

  // All dimensions across all groups — used by the coupling dropdown.
  const allLimitDimensions: Array<{ group: JointGroup; dim: LimitDimension }> = (
      Object.keys(JOINT_ACTIONS) as JointGroup[]
  ).flatMap(g => limitDimensionsForGroup(g).map(dim => ({ group: g, dim })));

  const updateLimit = (key: string, patch: Partial<JointLimit>) => {
      setJointLimits(prev => ({
          ...prev,
          [key]: { ...(prev[key] || { min: -1, max: 1 }), ...patch },
      }));
  };

  const getChainToRoot = (boneId: string): string[] => {
      const chain: string[] = [boneId];
      let current = boneId;
      while (BONE_PARENTS[current]) {
          current = BONE_PARENTS[current]!;
          chain.push(current);
      }
      return chain;
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
      // NOTE: no force/constraint resync here. A prior belt-and-suspenders
      // version called syncForcesFromSide + syncConstraintsFromSide on every
      // position update, which returned fresh array/map references every
      // tick and invalidated the torqueDistribution useMemo ~60x/sec during
      // drags. Forces and constraints are already kept in sync by their own
      // handlers -- position edits have no semantic reason to touch them.
  };

  const updateTwistState = (updater: (prev: Record<string, number>) => Record<string, number>) => {
      if (poseMode === 'start') { setStartTwists(updater); setTwists(updater); } 
      else { setEndTwists(updater); setTwists(updater); }
  };

  const skeletalData = useMemo(() => {
    return calculateKinematics(posture, twists);
  }, [posture, twists]);
  // torqueDistribution useMemo moved below postureViolatesConstraints so it
  // fires after all the helpers it transitively depends on (via block
  // detection's call to solveConstraintsAccommodating) are initialized.

  // Visual arcs showing the motion path for each joint action at the
  // selected bone. Each action is a rotation about an axis — the bone
  // endpoint traces a circle. We render these as arc constraints (BioMan
  // already supports arc rendering).
  const ACTION_AXIS_COLORS = ['rgba(239,68,68,0.5)', 'rgba(59,130,246,0.5)', 'rgba(34,197,94,0.5)', 'rgba(245,158,11,0.5)'];
  const jointActionArcs = useMemo<VisualPlane[]>(() => {
      if (!selectedBone) return [];
      const jointGroup = BONE_TO_JOINT_GROUP[selectedBone];
      if (!jointGroup) return [];
      const actions = JOINT_ACTIONS[jointGroup];
      if (!actions) return [];
      const kin = calculateKinematics(posture, twists);
      const jointFrame = kin.jointFrames[selectedBone];
      const jointCenter = kin.boneStartPoints[selectedBone];
      const boneEnd = kin.boneEndPoints[selectedBone];
      if (!jointFrame || !jointCenter || !boneEnd) return [];

      const boneLen = magnitude(sub(boneEnd, jointCenter));

      return actions.map((act, i) => {
          let axis: Vector3;
          if (act.isBoneAxis) {
              axis = normalize(sub(boneEnd, jointCenter));
          } else if (act.useWorldAxis) {
              axis = normalize(act.axis);
          } else {
              axis = normalize({
                  x: act.axis.x * jointFrame.x.x + act.axis.y * jointFrame.y.x + act.axis.z * jointFrame.z.x,
                  y: act.axis.x * jointFrame.x.y + act.axis.y * jointFrame.y.y + act.axis.z * jointFrame.z.y,
                  z: act.axis.x * jointFrame.x.z + act.axis.y * jointFrame.y.z + act.axis.z * jointFrame.z.z,
              });
          }
          return {
              id: `action-arc-${i}`,
              center: jointCenter,
              normal: axis,
              size: boneLen,
              color: ACTION_AXIS_COLORS[i % ACTION_AXIS_COLORS.length],
              boneId: selectedBone,
              type: 'arc' as const,
              pivot: jointCenter,
              axis: axis,
              radius: boneLen,
          };
      });
  }, [selectedBone, posture, twists]);

  // Scapula action indicators: straight lines for elevation/depression
  // and protraction/retraction (translations, not rotations).
  const scapulaActionIndicators = useMemo<VisualForce[]>(() => {
      if (!selectedBone || !selectedBone.includes('Clavicle')) return [];
      const kin = calculateKinematics(posture, twists);
      const pos = kin.boneEndPoints[selectedBone];
      if (!pos) return [];
      const LEN = 20;
      return [
          { id: 'scap-elev', boneId: selectedBone, position: 1, vector: { x: 0, y: -LEN, z: 0 }, color: '#ef4444' },
          { id: 'scap-depr', boneId: selectedBone, position: 1, vector: { x: 0, y: LEN, z: 0 }, color: '#ef4444' },
          { id: 'scap-prot', boneId: selectedBone, position: 1, vector: { x: 0, y: 0, z: -LEN }, color: '#3b82f6' },
          { id: 'scap-retr', boneId: selectedBone, position: 1, vector: { x: 0, y: 0, z: LEN }, color: '#3b82f6' },
      ];
  }, [selectedBone, posture, twists]);

  const resolveFullPosture = (p: Posture, t: Record<string, number>, source: string): { posture: Posture, twists: Record<string, number> } => {
      let nextP = p;
      let nextT = t;
      if (symmetryMode) {
          nextP = mirrorPosture(nextP, source);
          nextT = mirrorTwists(nextT, source);
      }
      return { posture: nextP, twists: nextT };
  };

  // ---------- Constraint accommodation solver (v2) ----------
  //
  // Goal: given a tentative posture in which some bones are locked to a user
  // input, find the smallest perturbation of the free bones that satisfies
  // every active constraint (every constrained bone tip lies on its plane).
  //
  // Strategy:
  //  1. Each free bone is a unit direction vector; we parameterise its
  //     perturbation in the 2-D tangent plane to the unit sphere at its
  //     current direction. This kills the wasted radial DOF that the previous
  //     solver had and avoids normalisation drift.
  //  2. Cost = sum of squared signed distances from each constrained tip to
  //     its plane.
  //  3. Numerical gradient via central differences in tangent coordinates.
  //  4. Step direction: -gradient. Step size: chosen by Armijo backtracking
  //     line search, which guarantees the cost STRICTLY decreases each
  //     iteration. If no acceptable step exists, we declare an impasse and
  //     return null.
  //  5. Because each accepted step is a small descent from the previous
  //     solved pose, the solver cannot leap to a far basin of attraction.
  //     This is what enforces "minimum local accommodation" and prevents
  //     the snapping behaviour we saw before.

  // (SOLVER_MIN_TOL and SOLVER_TOL_SCALE moved to module scope so
  // calculateTorqueDistribution — declared above this point but called
  // from a useMemo that runs before this line during render — can access
  // them without hitting the Temporal Dead Zone.)

  const collectActiveConstraints = (): { boneId: string; c: BoneConstraint }[] => {
      const out: { boneId: string; c: BoneConstraint }[] = [];
      (Object.entries(constraints) as [string, BoneConstraint[]][]).forEach(([bid, list]) => {
          for (const c of list) if (c.active) out.push({ boneId: bid, c });
      });
      return out;
  };

  const computeConstraintCost = (
      p: Posture,
      t: Record<string, number>,
      cons: { boneId: string; c: BoneConstraint }[]
  ): { cost: number; maxAbs: number } => {
      const kin = calculateKinematics(p, t);
      let cost = 0;
      let maxAbs = 0;
      for (const { boneId: bid, c } of cons) {
          // Use the bone point at c.position (0 = proximal, 1 = distal)
          // rather than the bone's distal endpoint. Without this, any
          // fixed/planar/arc constraint dragged off position=1 would have
          // its stored `center` compared against the wrong world point,
          // yielding a huge cost the solver can never zero — blocking the
          // user's drag. Classic symptom: "fixed constraint at bottom of
          // spine freezes all arm movement."
          const tip = getConstraintPoint(bid, c, kin);
          if (!tip) continue;
          if (c.type === 'fixed') {
              // Fixed point: cost = 3D distance² from tip to center.
              // Equivalent to 3 orthogonal planar constraints but expressed
              // as a single entry. The tip must stay exactly at center.
              const dx = tip.x - c.center.x;
              const dy = tip.y - c.center.y;
              const dz = tip.z - c.center.z;
              const dist2 = dx * dx + dy * dy + dz * dz;
              cost += dist2;
              const dist = Math.sqrt(dist2);
              if (dist > maxAbs) maxAbs = dist;
          } else if (c.type === 'arc' && c.pivot && c.axis && c.radius !== undefined) {
              const toTip = sub(tip, c.pivot);
              const axisN = normalize(c.axis);
              const axialDist = dotProduct(toTip, axisN);
              const inPlane = sub(toTip, mul(axisN, axialDist));
              const radialDist = magnitude(inPlane);
              const radialErr = radialDist - c.radius;
              cost += radialErr * radialErr + axialDist * axialDist;
              maxAbs = Math.max(maxAbs, Math.abs(radialErr), Math.abs(axialDist));
          } else {
              const N = normalize(c.normal);
              const sd = dotProduct(sub(tip, c.center), N);
              cost += sd * sd;
              if (Math.abs(sd) > maxAbs) maxAbs = Math.abs(sd);
          }
      }
      return { cost, maxAbs };
  };

  // Build an orthonormal tangent basis (e1, e2) at unit vector d.
  const tangentBasis = (d: Vector3): { e1: Vector3; e2: Vector3 } => {
      const ref: Vector3 = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const refDot = dotProduct(d, ref);
      const e1 = normalize({
          x: ref.x - refDot * d.x,
          y: ref.y - refDot * d.y,
          z: ref.z - refDot * d.z
      });
      // e2 = d × e1
      const e2 = normalize({
          x: d.y * e1.z - d.z * e1.y,
          y: d.z * e1.x - d.x * e1.z,
          z: d.x * e1.y - d.y * e1.x
      });
      return { e1, e2 };
  };

  // Apply small tangent-space coordinates (t1, t2) to direction d, then
  // renormalise back onto the unit sphere. For small (t1, t2), this is
  // equivalent to a rotation through angle sqrt(t1^2 + t2^2) in the plane
  // spanned by (e1, e2).
  const applyTangentDelta = (d: Vector3, e1: Vector3, e2: Vector3, t1: number, t2: number): Vector3 => {
      return normalize({
          x: d.x + t1 * e1.x + t2 * e2.x,
          y: d.y + t1 * e1.y + t2 * e2.y,
          z: d.z + t1 * e1.z + t2 * e2.z
      });
  };

  // Axis-locked direction: unit vector with one Cartesian component fixed at
  // `c` and the remaining two coordinates parameterised by a single angle θ
  // sweeping the circle of radius r = √(1−c²) in the perpendicular plane.
  const axisLockedDir = (axis: 'x' | 'y' | 'z', c: number, theta: number): Vector3 => {
      const r = Math.sqrt(Math.max(0, 1 - c * c));
      const co = Math.cos(theta);
      const si = Math.sin(theta);
      if (axis === 'x') return { x: c, y: r * co, z: r * si };
      if (axis === 'y') return { x: r * co, y: c, z: r * si };
      return { x: r * co, y: r * si, z: c };
  };

  // Recover θ on the axis-locked circle from a current direction by reading
  // the two free Cartesian components. Used so the solver starts each
  // micro-step at the bone's current angular position rather than snapping.
  const initialThetaForAxis = (axis: 'x' | 'y' | 'z', d: Vector3): number => {
      if (axis === 'x') return Math.atan2(d.z, d.y);
      if (axis === 'y') return Math.atan2(d.z, d.x);
      return Math.atan2(d.y, d.x);
  };

  type AxisLock = { boneId: string; axis: 'x' | 'y' | 'z'; value: number };

  // Hinge bones (forearm/tibia/foot) live on a 1-DOF arc in the parent's local
  // y-z plane — anatomically the elbow/knee/ankle bend in a single plane fixed
  // by the parent bone, so x in parent-local frame is always 0. We parameterise
  // by a single angle θ:
  //   forearm/tibia: dir = (0, cos θ, sin θ)   — θ=0 is straight along parent
  //   foot:          dir = (0, sin θ, -cos θ)  — θ=0 is pointing back (-z)
  // The solver MUST treat hinge bones this way; if they were 2-DOF, gradient
  // descent could push them off the hinge plane and the slider's flexion angle
  // (acos(y) / asin(y)) would no longer match the actual geometry.
  // (hinge helpers hoisted to module scope so calculateTorqueDistribution,
  // which is defined before this point, can use them without TDZ issues.)

  const solveConstraintsAccommodating = (
      tentative: Posture,
      lockedBoneIds: Set<string>,
      t: Record<string, number>,
      axisLocks: AxisLock[] = [],
      lockedTwistIds: Set<string> = new Set()
  ): { posture: Posture; twists: Record<string, number> } | null => {
      const cons = collectActiveConstraints();
      if (cons.length === 0) return { posture: tentative, twists: t };

      // Per-bone tolerance, take the loosest as global early-exit threshold.
      let globalTol = SOLVER_MIN_TOL;
      for (const { boneId: bid } of cons) {
          const L = BONE_LENGTHS[bid] || 0;
          globalTol = Math.max(globalTol, Math.max(SOLVER_MIN_TOL, L * SOLVER_TOL_SCALE));
      }

      let posture: Posture = { ...tentative };

      // Defensive snap: every hinge bone (whether locked or free) MUST live on
      // its 1-DOF arc. If a previous solver run or state restore left it with
      // a nonzero parent-local x, project it back onto the hinge plane now so
      // the rest of the solver and the renderer agree about its angle.
      for (const bid of Object.keys(posture)) {
          if (!isHingeBone(bid)) continue;
          const d = posture[bid];
          if (!d) continue;
          posture[bid] = hingeAngleToDir(bid, dirToHingeAngle(bid, d));
      }

      // Axis-lock setup: for each axis-locked bone, snap its direction onto
      // the locked circle (preserving its current angular position) before
      // any optimization runs. Axis-locked bones live in a separate state
      // alongside the 2-DOF free bones.
      type AxisState = { axis: 'x' | 'y' | 'z'; value: number; theta: number };
      const axisLockMap: Record<string, AxisState> = {};
      for (const lock of axisLocks) {
          if (Math.abs(lock.value) > 1) return null; // unreachable
          const cur = posture[lock.boneId];
          if (!cur) continue;
          const theta = initialThetaForAxis(lock.axis, cur);
          posture[lock.boneId] = axisLockedDir(lock.axis, lock.value, theta);
          axisLockMap[lock.boneId] = { axis: lock.axis, value: lock.value, theta };
      }

      // Working copy of twists — the solver can modify these for twist DOFs.
      let solvedTwists: Record<string, number> = { ...t };

      let { cost, maxAbs } = computeConstraintCost(posture, solvedTwists, cons);
      if (maxAbs <= globalTol) return { posture, twists: solvedTwists };

      // Free bones: only bones that are on the kinematic chain of at least
      // one constrained bone. A foot constraint should only let the solver
      // move leg + spine bones, not arms on a sibling branch. Without this
      // restriction, the solver would move the humerus to satisfy a foot
      // constraint, which fights the user's arm input.
      // Collect input bones: bones being actively moved by the user via
      // lockedBoneIds (direction-locked), lockedTwistIds (twist-locked),
      // or axisLocks (axis-constrained).
      const inputBones = new Set<string>(lockedBoneIds);
      for (const lt of lockedTwistIds) inputBones.add(lt);
      for (const al of axisLocks) inputBones.add(al.boneId);

      // Filter constraints: a constraint is relevant if it lives anywhere
      // on the ARM/LEG CHAIN of the input bone — both descendants (directly
      // affected by input) and ancestors (bones the solver might move to
      // accommodate, and which therefore must still respect their own
      // constraints). A foot constraint is irrelevant to a humerus drag
      // because they're on different branches; but a humerus constraint
      // IS relevant to a forearm drag because the solver might rotate
      // the humerus to satisfy the forearm's constraint.
      //
      // Build the "influence chain" for each input bone: all descendants
      // (bones whose position is directly affected by input) AND all
      // ancestors (bones the solver might move). A constraint is relevant
      // if its bone appears in any input bone's influence chain.
      const influenceChain = new Set<string>();
      // Add input bones themselves
      for (const ib of inputBones) influenceChain.add(ib);
      // Add ancestors of input bones (solver-movable to satisfy descendant constraints)
      for (const ib of inputBones) {
          let cur: string | undefined = BONE_PARENTS[ib];
          while (cur) { influenceChain.add(cur); cur = BONE_PARENTS[cur]; }
      }
      // Add descendants of input bones (bones whose world position changes with input)
      // by walking all bones and checking if any input bone is in their ancestor chain.
      for (const b of Object.keys(BONE_PARENTS)) {
          let cur: string | undefined = b;
          while (cur) {
              if (inputBones.has(cur)) { influenceChain.add(b); break; }
              cur = BONE_PARENTS[cur];
          }
      }

      const relevantCons = inputBones.size === 0
          ? cons  // no explicit input bones (e.g., playback): all constraints enforced
          : cons.filter(({ boneId: cBid }) => influenceChain.has(cBid));

      // If no constraints are relevant to the user's input branch, skip
      // the solver entirely — the input can't violate any constraint.
      if (relevantCons.length === 0) return { posture, twists: solvedTwists };

      // Recompute cost with only relevant constraints.
      ({ cost, maxAbs } = computeConstraintCost(posture, solvedTwists, relevantCons));
      if (maxAbs <= globalTol) return { posture, twists: solvedTwists };

      // Rebuild chain bones from relevant constraints only — used to restrict
      // which bones the solver can move when the user is actively editing.
      // During playback (empty inputBones), ALL bones are allowed to move
      // because the solver needs maximum flexibility to accommodate the
      // interpolated pose against all active constraints.
      const relevantChainBones = new Set<string>();
      for (const { boneId: cBid } of relevantCons) {
          let cur: string | undefined = cBid;
          while (cur) { relevantChainBones.add(cur); cur = BONE_PARENTS[cur]; }
      }

      const isUnitDirBone = (b: string) => /Humerus|Forearm|Femur|Tibia|Foot/.test(b);
      // No input bones → treat all unit-dir bones as free (playback needs this).
      // With input bones → restrict to bones on relevant constraint chains.
      const isRelevantFree = (b: string) => inputBones.size === 0 ? true : relevantChainBones.has(b);
      const freeBones2D = Object.keys(posture).filter(
          b => isUnitDirBone(b)
            && !isHingeBone(b)
            && !lockedBoneIds.has(b)
            && !(b in axisLockMap)
            && posture[b] !== undefined
            && isRelevantFree(b)
      );
      const freeBones1D = Object.keys(axisLockMap).filter(b => isUnitDirBone(b) && isRelevantFree(b));
      const freeBonesHinge = Object.keys(posture).filter(
          b => isHingeBone(b)
            && !lockedBoneIds.has(b)
            && posture[b] !== undefined
            && isRelevantFree(b)
      );
      // Initial theta for each free hinge bone (read once; updated as steps accept).
      const hingeThetaMap: Record<string, number> = {};
      for (const bid of freeBonesHinge) hingeThetaMap[bid] = dirToHingeAngle(bid, posture[bid]);

      // Resolve hinge joint limits once per solver call and store in radians.
      // The Armijo line search clamps candidate angles to this range so the
      // solver cannot indirectly drive a knee into hyperextension (or an
      // elbow past full flex) while trying to satisfy a BoneConstraint. We
      // resolve against the STARTING posture/twists — that's good enough for
      // hinges since none of the default hinge limits use coupling.
      const hingeLimitsRad: Record<string, { min: number; max: number }> = {};
      for (const bid of freeBonesHinge) {
          const group = getBoneJointGroup(bid);
          if (!group) continue;
          const dims = limitDimensionsForGroup(group);
          const actDim = dims.find(d => d.kind === 'action');
          if (!actDim) continue;
          const eff = getEffectiveLimit(actDim.key, bid, posture, solvedTwists);
          if (!eff) continue;
          hingeLimitsRad[bid] = {
              min: eff.min * Math.PI / 180,
              max: eff.max * Math.PI / 180,
          };
      }

      // Twist DOFs: humerus/femur bones whose twist can be adjusted by the
      // solver. Each gets a single scalar DOF (the twist angle in degrees).
      const isTwistBone = (b: string) => /Humerus|Femur/.test(b);
      const freeBonesTwist = Object.keys(posture).filter(
          b => isTwistBone(b) && !lockedBoneIds.has(b) && !lockedTwistIds.has(b) && posture[b] !== undefined
      );
      const twistMap: Record<string, number> = {};
      for (const bid of freeBonesTwist) twistMap[bid] = solvedTwists[bid] || 0;

      if (freeBones2D.length === 0 && freeBones1D.length === 0 && freeBonesHinge.length === 0 && freeBonesTwist.length === 0) return null;

      const MAX_ITERS = 150;
      const EPS = 0.0015;          // tangent-coord finite-difference step
      const EPS_THETA = 0.0015;    // axis-locked angular finite-difference
      const ARMIJO_C1 = 0.1;       // sufficient-descent constant
      const ARMIJO_BACKTRACK = 0.5;
      const MAX_LINESEARCH = 24;

      for (let iter = 0; iter < MAX_ITERS; iter++) {
          // Refresh tangent basis at every iteration — it depends on the
          // current direction, which changed last step.
          const tangents: Record<string, { e1: Vector3; e2: Vector3 }> = {};
          for (const bid of freeBones2D) tangents[bid] = tangentBasis(posture[bid]);

          // Central-difference gradient: 2-DOF bones get a (g1, g2) tangent
          // gradient; 1-DOF axis-locked bones AND 1-DOF hinge bones get a
          // single dθ gradient.
          const grads2D: Record<string, [number, number]> = {};
          const grads1D: Record<string, number> = {};
          const gradsHinge: Record<string, number> = {};
          const gradsTwist: Record<string, number> = {};
          let gradSqNorm = 0;

          for (const bid of freeBones2D) {
              const { e1, e2 } = tangents[bid];
              const orig = posture[bid];

              const p1Plus  = { ...posture, [bid]: applyTangentDelta(orig, e1, e2,  EPS, 0) };
              const p1Minus = { ...posture, [bid]: applyTangentDelta(orig, e1, e2, -EPS, 0) };
              const p2Plus  = { ...posture, [bid]: applyTangentDelta(orig, e1, e2, 0,  EPS) };
              const p2Minus = { ...posture, [bid]: applyTangentDelta(orig, e1, e2, 0, -EPS) };

              const g1 = (computeConstraintCost(p1Plus,  solvedTwists, relevantCons).cost
                        - computeConstraintCost(p1Minus, solvedTwists, relevantCons).cost) / (2 * EPS);
              const g2 = (computeConstraintCost(p2Plus,  solvedTwists, relevantCons).cost
                        - computeConstraintCost(p2Minus, solvedTwists, relevantCons).cost) / (2 * EPS);

              grads2D[bid] = [g1, g2];
              gradSqNorm += g1 * g1 + g2 * g2;
          }

          for (const bid of freeBones1D) {
              const st = axisLockMap[bid];
              const dPlus  = axisLockedDir(st.axis, st.value, st.theta + EPS_THETA);
              const dMinus = axisLockedDir(st.axis, st.value, st.theta - EPS_THETA);
              const pPlus  = { ...posture, [bid]: dPlus };
              const pMinus = { ...posture, [bid]: dMinus };
              const g = (computeConstraintCost(pPlus,  solvedTwists, relevantCons).cost
                       - computeConstraintCost(pMinus, solvedTwists, relevantCons).cost) / (2 * EPS_THETA);
              grads1D[bid] = g;
              gradSqNorm += g * g;
          }

          for (const bid of freeBonesHinge) {
              const theta = hingeThetaMap[bid];
              const dPlus  = hingeAngleToDir(bid, theta + EPS_THETA);
              const dMinus = hingeAngleToDir(bid, theta - EPS_THETA);
              const pPlus  = { ...posture, [bid]: dPlus };
              const pMinus = { ...posture, [bid]: dMinus };
              const g = (computeConstraintCost(pPlus,  solvedTwists, relevantCons).cost
                       - computeConstraintCost(pMinus, solvedTwists, relevantCons).cost) / (2 * EPS_THETA);
              gradsHinge[bid] = g;
              gradSqNorm += g * g;
          }

          // Twist gradient: use same angular perturbation as other DOFs (in
          // radians) so gradients are on consistent scales. Convert to degrees
          // for the actual twist value since twists are stored in degrees.
          const EPS_TWIST_DEG = EPS_THETA * 180 / Math.PI;
          for (const bid of freeBonesTwist) {
              const tw = twistMap[bid]; // degrees
              const tPlus  = { ...solvedTwists, [bid]: tw + EPS_TWIST_DEG };
              const tMinus = { ...solvedTwists, [bid]: tw - EPS_TWIST_DEG };
              const g = (computeConstraintCost(posture, tPlus,  relevantCons).cost
                       - computeConstraintCost(posture, tMinus, relevantCons).cost) / (2 * EPS_THETA);
              gradsTwist[bid] = g; // cost/radian, same scale as other gradients
              gradSqNorm += g * g;
          }

          if (gradSqNorm < 1e-10) {
              // Stationary point — either solved (handled above) or stuck.
              break;
          }

          // Armijo backtracking line search. Initial alpha is chosen so the
          // first trial moves each free bone by ~0.05 rad worth of tangent
          // step at most; backtracking halves until the sufficient-descent
          // condition holds.
          const gradNorm = Math.sqrt(gradSqNorm);
          let alpha = 0.05 / gradNorm;
          let accepted = false;

          for (let trial = 0; trial < MAX_LINESEARCH; trial++) {
              const candidate: Posture = { ...posture };
              const trialThetas: Record<string, number> = {};
              const trialHingeThetas: Record<string, number> = {};
              const trialTwists: Record<string, number> = {};
              for (const bid of freeBones2D) {
                  const { e1, e2 } = tangents[bid];
                  const [g1, g2] = grads2D[bid];
                  candidate[bid] = applyTangentDelta(
                      posture[bid], e1, e2,
                      -alpha * g1, -alpha * g2
                  );
              }
              for (const bid of freeBones1D) {
                  const st = axisLockMap[bid];
                  const newTheta = st.theta - alpha * grads1D[bid];
                  candidate[bid] = axisLockedDir(st.axis, st.value, newTheta);
                  trialThetas[bid] = newTheta;
              }
              for (const bid of freeBonesHinge) {
                  let newTheta = hingeThetaMap[bid] - alpha * gradsHinge[bid];
                  // Clamp to joint angle limits (same treatment twist already gets).
                  const hl = hingeLimitsRad[bid];
                  if (hl) newTheta = Math.max(hl.min, Math.min(hl.max, newTheta));
                  candidate[bid] = hingeAngleToDir(bid, newTheta);
                  trialHingeThetas[bid] = newTheta;
              }
              const candidateTwists = { ...solvedTwists };
              for (const bid of freeBonesTwist) {
                  // alpha * gradient is in radians; convert to degrees for storage
                  const stepDeg = (alpha * gradsTwist[bid]) * 180 / Math.PI;
                  let newTw = twistMap[bid] - stepDeg;
                  // Clamp to rotation limits so twist never exceeds slider range
                  const lim = ROTATION_LIMITS[bid];
                  if (lim) newTw = Math.max(lim.min, Math.min(lim.max, newTw));
                  candidateTwists[bid] = newTw;
                  trialTwists[bid] = newTw;
              }
              const candCost = computeConstraintCost(candidate, candidateTwists, relevantCons);
              // Sufficient-descent condition: cost decreases by at least
              // c1 * alpha * ||grad||^2.
              if (candCost.cost <= cost - ARMIJO_C1 * alpha * gradSqNorm) {
                  posture = candidate;
                  solvedTwists = candidateTwists;
                  cost = candCost.cost;
                  maxAbs = candCost.maxAbs;
                  // Commit accepted values back so the next iteration uses them.
                  for (const bid of freeBones1D) {
                      axisLockMap[bid].theta = trialThetas[bid];
                  }
                  for (const bid of freeBonesHinge) {
                      hingeThetaMap[bid] = trialHingeThetas[bid];
                  }
                  for (const bid of freeBonesTwist) {
                      twistMap[bid] = trialTwists[bid];
                  }
                  accepted = true;
                  break;
              }
              alpha *= ARMIJO_BACKTRACK;
              if (alpha < 1e-9) break;
          }

          if (!accepted) {
              // No descent step satisfies Armijo — impasse.
              return null;
          }
          if (maxAbs <= globalTol) return { posture, twists: solvedTwists };
      }

      return maxAbs <= globalTol ? { posture, twists: solvedTwists } : null;
  };

  // Standalone posture-level constraint check: returns true if any active
  // constraint on any bone would be violated by the given posture+twists.
  const postureViolatesConstraints = (p: Posture, t: Record<string, number>): boolean => {
      const allCons: { boneId: string; c: BoneConstraint }[] = [];
      (Object.entries(constraints) as [string, BoneConstraint[]][]).forEach(([bid, list]) => {
          for (const c of list) if (c.active) allCons.push({ boneId: bid, c });
      });
      if (allCons.length === 0) return false;
      const kin = calculateKinematics(p, t);
      for (const { boneId: bid, c } of allCons) {
          // Respect c.position so constraints at non-default positions are
          // checked at their actual application point, not the bone tip.
          const tip = getConstraintPoint(bid, c, kin);
          if (!tip) continue;
          const L = BONE_LENGTHS[bid] || 0;
          const TOL = Math.max(SOLVER_MIN_TOL, L * SOLVER_TOL_SCALE);
          if (c.type === 'fixed') {
              const dist = magnitude(sub(tip, c.center));
              if (dist > TOL) return true;
          } else if (c.type === 'arc' && c.pivot && c.axis && c.radius !== undefined) {
              const toTip = sub(tip, c.pivot);
              const axisN = normalize(c.axis);
              const axialDist = dotProduct(toTip, axisN);
              const inPlane = sub(toTip, mul(axisN, axialDist));
              const radialErr = magnitude(inPlane) - c.radius;
              if (Math.abs(radialErr) > TOL || Math.abs(axialDist) > TOL) return true;
          } else {
              const N = normalize(c.normal);
              if (Math.abs(dotProduct(sub(tip, c.center), N)) > TOL) return true;
          }
      }
      return false;
  };

  // Torque distribution useMemo — must live below solveConstraintsAccommodating
  // and postureViolatesConstraints because calculateTorqueDistribution's block
  // detector invokes solveConstraintsAccommodating, which transitively depends
  // on constants declared further down in the component body.
  // Always-on when forces exist: the joint force arrow visualization needs
  // the jointForces field regardless of which tab is active. The torque
  // demand UI is still shown only on the 'torque' tab (via conditional
  // rendering below), but the computation itself runs whenever the user
  // has any forces configured. Tab-gate was removed for this reason.
  const torqueDistribution = useMemo<TorqueDistributionResult | null>(() => {
      if (forces.length === 0) return null;
      return calculateTorqueDistribution(posture, twists, forces, jointCapacities, constraints, currentRomT);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posture, twists, forces, jointCapacities, constraints, jointLimits, currentRomT]);

  // --- JOINT FORCE ARROWS ---
  //
  // Subtle arrows on the proximal tip of each limb segment showing the net
  // force that segment transmits through its joint. Derived from
  // torqueDistribution.jointForces, which is the sum of (a) every applied
  // force propagated up the chain from its bone of application, and (b)
  // every Phase B constraint reaction λ·n propagated from the constrained
  // bone to the root. This is the true "limb proximal load" after all
  // physics, so a visible backward arrow at the scapula should appear the
  // moment a constraint genuinely redirects force in that direction.
  //
  // Arrow length is proportional to force magnitude normalized across all
  // visible arrows (so the scene stays readable whether forces are 1 N or
  // 10,000 N). Arrows shorter than MIN_VIS_LEN are skipped so noise at
  // near-root bones (which see tiny forces after the chain cancels out)
  // doesn't clutter the view.
  const jointForceArrows = useMemo<VisualForce[]>(() => {
      if (!torqueDistribution) return [];
      const jf = torqueDistribution.jointForces;
      if (!jf) return [];

      // Find the max magnitude to normalize arrow scale. Skip tiny ones.
      const entries = Object.entries(jf) as [string, Vector3][];
      let maxMag = 0;
      for (const [, v] of entries) {
          const m = Math.hypot(v.x, v.y, v.z);
          if (m > maxMag) maxMag = m;
      }
      if (maxMag < 1e-6) return [];

      const MAX_VIS_LEN = 22;   // pixels-ish; matches the scale of existing arrows
      const MIN_VIS_LEN = 2;    // drop anything under this for clarity
      const arrows: VisualForce[] = [];
      for (const [boneId, v] of entries) {
          const m = Math.hypot(v.x, v.y, v.z);
          if (m < 1e-6) continue;
          const visLen = (m / maxMag) * MAX_VIS_LEN;
          if (visLen < MIN_VIS_LEN) continue;
          const scale = visLen / m;
          arrows.push({
              id: `jforce-${boneId}`,
              boneId,
              // Proximal tip of the limb segment = bone start.
              position: 0,
              vector: { x: v.x * scale, y: v.y * scale, z: v.z * scale },
              // Muted gray so it doesn't overwhelm the user's configured forces.
              color: '#6b7280',
          });
      }
      return arrows;
  }, [torqueDistribution]);

  // --- TIMELINE PEAK ANALYSIS ---
  //
  // Samples the start -> end animation at fixed t steps, runs each frame
  // through the same constraint-accommodating solver the playback loop uses,
  // then computes the torque distribution at every frame. Aggregates the
  // PEAK demand per joint action across the entire timeline, along with the
  // t% at which the peak occurred. Peak (not average) is the right metric
  // for identifying the limiting/hardest point in the ROM -- that's what 1RM
  // is gated by and what calibration needs to verify.
  //
  // Computed lazily: only runs when the user is on the 'timeline' tab, so
  // switching to other tabs doesn't eat 25 solver calls per dependency tick.
  interface TimelinePeak {
      boneId: string;
      jointGroup: JointGroup;
      action: string;
      peakTorque: number;
      peakEffort: number;
      peakFramePct: number; // 0-100, the t% where the peak occurred
  }
  // One sample of the resistance and difficulty profiles. t ∈ [0, 1] along
  // the start → end timeline. resistance = total torque demand summed
  // across all joint actions (how much mechanical work the muscles must
  // produce). difficulty = max effort across all actions at this frame,
  // where effort = torque / capacity (what fraction of the limiting
  // action's capacity is in use — this is what gates 1RM).
  interface TimelineProfilePoint {
      t: number;
      resistance: number;
      difficulty: number;
  }
  // Per-action effort time-series across the ROM. Each entry in `efforts`
  // corresponds to the matching `profile[i].t` frame. Actions that don't
  // appear at a given frame get 0.
  interface ActionTimeSeries {
      boneId: string;
      jointGroup: JointGroup;
      action: string;
      efforts: number[];
      torques: number[];   // raw torque magnitude per frame (for computing proportions)
  }
  interface TimelineAnalysisResult {
      peaks: TimelinePeak[];
      limitingPeak: TimelinePeak | null;
      framesAnalyzed: number;
      framesSkipped: number; // solver failures
      profile: TimelineProfilePoint[];
      actionSeries: ActionTimeSeries[];
  }

  const timelineAnalysis = useMemo<TimelineAnalysisResult | null>(() => {
      if (activeTab !== 'timeline') return null;
      if (forces.length === 0) return null;

      const FRAMES: number = 25;
      const EMPTY_LOCK = new Set<string>();
      const peakMap = new Map<string, TimelinePeak>();
      const profile: TimelineProfilePoint[] = [];
      // Per-action time series: key = "${boneId}::${action}", value = effort
      // at each successfully-analyzed frame. Frame index maps to profile[].
      const seriesMap = new Map<string, { boneId: string; jointGroup: JointGroup; action: string; efforts: number[]; torques: number[] }>();
      let framesAnalyzed = 0;
      let framesSkipped = 0;

      for (let i = 0; i < FRAMES; i++) {
          const t = FRAMES === 1 ? 0 : i / (FRAMES - 1);

          // Build interpolated frame (same interpolation the playback uses).
          const framePosture: Posture = {};
          Object.keys(startPosture).forEach(boneId => {
              const startV = startPosture[boneId];
              const endV = endPosture[boneId] || startV;
              if (boneId.includes('Clavicle')) {
                  framePosture[boneId] = interpolateVector(startV, endV, t);
              } else {
                  framePosture[boneId] = slerpDirection(startV, endV, t);
              }
          });
          const frameTwists: Record<string, number> = {};
          const allTwistKeys = new Set([...Object.keys(startTwists), ...Object.keys(endTwists)]);
          allTwistKeys.forEach(boneId => {
              const startT = startTwists[boneId] || 0;
              const endT = endTwists[boneId] || 0;
              frameTwists[boneId] = interpolateScalar(startT, endT, t);
          });

          // Project onto constraint manifold. If the solver fails (common
          // with tight fixed constraints where interpolation drifts the
          // constrained tip off target), fall back to the raw interpolated
          // pose so the frame still contributes analysis. Physics is slightly
          // approximate for those frames but Timeline Peaks stays populated.
          const solved = solveConstraintsAccommodating(framePosture, EMPTY_LOCK, frameTwists);
          const framePose = solved ? solved.posture : framePosture;
          const frameTw = solved ? solved.twists : frameTwists;
          if (solved) framesAnalyzed++;
          else framesSkipped++;

          const dist = calculateTorqueDistribution(
              framePose, frameTw, forces, jointCapacities, constraints, t
          );

          // Per-frame profile: sum of torques (resistance, mechanical work)
          // and max effort (difficulty, how close the limiting action is to
          // failure). Resistance sums Phase A + Phase B demand torques as
          // the system currently sees them — which is what determines the
          // required muscle output regardless of how strong those muscles are.
          let frameResistance = 0;
          let frameDifficulty = 0;
          for (const d of dist.demands) {
              frameResistance += d.torqueMagnitude;
              if (d.effort > frameDifficulty) frameDifficulty = d.effort;
          }
          profile.push({ t, resistance: frameResistance, difficulty: frameDifficulty });

          // Build a set of actions present at this frame so we can push 0
          // for actions that appeared in earlier frames but not this one.
          const frameActions = new Set<string>();

          for (const d of dist.demands) {
              const key = `${d.boneId}::${d.action}`;
              frameActions.add(key);

              // Peak tracking (unchanged).
              const prev = peakMap.get(key);
              if (!prev || d.torqueMagnitude > prev.peakTorque) {
                  peakMap.set(key, {
                      boneId: d.boneId,
                      jointGroup: d.jointGroup,
                      action: d.action,
                      peakTorque: d.torqueMagnitude,
                      peakEffort: d.effort,
                      peakFramePct: t * 100,
                  });
              }

              // Time-series tracking: append this frame's effort.
              let series = seriesMap.get(key);
              if (!series) {
                  // First time seeing this action — backfill 0s for all
                  // previously processed frames where it didn't appear.
                  // Use profile.length which counts ALL processed frames
                  // (both analyzed and fallback) including THIS frame — so
                  // subtract 1 to get the pre-push count.
                  const backfill = new Array(Math.max(0, profile.length - 1)).fill(0);
                  series = { boneId: d.boneId, jointGroup: d.jointGroup, action: d.action, efforts: backfill, torques: [...backfill] };
                  seriesMap.set(key, series);
              }
              series.efforts.push(d.effort);
              series.torques.push(d.torqueMagnitude);
          }

          // Push 0 for any series that existed but had no demand this frame.
          for (const [key, series] of seriesMap) {
              if (!frameActions.has(key)) {
                  series.efforts.push(0);
                  series.torques.push(0);
              }
          }
      }

      const peaks = Array.from(peakMap.values());
      let limitingPeak: TimelinePeak | null = null;
      for (const p of peaks) {
          if (!limitingPeak || p.peakEffort > limitingPeak.peakEffort) limitingPeak = p;
      }

      // --- 1RM GLOBAL NORMALIZATION ---
      //
      // The system treats force magnitudes as an arbitrary unit — the user
      // only defines relative magnitudes between forces, not absolute Newtons.
      // To make the numbers meaningful we choose a single global scale factor
      // such that the highest effort anywhere across the ROM equals exactly
      // 1.0 (the 1RM sticking point). Everything else then reads as a
      // fraction of that limiting effort:
      //   100% = the one action at the one frame that gates the lift
      //   40%  = this action is at 40% of the limiting action's capacity usage
      //
      // Shape is invariant under this scaling (it multiplies every value by
      // the same constant), but the absolute numbers become comparable and
      // semantically meaningful. All displayed efforts, peak bars, difficulty
      // profile values, and resistance profile values share this scale.
      const globalMaxEffort = limitingPeak ? limitingPeak.peakEffort : 0;
      const actionSeries = Array.from(seriesMap.values());
      if (globalMaxEffort > 1e-9) {
          const scale = 1 / globalMaxEffort;
          for (const p of peaks) {
              p.peakEffort *= scale;
              p.peakTorque *= scale;
          }
          for (const pt of profile) {
              pt.difficulty *= scale;
              pt.resistance *= scale;
          }
          // Scale every entry in every action time series by the same factor.
          for (const s of actionSeries) {
              for (let i = 0; i < s.efforts.length; i++) {
                  s.efforts[i] *= scale;
              }
          }
      }

      return { peaks, limitingPeak, framesAnalyzed, framesSkipped, profile, actionSeries };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startPosture, endPosture, startTwists, endTwists, forces, constraints, jointCapacities, jointLimits]);

  const resolveKinematics = (boneId: string, proposedVector: Vector3, currentPosture: Posture, currentTwists: Record<string, number>): { posture: Posture, twists: Record<string, number> } => {
      const projected = projectDirOntoConstraints(boneId, proposedVector, currentPosture, currentTwists);
      return resolveFullPosture({ ...currentPosture, [boneId]: projected }, currentTwists, boneId);
  };

  const resolveRotation = (boneId: string, proposedTwist: number, currentPosture: Posture, currentTwists: Record<string, number>): { posture: Posture, twists: Record<string, number> } => {
      const proposedTwists = { ...currentTwists, [boneId]: proposedTwist };
      // Twist changes can move downstream tips through constraint planes; if
      // the proposed twist would put any constrained bone tip off its plane,
      // hard-stop the rotation.
      const tentative = resolveFullPosture(currentPosture, proposedTwists, boneId);
      if (postureViolatesConstraints(tentative.posture, tentative.twists)) {
          return resolveFullPosture(currentPosture, currentTwists, boneId);
      }
      return tentative;
  };

  const handleScapulaChange = (axis: 'elevation' | 'protraction', val: number) => {
      if (!selectedBone || isNaN(val)) return;
      if (isPlaying) setIsPlaying(false);

      const current = posture[selectedBone];
      if (!current) return;

      // Target offset: the user controls one component (y for elevation,
      // z for protraction) while the other stays at its current value.
      const component = axis === 'elevation' ? 'y' : 'z';
      const startVal = axis === 'elevation' ? -current.y : -current.z;
      const totalDelta = val - startVal;
      if (Math.abs(totalDelta) < 0.01) return;

      // Clamp against scapula DIR limits.
      let clampedVal = val;
      const scapGroup = getBoneJointGroup(selectedBone);
      if (scapGroup) {
          const dims = limitDimensionsForGroup(scapGroup);
          const dirDim = dims.find(d => d.kind === 'dir' && d.component === component);
          if (dirDim) {
              const eff = getEffectiveLimit(dirDim.key, selectedBone, posture, twists);
              // Scapula offset is stored negated: display val = -stored.
              // Limits are on the stored value (getDimensionValue reads stored).
              // Convert: stored = -val. Clamp stored against eff, convert back.
              if (eff) {
                  const storedTarget = -val;
                  const storedClamped = clamp(storedTarget, eff.min, eff.max);
                  clampedVal = -storedClamped;
              }
          }
      }
      const clampedDelta = clampedVal - startVal;
      if (Math.abs(clampedDelta) < 0.01) return;

      // Lock the scapula (and its mirror partner in symmetry mode) so
      // the solver moves downstream bones (humerus, forearm) to satisfy
      // constraints rather than fighting the user's input.
      const lockedSet = new Set<string>([selectedBone]);
      const oppBone = symmetryMode ? getOppositeBone(selectedBone) : null;
      if (oppBone) lockedSet.add(oppBone);

      // Adaptive step-halving loop (same pattern as handleHingeChange).
      const NOMINAL_STEPS = Math.max(4, Math.min(20, Math.ceil(Math.abs(clampedDelta) / 0.5)));
      const NOMINAL_STEP = 1 / NOMINAL_STEPS;
      const MIN_STEP = NOMINAL_STEP / 64;

      let workingPosture: Posture = { ...posture };
      let workingTwists: Record<string, number> = { ...twists };
      let lastAcceptedPosture: Posture = workingPosture;
      let lastAcceptedTwists: Record<string, number> = workingTwists;

      let progress = 0;
      let step = NOMINAL_STEP;
      while (progress < 1 - 1e-9) {
          const nextProgress = Math.min(1, progress + step);
          const stepVal = startVal + clampedDelta * nextProgress;

          // Build tentative posture with the scapula offset at the
          // interpolated value.
          const cur = workingPosture[selectedBone];
          let newVec = { ...cur };
          if (axis === 'elevation') newVec.y = -stepVal;
          else newVec.z = -stepVal;

          let tentative: Posture = { ...workingPosture, [selectedBone]: newVec };
          if (symmetryMode) tentative = mirrorPosture(tentative, selectedBone);

          const solved = solveConstraintsAccommodating(tentative, lockedSet, workingTwists);
          if (solved !== null) {
              workingPosture = solved.posture;
              workingTwists = solved.twists;
              lastAcceptedPosture = solved.posture;
              lastAcceptedTwists = solved.twists;
              progress = nextProgress;
              step = Math.min(NOMINAL_STEP, step * 1.5);
          } else {
              step = step / 2;
              if (step < MIN_STEP) break;
          }
      }

      updatePostureState(lastAcceptedPosture, lastAcceptedTwists);
  };

  const handleHingeChange = (val: number) => {
      if (!selectedBone || isNaN(val)) return;
      if (isPlaying) setIsPlaying(false);

      const rawStart = posture[selectedBone];
      if (!rawStart) return;

      // Defensive: project current direction onto the hinge plane (x=0 in
      // parent-local) before reading the start angle. If a previous solver
      // run left this bone with a nonzero x, the angle reading and the
      // local-frame rotation would both be wrong.
      const startVec = hingeAngleToDir(selectedBone, dirToHingeAngle(selectedBone, rawStart));

      // Clamp the requested angle to the effective joint limit before any
      // work. For hinges (elbow/knee/ankle), the hinge angle matches the
      // single action-based limit dimension.
      let clampedVal = val;
      const hingeGroup = getBoneJointGroup(selectedBone);
      if (hingeGroup) {
          const dims = limitDimensionsForGroup(hingeGroup);
          const actionDim = dims.find(d => d.kind === 'action');
          if (actionDim) {
              const eff = getEffectiveLimit(actionDim.key, selectedBone, posture, twists);
              if (eff) clampedVal = clamp(val, eff.min, eff.max);
          }
      }

      const startAngle = dirToHingeAngle(selectedBone, startVec) * 180 / Math.PI;
      const totalDelta = clampedVal - startAngle;
      if (Math.abs(totalDelta) < 0.01) return;

      // Lock set: only the moved hinge bone's parent-local direction is fixed
      // by the input. (Mirror partner is also locked when symmetry is on so
      // the solver doesn't fight the mirroring step.)
      const lockedSet = new Set<string>([selectedBone]);
      if (symmetryMode) {
          const opp = getOppositeBone(selectedBone);
          if (opp) lockedSet.add(opp);
      }

      // Adaptive step-halving loop. We advance "progress" from 0 to 1 along
      // the hinge angle delta. Each iteration tries a nominal step; on
      // solver success we advance and optionally grow the next step; on
      // failure we halve the step and try again, down to a minimum. This
      // prevents hard-stop mid-drag when the straight-line path through
      // hinge space dips near infeasibility at intermediate points --
      // smaller steps keep the warm-started solver in its basin of
      // attraction.
      const NOMINAL_STEPS = Math.max(4, Math.min(30, Math.ceil(Math.abs(totalDelta))));
      const NOMINAL_STEP = 1 / NOMINAL_STEPS;
      const MIN_STEP = NOMINAL_STEP / 64; // give up after 6 halvings

      let workingPosture: Posture = { ...posture };
      let workingTwists: Record<string, number> = { ...twists };
      let lastAcceptedPosture: Posture = workingPosture;
      let lastAcceptedTwists: Record<string, number> = workingTwists;

      let progress = 0;
      let step = NOMINAL_STEP;
      while (progress < 1 - 1e-9) {
          const nextProgress = Math.min(1, progress + step);
          const stepAngle = startAngle + totalDelta * nextProgress;
          const stepDir = hingeAngleToDir(selectedBone, stepAngle * Math.PI / 180);

          let tentative: Posture = { ...workingPosture, [selectedBone]: stepDir };
          if (symmetryMode) tentative = mirrorPosture(tentative, selectedBone);

          const solved = solveConstraintsAccommodating(tentative, lockedSet, workingTwists);
          if (solved !== null) {
              workingPosture = solved.posture;
              workingTwists = solved.twists;
              lastAcceptedPosture = solved.posture;
              lastAcceptedTwists = solved.twists;
              progress = nextProgress;
              step = Math.min(NOMINAL_STEP, step * 1.5); // re-grow after success
          } else {
              step = step / 2;
              if (step < MIN_STEP) break;
          }
      }

      updatePostureState(lastAcceptedPosture, lastAcceptedTwists);
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
        const rootBone = targetReferenceBone;
        const childBone = selectedBone;
        const len1 = BONE_LENGTHS[rootBone];
        const len2 = BONE_LENGTHS[childBone];

        const startTarget: Vector3 = { ...targetPos };
        const endTarget: Vector3 = { ...targetPos, [axis]: internalVal };
        const delta = sub(endTarget, startTarget);
        const dist = magnitude(delta);
        if (dist < 0.01) return;

        setTargetPos(endTarget);

        // Incremental IK + accommodation solver with adaptive halving.
        // On solver failure we halve the sub-step and retry, keeping the
        // warm-started solver inside its basin of attraction so the drag
        // doesn't hard-stop partway through.
        const NOMINAL_STEPS = Math.max(4, Math.min(40, Math.ceil(dist / 2)));
        const NOMINAL_STEP = 1 / NOMINAL_STEPS;
        const MIN_STEP = NOMINAL_STEP / 64;
        const rootFrame0 = createRootFrame({ x: 0, y: 1, z: 0 });

        const lockedSet = new Set<string>([rootBone, childBone]);
        if (symmetryMode) {
            const oppRoot = getOppositeBone(rootBone);
            const oppChild = getOppositeBone(childBone);
            if (oppRoot) lockedSet.add(oppRoot);
            if (oppChild) lockedSet.add(oppChild);
        }

        let workingPosture: Posture = { ...posture };
        let workingTwists: Record<string, number> = { ...twists };
        let lastAcceptedPosture: Posture = workingPosture;
        let lastAcceptedTwists: Record<string, number> = workingTwists;

        let progress = 0;
        let step = NOMINAL_STEP;
        while (progress < 1 - 1e-9) {
            const nextProgress = Math.min(1, progress + step);
            const stepTarget: Vector3 = {
                x: startTarget.x + delta.x * nextProgress,
                y: startTarget.y + delta.y * nextProgress,
                z: startTarget.z + delta.z * nextProgress,
            };
            const currentPole = mul(workingPosture[rootBone], len1);
            const solution = solveTwoBoneIK({ x: 0, y: 0, z: 0 }, stepTarget, len1, len2, currentPole);
            if (!solution) {
                step = step / 2;
                if (step < MIN_STEP) break;
                continue;
            }
            const transported = transportFrame(rootFrame0, solution.vec1);
            const childVecLocal = worldToLocal(transported, solution.vec2);
            let tentative: Posture = { ...workingPosture, [rootBone]: solution.vec1, [childBone]: childVecLocal };
            if (symmetryMode) tentative = mirrorPosture(tentative, rootBone);
            const solved = solveConstraintsAccommodating(tentative, lockedSet, workingTwists);
            if (solved !== null) {
                workingPosture = solved.posture;
                workingTwists = solved.twists;
                lastAcceptedPosture = solved.posture;
                lastAcceptedTwists = solved.twists;
                progress = nextProgress;
                step = Math.min(NOMINAL_STEP, step * 1.5);
            } else {
                step = step / 2;
                if (step < MIN_STEP) break;
            }
        }

        updatePostureState(lastAcceptedPosture, lastAcceptedTwists);
        return;
    }

    // Shoulder / hip dot input via constraint-accommodating solver. The dot
    // itself stays free in 3D (we only write the user's chosen axis to
    // targetPos — other axes are NOT rewritten by the solver, so the dot
    // keeps the user's intended position). The moved bone's direction has
    // ONE Cartesian component locked (mapped from the dot via bone length,
    // clamped to ±1 if the dot is pulled past the reachable sphere); the
    // remaining DOF on its locked circle, plus all other free bones, are
    // available to satisfy active constraints.
    const newTarget = { ...targetPos, [axis]: internalVal };
    setTargetPos(newTarget);

    const boneLen = BONE_LENGTHS[selectedBone] || 100;
    const startDir = posture[selectedBone];
    if (!startDir) return;

    const startComp = startDir[axis];
    let targetComp = Math.max(-1, Math.min(1, internalVal / boneLen));

    // Clamp against the DIR limit for this bone's joint group. Limits are
    // stored in right-normalized form — for left-side bones we flip X
    // before clamping, then flip back.
    const dirGroup = getBoneJointGroup(selectedBone);
    if (dirGroup) {
        const dims = limitDimensionsForGroup(dirGroup);
        const dirDim = dims.find(d => d.kind === 'dir' && d.component === axis);
        if (dirDim) {
            const eff = getEffectiveLimit(dirDim.key, selectedBone, posture, twists);
            if (eff) {
                const flipped = axis === 'x' && selectedBone.startsWith('l') ? -targetComp : targetComp;
                const clamped = clamp(flipped, eff.min, eff.max);
                targetComp = axis === 'x' && selectedBone.startsWith('l') ? -clamped : clamped;
            }
        }
    }
    const totalDelta = targetComp - startComp;
    if (Math.abs(totalDelta) < 1e-4) return;

    // In symmetry mode, the opposite bone gets its own axisLock (on the
    // MIRRORED value, i.e. -stepComp for the X axis, same for Y/Z) so both
    // bones have 1-DOF freedom on their locked circles and the solver can
    // find a symmetric solution. lockedBoneIds stays empty — the axisLock
    // handles the constraint.
    const lockedSet = new Set<string>();

    // Adaptive step-halving loop. Nominal step is ~2.3° in the locked
    // Cartesian component; halves on solver failure down to a minimum.
    const NOMINAL_STEPS = Math.max(4, Math.min(40, Math.ceil(Math.abs(totalDelta) / 0.04)));
    const NOMINAL_STEP = 1 / NOMINAL_STEPS;
    const MIN_STEP = NOMINAL_STEP / 64;

    let workingPosture: Posture = { ...posture };
    let workingTwists: Record<string, number> = { ...twists };
    let lastAcceptedPosture: Posture = workingPosture;
    let lastAcceptedTwists: Record<string, number> = workingTwists;

    const oppBone = symmetryMode ? getOppositeBone(selectedBone) : null;

    let progress = 0;
    let step = NOMINAL_STEP;
    while (progress < 1 - 1e-9) {
        const nextProgress = Math.min(1, progress + step);
        const stepComp = startComp + totalDelta * nextProgress;

        const cur = workingPosture[selectedBone];
        const theta = initialThetaForAxis(axis, cur);
        const stepDir = axisLockedDir(axis, stepComp, theta);
        let tentative: Posture = { ...workingPosture, [selectedBone]: stepDir };
        if (symmetryMode) tentative = mirrorPosture(tentative, selectedBone);

        const axisLocks: AxisLock[] = [{ boneId: selectedBone, axis, value: stepComp }];
        if (oppBone) {
            const mirroredVal = axis === 'x' ? -stepComp : stepComp;
            axisLocks.push({ boneId: oppBone, axis, value: mirroredVal });
        }

        const solved = solveConstraintsAccommodating(
            tentative, lockedSet, workingTwists, axisLocks
        );
        if (solved !== null) {
            workingPosture = solved.posture;
            workingTwists = solved.twists;
            lastAcceptedPosture = solved.posture;
            lastAcceptedTwists = solved.twists;
            progress = nextProgress;
            step = Math.min(NOMINAL_STEP, step * 1.5);
        } else {
            step = step / 2;
            if (step < MIN_STEP) break;
        }
    }

    const finalDir = lastAcceptedPosture[selectedBone];
    if (finalDir) {
        setTargetPos({
            x: finalDir.x * boneLen,
            y: finalDir.y * boneLen,
            z: finalDir.z * boneLen
        });
    }
    updatePostureState(lastAcceptedPosture, lastAcceptedTwists);
  };

  const handleRotationChange = (val: number) => {
    if (!selectedBone || isNaN(val)) return;
    if (isPlaying) setIsPlaying(false);

    // Clamp against the External Rotation action limit for this bone's
    // joint group. Falls back to the static ROTATION_LIMITS table if the
    // bone doesn't belong to a configured joint group. Slider value is in
    // display convention (positive = external rotation for both sides).
    let clampedVal = val;
    const rotGroup = getBoneJointGroup(selectedBone);
    if (rotGroup) {
        const dims = limitDimensionsForGroup(rotGroup);
        const twistDim = dims.find(d => d.kind === 'action' && d.action?.isBoneAxis);
        if (twistDim) {
            const eff = getEffectiveLimit(twistDim.key, selectedBone, posture, twists);
            if (eff) clampedVal = clamp(val, eff.min, eff.max);
        }
    } else {
        const rlim = ROTATION_LIMITS[selectedBone];
        if (rlim) clampedVal = clamp(val, rlim.min, rlim.max);
    }

    // Negate so that increasing slider = external rotation for both arms.
    const storeVal = selectedBone.startsWith('l') ? clampedVal : -clampedVal;

    const startTwist = twists[selectedBone] || 0;
    const totalDelta = storeVal - startTwist;
    if (Math.abs(totalDelta) < 0.01) return;

    // Both the user's bone's DIRECTION and the mirror partner's DIRECTION
    // stay free so the solver can accommodate the twist. lockedBoneIds
    // stays empty. What we lock are the TWISTS: both the user's selected
    // bone and its mirror partner (with negated value). The mirror
    // partner's pose gets synchronized via mirrorPosture inside the loop.
    const lockedSet = new Set<string>();
    const lockedTwistSet = new Set<string>([selectedBone]);
    const oppBone = symmetryMode ? getOppositeBone(selectedBone) : null;
    if (oppBone) lockedTwistSet.add(oppBone);

    // Adaptive step-halving loop (nominal ~1° per step).
    const NOMINAL_STEPS = Math.max(4, Math.min(30, Math.ceil(Math.abs(totalDelta))));
    const NOMINAL_STEP = 1 / NOMINAL_STEPS;
    const MIN_STEP = NOMINAL_STEP / 64;

    let workingPosture: Posture = { ...posture };
    let workingTwists: Record<string, number> = { ...twists };
    let lastAcceptedPosture: Posture = workingPosture;
    let lastAcceptedTwists: Record<string, number> = workingTwists;

    let progress = 0;
    let step = NOMINAL_STEP;
    while (progress < 1 - 1e-9) {
        const nextProgress = Math.min(1, progress + step);
        const stepTwist = startTwist + totalDelta * nextProgress;
        let tentativeTwists = { ...workingTwists, [selectedBone]: stepTwist };
        if (oppBone) tentativeTwists[oppBone] = -stepTwist;

        let tentativePosture: Posture = { ...workingPosture };
        if (symmetryMode) tentativePosture = mirrorPosture(tentativePosture, selectedBone);

        const solved = solveConstraintsAccommodating(
            tentativePosture, lockedSet, tentativeTwists, [], lockedTwistSet
        );
        if (solved !== null) {
            workingPosture = solved.posture;
            workingTwists = solved.twists;
            // Preserve the user's intended twist value.
            workingTwists[selectedBone] = stepTwist;
            if (oppBone) workingTwists[oppBone] = -stepTwist;
            lastAcceptedPosture = workingPosture;
            lastAcceptedTwists = { ...workingTwists };
            progress = nextProgress;
            step = Math.min(NOMINAL_STEP, step * 1.5);
        } else {
            step = step / 2;
            if (step < MIN_STEP) break;
        }
    }

    updatePostureState(lastAcceptedPosture, lastAcceptedTwists);
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
    const raw = twists[selectedBone] ?? 0;
    // Right-side twist is stored negated so increasing slider = external.
    // Left-side is stored non-negated (mirrorTwists handles the mirror).
    // Negate right for display so both arms show the same anatomical angle.
    const twist = selectedBone.startsWith('l') ? raw : -raw;
    return isNaN(twist) ? 0 : Math.round(twist * 10) / 10;
  }, [selectedBone, twists]);

  // --- FORCE & CONSTRAINT MANAGEMENT ---
  const addNewForce = (type: 'fixed' | 'cable' = 'fixed') => {
    const boneId = selectedBone || 'rForearm';
    const pulley = type === 'cable' ? { x: 0, y: -100, z: 0 } : undefined;
    const baseId = Date.now().toString();
    const newForce: ForceConfig = {
        id: baseId,
        name: type === 'cable' ? 'Cable' : 'Force',
        boneId, position: 1, x: 0, y: -1, z: 0, magnitude: 10, pulley,
    };
    setForces(prev => [...prev, newForce]);
    const src = sideOf(boneId);
    if (symmetryMode && src) applyWholesaleSync(src);
    setEditingForceId(newForce.id);
    setActiveTab('kinetics');
  };

  const updateForce = (id: string, field: keyof ForceConfig, value: any) => {
    if (typeof value === 'number' && isNaN(value)) return;
    // Resolve source side SYNCHRONOUSLY from the captured forces array.
    // Mutating a variable inside the setForces updater and reading it
    // afterward doesn't work — React runs updaters lazily, so the read
    // races with render and the sync call silently no-ops.
    const existing = forces.find(f => f.id === id);
    const effectiveBoneId =
        field === 'boneId' ? (value as string) : (existing?.boneId ?? '');
    const srcSide = sideOf(effectiveBoneId);
    setForces(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    if (symmetryMode && srcSide) applyWholesaleSync(srcSide);
  };

  const deleteForce = (id: string) => {
    const target = forces.find(f => f.id === id);
    const srcSide = target ? sideOf(target.boneId) : null;
    setForces(prev => prev.filter(f => f.id !== id));
    if (symmetryMode && srcSide) applyWholesaleSync(srcSide);
  };

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
      setCurrentRomT(mode === 'start' ? 0 : 1);
      if (mode === 'start') {
          setPosture(startPosture);
          setTwists(startTwists);
      } else {
          setPosture(endPosture);
          setTwists(endTwists);
      }
      setTargetPos(null);
  };

  // Copies the currently-active pose (start or end) onto the other end of
  // the timeline. Always copies "from active → other", so the button label
  // flips based on poseMode.
  const copyActivePose = () => {
      if (poseMode === 'start') {
          setEndPosture(startPosture);
          setEndTwists(startTwists);
      } else {
          setStartPosture(endPosture);
          setStartTwists(endTwists);
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
  //
  // Interpolation strategy: every slider moves at a fixed proportional speed
  // between start and end — a slider whose value changes 50° covers the same
  // t-range as one changing 5°, so the bigger-delta slider moves ~10× faster
  // in absolute terms. This is what the user sees as "constant-feeling"
  // playback. To achieve this:
  //   • Unit direction vectors use SLERP (constant angular velocity on the
  //     great circle between start and end — component-wise lerp does NOT
  //     give constant angular speed and was the cause of the "fast in the
  //     middle / slow at the ends" feel).
  //   • Non-unit clavicle offset vectors use linear lerp (they're
  //     translations, not rotations).
  //   • Twists use linear scalar lerp.
  //
  // Constraint enforcement: the straight-line path between two valid poses
  // doesn't lie on the constraint manifold, so each interpolated frame is
  // projected back onto it by solveConstraintsAccommodating (empty lock
  // sets — we want all bones free to satisfy constraints, starting from the
  // interpolated "tentative" as a hint). If the solver fails on a frame we
  // just skip rendering that frame and keep the previous valid pose.
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
        Object.keys(startPosture).forEach(boneId => {
            const startV = startPosture[boneId];
            const endV = endPosture[boneId] || startV;
            if (boneId.includes('Clavicle')) {
                // Clavicles store raw offset vectors, not unit directions.
                newPosture[boneId] = interpolateVector(startV, endV, t);
            } else {
                newPosture[boneId] = slerpDirection(startV, endV, t);
            }
        });

        const newTwists: Record<string, number> = {};
        const allTwistKeys = new Set([...Object.keys(startTwists), ...Object.keys(endTwists)]);
        allTwistKeys.forEach(boneId => {
            const startT = startTwists[boneId] || 0;
            const endT = endTwists[boneId] || 0;
            newTwists[boneId] = interpolateScalar(startT, endT, t);
        });

        // Playback is purely visual — just show the interpolated pose.
        // No constraint solving, no physics projection. Timeline Peaks has
        // its own analysis pipeline that handles physics properly. Keeping
        // playback simple avoids solver failures freezing the animation.
        setPosture(newPosture);
        setTwists(newTwists);
        // Update ROM position so force profiles evaluate at the correct t
        // during playback (the live torqueDistribution + joint force arrows
        // pick this up through the currentRomT dependency).
        setCurrentRomT(t);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (poseMode === 'start') { setPosture(startPosture); setTwists(startTwists); }
      else { setPosture(endPosture); setTwists(endTwists); }
    }
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                color: f.pulley ? '#06b6d4' : '#ef4444',
                pulley: f.pulley
            }))}
            reactionForces={[...jointForceArrows, ...scapulaActionIndicators]}
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
            <button onClick={() => setActiveTab('timeline')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'timeline' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Timeline Peaks"><TrendingUp className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('capacities')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'capacities' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Strength Capacity"><Gauge className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('limits')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'limits' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Joint Limits"><Lock className="w-5 h-5" /></button>
          </div>

          <div className="flex items-center gap-3 mb-6 shrink-0">
            {activeTab === 'kinematics' && <Settings2 className="w-5 h-5 text-indigo-600" />}
            {activeTab === 'constraints' && <Axis3d className="w-5 h-5 text-violet-600" />}
            {activeTab === 'kinetics' && <Zap className="w-5 h-5 text-orange-500" />}
            {activeTab === 'torque' && <Scale className="w-5 h-5 text-gray-800" />}
            {activeTab === 'timeline' && <TrendingUp className="w-5 h-5 text-emerald-600" />}
            {activeTab === 'capacities' && <Gauge className="w-5 h-5 text-purple-600" />}
            {activeTab === 'limits' && <Lock className="w-5 h-5 text-rose-600" />}
            <h3 className="text-lg font-bold text-gray-900">
                {activeTab === 'kinematics' ? 'Motion Editor' :
                 activeTab === 'constraints' ? 'Constraints' :
                 activeTab === 'kinetics' ? 'External Forces' :
                 activeTab === 'capacities' ? 'Joint Capacities' :
                 activeTab === 'limits' ? 'Joint Limits' :
                 activeTab === 'timeline' ? 'Timeline Peaks' : 'Joint Analysis'}
            </h3>
          </div>

          {activeTab === 'kinematics' && (
             <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pose Timeline</span>
                        <div className="flex gap-2">
                            <button onClick={copyActivePose} className="bg-white border border-gray-200 text-gray-500 p-1.5 rounded-lg hover:text-indigo-600 hover:border-indigo-200 transition-colors" title={poseMode === 'start' ? 'Copy Start to End' : 'Copy End to Start'}><Copy className="w-3 h-3" /></button>
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
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl py-8 px-4">
                                <ArrowDownUp className="w-8 h-8 text-gray-300 mb-2" />
                                <p className="text-xs font-bold text-gray-400 text-center uppercase tracking-wide">Passive Spine</p>
                                <p className="text-[10px] text-gray-300 text-center mt-1 leading-relaxed">No direct controls. Torque demands at the spine are detected from forces in the chain.</p>
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
                  {!selectedBone ? (
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
                          <div className="flex gap-2">
                              <button onClick={() => addConstraint(selectedBone, 'planar')} className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-xl shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                                  <Plus className="w-4 h-4" /> Planar
                              </button>
                              <button onClick={() => addConstraint(selectedBone, 'arc')} className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all flex items-center justify-center gap-2">
                                  <Plus className="w-4 h-4" /> Arc
                              </button>
                              <button onClick={() => addConstraint(selectedBone, 'fixed')} className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all flex items-center justify-center gap-2">
                                  <Lock className="w-4 h-4" /> Fixed
                              </button>
                          </div>

                          {(constraints[selectedBone] || []).map((c, idx) => (
                              <div key={c.id} className={`bg-white border rounded-2xl p-4 transition-all ${c.active ? (c.type === 'arc' ? 'border-amber-200' : c.type === 'fixed' ? 'border-rose-200' : 'border-violet-200') + ' shadow-sm' : 'border-gray-100 opacity-70'}`}>
                                  <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${c.active ? (c.type === 'arc' ? 'bg-amber-100 text-amber-700' : c.type === 'fixed' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700') : 'bg-gray-100 text-gray-500'}`}>{c.type === 'fixed' ? <Lock className="w-3 h-3" /> : idx + 1}</div>
                                          <span className="font-bold text-gray-900 text-sm">{c.type === 'arc' ? 'Arc' : c.type === 'fixed' ? 'Fixed Point' : 'Planar'} {idx + 1}</span>
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
                                      <div className="mb-3">
                                          <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Application Point</label>
                                          <div className="flex items-center gap-4">
                                              <span className="text-xs font-bold text-gray-500">Proximal</span>
                                              <input type="range" min="0" max="1" step="0.05"
                                                  value={c.position ?? 1}
                                                  onChange={(e) => {
                                                      const newPos = parseFloat(e.target.value);
                                                      const kin = calculateKinematics(posture, twists);
                                                      const seg = kin.boneStartPoints[selectedBone];
                                                      const end = kin.boneEndPoints[selectedBone];
                                                      if (seg && end) {
                                                          const newCenter = add(seg, mul(sub(end, seg), newPos));
                                                          if (c.type === 'arc' && c.pivot && c.axis) {
                                                              const snapped = snapArcToTip(c.pivot, c.axis, newCenter);
                                                              updateConstraint(selectedBone, c.id, { position: newPos, center: newCenter, pivot: snapped.pivot, radius: snapped.radius });
                                                          } else {
                                                              updateConstraint(selectedBone, c.id, { position: newPos, center: newCenter });
                                                          }
                                                      }
                                                  }}
                                                  className="flex-1 bio-range text-violet-500" />
                                              <span className="text-xs font-bold text-gray-500">Distal</span>
                                          </div>
                                      </div>
                                  )}

                                  {c.active && c.type !== 'arc' && c.type !== 'fixed' && (
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
                                                          <input type="range" min="-1" max="1" step="0.1" value={c.normal[axis]}
                                                              onChange={(e) => updateConstraint(selectedBone, c.id, { normal: { ...c.normal, [axis]: parseFloat(e.target.value) } })}
                                                              className="bio-range w-full text-violet-500" />
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      </div>
                                  )}
                                  {c.active && c.type === 'arc' && c.pivot && c.axis && (
                                      <div className="space-y-4">
                                          <div>
                                              <div className="flex justify-between items-center mb-2">
                                                  <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Pivot (x, y, z)</label>
                                                  <span className="font-mono text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">r={Math.round(c.radius ?? 0)}</span>
                                              </div>
                                              <div className="space-y-2">
                                                  {(['x', 'y', 'z'] as const).map(axis => (
                                                      <div key={axis} className="flex items-center gap-2">
                                                          <span className="text-[10px] font-bold text-gray-400 w-2 uppercase">{axis}</span>
                                                          <input type="number" step="5" value={Math.round(c.pivot![axis])}
                                                              onChange={(e) => {
                                                                  const rawPivot = { ...c.pivot!, [axis]: parseFloat(e.target.value) || 0 };
                                                                  const kin = calculateKinematics(posture, twists);
                                                                  const tip = kin.boneEndPoints[selectedBone];
                                                                  if (!tip) return;
                                                                  const snapped = snapArcToTip(rawPivot, c.axis!, tip);
                                                                  updateConstraint(selectedBone, c.id, { pivot: snapped.pivot, radius: snapped.radius });
                                                              }}
                                                              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono text-gray-700 text-center" />
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                          <div>
                                              <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Axis Presets</label>
                                              <div className="flex gap-1">
                                                  {[{ label: 'X', v: {x:1,y:0,z:0} }, { label: 'Y', v: {x:0,y:1,z:0} }, { label: 'Z', v: {x:0,y:0,z:1} }].map(p => (
                                                      <button key={p.label} onClick={() => {
                                                          const kin = calculateKinematics(posture, twists);
                                                          const tip = kin.boneEndPoints[selectedBone];
                                                          if (!tip) return;
                                                          const snapped = snapArcToTip(c.pivot!, p.v, tip);
                                                          updateConstraint(selectedBone, c.id, { axis: p.v, pivot: snapped.pivot, radius: snapped.radius });
                                                      }}
                                                          className="flex-1 py-1.5 bg-gray-50 hover:bg-amber-50 text-[10px] font-bold text-gray-600 rounded-lg border border-transparent hover:border-amber-200 transition-colors">{p.label}</button>
                                                  ))}
                                              </div>
                                          </div>
                                          <div>
                                              <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-2 block">Axis Direction</label>
                                              <div className="space-y-3">
                                                  {(['x', 'y', 'z'] as const).map(axis => (
                                                      <div key={axis} className="flex items-center gap-3">
                                                          <span className="text-[10px] font-bold text-gray-400 w-2 uppercase">{axis}</span>
                                                          <input type="range" min="-1" max="1" step="0.1" value={c.axis![axis]}
                                                              onChange={(e) => {
                                                                  const newAxis = { ...c.axis!, [axis]: parseFloat(e.target.value) };
                                                                  const kin = calculateKinematics(posture, twists);
                                                                  const tip = kin.boneEndPoints[selectedBone];
                                                                  if (!tip) return;
                                                                  const snapped = snapArcToTip(c.pivot!, newAxis, tip);
                                                                  updateConstraint(selectedBone, c.id, { axis: newAxis, pivot: snapped.pivot, radius: snapped.radius });
                                                              }}
                                                              className="bio-range w-full text-amber-500" />
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
                                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl"><div className="flex justify-between mb-2"><label className="font-bold text-orange-800 text-xs">Magnitude (relative)</label><span className="font-mono text-orange-600 font-bold text-xs">{f.magnitude}</span></div><input type="range" min="1" max="30" step="1" value={isNaN(f.magnitude) ? 10 : f.magnitude} onChange={(e) => updateForce(f.id, 'magnitude', parseFloat(e.target.value))} className="bio-range w-full text-orange-500"/><p className="text-[9px] text-orange-500 mt-1">Arbitrary unit — only relative magnitudes between forces matter.</p></div>
                                        {/* Resistance profile: piecewise-linear curve over ROM t */}
                                        <details className="group bg-gray-50 border border-gray-200 rounded-xl">
                                            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors rounded-xl">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1">
                                                    <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                                                    Resistance Profile
                                                </span>
                                                <span className="text-[9px] font-mono text-gray-400">
                                                    {f.profile ? `${f.profile.points.length} pts` : 'flat'}
                                                </span>
                                            </summary>
                                            <div className="px-4 pb-4 space-y-3">
                                                <p className="text-[9px] text-gray-500 leading-relaxed">Multiplier on magnitude across the ROM (start → end). Models cams, bands, lever profiles.</p>
                                                {(() => {
                                                    const prof = f.profile || { points: [{ t: 0, multiplier: 1 }, { t: 1, multiplier: 1 }] };
                                                    const pts = prof.points;
                                                    // Mini SVG preview
                                                    const W = 260, H = 50, PAD = 4;
                                                    const plotW = W - PAD * 2, plotH = H - PAD * 2;
                                                    const maxM = Math.max(...pts.map(p => p.multiplier), 1);
                                                    const svgPath = pts.map((p, i) => {
                                                        const x = PAD + p.t * plotW;
                                                        const y = PAD + plotH - (p.multiplier / maxM) * plotH;
                                                        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                                                    }).join(' ');
                                                    return (
                                                        <>
                                                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full bg-white rounded-lg border border-gray-100" style={{ display: 'block' }}>
                                                                <line x1={PAD} x2={PAD + plotW} y1={PAD + plotH} y2={PAD + plotH} stroke="#e5e7eb" strokeWidth="1" />
                                                                <path d={svgPath} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinejoin="round" />
                                                                {pts.map((p, i) => (
                                                                    <circle key={i} cx={PAD + p.t * plotW} cy={PAD + plotH - (p.multiplier / maxM) * plotH} r="3" fill="#f97316" stroke="white" strokeWidth="1" />
                                                                ))}
                                                                <text x={PAD} y={H - 1} fontSize="7" fill="#9ca3af">start</text>
                                                                <text x={PAD + plotW} y={H - 1} textAnchor="end" fontSize="7" fill="#9ca3af">end</text>
                                                                <text x={PAD} y={PAD + 6} fontSize="7" fill="#9ca3af">{maxM.toFixed(1)}×</text>
                                                            </svg>
                                                            <div className="space-y-1">
                                                                {pts.map((p, i) => (
                                                                    <div key={i} className="flex items-center gap-2">
                                                                        <span className="text-[9px] font-mono text-gray-400 w-6 shrink-0">@{(p.t * 100).toFixed(0)}%</span>
                                                                        <input type="number" step="0.1" min="0" value={p.multiplier}
                                                                            onChange={(e) => {
                                                                                const v = parseFloat(e.target.value);
                                                                                if (isNaN(v) || v < 0) return;
                                                                                const newPts = [...pts];
                                                                                newPts[i] = { ...newPts[i], multiplier: v };
                                                                                updateForce(f.id, 'profile', { points: newPts });
                                                                            }}
                                                                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs font-mono text-center"
                                                                        />
                                                                        <span className="text-[9px] text-gray-400">×</span>
                                                                        {pts.length > 2 && (
                                                                            <button onClick={() => {
                                                                                const newPts = pts.filter((_, j) => j !== i);
                                                                                updateForce(f.id, 'profile', { points: newPts });
                                                                            }} className="text-gray-300 hover:text-red-400 text-xs">×</button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => {
                                                                    // Add point at the midpoint of the widest gap
                                                                    const sorted = [...pts].sort((a, b) => a.t - b.t);
                                                                    let maxGap = 0, gapIdx = 0;
                                                                    for (let i = 0; i < sorted.length - 1; i++) {
                                                                        const gap = sorted[i + 1].t - sorted[i].t;
                                                                        if (gap > maxGap) { maxGap = gap; gapIdx = i; }
                                                                    }
                                                                    const newT = (sorted[gapIdx].t + sorted[gapIdx + 1].t) / 2;
                                                                    const newM = evaluateProfile(prof, newT);
                                                                    const newPts = [...pts, { t: newT, multiplier: newM }].sort((a, b) => a.t - b.t);
                                                                    updateForce(f.id, 'profile', { points: newPts });
                                                                }} className="flex-1 py-1.5 bg-gray-100 text-gray-500 text-[9px] font-bold rounded-lg hover:bg-gray-200">+ Point</button>
                                                                <button onClick={() => {
                                                                    updateForce(f.id, 'profile', undefined as any);
                                                                }} className="flex-1 py-1.5 bg-gray-100 text-gray-400 text-[9px] font-bold rounded-lg hover:bg-red-50 hover:text-red-400">Reset Flat</button>
                                                            </div>
                                                            {/* Presets */}
                                                            <div className="flex gap-1 flex-wrap">
                                                                {[
                                                                    { label: 'Ascending', pts: [{ t: 0, multiplier: 0.5 }, { t: 1, multiplier: 1.5 }] },
                                                                    { label: 'Descending', pts: [{ t: 0, multiplier: 1.5 }, { t: 1, multiplier: 0.5 }] },
                                                                    { label: 'Peaked', pts: [{ t: 0, multiplier: 0.6 }, { t: 0.5, multiplier: 1.4 }, { t: 1, multiplier: 0.6 }] },
                                                                    { label: 'Bell', pts: [{ t: 0, multiplier: 0.4 }, { t: 0.35, multiplier: 1.2 }, { t: 0.65, multiplier: 1.2 }, { t: 1, multiplier: 0.4 }] },
                                                                ].map(preset => (
                                                                    <button key={preset.label} onClick={() => updateForce(f.id, 'profile', { points: preset.pts })}
                                                                        className="px-2 py-1 bg-white border border-gray-200 rounded text-[8px] font-bold text-gray-500 hover:border-orange-300 hover:text-orange-600"
                                                                    >{preset.label}</button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </details>
                                        {f.pulley ? (
                                            <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-xl space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <label className="font-bold text-cyan-800 text-xs">Pulley Point</label>
                                                    <span className="font-mono text-[9px] text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded">
                                                        [{(() => { const d = getForceDirection(f); return `${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${d.z.toFixed(2)}`; })()}]
                                                    </span>
                                                </div>
                                                {(['x', 'y', 'z'] as const).map(axis => (
                                                    <div key={axis} className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-cyan-600 w-2 uppercase">{axis}</span>
                                                        <input type="number" step="10" value={Math.round(f.pulley![axis])}
                                                            onChange={(e) => updateForce(f.id, 'pulley', { ...f.pulley!, [axis]: parseFloat(e.target.value) || 0 })}
                                                            className="flex-1 bg-white border border-cyan-200 rounded-lg px-2 py-1.5 text-xs font-mono text-gray-700 text-center" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex items-center justify-between mb-4">
                                                    <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Direction Vector</label>
                                                    {/* Bone-local toggle */}
                                                    <button
                                                        onClick={() => updateForce(f.id, 'localFrame', !f.localFrame)}
                                                        className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all border ${f.localFrame ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600'}`}
                                                        title={f.localFrame
                                                            ? 'Direction is in the bone\'s local frame — rotates with the limb.'
                                                            : 'Direction is in world space — stays fixed regardless of limb orientation.'}
                                                    >
                                                        {f.localFrame ? 'Bone-Local' : 'World'}
                                                    </button>
                                                </div>
                                                {f.localFrame && (
                                                    <div className="mb-3 -mt-2 space-y-1">
                                                        <p className="text-[9px] text-indigo-500">Direction rotates with the limb. X = hinge axis, Y = along bone, Z = flex direction.</p>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!f.localFrameIgnoreTwist}
                                                                onChange={(e) => updateForce(f.id, 'localFrameIgnoreTwist', e.target.checked || undefined)}
                                                                className="rounded border-indigo-300 text-indigo-600"
                                                            />
                                                            <span className="text-[9px] font-bold text-indigo-500">Ignore Twist (IR/ER)</span>
                                                        </label>
                                                        {f.localFrameIgnoreTwist && (
                                                            <p className="text-[8px] text-indigo-400 pl-5">Force tracks swing (flex/abd) but not axial rotation. Typical for lever machines.</p>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="space-y-4">{['x', 'y', 'z'].map(axis => (<div key={axis}><div className="flex justify-between mb-1"><label className="font-bold text-gray-500 text-xs uppercase">{axis} Axis</label><span className="font-mono text-gray-400 text-xs">{f[axis as keyof ForceConfig]}</span></div><input type="range" min="-1" max="1" step="0.1" value={isNaN(f[axis as keyof ForceConfig] as number) ? 0 : f[axis as keyof ForceConfig] as number} onChange={(e) => updateForce(f.id, axis as keyof ForceConfig, parseFloat(e.target.value))} className="bio-range w-full text-gray-900"/></div>))}</div>
                                            </div>
                                        )}
                                        <div className="pt-8"><button onClick={() => deleteForce(f.id)} className="w-full py-3 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Delete Force</button></div>
                                     </>
                                 );
                             })()}
                         </div>
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col">
                          {forces.length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-gray-100 rounded-3xl mb-4"><Zap className="w-8 h-8 text-orange-300 mb-2" /><p className="text-gray-400 font-bold text-sm">No external forces.</p></div>) : (<div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">{forces.map(f => (<button key={f.id} onClick={() => setEditingForceId(f.id)} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group text-left bg-white shadow-sm hover:shadow-md ${f.pulley ? 'border-cyan-100 hover:border-cyan-200' : 'border-gray-100 hover:border-orange-200'}`}><div className="flex items-center gap-3"><div className={`p-2 rounded-xl text-white ${f.pulley ? 'bg-cyan-500' : 'bg-orange-500'}`}><Zap className="w-5 h-5" /></div><div><span className="block font-bold text-sm text-gray-900">{f.name}</span><span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{BONE_NAMES[f.boneId]}</span></div></div><div className="text-right"><span className="block font-bold text-gray-900 text-xs">{f.pulley ? 'Cable' : `${f.magnitude} N`}</span><ChevronRight className={`w-5 h-5 ml-auto ${f.pulley ? 'text-gray-300 group-hover:text-cyan-400' : 'text-gray-300 group-hover:text-orange-400'}`} /></div></button>))}</div>)}
                          <div className="space-y-3"><div className="flex gap-2"><button onClick={() => addNewForce('fixed')} className="flex-1 py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-200 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Fixed</button><button onClick={() => addNewForce('cable')} className="flex-1 py-4 bg-cyan-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-200 hover:bg-cyan-600 transition-all flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Cable</button></div></div>
                      </div>
                  )}
              </div>
          )}
          
          {activeTab === 'torque' && (
               <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                   {!torqueDistribution || torqueDistribution.demands.length === 0 ? (
                       <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-gray-100 rounded-3xl min-h-[150px]">
                           <BrainCircuit className="w-10 h-10 text-gray-300 mb-3" />
                           <p className="text-gray-500 font-bold text-sm">Add external forces<br/>to see joint analysis</p>
                       </div>
                   ) : (
                       <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                           {/* Display mode toggle: 1RM-local (default) vs raw */}
                           <div className="bg-gray-50 rounded-xl p-1 flex gap-1">
                               <button
                                   onClick={() => setTorqueDisplayMode('1rm-local')}
                                   className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${torqueDisplayMode === '1rm-local' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                   title="Normalize so the hardest action at this pose is 100% (treats current pose as loaded to 1RM)"
                               >
                                   1RM · Current Pose
                               </button>
                               <button
                                   onClick={() => setTorqueDisplayMode('raw')}
                                   className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${torqueDisplayMode === 'raw' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                   title="Raw torque/capacity ratio. Only meaningful if capacity table is calibrated to the same unit as your force magnitudes."
                               >
                                   Raw
                               </button>
                           </div>
                           {(() => {
                               // Compute the global normalization scale for this frame.
                               // 1rm-local: scale so the hardest action here reads 100%.
                               // raw: no scaling (multiplier = 1, showing raw effort × 100).
                               let scale = 1;
                               if (torqueDisplayMode === '1rm-local') {
                                   let maxEffort = 0;
                                   for (const d of torqueDistribution.demands) {
                                       if (d.effort > maxEffort) maxEffort = d.effort;
                                   }
                                   scale = maxEffort > 1e-9 ? 1 / maxEffort : 1;
                               }
                               // Build the limiting factor display using the highest raw
                               // effort (which is invariant under uniform scaling).
                               let limiting: JointActionDemand | null = null;
                               for (const d of torqueDistribution.demands) {
                                   if (!limiting || d.effort > limiting.effort) limiting = d;
                               }
                               // Group by joint/side for the bar display.
                               const groups: Record<string, JointActionDemand[]> = {};
                               for (const d of torqueDistribution.demands) {
                                   const side = d.boneId.startsWith('l') ? 'Left' : d.boneId.startsWith('r') ? 'Right' : '';
                                   const key = `${side} ${d.jointGroup}`.trim();
                                   if (!groups[key]) groups[key] = [];
                                   groups[key].push(d);
                               }
                               return (
                                   <>
                                       {limiting && (
                                           <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                                               <p className="text-[9px] font-bold uppercase tracking-wide text-red-400 mb-1">Limiting Factor</p>
                                               <p className="font-bold text-red-800 text-sm">{limiting.action}</p>
                                               <p className="text-[10px] text-red-500 font-medium">
                                                   {torqueDisplayMode === '1rm-local'
                                                       ? 'Highest demand at current pose · reads 100%'
                                                       : `Raw effort: ${(limiting.effort * 100).toFixed(0)}% of capacity`}
                                               </p>
                                           </div>
                                       )}
                                       {Object.entries(groups).map(([groupName, groupDemands]) => {
                                           const sorted = [...groupDemands].sort((a, b) => b.effort - a.effort);
                                           return (
                                               <div key={groupName} className="bg-white border border-gray-100 rounded-2xl p-4">
                                                   <h4 className="font-bold text-gray-900 text-sm mb-3">{groupName}</h4>
                                                   <div className="space-y-2">
                                                       {sorted.map((d, i) => {
                                                           const actionName = d.action.replace(/^(Left|Right)\s+\w+\s+/, '');
                                                           const pct = d.effort * scale * 100;
                                                           const barColor = d.effort > 0.8 ? 'bg-red-400' : d.effort > 0.5 ? 'bg-amber-400' : 'bg-indigo-400';
                                                           return (
                                                               <div key={`${d.boneId}-${d.action}-${i}`}>
                                                                   <div className="flex justify-between items-center mb-1">
                                                                       <span className="font-bold text-gray-700 text-xs">{actionName}</span>
                                                                       <span className="font-mono text-xs font-bold text-gray-500">{pct.toFixed(0)}%</span>
                                                                   </div>
                                                                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                       <div className={`h-full rounded-full ${barColor} transition-all duration-300`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                                   </div>
                                                               </div>
                                                           );
                                                       })}
                                                   </div>
                                               </div>
                                           );
                                       })}
                                   </>
                               );
                           })()}
                       </div>
                   )}
               </div>
          )}

          {activeTab === 'timeline' && (
              <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                  {!timelineAnalysis || timelineAnalysis.peaks.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-gray-100 rounded-3xl min-h-[150px]">
                          <TrendingUp className="w-10 h-10 text-gray-300 mb-3" />
                          <p className="text-gray-500 font-bold text-sm">Add forces and set<br/>start/end poses to<br/>see timeline peaks</p>
                      </div>
                  ) : (
                      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-500 mb-1">Peak Analysis · 1RM Normalized</p>
                              <p className="text-[11px] text-emerald-900 font-medium leading-relaxed">
                                  Values are % of the 1RM limiting capacity. The system picks a global scale factor so the hardest action at the hardest frame reads 100% — everything else is a fraction of that. Small % tag is where in the ROM the peak occurred.
                              </p>
                              <p className="text-[10px] text-emerald-500 font-mono mt-2">
                                  {timelineAnalysis.framesAnalyzed} frames analyzed
                                  {timelineAnalysis.framesSkipped > 0 && ` · ${timelineAnalysis.framesSkipped} skipped (solver failure)`}
                              </p>
                          </div>
                          {timelineAnalysis.limitingPeak && (
                              <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-red-400 mb-1">Limiting Factor</p>
                                  <p className="font-bold text-red-800 text-sm">{timelineAnalysis.limitingPeak.action}</p>
                                  <p className="text-[10px] text-red-500 font-medium">
                                      Peaks at {timelineAnalysis.limitingPeak.peakFramePct.toFixed(0)}% of range
                                  </p>
                              </div>
                          )}
                          {/* Resistance + Difficulty profiles — two stacked line graphs.
                            *
                            * Both curves are NORMALIZED to their own peak, matching the
                            * 1RM design assumption: the system doesn't know absolute
                            * Newtons (capacities and user force magnitudes are on
                            * arbitrary scales), so only the *shape* of each curve is
                            * meaningful. The raw peak value is shown in the header as
                            * a reference but the graph Y axis is always 0% → 100%.
                            *
                            * Comparing the two shapes is the real diagnostic:
                            *   - Identical shapes: difficulty tracks mechanical load
                            *     directly, no strength-curve effects.
                            *   - Different shapes: capacity varies across the ROM, so
                            *     some positions feel harder than their raw resistance
                            *     would suggest. That's the strength curve manifesting.
                            */}
                          {timelineAnalysis.profile.length > 1 && (() => {
                              const profile = timelineAnalysis.profile;
                              const W = 296, H = 80, PAD_L = 28, PAD_R = 8, PAD_T = 8, PAD_B = 18;
                              const plotW = W - PAD_L - PAD_R;
                              const plotH = H - PAD_T - PAD_B;
                              const tx = (t: number) => PAD_L + t * plotW;

                              // Find peaks for normalization and annotation.
                              const resPeak = profile.reduce((m, p) => p.resistance > m.resistance ? p : m, profile[0]);
                              const diffPeak = profile.reduce((m, p) => p.difficulty > m.difficulty ? p : m, profile[0]);
                              const resMaxRaw = resPeak.resistance;
                              const diffMaxRaw = diffPeak.difficulty;

                              const makePath = (
                                  sel: (p: TimelineProfilePoint) => number,
                                  norm: number
                              ) => {
                                  const denom = norm > 1e-6 ? norm : 1;
                                  return profile.map((p, i) => {
                                      const x = tx(p.t);
                                      const y = PAD_T + plotH - (sel(p) / denom) * plotH;
                                      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                                  }).join(' ');
                              };

                              const renderGraph = (
                                  title: string,
                                  desc: string,
                                  sel: (p: TimelineProfilePoint) => number,
                                  norm: number,
                                  color: string,
                                  fillColor: string,
                                  peak: TimelineProfilePoint,
                                  rawPeakLabel: string,
                              ) => {
                                  const linePath = makePath(sel, norm);
                                  const areaPath = linePath + ` L${tx(1).toFixed(1)},${(PAD_T + plotH).toFixed(1)} L${tx(0).toFixed(1)},${(PAD_T + plotH).toFixed(1)} Z`;
                                  const peakX = tx(peak.t);
                                  const denom = norm > 1e-6 ? norm : 1;
                                  const peakY = PAD_T + plotH - (sel(peak) / denom) * plotH;
                                  return (
                                      <div className="bg-white border border-gray-100 rounded-2xl p-4">
                                          <div className="flex items-baseline justify-between mb-1">
                                              <h4 className="font-bold text-gray-900 text-sm">{title}</h4>
                                              <span className="text-[9px] font-mono font-bold text-gray-400">peak @ {(peak.t * 100).toFixed(0)}%</span>
                                          </div>
                                          <p className="text-[10px] text-gray-500 leading-snug mb-2">{desc}</p>
                                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
                                              {[0, 0.25, 0.5, 0.75, 1].map(g => (
                                                  <line key={`gv-${g}`} x1={tx(g)} x2={tx(g)} y1={PAD_T} y2={PAD_T + plotH} stroke="#f3f4f6" strokeWidth="1" />
                                              ))}
                                              {[0, 0.25, 0.5, 0.75, 1].map(g => {
                                                  const y = PAD_T + plotH - g * plotH;
                                                  return <line key={`gh-${g}`} x1={PAD_L} x2={PAD_L + plotW} y1={y} y2={y} stroke="#f3f4f6" strokeWidth="1" />;
                                              })}
                                              <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" fontSize="8" fill="#9ca3af" fontFamily="monospace">100%</text>
                                              <text x={PAD_L - 4} y={PAD_T + plotH + 2} textAnchor="end" fontSize="8" fill="#9ca3af" fontFamily="monospace">0</text>
                                              <text x={tx(0)} y={H - 4} textAnchor="start" fontSize="8" fill="#9ca3af" fontFamily="monospace">start</text>
                                              <text x={tx(1)} y={H - 4} textAnchor="end" fontSize="8" fill="#9ca3af" fontFamily="monospace">end</text>
                                              <path d={areaPath} fill={fillColor} />
                                              <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
                                              <line x1={peakX} x2={peakX} y1={PAD_T} y2={PAD_T + plotH} stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                                              <circle cx={peakX} cy={peakY} r="2.5" fill={color} stroke="white" strokeWidth="1" />
                                          </svg>
                                          <p className="text-[9px] text-gray-400 font-mono mt-1 text-right">raw peak: {rawPeakLabel}</p>
                                      </div>
                                  );
                              };
                              return (
                                  <>
                                      {renderGraph(
                                          'Resistance Profile',
                                          'Total mechanical load on the chain across the ROM, normalized to its peak. Pure physics — ignores muscle strength.',
                                          p => p.resistance,
                                          resMaxRaw,
                                          '#3b82f6',
                                          'rgba(59, 130, 246, 0.12)',
                                          resPeak,
                                          resMaxRaw.toFixed(1),
                                      )}
                                      {renderGraph(
                                          'Difficulty Profile',
                                          'Hardest joint action\'s effort (τ / capacity) at each point, normalized to its peak. Under 1RM assumption this always hits 100% at the sticking point.',
                                          p => p.difficulty,
                                          diffMaxRaw,
                                          '#ef4444',
                                          'rgba(239, 68, 68, 0.12)',
                                          diffPeak,
                                          (diffMaxRaw * 100).toFixed(0) + '% raw effort',
                                      )}
                                  </>
                              );
                          })()}
                          {(() => {
                              // Group peaks by "Side JointGroup" like the Joint Analysis tab.
                              const groups: Record<string, TimelinePeak[]> = {};
                              for (const p of timelineAnalysis.peaks) {
                                  const side = p.boneId.startsWith('l') ? 'Left' : p.boneId.startsWith('r') ? 'Right' : '';
                                  const key = `${side} ${p.jointGroup}`.trim();
                                  if (!groups[key]) groups[key] = [];
                                  groups[key].push(p);
                              }

                              // Index actionSeries by key for O(1) lookup in render.
                              const seriesLookup = new Map<string, ActionTimeSeries>();
                              for (const s of timelineAnalysis.actionSeries) {
                                  seriesLookup.set(`${s.boneId}::${s.action}`, s);
                              }

                              // Mini sparkline renderer. Shared by per-action and per-joint.
                              const renderSparkline = (
                                  efforts: number[],
                                  color: string,
                                  fillColor: string,
                                  height: number = 16,
                              ) => {
                                  if (efforts.length < 2) return null;
                                  const profPts = timelineAnalysis.profile;
                                  const W = 260, H = height, PAD = 1;
                                  const plotW = W - PAD * 2, plotH = H - PAD * 2;
                                  // Y axis: always 0 to 1 (1RM normalized)
                                  const pathD = efforts.map((e, i) => {
                                      const t = profPts[i] ? profPts[i].t : (efforts.length > 1 ? i / (efforts.length - 1) : 0);
                                      const x = PAD + t * plotW;
                                      const y = PAD + plotH - Math.min(e, 1) * plotH;
                                      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                                  }).join(' ');
                                  const lastX = PAD + plotW;
                                  const baseY = PAD + plotH;
                                  const areaD = pathD + ` L${lastX.toFixed(1)},${baseY.toFixed(1)} L${PAD.toFixed(1)},${baseY.toFixed(1)} Z`;
                                  return (
                                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block', height: `${height}px` }} preserveAspectRatio="none">
                                          <path d={areaD} fill={fillColor} />
                                          <path d={pathD} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" />
                                      </svg>
                                  );
                              };

                              return Object.entries(groups).map(([groupName, groupPeaks]) => {
                                  const sorted = [...groupPeaks].sort((a, b) => b.peakEffort - a.peakEffort);

                                  // Per-joint aggregate sparkline: max effort across all
                                  // actions in this group at each frame index.
                                  const nFrames = timelineAnalysis.profile.length;
                                  const jointEfforts = new Array(nFrames).fill(0);
                                  // Per-joint total torque at each frame (for computing
                                  // per-action proportions below).
                                  const jointTotalTorque = new Array(nFrames).fill(0);
                                  for (const p of sorted) {
                                      const series = seriesLookup.get(`${p.boneId}::${p.action}`);
                                      if (!series) continue;
                                      for (let i = 0; i < Math.min(nFrames, series.efforts.length); i++) {
                                          if (series.efforts[i] > jointEfforts[i]) jointEfforts[i] = series.efforts[i];
                                      }
                                      for (let i = 0; i < Math.min(nFrames, series.torques.length); i++) {
                                          jointTotalTorque[i] += series.torques[i];
                                      }
                                  }

                                  return (
                                      <div key={groupName} className="bg-white border border-gray-100 rounded-2xl p-4">
                                          <h4 className="font-bold text-gray-900 text-sm mb-1">{groupName}</h4>
                                          {/* Per-joint aggregate sparkline */}
                                          <div className="mb-3 rounded overflow-hidden">
                                              {renderSparkline(jointEfforts, '#6b7280', 'rgba(107, 114, 128, 0.1)', 20)}
                                          </div>
                                          <div className="space-y-3">
                                              {sorted.map((p, i) => {
                                                  const pct = p.peakEffort * 100;
                                                  const actionName = p.action.replace(/^(Left|Right)\s+\w+\s+/, '');
                                                  const lineColor = p.peakEffort > 0.8 ? '#f87171' : p.peakEffort > 0.5 ? '#fbbf24' : '#34d399';
                                                  const fillColor = p.peakEffort > 0.8 ? 'rgba(248, 113, 113, 0.15)' : p.peakEffort > 0.5 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(52, 211, 153, 0.15)';
                                                  const barColor = p.peakEffort > 0.8 ? 'bg-red-400' : p.peakEffort > 0.5 ? 'bg-amber-400' : 'bg-emerald-400';

                                                  // Look up this action's time series.
                                                  const series = seriesLookup.get(`${p.boneId}::${p.action}`);

                                                  return (
                                                      <div key={`${p.boneId}-${p.action}-${i}`}>
                                                          <div className="flex justify-between items-center mb-1">
                                                              <span className="font-bold text-gray-700 text-xs">{actionName}</span>
                                                              <div className="flex items-center gap-2">
                                                                  <span className="text-[9px] font-mono font-bold text-gray-400">@{p.peakFramePct.toFixed(0)}%</span>
                                                                  <span className="font-mono text-xs font-bold text-gray-500">{pct.toFixed(0)}%</span>
                                                              </div>
                                                          </div>
                                                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                              <div className={`h-full rounded-full ${barColor} transition-all duration-300`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                          </div>
                                                          {/* Per-action sparkline: proportion of joint's total force */}
                                                          {series && series.torques.length > 1 && (
                                                              <div className="mt-1 rounded overflow-hidden">
                                                                  {renderSparkline(
                                                                      series.torques.map((t, i) => jointTotalTorque[i] > 1e-9 ? t / jointTotalTorque[i] : 0),
                                                                      lineColor, fillColor, 16
                                                                  )}
                                                              </div>
                                                          )}
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  );
                              });
                          })()}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'limits' && (
              <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 mb-6">
                      <p className="text-xs text-rose-900 font-medium leading-relaxed">
                          Passive end-range for each joint. When a joint is at its limit and a force pushes it further into the stop, the passive anatomy absorbs the load and muscle demand drops to zero. 2-DOF joints (shoulder, hip, scapula) use DIR component bounds on the stored vector; hinges and twists use action angles. Limits are shared bilaterally with automatic sign handling.
                      </p>
                      <p className="text-[10px] text-rose-500 font-mono mt-2">
                          Wired into slider clamping and torque demand zeroing. Defaults are population-average ROM — edit to match the subject.
                      </p>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                      {(Object.keys(JOINT_ACTIONS) as JointGroup[]).map(group => {
                          const bones = GROUP_BONES[group];
                          const dims = limitDimensionsForGroup(group);
                          return (
                              <div key={group} className="bg-white border border-gray-100 rounded-2xl p-4">
                                  <h4 className="font-bold text-gray-900 text-sm mb-3">{group}</h4>
                                  <div className="space-y-4">
                                      {dims.map(dim => {
                                          const key = dim.key;
                                          const limit = jointLimits[key] || { min: dim.displayMin, max: dim.displayMax };
                                          // Live values for left/right (null for Spine).
                                          const lVal = bones ? getDimensionValue(dim, bones.left, posture, twists) : null;
                                          const rVal = bones ? getDimensionValue(dim, bones.right, posture, twists) : null;
                                          // Track range: display bounds, widened if user-set limits exceed them.
                                          const margin = dim.kind === 'dir' ? 0.1 : 20;
                                          const trackMin = Math.min(dim.displayMin, limit.min - margin);
                                          const trackMax = Math.max(dim.displayMax, limit.max + margin);
                                          const trackSpan = trackMax - trackMin;
                                          const pct = (v: number) => ((v - trackMin) / trackSpan) * 100;
                                          // "At limit" tolerance: 1° for actions, 0.02 for dir components.
                                          const tol = dim.kind === 'dir' ? 0.02 : 1;
                                          const atLimit = (v: number | null) => {
                                              if (v === null) return false;
                                              return v <= limit.min + tol || v >= limit.max - tol;
                                          };
                                          // Format values for display.
                                          const fmt = (v: number) =>
                                              dim.kind === 'dir' ? v.toFixed(2) : v.toFixed(0) + '°';
                                          // Step size and number-input step per dimension.
                                          const inputStep = dim.kind === 'dir' ? 0.05 : 5;
                                          // Effective limits after coupling (for visualization annotation).
                                          let effMin = limit.min;
                                          let effMax = limit.max;
                                          if (limit.coupling) {
                                              const source = jointLimits[limit.coupling.dependsOn];
                                              // Use the LIVE source value on the right-side bone (or left if no right).
                                              const srcDim = allLimitDimensions.find(d => d.dim.key === limit.coupling!.dependsOn);
                                              if (srcDim && GROUP_BONES[srcDim.group]) {
                                                  const srcBone = GROUP_BONES[srcDim.group]!.right;
                                                  const srcVal = getDimensionValue(srcDim.dim, srcBone, posture, twists);
                                                  effMin = limit.min + limit.coupling.slopeMin * srcVal;
                                                  effMax = limit.max + limit.coupling.slopeMax * srcVal;
                                              }
                                              void source;
                                          }
                                          return (
                                              <div key={key} className="space-y-2">
                                                  <div className="flex items-center justify-between">
                                                      <span className="font-bold text-gray-700 text-xs">
                                                          {dim.label}
                                                      </span>
                                                      {bones && (
                                                          <div className="flex items-center gap-2 text-[9px] font-mono">
                                                              <span className={`px-1.5 py-0.5 rounded ${atLimit(lVal) ? 'bg-rose-100 text-rose-700' : 'bg-gray-50 text-gray-500'}`}>
                                                                  L {lVal !== null ? fmt(lVal) : '—'}
                                                              </span>
                                                              <span className={`px-1.5 py-0.5 rounded ${atLimit(rVal) ? 'bg-rose-100 text-rose-700' : 'bg-gray-50 text-gray-500'}`}>
                                                                  R {rVal !== null ? fmt(rVal) : '—'}
                                                              </span>
                                                          </div>
                                                      )}
                                                  </div>
                                                  {/* Visualization track */}
                                                  <div className="relative h-5">
                                                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-gray-100 rounded-full" />
                                                      {/* Configured hard limits (darker rose) */}
                                                      <div
                                                          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-rose-200 rounded-full"
                                                          style={{ left: `${pct(limit.min)}%`, width: `${pct(limit.max) - pct(limit.min)}%` }}
                                                      />
                                                      {/* Effective (coupled) limits (rose if different from hard) */}
                                                      {limit.coupling && (effMin !== limit.min || effMax !== limit.max) && (
                                                          <div
                                                              className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-rose-400 rounded-full"
                                                              style={{ left: `${pct(effMin)}%`, width: `${pct(effMax) - pct(effMin)}%` }}
                                                          />
                                                      )}
                                                      {/* Soft zones on each edge */}
                                                      {limit.softZone && limit.softZone > 0 && (
                                                          <>
                                                              <div
                                                                  className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-rose-300/60 rounded-l-full"
                                                                  style={{ left: `${pct(effMin)}%`, width: `${(limit.softZone / trackSpan) * 100}%` }}
                                                              />
                                                              <div
                                                                  className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-rose-300/60 rounded-r-full"
                                                                  style={{ left: `${pct(effMax - limit.softZone)}%`, width: `${(limit.softZone / trackSpan) * 100}%` }}
                                                              />
                                                          </>
                                                      )}
                                                      {lVal !== null && (
                                                          <div
                                                              className="absolute top-1/2 w-2 h-2 -mt-1 -ml-1 rounded-full bg-blue-500 border border-white shadow"
                                                              style={{ left: `${clamp(pct(lVal), 0, 100)}%` }}
                                                              title={`Left: ${fmt(lVal)}`}
                                                          />
                                                      )}
                                                      {rVal !== null && (
                                                          <div
                                                              className="absolute top-1/2 w-2 h-2 -mt-1 -ml-1 rounded-full bg-indigo-600 border border-white shadow"
                                                              style={{ left: `${clamp(pct(rVal), 0, 100)}%` }}
                                                              title={`Right: ${fmt(rVal)}`}
                                                          />
                                                      )}
                                                  </div>
                                                  <div className="flex gap-2 items-center">
                                                      <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Min</label>
                                                      <input
                                                          type="number"
                                                          step={inputStep}
                                                          value={limit.min}
                                                          onChange={(e) => {
                                                              const v = parseFloat(e.target.value);
                                                              if (!isNaN(v)) updateLimit(key, { min: Math.min(v, limit.max) });
                                                          }}
                                                          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 font-mono text-xs text-gray-700 outline-none focus:border-rose-400"
                                                      />
                                                      <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Max</label>
                                                      <input
                                                          type="number"
                                                          step={inputStep}
                                                          value={limit.max}
                                                          onChange={(e) => {
                                                              const v = parseFloat(e.target.value);
                                                              if (!isNaN(v)) updateLimit(key, { max: Math.max(v, limit.min) });
                                                          }}
                                                          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 font-mono text-xs text-gray-700 outline-none focus:border-rose-400"
                                                      />
                                                  </div>
                                                  <details className="group">
                                                      <summary className="text-[9px] font-bold uppercase tracking-wide text-gray-400 cursor-pointer hover:text-rose-500 list-none flex items-center gap-1">
                                                          <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                                                          Advanced
                                                      </summary>
                                                      <div className="mt-2 space-y-2 pl-4">
                                                          <div className="flex gap-2 items-center">
                                                              <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400 w-16 shrink-0">Soft Zone</label>
                                                              <input
                                                                  type="number"
                                                                  step={inputStep}
                                                                  min="0"
                                                                  value={limit.softZone ?? 0}
                                                                  onChange={(e) => {
                                                                      const v = parseFloat(e.target.value);
                                                                      if (!isNaN(v)) updateLimit(key, { softZone: v > 0 ? v : undefined });
                                                                  }}
                                                                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 font-mono text-xs text-gray-700 outline-none focus:border-rose-400"
                                                                  title="End-range ramp width (same units as min/max). 0 = hard stop."
                                                              />
                                                              <span className="text-[9px] text-gray-400 font-mono">{dim.unit || ''}</span>
                                                          </div>
                                                          <div className="flex gap-2 items-center">
                                                              <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400 w-16 shrink-0">Couple To</label>
                                                              <select
                                                                  value={limit.coupling?.dependsOn || ''}
                                                                  onChange={(e) => {
                                                                      if (!e.target.value) {
                                                                          updateLimit(key, { coupling: undefined });
                                                                      } else {
                                                                          updateLimit(key, { coupling: { dependsOn: e.target.value, slopeMin: 0, slopeMax: 0 } });
                                                                      }
                                                                  }}
                                                                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[10px] text-gray-700 outline-none focus:border-rose-400"
                                                              >
                                                                  <option value="">None (independent)</option>
                                                                  {allLimitDimensions.map(({ group: g, dim: d }) => {
                                                                      if (d.key === key) return null;
                                                                      return <option key={d.key} value={d.key}>{g} {d.label}</option>;
                                                                  }).filter(Boolean)}
                                                              </select>
                                                          </div>
                                                          {limit.coupling && (
                                                              <div className="flex gap-2 items-center">
                                                                  <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400 w-16 shrink-0">Slope</label>
                                                                  <input
                                                                      type="number"
                                                                      step="0.05"
                                                                      value={limit.coupling.slopeMin}
                                                                      onChange={(e) => {
                                                                          const v = parseFloat(e.target.value);
                                                                          if (!isNaN(v) && limit.coupling) updateLimit(key, { coupling: { ...limit.coupling, slopeMin: v } });
                                                                      }}
                                                                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 font-mono text-xs text-gray-700 outline-none focus:border-rose-400"
                                                                      title="Shift in min per unit of coupled source."
                                                                  />
                                                                  <span className="text-[8px] text-gray-400 font-mono">min</span>
                                                                  <input
                                                                      type="number"
                                                                      step="0.05"
                                                                      value={limit.coupling.slopeMax}
                                                                      onChange={(e) => {
                                                                          const v = parseFloat(e.target.value);
                                                                          if (!isNaN(v) && limit.coupling) updateLimit(key, { coupling: { ...limit.coupling, slopeMax: v } });
                                                                      }}
                                                                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 font-mono text-xs text-gray-700 outline-none focus:border-rose-400"
                                                                      title="Shift in max per unit of coupled source."
                                                                  />
                                                                  <span className="text-[8px] text-gray-400 font-mono">max</span>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </details>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
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
