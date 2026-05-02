
import React, { useState, useEffect, useMemo, useRef } from 'react';
import BioMan, { Posture, Vector3, VisualForce, VisualPlane, AxisCircle } from '../components/BioMan';
import { Settings2, RotateCcw, MousePointerClick, Move3d, Copy, Lock, Split, Play, Pause, Zap, Scale, Gauge, ChevronLeft, AlertCircle, ArrowDownUp, RefreshCw, ChevronRight, ChevronDown, BrainCircuit, Axis3d, Plus, Trash2, TrendingUp, Activity, Link2 } from 'lucide-react';

const DEFAULT_POSTURE: Posture = {
  // Spine is a unit direction from pelvis base to neck base. Default
  // (0, -1, 0) = straight up (Y is down in world space).
  spine: { x: 0, y: -1, z: 0 },
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
  // Spine axial rotation (RELATIVE rotation between pelvis and shoulders
  // about the spine's long axis). This is the anatomical "spine twist":
  // positive = torso rotated to the LEFT of the pelvis, negative = RIGHT.
  // User-facing — driven by the rotation slider when spine is selected.
  spine: 0,
  // Pelvis yaw — an INTERNAL solver DOF representing the world-frame
  // rotation of the pelvis+legs around the pelvis's vertical axis. Not
  // user-facing. The solver adjusts this to accommodate constraints
  // when spine rotation is applied: if the upper body is pinned and the
  // user drags the spine slider, the solver spins the pelvis opposite
  // so the shoulders stay put in world while the legs rotate.
  //
  // World-space shoulder rotation = pelvisYaw + spineTwist.
  // World-space pelvis/leg rotation = pelvisYaw.
  pelvis: 0,
  // Pelvis translation — INTERNAL solver DOFs storing world-space
  // displacement of the pelvis from its default position (0, TORSO_LEN/2,
  // 0). These let the solver move the whole body in space to satisfy
  // distal constraints: feet pinned + knee flex → pelvis drops Y (squat);
  // hands + feet pinned in a deadlift → pelvis shifts Y and Z together;
  // hands on pull-up bar → pelvis hangs in Y. Not user-facing; when no
  // constraints are active the solver leaves these alone.
  pelvisTx: 0,
  pelvisTy: 0,
  pelvisTz: 0,
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
  rTibia: { min: -20, max: 20 },
  // Spine axial rotation — torso rotation about the spine's long axis.
  // ±45° per side is a typical thoracolumbar range for strength-training
  // contexts; clinical ROM varies but this matches what a lifter can
  // actually load (e.g. seated cable rotations, Russian twists).
  // Convention: positive = rotation to the LEFT (Rotation L action),
  // negative = to the RIGHT, applied to the spine frame via twistFrame.
  spine: { min: -45, max: 45 },
  // Pelvis yaw — world-frame rotation of the pelvis+legs. This is an
  // internal solver DOF (no slider), so the range is loose: up to ±90°
  // in either direction. In practice the spine limit (±45°) + the
  // constraint geometry will keep pelvis in a sensible range.
  pelvis: { min: -90, max: 90 }
};

// Pelvis TRANSLATION limits, in world units (not degrees). Like
// ROTATION_LIMITS above, these are used by the solver's Armijo step to
// clamp candidate values during gradient descent — they're not user-
// facing limits. Generous: the solver only moves pelvis when a constraint
// actually demands it, and real-exercise displacements are usually small
// (20-40 world units) relative to these bounds. Scale reference: torso is
// CONFIG.TORSO_LEN = 60 world units tall.
const POSITION_LIMITS: Record<string, { min: number, max: number }> = {
  pelvisTx: { min: -100, max: 100 },
  pelvisTy: { min: -100, max: 100 },
  pelvisTz: { min: -100, max: 100 },
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
  spine: 60,  // matches CONFIG.TORSO_LEN in BioMan
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
    // Physics / kinematic mode toggle. Default true (legacy behavior).
    //   true  = full constraint: path enforcement (solver) + Phase B
    //           Lagrange coupling + reaction-force arrow. Models a
    //           PHYSICAL object holding the limb (barbell, machine pad).
    //   false = kinematic guide only: solver still holds the limb on the
    //           path during drag/playback, but Phase B treats the
    //           endpoint as free (no load redistribution) and no reaction
    //           is drawn. Models a MOTION PATH without a physical object
    //           (e.g. "forearm sweeps in sagittal plane during a curl").
    physicsEnabled?: boolean;
    // Direction-restriction mode for `planar` constraints (ignored on arc/fixed).
    //   undefined  = bidirectional equality (current default). The tip's
    //                signed distance to the plane must be exactly 0 — both
    //                sides of the plane are forbidden.
    //   'half-space' = static one-sided wall. The tip's signed distance
    //                  must satisfy sd ≤ 0 (free in -normal halfspace,
    //                  blocked when crossing into +normal halfspace). The
    //                  wall stays where authored. Models safety pins, the
    //                  floor under the feet, machine end-stops.
    //   'one-way'    = ratchet / monotonic motion. Same as half-space at
    //                  any instant, but the wall's effective center slides
    //                  with the tip whenever the tip moves further into
    //                  the allowed region. Once the tip has moved past
    //                  the wall in the -normal direction, it cannot back
    //                  up: the wall has advanced to its new position.
    //                  Models one-way bearings, latching mechanisms,
    //                  "no-eccentric" rehab modes.
    // Cost function: violation = directional ? max(0, sd) : sd; cost = violation².
    // Cost is C¹ at sd=0 so existing Armijo backtracking handles the kink.
    directional?: 'half-space' | 'one-way';
    // Optional joint anchor for the arc pivot. When set, the constraint's
    // pivot follows the live world position of the named joint each
    // frame instead of staying at the stored `pivot` value. Lets you
    // model "lever arm rotates around the knee/elbow/etc." setups
    // where the axle moves with the body. Joint name format is e.g.
    // 'Knee.L', 'Elbow.R', 'Hip.L', 'Pelvis', 'Neck' — see
    // JOINT_ANCHOR_POINTS for the full list. Ignored on planar/fixed.
    anchor?: { joint: string };
}

interface Frame {
    x: Vector3;
    y: Vector3;
    z: Vector3;
}

type JointGroup = 'Shoulder' | 'Elbow' | 'Hip' | 'Knee' | 'Ankle' | 'Scapula' | 'Spine';

// Map of pickable joint anchor points → which bone end they correspond to
// in the kinematics output. `start` = boneStartPoints[bone], `end` =
// boneEndPoints[bone]. Used by arc constraints with `anchor` set, and
// by the "anchor pivot to joint" dropdown in the constraint settings UI.
// Joint names are display-friendly so we can show them directly.
//
// Convention: shoulder = humerus start (glenohumeral); elbow = forearm
// start (humeroulnar); wrist = forearm end; hip = femur start; knee =
// tibia start; ankle = foot start; toe = foot end. Pelvis = spine
// start; neck = spine end. Two central anchors plus L/R variants for
// every limb joint.
const JOINT_ANCHOR_POINTS: Record<string, { bone: string; end: 'start' | 'end' }> = {
    'Pelvis':     { bone: 'spine',    end: 'start' },
    'Neck':       { bone: 'spine',    end: 'end'   },
    'Shoulder.L': { bone: 'lHumerus', end: 'start' },
    'Shoulder.R': { bone: 'rHumerus', end: 'start' },
    'Elbow.L':    { bone: 'lForearm', end: 'start' },
    'Elbow.R':    { bone: 'rForearm', end: 'start' },
    'Wrist.L':    { bone: 'lForearm', end: 'end'   },
    'Wrist.R':    { bone: 'rForearm', end: 'end'   },
    'Hip.L':      { bone: 'lFemur',   end: 'start' },
    'Hip.R':      { bone: 'rFemur',   end: 'start' },
    'Knee.L':     { bone: 'lTibia',   end: 'start' },
    'Knee.R':     { bone: 'rTibia',   end: 'start' },
    'Ankle.L':    { bone: 'lFoot',    end: 'start' },
    'Ankle.R':    { bone: 'rFoot',    end: 'start' },
    'Toe.L':      { bone: 'lFoot',    end: 'end'   },
    'Toe.R':      { bone: 'rFoot',    end: 'end'   },
};

// Mirror an anchor joint name across the body's sagittal plane. Central
// joints (Pelvis, Neck) are returned unchanged; left/right variants are
// swapped. Used by the constraint mirror function so symmetry mode
// keeps the anchor on the corresponding side.
const mirrorJointName = (j: string): string => {
    if (j.endsWith('.L')) return j.slice(0, -2) + '.R';
    if (j.endsWith('.R')) return j.slice(0, -2) + '.L';
    return j;
};

interface CapacityConfig {
    base: number;
    specific: number;
    angle: number;
}

interface JointCapacityProfile {
    [action: string]: CapacityConfig;
}

// --- MUSCLES ---
//
// A muscle is an anatomically-named tissue from a fixed catalog. The user
// assigns muscles to specific (joint, action) pairs and gives each one a
// {base, peak, angle} contribution profile, evaluated by the same cosine
// bell as joint capacities. The numbers here are dimensionless contribution
// weights — what matters is each muscle's value RELATIVE to the others on
// the same action at the same angle. The Muscles tab visualises this as a
// stacked-area normalized to 100% across the joint's ROM.
interface MuscleDef {
    id: string;
    name: string;
    region: string;  // grouping for the "add muscle" dropdown
}

interface MuscleContribution {
    base: number;      // contribution at the worst angle
    peak: number;      // contribution at the peak angle
    angle: number;     // peak angle (degrees)
    steepness?: number; // bell sharpness. 1 = default cosine bell.
                        // >1 narrows the bell (faster transition base↔peak).
                        // <1 widens it (more gradual transition).
                        // Default is 1 for backward compatibility.
}

// --- CROSS-JOINT MODIFICATIONS ---
//
// A Modification is a named rule that scales either a JOINT-ACTION
// CAPACITY or a specific MUSCLE'S CONTRIBUTION to an action, based on
// the current angle of some OTHER joint. The canonical example: when
// the knee is flexed, gastrocnemius is shortened, so its plantar-flexion
// contribution drops and the ankle's total plantar-flexion capacity
// drops. One modification object can apply to multiple targets.
//
// Evaluation: for each evaluateCapacity(...) result for a muscle or
// joint capacity, scan the modifications list, find ones whose target
// matches the current (kind, joint, action, optional muscle), look up
// the source joint's current angle on the SAME side as the target,
// interpolate the modification's curve at that angle, multiply into
// the result. Multiple modifications on the same target multiply.
interface ModificationTarget {
    kind: 'capacity' | 'muscle';
    jointGroup: JointGroup;
    // actionKey form: lowercase camelCase direction name
    // (e.g. 'flexion', 'plantarFlexion').
    actionKey: string;
    // Muscle id — required when kind === 'muscle'.
    muscleId?: string;
    // Max percent CHANGE for THIS target when the curve reads 100%.
    // Lives per-target (not per-modification) so a single modification
    // can drive multiple targets at different magnitudes — e.g. knee-
    // flex shortening can cut gastroc's plantar-flexion share 80% while
    // only cutting the ankle's total PF capacity 60% (since soleus still
    // contributes).
    maxChange: number;
    // Reduce the target's value (multiplier < 1) or increase it
    // (multiplier > 1). Final multiplier at curve Y% is:
    //   reduce:   1 − (Y/100) × (maxChange/100)
    //   increase: 1 + (Y/100) × (maxChange/100)
    direction: 'reduce' | 'increase';
    // Only for kind === 'muscle'. Determines HOW the modifier is applied:
    //
    //   'relative' (default) — scales the muscle's bell WEIGHT before the
    //     section's share-normalization, so shrinking one muscle
    //     proportionally redistributes activation to the OTHER muscles in
    //     the section. Same behaviour as editing the muscle's bell peak
    //     directly in the Muscles tab.
    //
    //   'isolated' — scales the muscle's FINAL activation AFTER share
    //     distribution. Other muscles in the section are unaffected; only
    //     this one's bar moves. Use this when you want the muscle to
    //     "just read lower" without the section's share maths rebalancing.
    //
    // Ignored for capacity targets (which have no share concept).
    muscleMode?: 'isolated' | 'relative';
}

interface CrossJointModification {
    id: string;
    name: string;  // human-readable label shown in the editor
    // Source: the joint action whose CURRENT angle drives the multiplier.
    sourceJoint: JointGroup;
    sourceActionKey: string;
    // Three control points, matching the minimalist resistance-profile
    // style. Left/right X auto-pin to the source action's joint-limit
    // range (min/max); only the middle point's X is user-editable.
    //
    // Y values are DIMENSIONLESS 0–100 — the "percent of max effect"
    // applied at each angle. The actual multiplier comes from combining
    // this curve value with the target's own maxChange + direction, so
    // the same curve shape can be reused across targets with different
    // magnitudes and signs.
    leftY: number;
    midX: number;
    midY: number;
    rightY: number;
    targets: ModificationTarget[];
}

// Interpolate the 3-point curve at a given source angle. Returns the
// curve's Y value (0–100 scale) — per-target direction + maxChange is
// applied by the caller.
const evaluateCurveY = (
    mod: CrossJointModification,
    range: { min: number; max: number },
    sourceAngle: number,
): number => {
    const xMin = range.min;
    const xMax = range.max;
    const xMid = Math.max(xMin, Math.min(xMax, mod.midX));
    if (sourceAngle <= xMin) return mod.leftY;
    if (sourceAngle >= xMax) return mod.rightY;
    if (sourceAngle <= xMid) {
        const span = Math.max(1e-9, xMid - xMin);
        const t = (sourceAngle - xMin) / span;
        return mod.leftY + t * (mod.midY - mod.leftY);
    }
    const span = Math.max(1e-9, xMax - xMid);
    const t = (sourceAngle - xMid) / span;
    return mod.midY + t * (mod.rightY - mod.midY);
};

// Convert a curve Y reading (0–100) into a multiplier for a specific
// target, applying its direction and maxChange.
const applyTargetScaling = (curveY: number, target: ModificationTarget): number => {
    const effect = (curveY / 100) * (target.maxChange / 100);
    return target.direction === 'reduce' ? 1 - effect : 1 + effect;
};

// Outer key: `${JointGroup}.${actionKey(directionName)}`, where directionName
// is either ActionAxis.positiveAction or .negativeAction (each direction is
// its own section because flexors and extensors are different muscles).
// Inner key: muscle id from MUSCLE_CATALOG.
type MuscleAssignmentMap = Record<string, Record<string, MuscleContribution>>;

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
const evaluateCapacity = (cap: CapacityConfig, currentAngle: number, steepness: number = 1): number => {
    // Circular distance — handles both wrapped and unwrapped currentAngle
    // values consistently. Arm at +220° flex (unwrapped) and at −140° flex
    // (wrapped) are the SAME physical position, and both must yield the
    // same distance from a peak angle. Without the mod-360 step, an
    // unwrapped +220 vs peak +100 gives dist=120 (correct), but a wrapped
    // -140 vs +100 gives dist=240 capped to 180 (wrong, muscle reads as
    // fully weak).
    //
    // `steepness` controls how sharply the bell transitions from peak back
    // down to base. Applied as an exponent on the normalized cosine blend:
    //    1   → default cosine bell (gradual, full-width 360°).
    //    > 1 → narrower, more abrupt transition (2 ≈ half-width halved).
    //    < 1 → wider, more gradual transition.
    // The peak (dist=0) and base (dist=180°) are invariant regardless of
    // steepness — only the SHAPE between them changes.
    const diff = currentAngle - cap.angle;
    const modDiff = ((diff % 360) + 360) % 360;
    const dist = Math.min(modDiff, 360 - modDiff);
    const cosBlend = 0.5 + 0.5 * Math.cos(dist * Math.PI / 180);
    const blend = steepness === 1 ? cosBlend : Math.pow(cosBlend, steepness);
    return Math.max(cap.base + (cap.specific - cap.base) * blend, 0.001);
};

// DEFAULT_CAPACITIES — research-grounded peak torques by joint action.
// =============================================================================
//
// Peak angles in DIRECTIONANGLE convention (positive = this section's action
// direction, matching the Muscles tab). Bells pass through evaluateCapacity
// with sectionDirectionAngle applied at the call site — storage and display
// share the same convention.
//
// VALUES are based on published isokinetic/isometric peak torque data
// (population means, adult males, slow velocity, optimal angle): Morrow 2020
// (shoulder), Finley (elbow), Walmsley (hip), Wretenberg + Lindahl 1969
// (knee), Sale 1982 (ankle), Andersson + Smidt (spine). Numbers are
// rounded — relative ratios between joints matter more than absolute Nm.
//
// KEY RATIOS PRESERVED:
//   • Hams / quads ≈ 0.60  (knee flex 135 / knee ext 230)
//   • Ankle PF / DF ≈ 3.3  (plantar 150 / dorsi 45)
//   • Shoulder IR / ER ≈ 1.8 (IR 55 / ER 30)
//   • Elbow flex / ext ≈ 1.1 (90 / 80)
//   • Hip ext / hip flex ≈ 1.7 (240 / 145)
//   • Knee ext ≈ hip ext (230 vs 240)
//   • Upper body << lower body (shoulder flex 75 vs hip flex 145)
//
// PEAK ANGLES chosen for length-tension + moment-arm optima of the dominant
// muscle: glutes at 80° flex (stretched / out-of-hole), quads at 60° flex
// (Lindahl classic), lats at 45° shoulder flex, hams at 60° knee flex,
// soleus/gastroc at 15° dorsi, erectors at 20° flex, etc.
//
// BASES scale as ~40-55% of peak depending on how steep the torque-angle
// curve is for the dominant muscle:
//   • Steep (quads, glutes, soleus): 40-45% of peak at off-optimal.
//   • Moderate (hams, triceps, adductors): 45-50%.
//   • Flat (shoulder rotators, spine, small muscles): 50-55%.
const DEFAULT_CAPACITIES: Record<JointGroup, JointCapacityProfile> = {
    'Shoulder': {
        // Flex peak 75 Nm @ 90° (delt anterior + pec clav at best length).
        // Base 40 (53% of peak — moderate curve).
        'flexion':              createCap(40, 75,  90),
        // Ext peak 100 Nm @ -45° (lats stretched at 45° forward flex).
        // Stronger than flex as expected.
        'extension':            createCap(50, 100, -45),
        // Abd peak 65 Nm @ 90° (lateral delt at T-pose, Inman 1944).
        'abduction':            createCap(35, 65,  90),
        // Add peak 95 Nm @ -90° (adductors stretched at abducted position).
        'adduction':            createCap(45, 95,  -90),
        // HorizAbd peak 85 Nm @ -70° (rear delt + ALL posterior rotator
        // cuff + rhomboids + mid traps + teres major + lats stretched
        // when arm is crossed forward — much more muscle mass than pure
        // frontal-plane abduction, hence 85 > shoulder.abduction 65).
        'horizontalAbduction':  createCap(45, 85,  -70),
        // HorizAdd peak 110 Nm @ -15° (pec sternal slightly behind T-pose,
        // STRETCHED — the bench-press axis). HorizAdd/HorizAbd ≈ 1.29,
        // matching the Tibone / Moore isokinetic-ratio range of 1.2-1.4.
        'horizontalAdduction':  createCap(55, 110, -15),
        // IR peak 55 Nm @ 0° (subscap mid-rotation).
        'internalRotation':     createCap(30, 55,  0),
        // ER peak 30 Nm @ +10° (infraspinatus slightly into ER).
        // IR/ER ratio ≈ 1.8, well-established in throwing athlete research.
        'externalRotation':     createCap(17, 30,  10)
    },
    'Elbow': {
        // Flex peak 90 Nm @ +90° (biceps+brachialis optimal 80-100° flex).
        'flexion':              createCap(45, 90,  90),
        // Ext peak 80 Nm @ -75° (triceps stretched at deep flex).
        // Flex/ext ratio ≈ 1.1, biceps slightly outpull triceps.
        'extension':            createCap(35, 80,  -75)
    },
    'Hip': {
        // Flex peak 145 Nm @ +90° (iliopsoas mid-range).
        'flexion':              createCap(70, 145, 90),
        // Ext peak 240 Nm @ -80° (glutes stretched deep in flexion,
        // bottom-of-squat leverage). Hip ext / hip flex ≈ 1.66.
        'extension':            createCap(95, 240, -80),
        // Abd peak 135 Nm @ +25° (glute med mid-range).
        'abduction':            createCap(65, 135, 25),
        // Add peak 115 Nm @ -45° (adductors stretched at abducted position).
        'adduction':            createCap(55, 115, -45),
        // IR peak 45 Nm. ER peak 50 Nm (ER slightly > IR — hip is opposite
        // of shoulder in this respect, deep-6 rotators + glute max).
        'internalRotation':     createCap(22, 45,  0),
        'externalRotation':     createCap(25, 50,  0)
    },
    'Knee': {
        // Flex peak 135 Nm @ +60° (hamstrings mid-range).
        // Hams/quads ≈ 0.59 — the classic ratio.
        'flexion':              createCap(65, 135, 60),
        // Ext peak 230 Nm @ -60° (Lindahl 1969 — quads stretched at 60°
        // flex). Quads are MASSIVE — ~1.0× hip extension.
        // Steep curve: base 105 is ~46% of peak (quads lose ~55% of torque
        // at full extension).
        'extension':            createCap(105, 230, -60)
    },
    'Ankle': {
        // ROM ±50° (symmetric). Section frames after positiveAction=Plantar:
        // plantarFlexion frame: + = plantar physical, - = dorsi physical.
        // dorsiFlexion frame:   + = dorsi physical,   - = plantar physical.
        //
        // PF peak ~150 Nm at slight dorsi (~10° DF physical = -10° in
        // plantar frame): gastroc/soleus at favorable length-tension
        // (Sale 1982, Maganaris 2001). Base 30 (≈20% of peak) and
        // steepness 2 model the strong active-insufficiency drop at full
        // plantarflexion (+50° in plantar frame) — gastroc shortens to
        // its weakest point. At full dorsi (-50°) the muscle is
        // length-tension favourable so capacity stays higher.
        'plantarFlexion': { base: 30, specific: 150, angle: -10, steepness: 2 },
        // DF peak ~45 Nm at slight plantar (~10° PF physical = -10° in
        // dorsi frame): tib anterior at favorable length. Steepness 2 +
        // base 12 give a strong drop at full dorsiflexion where tib
        // anterior is shortened. PF/DF ≈ 3.3 — ankle plantarflexion is
        // ~3× stronger than dorsiflexion.
        'dorsiFlexion':   { base: 12, specific: 45, angle: -10, steepness: 2 },
    },
    'Scapula': {
        // Scapular capacities are stand-ins for translation forces (scapula
        // moves in offset space, not rotationally). Peak angle = 0 because
        // rawAngle for the clavicle is structurally ~0 in this model — bell
        // shape doesn't matter, only ratios. Research on scapulothoracic
        // peak force is sparse (most literature reports EMG %, not force),
        // so these are derived from resistance-training 1RM anecdotes +
        // muscle PCSA estimates:
        //   • Shrug 1RM: trained lifters 300-500 lb → traps upper + levator
        //     are among the strongest postural muscles → elevation dominates.
        //   • Depression: traps lower + pec minor + lat-via-humerus. Much
        //     weaker in isolation; ~2-3× lower than elevation.
        //   • Protraction: serratus anterior is huge + pec assist. Every
        //     push-up / bench-press is a loaded protraction movement.
        //   • Retraction: traps mid + rhomboids + traps lower assist. Row
        //     loads imply comparable strength to protraction.
        //
        // Ratios preserved:
        //   elevation / depression ≈ 2.3 (realistic asymmetry)
        //   protraction ≈ retraction (both in the row/push axis)
        //   scapular peaks comparable to upper-body shoulder actions
        //     (below lower-body dominants like knee ext 230 / hip ext 240)
        'elevation':            createCap(55, 140, 0),
        'depression':           createCap(25, 60,  0),
        'protraction':          createCap(40, 100, 0),
        'retraction':           createCap(40, 95,  0)
    },
    'Spine': {
        // Spine flex peak 200 Nm @ 0° (abdominals + obliques).
        'flexion':              createCap(90, 200, 0),
        // Spine ext peak 255 Nm @ -20° (erectors stretched at slight flex —
        // out-of-deadlift-bottom). Erectors are among the strongest muscles.
        'extension':            createCap(110, 255, -20),
        // Lateral flex peak 145 Nm (QL + obliques).
        'lateralFlexion':       createCap(65, 145, 0),
        // Rotation peak 90 Nm (obliques dominant).
        'rotation':             createCap(40, 90,  0)
    }
};

// Hardcoded muscle catalog focused on what matters for hypertrophy / strength
// training analysis. Grouped by region for the "add muscle" dropdown.
const MUSCLE_CATALOG: MuscleDef[] = [
    // Chest
    { id: 'pec-clavicular', name: 'Pectoralis Major (Clavicular)', region: 'Chest' },
    { id: 'pec-sternal',    name: 'Pectoralis Major (Sternal)',    region: 'Chest' },
    { id: 'pec-minor',      name: 'Pectoralis Minor',              region: 'Chest' },
    // Shoulders
    { id: 'delt-front', name: 'Anterior Deltoid',  region: 'Shoulders' },
    { id: 'delt-side',  name: 'Lateral Deltoid',   region: 'Shoulders' },
    { id: 'delt-rear',  name: 'Posterior Deltoid', region: 'Shoulders' },
    // Back
    { id: 'lats',              name: 'Latissimus Dorsi',     region: 'Back' },
    { id: 'traps-upper',       name: 'Trapezius (Upper)',    region: 'Back' },
    { id: 'traps-mid',         name: 'Trapezius (Middle)',   region: 'Back' },
    { id: 'traps-lower',       name: 'Trapezius (Lower)',    region: 'Back' },
    { id: 'rhomboids',         name: 'Rhomboids',            region: 'Back' },
    { id: 'teres-major',       name: 'Teres Major',          region: 'Back' },
    { id: 'teres-minor',       name: 'Teres Minor',          region: 'Back' },
    { id: 'infraspinatus',     name: 'Infraspinatus',        region: 'Back' },
    { id: 'supraspinatus',     name: 'Supraspinatus',        region: 'Back' },
    { id: 'subscapularis',     name: 'Subscapularis',        region: 'Back' },
    { id: 'serratus-anterior', name: 'Serratus Anterior',    region: 'Back' },
    { id: 'levator-scapulae',  name: 'Levator Scapulae',     region: 'Back' },
    // Arms
    // Biceps heads and triceps lateral/medial are merged because the two
    // biceps heads act together functionally (both cross shoulder + elbow
    // the same way, differ only in relative magnitude of shoulder flexion
    // contribution), and triceps lateral + medial are both monoarticular
    // elbow extensors with essentially identical role — only triceps long
    // gets a separate entry because it's biarticular (crosses shoulder).
    { id: 'biceps-brachii',         name: 'Biceps Brachii',                          region: 'Arms' },
    { id: 'brachialis',             name: 'Brachialis',                              region: 'Arms' },
    { id: 'brachioradialis',        name: 'Brachioradialis',                         region: 'Arms' },
    { id: 'triceps-long',           name: 'Triceps Brachii (Long Head)',             region: 'Arms' },
    { id: 'triceps-lateral-medial', name: 'Triceps Brachii (Lateral + Medial Head)', region: 'Arms' },
    // Core
    { id: 'rectus-abdominis',  name: 'Rectus Abdominis',   region: 'Core' },
    { id: 'obliques-external', name: 'External Obliques',  region: 'Core' },
    { id: 'obliques-internal', name: 'Internal Obliques',  region: 'Core' },
    { id: 'erector-spinae',    name: 'Erector Spinae',     region: 'Core' },
    { id: 'quadratus-lumborum',name: 'Quadratus Lumborum', region: 'Core' },
    // Hips
    { id: 'glute-max',  name: 'Gluteus Maximus',     region: 'Hips' },
    { id: 'glute-med',  name: 'Gluteus Medius',      region: 'Hips' },
    { id: 'glute-min',  name: 'Gluteus Minimus',     region: 'Hips' },
    { id: 'iliopsoas',  name: 'Iliopsoas',           region: 'Hips' },
    { id: 'tfl',        name: 'Tensor Fasciae Latae',region: 'Hips' },
    { id: 'sartorius',  name: 'Sartorius',           region: 'Hips' },
    // Adductors
    // Two functionally distinct portions with different innervations:
    //   Anterior  (obturator nerve): the classic adductor portion — pure hip
    //             adductor, slight flexion assist when hip is extended.
    //   Posterior (sciatic / tibial part): the \"ischiocondylar\" / \"hamstring
    //             portion\" — major hip extensor in deep flexion (squat-out-of-
    //             the-hole), plus minor adduction and ER contributions. Inserts
    //             on the adductor tubercle of the femur, so monoarticular at
    //             the hip (does NOT cross the knee despite the hamstring moniker).
    // Classic adductor group collapsed into one entry — adductor longus,
    // brevis, gracilis, pectineus, and magnus ANTERIOR head all share the
    // pure-hip-adduction role with only minor timing differences. Adductor
    // magnus POSTERIOR head stays separate because it's functionally a
    // hip extensor (ischiocondylar / "hamstring portion"), not an adductor.
    // Adductor contribution to knee flexion (gracilis) is intentionally
    // dropped — its knee moment arm is insignificant vs. the actual knee
    // flexors and shouldn't show up in that graph.
    { id: 'adductors',                 name: 'Adductors',                   region: 'Adductors' },
    { id: 'adductor-magnus-posterior', name: 'Adductor Magnus (Posterior)', region: 'Adductors' },
    // Quads
    // Three vasti collapsed — they all cross only the knee and all extend
    // it with essentially identical function. Rectus femoris stays separate
    // because it's biarticular (hip flexor + knee extensor).
    { id: 'rectus-femoris', name: 'Rectus Femoris', region: 'Quads' },
    { id: 'quads-vasti',    name: 'Quads (Vasti)',  region: 'Quads' },
    // Hamstrings
    // Biarticular hamstrings collapsed — biceps femoris long head,
    // semitendinosus, and semimembranosus all cross hip + knee with
    // essentially identical function (hip extend + knee flex). Biceps
    // femoris SHORT head stays separate because it's monoarticular
    // (knee flexor only, doesn't cross hip).
    { id: 'hamstrings-biarticular', name: 'Hamstrings (Biarticular)',    region: 'Hamstrings' },
    { id: 'biceps-femoris-short',   name: 'Biceps Femoris (Short Head)', region: 'Hamstrings' },
    // Calves
    { id: 'gastrocnemius',     name: 'Gastrocnemius',     region: 'Calves' },
    { id: 'soleus',            name: 'Soleus',            region: 'Calves' },
    { id: 'tibialis-anterior', name: 'Tibialis Anterior', region: 'Calves' },
];

// Default muscle assignments per joint action. Numbers are dimensionless
// contribution weights — only their RATIO at a given angle matters. The
// defaults below encode EMG / kinesiology consensus (Neumann, Kendall,
// McGill) for which muscles drive which actions and where in the ROM each
// peaks. Easy to tweak in the UI.
//
// Section key format: `${JointGroup}.${actionKey(directionName)}` —
// directionName is positiveAction OR negativeAction from JOINT_ACTIONS.
//
// PEAK-ANGLE CONVENTION
// ---------------------
// `angle` is a DIRECTION-ANGLE in this section's frame of reference:
//
//   + angle = peak at N° IN this section's action direction
//             (e.g. peak at +60 in Knee.flexion = peak at 60° of flexion;
//              peak at +90 in Shoulder.abduction = peak at 90° abducted).
//
//   − angle = peak at N° in the OPPOSITE direction. This is how muscles
//             that act as a given joint action but peak in the stretched
//             position are represented: e.g. glute max in Hip.extension
//             with angle = −60 means "peak at 60° of hip flexion," which
//             is the stretched glute position where it fires hardest.
//
//   0 = peak at neutral. Horizontal ab/ad and all Scapula sections have
//       structurally-zero rawAngle, so `angle = 0` just means "full
//       weight" and ratios between muscles are what matters.
//
// The sign convention is stable across joints: sliders, peak values, and
// the graph x-axis all use the same "+ = more of this section's action"
// direction. distributeMuscleLoadForFrame handles the sign correction
// between rawAngle (which has axis-dependent sign) and directionAngle.
//
// PEAK vs BASE:
//   `peak` is the contribution at `angle`; `base` is 180° away. Cosine
//   bell between them. Normally peak > base (muscle strong at the peak
//   angle, weaker at the opposite extreme). Peak < base is legal and
//   represents "generally active at `base`, but DIPS at `angle`" — useful
//   for muscles that lose leverage or go slack at one end of the ROM.
//
// LENGTH-TENSION vs FUNCTIONAL ACTIVATION:
//   Peak force capacity is usually at the stretched position (length-
//   tension). Functional activation (EMG) often peaks where the muscle
//   actually does most of the work. These can disagree. The defaults
//   pick whichever better represents the muscle's share of the load in
//   typical strength-training contexts — e.g. iliopsoas peaks deep in
//   hip flexion (angle = +90) because other flexors have faded out there,
//   even though its raw force capacity is higher at the stretched (hip-
//   extended) position.
//
// SCAPULOHUMERAL RHYTHM:
//   We don't have scapular rotations as shoulder-action DOFs, so muscles
//   whose scapular role assists a humeral action via S/H rhythm (lower +
//   upper traps and serratus anterior for overhead motion) show up in the
//   relevant shoulder sections as small contributions peaking near full
//   elevation (angle = +150).
const m = (base: number, peak: number, angle: number, steepness: number = 1): MuscleContribution => ({ base, peak, angle, steepness });

// Default per-section activation scale. Computed as max(Σ bells) across
// each action's effective angle range — makes primary muscles (bell peaks
// at 1.0) read 100% MVC when the action's raw effort = 1.0, with
// secondaries reading their own target fractions (0.8 for 80%-tier,
// 0.5 for 50%-tier, etc.). Paired with the Option-B muscle auto-
// normalization in timeline analysis (scales by 1/max_action_effort),
// this yields "primary reads 100% at the scene's 1RM moment" regardless
// of absolute force magnitude. User can still override per-section via
// the Scale input in the Muscles tab.
const DEFAULT_SECTION_SCALES: Record<string, number> = {
    // Bells in DEFAULT_MUSCLE_ASSIGNMENTS were calibrated by
    // /tmp/calibrate_capped.py with per-muscle k_M clipped to [0.5, 2.0]
    // so that, after multiplying by these section scales, each muscle's
    // max activation across the spec'd ROM equals its target %. The
    // calibration converged to 0.0pp deviation in 30 of 32 sections.
    //
    // Two sections have residual rhomboids overshoots
    // (Shoulder.extension and Shoulder.horizontalAbduction) — rhomboids'
    // bell shape gives it a max-share larger than its 0.5 target ratio
    // implies even at the k=0.5 cap. Resolving fully would require
    // narrowing rhomboids' bell (steepness or base reduction) — left
    // as-is per user preference to preserve curve shapes.
    //
    // Re-run /tmp/calibrate_capped.py if any bell shape changes.

    // Scapula.
    'Scapula.elevation':             3.1,
    'Scapula.depression':            3.5,
    'Scapula.protraction':           2.8,
    'Scapula.retraction':            3.1,
    // Shoulder.
    'Shoulder.flexion':              2.2936,
    'Shoulder.extension':            3.0167,
    'Shoulder.abduction':            2.4350,
    'Shoulder.adduction':            3.0314,
    'Shoulder.horizontalAbduction':  2.8018,
    'Shoulder.horizontalAdduction':  3.1645,
    'Shoulder.externalRotation':     2.7838,
    'Shoulder.internalRotation':     5.5471,
    // Elbow.
    'Elbow.flexion':                 2.4757,
    'Elbow.extension':               1.5187,
    // Spine.
    'Spine.flexion':                 3.1,
    'Spine.extension':               1.4,
    'Spine.lateralFlexionL':         4.7,
    'Spine.lateralFlexionR':         4.7,
    'Spine.rotationL':               3.0,
    'Spine.rotationR':               3.0,
    // Hip.
    'Hip.flexion':                   2.5303,
    'Hip.extension':                 2.3477,
    'Hip.abduction':                 3.6597,
    'Hip.adduction':                 1.9018,
    'Hip.horizontalAbduction':       2.7831,
    'Hip.horizontalAdduction':       1.642,
    'Hip.externalRotation':          4.7678,
    'Hip.internalRotation':          3.9709,
    // Knee.
    'Knee.flexion':                  2.3927,
    'Knee.extension':                1.4693,
    // Ankle.
    'Ankle.dorsiFlexion':            1.0,
    'Ankle.plantarFlexion':          1.597,
};

// Default cross-joint modifications — user-editable in the Modifications tab.
// Ships with the classic length-tension example: gastrocnemius shortening at
// knee flex reduces its plantar-flexion contribution AND the ankle's total
// plantar-flexion capacity. Soleus stays unaffected (monoarticular), so the
// capacity drop is gentler than the gastroc-contribution drop.
const DEFAULT_MODIFICATIONS: CrossJointModification[] = [
    {
        id: 'gastroc-shortening-at-knee-flex',
        name: 'Gastroc shortening at knee flex',
        sourceJoint: 'Knee',
        sourceActionKey: 'flexion',
        // Curve: 0% of max effect at knee-straight, scales up through 69%
        // at ~90° flex, 100% at full flex. Dimensionless; per-target
        // maxChange below turns it into a real multiplier.
        leftY: 0,
        midX: 90,
        midY: 69,
        rightY: 100,
        targets: [
            // Gastroc's plantar-flexion share drops hard (up to 80% cut)
            // as it shortens at the knee. Multiplier at full flex: 0.2.
            // 'relative' — soleus picks up the slack in the share balance.
            { kind: 'muscle', jointGroup: 'Ankle', actionKey: 'plantarFlexion', muscleId: 'gastrocnemius', maxChange: 80, direction: 'reduce', muscleMode: 'relative' },
            // Joint capacity for ankle PF drops more gently (up to 50%)
            // — soleus is monoarticular and keeps contributing.
            { kind: 'capacity', jointGroup: 'Ankle', actionKey: 'plantarFlexion', maxChange: 50, direction: 'reduce' },
        ],
    },
    {
        id: 'rf-shortening-at-hip-flex',
        name: 'Rectus femoris shortening at hip flex',
        sourceJoint: 'Hip',
        sourceActionKey: 'flexion',
        // 0% effect at hip extension (RF stretched at proximal end),
        // ramping up to 100% at full hip flex (RF shortened → active
        // insufficiency at the knee).
        leftY: 0,
        midX: 60,
        midY: 50,
        rightY: 100,
        targets: [
            // RF's share of knee extension drops up to 50% — vasti pick
            // up the slack in the distribution.
            { kind: 'muscle', jointGroup: 'Knee', actionKey: 'extension', muscleId: 'rectus-femoris', maxChange: 50, direction: 'reduce', muscleMode: 'relative' },
            // Total knee-extension capacity drops only ~15% — vasti are
            // monoarticular and keep working at full strength.
            { kind: 'capacity', jointGroup: 'Knee', actionKey: 'extension', maxChange: 15, direction: 'reduce' },
        ],
    },
    {
        id: 'hams-shortening-at-knee-flex',
        name: 'Hamstrings shortening at knee flex',
        sourceJoint: 'Knee',
        sourceActionKey: 'flexion',
        // 0% effect at knee-straight (hams at full length for hip ext),
        // ramping up to 100% at full knee flex (hams shortened at knee
        // end → active insufficiency at the hip).
        leftY: 0,
        midX: 70,
        midY: 50,
        rightY: 100,
        targets: [
            // Hams' share of hip extension drops up to 60% — glute max
            // and adductor-magnus-posterior pick up the slack.
            { kind: 'muscle', jointGroup: 'Hip', actionKey: 'extension', muscleId: 'hamstrings-biarticular', maxChange: 60, direction: 'reduce', muscleMode: 'relative' },
            // Total hip-extension capacity drops ~25% — hams were a
            // significant contributor, glutes and magnus posterior can
            // only partially compensate.
            { kind: 'capacity', jointGroup: 'Hip', actionKey: 'extension', maxChange: 25, direction: 'reduce' },
        ],
    },
    {
        id: 'hams-stretched-at-hip-flex',
        name: 'Hamstrings stretched at hip flex',
        sourceJoint: 'Hip',
        sourceActionKey: 'flexion',
        // 0% effect at hip extension (hams at neutral length), ramping
        // up to 100% at full hip flex (hams lengthened at hip end →
        // length-tension boost for knee flexion).
        leftY: 0,
        midX: 60,
        midY: 50,
        rightY: 100,
        targets: [
            // Hams' share of knee flexion increases up to 30% — BF
            // short head and gastroc see their share redistribute down.
            { kind: 'muscle', jointGroup: 'Knee', actionKey: 'flexion', muscleId: 'hamstrings-biarticular', maxChange: 30, direction: 'increase', muscleMode: 'relative' },
            // Total knee-flexion capacity increases ~15% — hams are a
            // primary knee flexor, so their length-tension benefit
            // propagates to the joint as a whole.
            { kind: 'capacity', jointGroup: 'Knee', actionKey: 'flexion', maxChange: 15, direction: 'increase' },
        ],
    },
    {
        id: 'biceps-shortening-at-shoulder-flex',
        name: 'Biceps shortening at shoulder flex',
        sourceJoint: 'Shoulder',
        sourceActionKey: 'flexion',
        // 0% effect at shoulder-at-side or extended (biceps at full
        // length), ramping to 100% at shoulder fully flexed overhead
        // (biceps shortened at the proximal end → active insufficiency
        // at the elbow). Preacher-curl-style positions.
        leftY: 0,
        midX: 90,
        midY: 50,
        rightY: 100,
        targets: [
            // Biceps' share of elbow flexion drops up to 40% — brachialis
            // and brachioradialis absorb the slack.
            { kind: 'muscle', jointGroup: 'Elbow', actionKey: 'flexion', muscleId: 'biceps-brachii', maxChange: 40, direction: 'reduce', muscleMode: 'relative' },
            // Total elbow-flexion capacity drops ~12% — brachialis is
            // the main flexor anyway, so the joint-level hit is smaller
            // than the bicep-specific share change.
            { kind: 'capacity', jointGroup: 'Elbow', actionKey: 'flexion', maxChange: 12, direction: 'reduce' },
        ],
    },
    {
        id: 'front-delt-share-at-shoulder-ir',
        name: 'Anterior deltoid share of abduction at shoulder IR',
        sourceJoint: 'Shoulder',
        sourceActionKey: 'externalRotation',
        // ER source range is -90° (full IR) to +90° (full ER). Curve
        // peaks at the LEFT (full IR), drops through the midpoint at
        // -10° (slight IR — front delt is already losing alignment
        // before neutral), and stays 0 through neutral and the ER side.
        // Rationale: as the humerus internally rotates, the anterior
        // deltoid's line of pull rolls inward and becomes less aligned
        // with the abduction moment axis, so its mechanical share of
        // abduction shrinks; middle/rear delt and supraspinatus pick up
        // the slack.
        leftY: 100,
        midX: -10,
        midY: 0,
        rightY: 0,
        targets: [
            // Front delt's share of shoulder abduction reduces up to 50%
            // at full IR. 'relative' means middle delt, rear delt, and
            // supraspinatus pick up the slack (joint's total abduction
            // capacity unchanged — pure redistribution).
            { kind: 'muscle', jointGroup: 'Shoulder', actionKey: 'abduction', muscleId: 'delt-front', maxChange: 50, direction: 'reduce', muscleMode: 'relative' },
        ],
    },
];

const DEFAULT_MUSCLE_ASSIGNMENTS: MuscleAssignmentMap = {
    // =========================================================================
    // SHOULDER
    // =========================================================================
    // Angle conventions (directionAngle, post-actionSign):
    //   Flexion section: 0=arm-at-side, +90=forward horizontal, +180=overhead
    //     via flex, negative=extended behind body.
    //   Extension section: 0=arm-at-side, +30=behind body (limit), negative=
    //     arm flexed forward (so peak at -90 means muscle is most active when
    //     arm is 90° flexed forward and extension demand pulls it back down).
    //   Abduction: 0=side, +90=T-pose, +180=overhead via abd.
    //   Adduction: 0=side, -90=T-pose, -180=overhead via abd, +90=cross-body.
    //   HorizontalAdduction: 0=T-pose, +90=arm forward, +135+=cross-body.
    //   HorizontalAbduction: 0=T-pose, +90=arm pulled behind body, negative=
    //     arm in front.

    // NOTE: these defaults were captured from the in-app Muscles tab after
    // the user hand-tuned each curve. Values with an explicit steepness
    // argument have a non-default (non-1) bell sharpness; bells without it
    // default to the standard cosine shape. To re-tune, edit here or edit
    // in the app and re-capture.

    // Bells calibrated by /tmp/calibrate_capped.py with per-muscle k_M
    // clipped to [0.5, 2.0]. Each muscle's max activation across the
    // spec'd ROM equals its target % when section scale below is applied.
    // Cap on k preserves bell shapes — no extreme magnification or
    // narrowing outside the ROM. Two sections (Shoulder.extension and
    // Shoulder.horizontalAbduction) have residual rhomboids overshoots
    // because rhomboids' bell shape gives it a max-share larger than
    // its target ratio implies even at k=0.5 — those would need bell-
    // shape changes to fully resolve.

    'Shoulder.flexion': {
        // Spec ROM: -60° to 180°. delt-front mid-ROM contribution lifted
        // ~30% by raising inverted-bell dip parameter (raw 0.439 → 0.57);
        // peaks at -60° / 180° unchanged (raw base = 1.024). delt-side
        // overall reduced 20% (target 0.6 → 0.48).
        'delt-front':        m(0.7469, 0.4157, 30, 1.15),
        'pec-clavicular':    m(0, 0.8066, 37, 2),
        'delt-side':         m(0.14, 0.6998, 120, 2),
        'traps-lower':       m(-0.1366, 0.8719, 140, 2.2),
        'serratus-anterior': m(-0.1556, 0.8725, 140, 2.2),
        // Pec-sternal helps pull arm forward only at deep extension —
        // drops near 0 by +10° flex (steepness 6 narrow bell at -45°).
        'pec-sternal':       m(0, 0.3853, -45, 6),
        'biceps-brachii':    m(0.1005, 0.3436, 60, 1.6),
    },
    'Shoulder.extension': {
        // Spec ROM: -180° to 60°. delt-rear and rhomboids bell bases
        // raised (delt-rear 0.643 → 0.9, rhomboids 0.222 → 0.36) so each
        // bell is much flatter across the ROM — less volatile activation.
        // RESIDUAL: rhomboids still overshoots target 50% (reaches ~91%)
        // because of bell-shape vs. share-distribution dynamics.
        'lats':         m(-1.66, 2.0, -67, 1.05),
        'teres-major':  m(-0.442, 2.0, -60, 1.7),
        'delt-rear':    m(0.45, 0.5, -20, 2.95),
        'pec-sternal':  m(-0.0895, 0.6484, -169, 3.35),
        'triceps-long': m(-0.112, 1.6, -86, 2.6),
        'rhomboids':    m(0.18, 0.25, -60, 1),
    },
    'Shoulder.abduction': {
        // Spec ROM: 0° to 180°. delt-front now co-equal primary at 100%
        // (target raised 0.9 → 1.0); base lifted ~3× so contribution
        // stays meaningful through low-abduction angles.
        'delt-side':         m(0.2971, 0.7579, 72, 2.75),
        'supraspinatus':     m(0.1175, 0.549, 15, 2.2),
        'delt-front':        m(0.3198, 0.969, 180, 1.9),
        'traps-lower':       m(-0.0602, 0.8206, 130, 3.2),
        'serratus-anterior': m(-0.0615, 0.8206, 130, 3.2),
        'biceps-brachii':    m(-0.0358, 0.2652, 120, 2),
    },
    'Shoulder.adduction': {
        // Spec ROM: -180° to 0°.
        'lats':         m(-0.1472, 1.5824, -81, 2.5),
        'teres-major':  m(-0.0818, 1.3091, -80, 1.6),
        'triceps-long': m(0.0257, 1.0802, -107, 2.2),
        'pec-sternal':  m(0.4371, 0.2792, -35, 5),     // inverted bell preserved
        'delt-rear':    m(0.0539, 0.5136, -120, 1.8),
        'rhomboids':    m(0.1055, 0.3057, -75, 1.45),
    },
    'Shoulder.horizontalAdduction': {
        // Spec ROM: -45° to 135°.
        'pec-sternal':       m(0.1256, 0.7434, 70, 1.5),
        'delt-front':        m(0.0288, 1.1255, 56, 2.6),
        'pec-clavicular':    m(-0.0486, 0.6797, 40, 2),
        'serratus-anterior': m(0, 0.5705, 60, 1.8),
        'pec-minor':         m(0.0827, 0.4135, 60, 2),
        'biceps-brachii':    m(-0.0153, 0.4695, 60, 1.8),
    },
    'Shoulder.horizontalAbduction': {
        // Spec ROM: -135° to 45°. lats max reduced 0.5 → 0.3 per spec.
        // RESIDUAL: rhomboids overshoots target 50% (clamps to 100%) —
        // bell-shape-vs-share-distribution issue, unchanged.
        'delt-rear':     m(0.0564, 1.3425, 15, 1.8),
        'infraspinatus': m(-0.122, 2.0, 0, 2),
        'teres-minor':   m(-0.142, 2.0, 0, 2),
        'rhomboids':     m(0.0905, 0.25, 25, 2.5),
        'lats':          m(-0.06, 0.6, 30, 2),
    },
    'Shoulder.internalRotation': {
        // Spec ROM: -90° to 90°.
        'subscapularis':  m(0.2572, 0.8992, 15, 1.5),
        'pec-sternal':    m(0.178, 1.0411, 0, 1.3),
        'lats':           m(0.1789, 0.9516, -5, 1.3),
        'teres-major':    m(0.1896, 1.0246, 0, 1.3),
        'delt-front':     m(0.1431, 0.7532, 15, 1.4),
        'pec-clavicular': m(0.1428, 0.8591, 0, 1.4),
        'biceps-brachii': m(0.0677, 0.5417, 0, 1.5),
    },
    'Shoulder.externalRotation': {
        // Spec ROM: -90° to 90°.
        'infraspinatus': m(0.2329, 0.9786, 10, 1.5),
        'teres-minor':   m(0.1997, 1.0191, 10, 1.5),
        'delt-rear':     m(0.0986, 0.5743, 0, 1.4),
        'supraspinatus': m(0.0419, 0.4191, 0, 1.6),
    },

    // =========================================================================
    // ELBOW
    // =========================================================================
    // Convention: Elbow.flexion section directionAngle goes 0 (straight) to
    // +~160 (full flex). Peak at LOW section angle = muscle strong when elbow
    // open; peak at HIGH section angle = muscle strong when elbow bent.
    // Elbow.extension section goes 0 (straight) to -~160 (full flex). Peak
    // at negative = muscle strong when elbow bent (stretched).

    'Elbow.flexion': {
        // Spec ROM: 0° to 145°.
        'biceps-brachii':  m(0.23, 1.0266, 45, 1.5),
        'brachialis':      m(0.5115, 1.023, 90, 0.85),
        'brachioradialis': m(0.0505, 0.9522, 120, 0.55),
    },
    'Elbow.extension': {
        // Spec ROM: -145° to 0°.
        'triceps-long':           m(-0.0403, 1.3432, -100, 1.4),
        'triceps-lateral-medial': m(0.4653, 0.7445, -53, 0.85),
    },

    // =========================================================================
    // HIP
    // =========================================================================
    // Flexion: 0=standing, +90=thigh forward horizontal, +180=full flex.
    // Extension: 0=standing, +30=extended behind, negative=hip flexed.
    // Abduction: 0=standing, +45-+90=leg out.
    // Adduction: 0=standing, -30-ish=leg abducted.

    'Hip.flexion': {
        // Spec ROM: -20° to 120°.
        'iliopsoas':      m(0.1029, 0.8232, 100, 2.2),
        'rectus-femoris': m(0.1167, 1.1668, 30, 2),
        'tfl':            m(0.0542, 0.7742, 15, 1.7),
        'sartorius':      m(0.1377, 0.8607, 60, 1.4),
    },
    'Hip.extension': {
        // Spec ROM: -120° to 20°. Hamstrings still peak at -65°
        // (longest length, most extension load).
        'glute-max':                 m(0.3406, 0.9279, -15, 4),
        'hamstrings-biarticular':    m(0.1545, 1.545, -65, 2.5),
        'adductor-magnus-posterior': m(-0.1476, 1.2195, -100, 1.5),
        'glute-med':                 m(0.121, 0.3025, 0, 1),
        'glute-min':                 m(0.0908, 0.2269, 0, 1),
    },
    'Hip.abduction': {
        // Spec ROM: -30° to 45°.
        'glute-med': m(0.1658, 1.0363, 30, 1.5),
        'glute-min': m(0.1761, 1.036, 30, 1.5),
        'tfl':       m(0.1321, 0.7945, 15, 1.6),
        'glute-max': m(0.1036, 0.6217, 30, 1.5),
        'sartorius': m(0.038, 0.4526, 0, 1.8),
    },
    'Hip.adduction': {
        // Spec ROM: -45° to 30°.
        'adductors':                 m(0.1163, 0.9774, -16, 1.4),
        'adductor-magnus-posterior': m(0.1596, 1.0231, -30, 1.5),
    },
    'Hip.horizontalAbduction': {
        // Spec ROM: -30° to 45°.
        'glute-med': m(0.1135, 0.9954, 0, 1.4),
        'glute-min': m(0.1077, 1.0065, 0, 1.5),
        'glute-max': m(0.0221, 0.4026, 0, 1.6),
        'tfl':       m(0.0516, 0.3967, 0, 1.4),
    },
    'Hip.horizontalAdduction': {
        // Spec ROM: -45° to 30°.
        'adductors':                 m(0.1222, 1.0581, 42, 1.4),
        'adductor-magnus-posterior': m(0.0785, 0.6702, 30, 1.5),
    },
    'Hip.externalRotation': {
        // Spec ROM: -35° to 45°.
        'glute-max':                 m(0.2248, 0.9731, 0, 1.2),
        'glute-med':                 m(0.18, 1.0055, 0, 1.4),
        'sartorius':                 m(0.1287, 0.8044, 0, 1.4),
        'adductor-magnus-posterior': m(0.1508, 0.8044, 0, 1.5),
        'biceps-femoris-short':      m(0.1005, 0.6033, 0, 1.5),
        'glute-min':                 m(0.1005, 0.6033, 0, 1.4),
    },
    'Hip.internalRotation': {
        // Spec ROM: -45° to 35°.
        'tfl':                    m(0.1284, 0.9952, 0, 1.4),
        'glute-min':              m(0.1177, 0.9978, 0, 1.4),
        'glute-med':              m(0.1274, 0.9954, 0, 1.4),
        'adductors':              m(0.0483, 0.6035, 0, 1.5),
        'hamstrings-biarticular': m(0, 0.4023, 0, 1.6),
    },

    // =========================================================================
    // KNEE
    // =========================================================================
    // Knee.flexion: 0=straight, +160=full flex. (Knee uses actionSign=-1
    // which inverts rawAngle's positive=flexion convention into the correct
    // section-positive=more-action direction.)
    // Knee.extension: 0=straight, -160=full flex (stretched quads).

    'Knee.flexion': {
        // Spec ROM: 0° to 140°.
        'hamstrings-biarticular': m(0.0845, 0.7824, 70, 1.4),
        'biceps-femoris-short':   m(0.3706, 1.1439, 11, 1.5),
        'gastrocnemius':          m(0.0302, 0.8461, 15, 4.15),
        'sartorius':              m(0.0351, 0.4622, 60, 1.6),
    },
    'Knee.extension': {
        // Spec ROM: -140° to 0°.
        'quads-vasti':    m(0.1099, 0.6872, -120, 0.25),
        'rectus-femoris': m(0.243, 1.4931, -180, 0.25),
    },

    // =========================================================================
    // ANKLE
    // =========================================================================

    'Ankle.dorsiFlexion': {
        // Spec ROM: -50° to 50° (symmetric).
        'tibialis-anterior': m(0.381, 1, 10, 1),
    },
    'Ankle.plantarFlexion': {
        // Spec ROM: -50° to 50° (symmetric). Steepness 5 → 2.5 broadens
        // bells so neither muscle dominates as extremely at its peak
        // angle. Gastroc base raised so it still contributes meaningfully
        // at deep plantar instead of dropping to near-zero. Length-tension
        // bias preserved (gastroc favours dorsi side, soleus more central)
        // but less sharply expressed.
        'gastrocnemius': m(0.2123, 1.1042, -30, 2.5),
        'soleus':        m(0.2826, 0.9418, 8, 2.5),
    },

    // =========================================================================
    // SPINE
    // =========================================================================
    // Spine section angles come out near zero structurally (spine bone is
    // passive), so peak angle = 0 gives full weight and ratios matter.

    'Spine.flexion': {
        // Calibration range: -30° to 80°.
        'rectus-abdominis':  m(0.348, 1.0, 0, 1),
        'obliques-external': m(0.267, 0.8, 0, 1),
        'obliques-internal': m(0.267, 0.8, 0, 1),
        'iliopsoas':         m(0.2, 0.5, 0, 1),
    },
    'Spine.extension': {
        // Calibration range: -80° to 30°.
        // Per user spec: 100% erector-spinae; 40% quadratus-lumborum.
        // The broader "assists" (traps, glutes) that used to live here
        // were routing spinal-extension demand to muscles that don't
        // actually spinal-extend, inflating their activation in hip-
        // hinge exercises — removed.
        'erector-spinae':     m(0.37, 1.0, 0, 1),
        'quadratus-lumborum': m(0.16, 0.4, 0, 1),         // peak 0.175→0.4 per spec
    },
    'Spine.lateralFlexionL': {
        // Calibration range: -35° to 35°.
        'obliques-external':  m(0.353, 1.0, 0, 1),
        'obliques-internal':  m(0.353, 1.0, 0, 1),
        'quadratus-lumborum': m(0.353, 1.0, 0, 1),
        'erector-spinae':     m(0.269, 0.7, 0, 1),
        'rectus-abdominis':   m(0.2, 0.5, 0, 1),
        'lats':               m(0.227, 0.5, 0, 1),
    },
    'Spine.lateralFlexionR': {
        // Calibration range: -35° to 35°.
        'obliques-external':  m(0.353, 1.0, 0, 1),
        'obliques-internal':  m(0.353, 1.0, 0, 1),
        'quadratus-lumborum': m(0.353, 1.0, 0, 1),
        'erector-spinae':     m(0.269, 0.7, 0, 1),
        'rectus-abdominis':   m(0.2, 0.5, 0, 1),
        'lats':               m(0.227, 0.5, 0, 1),
    },
    'Spine.rotationL': {
        // Calibration range: -45° to 45°.
        'obliques-external': m(0.333, 1.0, 0, 1),  // contralateral rotates trunk
        'obliques-internal': m(0.353, 1.0, 0, 1),  // ipsilateral rotates trunk
        'erector-spinae':    m(0.2, 0.6, 0, 1),
        'lats':              m(0.133, 0.4, 0, 1),
    },
    'Spine.rotationR': {
        // Calibration range: -45° to 45°.
        'obliques-external': m(0.333, 1.0, 0, 1),
        'obliques-internal': m(0.353, 1.0, 0, 1),
        'erector-spinae':    m(0.2, 0.6, 0, 1),
        'lats':              m(0.133, 0.4, 0, 1),
    },

    // =========================================================================
    // SCAPULA
    // =========================================================================
    // Scapula rawAngle also always ~0 in this model; ratios set relative
    // contributions.

    'Scapula.elevation': {
        // Scapula angles ≈ 0 structurally; effective peak = declared peak.
        'traps-upper':      m(0.44, 1.0, 0, 1),
        'levator-scapulae': m(0.42, 1.0, 0, 1),
        'rhomboids':        m(0.29, 0.7, 0, 1),
        'traps-mid':        m(0.19, 0.4, 0, 1),
    },
    'Scapula.depression': {
        'traps-lower':       m(0.39, 1.0, 0, 1),
        'pec-minor':         m(0.38, 1.0, 0, 1),
        'lats':              m(0.25, 0.7, 0, 1),
        'pec-sternal':       m(0.2, 0.5, 0, 1),
        'serratus-anterior': m(0.13, 0.3, 0, 1),
    },
    'Scapula.protraction': {
        'serratus-anterior': m(0.41, 1.0, 0, 1),
        'pec-minor':         m(0.31, 0.8, 0, 1),
        'pec-sternal':       m(0.2, 0.5, 0, 1),
        'pec-clavicular':    m(0.2, 0.5, 0, 1),      // NEW — per user spec
    },
    'Scapula.retraction': {
        // Per user spec: 100% rhomboids + traps-mid; 80% traps-upper;
        // 30% traps-lower.
        'traps-mid':   m(0.39, 1.0, 0, 1),
        'rhomboids':   m(0.36, 1.0, 0, 1),
        'traps-upper': m(0.32, 0.8, 0, 1),                // peak 0.5→0.8 per spec
        'traps-lower': m(0.12, 0.3, 0, 1),                // peak 0.8→0.3 per spec
    },
};

// Stable color per muscle id — hashes id → HSL hue. Saturation/lightness
// fixed so the stacked-area legend stays visually coherent.
const muscleColor = (id: string): string => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360}, 62%, 58%)`;
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
    // Scapula.dir.y: negative = elevation, positive = depression.
    //   Elevation  limit (min) reduced  −15 → −12 (less shrug overhead).
    //   Depression limit (max) reduced  +10 →  +4 (depression ROM is
    //     anatomically small; +10 was way too much).
    'Scapula.dir.y': { min: -12, max: 4 },
    // Scapula.dir.z: negative = retraction, positive = protraction.
    // Symmetric ±10 ROM.
    'Scapula.dir.z': {
        min: -10, max: 10,
        // "Retraction limit increases slightly as the scapula elevates."
        // Elevation = dir.y decreasing (more negative). dir.z.min is the
        // retraction stop; we want it to decrease (more retraction) as y
        // decreases. effective.min = min + slopeMin * source.currentValue
        //   y =   0  →  eff.min = -10
        //   y = -12  →  eff.min = -10 + 0.5 * -12 = -16 (6 more retraction)
        coupling: { dependsOn: 'Scapula.dir.y', slopeMin: 0.5, slopeMax: 0 },
    },

    // --- Shoulder (humerus unit direction, right-normalized) ---
    // Right arm at rest is (0, 1, 0). MUTUAL COUPLING between x and y keeps
    // the humerus out of anatomically invalid regions — specifically, the
    // "overhead AND crossed-over" zone. Without coupling, each component's
    // box is independent and a user can drag one axis, then the other, and
    // end up at (-0.4, -0.9, 0) (overhead past midline), which is not
    // reachable with a real shoulder.
    //   x ↔ y coupling (slopeMin −0.35 on both):
    //     As y becomes negative (arm elevating toward overhead), x.min
    //     tightens toward 0 (no cross-body when overhead). Symmetrically,
    //     when x is negative (arm crossed-over), y.min tightens so the
    //     arm can't go as high overhead.
    //   z = flex/ext; no coupling (the sagittal-plane limit box is already
    //     asymmetric enough).
    'Shoulder.dir.x': {
        min: -0.4, max: 1.02,
        coupling: { dependsOn: 'Shoulder.dir.y', slopeMin: -0.35, slopeMax: 0 },
    },
    'Shoulder.dir.y': {
        min: -1.0, max: 1.02,
        coupling: { dependsOn: 'Shoulder.dir.x', slopeMin: -0.5, slopeMax: 0 },
    },
    // max bumped 0.5 → 0.65 (≈30° → ≈40° hyperextension behind body) to
    // accommodate exercises like skull-crushers / overhead extensions where
    // the elbow travels well behind the shoulder line.
    'Shoulder.dir.z': { min: -1.02, max: 0.65 },
    'Shoulder.action.External Rotation': { min: -90, max: 90 },

    // --- Elbow hinge. The slider emits 0-160 meaning "degrees of flexion"
    // and the drag handler uses that value directly as a stored-angle
    // target, so the joint limit has to be in THAT same space: 0 straight,
    // 160 fully flexed. positiveAction = Extension is a SEPARATE convention
    // for demand labeling — it controls whether a positive torque component
    // gets labeled "Extension" or "Flexion", and is independent of which
    // direction the stored hinge angle calls positive. The two conventions
    // happen to disagree here, which is fine as long as nothing mixes them.
    'Elbow.action.Extension': { min: 0, max: 150 },

    // --- Spine (fixed in the model today; defined for static analysis) ---
    'Spine.action.Flexion':          { min: -30, max: 80 },
    'Spine.action.Lateral Flexion L':{ min: -35, max: 35 },
    'Spine.action.Rotation L':       { min: -45, max: 45 },

    // --- Hip (femur unit direction, right-normalized, PELVIS-FRAME) ---
    // Standing rest in the pelvis frame: (0, 1, 0). Since the hip limits
    // are interpreted in the pelvis frame (getDimensionValue transforms
    // femur through pelvisFrame), these bounds track spine tilt: if the
    // user tilts the spine forward, the same world-vertical femur moves
    // closer to the y.min / z.min flexion corner automatically.
    //
    //   Abduction: x.max = 0.65 → 40.5° pure-path (typical 30-45°).
    //   Adduction: x.min = -0.35 → 20.5° (typical 20-30°).
    //   Flexion:   y.min = -0.5 → 120° (cos 120° = -0.5). Bent knee
    //     reaches this in-vivo; straight-knee flex is limited in real
    //     people by the hamstring length-tension, which is modelled as
    //     a separate cross-joint modification, NOT as a dir.z bound.
    //   Extension: z.max = sin(45°) ≈ 0.707 → 45° hyperextension (prior
    //     default was 14.5°; user wanted more range for extension-heavy
    //     postures like back-leg lifts).
    //   z.min = -1 → no lower z bound, so the pure-sagittal flex path
    //     from 0° to 120° is CONTINUOUS (the old -0.9 bound interrupted
    //     the path between ~64° and ~116°, forcing users to simultaneously
    //     drag Y to "walk around" an invisible gap). y.min is now the
    //     sole flexion limit, matching the intuitive "120° everywhere"
    //     semantic.
    //   ER / IR: ±40° (typical 35-45°).
    'Hip.dir.x': { min: -0.35, max: 0.65 },
    'Hip.dir.y': { min: -0.5,  max: 1.02 },
    'Hip.dir.z': { min: -1.0,  max: 0.707 },
    'Hip.action.External Rotation': { min: -40, max: 40 },

    // --- Knee hinge. Same as Elbow — limit is in slider space (0=straight, 160=full flex). ---
    'Knee.action.Extension': { min: 0, max: 140 },

    // --- Ankle hinge. positiveAction = Dorsi Flexion. ---
    // Symmetric ±50° ROM. Limit table is keyed by positiveAction; after the
    // swap (so labels follow the muscle-working convention used by every
    // other joint) the key reads "Dorsi Flexion."
    'Ankle.action.Dorsi Flexion': { min: -50, max: 50 },
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
        physicsEnabled: c.physicsEnabled,
        // Direction mode (half-space / one-way / undefined=both) is a
        // scalar-style flag with no spatial component, so it carries
        // straight across without negation. Was previously dropped at
        // mirror time, leaving the mirrored side stuck in 'both' mode
        // even when the source had been switched to 'half-space'.
        directional: c.directional,
        // Joint-anchor for arc pivots: swap L↔R so the mirror anchors
        // to the corresponding joint on the opposite side. Central
        // joints (Pelvis, Neck) carry across unchanged.
        anchor: c.anchor ? { joint: mirrorJointName(c.anchor.joint) } : undefined,
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
// Tightened 5× from previous values (TOL_SCALE 0.0005 → 0.0001;
// MIN_TOL 0.01 → 0.002). The previous values let bones drift up to
// ~3% of their length per constraint before the solver early-exited
// (e.g., a 60-unit bone could be ~3 units off-target — visible as
// "a few pixels" of constraint violation in playback). Small residual
// violations also broke bilateral symmetry at intermediate frames in
// timeline analysis, surfacing as spurious spine demands at any one
// frame where left/right residuals didn't cancel.
const SOLVER_TOL_SCALE = 0.0001;
const SOLVER_MIN_TOL = 0.002;

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

// --- EXERCISE PRESETS ---
//
// Starting-point scenes for common gym exercises. Each preset bundles
// posture (start + end keyframes), twists, forces, and constraints into a
// single object the user can apply from the header dropdown. The numbers
// here are approximations — arm/leg angles, constraint orientations, force
// directions — not finely tuned anatomy. They're meant to save setup time,
// not be the final ground truth.
//
// Coordinate system recap (matches the rest of the file):
//   +X = subject's right   |  +Y = DOWN   |  -Z = anterior/forward
//
// Bone direction conventions:
//   - Ball-socket (Humerus, Femur): the posture vector is the bone's world
//     direction. (root frame is identity.) Unit length.
//   - Hinge (Forearm, Tibia, Foot): the posture vector is a LOCAL direction
//     in the parent frame. Use `hingeLocal(bone, flexDeg)` below.
//   - Scapula (Clavicle): offset vector from neck to shoulder. Default
//     magnitude 25 along ±X for the relaxed shoulder position.
//
// For hinges we store the angle-to-dir result directly. This matches the
// slider convention: deg = 0 → along parent (extended), deg > 0 → flexed.
const hingeLocal = (bone: string, flexDeg: number): Vector3 => {
    const t = flexDeg * Math.PI / 180;
    if (bone.includes('Foot')) return { x: 0, y: Math.sin(t), z: -Math.cos(t) };
    return { x: 0, y: Math.cos(t), z: Math.sin(t) };
};
// Utility: build a Posture by overlaying a partial override onto the default.
const mkPosture = (overrides: Partial<Posture>): Posture => ({
    ...DEFAULT_POSTURE,
    ...overrides,
});

interface ExercisePreset {
    id: string;
    name: string;
    category: 'Push' | 'Pull' | 'Legs' | 'Isolation';
    startPosture: Posture;
    endPosture: Posture;
    startTwists?: Record<string, number>;
    endTwists?: Record<string, number>;
    forces: Array<Omit<ForceConfig, 'id'>>;
    constraints: Record<string, Array<Omit<BoneConstraint, 'id'>>>;
}

// Exercise presets are captured from real, user-built scenes via the
// window.__scene console export. Each entry is pure data: poses, twists,
// forces, and constraints — IDs are assigned at apply time, so stripped
// from the captured data.
const EXERCISE_PRESETS: ExercisePreset[] = [
    {
        id: 'bb_bench_press',
        name: 'BB BENCH PRESS',
        category: 'Push',
        startPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            lHumerus: { x: -0.9641968488023334, y: -0.00013583342144805159, z: 0.2651875153715423 },
            lForearm: { x: 0, y: -0.05233595624294362, z: 0.9986295347545738 },
            rHumerus: { x: 0.9641968488023333, y: -0.00013583342144947848, z: 0.26518751537154234 },
            rForearm: { x: 0, y: -0.05233595624294362, z: 0.9986295347545738 },
            lFemur: { x: 0, y: 1, z: 0 },
            lTibia: { x: 0, y: 1, z: 0 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 1, z: 0 },
            rTibia: { x: 0, y: 1, z: 0 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        endPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            lHumerus: { x: -0.6116498627494875, y: 0.00023225097999554688, z: -0.7911285555824763 },
            lForearm: { x: 0, y: 1, z: 0 },
            rHumerus: { x: 0.6116498627494875, y: 0.00023225097999554894, z: -0.7911285555824763 },
            rForearm: { x: 0, y: 1, z: 0 },
            lFemur: { x: 0, y: 1, z: 0 },
            lTibia: { x: 0, y: 1, z: 0 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 1, z: 0 },
            rTibia: { x: 0, y: 1, z: 0 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        startTwists: {
            lHumerus: 15.366188376336272,
            rHumerus: -15.366188376336321,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        endTwists: {
            lHumerus: -49.26251676279056,
            rHumerus: 49.26251676279058,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        forces: [
            { name: 'Force', boneId: 'rForearm', position: 1, x: 0, y: 0, z: 1, magnitude: 10 },
            { name: 'Force', boneId: 'lForearm', position: 1, x: 0, y: 0, z: 1, magnitude: 10 },
        ],
        constraints: {
            rForearm: [
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: 75.77227892901028, y: -30, z: -38.40750236747612 }, physicsEnabled: false },
                { active: true, type: 'planar', normal: { x: 1, y: 0, z: 0 }, center: { x: 75.77227892901028, y: -30, z: -38.40750236747612 } },
            ],
            rHumerus: [
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: 69, y: -30, z: 0 }, physicsEnabled: false },
            ],
            lForearm: [
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: -75.77227892901028, y: -30, z: -38.40750236747612 }, physicsEnabled: false },
                { active: true, type: 'planar', normal: { x: -1, y: 0, z: 0 }, center: { x: -75.77227892901028, y: -30, z: -38.40750236747612 } },
            ],
            lHumerus: [
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: -69, y: -30, z: 0 }, physicsEnabled: false },
            ],
            spine: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 30, z: 0 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 0, y: -30, z: 0 } },
            ],
        },
    },
    // ========================================================================
    // HAMMER STRENGTH ISO-LATERAL CHEST PRESS (MTS)
    // ========================================================================
    // Plate-loaded lever chest press with independent arms. Each lever
    // pivots at the rear of the frame; handles extend forward to the user.
    // When pushing, each handle sweeps forward on a shallow arc — shallow
    // enough over typical ROM (~20-25°) that a LINEAR (two planar
    // constraints) approximation is accurate to within a couple degrees
    // and much simpler to author. Resistance profile is slightly peaked —
    // the mechanical advantage at lockout drops relative to mid-ROM.
    //
    // Body posture: seated upright, feet on the footrest (not mechanically
    // coupled to the lift). Spine pinned at pelvis AND neck to represent
    // back pad + seat (same pattern as BB bench press — the user doesn't
    // translate). Legs posed in seated position with moderate knee flex so
    // the Timeline Peaks readouts don't show spurious leg involvement.
    //
    // Starting position: elbows bent ~105°, hands at chest height ~30 cm
    // forward of the body. Ending position: arms extended forward to near
    // lockout.
    {
        id: 'hs_iso_chest_press',
        name: 'HAMMER STRENGTH ISO-LATERAL CHEST PRESS',
        category: 'Push',
        startPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            // Shoulder ~20° abducted, humerus tilted slightly back (elbow at
            // chest level ≈ shoulder level since chest press is horizontal).
            lHumerus: { x: -0.3, y: 0.55, z: -0.78 },
            // Elbow flexed ~95° — forearm points forward-and-slightly-down.
            lForearm: { x: 0, y: 0.1, z: -0.995 },
            rHumerus: { x: 0.3, y: 0.55, z: -0.78 },
            rForearm: { x: 0, y: 0.1, z: -0.995 },
            // Legs: seated. Thighs forward-and-slightly-down (~17° hip flex
            // below horizontal), knee flexed ~30° (shins roughly vertical).
            lFemur: { x: 0, y: 0.3, z: -0.954 },
            lTibia: { x: 0, y: 0.866, z: 0.5 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 0.3, z: -0.954 },
            rTibia: { x: 0, y: 0.866, z: 0.5 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        endPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            // End: arms extended forward (~90° shoulder flex with mild abduction)
            lHumerus: { x: -0.15, y: 0.1, z: -0.984 },
            // End: elbow nearly straight (~15° flex)
            lForearm: { x: 0, y: 0.966, z: -0.259 },
            rHumerus: { x: 0.15, y: 0.1, z: -0.984 },
            rForearm: { x: 0, y: 0.966, z: -0.259 },
            // Legs unchanged (not mechanically involved)
            lFemur: { x: 0, y: 0.3, z: -0.954 },
            lTibia: { x: 0, y: 0.866, z: 0.5 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 0.3, z: -0.954 },
            rTibia: { x: 0, y: 0.866, z: 0.5 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        startTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        endTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        forces: [
            {
                name: 'Lever resistance',
                boneId: 'rForearm',
                position: 1,
                // +z = backward in world; resistance opposes the forward push
                x: 0, y: 0, z: 1,
                magnitude: 10,
                // Slightly peaked: Hammer levers feel strongest mid-push, soften
                // at both ends.
                profile: {
                    points: [
                        { t: 0,   multiplier: 0.9 },
                        { t: 0.5, multiplier: 1.05 },
                        { t: 1,   multiplier: 0.9 },
                    ],
                },
            },
            {
                name: 'Lever resistance',
                boneId: 'lForearm',
                position: 1,
                x: 0, y: 0, z: 1,
                magnitude: 10,
                profile: {
                    points: [
                        { t: 0,   multiplier: 0.9 },
                        { t: 0.5, multiplier: 1.05 },
                        { t: 1,   multiplier: 0.9 },
                    ],
                },
            },
        ],
        constraints: {
            // Each hand sweeps along a forward-backward line (z axis). Two
            // planar constraints per hand: Y (no vertical motion) and X
            // (no lateral drift — iso-lateral means each arm has its own
            // lane). Center at start-hand world position.
            rForearm: [
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: 25, y: -30, z: -42 }, physicsEnabled: false },
                { active: true, type: 'planar', normal: { x: 1, y: 0, z: 0 }, center: { x: 25, y: -30, z: -42 } },
            ],
            lForearm: [
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: -25, y: -30, z: -42 }, physicsEnabled: false },
                { active: true, type: 'planar', normal: { x: -1, y: 0, z: 0 }, center: { x: -25, y: -30, z: -42 } },
            ],
            // Back pad + seat → pin pelvis and neck in world. Same fixity
            // pattern as BB bench press; prevents the pelvis-translation
            // DOFs from drifting since the body is externally supported.
            spine: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 30, z: 0 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 0, y: -30, z: 0 } },
            ],
        },
    },
    // ========================================================================
    // STIFF-LEG DEADLIFT
    // ========================================================================
    // Hip-hinge pattern with knees straight throughout. User stands with
    // bar, hinges forward at the hip, bar travels down in front of the
    // thighs to mid-thigh / knee level, then returns to upright.
    //
    // Key geometric facts encoded here:
    //   - Legs are "stiff" = fully straight both at start (bottom) and end
    //     (lockout). lFemur/lTibia both (0, 1, 0) throughout. No knee flex.
    //   - Arms hang STRAIGHT DOWN IN WORLD at every ROM fraction — the
    //     bar is held by gravity. Since humerus is stored in spineFrame-
    //     local and the spine tilts forward, the stored humerus direction
    //     has to COMPENSATE for the tilt. At start (60° spine tilt),
    //     spineFrame × (0, 0.5, -0.866) = (0, 1, 0) world = down. At end
    //     (upright spine), humerus is just (0, 1, 0) directly.
    //   - Feet pinned at ankle AND toe so foot orientation is locked,
    //     not just position. Ankles directly under hips (x = ±20, y = 133),
    //     toes 20 forward.
    //   - Pelvis does not need to translate (pelvisTx/Ty/Tz = 0 at both
    //     ends) because the feet are placed at the straight-leg reach
    //     distance from the default pelvis position. Spine tilts, legs
    //     stay vertical, hip angle changes in pelvisFrame as the pelvis
    //     pitches forward with the spine.
    //   - No spine constraint — the spine is the DOF the user drives via
    //     the hip hinge. Solver accommodates by keeping feet pinned.
    //   - Force is gravity on each hand — world direction (0, 1, 0) with
    //     y-down world convention. NOT localFrame; gravity does not rotate
    //     with the arm. No profile (constant).
    //
    // Expected muscle activation: glute-max, hamstrings-biarticular,
    // adductor-magnus-posterior as primaries (hip extensors resisting
    // forward-flexion moment). Spine erectors secondary (resisting torso
    // flexion). Grip/forearm tertiary (holding the bar).
    //
    // Convention chosen: START = bottom (bar at mid-thigh, torso flexed
    // 60° forward). END = top (lockout, standing upright). This matches
    // "lift the weight" as the progression t=0 → 1.
    {
        id: 'sldl',
        name: 'STIFF-LEG DEADLIFT',
        category: 'Pull',
        startPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            // Spine tilted 60° forward from vertical. (0, -cos 60°, -sin 60°).
            spine: { x: 0, y: -0.5, z: -0.866 },
            // Humerus hanging straight down in WORLD — (0, 1, 0). Stored
            // in spineFrame-local, so we pre-apply the inverse tilt:
            // worldToLocal(spineFrame, (0,1,0)) = (0, 0.5, -0.866).
            lHumerus: { x: 0, y: 0.5, z: -0.866 },
            rHumerus: { x: 0, y: 0.5, z: -0.866 },
            // Straight elbows — forearm aligned with humerus axis.
            lForearm: { x: 0, y: 1, z: 0 },
            rForearm: { x: 0, y: 1, z: 0 },
            // Stiff legs — femur and tibia both straight down in world.
            lFemur: { x: 0, y: 1, z: 0 },
            lTibia: { x: 0, y: 1, z: 0 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 1, z: 0 },
            rTibia: { x: 0, y: 1, z: 0 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        endPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            // Spine upright at lockout.
            spine: { x: 0, y: -1, z: 0 },
            // Upright spine → spineFrame is identity, so stored humerus
            // direction IS its world direction. Straight down.
            lHumerus: { x: 0, y: 1, z: 0 },
            rHumerus: { x: 0, y: 1, z: 0 },
            lForearm: { x: 0, y: 1, z: 0 },
            rForearm: { x: 0, y: 1, z: 0 },
            lFemur: { x: 0, y: 1, z: 0 },
            lTibia: { x: 0, y: 1, z: 0 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 1, z: 0 },
            rTibia: { x: 0, y: 1, z: 0 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        startTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        endTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        forces: [
            {
                name: 'Barbell weight (right hand)',
                boneId: 'rForearm',
                position: 1,
                // +y = down in our Y-down world. Gravity pulls bar down.
                // World-frame, not localFrame — gravity direction doesn't
                // change as the arm or torso rotates.
                x: 0, y: 1, z: 0,
                magnitude: 10,
            },
            {
                name: 'Barbell weight (left hand)',
                boneId: 'lForearm',
                position: 1,
                x: 0, y: 1, z: 0,
                magnitude: 10,
            },
        ],
        constraints: {
            // TWO fixed constraints per foot — at the heel (foot bone
            // position 0 = ankle end) and the toe (position 1 = far end).
            // A single midfoot pin would leave the foot free to rotate
            // about itself; pinning BOTH ends locks the foot-ground
            // contact in all 6 rigid-body DOFs, matching physical reality
            // (the floor prevents the heel AND the toe from moving).
            //
            // The old "zero-moment-arm concentration" bug (where Phase B
            // dumped all Y-reaction at the ankle pin — directly below
            // the hip, zero moment arm — silently zeroing hip demand) is
            // prevented by the whole-body moment-balance rows added to
            // Phase B: the λ solution is now forced to match the applied
            // wrench about pelvisOrigin, so it can't arbitrarily sink
            // all reaction into a zero-moment-arm pin.
            lFoot: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 133, z: 0 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 133, z: -20 }, position: 1 },
            ],
            rFoot: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 133, z: 0 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 133, z: -20 }, position: 1 },
            ],
        },
    },
    // ========================================================================
    // ROMANIAN DEADLIFT (RDL) — option B test
    // ========================================================================
    // Authored with pelvisTx/Ty/Tz = 0 for both start and end. The preset-
    // load solver should adjust those DOFs automatically so feet land at
    // the (fixed) constraint point for BOTH poses.
    {
        id: 'rdl',
        name: 'ROMANIAN DEADLIFT',
        category: 'Pull',
        startPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            spine: { x: 0, y: -0.25881904510252074, z: -0.9659258262890683 },
            lHumerus: { x: 0, y: 0.25881904510252074, z: -0.9659258262890683 },
            rHumerus: { x: 0, y: 0.25881904510252074, z: -0.9659258262890683 },
            lForearm: { x: 0, y: 1, z: 0 },
            rForearm: { x: 0, y: 1, z: 0 },
            lFemur: { x: 0, y: 1, z: 0 },
            lTibia: { x: 0, y: 0.984807753012208, z: 0.17364817766693033 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 1, z: 0 },
            rTibia: { x: 0, y: 0.984807753012208, z: 0.17364817766693033 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        endPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            spine: { x: 0, y: -1, z: 0 },
            lHumerus: { x: 0, y: 1, z: 0 },
            rHumerus: { x: 0, y: 1, z: 0 },
            lForearm: { x: 0, y: 1, z: 0 },
            rForearm: { x: 0, y: 1, z: 0 },
            lFemur: { x: 0, y: 1, z: 0 },
            lTibia: { x: 0, y: 1, z: 0 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 1, z: 0 },
            rTibia: { x: 0, y: 1, z: 0 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        startTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        endTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        forces: [
            { name: 'Barbell weight (right hand)', boneId: 'rForearm', position: 1, x: 0, y: 1, z: 0, magnitude: 10 },
            { name: 'Barbell weight (left hand)', boneId: 'lForearm', position: 1, x: 0, y: 1, z: 0, magnitude: 10 },
        ],
        // Two pins per foot (heel at position 0, toe at position 1) so
        // the floor fully constrains the foot — pinning only one point
        // would leave the foot free to rotate about it. Start-pose
        // natural positions: 10° knee flex → ankle at (y=132.27,
        // z=8.51), foot world direction (0, 0.174, -0.985), toe at
        // (y=132.27 + 3.47, z=8.51 - 19.70) = (y=135.74, z=-11.19).
        constraints: {
            lFoot: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 132.27, z: 8.51 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 135.74, z: -11.19 }, position: 1 },
            ],
            rFoot: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 132.27, z: 8.51 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 135.74, z: -11.19 }, position: 1 },
            ],
        },
    },
    // ========================================================================
    // CONVENTIONAL DEADLIFT
    // ========================================================================
    // 60° knee flex + 45° spine tilt at bottom; lockout is straight legs +
    // upright spine. Constraint is at the start-pose natural foot midpoint;
    // applyPreset's solver translates pelvis to keep feet there for the
    // end pose (lockout).
    {
        id: 'deadlift',
        name: 'CONVENTIONAL DEADLIFT',
        category: 'Pull',
        startPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            spine: { x: 0, y: -0.7071067811865475, z: -0.7071067811865476 },
            lHumerus: { x: 0, y: 0.7071067811865475, z: -0.7071067811865476 },
            rHumerus: { x: 0, y: 0.7071067811865475, z: -0.7071067811865476 },
            lForearm: { x: 0, y: 1, z: 0 },
            rForearm: { x: 0, y: 1, z: 0 },
            lFemur: { x: 0, y: 1, z: 0 },
            lTibia: { x: 0, y: 0.5, z: 0.8660254037844386 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 1, z: 0 },
            rTibia: { x: 0, y: 0.5, z: 0.8660254037844386 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        endPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            spine: { x: 0, y: -1, z: 0 },
            lHumerus: { x: 0, y: 1, z: 0 },
            rHumerus: { x: 0, y: 1, z: 0 },
            lForearm: { x: 0, y: 1, z: 0 },
            rForearm: { x: 0, y: 1, z: 0 },
            lFemur: { x: 0, y: 1, z: 0 },
            lTibia: { x: 0, y: 1, z: 0 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 1, z: 0 },
            rTibia: { x: 0, y: 1, z: 0 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        startTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        endTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        forces: [
            { name: 'Barbell weight (right hand)', boneId: 'rForearm', position: 1, x: 0, y: 1, z: 0, magnitude: 10 },
            { name: 'Barbell weight (left hand)', boneId: 'lForearm', position: 1, x: 0, y: 1, z: 0, magnitude: 10 },
        ],
        // Two pins per foot (heel / toe). 60° knee flex natural
        // positions: ankle at (y=108.5, z=42.43), foot world (0, 0.866,
        // -0.5), toe = ankle + 20·foot_world = (y=125.83, z=32.43).
        constraints: {
            lFoot: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 108.5, z: 42.43 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 125.83, z: 32.43 }, position: 1 },
            ],
            rFoot: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 108.5, z: 42.43 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 125.83, z: 32.43 }, position: 1 },
            ],
        },
    },

    // ========================================================================
    // Bar on upper back (force applied at spine position 1). 80° hip flex
    // + 80° knee flex gives a deep bottom with shin vertical. End = upright
    // lockout (solver translates pelvis up at preset-load).
    {
        id: 'back-squat',
        name: 'BARBELL BACK SQUAT',
        category: 'Push',
        startPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            spine: { x: 0, y: -0.8660254037844386, z: -0.5 },
            // Arms across chest (physically irrelevant; neutral pose).
            lHumerus: { x: 0, y: 0.8660254037844386, z: -0.5 },
            rHumerus: { x: 0, y: 0.8660254037844386, z: -0.5 },
            lForearm: { x: 0, y: 1, z: 0 },
            rForearm: { x: 0, y: 1, z: 0 },
            // 80° hip flex → femur world (0, sin 10°, -cos 10°).
            lFemur: { x: 0, y: 0.17364817766693033, z: -0.984807753012208 },
            // 80° knee flex → tibia vertical down in world (derived so
            // tibia_world = (0, 1, 0) via femur frame).
            lTibia: { x: 0, y: 0.17364817766693033, z: 0.984807753012208 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 0.17364817766693033, z: -0.984807753012208 },
            rTibia: { x: 0, y: 0.17364817766693033, z: 0.984807753012208 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        endPosture: {
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            spine: { x: 0, y: -1, z: 0 },
            lHumerus: { x: 0, y: 1, z: 0 },
            rHumerus: { x: 0, y: 1, z: 0 },
            lForearm: { x: 0, y: 1, z: 0 },
            rForearm: { x: 0, y: 1, z: 0 },
            lFemur: { x: 0, y: 1, z: 0 },
            lTibia: { x: 0, y: 1, z: 0 },
            lFoot: { x: 0, y: 0, z: -1 },
            rFemur: { x: 0, y: 1, z: 0 },
            rTibia: { x: 0, y: 1, z: 0 },
            rFoot: { x: 0, y: 0, z: -1 },
        },
        startTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        endTwists: {
            spine: 0, pelvis: 0, pelvisTx: 0, pelvisTy: 0, pelvisTz: 0,
            lHumerus: 0, rHumerus: 0,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        forces: [
            { name: 'Barbell on back', boneId: 'spine', position: 1, x: 0, y: 1, z: 0, magnitude: 20 },
        ],
        // Two pins per foot (heel / toe). 80° hip + 80° knee natural
        // positions: ankle at (y=88.40, z=-53.19), foot world (0, 0, -1),
        // toe = ankle + 20·(0,0,-1) = (y=88.40, z=-73.19).
        constraints: {
            lFoot: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 88.40, z: -53.19 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 88.40, z: -73.19 }, position: 1 },
            ],
            rFoot: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 88.40, z: -53.19 }, position: 0 },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 88.40, z: -73.19 }, position: 1 },
            ],
        },
    },
    // ========================================================================
    // BB BENT OVER ROW
    // ========================================================================
    // Captured from a hand-built scene. Spine fixed at ~52° forward lean
    // (held throughout the rep — femur is locked at hip + knee so the
    // hinge angle doesn't change). Feet pinned heel + toe with
    // directional half-space (Y up) so the floor pushes but doesn't
    // pull. Forearms tracked along a vertical line (planar normal X +
    // tilted normal {0,0.3,1}) — that's the bar's path. Spine tip
    // pinned at the neck-base position to keep the head/neck stationary.
    // Start = arms hanging long; end = elbows pulled out and back with
    // forearms wrapped (humerus IR shifts from -59° to -62° as the
    // shoulders externally rotate slightly into the top).
    {
        id: 'bb_bent_over_row',
        name: 'BB BENT OVER ROW',
        category: 'Pull',
        startPosture: {
            spine: { x: 4.8203590771609627e-17, y: -0.6166666666666667, z: -0.7872243785746362 },
            lClavicle: { x: -25, y: 2.01947021484375, z: -4 },
            rClavicle: { x: 25, y: 2.01947021484375, z: -4 },
            lHumerus: { x: -0.36573773565696277, y: 0.6680704664478252, z: -0.6480106176419513 },
            lForearm: { x: 0, y: 0.9999511551478069, z: 0.009883689521970284 },
            rHumerus: { x: 0.36573773565696277, y: 0.6680704664478251, z: -0.6480106176419512 },
            rForearm: { x: 0, y: 0.9999511551478069, z: 0.009883689521970329 },
            lFemur: { x: 7.5801017819076e-18, y: 0.8209762129473486, z: -0.5709623961125898 },
            lTibia: { x: 0, y: 0.8624202105928235, z: 0.5061930267803282 },
            lFoot: { x: 0, y: 0.07604316982719152, z: -0.997104526277277 },
            rFemur: { x: -7.5801017819076e-18, y: 0.8209762129473486, z: -0.5709623961125898 },
            rTibia: { x: 0, y: 0.8624202105928235, z: 0.5061930267803282 },
            rFoot: { x: 0, y: 0.07604316982719152, z: -0.997104526277277 },
        },
        endPosture: {
            spine: { x: 4.8203590771609627e-17, y: -0.6166666666666667, z: -0.7872243785746362 },
            lClavicle: { x: -25, y: -2, z: 6 },
            rClavicle: { x: 25, y: -2, z: 6 },
            lHumerus: { x: -0.8479126942906863, y: 0.40841902562408855, z: 0.3379910684751588 },
            lForearm: { x: 0, y: -0.18971906259418955, z: 0.9818384170974275 },
            rHumerus: { x: 0.8479126942906863, y: 0.40841902562408855, z: 0.3379910684751588 },
            rForearm: { x: 0, y: -0.18971906259418955, z: 0.9818384170974275 },
            lFemur: { x: -0.00009566162885885208, y: 0.8205811766038078, z: -0.5715299847360268 },
            lTibia: { x: 0, y: 0.8620400047342114, z: 0.506840241336302 },
            lFoot: { x: 0, y: 0.07546068542729362, z: -0.9971487777432428 },
            rFemur: { x: 0.00009566162885885208, y: 0.8205811766038078, z: -0.5715299847360268 },
            rTibia: { x: 0, y: 0.8620400047342114, z: 0.506840241336302 },
            rFoot: { x: 0, y: 0.07546068542729362, z: -0.9971487777432428 },
        },
        startTwists: {
            spine: 0,
            pelvis: 0,
            pelvisTx: 0,
            pelvisTy: 9.82819433137131,
            pelvisTz: 34.598975177050704,
            lHumerus: -59.48051046989573,
            rHumerus: 59.48051046989575,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        endTwists: {
            spine: 0.019494147277835466,
            pelvis: -0.021670329371533858,
            pelvisTx: -0.001183576275221258,
            pelvisTy: 9.836638100150429,
            pelvisTz: 34.6394670900202,
            lHumerus: -62.164197143685044,
            rHumerus: 62.164197143685044,
            lFemur: -0.03205024741176889,
            rFemur: 0.03205024741176889,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        forces: [
            { name: 'Force', boneId: 'rForearm', position: 1, x: 0, y: 1, z: 0, magnitude: 10 },
            { name: 'Force', boneId: 'lForearm', position: 1, x: 0, y: 1, z: 0, magnitude: 10 },
        ],
        constraints: {
            spine: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 3.694029575016619e-15, y: 2.8446394650004265, z: -12.611756976158034 }, physicsEnabled: false },
            ],
            rFoot: [
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: 20.010355573849886, y: 133.0172299210603, z: 0.013830956344949463 }, directional: 'half-space', position: 0 },
                { active: true, type: 'planar', normal: { x: 1, y: 0, z: 0 }, center: { x: 20.010421536029774, y: 133.02771998977394, z: 0.029207740818594452 }, position: 0 },
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: 20.010355573849886, y: 133.0172299210603, z: 0.013830956344949463 }, position: 0 },
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: 20.026458190623245, y: 132.98024363059292, z: -20.022914467971425 }, directional: 'half-space', position: 1 },
                { active: true, type: 'planar', normal: { x: 1, y: 0, z: 0 }, center: { x: 20.002832322517808, y: 133.03518082597984, z: -19.917752836836335 } },
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: 19.994677583473624, y: 133.01947924706047, z: -19.937942928796993 } },
            ],
            rFemur: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 84.16325444828078, z: 3.769471362771931 }, physicsEnabled: false },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: 20, y: 39.84463946500043, z: 34.62170573832014 }, position: 0, physicsEnabled: false },
            ],
            rForearm: [
                { active: true, type: 'planar', normal: { x: 1, y: 0, z: 0 }, center: { x: 55.04799504881175, y: 43.91082596592234, z: 8.758598042773402 } },
                { active: true, type: 'planar', normal: { x: 0, y: 0.3, z: 1 }, center: { x: 55.04799504881175, y: 43.91082596592234, z: 8.758598042773402 }, physicsEnabled: false },
            ],
            lFoot: [
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: -20.012702580542733, y: 133.02630516718358, z: 0.0357334592569547 }, position: 0, directional: 'half-space' },
                { active: true, type: 'planar', normal: { x: 1, y: 0, z: 0 }, center: { x: -20.00080559924827, y: 133.03666099840711, z: 0.055014879870954214 }, position: 0 },
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: -19.992809727950554, y: 133.02883321889436, z: 0.0319057498773736 }, position: 0 },
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: -20.00002858704091, y: 133.02116029004273, z: -19.96780049117799 }, directional: 'half-space' },
                { active: true, type: 'planar', normal: { x: 1, y: 0, z: 0 }, center: { x: -20.00649103736864, y: 133.02844465433103, z: -19.94814733809645 } },
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: -20.002013582971557, y: 132.9741372985945, z: -20.040668990391943 } },
            ],
            lFemur: [
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 84.16325444828078, z: 3.769471362771931 }, physicsEnabled: false },
                { active: true, type: 'fixed', normal: { x: 0, y: 0, z: 0 }, center: { x: -20, y: 39.84463946500043, z: 34.62170573832014 }, position: 0, physicsEnabled: false },
            ],
            lForearm: [
                { active: true, type: 'planar', normal: { x: -1, y: 0, z: 0 }, center: { x: -55.04799504881175, y: 43.91082596592234, z: 8.758598042773402 } },
                { active: true, type: 'planar', normal: { x: 0, y: 0.3, z: 1 }, center: { x: -55.04799504881175, y: 43.91082596592234, z: 8.758598042773402 }, physicsEnabled: false },
            ],
        },
    },
    // ========================================================================
    // BB OVERHEAD PRESS
    // ========================================================================
    // Standing barbell overhead press with proper layback. The lifter starts
    // with the bar in the front rack and a layback that clears the chin
    // path; the bar travels close to the face as the chest moves backward
    // out of the way. As the bar passes the head, the lifter "punches
    // through" to lockout — head between the arms, bar over the mid-foot.
    //
    // Layback distribution — the lean is shared across multiple joints:
    //   - Thoracic / spinal extension: spine direction tilts ~10° back
    //     (chest moves back relative to the pelvis). Loads the spinal
    //     erectors / antagonist abdominals as bracing.
    //   - Hip extension: pelvis translates ~7.5 forward at start (pelvisTz
    //     = -7.5) — "hip drive" that counterbalances the chest going back
    //     so COM stays over the feet. The femur tilts a few degrees back to
    //     keep the knee over the ankle, which registers as hip extension
    //     in pelvis-frame and loads the glutes / hamstrings. Pelvis
    //     translation interpolates back toward 0 by lockout.
    //   - Ankle: a few degrees of dorsi flex emerges naturally from the
    //     arc-based Ground constraints — the foot can pivot around either
    //     contact point as the load demands, rather than being locked at
    //     90° by hard X+Z pins.
    //
    // Bar / arm guide constraints (all guide-only, no physics demand):
    //   - Forearm path plane (normal {0, 0.2, 1}) — bar tip stays on a
    //     slightly-tilted vertical plane, producing the typical OHP
    //     J-curve. Without this the slerped arm direction + linearly-
    //     interpolated humerus twist can produce ugly mid-rep forearm
    //     orientations.
    //   - Humerus path plane (same normal, different center) — elbow tip
    //     rides a parallel plane so the elbow trajectory stays coordinated
    //     with the bar.
    //   - Lateral forearm pins (physics, normal {±1, 0, 0}) — bar is rigid
    //     at hand-width per side.
    //
    // Physics-bearing constraints:
    //   - Ground complex per foot (4 constraints): heel arc pivoting on
    //     toe + Y half-space at heel; toe arc pivoting on heel + Y half-
    //     space at toe. Each arc gives lateral X friction (axial
    //     component) plus the radial component which is redundant with
    //     bone rigidity. Together they allow plantar/dorsi flex (rotation
    //     around either contact) and block translation in any direction —
    //     equivalent to ideal foot-floor friction without over-constraining
    //     the ankle hinge.
    //   - Lateral forearm pins — see above.
    //
    // Guide-only constraints (kinematic but no demand):
    //   - Forearm + humerus path planes — see above.
    {
        id: 'bb_overhead_press',
        name: 'BB OVERHEAD PRESS',
        category: 'Push',
        startPosture: {
            // 10° backward thoracic-extension layback. (0, -cos 10°, sin 10°)
            // — spine points up-and-slightly-back from pelvis to neck base.
            spine: { x: 0, y: -0.9848077530122081, z: 0.17364817766693003 },
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            // Humerus in spineFrame-local — body-local front-rack arm pose.
            // Spine layback rotates the spineFrame, so arms automatically
            // rotate backward with the chest.
            lHumerus: { x: -0.7420989707234318, y: 0.46662365282492985, z: -0.48119796786306407 },
            lForearm: { x: 0, y: -0.2276220977279885, z: 0.9737495471762285 },
            rHumerus: { x: 0.7420989707234318, y: 0.46662365282492985, z: -0.48119796786306407 },
            rForearm: { x: 0, y: -0.2276220977279885, z: 0.9737495471762285 },
            // Femur tilts a hair back so that with the pelvis shifted forward
            // (pelvisTz = -7.5, hip drive), the knee tracks the foot.
            lFemur: { x: 0, y: 0.9977474243128747, z: 0.06708261531145247 },
            lTibia: { x: 0, y: 0.99991818542349, z: 0.012791499497526091 },
            // Foot has trace dorsi flex from constraint settling — the arc
            // half-spaces let the ankle find its natural angle for this load.
            lFoot: { x: 0, y: -0.02251292701365742, z: -0.9997465519406795 },
            rFemur: { x: 0, y: 0.9977474243128747, z: 0.06708261531145247 },
            rTibia: { x: 0, y: 0.99991818542349, z: 0.012791499497526091 },
            rFoot: { x: 0, y: -0.02251292701365742, z: -0.9997465519406795 },
        },
        endPosture: {
            // Spine upright at lockout — lifter has punched through, head
            // between arms, bar overhead.
            spine: { x: 0, y: -1, z: 0 },
            lClavicle: { x: -25, y: 0, z: 0 },
            rClavicle: { x: 25, y: 0, z: 0 },
            lHumerus: { x: -0.6007157473359344, y: -0.7757498952941979, z: -0.1932684424671315 },
            lForearm: { x: 0, y: 0.9386973459903525, z: 0.3447423568850636 },
            rHumerus: { x: 0.6007157473359408, y: -0.775749895294193, z: -0.19326844246713062 },
            rForearm: { x: 0, y: 0.9386973459903502, z: 0.34474235688506993 },
            lFemur: { x: 0, y: 0.9997932406002418, z: 0.02033411050591333 },
            lTibia: { x: 0, y: 0.9999199218435548, z: 0.012655034586252315 },
            lFoot: { x: 0, y: -0.0024170792142213715, z: -0.9999970788597695 },
            rFemur: { x: 0, y: 0.9997932406002418, z: 0.020334110505913328 },
            rTibia: { x: 0, y: 0.9999199218435548, z: 0.01265503458625233 },
            rFoot: { x: 0, y: -0.0024170792142213767, z: -0.9999970788597695 },
        },
        startTwists: {
            spine: 0, pelvis: 0,
            // Hip drive: pelvis pushed ~7.5 forward and ~0.3 up. The arc-
            // based Ground constraints absorb the resulting heel/toe shift
            // by letting the foot settle into trace dorsi flex.
            pelvisTx: 0, pelvisTy: -0.3352403445571757, pelvisTz: -7.5453140395696625,
            lHumerus: 60.72861137005861, rHumerus: -60.72861137005861,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        endTwists: {
            spine: 0, pelvis: 0,
            // At lockout the pelvis has mostly returned (Tz ≈ -2.7 vs start
            // -7.5). Slight residual hip-drive forward at the top.
            pelvisTx: 0, pelvisTy: -0.21543120664483045, pelvisTz: -2.699775338211186,
            lHumerus: -7.376677248559715, rHumerus: 7.376677248559754,
            lFemur: 0, rFemur: 0,
            lForearm: 0, rForearm: 0,
            lTibia: 0, rTibia: 0,
            lFoot: 0, rFoot: 0,
        },
        forces: [
            { name: 'Force', boneId: 'rForearm', position: 1, x: 0, y: 1, z: 0, magnitude: 10 },
            { name: 'Force', boneId: 'lForearm', position: 1, x: 0, y: 1, z: 0, magnitude: 10 },
        ],
        constraints: {
            // Ground complex (4 constraints per foot, applied via the
            // constraint preset menu). Heel arc pivots around the toe + Y
            // half-space at heel; toe arc pivots around the heel + Y
            // half-space at toe. Together they allow plantar/dorsi flex
            // (rotation around either contact point) while preventing
            // translation and floor penetration. Centers/pivots are
            // captured from the live geometry at the moment the preset was
            // applied — small floating-point residuals are from constraint
            // settling and are within solver tolerance.
            rFoot: [
                { active: true, type: 'arc', position: 0, normal: { x: 1, y: 0, z: 0 }, center: { x: 20.000000000000018, y: 132.3866982010403, z: -0.010701992781389613 }, pivot: { x: 20.000000000000018, y: 133.27893244684245, z: -19.990790031892175 }, axis: { x: 1, y: 0, z: 0 }, radius: 20 },
                { active: true, type: 'planar', position: 0, normal: { x: 0, y: 1, z: 0 }, center: { x: 20.000000000000018, y: 132.3866982010403, z: -0.010701992781389613 }, directional: 'half-space' },
                { active: true, type: 'arc', normal: { x: 1, y: 0, z: 0 }, center: { x: 20.000000000000018, y: 133.27893244684245, z: -19.990790031892175 }, pivot: { x: 20.000000000000018, y: 132.3866982010403, z: -0.010701992781389613 }, axis: { x: 1, y: 0, z: 0 }, radius: 20 },
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: 20.000000000000018, y: 133.27893244684245, z: -19.990790031892175 }, directional: 'half-space' },
            ],
            rForearm: [
                // Lateral pin (physics) — bar locked at hand-width.
                { active: true, type: 'planar', normal: { x: 1, y: 0, z: 0 }, center: { x: 65.26382327369274, y: -49.089084175284526, z: -21.633578301457874 } },
                // Bar path plane (guide-only) — slight forward tilt produces
                // the OHP J-curve.
                { active: true, type: 'planar', normal: { x: 0, y: 0.2, z: 1 }, center: { x: 65.26382327369274, y: -49.089084175284526, z: -21.633578301457874 }, physicsEnabled: false },
            ],
            rHumerus: [
                // Elbow path plane (guide-only) — parallel to forearm plane,
                // keeps elbow trajectory coordinated with the bar.
                { active: true, type: 'planar', normal: { x: 0, y: 0.2, z: 1 }, center: { x: 57.90896534380867, y: -10.79062728770145, z: -22 }, physicsEnabled: false },
            ],
            lFoot: [
                { active: true, type: 'arc', position: 0, normal: { x: -1, y: 0, z: 0 }, center: { x: -20.000000000000018, y: 132.3866982010403, z: -0.010701992781389613 }, pivot: { x: -20.000000000000018, y: 133.27893244684245, z: -19.990790031892175 }, axis: { x: -1, y: 0, z: 0 }, radius: 20 },
                { active: true, type: 'planar', position: 0, normal: { x: 0, y: 1, z: 0 }, center: { x: -20.000000000000018, y: 132.3866982010403, z: -0.010701992781389613 }, directional: 'half-space' },
                { active: true, type: 'arc', normal: { x: -1, y: 0, z: 0 }, center: { x: -20.000000000000018, y: 133.27893244684245, z: -19.990790031892175 }, pivot: { x: -20.000000000000018, y: 132.3866982010403, z: -0.010701992781389613 }, axis: { x: -1, y: 0, z: 0 }, radius: 20 },
                { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: { x: -20.000000000000018, y: 133.27893244684245, z: -19.990790031892175 }, directional: 'half-space' },
            ],
            lForearm: [
                { active: true, type: 'planar', normal: { x: -1, y: 0, z: 0 }, center: { x: -65.26382327369274, y: -49.089084175284526, z: -21.633578301457874 } },
                { active: true, type: 'planar', normal: { x: 0, y: 0.2, z: 1 }, center: { x: -65.26382327369274, y: -49.089084175284526, z: -21.633578301457874 }, physicsEnabled: false },
            ],
            lHumerus: [
                { active: true, type: 'planar', normal: { x: 0, y: 0.2, z: 1 }, center: { x: -57.90896534380867, y: -10.79062728770145, z: -22 }, physicsEnabled: false },
            ],
        },
    },
];

const BioModelPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'kinematics' | 'kinetics' | 'torque' | 'timeline' | 'capacities' | 'constraints' | 'limits' | 'muscles' | 'modifications'>('kinematics');
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
  // Constraint id currently hovered in the settings panel (mouseenter
  // on a row sets it, mouseleave clears it). Threaded into BioMan so
  // the corresponding 3D marker gets the darkest highlight tier — lets
  // the user trace a settings row to its physical marker without
  // needing per-row click selection. Cleared when the selected bone
  // changes, since the panel reflects only the new bone's rows and
  // any stale hover would otherwise highlight an off-panel marker.
  const [hoveredConstraintId, setHoveredConstraintId] = useState<string | null>(null);
  useEffect(() => { setHoveredConstraintId(null); }, [selectedBone]);
  const [isPlaying, setIsPlaying] = useState(false);
  // Current ROM position for resistance profile evaluation. 0 = start pose,
  // 1 = end pose. Updated by pose-mode switch and playback animation.
  const [currentRomT, setCurrentRomT] = useState(0);
  const animationRef = useRef<number | null>(null);
  const [forces, setForces] = useState<ForceConfig[]>([]);
  const [editingForceId, setEditingForceId] = useState<string | null>(null);
  const [jointCapacities, setJointCapacities] = useState<Record<JointGroup, JointCapacityProfile>>(DEFAULT_CAPACITIES);
  const [jointLimits, setJointLimits] = useState<JointLimitsMap>(DEFAULT_JOINT_LIMITS);
  // Muscle assignments per (joint group, action direction). Seeded with
  // anatomy/EMG-consensus defaults from DEFAULT_MUSCLE_ASSIGNMENTS — the
  // user can edit them in the Muscles tab. Outer key is `${group}.${actionKey}`,
  // inner key is muscle id from MUSCLE_CATALOG, value is the {base, peak, angle}
  // contribution profile evaluated by the same cosine bell as joint capacities.
  const [muscleAssignments, setMuscleAssignments] = useState<MuscleAssignmentMap>(DEFAULT_MUSCLE_ASSIGNMENTS);
  // Per-section activation scale. Multiplier applied AFTER share distribution
  // to each muscle's contribution, then the final activation is clamped to
  // [0, 1]. Seeded from DEFAULT_SECTION_SCALES (max Σ bells per section)
  // so primaries hit 100% when raw action effort = 1.0. User can override
  // per-section via the Scale input in the Muscles tab.
  const [sectionScales, setSectionScales] = useState<Record<string, number>>(DEFAULT_SECTION_SCALES);
  // Cross-joint modifications — user-editable rules that scale capacities or
  // muscle contributions based on another joint's current angle (see the
  // Modifications tab). Example: knee flexion shortens gastroc, which lowers
  // both gastroc's plantar-flexion contribution AND the ankle's total
  // plantar-flexion capacity.
  const [modifications, setModifications] = useState<CrossJointModification[]>(DEFAULT_MODIFICATIONS);
  // Biarticular-muscle coupling toggle (Capacities tab). When OFF,
  // sectionAvailabilityModifier short-circuits to 1 — capacities are the
  // raw bell values with no cross-joint inhibition. Useful for A/B
  // testing: flip this off, note the effort distribution, flip it back
  // on, compare.
  const [biarticularCouplingEnabled, setBiarticularCouplingEnabled] = useState(true);
  // Exponent p for the Phase B effort cost min Σ (τ/cap)^p. p = 2 is the
  // classical quadratic norm (linear response to mechanical advantage); p < 2
  // sharpens the concentration toward high-leverage joints (matches observed
  // 1RM recruitment where the prime mover approaches 100% but synergists
  // don't). Solved via IRLS around the existing quadratic KKT. p = 2 collapses
  // to a single iteration and matches the pre-IRLS behavior exactly.
  const [effortExponent, setEffortExponent] = useState(1.5);
  // Joint Analysis tab display mode:
  //   '1rm-local' — normalize so the hardest action at the current pose reads
  //                 100%. Interprets the pose as "loaded to 1RM right now."
  //                 Cross-joint comparable, no ROM scan required.
  //   'raw'       — show raw effort (torque/capacity) as-is. Only meaningful if
  //                 the user has calibrated f.magnitude to match the capacity
  //                 table's unit scale, which defaults don't.
  const [torqueDisplayMode, setTorqueDisplayMode] = useState<'1rm-local' | 'raw'>('1rm-local');
  // 'joint' (default) shows per-joint-action demand bars; 'muscle' swaps in
  // the muscle activation rollup. Same toggle pattern in both Joint Analysis
  // and Timeline Peaks for consistency.
  const [analysisView, setAnalysisView] = useState<'joint' | 'muscle'>('joint');
  const [timelineView, setTimelineView] = useState<'joint' | 'muscle'>('joint');
  // Bracing fraction: the portion of any Spine Extension demand that is
  // off-loaded to abdominal bracing (represented as activation on the
  // rectus abdominis) instead of being handled purely by the erectors.
  // Defaults to 30% bracing / 70% erectors. When set > 0, rectus
  // abdominis is exempted from the normal Spine-extension antagonist
  // suppression so its reported activation reflects bracing work alone.
  const [bracingFraction, setBracingFraction] = useState<number>(0.3);
  // Muscles tab expand state. Members are either `${group}` (joint group
  // header expanded → show its action rows) or `${group}.${actionKey}`
  // (action row expanded → show its graph + per-muscle controls). Empty by
  // default so the tab opens fully collapsed and the user only expands what
  // they want to edit.
  const [expandedMuscleSections, setExpandedMuscleSections] = useState<Set<string>>(new Set());
  const toggleMuscleSection = (key: string) => {
      setExpandedMuscleSections(prev => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key); else next.add(key);
          return next;
      });
  };
  // Expansion state for the Capacities tab — one entry per joint group
  // (not per action). Start with all groups collapsed for a tidy overview.
  const [expandedCapacityGroups, setExpandedCapacityGroups] = useState<Set<string>>(new Set());
  const toggleCapacityGroup = (group: string) => {
      setExpandedCapacityGroups(prev => {
          const next = new Set(prev);
          if (next.has(group)) next.delete(group); else next.add(group);
          return next;
      });
  };
  
  // Removed reactionForces state — replaced by the jointForceArrows memo
  // below which derives net proximal force per bone from torqueDistribution.
  const [calculatedTorques, setCalculatedTorques] = useState<Record<string, Vector3>>({});
  const [neuralCosts, setNeuralCosts] = useState<Record<string, number>>({});

  const [constraints, setConstraints] = useState<Record<string, BoneConstraint[]>>({});

  // Exercise preset picker dropdown. Open/closed state + outside-click
  // dismissal via the ref. Presets are purely declarative data (see
  // EXERCISE_PRESETS above); applyPreset wires them into state.
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement | null>(null);
  // Watermarks for `directional: 'one-way'` planar constraints. Map keyed
  // by constraint id; value is the scalar offset α along the normal that
  // the wall has advanced from its authored center. The effective
  // constraint center is `c.center + α * normalize(c.normal)`. α monotonic-
  // ally decreases (slides into -normal halfspace) as the tip moves further
  // into the allowed region; never increases. Cleared on preset load and
  // model reset. Stored in a ref so updates don't trigger re-renders.
  const ratchetWatermarks = useRef<Map<string, number>>(new Map());
  // Active-set test for directional constraints. Returns true when the
  // constraint's boundary is currently within tolerance of the tip (the
  // wall is "loaded" and will exert a reaction force). Returns false when
  // the tip is comfortably inside the allowed halfspace — in that case
  // the wall exerts no force and the constraint should not contribute
  // to Phase B / force-projection. Bidirectional constraints (no
  // `directional`) always return true.
  const DIRECTIONAL_ACTIVE_TOL = 1e-2;
  const isDirectionalActive = (c: BoneConstraint, tip: Vector3 | null | undefined): boolean => {
    if (!c.directional) return true;
    if (c.type !== 'planar') return true;
    if (!tip) return true;
    const N = normalize(c.normal);
    const alpha = c.directional === 'one-way' ? (ratchetWatermarks.current.get(c.id) ?? 0) : 0;
    const sd = dotProduct(sub(tip, c.center), N) - alpha;
    return sd >= -DIRECTIONAL_ACTIVE_TOL;
  };
  useEffect(() => {
    if (!presetMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
        if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
            setPresetMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [presetMenuOpen]);

  // Scene state exposure for preset capture. In the browser console, run:
  //     copy(JSON.stringify(window.__scene, null, 2))
  // to copy the current scene to your clipboard, then paste it into
  // chat to save it as a preset.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as Record<string, unknown>).__scene = {
        startPosture,
        endPosture,
        startTwists,
        endTwists,
        forces,
        constraints,
    };
  }, [startPosture, endPosture, startTwists, endTwists, forces, constraints]);

  // Cross-joint modifications exposure for capture. In the console:
  //     copy(JSON.stringify(window.__modifications, null, 2))
  // Used to refresh DEFAULT_MODIFICATIONS in code from the live state.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as Record<string, unknown>).__modifications = modifications;
  }, [modifications]);

  const calculateKinematics = (currentPosture: Posture, currentTwists: Record<string, number>) => {
    const locations: Record<string, Vector3> = {};
    const boneEndPoints: Record<string, Vector3> = {};
    const boneStartPoints: Record<string, Vector3> = {};
    const jointFrames: Record<string, Frame> = {};

    // Pelvis position — default is anchored at (0, TORSO_LEN/2, 0), but
    // the solver can translate it via the pelvisTx/Ty/Tz DOFs to satisfy
    // distal constraints (feet pinned + knee flex ⇒ pelvis drops Y).
    // All downstream positions (hip sockets, neck base, shoulder sockets,
    // and therefore arm and leg starting points) hang off this point.
    const pelvisPos = {
        x: 0 + (currentTwists['pelvisTx'] || 0),
        y: CONFIG.TORSO_LEN / 2 + (currentTwists['pelvisTy'] || 0),
        z: 0 + (currentTwists['pelvisTz'] || 0),
    };
    // Spine is a user-editable direction. Neck base sits at
    // pelvis + spine_direction × spine_length.
    const spineDirRaw = currentPosture['spine'] || { x: 0, y: -1, z: 0 };
    const spineMag = Math.sqrt(spineDirRaw.x * spineDirRaw.x + spineDirRaw.y * spineDirRaw.y + spineDirRaw.z * spineDirRaw.z) || 1;
    const spineDir = { x: spineDirRaw.x / spineMag, y: spineDirRaw.y / spineMag, z: spineDirRaw.z / spineMag };
    const neckBase = {
        x: pelvisPos.x + spineDir.x * CONFIG.TORSO_LEN,
        y: pelvisPos.y + spineDir.y * CONFIG.TORSO_LEN,
        z: pelvisPos.z + spineDir.z * CONFIG.TORSO_LEN,
    };
    locations['Spine'] = pelvisPos;

    boneStartPoints['spine'] = pelvisPos;
    boneEndPoints['spine'] = neckBase;

    // Pelvis yaw rotates the whole lower body (legs) AND carries the
    // shoulders/clavicles/arms (which then ALSO pick up the extra
    // anatomical spine twist on top). This is a solver-controllable
    // DOF so that when the upper body is constrained and the user
    // applies spine rotation, the solver can rotate the pelvis (and
    // hence the lower body) instead of forcing the shoulders to move.
    //
    // World-space geometry:
    //   legs rotate by  pelvisYaw
    //   shoulders rotate by  pelvisYaw + spineTwist
    //   anatomical spine twist = (shoulders - pelvis) = spineTwist (as set by user)
    const pelvisYaw = currentTwists['pelvis'] || 0;
    const spineTwist = currentTwists['spine'] || 0;

    const rootFrameBase = createRootFrame({x: 0, y: 1, z: 0});
    const rootFrame = twistFrame(rootFrameBase, pelvisYaw);

    // Spine frame — torso-down direction, used as the parent frame for
    // the whole upper body (clavicles, arms). Legs parent off rootFrame
    // (which is also twisted by pelvisYaw so legs rotate with pelvis).
    //
    // Spine axial twist: rotation of the torso around the spine's long
    // axis. Applied via twistFrame so the torso-local frame (and
    // everything parented off it — clavicles, arms) rotates together.
    // The total rotation of the spine frame is pelvisYaw + spineTwist
    // because the spine bone sits on top of the pelvis (pelvis rotation
    // carries it) and the anatomical spine twist adds on top. For a
    // straight spine both rotations are about the same world-Y axis,
    // so combining them into a single twistFrame call is exact.
    // Torque about the rotation axis {0,1,0} is detected by Phase B as
    // Spine.rotationL/R demand from the ANATOMICAL twist only.
    const spineFrameBase = createRootFrame({ x: -spineDir.x, y: -spineDir.y, z: -spineDir.z });
    const spineFrame = twistFrame(spineFrameBase, pelvisYaw + spineTwist);

    // Pelvis frame — the pelvis's orientation in world. Since the spine
    // is rigid in this model, the pelvis is rigidly attached to the
    // spine: its "inferior" direction (pelvis → legs) is exactly the
    // negated spine direction, and it yaws with pelvisYaw. It does NOT
    // include spineTwist because that's the RELATIVE rotation between
    // shoulders and pelvis, not the pelvis's own rotation.
    //
    // Used as the reference frame for hip joint actions and hip joint
    // angles. A "hip flex = 0°" femur points along pelvisFrame.y (the
    // pelvis's own inferior direction), not along world-vertical. When
    // the user tilts the spine forward, the pelvis tilts forward with
    // it, and if the legs remain world-vertical, the hip is in flexion
    // relative to the pelvis — which is the anatomically correct
    // interpretation. Tilt backward → hip extension, and so on.
    const pelvisFrame = twistFrame(spineFrameBase, pelvisYaw);

    // Clavicle offsets are stored in TORSO-LOCAL coordinates; transform
    // through spineFrame to get world-space shoulder positions.
    const lClavOffset = currentPosture['lClavicle'] || { x: -25, y: 0, z: 0 };
    const rClavOffset = currentPosture['rClavicle'] || { x: 25, y: 0, z: 0 };
    const lClavOffsetWorld = {
        x: lClavOffset.x * spineFrame.x.x + lClavOffset.y * spineFrame.y.x + lClavOffset.z * spineFrame.z.x,
        y: lClavOffset.x * spineFrame.x.y + lClavOffset.y * spineFrame.y.y + lClavOffset.z * spineFrame.z.y,
        z: lClavOffset.x * spineFrame.x.z + lClavOffset.y * spineFrame.y.z + lClavOffset.z * spineFrame.z.z,
    };
    const rClavOffsetWorld = {
        x: rClavOffset.x * spineFrame.x.x + rClavOffset.y * spineFrame.y.x + rClavOffset.z * spineFrame.z.x,
        y: rClavOffset.x * spineFrame.x.y + rClavOffset.y * spineFrame.y.y + rClavOffset.z * spineFrame.z.y,
        z: rClavOffset.x * spineFrame.x.z + rClavOffset.y * spineFrame.y.z + rClavOffset.z * spineFrame.z.z,
    };

    locations['lShoulder'] = { x: neckBase.x + lClavOffsetWorld.x, y: neckBase.y + lClavOffsetWorld.y, z: neckBase.z + lClavOffsetWorld.z };
    locations['rShoulder'] = { x: neckBase.x + rClavOffsetWorld.x, y: neckBase.y + rClavOffsetWorld.y, z: neckBase.z + rClavOffsetWorld.z };

    boneStartPoints['lClavicle'] = neckBase;
    boneStartPoints['rClavicle'] = neckBase;
    boneEndPoints['lClavicle'] = locations['lShoulder'];
    boneEndPoints['rClavicle'] = locations['rShoulder'];

    // Hip offsets are stored in pelvis-local coordinates (-HIP_WIDTH
    // left, +HIP_WIDTH right on the x-axis) and transformed through
    // pelvisFrame so the hip sockets rotate with BOTH the pelvis yaw
    // AND the spine tilt. Since the spine is rigid, tilting it laterally
    // IS the pelvis tilting about the hip — so the hip sockets must
    // physically swing with pelvisFrame, not stay fixed in the world.
    // The femur's kinematic parent stays rootFrame so legs remain world-
    // oriented as before; the hip position change just means the legs
    // now start from a rotated pelvis and the hip line visibly tilts.
    const lHipLocal = { x: -CONFIG.HIP_WIDTH, y: 0, z: 0 };
    const rHipLocal = { x:  CONFIG.HIP_WIDTH, y: 0, z: 0 };
    locations['lHip'] = {
        x: pelvisPos.x + lHipLocal.x * pelvisFrame.x.x + lHipLocal.y * pelvisFrame.y.x + lHipLocal.z * pelvisFrame.z.x,
        y: pelvisPos.y + lHipLocal.x * pelvisFrame.x.y + lHipLocal.y * pelvisFrame.y.y + lHipLocal.z * pelvisFrame.z.y,
        z: pelvisPos.z + lHipLocal.x * pelvisFrame.x.z + lHipLocal.y * pelvisFrame.y.z + lHipLocal.z * pelvisFrame.z.z,
    };
    locations['rHip'] = {
        x: pelvisPos.x + rHipLocal.x * pelvisFrame.x.x + rHipLocal.y * pelvisFrame.y.x + rHipLocal.z * pelvisFrame.z.x,
        y: pelvisPos.y + rHipLocal.x * pelvisFrame.x.y + rHipLocal.y * pelvisFrame.y.y + rHipLocal.z * pelvisFrame.z.y,
        z: pelvisPos.z + rHipLocal.x * pelvisFrame.x.z + rHipLocal.y * pelvisFrame.y.z + rHipLocal.z * pelvisFrame.z.z,
    };

    // Spine actions (flexion, lateral flexion, rotation) are defined in
    // body-local coordinates, not world. pelvisFrame tracks the torso's
    // orientation (tilts with spine direction AND yaws with pelvisYaw),
    // so using it here means:
    //   Flexion axis (1,0,0) local → pelvisFrame.x world → body-lateral.
    //   Lateral flex axis (0,0,1) local → pelvisFrame.z world → body AP.
    //   Rotation axis (0,1,0) local → pelvisFrame.y world → along spine.
    // Previously jointFrames['spine'] = rootFrame, which twists with yaw
    // but doesn't tilt — so a forward-hinged spine had its rotation axis
    // stuck at world-vertical instead of tracking the tilted long axis.
    jointFrames['spine'] = pelvisFrame;
    jointFrames['lClavicle'] = spineFrame;
    jointFrames['rClavicle'] = spineFrame;
    jointFrames['lShoulder'] = spineFrame;
    jointFrames['rShoulder'] = spineFrame;
    // Hip joints are anchored to the pelvis, so their action-axis frame
    // is pelvisFrame (tilts with spine, yaws with pelvisYaw). This mirrors
    // how the shoulder joints use spineFrame.
    jointFrames['lHip'] = pelvisFrame;
    jointFrames['rHip'] = pelvisFrame;

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
    calculateChain('lHumerus', 'lForearm', '', locations['lShoulder'], spineFrame, BONE_LENGTHS.lHumerus, BONE_LENGTHS.lForearm, 0);
    calculateChain('rHumerus', 'rForearm', '', locations['rShoulder'], spineFrame, BONE_LENGTHS.rHumerus, BONE_LENGTHS.rForearm, 0);

    // calculateChain sets jointFrames[femur] = rootFrame (its kinematic
    // parent, used to interpret the stored femur direction as world-ish).
    // For hip joint action axes and angle measurements, override with
    // pelvisFrame — the pelvis's anatomical orientation. This means:
    //   • Hip flex/ab/horiz axes are anchored to the pelvis (tilt with spine)
    //   • Hip angles are measured relative to the pelvis
    //   • Bone-local forces on the thigh are interpreted in pelvis-relative
    //     coordinates too (transportFrame starts from pelvisFrame)
    // The femur's STORED direction stays in rootFrame-local, so posing
    // legs world-vertical is still natural — the computed hip angle will
    // correctly read as extension/flexion when the spine tilts.
    jointFrames['lFemur'] = pelvisFrame;
    jointFrames['rFemur'] = pelvisFrame;

    return { locations, boneEndPoints, boneStartPoints, jointFrames, pelvisFrame, rootFrame };
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
              if (c.type === 'arc' && c.axis && c.radius !== undefined) {
                  const livePivot = resolveArcPivot(c, kin);
                  if (!livePivot) continue;
                  const toTip = sub(tip, livePivot);
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

  // Look up the live world position of a joint anchor (knee, elbow, etc.)
  // given the current kinematics. Returns null if the joint name doesn't
  // resolve. Used by `resolveArcPivot` to override the stored pivot when
  // an arc constraint is anchored to a body joint.
  const getJointAnchorPos = (
      jointName: string,
      kin: ReturnType<typeof calculateKinematics>,
  ): Vector3 | null => {
      const m = JOINT_ANCHOR_POINTS[jointName];
      if (!m) return null;
      const map = m.end === 'start' ? kin.boneStartPoints : kin.boneEndPoints;
      return map[m.bone] || null;
  };

  // Live pivot for an arc constraint: if `anchor.joint` is set and the
  // joint resolves, return the joint's current world position; otherwise
  // fall back to the stored `pivot`. Returns null if neither is
  // available (caller should skip the constraint). All callers that
  // read `c.pivot` for arc geometry should go through this helper so
  // anchor-following constraints stay glued to their joint as the body
  // moves through the ROM.
  const resolveArcPivot = (
      c: BoneConstraint,
      kin: ReturnType<typeof calculateKinematics>,
  ): Vector3 | null => {
      if (c.anchor) {
          const p = getJointAnchorPos(c.anchor.joint, kin);
          if (p) return p;
      }
      return c.pivot || null;
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

  // Constraint complex presets — bundles of constraints that work together
  // to model a common physical arrangement, applied to a single bone with
  // one click instead of authoring each constraint by hand.
  //
  // Each preset declares:
  //   - id / name / description: shown in the UI button + tooltip
  //   - appliesTo: predicate determining whether the preset is offered for
  //     the currently-selected bone (e.g. "Ground" only makes sense on a
  //     foot bone — would be physical nonsense on a humerus)
  //   - build: factory that returns the actual constraints to add, given
  //     the bone's current proximal / distal world positions and the side
  //     sign (+1 right, -1 left). Centers are captured from current
  //     kinematics at apply time so the preset works regardless of pose.
  //
  // Future presets (not implemented yet, listed here as design notes):
  //   - "Bench" — pelvis/spine pinned at two pads (BB bench style)
  //   - "Cable Handle" — single point-tracking force + path constraint
  //   - "Smith Bar" — vertical-only path plane on forearm tip
  const CONSTRAINT_COMPLEX_PRESETS: {
      id: string;
      name: string;
      description: string;
      appliesTo: (boneId: string) => boolean;
      build: (boneId: string, kin: ReturnType<typeof calculateKinematics>) => Omit<BoneConstraint, 'id'>[];
  }[] = [
      {
          id: 'ground',
          name: 'Ground',
          description: 'Standing on the floor. 4 physics constraints per foot: heel and toe each get an arc (the heel pivots around the toe contact, the toe pivots around the heel contact — axis lateral X) plus a Y half-space (floor pushes up, but neither end can penetrate). The two arcs together allow plantar flex (rotation around toe) and dorsi flex (rotation around heel) while blocking translation in any direction — equivalent to ideal foot-floor friction without over-constraining the hinge angle the way hard X+Z pins did.',
          appliesTo: (b) => b === 'lFoot' || b === 'rFoot',
          build: (boneId, kin) => {
              const heel = kin.boneStartPoints[boneId]; // foot position 0 = ankle attachment / heel
              const toe = kin.boneEndPoints[boneId];    // foot position 1 = toe tip
              if (!heel || !toe) return [];
              // Arc axis is lateral (X) so the rotation plane is sagittal
              // (y-z) — that's the plane plantar/dorsi flex happen in.
              // Radius is captured from the live geometry's heel-toe
              // distance projected to the y-z plane; for a flat foot in
              // the default pose this is exactly the foot length (20).
              const arcAxis = { x: 1, y: 0, z: 0 };
              const heelRadius = Math.hypot(heel.y - toe.y, heel.z - toe.z);
              const toeRadius = heelRadius; // same magnitude, just the other endpoint
              return [
                  // Heel arc — heel rotates around the toe contact point.
                  // Replaces the X+Z hard friction pins: the arc's axial
                  // component locks heel.x = toe.x (lateral friction), and
                  // the radial component pins heel-to-toe distance — bone
                  // rigidity already enforces this redundantly so it's
                  // harmless. Heel can travel up the y-z arc when the foot
                  // pivots on its toes (plantar flex).
                  { active: true, type: 'arc', position: 0, normal: arcAxis, center: heel, pivot: toe, axis: arcAxis, radius: heelRadius },
                  // Heel Y half-space — floor pushes up, heel can lift.
                  { active: true, type: 'planar', position: 0, normal: { x: 0, y: 1, z: 0 }, center: heel, directional: 'half-space' },
                  // Toe arc — toe rotates around the heel contact point.
                  // Mirror of the heel arc: lateral lock + bone rigidity
                  // (redundant). Toe can travel up its arc when the foot
                  // pivots on the heel (dorsi flex / rocking back).
                  { active: true, type: 'arc', normal: arcAxis, center: toe, pivot: heel, axis: arcAxis, radius: toeRadius },
                  // Toe Y half-space.
                  { active: true, type: 'planar', normal: { x: 0, y: 1, z: 0 }, center: toe, directional: 'half-space' },
              ];
          },
      },
  ];

  const addConstraintComplex = (boneId: string, presetId: string) => {
      const preset = CONSTRAINT_COMPLEX_PRESETS.find(p => p.id === presetId);
      if (!preset) return;
      const kin = calculateKinematics(posture, twists);
      const baseId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
      const newConstraints: BoneConstraint[] = preset.build(boneId, kin).map((c, i) => ({
          ...c,
          id: `${baseId}-${i}`,
      }));
      if (newConstraints.length === 0) return;
      setConstraints(prev => ({ ...prev, [boneId]: [...(prev[boneId] || []), ...newConstraints] }));
      const src = sideOf(boneId);
      if (symmetryMode && src) applyWholesaleSync(src);
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
      // Any geometry edit (normal, center, position, directional mode,
      // physicsEnabled toggle) invalidates an existing one-way ratchet
      // watermark — the wall has effectively moved or the mode no longer
      // applies. Clearing here is a coarse-but-safe reset.
      const isGeomChange = ('normal' in updates) || ('center' in updates) ||
                            ('position' in updates) || ('directional' in updates) ||
                            ('physicsEnabled' in updates);
      if (isGeomChange) ratchetWatermarks.current.delete(id);
      setConstraints(prev => {
          const sourceList = (prev[boneId] || []).map(c => c.id === id ? { ...c, ...updates } : c);
          return { ...prev, [boneId]: sourceList };
      });
      const src = sideOf(boneId);
      if (symmetryMode && src) applyWholesaleSync(src);
  };

  const removeConstraint = (boneId: string, id: string) => {
      ratchetWatermarks.current.delete(id);
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
      // Color palette is now driven by physicsEnabled, NOT by constraint
      // type. Guide-only constraints (path tracking with no force
      // reaction) use violet; physical constraints (full Phase B
      // coupling, draw a reaction arrow) use rose. Arc, planar, and
      // fixed all use the same palette so the visualization
      // consistently communicates "what does this do to the physics?"
      // rather than "what shape is it?".
      const COL_PHYS  = 'rgba(244, 63, 94, 0.25)';   // rose-500 fill
      const COL_GUIDE = 'rgba(139, 92, 246, 0.25)';  // violet-500 fill
      (Object.entries(constraints) as [string, BoneConstraint[]][]).forEach(([boneId, list]) => {
          list.forEach(c => {
              if (!c.active) return;
              const isPhysics = c.physicsEnabled !== false;
              const color = isPhysics ? COL_PHYS : COL_GUIDE;
              if (c.type === 'fixed') {
                  // Fixed point: 3 small orthogonal planes as a visual
                  // "pin" marker at the locked position.
                  const pt = c.center;
                  const SZ = 20;
                  out.push({ id: c.id + '-fx', constraintId: c.id, center: pt, normal: { x: 1, y: 0, z: 0 }, size: SZ, color, boneId });
                  out.push({ id: c.id + '-fy', constraintId: c.id, center: pt, normal: { x: 0, y: 1, z: 0 }, size: SZ, color, boneId });
                  out.push({ id: c.id + '-fz', constraintId: c.id, center: pt, normal: { x: 0, y: 0, z: 1 }, size: SZ, color, boneId });
              } else if (c.type === 'arc' && c.axis && c.radius !== undefined) {
                  // Arc: pivot may be live-anchored to a joint; resolve here.
                  const livePivot = resolveArcPivot(c, kin);
                  if (!livePivot) return;
                  out.push({
                      id: c.id,
                      constraintId: c.id,
                      center: livePivot,
                      normal: c.axis,
                      size: c.radius * 2,
                      color,
                      boneId,
                      type: 'arc',
                      pivot: livePivot,
                      axis: c.axis,
                      radius: c.radius
                  });
              } else {
                  const tip = getConstraintPoint(boneId, c, kin) || c.center;
                  // Planar marker is now ~30% larger than the fixed
                  // constraint pins (26 vs 20) so they're still clearly
                  // distinguishable but no longer dwarf the figure.
                  const SZ_PLANAR = 26;
                  out.push({
                      id: c.id,
                      constraintId: c.id,
                      center: tip,
                      normal: c.normal,
                      size: SZ_PLANAR,
                      color,
                      boneId,
                      directional: c.directional,
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

  // Canonical capacity-map key for a given action name. Like actionKey() but
  // strips trailing " L" / " R" side suffixes so "Rotation L" and
  // "Rotation R" both map to "rotation" — matching how spine/scapula-style
  // capacities are stored as side-agnostic entries. Fixes a long-standing
  // silent bug where capacity lookup for ankle (camelCase mismatch) and
  // spine rotation / lateral-flexion (side-suffix mismatch) fell through
  // to a cap of 1.
  const capacityKey = (actionName: string): string =>
      actionKey(actionName.replace(/\s+[LR]$/, ''));

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
      currentT: number = 0,
      // Effort-cost exponent for Phase B min Σ (τ/cap)^p. p = 2 is the
      // classical quadratic norm; p < 2 concentrates demand on
      // mechanically-advantaged joints. Defaults to 2 (quadratic) for callers
      // that don't thread the knob in; the live scene uses whatever the
      // component state is.
      effortExponent: number = 2,
  ): TorqueDistributionResult => {
      const kin = calculateKinematics(currentPosture, currentTwists);

      // --- Freefall gate ---
      // Without ANY active constraint on ANY bone, the figure is floating
      // in space. Every applied force just accelerates the center of mass —
      // no joint needs to resist anything, so demands are identically zero.
      // This is the physically correct behavior: you can't have shoulder
      // demand from a hand force unless something below (or on) the shoulder
      // provides a reaction. Constraints are that "something."
      // Freefall gate: need at least one PHYSICS-enabled constraint. Pure
      // kinematic guides don't resist force — they only shape the path —
      // so a scene with only guides is still in physical freefall.
      const hasAnyPhysicsConstraint = activeConstraints && Object.values(activeConstraints).some(
          (list: BoneConstraint[]) => list.some(c => c.active && c.physicsEnabled !== false)
      );
      if (!hasAnyPhysicsConstraint) {
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

      // Joint-limit detection — shared by Phase A decomposition and Phase B
      // column building. Treats passive end-range limits like constraints:
      // when a joint action is at its stop AND the signed torque component
      // pushes further into that stop, the passive anatomy absorbs the load
      // and the muscle demand at that action is dropped. The caller supplies
      // the signed, already-bilaterally-flipped component / tau0 on the
      // action axis and the WORLD axis for 2-DOF motion-direction checks.
      //
      // Dimensions:
      //   Hinges (Forearm/Tibia/Foot): single action-based limit on hinge angle.
      //   Bone-axis twists (IR/ER):    action-based limit on twist angle.
      //   2-DOF ball-sockets:          dir-based limits + motion gradient
      //                                (axis × boneDir, the direction the
      //                                bone tip would move under a positive
      //                                rotation about the action axis).
      //
      // Returning true means: the passive structure is fully absorbing
      // this action's component of the torque; the muscle produces zero.
      // Phase B then drops this column from the effort objective so the
      // optimizer doesn't try to "carry" demand that doesn't exist.
      const isActionLimitBlocked = (
          bone: string,
          act: ActionAxis,
          signedComponent: number,
          worldAxis: Vector3,
          jointGroup: JointGroup,
      ): boolean => {
          const dims = limitDimensionsForGroup(jointGroup);
          // Scapula: translation DOFs. Motion under a positive "action"
          // is the axis IN TORSO-LOCAL coordinates — same space as the
          // clavicle-offset dim.x/y/z limits. Passing the world axis
          // here would mis-index the limit dimensions when the spine is
          // tilted, since a world-vertical vector no longer maps to
          // body-vertical. Use act.axis directly instead.
          if (jointGroup === 'Scapula') {
              const sign = signedComponent > 0 ? 1 : -1;
              for (const dim of dims) {
                  if (dim.kind !== 'dir' || !dim.component) continue;
                  const eff = getEffectiveLimit(dim.key, bone, currentPosture, currentTwists);
                  if (!eff) continue;
                  const val = getDimensionValue(dim, bone, currentPosture, currentTwists);
                  const motionC = act.axis[dim.component] * sign;
                  if (val >= eff.max - 0.5 && motionC > 0.01) return true;
                  if (val <= eff.min + 0.5 && motionC < -0.01) return true;
              }
              return false;
          }
          if (/Forearm|Tibia|Foot/.test(bone)) {
              const ad = dims.find(d => d.kind === 'action');
              if (ad) {
                  const eff = getEffectiveLimit(ad.key, bone, currentPosture, currentTwists);
                  if (eff) {
                      const curAngle = getActionAngle(bone, act, currentPosture, currentTwists);
                      const isForearm = /Forearm/.test(bone);
                      if (isForearm) {
                          // Forearm hinge: stored angle can be negative
                          // (row-style flex, humerus-forward + hand-to-face
                          // flex). Limits are defined in slider space
                          // (|angle| range). Use |angle| for proximity
                          // checks.
                          //
                          // Sign-invariant tau0 convention (CLAUDE.md +
                          // elbow fix above): tau0 > 0 = applied-FLEXION
                          // direction → Extension label (extensor muscle
                          // resists). tau0 < 0 = applied-EXTENSION
                          // direction → Flexion label (flexor muscle
                          // resists). So "pushing into hyperextension
                          // past min=0" is tau0 < 0, and "pushing into
                          // hyperflex past max" is tau0 > 0. That's the
                          // same condition the other hinges use — the
                          // forearm branch just uses |angle| for proximity.
                          const absAngle = Math.abs(curAngle);
                          // At straight + applied-extension torque → hyperextension past min.
                          if (absAngle <= eff.min + 1 && signedComponent < 0) return true;
                          // At max flex + applied-flexion torque → into max.
                          if (absAngle >= eff.max - 1 && signedComponent > 0) return true;
                      } else {
                          // Tibia / Foot: unchanged convention.
                          if (curAngle >= eff.max - 1 && signedComponent > 0) return true;
                          if (curAngle <= eff.min + 1 && signedComponent < 0) return true;
                      }
                  }
              }
              return false;
          }
          if (act.isBoneAxis) {
              const td = dims.find(d => d.kind === 'action' && d.action?.isBoneAxis);
              if (td) {
                  const eff = getEffectiveLimit(td.key, bone, currentPosture, currentTwists);
                  if (eff) {
                      const curAngle = getActionAngle(bone, act, currentPosture, currentTwists);
                      if (curAngle >= eff.max - 1 && signedComponent > 0) return true;
                      if (curAngle <= eff.min + 1 && signedComponent < 0) return true;
                  }
              }
              return false;
          }
          const boneDir = currentPosture[bone];
          if (!boneDir) return false;
          const motionRaw = crossProduct(worldAxis, boneDir);
          const sign = signedComponent > 0 ? 1 : -1;
          // Dir limits at ±1 (or beyond, like Hip.dir.y.max = 1.02) are
          // "no-bound" sentinels — a unit-vector component can't exceed
          // them, so they don't represent a real anatomical stop. Skip
          // blocking on those sides so poses that naturally land at a
          // component extreme (pure sagittal flex = z=-1) don't zero
          // out real muscle demand.
          const NO_BOUND = 0.99;
          for (const dim of dims) {
              if (dim.kind !== 'dir' || !dim.component) continue;
              const eff = getEffectiveLimit(dim.key, bone, currentPosture, currentTwists);
              if (!eff) continue;
              const val = getDimensionValue(dim, bone, currentPosture, currentTwists);
              let motionC = motionRaw[dim.component] * sign;
              if (dim.component === 'x' && bone.startsWith('l')) motionC = -motionC;
              if (val >= eff.max - 0.02 && motionC > 0.01 && eff.max < NO_BOUND) return true;
              if (val <= eff.min + 0.02 && motionC < -0.01 && eff.min > -NO_BOUND) return true;
          }
          return false;
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

      // PHYSICS MODEL:
      //
      // Strict rigid-body statics. The figure is treated as a set of
      // rigid bones connected by pin joints. Muscles at every joint are
      // assumed to hold the joint angles against the applied forces
      // (that's what "muscle demand" means). Forces propagate up each
      // chain as moments at each ancestor; constraint reactions balance
      // them via Phase B's whole-body force + moment equilibrium.
      //
      // No phantom gravity. No implicit anchors. Only user-defined
      // forces and constraints contribute. If no constraints are present
      // and forces are applied, the whole-body balance becomes
      // infeasible — the solver falls back gracefully (λ = 0) and
      // Phase A's up-the-chain propagation dominates.

      // Track total applied force AND moment (after F_∥ extraction at
      // force bones that are constrained). Phase B enforces BOTH the
      // constraint-subspace force balance and a full 3-axis moment
      // balance about pelvisOrigin:
      //    force:  for each consRef i:  Σ_j (n_i · n_j) λ_j = -(F_total · n_i)
      //    moment: for each axis a:     Σ_j (r_j × n_j)_a  λ_j = -(M_total)_a
      // where r_j = tip_j - pelvisOrigin. Together these are whole-body
      // wrench equilibrium: the constraint reactions absorb every
      // component of the external wrench the constraint subspace can
      // reach. Any residual (rank-deficient geometry) is softly
      // distributed by the KKT regularization (see Phase B comments).
      //
      // The moment block is what couples kinematically-disconnected
      // subtrees (legs vs. torso — legs are siblings of the spine below
      // the pelvis anchor, not children of it). Without it, a force at
      // the hands creates a moment about the pelvis that has no path
      // into any hip action axis via the chain walk, so the moment
      // vanishes into an implicit world anchor and the hip reads zero
      // demand. Adding moment balance forces the foot λs to carry that
      // moment, and each joint's sens·λ term delivers the corresponding
      // hip / knee / ankle demand — universally, not just for SLDL.
      //
      // pelvisOrigin tracks the live (possibly translated) pelvis:
      // kin.boneStartPoints['spine'] IS pelvisPos, and pelvisTx/Ty/Tz
      // shifts it.
      const pelvisOrigin = kin.boneStartPoints['spine'] || { x: 0, y: CONFIG.TORSO_LEN / 2, z: 0 };
      let totalAppliedForce: Vector3 = { x: 0, y: 0, z: 0 };
      let totalAppliedMoment: Vector3 = { x: 0, y: 0, z: 0 };

      for (const f of currentForces) {
          const seg = kin.boneStartPoints[f.boneId];
          const end = kin.boneEndPoints[f.boneId];
          if (!seg || !end) continue;

          const attachPt = add(seg, mul(sub(end, seg), f.position));
          const forceDir = getForceDirectionWithKin(f, kin, currentTwists);
          const chain = getChainToRoot(f.boneId);

          const baseMag = f.magnitude || 1;
          const profileMult = evaluateProfile(f.profile, currentT);
          const effectiveMag = baseMag * profileMult;
          const scaledForce = mul(forceDir, effectiveMag);

          // F_∥ extraction: if this force's bone has physics-enabled
          // constraints, the constraint absorbs F_perp exactly at the
          // constraint surface (Newton's 3rd law on a rigid plane). Only
          // F_∥ — the component along the constraint's free direction —
          // propagates up the chain as muscle demand. Without this,
          // F_perp would leave spurious upstream torque and the demand
          // ratios would drift with F direction.
          let propagatedForce = scaledForce;
          const consAtBone = activeConstraints?.[f.boneId];
          if (consAtBone) {
              const activeCons = consAtBone.filter(c => c.active && c.physicsEnabled !== false && isDirectionalActive(c, getConstraintPoint(f.boneId, c, kin)));
              if (activeCons.length > 0) {
                  const normals: Vector3[] = [];
                  for (const c of activeCons) {
                      if (c.type === 'planar') {
                          const n = normalize(c.normal);
                          if (magnitude(n) > 0.1) normals.push(n);
                      } else if (c.type === 'fixed') {
                          normals.push({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 });
                      } else if (c.type === 'arc' && c.axis && c.radius !== undefined) {
                          const livePivot = resolveArcPivot(c, kin);
                          if (!livePivot) continue;
                          const axisN = normalize(c.axis);
                          if (magnitude(axisN) > 0.1) normals.push(axisN);
                          const tipPt = getConstraintPoint(f.boneId, c, kin);
                          if (tipPt) {
                              const relTip = sub(tipPt, livePivot);
                              const axComp = dotProduct(relTip, axisN);
                              const radial = sub(relTip, mul(axisN, axComp));
                              const radMag = magnitude(radial);
                              if (radMag > 0.1) normals.push({ x: radial.x/radMag, y: radial.y/radMag, z: radial.z/radMag });
                          }
                      }
                  }
                  // Orthonormalize normals (Gram-Schmidt), then project F
                  // onto each and subtract.
                  const orthoNormals: Vector3[] = [];
                  for (const n of normals) {
                      let v: Vector3 = { x: n.x, y: n.y, z: n.z };
                      for (const on of orthoNormals) {
                          const proj = dotProduct(v, on);
                          v = sub(v, mul(on, proj));
                      }
                      const vMag = magnitude(v);
                      if (vMag > 1e-4) orthoNormals.push({ x: v.x/vMag, y: v.y/vMag, z: v.z/vMag });
                  }
                  for (const n of orthoNormals) {
                      const proj = dotProduct(propagatedForce, n);
                      propagatedForce = sub(propagatedForce, mul(n, proj));
                  }
              }
          }

          totalAppliedForce = add(totalAppliedForce, propagatedForce);
          const rAboutPelvis = sub(attachPt, pelvisOrigin);
          totalAppliedMoment = add(totalAppliedMoment, crossProduct(rAboutPelvis, propagatedForce));

          for (const bone of chain) {
              const prevJ = jointForces[bone] || { x: 0, y: 0, z: 0 };
              jointForces[bone] = add(prevJ, propagatedForce);

              if (bone.includes('Clavicle')) {
                  const prev = scapulaForces[bone] || { x: 0, y: 0, z: 0 };
                  scapulaForces[bone] = add(prev, propagatedForce);
              } else {
                  const jointCenter = jointTorqueCenter(bone);
                  if (!jointCenter) continue;
                  const momentArm = sub(attachPt, jointCenter);
                  const torque = crossProduct(momentArm, propagatedForce);
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
              } else if (jointFrame) {
                  // Standard path for direction actions (flex/ext, abd/add,
                  // horizontal ad/ab): transform the local action axis
                  // through the bone's joint frame. For shoulder this is
                  // spineFrame; for hip it's pelvisFrame; for hinges it's
                  // the parent bone's transported frame. As of the
                  // 2026-04-29 body-relative-horiz-ad/ab fix, useWorldAxis
                  // no longer short-circuits this transform — the flag
                  // now marks "this action's local axis is body-vertical
                  // (joint-frame Y)" purely as a sign-convention hint for
                  // downstream code; the geometric axis is always
                  // joint-frame · local.
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
              // Elbow sign-invariance: the forearm can flex in either
              // rotation direction from straight depending on humerus
              // orientation (standard curl = +θ; bent-over row =  -θ).
              // Both are anatomically "flexion" (biceps contracting),
              // but the raw tau0 sign flips between them. Multiply by
              // sign(hingeAngle) so the positiveAction/negativeAction
              // mapping reflects muscle groups consistently regardless
              // of which side of straight the forearm is on.
              if (/Forearm/.test(bone) && !act.isBoneAxis) {
                  const hingeAngle = getActionAngle(bone, act, currentPosture, currentTwists);
                  if (hingeAngle < 0) component = -component;
              }
              const action = component > 0 ? act.positiveAction : act.negativeAction;
              const torqueMag = Math.abs(component);
              if (torqueMag < 0.01) continue;

              // Joint-limit zeroing: if the joint is at its passive end-range
              // stop AND the torque is pushing further into that stop, the
              // passive anatomy (ligaments/capsule/bony contact) absorbs the
              // load and the muscle demand drops to zero. Skip this demand.
              // See isActionLimitBlocked helper at the top of the function —
              // same logic is re-applied in Phase B column building so the
              // KKT optimizer also ignores limit-blocked cols.
              if (isActionLimitBlocked(bone, act, component, axis, jointGroup)) continue;

              // Look up capacity for effort calculation. Capacity is
              // position-dependent: evaluateCapacity interpolates between
              // base and specific using the current joint action angle.
              const cap = capacities[jointGroup]?.[actionKey(action)] ||
                          capacities[jointGroup]?.[action] ||
                          null;
              const actionAngle = getActionAngle(bone, act, currentPosture, currentTwists);
              const capSide: 'left' | 'right' = bone.startsWith('l') ? 'left' : 'right';
              const capModMult = getModificationMultiplier(
                  modifications,
                  { kind: 'capacity', jointGroup, actionKey: actionKey(action) },
                  capSide, currentPosture, currentTwists,
              );
              const capValue = cap ? evaluateCapacity(cap, actionAngle) * capModMult : 1;
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

          // Scapula axes are defined in torso-local coordinates; transform
          // through the clavicle's jointFrame (= spineFrame) so "elevation"
          // tracks the spine's tilt and "retraction" points from the
          // shoulder toward the tilted spine, not toward world-back.
          const jf = kin.jointFrames[bone];

          for (const act of actions) {
              const axis: Vector3 = jf ? {
                  x: act.axis.x * jf.x.x + act.axis.y * jf.y.x + act.axis.z * jf.z.x,
                  y: act.axis.x * jf.x.y + act.axis.y * jf.y.y + act.axis.z * jf.z.y,
                  z: act.axis.x * jf.x.z + act.axis.y * jf.y.z + act.axis.z * jf.z.z,
              } : act.axis;
              const component = dotProduct(forceVec, axis);
              // No left-side flip: protraction/retraction are anatomically
              // the same direction on both sides (+Z = both scapulas moving
              // forward = both protracting). The mirror step flips X, not
              // Z, so +Z on the right maps to +Z on the left, and both
              // should produce the same action label.
              const action = component > 0 ? act.positiveAction : act.negativeAction;
              const forceMag = Math.abs(component);
              if (forceMag < 0.01) continue;

              // Scapula joint limits: clavicle offset is stored in
              // spineFrame-local coordinates, and the dim.x/y/z limits
              // are defined in that same local space. So the motion
              // gradient uses the UNTRANSFORMED act.axis (local), not the
              // world-transformed axis. Force projection above uses the
              // world axis; limit geometry stays local.
              {
                  const dims = limitDimensionsForGroup(jointGroup);
                  const sign = component > 0 ? 1 : -1;
                  let blockedByLimit = false;
                  for (const dim of dims) {
                      if (dim.kind !== 'dir' || !dim.component) continue;
                      const eff = getEffectiveLimit(dim.key, bone, currentPosture, currentTwists);
                      if (!eff) continue;
                      const val = getDimensionValue(dim, bone, currentPosture, currentTwists);
                      const motionC = act.axis[dim.component] * sign;
                      if (val >= eff.max - 0.5 && motionC > 0.01) { blockedByLimit = true; break; }
                      if (val <= eff.min + 0.5 && motionC < -0.01) { blockedByLimit = true; break; }
                  }
                  if (blockedByLimit) continue;
              }

              // Scapula is a unified stabilizer group — elevation,
              // depression, protraction, and retraction all draw from
              // the same muscle pool (traps, rhomboids, serratus,
              // levator, pec minor). Use a SINGLE combined cap for all
              // four directional actions so any demand divides by the
              // same budget. The combined cap is the max of the four
              // directional entries the user has configured — that
              // represents the strongest agonist group's peak force.
              const scapCaps = Object.values(capacities[jointGroup] || {});
              const scapMax = scapCaps.length > 0 ? Math.max(...scapCaps.map(c => c.specific)) : 0;
              const cap = scapMax > 0 ? { base: scapMax, specific: scapMax, angle: 0 } : null;
              const scapAngle = getActionAngle(bone, act, currentPosture, currentTwists);
              const scapModSide: 'left' | 'right' = bone.startsWith('l') ? 'left' : 'right';
              const scapModMult = getModificationMultiplier(
                  modifications,
                  { kind: 'capacity', jointGroup, actionKey: actionKey(action) },
                  scapModSide, currentPosture, currentTwists,
              );
              const capValue = cap ? evaluateCapacity(cap, scapAngle) * scapModMult : 1;
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

          // Build consRefs from EVERY active constraint WITH PHYSICS ENABLED.
          // A constraint with physicsEnabled === false is a kinematic guide
          // only — it shapes the motion path (solver still enforces it) but
          // does NOT inject a reaction force into Phase B, so no joint load
          // redistribution and no reaction arrow. physicsEnabled defaults to
          // true for backward compatibility; only constraints the user has
          // explicitly toggled off are skipped here.
          for (const [bid, list] of Object.entries(activeConstraints) as [string, BoneConstraint[]][]) {
              const activeList = list.filter(c => c.active && c.physicsEnabled !== false);
              if (activeList.length === 0) continue;
              const ancestors = new Set<string>();
              {
                  let cur: string | undefined = bid;
                  while (cur) { ancestors.add(cur); cur = BONE_PARENTS[cur]; }
              }
              for (const c of activeList) {
                  const tipB = getConstraintPoint(bid, c, kin2);
                  if (!tipB) continue;
                  // Active-set check: a directional constraint only emits a
                  // KKT row when its boundary is active (tip touching the
                  // wall). When the limb is comfortably inside the allowed
                  // halfspace, the constraint exerts no reaction force, so
                  // skip the row entirely. Bidirectional constraints always
                  // emit (always active).
                  if (!isDirectionalActive(c, tipB)) continue;
                  if (c.type === 'fixed') {
                      consRefs.push({ n: { x: 1, y: 0, z: 0 }, center: c.center, tip: tipB, constrainedBone: bid, ancestors });
                      consRefs.push({ n: { x: 0, y: 1, z: 0 }, center: c.center, tip: tipB, constrainedBone: bid, ancestors });
                      consRefs.push({ n: { x: 0, y: 0, z: 1 }, center: c.center, tip: tipB, constrainedBone: bid, ancestors });
                  } else if (c.type === 'planar') {
                      const n = normalize(c.normal);
                      if (magnitude(n) > 0.1) consRefs.push({ n, center: c.center, tip: tipB, constrainedBone: bid, ancestors });
                  } else if (c.type === 'arc' && c.axis && c.radius !== undefined) {
                      const livePivot = resolveArcPivot(c, kin2);
                      if (!livePivot) continue;
                      const axisN = normalize(c.axis);
                      if (magnitude(axisN) > 0.1) consRefs.push({ n: axisN, center: livePivot, tip: tipB, constrainedBone: bid, ancestors });
                      const relTip = sub(tipB, livePivot);
                      const axComp = dotProduct(relTip, axisN);
                      const radial = sub(relTip, mul(axisN, axComp));
                      const radMag = magnitude(radial);
                      if (radMag > 0.1) {
                          const radN = { x: radial.x / radMag, y: radial.y / radMag, z: radial.z / radMag };
                          consRefs.push({ n: radN, center: livePivot, tip: tipB, constrainedBone: bid, ancestors });
                      }
                  }
              }
          }

          if (consRefs.length > 0) {
              type CouplingCol = {
                  boneId: string; jointGroup: JointGroup; act: ActionAxis;
                  tau0: number; cap: number; sens: number[];
                  isLeft: boolean;
                  // World-space action axis cached for post-Phase-B limit
                  // re-checks. Required for 2-DOF rotational joints (axis
                  // × boneDir gives the motion direction under rotation)
                  // and Scapula (axis IS the motion direction).
                  worldAxis: Vector3;
                  // True when the joint action is at its passive end-range
                  // AND the EFFECTIVE torque (tau0 + Σ sens·λ) pushes
                  // further into that stop. Treated like a constraint:
                  // passive anatomy absorbs the load, so the col is
                  // excluded from the effort objective (colWeight → 0 in
                  // AtWA/AtWb and IRLS) and skipped in writeback so it
                  // never appears in the demand list. The external λs
                  // still solve for wrench balance; only the local muscle-
                  // effort accounting at this action is zeroed.
                  //
                  // This re-evaluates each IRLS iter off newTau = tau0 +
                  // Σ lam·sens, so joints whose demand arrives only via
                  // constraint reactions (not Phase A's chain walk) are
                  // correctly blocked once λ reveals the push direction.
                  isLimitBlocked: boolean;
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
                      // Transform scapula action axes from torso-local to
                      // world via the clavicle's jointFrame (spineFrame),
                      // so elevation/protraction track the spine's tilt.
                      const jf = kin2.jointFrames[bone];
                      for (const act of acts) {
                          const scapWorldAxis: Vector3 = jf ? {
                              x: act.axis.x * jf.x.x + act.axis.y * jf.y.x + act.axis.z * jf.z.x,
                              y: act.axis.x * jf.x.y + act.axis.y * jf.y.y + act.axis.z * jf.z.y,
                              z: act.axis.x * jf.x.z + act.axis.y * jf.y.z + act.axis.z * jf.z.z,
                          } : act.axis;
                          const tau0 = dotProduct(forceVec, scapWorldAxis);
                          const actName = tau0 > 0 ? act.positiveAction : act.negativeAction;
                          // Unified scapula cap — see Phase A scapula
                          // decomposition above. All four directional
                          // actions (elevation/depression, protraction/
                          // retraction) share the same effective
                          // capacity so demand in any direction draws
                          // from the same stabilizer-muscle pool.
                          const scapCapsPB = Object.values(capacities[jg] || {});
                          const scapMaxPB = scapCapsPB.length > 0 ? Math.max(...scapCapsPB.map(c => c.specific)) : 0;
                          const capLk = scapMaxPB > 0 ? { base: scapMaxPB, specific: scapMaxPB, angle: 0 } : null;
                          const isPos = actName === act.positiveAction;
                          const availability = sectionAvailabilityModifier(
                              jg, act, isPos, bone, rawTorques, kin2, currentPosture, currentTwists,
                          );
                          const modSide: 'left' | 'right' = isLeft ? 'left' : 'right';
                          const modMult = getModificationMultiplier(
                              modifications,
                              { kind: 'capacity', jointGroup: jg, actionKey: actionKey(actName) },
                              modSide, currentPosture, currentTwists,
                          );
                          const capVal = capLk
                              ? evaluateCapacity(capLk, sectionDirectionAngle(bone, act, isPos, currentPosture, currentTwists)) * availability * modMult
                              : 1;
                          const sens: number[] = [];
                          for (const cref of consRefs) {
                              if (!cref.ancestors.has(bone)) { sens.push(0); continue; }
                              sens.push(dotProduct(cref.n, scapWorldAxis));
                          }
                          const isLimitBlocked = isActionLimitBlocked(bone, act, tau0, scapWorldAxis, jg);
                          cols.push({ boneId: bone, jointGroup: jg, act, tau0, cap: capVal, sens, isLeft, worldAxis: scapWorldAxis, isLimitBlocked });
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
                      } else {
                          // useWorldAxis no longer short-circuits — it's
                          // now a sign-convention hint only. Geometric
                          // axis is always joint-frame · local.
                          worldAxis = normalize({
                              x: act.axis.x*jf.x.x + act.axis.y*jf.y.x + act.axis.z*jf.z.x,
                              y: act.axis.x*jf.x.y + act.axis.y*jf.y.y + act.axis.z*jf.z.y,
                              z: act.axis.x*jf.x.z + act.axis.y*jf.y.z + act.axis.z*jf.z.z,
                          });
                      }

                      const tauSrc = act.isBoneAxis ? rawTau : residTau;
                      let tau0 = dotProduct(tauSrc, worldAxis);
                      if (isLeft && (act.isBoneAxis || Math.abs(act.axis.y) > 0.5 || Math.abs(act.axis.z) > 0.5)) tau0 = -tau0;
                      // Elbow sign-invariance (same fix as Phase A decomp):
                      // when the forearm is stored at negative hinge angle
                      // (non-standard flexion direction, e.g. bent-over row
                      // end pose), flip tau0 so positive/negative labels
                      // still map to extensor/flexor muscle groups. Sens
                      // entries must be flipped in lockstep so sens·λ
                      // retains the correct muscle-direction sign.
                      let hingeFlipForearm = 1;
                      if (/Forearm/.test(bone) && !act.isBoneAxis) {
                          const hingeAngle = getActionAngle(bone, act, currentPosture, currentTwists);
                          if (hingeAngle < 0) {
                              tau0 = -tau0;
                              hingeFlipForearm = -1;
                          }
                      }

                      const actName = tau0 > 0 ? act.positiveAction : act.negativeAction;
                      const capLk = capacities[jg]?.[capacityKey(actName)] || capacities[jg]?.[actionKey(actName)] || capacities[jg]?.[actName] || null;
                      const isPos = actName === act.positiveAction;
                      const availability = sectionAvailabilityModifier(
                          jg, act, isPos, bone, rawTorques, kin2, currentPosture, currentTwists,
                      );
                      const rotModSide: 'left' | 'right' = isLeft ? 'left' : 'right';
                      const rotModMult = getModificationMultiplier(
                          modifications,
                          { kind: 'capacity', jointGroup: jg, actionKey: actionKey(actName) },
                          rotModSide, currentPosture, currentTwists,
                      );
                      const capVal = capLk
                          ? evaluateCapacity(capLk, sectionDirectionAngle(bone, act, isPos, currentPosture, currentTwists)) * availability * rotModMult
                          : 1;

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
                          s *= hingeFlipForearm;
                          sens.push(s);
                      }
                      const isLimitBlocked = isActionLimitBlocked(bone, act, tau0, worldAxis, jg);
                      cols.push({ boneId: bone, jointGroup: jg, act, tau0, cap: capVal, sens, isLeft, worldAxis, isLimitBlocked });
                  }
              }

              if (cols.length > 0) {
                  const N = consRefs.length;

                  // Minimize Σ ((tau0 + λ·sens)/cap)² — muscle neural drive —
                  // subject to two classes of hard equality constraint:
                  //
                  //   1. Structural-absorption of locked hinge joints:
                  //       τ = 0 at any hinge col (elbow / knee / ankle)
                  //       whose single muscle-actuated axis is kinematically
                  //       killed by the constraint set — detected as the
                  //       sens column not lying in the span of the other
                  //       cols' sens. These joints have no torso-side
                  //       interpretation (both of their attached bones live
                  //       inside one limb subtree), so when the limb is
                  //       rigidized at both ends the bending moment is
                  //       absorbed structurally by the bone/ligament, not
                  //       by the muscle.
                  //
                  //   2. Force balance projected into the constraint subspace:
                  //       For each consRef i: dot(Σ λ_j n_j, n_i) = -dot(F_total, n_i).
                  //       This is rigid-body force equilibrium — but only in
                  //       the directions the constraint set can actually react.
                  //       For a fixed constraint (3 orthogonal normals),
                  //       this collapses to Σ λn = -F (constraint fully
                  //       absorbs F). For a planar constraint with normal n,
                  //       only the n-component is enforced; the free
                  //       directions propagate up the chain via Phase A.
                  //       For an arc (axial + radial directions), both get
                  //       enforced; the tangential direction is free.
                  //
                  //       This is what makes the chain of demand from force
                  //       to root constant in magnitude above a full
                  //       constraint — every joint whose sub-tree contains
                  //       the constraint sees the same (r_force − r_cons) × F
                  //       after Phase B reconciles the reaction with the
                  //       moment arms.
                  //
                  //   3. Moment balance about pelvisOrigin (3 equations):
                  //       For each world axis a ∈ {x,y,z}:
                  //         Σ_j (r_j × n_j)_a λ_j = -(M_total)_a
                  //       where r_j = tip_j - pelvisOrigin and M_total is
                  //       the Phase-A-accumulated sum of
                  //       (attach_k - pelvisOrigin) × propagatedForce_k.
                  //
                  //       This is the block that couples kinematically-
                  //       disconnected subtrees. Legs are siblings of the
                  //       spine below the pelvis anchor (not children of
                  //       it), so a force at the hands creates a moment
                  //       about the pelvis that has no chain-walk path to
                  //       any hip action axis. Without this block, that
                  //       moment silently vanishes into an implicit world
                  //       anchor and the hip reads zero demand — the root
                  //       cause of the SLDL hip-zeroing issue. A prior
                  //       band-aid moved the foot-CoP constraint to give
                  //       a small non-zero moment arm at the hip, but
                  //       that only recovers ~10% of the true demand
                  //       because the Y-reaction λ_y is pinned by force
                  //       balance and only horizontal λ_x/λ_z can balance
                  //       the true bar moment. With this block enforced,
                  //       λ_x/λ_z at the feet pick up the required
                  //       horizontal reaction, and each joint's sens·λ
                  //       term delivers the full physically-correct
                  //       demand.
                  //
                  //       For degenerate geometries (e.g. single-foot
                  //       pin with vertical-only applied force and hip
                  //       directly above foot) the moment block can be
                  //       rank-deficient in some axes. The 1e-10 dual-
                  //       diagonal regularization makes the failure soft:
                  //       residual moment spreads across λ as a least-
                  //       squares best fit, reverting smoothly to the
                  //       old implicit-anchor behavior when the constraint
                  //       subspace genuinely can't absorb the moment.
                  //       Such poses aren't physically balanceable
                  //       anyway — the body would tip — so a soft
                  //       degradation is the right behavior.
                  //
                  //   [AtWA     A_H     A_F     A_M  ] [λ  ]   [AtWb ]
                  //   [A_H^T    0       0       0   ] [μ_H] = [-b_H ]
                  //   [A_F^T    0       0       0   ] [μ_F]   [-b_F ]
                  //   [A_M^T    0       0       0   ] [μ_M]   [-b_M ]
                  //
                  // For p ≠ 2 (user-tunable effort exponent), the AtWA /
                  // AtWb construction is wrapped in an IRLS loop below:
                  // min Σ w_c · (τ_c/cap_c)² with w_c updated each
                  // iteration to |τ_c/cap_c|^(p-2). Converges to the
                  // min Σ (τ_c/cap_c)^p fixed point. For p = 2, w_c = 1
                  // always and one iteration matches the original solve.

                  // Hinge joints whose sens column is linearly independent
                  // of the others' are structurally-locked. Gram-Schmidt
                  // test: if the residual after projecting sens_k onto the
                  // span of {sens_j : j ≠ k} is ~0, DOF is live (some
                  // virtual δq ∈ null(J_c) has a nonzero k-th component).
                  // If the residual survives, k is frozen — and if the col
                  // is a hinge, muscle at k is zero by structural absorption.
                  // Weight-independent → computed once outside the IRLS loop.
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
                  // Force-balance is 3 rows (one per world axis) — NOT N rows
                  // (one per constraint). Earlier versions used N rows of the
                  // form Σ_j (n_i · n_j) λ_j = -(F·n_i), which is mathematically
                  // equivalent for full-rank constraint sets but produces N×N
                  // rank-deficient blocks when constraints share normal
                  // directions (e.g. heel-X and toe-X are both (1,0,0); two
                  // foot pins three axes each = six coplanar pairs per side).
                  // Gaussian elimination on the rank-deficient block emits
                  // huge canceling lambdas (the multi-pin trap from CLAUDE.md
                  // note 9) and the resulting force-residual is large.
                  // Three axis-aligned rows enforce the same physical
                  // constraint (Σ F = -F_applied) without redundancy, no
                  // matter how many parallel-normal constraints share the
                  // body. Demand calculations downstream are unaffected — the
                  // λ values still go through sens columns into joint torques.
                  const B = 3;
                  const Mom = 3;
                  const dim = N + H + B + Mom;

                  // IRLS parameters. EPS_EFFORT floors |u_c| so columns that
                  // are near-zero in the current iterate don't get infinite
                  // weight (which would explode the solve for p < 2).
                  //
                  // LIMIT-BLOCKING ITERATION: joint limits treated like
                  // constraints need iterative refinement — a col's
                  // isLimitBlocked depends on sign(tau0 + Σ lam·sens), but
                  // lam depends on which cols are blocked. We fold the
                  // limit-blocking convergence into the IRLS loop (same
                  // fixed-point structure) by checking blocking status
                  // after each λ solve and setting its weight to 0 if
                  // blocked. Use at least 5 iters even for p=2 to give
                  // the blocking set a chance to converge.
                  const EPS_EFFORT = 0.01;
                  const isQuadratic = Math.abs(effortExponent - 2) < 1e-6;
                  const IRLS_ITERS = isQuadratic ? 5 : 5;
                  const colWeights: number[] = new Array(cols.length).fill(1);
                  let lam: number[] = new Array(N).fill(0);

                  // Limit-blocked cols are excluded from the effort
                  // objective — passive anatomy absorbs the local moment,
                  // so the optimizer has no reason to minimize their
                  // demand. Baked into colWeights upfront so it propagates
                  // through both AtWA/AtWb construction and the IRLS
                  // weight update below.
                  for (let ci = 0; ci < cols.length; ci++) {
                      if (cols[ci].isLimitBlocked) colWeights[ci] = 0;
                  }

                  for (let iter = 0; iter < IRLS_ITERS; iter++) {
                      // Build weighted AtWA, AtWb.
                      const AtWA: number[][] = Array.from({length: N}, () => new Array(N).fill(0));
                      const AtWb: number[] = new Array(N).fill(0);
                      for (let i = 0; i < N; i++) {
                          for (let j = 0; j < N; j++) {
                              let s = 0;
                              for (let ci = 0; ci < cols.length; ci++) {
                                  const c = cols[ci];
                                  if (c.isLimitBlocked) continue;
                                  s += colWeights[ci] * c.sens[i] * c.sens[j] / (c.cap * c.cap);
                              }
                              AtWA[i][j] = s;
                          }
                          let r = 0;
                          for (let ci = 0; ci < cols.length; ci++) {
                              const c = cols[ci];
                              if (c.isLimitBlocked) continue;
                              r += colWeights[ci] * c.sens[i] * c.tau0 / (c.cap * c.cap);
                          }
                          AtWb[i] = -r;
                      }
                      for (let i = 0; i < N; i++) AtWA[i][i] += 1e-8;

                      // Force-balance rows: 3 rows, one per world axis.
                      //   row a:  Σ_j n_j_a · λ_j = -(F_total)_a
                      // Equivalent to "the sum of all constraint reactions
                      // along axis a balances the applied force along axis a."
                      // Always full-rank (3 rows) regardless of how many
                      // constraints share normal directions.
                      const Mm: number[][] = Array.from({length: dim}, () => new Array(dim).fill(0));
                      const RHS: number[] = new Array(dim).fill(0);
                      for (let i = 0; i < N; i++) {
                          for (let j = 0; j < N; j++) Mm[i][j] = AtWA[i][j];
                          RHS[i] = AtWb[i];
                      }
                      for (let k = 0; k < H; k++) {
                          const c = cols[hingeFrozenIdx[k]];
                          for (let i = 0; i < N; i++) {
                              Mm[i][N + k] = c.sens[i];
                              Mm[N + k][i] = c.sens[i];
                          }
                          RHS[N + k] = -c.tau0;
                      }
                      for (let a = 0; a < B; a++) {
                          const rowIdx = N + H + a;
                          for (let j = 0; j < N; j++) {
                              const nj = consRefs[j].n;
                              const entry = a === 0 ? nj.x : a === 1 ? nj.y : nj.z;
                              Mm[j][rowIdx] = entry;
                              Mm[rowIdx][j] = entry;
                          }
                          RHS[rowIdx] = -(a === 0 ? totalAppliedForce.x : a === 1 ? totalAppliedForce.y : totalAppliedForce.z);
                      }
                      for (let a = 0; a < B; a++) Mm[N + H + a][N + H + a] += 1e-10;

                      // Moment-balance rows about pelvisOrigin. One row
                      // per world axis a:
                      //   Σ_j (r_j × n_j)_a λ_j = -(M_total)_a
                      // r_j = tip_j - pelvisOrigin, M_total accumulated in
                      // Phase A from each force's (attach - pelvisOrigin) ×
                      // propagatedForce. Weight-independent; rebuilt each
                      // iter because Mm is rebuilt.
                      for (let a = 0; a < Mom; a++) {
                          const rowIdx = N + H + B + a;
                          for (let j = 0; j < N; j++) {
                              const cref = consRefs[j];
                              const rVec = sub(cref.tip, pelvisOrigin);
                              const rxN = crossProduct(rVec, cref.n);
                              const entry = a === 0 ? rxN.x : a === 1 ? rxN.y : rxN.z;
                              Mm[j][rowIdx] = entry;
                              Mm[rowIdx][j] = entry;
                          }
                          RHS[rowIdx] = -(a === 0 ? totalAppliedMoment.x : a === 1 ? totalAppliedMoment.y : totalAppliedMoment.z);
                      }
                      for (let a = 0; a < Mom; a++) Mm[N + H + B + a][N + H + B + a] += 1e-10;

                      const sol = solveSmall(Mm, RHS);
                      lam = sol.slice(0, N);

                      // Update limit-blocking and IRLS weights from the
                      // current λ estimate. Each col's blocking state is
                      // re-evaluated against the EFFECTIVE torque newTau =
                      // tau0 + Σ lam·sens (not just tau0), which lets us
                      // catch joints whose demand arrives purely via
                      // constraint reactions — e.g. an SLDL-straight knee
                      // where Phase A delivers tau0 = 0 but foot-λ sens·λ
                      // produces hyperextension-direction demand.
                      //
                      // For p = 2 the IRLS weight is constant (1), so
                      // changes here only come from blocking transitions.
                      // Early exit once blocking stabilizes to avoid
                      // wasted work.
                      let blockingChanged = false;
                      for (let ci = 0; ci < cols.length; ci++) {
                          const c = cols[ci];
                          let newTau = c.tau0;
                          for (let i = 0; i < N; i++) newTau += lam[i] * c.sens[i];
                          const nowBlocked = isActionLimitBlocked(
                              c.boneId, c.act, newTau, c.worldAxis, c.jointGroup,
                          );
                          if (nowBlocked !== c.isLimitBlocked) {
                              c.isLimitBlocked = nowBlocked;
                              blockingChanged = true;
                          }
                          if (nowBlocked) {
                              colWeights[ci] = 0;
                          } else {
                              const u = Math.abs(newTau / c.cap);
                              const uSafe = Math.max(u, EPS_EFFORT);
                              colWeights[ci] = Math.pow(uSafe, effortExponent - 2);
                          }
                      }
                      if (iter === IRLS_ITERS - 1) break;
                      if (isQuadratic && !blockingChanged && iter >= 1) break;
                  }

                  // DEBUG: expose Phase B internals for console inspection.
                  // In the browser console, type `__phaseBDebug` and hit
                  // Enter to see: applied force per bone, constraint normals
                  // per bone, solved λ values, reaction vector per
                  // constrained bone, and F_eff (F + R) per force bone.
                  // For a hand on sagittal+transverse with F = (0, 1, -1),
                  // physics says F_eff at hand should be (0, 0, -1) — the
                  // Y-component of F_eff.fEffByBone.lForearm.y should be 0.
                  // If it's nonzero, that's the Y-leak.
                  if (typeof window !== 'undefined') {
                      const fByBoneDbg = new Map<string, Vector3>();
                      for (const f of currentForces) {
                          const dir = getForceDirectionWithKin(f, kin2, currentTwists);
                          const mag = (f.magnitude || 1) * evaluateProfile(f.profile, currentT);
                          const fVec = mul(dir, mag);
                          const prev = fByBoneDbg.get(f.boneId) || { x: 0, y: 0, z: 0 };
                          fByBoneDbg.set(f.boneId, add(prev, fVec));
                      }
                      const reactionByBoneDbg = new Map<string, Vector3>();
                      const normalsByBoneDbg = new Map<string, Vector3[]>();
                      for (let i = 0; i < consRefs.length; i++) {
                          const bone = consRefs[i].constrainedBone;
                          const rVec = mul(consRefs[i].n, lam[i]);
                          const prev = reactionByBoneDbg.get(bone) || { x: 0, y: 0, z: 0 };
                          reactionByBoneDbg.set(bone, add(prev, rVec));
                          if (!normalsByBoneDbg.has(bone)) normalsByBoneDbg.set(bone, []);
                          normalsByBoneDbg.get(bone)!.push(consRefs[i].n);
                      }
                      const fEffByBoneDbg: Record<string, Vector3> = {};
                      for (const [bone, fVec] of fByBoneDbg) {
                          const r = reactionByBoneDbg.get(bone) || { x: 0, y: 0, z: 0 };
                          fEffByBoneDbg[bone] = add(fVec, r);
                      }
                      // Per-joint diagnostic dump: tau0 (Phase A residual on
                      // the joint axis) and newTau (after Phase B λ
                      // redistribution), so we can verify ratio invariance
                      // across F directions for the same pose. If F_eff at
                      // the constrained bone is invariant to F's free-DOF
                      // direction, every (boneId, action) pair's newTau
                      // should also be invariant.
                      const perJointDbg: Record<string, { tau0: number; newTau: number; cap: number; sensSum: number; blocked: boolean; }> = {};
                      for (const c of cols) {
                          if (!/Forearm|Humerus|Clavicle|spine|Tibia|Femur|Foot/.test(c.boneId)) continue;
                          let nt = c.tau0;
                          let ss = 0;
                          for (let i = 0; i < N; i++) { nt += lam[i] * c.sens[i]; ss += Math.abs(c.sens[i]); }
                          const key = `${c.boneId}.${c.act.positiveAction}/${c.act.negativeAction}`;
                          perJointDbg[key] = { tau0: c.tau0, newTau: nt, cap: c.cap, sensSum: ss, blocked: c.isLimitBlocked };
                      }
                      // Bone positions for moment-arm verification across tests.
                      const bonePosDbg: Record<string, { start: Vector3; end: Vector3 }> = {};
                      for (const b of ['rHumerus','rForearm','lHumerus','lForearm','spine','rFemur','lFemur','rTibia','lTibia']) {
                          const s = kin2.boneStartPoints[b], e = kin2.boneEndPoints[b];
                          if (s && e) bonePosDbg[b] = { start: s, end: e };
                      }
                      // Wrench-balance residuals for verification. In a
                      // well-posed scene both should be ≈0 at machine
                      // precision. Nonzero residual (especially in any
                      // moment axis) indicates the constraint subspace
                      // can't absorb the applied wrench — pose isn't
                      // physically balanceable.
                      let Msum: Vector3 = { x: 0, y: 0, z: 0 };
                      let Fsum: Vector3 = { x: 0, y: 0, z: 0 };
                      for (let i = 0; i < consRefs.length; i++) {
                          const rVec = sub(consRefs[i].tip, pelvisOrigin);
                          const rxn = crossProduct(rVec, consRefs[i].n);
                          Msum = add(Msum, mul(rxn, lam[i]));
                          Fsum = add(Fsum, mul(consRefs[i].n, lam[i]));
                      }
                      const forceResidual = add(totalAppliedForce, Fsum);
                      const momentResidual = add(totalAppliedMoment, Msum);
                      (window as unknown as Record<string, unknown>).__phaseBDebug = {
                          appliedForces: Object.fromEntries(fByBoneDbg),
                          constraintNormalsByBone: Object.fromEntries(normalsByBoneDbg),
                          lambdas: lam.slice(),
                          reactionByBone: Object.fromEntries(reactionByBoneDbg),
                          fEffByBone: fEffByBoneDbg,
                          perJoint: perJointDbg,
                          bonePositions: bonePosDbg,
                          pelvisOrigin,
                          totalAppliedForce,
                          totalAppliedMoment,
                          reactionForce: Fsum,
                          reactionMomentAboutPelvis: Msum,
                          forceResidual,
                          momentResidual,
                      };
                  }

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
                  //
                  // CAP RECOMPUTATION ON SIGN FLIP: c.cap was looked up
                  // during column building using the SIGN OF c.tau0 (Phase
                  // A). Phase B can flip that sign — e.g. when the hand
                  // λ-fix subtracts a large constraint reaction from tau0
                  // and pushes it past zero. When the sign flips, the
                  // CORRECT cap is the one for the FINAL action direction
                  // (newAction), not c.cap (which is for oldAction). If we
                  // don't refresh, effort = newMag / c.cap divides by the
                  // wrong-direction cap (e.g. Cap_Flexion for an Extension
                  // demand), and joint demand RATIOS drift across F
                  // directions even though F_eff at the constrained bone
                  // is invariant. This was the root cause of the
                  // "ratio shifts when only F's free-DOF component
                  // changes" bug: shoulder and elbow had different
                  // Cap_Flex / Cap_Ext ratios, so when both flipped, the
                  // displayed ratio between them shifted.
                  for (const c of cols) {
                      // Limit-blocked: passive anatomy absorbs the moment.
                      // Phase A already dropped any demand entry for this
                      // action; skip writeback so it never gets re-added.
                      if (c.isLimitBlocked) continue;
                      let newTau = c.tau0;
                      for (let i = 0; i < N; i++) newTau += lam[i] * c.sens[i];
                      const newMag = Math.abs(newTau);

                      const side = c.isLeft ? 'Left' : c.boneId.startsWith('r') ? 'Right' : '';
                      const newAction = newTau >= 0 ? c.act.positiveAction : c.act.negativeAction;
                      const oldAction = c.tau0 >= 0 ? c.act.positiveAction : c.act.negativeAction;
                      const newFullName = `${side} ${c.jointGroup} ${newAction}`.trim();
                      const oldFullName = `${side} ${c.jointGroup} ${oldAction}`.trim();

                      let effectiveCap = c.cap;
                      if (newAction !== oldAction) {
                          const capLk = capacities[c.jointGroup]?.[capacityKey(newAction)]
                                     || capacities[c.jointGroup]?.[actionKey(newAction)]
                                     || capacities[c.jointGroup]?.[newAction]
                                     || null;
                          if (capLk) {
                              const isPos = newAction === c.act.positiveAction;
                              const availability = sectionAvailabilityModifier(
                                  c.jointGroup, c.act, isPos, c.boneId, rawTorques, kin2, currentPosture, currentTwists,
                              );
                              const flipModSide: 'left' | 'right' = c.isLeft ? 'left' : 'right';
                              const flipModMult = getModificationMultiplier(
                                  modifications,
                                  { kind: 'capacity', jointGroup: c.jointGroup, actionKey: actionKey(newAction) },
                                  flipModSide, currentPosture, currentTwists,
                              );
                              effectiveCap = c.jointGroup === 'Scapula'
                                  ? capLk.specific * flipModMult  // scapula caps don't use angle interp
                                  : evaluateCapacity(capLk, sectionDirectionAngle(c.boneId, c.act, isPos, currentPosture, currentTwists)) * availability * flipModMult;
                          }
                      }

                      const di = filtered.findIndex(d =>
                          d.boneId === c.boneId &&
                          (d.action === oldFullName || d.action === newFullName));

                      if (di >= 0) {
                          filtered[di].torqueMagnitude = newMag;
                          filtered[di].effort = newMag / effectiveCap;
                          filtered[di].action = newFullName;
                      } else if (newMag > 0.01) {
                          filtered.push({
                              boneId: c.boneId,
                              jointGroup: c.jointGroup,
                              action: newFullName,
                              torqueMagnitude: newMag,
                              effort: newMag / effectiveCap,
                          });
                      }
                  }
                  // Post-writeback snapshot of the full demand list.
                  if (typeof window !== 'undefined') {
                      const dbg = (window as unknown as Record<string, unknown>).__phaseBDebug as Record<string, unknown> | undefined;
                      if (dbg) {
                          dbg.demandsAfterWriteback = filtered.slice().sort((a, b) => b.torqueMagnitude - a.torqueMagnitude);
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
              if (list.some(c => c.active && c.physicsEnabled !== false)) constraintBones.add(bid);
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
        // Unlike Hip/Knee/Elbow, the spine points UP from pelvis, so a +X
        // applied torque drives it INTO flexion (neck tip moves forward).
        // Per the "label = muscle working" convention (see Elbow comment),
        // an applied flexion-direction torque means the EXTENSORS are
        // resisting, so positiveAction = Extension. This is the opposite
        // order from Hip, where a down-pointing femur under +X goes into
        // extension (tip moves backward), so flexors resist and
        // positiveAction = Flexion. The sign mismatch comes from which
        // way the bone points, not from a convention change.
        { positiveAction: 'Extension', negativeAction: 'Flexion', axis: {x:1,y:0,z:0} },
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
        // Action axis (1,0,0) in foot frame. +X muscle moment rotates the
        // foot's −Z direction (toes forward) toward +Y (toes down) — that's
        // plantar flexion. The MUSCLES producing +X moment are therefore the
        // plantar flexors (gastroc / soleus). Per the "label = muscle working"
        // convention used throughout the model (spine, hip, scapula, shoulder
        // all label by the muscle group resisting the applied moment, not the
        // motion direction the applied moment would drive), positiveAction is
        // "Plantar Flexion" because +X applied moment drives DORSIflexion
        // motion which the plantar flexors RESIST… wait, no: the convention
        // is "applied moment + muscle moment = 0," so a +X applied moment is
        // countered by −X muscle moment. −X muscle moment on the foot
        // produces dorsi flexion direction motion → muscle = dorsi flexor
        // (TA). So +X applied → TA working → label "Dorsi Flexion."
        // Conversely, −X applied → calves working → label "Plantar Flexion."
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

  // Current live angle of a joint action, in degrees. Returns an
  // anatomically-meaningful signed angle: positive = in the direction of
  // the positive-axis-rotation convention for the joint.
  //
  // HINGES (elbow/knee/ankle): dirToHingeAngle directly — the joint has a
  // single DOF and the signed angle is already unambiguous.
  //
  // TWISTS (IR/ER, isBoneAxis): from the stored twist value, sign-flipped
  // on the right so "positive = external rotation" for both sides.
  //
  // BALL-SOCKET DIRECTION ACTIONS (shoulder/hip flex-ext, abd-add, horiz):
  // projected onto the relevant anatomical plane.  The cross-product
  // approach we used to use has a gimbal-lock singularity when the action
  // axis is parallel to neutral (which is why horizontal ab/ad reported
  // structurally zero before).  These plane-projection formulas are
  // defined everywhere and match intuition:
  //
  //     flex  = atan2(−dir.z, dir.y)              (sagittal plane, YZ)
  //     abd   = atan2(dir.x · sideSign, dir.y)    (frontal plane, XY)
  //     horiz = atan2(−dir.z, dir.x · sideSign)   (transverse plane, XZ)
  //
  // where sideSign = +1 for right, −1 for left (mirrors the frontal-plane
  // component for bilateral symmetry).
  //
  // Sample outputs (right arm):
  //     neutral (0, 1, 0)            → flex  0  | abd  0 | horiz  0
  //     T-pose (1, 0, 0)             → flex  0  | abd 90 | horiz  0
  //     forward (0, 0, −1)           → flex 90  | abd  0 | horiz 90
  //     overhead (0, −1, 0)          → flex 180 | abd 180| horiz  0
  //     across body (−1, 0, 0)       → flex  0  | abd −90| horiz 180
  //     behind (0, 0, 1)             → flex −90 | abd  0 | horiz −90
  //     45° abd + 45° fwd            → flex 90  | abd 90 | horiz 45
  //
  // Mixed poses show nonzero values in multiple sections simultaneously;
  // that's expected — the arm is genuinely partially in each anatomical
  // plane. Muscle distribution inside each section is independent of the
  // others, driven by its own torque demand, so this doesn't double-count.
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
      let dir = curPosture[boneId];
      if (!dir) return 0;

      // Femur bones: the stored direction is in rootFrame-local (legs
      // are kinematically parented to rootFrame so they stay world-
      // oriented when the spine tilts). But hip joint ANGLES are
      // measured in the pelvis frame — since the spine is rigid, any
      // spine tilt is physically the pelvis rotating around the hip
      // joint. So transform the femur direction through rootFrame into
      // world, then into pelvisFrame-local, before computing flex/abd.
      //
      // Example: spine tilted backward 30°, legs world-vertical. In
      // pelvis frame the femur points forward-and-down → atan2(-z, y)
      // gives negative (extension). Matches anatomical intent.
      if (/Femur/.test(boneId)) {
          const spineRaw = curPosture['spine'] || { x: 0, y: -1, z: 0 };
          const sMag = Math.sqrt(spineRaw.x*spineRaw.x + spineRaw.y*spineRaw.y + spineRaw.z*spineRaw.z) || 1;
          const spineDirN = { x: spineRaw.x/sMag, y: spineRaw.y/sMag, z: spineRaw.z/sMag };
          const pelvisYaw = curTwists['pelvis'] || 0;
          const rootFrameBase = createRootFrame({ x: 0, y: 1, z: 0 });
          const rootFrame = twistFrame(rootFrameBase, pelvisYaw);
          const pelvisFrameBase = createRootFrame({ x: -spineDirN.x, y: -spineDirN.y, z: -spineDirN.z });
          const pelvisFrame = twistFrame(pelvisFrameBase, pelvisYaw);
          const worldDir = localToWorld(rootFrame, dir);
          dir = worldToLocal(pelvisFrame, worldDir);
      }
      // Humerus bones: same idea as femur. The stored direction is
      // already in world coordinates, but the SHOULDER joint frame is
      // spineFrame, not the world frame. For the angle formulas to be
      // body-relative — i.e. so horizontal ad/ab tilts with the spine —
      // convert humerus dir into spineFrame-local before measuring.
      // Pre-2026-04-29 this conversion only happened for hip (femur);
      // shoulder used world coordinates directly, which made horizontal
      // ad/ab readings ignore spine tilt.
      if (/Humerus/.test(boneId)) {
          const spineRaw = curPosture['spine'] || { x: 0, y: -1, z: 0 };
          const sMag = Math.sqrt(spineRaw.x*spineRaw.x + spineRaw.y*spineRaw.y + spineRaw.z*spineRaw.z) || 1;
          const spineDirN = { x: spineRaw.x/sMag, y: spineRaw.y/sMag, z: spineRaw.z/sMag };
          const pelvisYaw = curTwists['pelvis'] || 0;
          const spineTwist = curTwists['spine'] || 0;
          const spineFrameBase = createRootFrame({ x: -spineDirN.x, y: -spineDirN.y, z: -spineDirN.z });
          const spineFrame = twistFrame(spineFrameBase, pelvisYaw + spineTwist);
          dir = worldToLocal(spineFrame, dir);
      }
      const ax = action.axis;
      const sideSign = boneId.startsWith('l') ? -1 : 1;
      const rad = 180 / Math.PI;
      // Flexion/Extension axis: X axis dominant → signed angle in sagittal plane.
      // Unwrap past overhead: when the arm has swept past (0,-1,0) via forward
      // flexion into the back half-plane (y<0, z>0), atan2 wraps to a negative
      // value; add 360° so the angle stays continuous with the flexion-sweep
      // direction. Without unwrap, past-overhead positions would read as
      // "extension" and the muscle bell eval (which caps |θ-peak| at 180°)
      // would snap to the weakest-capacity side.
      if (Math.abs(ax.x) > 0.5) {
          let raw = Math.atan2(-dir.z, dir.y) * rad;
          if (dir.y < 0 && dir.z > 0) raw += 360;
          return raw;
      }
      // Abduction/Adduction axis: Z axis dominant → signed angle in frontal plane.
      // Unwrap past overhead via abduction (y<0, x·sideSign<0): arm has
      // swept past (0,-1,0) counterclockwise into the cross-midline side.
      if (Math.abs(ax.z) > 0.5) {
          const xs = dir.x * sideSign;
          let raw = Math.atan2(xs, dir.y) * rad;
          if (dir.y < 0 && xs < 0) raw += 360;
          return raw;
      }
      // Horizontal ab/ad: world-Y axis (useWorldAxis) → angle in transverse plane.
      // Singularity at arm-vertical (dir ≈ ±y): the transverse-plane projection
      // has zero magnitude and atan2 would return an arbitrary value (in practice
      // ±π when both inputs are negative zero). Return 0 in that case — horizontal
      // ab/ad is ill-defined when the arm is parallel to the world Y axis, and 0
      // is the sensible "neutral between abd and add" reading.
      if (action.useWorldAxis && Math.abs(ax.y) > 0.5) {
          if (dir.x * dir.x + dir.z * dir.z < 1e-8) return 0;
          return Math.atan2(-dir.z, dir.x * sideSign) * rad;
      }
      // Fallback: generic cross-product projection for any axis that doesn't
      // match one of the standard anatomical planes. Kept as a safety net;
      // the current JOINT_ACTIONS set doesn't exercise it.
      const axisN = normalize(ax);
      const neutral = { x: 0, y: 1, z: 0 };
      const dirPerp = sub(dir, mul(axisN, dotProduct(dir, axisN)));
      const neutralPerp = sub(neutral, mul(axisN, dotProduct(neutral, axisN)));
      if (magnitude(dirPerp) < 1e-6 || magnitude(neutralPerp) < 1e-6) return 0;
      const a = normalize(dirPerp);
      const b = normalize(neutralPerp);
      const cosA = clamp(dotProduct(a, b), -1, 1);
      const cross = crossProduct(b, a);
      const sign = Math.sign(dotProduct(cross, axisN)) || 1;
      let angleDeg = Math.acos(cosA) * sign * rad;
      if (boneId.startsWith('l') && Math.abs(axisN.x) < 0.5) {
          angleDeg = -angleDeg;
      }
      return angleDeg;
  };

  // Convert rawAngle → directionAngle for the given section. Positive
  // directionAngle = "more of THIS section's action direction"; negative =
  // opposite direction on the same axis. This is the convention used by
  // muscle-tab peak angles AND (after the 2026-04 capacity migration) by
  // capacity-tab peak angles, so call sites that evaluate a bell need to
  // pass directionAngle, not rawAngle.
  //
  // Per-axis actionSign convention (derived from how each bone's
  // dirToHingeAngle / plane-projection formula signs the rawAngle):
  //   • Shoulder/Hip ball-socket flex/abd (plane-projection): +1
  //   • Horizontal ab/ad (useWorldAxis):                       −1
  //   • Twist (isBoneAxis):                                    +1
  //   • Elbow hinge (forearm atan2(z,y) → neg for flexion):    +1
  //   • Knee/Ankle hinge (tibia/foot → pos for flexion/PF):    −1
  //   • Scapula / Spine / others:                              +1
  const sectionDirectionAngle = (
      boneId: string,
      action: ActionAxis,
      isPositive: boolean,
      curPosture: Posture,
      curTwists: Record<string, number>,
  ): number => {
      const rawAngle = getActionAngle(boneId, action, curPosture, curTwists);
      const isElbow = /Forearm/.test(boneId);
      const isKnee = /Tibia/.test(boneId);
      const isAnkle = /Foot/.test(boneId);
      // Ankle has positiveAction = Plantar Flexion, and rawAngle+ = plantar
      // physical → actionSign = +1 (raw and direction agree). Knee has
      // positiveAction = Extension, but rawAngle+ = flexion → actionSign = -1.
      const actionSign = action.isBoneAxis ? 1 :
                         action.useWorldAxis ? -1 :
                         isElbow ? 1 :
                         isAnkle ? 1 :
                         isKnee ? -1 :
                         1;
      return rawAngle * actionSign * (isPositive ? 1 : -1);
  };

  // Reverse lookup: given a (joint, actionKey), find the matching ActionAxis
  // in JOINT_ACTIONS and whether that key is the axis's positive or negative
  // direction. Returns null if the joint has no action with that key.
  const getActionAxisByKey = (
      group: JointGroup,
      key: string,
  ): { axis: ActionAxis; isPositive: boolean } | null => {
      const acts = JOINT_ACTIONS[group];
      if (!acts) return null;
      for (const ax of acts) {
          if (actionKey(ax.positiveAction) === key) return { axis: ax, isPositive: true };
          if (actionKey(ax.negativeAction) === key) return { axis: ax, isPositive: false };
      }
      return null;
  };

  // Current source-joint angle (in directionAngle convention) for a
  // modification, on the requested side. Returns null if the source joint
  // has no bone on that side (spine) or the action key doesn't resolve.
  // Callers that can't supply a meaningful side (UI samplers) can pass
  // 'right' — under symmetry mode both sides match.
  const getModificationSourceAngle = (
      mod: CrossJointModification,
      side: 'left' | 'right',
      curPosture: Posture,
      curTwists: Record<string, number>,
  ): number | null => {
      const srcBones = GROUP_BONES[mod.sourceJoint];
      const srcBone = mod.sourceJoint === 'Spine'
          ? 'spine'
          : (srcBones ? (side === 'left' ? srcBones.left : srcBones.right) : null);
      if (!srcBone) return null;
      const ax = getActionAxisByKey(mod.sourceJoint, mod.sourceActionKey);
      if (!ax) return null;
      return sectionDirectionAngle(srcBone, ax.axis, ax.isPositive, curPosture, curTwists);
  };

  // Combined multiplier from all modifications targeting this capacity or
  // muscle contribution. 1.0 if no modifications hit. Multiple modifications
  // on the same target multiply. Target identity: (kind, jointGroup,
  // actionKey, [muscleId]). Callers supply only those fields — maxChange
  // and direction live on the stored targets and are applied internally.
  //
  // For muscle targets, `muscleModeFilter` selects which mode ('relative'
  // or 'isolated') to accumulate. Callers applying at the bell-weight
  // level pass 'relative'; callers applying at the post-distribution
  // activation level pass 'isolated'. Omit the filter to include all
  // muscle modes (useful when applying a single multiplier generically,
  // e.g. in bell-curve visualizations that show post-relative effects).
  const getModificationMultiplier = (
      mods: CrossJointModification[],
      target: { kind: 'capacity' | 'muscle'; jointGroup: JointGroup; actionKey: string; muscleId?: string },
      side: 'left' | 'right',
      curPosture: Posture,
      curTwists: Record<string, number>,
      muscleModeFilter?: 'isolated' | 'relative',
  ): number => {
      let mult = 1;
      for (const mod of mods) {
          for (const t of mod.targets) {
              if (t.kind !== target.kind) continue;
              if (t.jointGroup !== target.jointGroup) continue;
              if (t.actionKey !== target.actionKey) continue;
              if (t.kind === 'muscle' && t.muscleId !== target.muscleId) continue;
              // Muscle-mode filter: only apply targets matching the requested mode.
              if (t.kind === 'muscle' && muscleModeFilter) {
                  const tMode = t.muscleMode || 'relative';
                  if (tMode !== muscleModeFilter) continue;
              }
              const srcAngle = getModificationSourceAngle(mod, side, curPosture, curTwists);
              if (srcAngle === null) continue;
              const srcAx = getActionAxisByKey(mod.sourceJoint, mod.sourceActionKey);
              if (!srcAx) continue;
              const range = getActionRange(mod.sourceJoint, srcAx.axis, srcAx.isPositive);
              const curveY = evaluateCurveY(mod, range, srcAngle);
              mult *= applyTargetScaling(curveY, t);
              break; // this modification counts once even if it lists the same target twice
          }
      }
      return mult;
  };

  // Compute the graph X-axis range (in directionAngle) for a given joint
  // action section, based on the currently-configured joint limits. Used
  // by the Muscles tab AND the Capacities tab so their tracks match.
  // Three cases:
  //   1. Hinges (Knee / Elbow / Ankle) and twists (IR/ER): limits are
  //      stored as action angles in rawAngle space; map them to
  //      directionAngle via flip.
  //   2. Ball-socket direction actions (Shoulder / Hip flex-ext, abd-add,
  //      horiz): dense-sample the in-box subset of the unit sphere, compute
  //      directionAngle via the same unwrapped formula getActionAngle
  //      uses at runtime, take min/max.
  //   3. Fallback: 0–180.
  const getActionRange = (group: JointGroup, ax: ActionAxis, isPositive: boolean): { min: number; max: number } => {
      const isHinge = group === 'Knee' || group === 'Elbow' || group === 'Ankle';
      // Ankle is a hinge but positiveAction = Plantar Flexion has rawAngle+
      // matching its positive direction (unlike Knee/Elbow where rawAngle+
      // is the negative-action direction). actionSign for Ankle = +1.
      const actionSign = ax.isBoneAxis ? 1 :
                         ax.useWorldAxis ? -1 :
                         group === 'Ankle' ? 1 :
                         isHinge ? -1 : 1;
      const flip = actionSign * (isPositive ? 1 : -1);

      // Case 1: hinge / twist action limits.
      const actionLim = jointLimits[`${group}.action.${ax.positiveAction}`];
      if (actionLim && Math.abs(actionLim.max - actionLim.min) >= 30) {
          const a = actionLim.min * flip;
          const b = actionLim.max * flip;
          return { min: Math.min(a, b), max: Math.max(a, b) };
      }

      // Case 2: ball-socket direction actions via dense sphere sampling.
      // Naive min/max of dirAngs over reachable (x,y,z). Gives bounding-box
      // ranges on the angle circle (can be up to full 360° when the arc
      // crosses ±180°). Simpler and consistent across all direction axes —
      // the calibration logic that consumes these ranges accounts for
      // effective-peak-within-reachable rather than relying on the range
      // being narrow.
      if ((group === 'Shoulder' || group === 'Hip') && !ax.isBoneAxis) {
          const xLim = jointLimits[`${group}.dir.x`];
          const yLim = jointLimits[`${group}.dir.y`];
          const zLim = jointLimits[`${group}.dir.z`];
          if (xLim && yLim && zLim) {
              let minAng = Infinity, maxAng = -Infinity;
              const N = 50;
              for (let i = 0; i <= N; i++) {
                  for (let j = 0; j <= N; j++) {
                      const x = xLim.min + (xLim.max - xLim.min) * (i / N);
                      const y = yLim.min + (yLim.max - yLim.min) * (j / N);
                      const zsq = 1 - x * x - y * y;
                      if (zsq < 0) continue;
                      for (const zsign of [-1, 1]) {
                          const z = zsign * Math.sqrt(zsq);
                          if (z < zLim.min || z > zLim.max) continue;
                          let raw: number;
                          if (Math.abs(ax.axis.x) > 0.5) {
                              raw = Math.atan2(-z, y) * 180 / Math.PI;
                              if (y < 0 && z > 0) raw += 360;
                          } else if (Math.abs(ax.axis.z) > 0.5) {
                              raw = Math.atan2(x, y) * 180 / Math.PI;
                              if (y < 0 && x < 0) raw += 360;
                          } else if (ax.useWorldAxis && Math.abs(ax.axis.y) > 0.5) {
                              if (x * x + z * z < 1e-4) continue;
                              raw = Math.atan2(-z, x) * 180 / Math.PI;
                          } else continue;
                          const dirAng = raw * flip;
                          if (dirAng < minAng) minAng = dirAng;
                          if (dirAng > maxAng) maxAng = dirAng;
                      }
                  }
              }
              if (minAng !== Infinity) return { min: minAng, max: maxAng };
          }
      }

      // Case 3: fallback.
      return { min: 0, max: 180 };
  };

  // ===========================================================================
  // BIARTICULAR MUSCLE COUPLING (Phase B capacity modifier)
  // ===========================================================================
  //
  // Real physiology: a two-joint muscle's neural drive is partially suppressed
  // when it would act as an ANTAGONIST at one of the joints it crosses. The
  // monoarticular synergists at the other joint compensate, but not fully —
  // net joint capacity there drops a bit.
  //
  // Concrete example: in a bench press the shoulder demands flexion +
  // horizontal adduction. The triceps long head — which extends both shoulder
  // and elbow — is being recruited as an antagonist at the shoulder, so its
  // neural drive is inhibited. Because it ALSO does elbow extension, the
  // elbow's effective capacity for extension drops by the triceps long head's
  // share of that action × its antagonist engagement at the shoulder. Phase
  // B's KKT optimization then distributes less reaction load to the elbow and
  // more to the shoulder — matching the empirical reality that bench press
  // is chest-dominant, not triceps-dominant.
  //
  // `muscleJointMap`: muscle ID → set of joint groups where it's currently
  // assigned. A muscle with |groups| >= 2 is biarticular (or multi-articular).
  // Recomputed when muscleAssignments changes.
  const muscleJointMap = useMemo(() => {
      const map: Record<string, Set<JointGroup>> = {};
      for (const sectionKey of Object.keys(muscleAssignments)) {
          const dotIdx = sectionKey.indexOf('.');
          if (dotIdx < 0) continue;
          const jg = sectionKey.slice(0, dotIdx) as JointGroup;
          for (const muscleId of Object.keys(muscleAssignments[sectionKey])) {
              if (!map[muscleId]) map[muscleId] = new Set<JointGroup>();
              map[muscleId].add(jg);
          }
      }
      return map;
  }, [muscleAssignments]);

  // Availability multiplier for a joint-action's capacity, accounting for
  // biarticular muscles inhibited at their other joints. Returns a factor
  // in [1 - MAX_REDUCTION, 1]. Called from Phase B col-building.
  //
  // Formula: for each biarticular muscle m contributing to (jg, section):
  //   • Compute m's share at (jg, section) via its bell at the current
  //     direction-angle, normalized against the section's total weight.
  //   • For each OTHER joint group K where m is assigned, check whether m
  //     appears in the ANTAGONIST section at K relative to K's current demand
  //     direction (from Phase A rawTorques).
  //   • If yes, accumulate: reductionSum += shareAtHere × shareAtAntagonistK.
  // Then effective availability = 1 - min(MAX_REDUCTION, COUPLING_STRENGTH ×
  // reductionSum). Capped so no single action can drop more than 15%.
  const MAX_CAPACITY_REDUCTION = 0.15;
  const COUPLING_STRENGTH = 1.0;
  // Compute the world-space axis for a given action at a given bone. Mirrors
  // the axis-selection logic in Phase B col-building: bone-axis uses the
  // bone's current direction; useWorldAxis uses act.axis as-is; local-frame
  // actions use the action axis transformed through the bone's jointFrame.
  // Needed so sectionAvailabilityModifier can compute the SIGN of tau0 at
  // the other joint's actions (to tell agonist from antagonist demand).
  const actionWorldAxis = (
      act: ActionAxis,
      bone: string,
      kin: ReturnType<typeof calculateKinematics>,
  ): Vector3 | null => {
      if (act.isBoneAxis) {
          const bs = kin.boneStartPoints[bone];
          const be = kin.boneEndPoints[bone];
          if (!bs || !be) return null;
          return normalize(sub(be, bs));
      }
      const jf = kin.jointFrames[bone];
      if (!jf) return null;
      // useWorldAxis no longer short-circuits — geometric axis is
      // always joint-frame · local. The flag is now a downstream
      // sign-convention hint only.
      return normalize({
          x: act.axis.x*jf.x.x + act.axis.y*jf.y.x + act.axis.z*jf.z.x,
          y: act.axis.x*jf.x.y + act.axis.y*jf.y.y + act.axis.z*jf.z.y,
          z: act.axis.x*jf.x.z + act.axis.y*jf.y.z + act.axis.z*jf.z.z,
      });
  };
  const sectionAvailabilityModifier = (
      jg: JointGroup,
      ax: ActionAxis,
      isPositive: boolean,
      bone: string,
      rawTorques: Record<string, Vector3>,
      kin: ReturnType<typeof calculateKinematics>,
      curPosture: Posture,
      curTwists: Record<string, number>,
  ): number => {
      // Early out when the Capacities-tab toggle is off — feature disabled.
      if (!biarticularCouplingEnabled) return 1;
      const sectionName = isPositive ? ax.positiveAction : ax.negativeAction;
      const sectionKey = `${jg}.${actionKey(sectionName)}`;
      const muscles = muscleAssignments[sectionKey];
      if (!muscles) return 1;

      const dirAngle = sectionDirectionAngle(bone, ax, isPositive, curPosture, curTwists);
      const sectionActionKey = actionKey(sectionName);
      const hereSide: 'left' | 'right' = bone.startsWith('l') ? 'left' : 'right';

      // Compute per-muscle weights at this section. Biarticular coupling
      // looks at bell-share distribution — use only 'relative' muscle
      // modifiers here. 'isolated' modifiers don't affect share balance.
      const weights: Record<string, number> = {};
      let totalWeight = 0;
      for (const [mid, m] of Object.entries(muscles)) {
          const muscleMod = getModificationMultiplier(
              modifications,
              { kind: 'muscle', jointGroup: jg, actionKey: sectionActionKey, muscleId: mid },
              hereSide, curPosture, curTwists, 'relative',
          );
          const w = Math.max(0, evaluateCapacity(
              { base: m.base, specific: m.peak, angle: m.angle },
              dirAngle,
              m.steepness ?? 1,
          )) * muscleMod;
          weights[mid] = w;
          totalWeight += w;
      }
      if (totalWeight < 1e-6) return 1;

      let reductionSum = 0;

      for (const [muscleId, _m] of Object.entries(muscles)) {
          const presentAt = muscleJointMap[muscleId];
          if (!presentAt || presentAt.size < 2) continue;

          const shareHere = weights[muscleId] / totalWeight;
          if (shareHere < 1e-6) continue;

          // Check antagonist engagement at each other joint where m is present.
          for (const otherJoint of presentAt) {
              if (otherJoint === jg) continue;
              const otherBones = GROUP_BONES[otherJoint];
              if (!otherBones) continue;
              // Same-side bone at the other joint — biarticulars stay on one side.
              const sideBone = bone.startsWith('l') ? otherBones.left : otherBones.right;
              const otherRawTau = rawTorques[sideBone];
              if (!otherRawTau) continue;

              const otherActs = JOINT_ACTIONS[otherJoint];
              if (!otherActs) continue;

              for (const otherAx of otherActs) {
                  // tau0 at the other joint's action axis in WORLD space.
                  // Handles all three axis types: bone-axis (twist, uses bone
                  // direction), world-axis (horizontal ab/ad), and local-
                  // frame (normal flex/abd axes transformed via jointFrame).
                  // Without this transform, horizontal ab/ad — which is the
                  // primary shoulder demand in bench press — wouldn't fire
                  // the coupling at all because its local-frame Y axis is not
                  // the same as the world vertical it semantically represents.
                  const worldAx = actionWorldAxis(otherAx, sideBone, kin);
                  if (!worldAx) continue;
                  const tau0Other = dotProduct(otherRawTau, worldAx);
                  if (Math.abs(tau0Other) < 1e-6) continue;

                  // The section OPPOSITE to the demand direction at this joint.
                  // If m is in THAT section's muscles, m is being recruited as
                  // an antagonist and its neural drive is inhibited.
                  const antagonistName = tau0Other > 0 ? otherAx.negativeAction : otherAx.positiveAction;
                  const antKey = `${otherJoint}.${actionKey(antagonistName)}`;
                  const antMuscles = muscleAssignments[antKey];
                  if (!antMuscles || !antMuscles[muscleId]) continue;

                  // m is in the antagonist section. Compute its share there.
                  const antIsPos = antagonistName === otherAx.positiveAction;
                  const antDirAngle = sectionDirectionAngle(sideBone, otherAx, antIsPos, curPosture, curTwists);
                  const antActionKey = actionKey(antagonistName);
                  const antSide: 'left' | 'right' = sideBone.startsWith('l') ? 'left' : 'right';
                  let antMyContrib = 0;
                  let antTotal = 0;
                  for (const [mid, am] of Object.entries(antMuscles)) {
                      // Share-level analysis: only 'relative' modifiers apply.
                      const antMuscleMod = getModificationMultiplier(
                          modifications,
                          { kind: 'muscle', jointGroup: otherJoint, actionKey: antActionKey, muscleId: mid },
                          antSide, curPosture, curTwists, 'relative',
                      );
                      const w = Math.max(0, evaluateCapacity(
                          { base: am.base, specific: am.peak, angle: am.angle },
                          antDirAngle,
                          am.steepness ?? 1,
                      )) * antMuscleMod;
                      if (mid === muscleId) antMyContrib = w;
                      antTotal += w;
                  }
                  if (antTotal < 1e-6) continue;

                  const shareAtAntagonist = antMyContrib / antTotal;
                  reductionSum += shareHere * shareAtAntagonist;
              }
          }
      }

      const reduction = Math.min(MAX_CAPACITY_REDUCTION, COUPLING_STRENGTH * reductionSum);
      return 1 - reduction;
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
          let v = curPosture[boneId];
          if (!v) return 0;
          // Femur dir limits (Hip.dir.x/y/z) must be interpreted in
          // pelvis-local coordinates so they still hold when the spine
          // tilts. The stored femur direction is in rootFrame-local
          // (world-ish), so transform it through rootFrame → world →
          // pelvisFrame-local. When the spine is straight, pelvisFrame
          // equals rootFrame and this is a no-op.
          if (/Femur/.test(boneId)) {
              const spineRaw = curPosture['spine'] || { x: 0, y: -1, z: 0 };
              const sMag = Math.sqrt(spineRaw.x*spineRaw.x + spineRaw.y*spineRaw.y + spineRaw.z*spineRaw.z) || 1;
              const spineDirN = { x: spineRaw.x/sMag, y: spineRaw.y/sMag, z: spineRaw.z/sMag };
              const pelvisYaw = curTwists['pelvis'] || 0;
              const rootFrameBase = createRootFrame({ x: 0, y: 1, z: 0 });
              const rootFrame = twistFrame(rootFrameBase, pelvisYaw);
              const pelvisFrameBase = createRootFrame({ x: -spineDirN.x, y: -spineDirN.y, z: -spineDirN.z });
              const pelvisFrame = twistFrame(pelvisFrameBase, pelvisYaw);
              const worldDir = localToWorld(rootFrame, v);
              v = worldToLocal(pelvisFrame, worldDir);
          }
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

  // Project a bone direction back into its (coupling-aware) effective
  // limit box, then re-normalize to the unit sphere. Called after drag
  // handlers commit so that axes which WEREN'T dragged still respect
  // their effective limits — those limits may have shifted because the
  // dragged axis is a source of a coupling relationship (e.g. dragging
  // Shoulder.dir.y overhead tightens Shoulder.dir.x's cross-body limit).
  // Iterates clamp+renormalize a few times because coupling makes the
  // constraint cross-component (one clamp can shift another's effective
  // range). Converges quickly in practice (≤3 passes).
  const projectDirIntoLimitBox = (
      boneId: string,
      dir: Vector3,
      curPosture: Posture,
      curTwists: Record<string, number>,
  ): Vector3 => {
      const group = getBoneJointGroup(boneId);
      if (!group) return dir;
      const dims = limitDimensionsForGroup(group).filter(d => d.kind === 'dir' && d.component);
      if (dims.length === 0) return dir;

      // Femur special case: Hip.dir.{x,y,z} limits are in the PELVIS
      // frame (see getDimensionValue), while `dir` (the stored femur
      // direction) is in rootFrame-local. We need to clamp the pelvis-
      // frame components, not the stored components, or the post-drag
      // projection will undo the user's carefully pelvis-frame-bound
      // drag and silently pull the femur back to the world-frame box
      // (undoing hip extension gained via spine tilt).
      const isFemur = /Femur/.test(boneId);
      let rootFrame: Frame | null = null;
      let pelvisFrame: Frame | null = null;
      if (isFemur) {
          const spineRaw = curPosture['spine'] || { x: 0, y: -1, z: 0 };
          const sMag = Math.sqrt(spineRaw.x*spineRaw.x + spineRaw.y*spineRaw.y + spineRaw.z*spineRaw.z) || 1;
          const spineDirN = { x: spineRaw.x/sMag, y: spineRaw.y/sMag, z: spineRaw.z/sMag };
          const pelvisYaw = curTwists['pelvis'] || 0;
          rootFrame = twistFrame(createRootFrame({ x: 0, y: 1, z: 0 }), pelvisYaw);
          pelvisFrame = twistFrame(createRootFrame({ x: -spineDirN.x, y: -spineDirN.y, z: -spineDirN.z }), pelvisYaw);
      }

      let result: Vector3 = { ...dir };
      const flipX = boneId.startsWith('l');
      for (let iter = 0; iter < 4; iter++) {
          // Each iteration sees the latest `result` via the posture snapshot.
          const snapshot = { ...curPosture, [boneId]: result };
          let changed = false;

          // Working vector: the one we actually clamp against the dir
          // limits. For femur this is the pelvis-local direction; for
          // everything else it's the stored direction itself.
          let working: Vector3;
          if (isFemur && rootFrame && pelvisFrame) {
              const worldDir = localToWorld(rootFrame, result);
              working = worldToLocal(pelvisFrame, worldDir);
          } else {
              working = { ...result };
          }

          for (const dim of dims) {
              const eff = getEffectiveLimit(dim.key, boneId, snapshot, curTwists);
              if (!eff) continue;
              const comp = dim.component as 'x' | 'y' | 'z';
              const stored = working[comp];
              const normalized = (comp === 'x' && flipX) ? -stored : stored;
              const clamped = clamp(normalized, eff.min, eff.max);
              if (Math.abs(clamped - normalized) > 1e-6) {
                  working[comp] = (comp === 'x' && flipX) ? -clamped : clamped;
                  changed = true;
              }
          }

          // Transform back to stored frame for femur.
          if (isFemur && rootFrame && pelvisFrame) {
              const newWorld = localToWorld(pelvisFrame, working);
              result = worldToLocal(rootFrame, newWorld);
          } else {
              result = working;
          }

          if (!changed) break;
          // Re-normalize — clamping can take the direction off the unit
          // sphere. Only re-normalize if magnitude is sane (avoid divide
          // by near-zero).
          const mag = Math.sqrt(result.x * result.x + result.y * result.y + result.z * result.z);
          if (mag > 1e-3) {
              result.x /= mag;
              result.y /= mag;
              result.z /= mag;
          }
      }
      return result;
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

  // (Note: a previous in-tree iteration had a `jointActionArcs` memo
  // here that produced VisualPlane[] arcs scaled to bone length and
  // never hooked up to BioMan. Replaced by `jointAxisCircles` below,
  // which uses a dedicated AxisCircle prop with fixed radius and
  // proper labels.)

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

  // Joint action axis rings around the selected joint. Each ring is a
  // visual readout of the EXACT axis the analysis pipeline projects
  // torque onto for that action. The transform path here mirrors
  // calculateTorqueDistribution's per-action branch:
  //   • isBoneAxis (IR/ER)  → world bone direction
  //   • useWorldAxis (Horiz ad/ab) → literal action.axis (no frame)
  //   • default             → jointFrame · action.axis (body-relative)
  // The user can therefore visually confirm which axes track the
  // spine and which stay world-fixed. Center is the proximal joint.
  // Radius is fixed (not bone-length-scaled) per request.
  //
  // Color palette is per axis kind, not per action label, so the two
  // labels for the same axis (Flexion/Extension, Abduction/Adduction)
  // share one ring + one color.
  const ACTION_AXIS_COLORS: Record<string, string> = {
      'flexion':              'rgba(239, 68, 68, 0.85)',   // red — sagittal
      'extension':            'rgba(239, 68, 68, 0.85)',
      'abduction':            'rgba(34, 197, 94, 0.85)',   // green — frontal
      'adduction':            'rgba(34, 197, 94, 0.85)',
      'horizontalAbduction':  'rgba(59, 130, 246, 0.85)',  // blue — transverse
      'horizontalAdduction':  'rgba(59, 130, 246, 0.85)',
      'externalRotation':     'rgba(249, 115, 22, 0.85)',  // orange — bone axis
      'internalRotation':     'rgba(249, 115, 22, 0.85)',
      'elevation':            'rgba(168, 85, 247, 0.85)',  // purple — scapula vertical
      'depression':           'rgba(168, 85, 247, 0.85)',
      'protraction':          'rgba(20, 184, 166, 0.85)',  // teal — scapula horizontal
      'retraction':           'rgba(20, 184, 166, 0.85)',
      'lateralFlexionL':      'rgba(34, 197, 94, 0.85)',
      'lateralFlexionR':      'rgba(34, 197, 94, 0.85)',
      'rotationL':            'rgba(168, 85, 247, 0.85)',
      'rotationR':            'rgba(168, 85, 247, 0.85)',
      'dorsiFlexion':         'rgba(239, 68, 68, 0.85)',
      'plantarFlexion':       'rgba(239, 68, 68, 0.85)',
  };
  const AXIS_RING_RADIUS = 14;

  const jointAxisCircles = useMemo<AxisCircle[]>(() => {
      if (!selectedBone) return [];
      const group = BONE_TO_JOINT_GROUP[selectedBone];
      if (!group) return [];
      const actions = JOINT_ACTIONS[group];
      if (!actions || actions.length === 0) return [];
      const kin = calculateKinematics(posture, twists);
      const center = kin.boneStartPoints[selectedBone];
      if (!center) return [];
      const jointFrame = kin.jointFrames[selectedBone];
      const out: AxisCircle[] = [];
      for (let i = 0; i < actions.length; i++) {
          const act = actions[i];
          let worldAxis: Vector3;
          if (act.isBoneAxis) {
              const bs = kin.boneStartPoints[selectedBone];
              const be = kin.boneEndPoints[selectedBone];
              if (!bs || !be) continue;
              const dir = sub(be, bs);
              if (magnitude(dir) < 1e-6) continue;
              worldAxis = normalize(dir);
          } else if (jointFrame) {
              // Mirrors the torque pipeline: every direction action
              // (including horizontal ad/ab — useWorldAxis is now a
              // sign-convention flag only, not a geometric switch)
              // routes through the joint-frame transform. So this
              // ring will tilt with the spine for shoulder/hip
              // horizontal ad/ab too.
              worldAxis = normalize(localToWorld(jointFrame, act.axis));
          } else {
              continue;
          }
          const key = actionKey(act.positiveAction);
          const color = ACTION_AXIS_COLORS[key] || 'rgba(100, 100, 100, 0.65)';
          // Short composite label: "Flex/Ext", "Abd/Add", etc. Falls
          // back to the positive-action name if the negative isn't a
          // mirror (e.g. "Lateral Flexion L / Lateral Flexion R").
          const posShort = act.positiveAction.split(' ').map(w => w.slice(0, 3)).join(' ');
          const negShort = act.negativeAction.split(' ').map(w => w.slice(0, 3)).join(' ');
          const label = `${posShort}/${negShort}`;
          out.push({
              id: `${selectedBone}-axis-${i}`,
              center,
              axis: worldAxis,
              radius: AXIS_RING_RADIUS,
              color,
              label,
          });
      }
      return out;
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
          } else if (c.type === 'arc' && c.axis && c.radius !== undefined) {
              const livePivot = resolveArcPivot(c, kin);
              if (!livePivot) continue;
              const toTip = sub(tip, livePivot);
              const axisN = normalize(c.axis);
              const axialDist = dotProduct(toTip, axisN);
              const inPlane = sub(toTip, mul(axisN, axialDist));
              const radialDist = magnitude(inPlane);
              const radialErr = radialDist - c.radius;
              cost += radialErr * radialErr + axialDist * axialDist;
              maxAbs = Math.max(maxAbs, Math.abs(radialErr), Math.abs(axialDist));
          } else {
              // Planar. Default = bidirectional equality (cost = sd²). When
              // `directional` is set, the constraint becomes one-sided and
              // cost = max(0, sd)² (zero on the allowed -normal halfspace).
              // For 'one-way' the wall's effective center has slid by the
              // ratchet watermark α: effective_center = c.center + α·N.
              const N = normalize(c.normal);
              let alpha = 0;
              if (c.directional === 'one-way') {
                  alpha = ratchetWatermarks.current.get(c.id) ?? 0;
              }
              const sd = dotProduct(sub(tip, c.center), N) - alpha;
              const violation = c.directional ? Math.max(0, sd) : sd;
              cost += violation * violation;
              if (Math.abs(violation) > maxAbs) maxAbs = Math.abs(violation);
          }
      }
      return { cost, maxAbs };
  };

  // For each `directional: 'one-way'` constraint, slide the wall's
  // effective center to match the tip's current position projected onto
  // the constraint axis — but only in the -normal direction (the allowed
  // direction). Once advanced, the wall blocks return motion. Called by
  // solveConstraintsAccommodating after every successful solve.
  const advanceRatchets = (
      posture: Posture,
      twists: Record<string, number>,
      cons: { boneId: string; c: BoneConstraint }[]
  ) => {
      let needsKin = false;
      for (const { c } of cons) { if (c.directional === 'one-way') { needsKin = true; break; } }
      if (!needsKin) return;
      const kin = calculateKinematics(posture, twists);
      for (const { boneId: bid, c } of cons) {
          if (c.directional !== 'one-way') continue;
          const tip = getConstraintPoint(bid, c, kin);
          if (!tip) continue;
          const N = normalize(c.normal);
          // Raw signed distance from the tip to the AUTHORED center
          // (independent of the watermark). Watermark α tracks the most
          // negative sdRaw seen so far — i.e. how deep into the allowed
          // halfspace the limb has moved. α is monotonically non-increasing.
          const sdRaw = dotProduct(sub(tip, c.center), N);
          const prevAlpha = ratchetWatermarks.current.get(c.id) ?? 0;
          if (sdRaw < prevAlpha) ratchetWatermarks.current.set(c.id, sdRaw);
      }
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
      lockedTwistIds: Set<string> = new Set(),
      // Optional constraints override: callers in React state-update
      // batches (e.g. applyPreset, which sets constraints AND solves in
      // the same tick) can't rely on `collectActiveConstraints()` because
      // the React closure still holds stale `constraints`. Pass the new
      // constraints here to bypass closure.
      constraintsOverride?: Record<string, BoneConstraint[]>,
  ): { posture: Posture; twists: Record<string, number> } | null => {
      const cons = constraintsOverride
          ? Object.entries(constraintsOverride).flatMap(([bid, list]) =>
              list.filter(c => c.active).map(c => ({ boneId: bid, c })))
          : collectActiveConstraints();
      if (cons.length === 0) return { posture: tentative, twists: t };

      // Symmetry mode: spine axial rotation (`spineTwist`) and pelvis yaw
      // both produce ASYMMETRIC postures — twisting the torso, or yawing
      // the lower body, breaks bilateral symmetry. The slider/UI already
      // disables the spine rotation slider in symmetry mode and the
      // posture handlers coerce these to 0, but the constraint solver is
      // free to adjust both as it searches for a constraint-satisfying
      // pose. That bypass lets the solver introduce asymmetry that the UI
      // can't undo. Lock both DOFs at the solver entry to close that
      // bypass — if a constraint requires asymmetric twist to satisfy,
      // the solver fails cleanly (drag step gets halved upstream) instead
      // of silently producing an asymmetric pose.
      if (symmetryMode) {
          lockedTwistIds = new Set(lockedTwistIds);
          lockedTwistIds.add('spine');
          lockedTwistIds.add('pelvis');
      }

      // Wrap a successful return: advance any one-way ratchet watermarks
      // before handing the result back, so the wall stays flush with the
      // limb's deepest excursion into the allowed halfspace. Inactive on
      // a return that produces no change, since `advanceRatchets` clamps
      // α to min(prev, current) and preserves α when current is shallower.
      const ok = (p: Posture, twists: Record<string, number>) => {
          advanceRatchets(p, twists, cons);
          return { posture: p, twists };
      };

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
      if (maxAbs <= globalTol) return ok(posture, solvedTwists);

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
      // Pelvis yaw AND pelvis translation are GLOBAL DOFs — when any of
      // them is free, adjusting them moves every bone in world space
      // (pelvisYaw rotates legs via rootFrame and arms via spineFrame;
      // pelvisTx/Ty/Tz bodily translates the whole skeleton). So when
      // any pelvis DOF is free AND the user is driving any bone, every
      // constraint becomes relevant: the solver's pelvis maneuver can
      // violate a constraint on a far branch. Include the entire skeleton
      // in the influence chain whenever pelvis has any free DOF and
      // there is user input.
      const pelvisYawFree = !lockedBoneIds.has('pelvis') && !lockedTwistIds.has('pelvis');
      const pelvisTransFree = ['pelvisTx', 'pelvisTy', 'pelvisTz'].some(
          k => !lockedBoneIds.has(k) && !lockedTwistIds.has(k)
      );
      if ((pelvisYawFree || pelvisTransFree) && inputBones.size > 0) {
          for (const b of Object.keys(BONE_PARENTS)) influenceChain.add(b);
      }

      const relevantCons = inputBones.size === 0
          ? cons  // no explicit input bones (e.g., playback): all constraints enforced
          : cons.filter(({ boneId: cBid }) => influenceChain.has(cBid));

      // If no constraints are relevant to the user's input branch, skip
      // the solver entirely — the input can't violate any constraint.
      if (relevantCons.length === 0) return ok(posture, solvedTwists);

      // Recompute cost with only relevant constraints.
      ({ cost, maxAbs } = computeConstraintCost(posture, solvedTwists, relevantCons));
      if (maxAbs <= globalTol) return ok(posture, solvedTwists);

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

      // Angular-twist DOFs the solver can adjust (all measured in degrees):
      //   - humerus/femur twists (per-bone axial rotation)
      //   - spine twist (anatomical shoulder-to-pelvis relative rotation)
      //   - pelvis yaw (world-frame rotation of the lower body)
      //
      // Spine and pelvis-yaw together handle axial rotation of the torso:
      // the user sets spine; the solver freely adjusts pelvis (and other
      // bones) to satisfy constraints. If the upper body is pinned, the
      // solver drives pelvis opposite to spine so the shoulders stay
      // fixed in world while the legs rotate. Pelvis-yaw is not a posture
      // bone — it's a scalar DOF tracked only in `twists`.
      const isTwistBone = (b: string) => /Humerus|Femur/.test(b) || b === 'spine' || b === 'pelvis';
      const freeBonesTwistFromPosture = Object.keys(posture).filter(
          b => isTwistBone(b) && !lockedBoneIds.has(b) && !lockedTwistIds.has(b) && posture[b] !== undefined
      );
      // Pelvis is a pseudo-bone — not in posture, but still a scalar
      // twist DOF whenever it isn't explicitly locked.
      const freeBonesTwist = [...freeBonesTwistFromPosture];
      if (!lockedBoneIds.has('pelvis') && !lockedTwistIds.has('pelvis') && !freeBonesTwist.includes('pelvis')) {
          freeBonesTwist.push('pelvis');
      }
      const twistMap: Record<string, number> = {};
      for (const bid of freeBonesTwist) twistMap[bid] = solvedTwists[bid] || 0;

      // Pelvis TRANSLATION DOFs — move the whole skeleton root in world
      // space so the solver can satisfy distal constraints that would
      // otherwise over-constrain the kinematic chain. Classic case:
      // feet pinned + knee flex requires the pelvis to drop (squat); an
      // armbar-pinned hand moving requires the pelvis to shift. Measured
      // in WORLD UNITS, not degrees, so these need their own EPS_POS and
      // Armijo step handling distinct from the angular twists above.
      const PELVIS_TRANS_DOFS = ['pelvisTx', 'pelvisTy', 'pelvisTz'];
      const freeBonesPosTrans = PELVIS_TRANS_DOFS.filter(
          b => !lockedBoneIds.has(b) && !lockedTwistIds.has(b),
      );
      const posTransMap: Record<string, number> = {};
      for (const bid of freeBonesPosTrans) posTransMap[bid] = solvedTwists[bid] || 0;

      if (freeBones2D.length === 0 && freeBones1D.length === 0 && freeBonesHinge.length === 0 && freeBonesTwist.length === 0 && freeBonesPosTrans.length === 0) return null;

      // Bumped 150 → 300: tighter SOLVER_MIN_TOL needs more iterations
      // for the gradient-descent step + Armijo backtracking to actually
      // reach convergence on multi-constraint scenes (e.g., the OHP preset
      // with 22 active constraints where the previous 150-iter cap left
      // residuals at the early-exit threshold).
      const MAX_ITERS = 300;
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

          // Pelvis translation gradient: perturbation is in world UNITS, not
          // radians. Without rescaling, the raw d(cost)/d(unit) gradient is
          // ~1/L smaller than angular d(cost)/d(rad) for typical bone length
          // L, because rotating a bone by 1 rad moves its tip by ~L units
          // while translating the pelvis by 1 unit moves bones by only 1.
          // That imbalance makes angular DOFs dominate gradNorm, and the
          // solver's Armijo step moves the pelvis ~1/L as fast as it moves
          // bone angles — far too slow to reach (say) a 30-unit squat drop
          // within MAX_ITERS iterations.
          //
          // Fix: treat pelvis translation as if parameterized in units of
          // L (dimensionless body-lengths), which rescales both the
          // gradient (× POS_GRAD_SCALE) and the Armijo step (× POS_GRAD_SCALE
          // again at the step site, for a total L² scaling on the final
          // world-unit step). With L ≈ 50, a single iteration now moves
          // pelvis ~1-2 units when the constraint miss is comparable to a
          // typical bone length, so distal-pinned scenarios (squat, pull-up)
          // converge in 10-30 iterations rather than 600+.
          const EPS_POS = 0.3;
          const POS_GRAD_SCALE = 50;
          const gradsPosTrans: Record<string, number> = {};
          for (const bid of freeBonesPosTrans) {
              const tw = posTransMap[bid];
              const tPlus  = { ...solvedTwists, [bid]: tw + EPS_POS };
              const tMinus = { ...solvedTwists, [bid]: tw - EPS_POS };
              const gRaw = (computeConstraintCost(posture, tPlus,  relevantCons).cost
                          - computeConstraintCost(posture, tMinus, relevantCons).cost) / (2 * EPS_POS);
              const g = gRaw * POS_GRAD_SCALE; // rescaled to body-length units
              gradsPosTrans[bid] = g;
              gradSqNorm += g * g;
          }

          if (gradSqNorm < 1e-10) {
              // Stationary point. If cost is at tolerance we'd already have
              // returned above; reaching here means we're at a local minimum
              // the solver can't escape via gradient steps. Two cases:
              //   (a) constraints are mutually consistent and we're at the
              //       true minimum (cost ≈ 0) — that branch fires above.
              //   (b) constraints are slightly inconsistent (e.g. a fixed
              //       pin's stored center doesn't quite match the bone tip
              //       given the current spine pin's pelvis position), so
              //       the cost surface bottoms out at some residual > tol.
              // Pre-2026-04-29 the function returned null in case (b), which
              // meant outer drag handlers (handleHingeChange, etc.) treated
              // the call as a hard failure and step-halved repeatedly. The
              // user-visible symptom: changing one bone (e.g. elbow flex)
              // wouldn't propagate through to the rest of the chain because
              // the solver kept refusing every step despite the residual
              // being driven entirely by an unrelated lower-body
              // inconsistency. Returning the current state here lets the
              // drag advance — the user sees the locked bone move and can
              // visually confirm that the chain accommodates it as best the
              // solver can. The residual inconsistency stays fixed (it was
              // there before the drag started), it just doesn't gate user
              // interaction anymore.
              return ok(posture, solvedTwists);
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
              // Pelvis translation candidate step. Complementary half of the
              // L-rescaling done in the gradient computation above: the
              // stored gradient is in body-length units (scaled by
              // POS_GRAD_SCALE), so to convert the step back to real world
              // units we apply POS_GRAD_SCALE once more. Net effect: the
              // actual world-unit step is α · g_raw · POS_GRAD_SCALE², which
              // matches the world-distance swept by a proportional angular
              // rotation on a typical bone. Clamped against POSITION_LIMITS.
              const trialPosTrans: Record<string, number> = {};
              for (const bid of freeBonesPosTrans) {
                  const stepUnits = alpha * gradsPosTrans[bid] * POS_GRAD_SCALE;
                  let newTw = posTransMap[bid] - stepUnits;
                  const lim = POSITION_LIMITS[bid];
                  if (lim) newTw = Math.max(lim.min, Math.min(lim.max, newTw));
                  candidateTwists[bid] = newTw;
                  trialPosTrans[bid] = newTw;
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
                  for (const bid of freeBonesPosTrans) {
                      posTransMap[bid] = trialPosTrans[bid];
                  }
                  accepted = true;
                  break;
              }
              alpha *= ARMIJO_BACKTRACK;
              if (alpha < 1e-9) break;
          }

          if (!accepted) {
              // Armijo backtracked all the way to the alpha floor without
              // finding a step that satisfies sufficient-decrease. Two
              // typical causes:
              //   1. Curvature along the gradient direction is very high
              //      (cost(α) shoots up faster than the linear estimate
              //      predicts), so even tiny α overshoots the local
              //      minimum, and once α drops below ~1e-9 the cost
              //      change is dominated by floating-point noise rather
              //      than the actual gradient. The gradient still tells
              //      us the right descent direction; line search just
              //      can't certify "strict" descent at FP-noise scale.
              //   2. We're effectively at a saddle/minimum that the
              //      gradient briefly disagrees with (e.g. discrete
              //      hinge-limit clamping inside the line search).
              // Pre-2026-04-29 this returned null. With over-determined
              // constraint sets that's catastrophic for the outer drag
              // loop: every step looks like a hard failure, the loop
              // step-halves repeatedly, and the user's input never
              // advances even though the solver had already found a
              // descent step (just couldn't certify it strict enough).
              // Returning the current state preserves whatever progress
              // was made earlier in this solve and lets the outer
              // adaptive loop accept the input. The maxAbs may still be
              // > globalTol, but it can't be reduced further by this
              // solver call regardless.
              return ok(posture, solvedTwists);
          }
          if (maxAbs <= globalTol) return ok(posture, solvedTwists);
      }

      // MAX_ITERS exit: similar reasoning to the Armijo-failure return
      // above. We've made all the progress we can in this call. If the
      // solver was always able to fully converge in the past it'll
      // still hit the early-exit `maxAbs <= globalTol` return inside
      // the loop; reaching here means we're at a budgeted-iterations
      // stopping point or against an over-determined constraint set.
      // Return what we have rather than punishing the caller with null.
      return ok(posture, solvedTwists);
  };

  // Standalone posture-level joint-limit check: returns true if ANY joint
  // has a dim whose value falls outside its effective limits. This covers
  // the cross-bone case where moving bone A (e.g. spine) implicitly changes
  // bone B's angle in bone B's own reference frame (e.g. femur's pelvis-
  // local angle). Spine drags can't violate hip limits via direct clamping
  // alone because the clamp only runs on the bone being dragged — the
  // downstream effect on the hip is invisible to the spine's slider.
  //
  // Used by the adaptive step-halving drag loops: a step that produces a
  // limit-violating posture is treated the same as a solver failure, so
  // the loop halves the step and retries. Naturally clamps the user's
  // drag at the point where any joint hits its range boundary.
  //
  // A small tolerance prevents numerical drift (the step slightly past
  // the boundary due to FP noise) from endlessly re-halving when the
  // drag has actually converged.
  const postureViolatesLimits = (p: Posture, t: Record<string, number>): boolean => {
      const DIR_TOL = 0.01;     // unit-vector component tolerance (~0.6°)
      const ANGLE_TOL = 0.5;    // degree tolerance for action-based limits
      for (const [group, sides] of Object.entries(GROUP_BONES) as [JointGroup, { left: string; right: string } | null][]) {
          if (!sides) continue;
          const dims = limitDimensionsForGroup(group);
          for (const bone of [sides.left, sides.right]) {
              for (const dim of dims) {
                  const eff = getEffectiveLimit(dim.key, bone, p, t);
                  if (!eff) continue;
                  const val = getDimensionValue(dim, bone, p, t);
                  const tol = dim.kind === 'dir' ? DIR_TOL : ANGLE_TOL;
                  if (val > eff.max + tol || val < eff.min - tol) return true;
              }
          }
      }
      return false;
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
          } else if (c.type === 'arc' && c.axis && c.radius !== undefined) {
              const livePivot = resolveArcPivot(c, kin);
              if (!livePivot) continue;
              const toTip = sub(tip, livePivot);
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
      return calculateTorqueDistribution(posture, twists, forces, jointCapacities, constraints, currentRomT, effortExponent);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posture, twists, forces, jointCapacities, constraints, jointLimits, currentRomT, effortExponent]);

  // --- Muscle activation distribution ---
  //
  // For each joint-action demand, look up the muscles assigned to that
  // direction and split the demand's effort across them according to each
  // muscle's bell-curve weight at the joint's current angle in this
  // direction's natural sense. Sum across all demands per (side, muscle).
  //
  // The result is a sorted list — most-activated muscle first — with each
  // muscle's "activation" being the cumulative effort it took on across
  // every joint action it participates in. Display normalizes against the
  // current frame's max so the heaviest-loaded muscle reads 100%.
  type MuscleActivation = {
      key: string;       // `${side}|${muscleId}` for keying / dedup
      side: string;      // 'Left', 'Right', or '' (centre — spine/scapula edge cases)
      muscleId: string;
      muscleName: string;
      activation: number;
  };

  // Per-frame helper: distributes joint-action demands across assigned
  // muscles. Returns `Record<"${side}|${muscleId}", activation>`. Used by
  // the live `muscleActivation` memo and by the timeline frame loop —
  // anywhere we need "given these demands at this pose, how loaded is
  // each muscle right now."
  const distributeMuscleLoadForFrame = (
      demands: JointActionDemand[],
      framePosture: Posture,
      frameTwists: Record<string, number>,
      assignments: MuscleAssignmentMap,
      scales: Record<string, number> = {},
      // Optional out-parameter. When provided, records which demand
      // actions contribute positively (agonist) and negatively
      // (antagonist) to each muscle. Timeline Peaks uses this to show
      // per-muscle "+/−" chips next to each muscle row so users can
      // trace why a muscle is active or suppressed.
      contributionsOut?: Record<string, { positive: Set<string>; negative: Set<string> }>,
      // Fraction of Spine Extension demand routed to rectus abdominis as
      // abdominal bracing, in [0, 1]. When > 0, the primary + antagonist
      // routes for Spine.extension are scaled by (1 − bracingFrac), and
      // the remaining bracingFrac of the effort is applied directly to
      // rectus abdominis (labeled "Spine Extension (bracing)"). Rectus
      // is also exempted from Spine.extension's antagonist suppression
      // so its reported activation cleanly reflects bracing work.
      bracingFrac: number = 0,
  ): Record<string, { side: string; muscleId: string; activation: number }> => {
      const acc: Record<string, { side: string; muscleId: string; activation: number }> = {};

      // Distribute a (signed) effort across the muscles assigned to one
      // section. Positive effort = activation; negative effort = inhibition
      // for muscles in the opposite-direction section (antagonist rule).
      // angleInDirection is the joint angle measured positive in this
      // section's direction (so each muscle's bell evaluates correctly).
      //
      // sectionScale (from `scales[sectionKey]`, default 1) is a user-tunable
      // per-section multiplier applied AFTER the share distribution. Lets
      // actions with many co-active muscles read higher (set scale ≈ the
      // count so each muscle hits 100% simultaneously at 1RM) and actions
      // with few / smaller muscles read lower. Final activation is clamped
      // to [−1, 1] below so muscles can't display above MVC.
      const distributeToSection = (
          sectionKey: string,
          angleInDirection: number,
          side: string,
          effortSigned: number,
          // Label identifying the DEMAND action that triggered this
          // distribution (e.g. "Hip Extension"). For the primary call
          // this matches the demand itself; for the antagonist call
          // the same label is used but with effortSigned flipped —
          // muscles on the opposite-section get a NEGATIVE contribution
          // labelled by the demand that suppressed them.
          contributionActionLabel?: string,
          // Muscles to exclude from this section's distribution (used by
          // bracing: skip rectus abdominis when routing Spine.extension's
          // antagonist call to Spine.flexion, so rectus's activation
          // comes purely from the bracing branch).
          skipMuscleIds?: Set<string>,
      ) => {
          const assigned = assignments[sectionKey];
          if (!assigned) return;
          const ids = Object.keys(assigned).filter(id => !skipMuscleIds?.has(id));
          if (ids.length === 0) return;
          const sectionScale = scales[sectionKey] ?? 1;
          // Parse section key to build modification lookup keys.
          const dotIdx = sectionKey.indexOf('.');
          const sectionJG = dotIdx > 0 ? sectionKey.slice(0, dotIdx) as JointGroup : null;
          const sectionAct = dotIdx > 0 ? sectionKey.slice(dotIdx + 1) : '';
          const mSide: 'left' | 'right' = side === 'Left' ? 'left' : 'right';
          let total = 0;
          const weights: { id: string; w: number }[] = [];
          for (const id of ids) {
              const c = assigned[id];
              // 'relative' modifiers apply at the bell-weight level here,
              // so shrinking one muscle redistributes share to the rest.
              const relMod = sectionJG ? getModificationMultiplier(
                  modifications,
                  { kind: 'muscle', jointGroup: sectionJG, actionKey: sectionAct, muscleId: id },
                  mSide, framePosture, frameTwists, 'relative',
              ) : 1;
              const w = evaluateCapacity({ base: c.base, specific: c.peak, angle: c.angle }, angleInDirection, c.steepness ?? 1) * relMod;
              weights.push({ id, w });
              total += w;
          }
          if (total < 1e-9) return;
          for (const { id, w } of weights) {
              const share = w / total;
              // 'isolated' modifiers apply to the final activation AFTER
              // share distribution, so only this muscle's bar moves.
              const isoMod = sectionJG ? getModificationMultiplier(
                  modifications,
                  { kind: 'muscle', jointGroup: sectionJG, actionKey: sectionAct, muscleId: id },
                  mSide, framePosture, frameTwists, 'isolated',
              ) : 1;
              const key = `${side}|${id}`;
              if (!acc[key]) acc[key] = { side, muscleId: id, activation: 0 };
              const delta = effortSigned * share * isoMod * sectionScale;
              acc[key].activation += delta;

              // Record the contribution in the out-map when the caller
              // opted into tracking. Filters near-zero contributions
              // (tiny share / deeply out-of-range bell weight) to avoid
              // noise chips.
              if (contributionsOut && contributionActionLabel && Math.abs(delta) > 1e-6) {
                  if (!contributionsOut[key]) {
                      contributionsOut[key] = { positive: new Set(), negative: new Set() };
                  }
                  if (delta > 0) contributionsOut[key].positive.add(contributionActionLabel);
                  else contributionsOut[key].negative.add(contributionActionLabel);
              }
          }
      };

      for (const d of demands) {
          // Parse `${side} ${group} ${directionName}` back out of d.action.
          let s = d.action;
          let parsedSide = '';
          if (s.startsWith('Left '))  { parsedSide = 'Left';  s = s.slice(5); }
          else if (s.startsWith('Right ')) { parsedSide = 'Right'; s = s.slice(6); }
          s = s.replace(new RegExp(`^${d.jointGroup}\\s+`), '');
          const directionName = s.trim();

          // Find the ActionAxis matching the demand direction so we can read
          // the current joint angle. Flip sign when reading from a negative-
          // direction section so the angle reads "positive in this direction's
          // territory" — the same convention each muscle's peak angle uses.
          const ax = JOINT_ACTIONS[d.jointGroup]?.find(
              a => a.positiveAction === directionName || a.negativeAction === directionName
          );
          if (!ax) continue;
          const isPositive = ax.positiveAction === directionName;
          const rawAngle = getActionAngle(d.boneId, ax, framePosture, frameTwists);

          // directionAngle: "degrees in the direction of THIS section's
          // action." Positive = more action direction; negative = opposite.
          //
          // getActionAngle's rawAngle sign depends on axis type. After the
          // shift to plane-projection angles for ball-socket direction
          // actions, the relationships are:
          //
          //   • Ball-socket flex/abd (new formula): rawAngle positive aligns
          //     with the positive action (flex positive = flexed, abd
          //     positive = abducted). actionSign = +1.
          //   • Ball-socket horizontal (new formula, useWorldAxis):
          //     rawAngle positive = arm rotating in transverse plane toward
          //     across-body, which is horizontal ADDUCTION = NEGATIVE
          //     action. actionSign = −1.
          //   • Twist (isBoneAxis): positive = ER = positive action.
          //     actionSign = +1.
          //   • Hinge KNEE (atan2(z,y) on tibia): positive rawAngle =
          //     flexion. positiveAction = Extension is the OPPOSITE
          //     direction → actionSign = −1.
          //   • Hinge ANKLE (atan2(y,-z) on foot): positive rawAngle =
          //     plantar flexion. positiveAction = Plantar Flexion matches
          //     the raw direction → actionSign = +1.
          //   • Hinge ELBOW: forearm rotates in OPPOSITE local-Z sense from
          //     tibia (forearm flexes forward → −Z; tibia flexes backward →
          //     +Z), so atan2(z,y) on the forearm gives NEGATIVE rawAngle
          //     for flexion and POSITIVE for hyperextension. With
          //     actionSign = +1, directionAngle = rawAngle for the (positive)
          //     extension section and = −rawAngle for the (negative) flexion
          //     section. At full flex (rawAngle ≈ −160), Elbow.flexion
          //     directionAngle = +160 → bell evaluates correctly.
          //
          // Then: positive section: directionAngle = rawAngle * actionSign
          //       negative section: directionAngle = −rawAngle * actionSign
          // Net: positive directionAngle = more of this section's action,
          // for every section type.
          const isElbow = /Forearm/.test(d.boneId);
          const isKnee = /Tibia/.test(d.boneId);
          const isAnkle = /Foot/.test(d.boneId);
          const actionSign = ax.isBoneAxis ? 1 :
                             ax.useWorldAxis ? -1 :
                             isElbow ? 1 :
                             isAnkle ? 1 :
                             isKnee ? -1 :
                             1;
          const directionAngle = rawAngle * actionSign * (isPositive ? 1 : -1);

          const sectionKey = `${d.jointGroup}.${actionKey(directionName)}`;
          const oppositeName = isPositive ? ax.negativeAction : ax.positiveAction;
          const oppositeKey = `${d.jointGroup}.${actionKey(oppositeName)}`;

          // Spine / mid-line demands have no side in the action name
          // ("Spine Flexion" instead of "Left Spine Flexion"). Without
          // special handling these route to a side-less muscle bucket
          // that shows up as an unlabeled row alongside the L/R rows of
          // the same muscle (e.g. an "unlabeled" Gluteus Maximus from
          // Spine.extension → glute-max alongside the L/R Hip.extension
          // glute-max). Split side-less demands 50/50 across Left and
          // Right so bilateral muscles accumulate evenly on both sides
          // in symmetric exercises.
          const sides = parsedSide === '' ? ['Left', 'Right'] : [parsedSide];
          const splitMult = parsedSide === '' ? 0.5 : 1;
          // Contribution label is side-agnostic ("Hip Extension" not
          // "Right Hip Extension") — the muscle's own key already
          // carries its side, so the label just identifies the action.
          const contribLabel = `${d.jointGroup} ${directionName}`;

          // BRACING: for Spine Extension demand only, split some of
          // the effort off to abdominal bracing (rectus abdominis).
          // Primary + antagonist are scaled by (1 − bracingFrac), and
          // bracingFrac × effort is applied directly to rectus (with
          // rectus exempted from the antagonist call so its reported
          // activation is pure bracing, not a net of suppression and
          // bracing bonus).
          const isSpineExtension = d.jointGroup === 'Spine' && directionName === 'Extension';
          const bFrac = isSpineExtension ? bracingFrac : 0;
          const primaryMult = 1 - bFrac;
          const antagonistSkip = bFrac > 0 ? new Set(['rectus-abdominis']) : undefined;

          for (const side of sides) {
              // 1) PRIMARY: muscles assigned to this direction get positive
              //    activation, distributed by their bell-weighted share.
              distributeToSection(sectionKey, directionAngle, side, d.effort * splitMult * primaryMult, contribLabel);

              // 2) ANTAGONIST: muscles assigned to the OPPOSITE direction
              //    get negative activation of the same magnitude, at the
              //    opposite-direction angle. Multi-joint / bilateral
              //    agonist-antagonist coupling cancels here.
              distributeToSection(oppositeKey, -directionAngle, side, -d.effort * splitMult * primaryMult, contribLabel, antagonistSkip);

              // 3) BRACING: direct rectus-abdominis activation for the
              //    off-loaded portion of Spine.extension demand. Labeled
              //    distinctly so users can see bracing vs. normal routes
              //    in the contribution chips.
              if (bFrac > 0) {
                  const bracingDelta = d.effort * splitMult * bFrac;
                  if (Math.abs(bracingDelta) > 1e-9) {
                      const key = `${side}|rectus-abdominis`;
                      if (!acc[key]) acc[key] = { side, muscleId: 'rectus-abdominis', activation: 0 };
                      acc[key].activation += bracingDelta;
                      if (contributionsOut) {
                          if (!contributionsOut[key]) {
                              contributionsOut[key] = { positive: new Set(), negative: new Set() };
                          }
                          contributionsOut[key].positive.add('Spine Extension (bracing)');
                      }
                  }
              }
          }
      }
      // No upper clamp at this stage. Raw activations scale linearly with
      // action_effort, so they can legitimately exceed 1.0 when force
      // magnitude is set high — the Option-B auto-normalization downstream
      // divides by max_action_effort to bring them back into [0, 1] at
      // display time. Previously clamping at 1.0 here defeated that math
      // (primary saturated early, then got re-divided by a larger denom
      // → under-reads).
      //
      // Lower clamp at −1 preserves antagonist-cancellation bookkeeping;
      // the downstream `> 1e-6` filter drops fully-negative entries.
      for (const key of Object.keys(acc)) {
          const a = acc[key].activation;
          if (a < -1) acc[key].activation = -1;
      }
      return acc;
  };

  const muscleActivation = useMemo<MuscleActivation[]>(() => {
      if (!torqueDistribution || torqueDistribution.demands.length === 0) return [];
      const acc = distributeMuscleLoadForFrame(torqueDistribution.demands, posture, twists, muscleAssignments, sectionScales, undefined, bracingFraction);
      return Object.entries(acc)
          .map(([key, a]) => ({
              key,
              side: a.side,
              muscleId: a.muscleId,
              muscleName: MUSCLE_CATALOG.find(m => m.id === a.muscleId)?.name || a.muscleId,
              activation: a.activation,
          }))
          .filter(a => a.activation > 1e-6)
          .sort((a, b) => b.activation - a.activation);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torqueDistribution, muscleAssignments, sectionScales, posture, twists, bracingFraction]);

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
  // Per-muscle peak across the timeline. Same shape as TimelinePeak but
  // keyed by (side, muscleId) instead of (boneId, action). The 1RM
  // normalization step rescales `peakActivation` so the heaviest-loaded
  // muscle anywhere in the ROM reads exactly 1.0 — making muscle peaks
  // self-comparable but on a different scale than the joint-action peaks
  // (which are scaled to the limiting joint action). The muscle view in
  // the UI applies its own muscle-relative scale on top of this.
  interface MusclePeak {
      side: string;
      muscleId: string;
      muscleName: string;
      peakActivation: number;
      peakFramePct: number;
      // Joint-action labels aggregated across the timeline frames.
      // `positive`: demand actions that increased this muscle's
      // activation (agonist routes). `negative`: demand actions that
      // reduced it via the antagonist rule (opposite-section routing).
      // Each label is action-only ("Hip Extension"), side-agnostic.
      positiveContributors: string[];
      negativeContributors: string[];
  }
  // Time series of activation per muscle across frames, parallel to profile[].
  interface MuscleTimeSeries {
      side: string;
      muscleId: string;
      muscleName: string;
      activations: number[];
  }
  interface TimelineAnalysisResult {
      peaks: TimelinePeak[];
      limitingPeak: TimelinePeak | null;
      // Limiting JOINT — the (boneId, jointGroup) whose summed action
      // effort reaches the timeline's max combined load, and the frame
      // % at which that peak occurred. Used by the "Limiting Factor"
      // header in the Timeline Peaks tab now that joints (not joint
      // actions) are the unit of analysis. May differ from
      // limitingPeak if the joint's load is split across multiple
      // simultaneous actions (e.g. shoulder doing flex + hAdd at
      // once may peak as a JOINT before any single action peaks).
      limitingJoint: { boneId: string; jointGroup: JointGroup; peakFramePct: number } | null;
      framesAnalyzed: number;
      framesSkipped: number; // solver failures
      profile: TimelineProfilePoint[];
      actionSeries: ActionTimeSeries[];
      // Muscle-view counterparts. Same frames, same global 1RM scale on
      // joint-action efforts, then per-muscle activation derived from those
      // efforts via distributeMuscleLoadForFrame and normalized so the
      // peak-loaded muscle = 1.0 across the timeline.
      musclePeaks: MusclePeak[];
      muscleSeries: MuscleTimeSeries[];
      limitingMuscle: MusclePeak | null;
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
      // Per-muscle time series: key = "${side}|${muscleId}". Same frame
      // indexing as profile[]. Activation values here are the raw sums
      // (pre-normalization) — the global 1RM rescale below multiplies them
      // by the same scale the joint demands get, then a muscle-relative
      // scale fixes the limiting muscle to 1.0.
      const muscleSeriesMap = new Map<string, { side: string; muscleId: string; activations: number[] }>();
      const musclePeakMap = new Map<string, { side: string; muscleId: string; peakActivation: number; peakFramePct: number }>();
      // Aggregated across all frames: per-muscle set of demand actions
      // that ever contributed positively (agonist) vs. negatively
      // (antagonist). Populated by distributeMuscleLoadForFrame via the
      // optional contributionsOut parameter. The union across frames
      // captures every action that was ever non-zero in the ROM.
      const muscleContributions: Record<string, { positive: Set<string>; negative: Set<string> }> = {};
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
              framePose, frameTw, forces, jointCapacities, constraints, t, effortExponent
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

              // Peak tracking — compare on EFFORT (τ/capacity), not raw
              // torque. Capacity varies with joint angle (cosine bell
              // between base and specific), so the frame with the highest
              // torque often isn't the frame where the muscle is working
              // hardest. Lateral raise is the canonical example: torque
              // is maximal near horizontal (long moment arm) but capacity
              // is also peaking there, while at the start of the lift
              // torque is tiny but capacity is at its worst-angle base —
              // effort can actually peak at the bottom of the ROM. Using
              // torque as the comparator hid that and caused the action's
              // displayed peak to disagree with the joint sparkline (which
              // iterates the raw effort series and finds the true peak).
              const prev = peakMap.get(key);
              if (!prev || d.effort > prev.peakEffort) {
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

          // --- Per-muscle activation for this frame ---
          // Distribute this frame's joint demands across assigned muscles
          // using the bell-curve weights at the joint's current angle.
          // Track per-(side, muscle) activation in time series + peak map.
          const frameMuscle = distributeMuscleLoadForFrame(dist.demands, framePose, frameTw, muscleAssignments, sectionScales, muscleContributions, bracingFraction);
          const frameMuscleKeys = new Set<string>();
          for (const [key, m] of Object.entries(frameMuscle)) {
              // Clamp net-negative activation to 0 — antagonist demands can
              // drive a muscle's net below 0, but we don't display negative
              // activation. Same convention as the live filter on the
              // muscleActivation memo. A muscle whose net comes out 0 still
              // gets a 0 sample so the sparkline aligns; muscles whose peak
              // stays at 0 across the whole timeline get filtered out below.
              const a = Math.max(0, m.activation);
              frameMuscleKeys.add(key);
              let series = muscleSeriesMap.get(key);
              if (!series) {
                  // First sighting: backfill 0s for prior frames the same
                  // way actionSeries does. profile.length already includes
                  // this frame, so subtract 1.
                  const backfill = new Array(Math.max(0, profile.length - 1)).fill(0);
                  series = { side: m.side, muscleId: m.muscleId, activations: backfill };
                  muscleSeriesMap.set(key, series);
              }
              series.activations.push(a);

              // Peak tracking.
              const prevPeak = musclePeakMap.get(key);
              if (!prevPeak || a > prevPeak.peakActivation) {
                  musclePeakMap.set(key, {
                      side: m.side,
                      muscleId: m.muscleId,
                      peakActivation: a,
                      peakFramePct: t * 100,
                  });
              }
          }
          // Push 0 for any muscle series that existed but had no activation this frame.
          for (const [key, series] of muscleSeriesMap) {
              if (!frameMuscleKeys.has(key)) series.activations.push(0);
          }
      }

      const peaks = Array.from(peakMap.values());
      let limitingPeak: TimelinePeak | null = null;
      for (const p of peaks) {
          if (!limitingPeak || p.peakEffort > limitingPeak.peakEffort) limitingPeak = p;
      }

      // --- 1RM GLOBAL NORMALIZATION (joint-level) ---
      //
      // 1RM is detected at the JOINT level, not the joint-action level.
      // A joint (e.g., "Right Shoulder") can be doing several actions
      // simultaneously (flex + hAdd + IR for a bench press); each action
      // draws on shared muscles, so the joint's actual load is the SUM
      // of its action efforts. When that sum reaches 1.0, the joint is
      // fully loaded and the scene is at 1RM.
      //
      // Math for "50% flex + 50% hAdd simultaneously":
      //   joint_effort = 0.5 + 0.5 = 1.0  → joint is at 1RM
      //   individual action efforts display proportionally after the
      //   1RM scale is applied back to them
      //
      // Scale factor = 1 / max_joint_effort_across_ROM. Applied
      // uniformly to action peaks / profile / action time series, and
      // also to muscle peaks / series (so the limiting joint's muscles
      // reach 100% too). Muscle values are clamped at 1.0 after
      // scaling — if a muscle is already saturated pre-scale (from
      // biarticular stacking) it stays at 1.0; otherwise it gets
      // rescaled in step with its joint.
      const actionSeries = Array.from(seriesMap.values());
      const frameCount = profile.length;

      // Joint key: (jointGroup, side, sub-joint). Side derived from boneId.
      // Sub-joint splits rotations from translations at shoulder/hip, and
      // splits scapula into vertical (elev/dep) vs. horizontal (prot/ret) —
      // these sub-joints use anatomically distinct muscle pools, so they
      // shouldn't share the same "joint effort" budget in the 1RM math.
      const subJointSuffix = (jointGroup: string, actionName: string): string => {
          // Bucketing rule: non-competing actions on the same joint sum
          // into one bucket (different axes can co-fire mechanically).
          // Competing pairs (same axis, opposite direction) are handled
          // by antagonist suppression upstream — only one of each pair
          // has positive effort at any frame, so summing within a bucket
          // doesn't double-count antagonist activity.
          //
          // Rotation is NOT split out: although IR/ER recruits a different
          // muscle pool than flex/abd, the joint's mechanical capacity is
          // shared across all its DOFs, and the ~user wants joint demand
          // to reflect total mechanical load on the joint regardless of
          // which muscle pool handles each axis. Scapula keeps its split
          // (vert vs horiz) for now since those axes are mechanically
          // independent and use entirely separate musculature.
          if (jointGroup === 'Scapula') {
              if (/Elevation|Depression/.test(actionName)) return 'vert';
              if (/Protraction|Retraction/.test(actionName)) return 'horiz';
          }
          return '';
      };
      const jointKeyOf = (s: { boneId: string; jointGroup: string; action: string }): string => {
          if (s.boneId === 'spine') return 'spine';
          const side = s.boneId.startsWith('l') ? 'L'
                     : s.boneId.startsWith('r') ? 'R' : 'C';
          const sub = subJointSuffix(s.jointGroup, s.action);
          return sub ? `${s.jointGroup}-${side}-${sub}` : `${s.jointGroup}-${side}`;
      };
      // For each frame, sum action efforts grouped by joint. Take the
      // max joint effort across that frame, then max over all frames.
      // Also track WHICH joint and WHICH frame produced that max — that
      // pair is the timeline's limiting joint and its peak frame, used
      // by the "Limiting Factor: <joint>, peaks at X%" header.
      let globalMaxJointEffort = 0;
      let limitingJointInfo: { boneId: string; jointGroup: JointGroup; peakFrameIdx: number } | null = null;
      for (let i = 0; i < frameCount; i++) {
          const jointEfforts = new Map<string, { effort: number; boneId: string; jointGroup: JointGroup }>();
          for (const s of actionSeries) {
              const k = jointKeyOf(s);
              const cur = jointEfforts.get(k);
              if (cur) cur.effort += s.efforts[i];
              else jointEfforts.set(k, { effort: s.efforts[i], boneId: s.boneId, jointGroup: s.jointGroup });
          }
          for (const je of jointEfforts.values()) {
              if (je.effort > globalMaxJointEffort) {
                  globalMaxJointEffort = je.effort;
                  limitingJointInfo = { boneId: je.boneId, jointGroup: je.jointGroup, peakFrameIdx: i };
              }
          }
      }

      if (globalMaxJointEffort > 1e-9) {
          const scale = 1 / globalMaxJointEffort;
          // Joint-1RM scale applies to the JOINT EFFORT / ACTION DEMAND
          // displays: it renormalizes so the limiting joint reads 100%.
          // This is a DISPLAY transform on a relative metric.
          for (const p of peaks) {
              p.peakEffort *= scale;
              p.peakTorque *= scale;
          }
          for (const pt of profile) {
              pt.difficulty *= scale;
              pt.resistance *= scale;
          }
          for (const s of actionSeries) {
              for (let i = 0; i < s.efforts.length; i++) {
                  s.efforts[i] *= scale;
              }
          }
      }

      // Muscle auto-normalization using globalMaxJointEffort — the SAME
      // denominator the joint-demand display uses. This guarantees that a
      // section with one muscle (e.g. tibialis anterior on Ankle.dorsi-
      // Flexion) reads the same percentage as its joint action. Earlier
      // versions used maxRawActionEffort (max single action across the
      // rep), which made solo-muscle sections diverge from their joint
      // demand whenever the limiting joint had multiple co-active actions
      // (e.g. shoulder doing flex + abd + IR concurrently — the per-joint
      // sum can be 1.5–2× the largest single action). For multi-muscle
      // sections the section scale calibration handles share splitting,
      // so the consistent denominator preserves "primary at 100% MVC at
      // its section's peak frame" too.
      if (globalMaxJointEffort > 1e-9) {
          const muscleScale = 1 / globalMaxJointEffort;
          for (const mp of musclePeakMap.values()) {
              mp.peakActivation = Math.min(1, mp.peakActivation * muscleScale);
          }
          for (const ms of muscleSeriesMap.values()) {
              for (let i = 0; i < ms.activations.length; i++) {
                  ms.activations[i] = Math.min(1, ms.activations[i] * muscleScale);
              }
          }
      }

      const musclePeaks: MusclePeak[] = Array.from(musclePeakMap.values())
          // Drop muscles whose timeline peak is essentially zero — happens
          // when a muscle is purely antagonised across the whole rep (its
          // bell-share contributions all came in negative and got clamped).
          .filter(mp => mp.peakActivation > 1e-6)
          .map(mp => {
              // Aggregate contributions: actions that EVER contributed
              // positively vs. ever contributed negatively across any
              // timeline frame. A given action may appear in both sets
              // (e.g. when bell weight flips sign mid-ROM); in that case
              // we keep it only on the "positive" side since net
              // contribution across the rep is what the user cares about.
              const contribs = muscleContributions[`${mp.side}|${mp.muscleId}`];
              const pos = contribs ? Array.from(contribs.positive).sort() : [];
              const neg = contribs ? Array.from(contribs.negative).filter(a => !contribs.positive.has(a)).sort() : [];
              return {
                  side: mp.side,
                  muscleId: mp.muscleId,
                  muscleName: MUSCLE_CATALOG.find(m => m.id === mp.muscleId)?.name || mp.muscleId,
                  peakActivation: mp.peakActivation,
                  peakFramePct: mp.peakFramePct,
                  positiveContributors: pos,
                  negativeContributors: neg,
              };
          });
      const muscleSeries: MuscleTimeSeries[] = Array.from(muscleSeriesMap.values()).map(ms => ({
          side: ms.side,
          muscleId: ms.muscleId,
          muscleName: MUSCLE_CATALOG.find(m => m.id === ms.muscleId)?.name || ms.muscleId,
          activations: ms.activations,
      }));
      let limitingMuscle: MusclePeak | null = null;
      for (const mp of musclePeaks) {
          if (!limitingMuscle || mp.peakActivation > limitingMuscle.peakActivation) limitingMuscle = mp;
      }

      const limitingJoint = limitingJointInfo ? {
          boneId: limitingJointInfo.boneId,
          jointGroup: limitingJointInfo.jointGroup,
          peakFramePct: frameCount > 1
              ? (limitingJointInfo.peakFrameIdx / (frameCount - 1)) * 100
              : 0,
      } : null;

      return { peaks, limitingPeak, limitingJoint, framesAnalyzed, framesSkipped, profile, actionSeries, musclePeaks, muscleSeries, limitingMuscle };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startPosture, endPosture, startTwists, endTwists, forces, constraints, jointCapacities, jointLimits, muscleAssignments, sectionScales, effortExponent, bracingFraction]);

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

      // If the drag starts in a limit-violating posture, don't apply the
      // new-violation check (we can't strictly enforce when we're already
      // past the boundary — just let the drag proceed as before). For
      // valid starting poses, each step must not introduce a new violation
      // on ANY joint (including downstream effects like scapula changes
      // shifting shoulder position past its limit).
      const startedInViolation = postureViolatesLimits(posture, twists);

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
          const limitsOk = solved !== null && (startedInViolation || !postureViolatesLimits(solved.posture, solved.twists));
          if (limitsOk && solved !== null) {
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

      const startedInViolation = postureViolatesLimits(posture, twists);

      let progress = 0;
      let step = NOMINAL_STEP;
      while (progress < 1 - 1e-9) {
          const nextProgress = Math.min(1, progress + step);
          const stepAngle = startAngle + totalDelta * nextProgress;
          const stepDir = hingeAngleToDir(selectedBone, stepAngle * Math.PI / 180);

          let tentative: Posture = { ...workingPosture, [selectedBone]: stepDir };
          if (symmetryMode) tentative = mirrorPosture(tentative, selectedBone);

          const solved = solveConstraintsAccommodating(tentative, lockedSet, workingTwists);
          const limitsOk = solved !== null && (startedInViolation || !postureViolatesLimits(solved.posture, solved.twists));
          if (limitsOk && solved !== null) {
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

    // Symmetry mode: spine lateral flex (the X axis component of the
    // spine's direction vector) is asymmetric by definition — bending
    // sideways stretches one side and compresses the other. The slider
    // is disabled in the UI; this is a belt-and-suspenders coercion in
    // case anything bypasses that.
    if (symmetryMode && selectedBone === 'spine' && axis === 'x') {
        newValue = 0;
    }

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

        const startedInViolation = postureViolatesLimits(posture, twists);

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
            const limitsOk = solved !== null && (startedInViolation || !postureViolatesLimits(solved.posture, solved.twists));
            if (limitsOk && solved !== null) {
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
    //
    // FEMUR special case: Hip.dir.{x,y,z} limits are interpreted in the
    // PELVIS frame (getDimensionValue transforms before reading the
    // component). A world-frame clamp on targetComp against a pelvis-
    // frame bound is wrong — when the spine is tilted, the world-frame
    // value that corresponds to the pelvis-frame limit is different. We
    // solve analytically: pelvisLocal[axis] is linear in targetComp
    // (holding other stored components fixed), so we can invert the
    // relationship to get the world-frame bounds that produce the
    // pelvis-frame limit. Falls back to the world-frame clamp when the
    // slope is degenerate (axis nearly perpendicular to the pelvis axis).
    const dirGroup = getBoneJointGroup(selectedBone);
    if (dirGroup) {
        const dims = limitDimensionsForGroup(dirGroup);
        const dirDim = dims.find(d => d.kind === 'dir' && d.component === axis);
        if (dirDim) {
            const eff = getEffectiveLimit(dirDim.key, selectedBone, posture, twists);
            if (eff) {
                const isFemur = /Femur/.test(selectedBone);
                if (isFemur) {
                    // Build rootFrame / pelvisFrame from current state (must
                    // match calculateKinematics). Legs parent off rootFrame,
                    // so stored femur → world via localToWorld(rootFrame, …).
                    const spineRaw = posture['spine'] || { x: 0, y: -1, z: 0 };
                    const sMag = Math.sqrt(spineRaw.x*spineRaw.x + spineRaw.y*spineRaw.y + spineRaw.z*spineRaw.z) || 1;
                    const spineDirN = { x: spineRaw.x/sMag, y: spineRaw.y/sMag, z: spineRaw.z/sMag };
                    const pelvisYaw = twists['pelvis'] || 0;
                    const rootFrameBase = createRootFrame({ x: 0, y: 1, z: 0 });
                    const rootFrame = twistFrame(rootFrameBase, pelvisYaw);
                    const pelvisFrameBase = createRootFrame({ x: -spineDirN.x, y: -spineDirN.y, z: -spineDirN.z });
                    const pelvisFrame = twistFrame(pelvisFrameBase, pelvisYaw);

                    // pelvisLocal[axis] = dot(pelvisFrame[axis], worldDir)
                    //   where worldDir = rootFrame.x * stored.x + rootFrame.y * stored.y + rootFrame.z * stored.z
                    // Holding stored.{other axes} fixed, this is linear in targetComp:
                    //   pelvisLocal[axis] = offset + slope * targetComp
                    //   slope = dot(pelvisFrame[axis], rootFrame[axis])
                    //   offset = Σ over i≠axis of dot(pelvisFrame[axis], rootFrame.i) * startDir.i
                    const pf = pelvisFrame[axis];
                    const slopes = {
                        x: dotProduct(pf, rootFrame.x),
                        y: dotProduct(pf, rootFrame.y),
                        z: dotProduct(pf, rootFrame.z),
                    };
                    const slope = slopes[axis];
                    const offset =
                          (axis !== 'x' ? slopes.x * startDir.x : 0)
                        + (axis !== 'y' ? slopes.y * startDir.y : 0)
                        + (axis !== 'z' ? slopes.z * startDir.z : 0);

                    // Pelvis-frame limits for this axis. Left-side x is
                    // stored as the negated pelvis-local x (bilateral
                    // normalization), so the bounds invert: if the stored
                    // dim value is in [eff.min, eff.max], the pelvis-local
                    // value is in [-eff.max, -eff.min] for the left side.
                    let pelvisLo = eff.min, pelvisHi = eff.max;
                    if (axis === 'x' && selectedBone.startsWith('l')) {
                        pelvisLo = -eff.max;
                        pelvisHi = -eff.min;
                    }

                    if (Math.abs(slope) > 1e-6) {
                        const tcA = (pelvisLo - offset) / slope;
                        const tcB = (pelvisHi - offset) / slope;
                        const lo = Math.min(tcA, tcB);
                        const hi = Math.max(tcA, tcB);
                        targetComp = clamp(targetComp, lo, hi);
                    } else {
                        // Degenerate slope (this axis doesn't move pelvis-
                        // local[axis] at the current pose). Fall back to the
                        // world-frame clamp — the adaptive loop's
                        // postureViolatesLimits will catch any remaining
                        // out-of-range state.
                        const flipped = axis === 'x' && selectedBone.startsWith('l') ? -targetComp : targetComp;
                        const clamped = clamp(flipped, eff.min, eff.max);
                        targetComp = axis === 'x' && selectedBone.startsWith('l') ? -clamped : clamped;
                    }
                } else {
                    const flipped = axis === 'x' && selectedBone.startsWith('l') ? -targetComp : targetComp;
                    const clamped = clamp(flipped, eff.min, eff.max);
                    targetComp = axis === 'x' && selectedBone.startsWith('l') ? -clamped : clamped;
                }
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

    // Primary enforcement hook for cross-bone limit effects — e.g. dragging
    // the spine direction here will shift the femur's pelvis-local angle
    // (via pelvisFrame), so the hip.dir.x/y/z limits must be re-checked on
    // every step even though the femur itself isn't being dragged.
    const startedInViolation = postureViolatesLimits(posture, twists);

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
        const limitsOk = solved !== null && (startedInViolation || !postureViolatesLimits(solved.posture, solved.twists));
        if (limitsOk && solved !== null) {
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

    // Post-drag projection: the solver only saw the dragged axis lock,
    // not the joint's full box limits. If a non-dragged axis was left at
    // a value that's now out-of-bounds because of coupling (e.g. X was
    // -0.4 but we just dragged Y overhead, making X.eff.min = 0), clamp
    // it back into the box and re-normalize.
    const projected = projectDirIntoLimitBox(
        selectedBone,
        lastAcceptedPosture[selectedBone],
        lastAcceptedPosture,
        lastAcceptedTwists
    );
    lastAcceptedPosture = { ...lastAcceptedPosture, [selectedBone]: projected };
    if (symmetryMode && oppBone) {
        const oppProjected = projectDirIntoLimitBox(
            oppBone,
            lastAcceptedPosture[oppBone],
            lastAcceptedPosture,
            lastAcceptedTwists
        );
        lastAcceptedPosture = { ...lastAcceptedPosture, [oppBone]: oppProjected };
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

    // Symmetry mode: spine axial rotation is asymmetric by definition
    // (twisting the torso left or right breaks bilateral symmetry).
    // The slider is disabled in the UI; this coercion is a safety net.
    if (symmetryMode && selectedBone === 'spine') {
        val = 0;
    }

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
    // Spine is central (no mirror side), so store slider value directly.
    const storeVal = selectedBone === 'spine' ? clampedVal
                  : selectedBone.startsWith('l') ? clampedVal : -clampedVal;

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

    const startedInViolation = postureViolatesLimits(posture, twists);

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
        // Build the candidate posture+twists the same way the accept branch
        // will, so the limit check sees the preserved user-intended twist
        // rather than any drift the solver introduced.
        let candidatePosture: Posture | null = null;
        let candidateTwists: Record<string, number> | null = null;
        if (solved !== null) {
            candidatePosture = solved.posture;
            candidateTwists = { ...solved.twists, [selectedBone]: stepTwist };
            if (oppBone) candidateTwists[oppBone] = -stepTwist;
        }
        const limitsOk = candidatePosture !== null && candidateTwists !== null &&
            (startedInViolation || !postureViolatesLimits(candidatePosture, candidateTwists));
        if (limitsOk && candidatePosture !== null && candidateTwists !== null) {
            workingPosture = candidatePosture;
            workingTwists = candidateTwists;
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
    // Spine is central — display value = stored value directly.
    const twist = selectedBone === 'spine' ? raw
                : selectedBone.startsWith('l') ? raw : -raw;
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

  const toggleSymmetry = () => {
    setSymmetryMode(prev => {
        const next = !prev;
        if (next) {
            // Entering symmetry mode: scrub the spine clean of any
            // asymmetric DOFs already in the scene. Lateral flex
            // (spine.x) is dropped — the Y/Z components are
            // re-normalized so the forward/back tilt amount is
            // preserved. Spine axial twist (twists.spine) is zeroed.
            // We apply this to all three pose contexts (live + start
            // + end) so the figure stays consistent across timeline
            // playback. Forces and constraints are then re-mirrored
            // by applyWholesaleSync in the next user edit; we don't
            // automatically pick a side here because the user hasn't
            // told us which side is canonical yet.
            const sagittalSpine = (p: Posture): Posture => {
                const s = p['spine'];
                if (!s) return p;
                const yz = Math.sqrt(s.y * s.y + s.z * s.z);
                if (yz < 1e-9) return p;
                return { ...p, spine: { x: 0, y: s.y / yz, z: s.z / yz } };
            };
            const zeroSpineTwist = (t: Record<string, number>) => ({ ...t, spine: 0 });
            setPosture(sagittalSpine);
            setStartPosture(sagittalSpine);
            setEndPosture(sagittalSpine);
            setTwists(zeroSpineTwist);
            setStartTwists(zeroSpineTwist);
            setEndTwists(zeroSpineTwist);
        }
        return next;
    });
  };

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
    ratchetWatermarks.current.clear();
  };

  // Apply an exercise preset. Replaces the scene with the preset's poses,
  // forces, and constraints — IDs are assigned here since presets are
  // authored as pure data. The display pose is set to the start keyframe
  // and the timeline cursor is rewound to 0 so the user sees the start
  // position first. Symmetry mode is left as-is.
  const applyPreset = (preset: ExercisePreset) => {
    // Ratchet state belongs to the active scene; loading a preset starts
    // a fresh scene, so any one-way watermarks from a previous preset
    // must be cleared.
    ratchetWatermarks.current.clear();
    const sTwistsRaw = preset.startTwists || DEFAULT_TWISTS;
    const eTwistsRaw = preset.endTwists || DEFAULT_TWISTS;

    const baseId = Date.now().toString();
    const newForces: ForceConfig[] = preset.forces.map((f, i) => ({
        ...f,
        id: `${baseId}-f${i}`,
    }));

    // Build constraints first so we can pass them to the solver before
    // React state updates propagate. Without this, the solver's
    // `collectActiveConstraints()` closure would see the PREVIOUS
    // preset's constraints and solve against the wrong targets.
    const newConstraints: Record<string, BoneConstraint[]> = {};
    let cidx = 0;
    for (const [bid, list] of Object.entries(preset.constraints)) {
        newConstraints[bid] = list.map(c => ({
            ...c,
            id: `${baseId}-c${cidx++}`,
            physicsEnabled: c.physicsEnabled !== false,
        }));
    }

    // Smart pelvisT initialization: compute the average offset between
    // natural constraint-point positions (given the posture + pelvisT=0)
    // and the constraint CENTERS, then pre-shift pelvisT by that offset.
    // Without this, the solver often gets stuck in local minima for
    // poses that differ significantly from the one the constraint was
    // placed for (e.g. deep-squat start → lockout end) — it bends the
    // legs instead of translating the pelvis the full distance needed.
    // With the pre-shift, the solver starts close to the solution and
    // refines it to satisfy the constraint exactly.
    const initPelvisT = (posture: Posture, twists: Record<string, number>): Record<string, number> => {
        const kin = calculateKinematics(posture, twists);
        let dx = 0, dy = 0, dz = 0, count = 0;
        for (const [bid, consList] of Object.entries(newConstraints)) {
            for (const c of consList) {
                if (c.type !== 'fixed' || !c.active) continue;
                const natural = getConstraintPoint(bid, c, kin);
                if (!natural) continue;
                dx += c.center.x - natural.x;
                dy += c.center.y - natural.y;
                dz += c.center.z - natural.z;
                count++;
            }
        }
        if (count === 0) return twists;
        return {
            ...twists,
            pelvisTx: (twists.pelvisTx || 0) + dx / count,
            pelvisTy: (twists.pelvisTy || 0) + dy / count,
            pelvisTz: (twists.pelvisTz || 0) + dz / count,
        };
    };
    // Symmetry mode invariants — strip any asymmetric DOFs from the preset
    // before we hand it to the solver. Spine lateral flex (spine.x) and
    // spine axial rotation (twists.spine) and pelvis yaw (twists.pelvis)
    // all break bilateral symmetry; if a preset author left them non-zero
    // (or if the preset was authored without symmetry mode in mind), zero
    // them here so loading the preset doesn't silently violate the
    // symmetry constraint the user has enabled.
    const scrubSymmetric = (p: Posture): Posture => {
        if (!symmetryMode) return p;
        const s = p['spine'];
        if (!s) return p;
        const yz = Math.sqrt(s.y * s.y + s.z * s.z);
        if (yz < 1e-9) return p;
        return { ...p, spine: { x: 0, y: s.y / yz, z: s.z / yz } };
    };
    const scrubSymmetricTwists = (t: Record<string, number>): Record<string, number> => {
        if (!symmetryMode) return t;
        return { ...t, spine: 0, pelvis: 0 };
    };
    const sStartPosture = scrubSymmetric(preset.startPosture);
    const sEndPosture = scrubSymmetric(preset.endPosture);
    const sTwistsInit = scrubSymmetricTwists(initPelvisT(sStartPosture, sTwistsRaw));
    const eTwistsInit = scrubSymmetricTwists(initPelvisT(sEndPosture, eTwistsRaw));

    // Run the constraint solver against BOTH the start and end poses.
    // This replicates the UI workflow: the user drags limbs into position,
    // the solver adjusts pelvisTx/Ty/Tz to keep constraints satisfied. For
    // programmatic preset loading, we run the same solve here so the
    // constraint points actually land where the preset's limbs go, for
    // both ends of the motion. Empty locked-bones set = no user input =
    // solver can move any free DOF including pelvis translation.
    const startSolved = solveConstraintsAccommodating(
        sStartPosture, new Set(), sTwistsInit, [], new Set(), newConstraints,
    );
    const endSolved = solveConstraintsAccommodating(
        sEndPosture, new Set(), eTwistsInit, [], new Set(), newConstraints,
    );
    const startPost = startSolved?.posture ?? sStartPosture;
    const startTw = startSolved?.twists ?? sTwistsInit;
    const endPost = endSolved?.posture ?? sEndPosture;
    const endTw = endSolved?.twists ?? eTwistsInit;

    setStartPosture(startPost);
    setEndPosture(endPost);
    setStartTwists(startTw);
    setEndTwists(endTw);
    setPosture(startPost);
    setTwists(startTw);
    setPoseMode('start');
    setCurrentRomT(0);
    setSelectedBone(null);
    setTargetPos(null);
    setTargetReferenceBone(null);
    setIsPlaying(false);

    setForces(newForces);
    setConstraints(newConstraints);
    setEditingForceId(null);
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

  // --- Muscle assignment CRUD ---
  // actionSection key format: `${group}.${actionKey(directionName)}`. Direction
  // names are ActionAxis.positiveAction OR .negativeAction strings — each
  // direction is a distinct section because the muscles that produce flexion
  // and extension are completely different.
  const addMuscleToAction = (sectionKey: string, muscleId: string) => {
      setMuscleAssignments(prev => {
          const existing = prev[sectionKey] || {};
          if (existing[muscleId]) return prev; // already assigned
          return {
              ...prev,
              [sectionKey]: {
                  ...existing,
                  [muscleId]: { base: 30, peak: 80, angle: 90, steepness: 1 },
              },
          };
      });
  };
  const removeMuscleFromAction = (sectionKey: string, muscleId: string) => {
      setMuscleAssignments(prev => {
          const section = prev[sectionKey];
          if (!section || !section[muscleId]) return prev;
          const next = { ...section };
          delete next[muscleId];
          return { ...prev, [sectionKey]: next };
      });
  };
  const updateMuscleContribution = (sectionKey: string, muscleId: string, field: keyof MuscleContribution, value: number) => {
      if (isNaN(value)) return;
      setMuscleAssignments(prev => {
          const section = prev[sectionKey] || {};
          const cur = section[muscleId] || { base: 30, peak: 80, angle: 90 };
          return {
              ...prev,
              [sectionKey]: {
                  ...section,
                  [muscleId]: { ...cur, [field]: value },
              },
          };
      });
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

        // Project the interpolated frame onto the constraint manifold so
        // constrained tips (e.g., a hand fixed to a barbell point) stay
        // on their constraints during playback. With empty input-bone sets
        // the solver treats all bones as free and enforces all active
        // constraints. On solver failure, fall back to the raw interpolated
        // pose to avoid freezing the animation — Timeline Peaks does the
        // same.
        const solved = solveConstraintsAccommodating(newPosture, new Set<string>(), newTwists);
        setPosture(solved ? solved.posture : newPosture);
        setTwists(solved ? solved.twists : newTwists);
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
            {/* Exercise preset picker. Dropdown of common gym exercises —
                each sets pose keyframes, forces, and constraints in one
                click. Grouped by category (Push / Pull / Legs /
                Isolation) for quick scanning. */}
            <div className="relative" ref={presetMenuRef}>
                <button
                    onClick={() => setPresetMenuOpen(v => !v)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border shadow-sm ${presetMenuOpen ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200 hover:bg-gray-50'} text-gray-600`}
                    title="Load Exercise Preset"
                >
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide hidden sm:inline">Presets</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${presetMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {presetMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-[70vh] overflow-y-auto">
                        {EXERCISE_PRESETS.length === 0 && (
                            <div className="p-4 text-xs text-gray-400 text-center">
                                No presets yet.
                            </div>
                        )}
                        {(['Push', 'Pull', 'Legs', 'Isolation'] as const).map(category => {
                            const inCat = EXERCISE_PRESETS.filter(p => p.category === category);
                            if (inCat.length === 0) return null;
                            return (
                                <div key={category} className="p-2 border-b border-gray-100 last:border-b-0">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 pb-1">{category}</div>
                                    {inCat.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => { applyPreset(p); setPresetMenuOpen(false); }}
                                            className="w-full text-left px-2 py-2 rounded-lg hover:bg-indigo-50 transition-colors group"
                                        >
                                            <div className="text-sm font-bold text-gray-800 group-hover:text-indigo-700">{p.name}</div>
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
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
            axisCircles={jointAxisCircles}
            selectedBone={selectedBone}
            onSelectBone={handleBoneSelect}
            targetPos={targetPos}
            targetReferenceBone={targetReferenceBone}
            hoveredConstraintId={hoveredConstraintId}
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
            <button onClick={() => setActiveTab('muscles')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'muscles' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Muscles"><Activity className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('modifications')} className={`flex-1 min-w-[3rem] flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'modifications' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Cross-Joint Modifications"><Link2 className="w-5 h-5" /></button>
          </div>

          <div className="flex items-center gap-3 mb-6 shrink-0">
            {activeTab === 'kinematics' && <Settings2 className="w-5 h-5 text-indigo-600" />}
            {activeTab === 'constraints' && <Axis3d className="w-5 h-5 text-violet-600" />}
            {activeTab === 'kinetics' && <Zap className="w-5 h-5 text-orange-500" />}
            {activeTab === 'torque' && <Scale className="w-5 h-5 text-gray-800" />}
            {activeTab === 'timeline' && <TrendingUp className="w-5 h-5 text-emerald-600" />}
            {activeTab === 'capacities' && <Gauge className="w-5 h-5 text-purple-600" />}
            {activeTab === 'limits' && <Lock className="w-5 h-5 text-rose-600" />}
            {activeTab === 'muscles' && <Activity className="w-5 h-5 text-teal-600" />}
            {activeTab === 'modifications' && <Link2 className="w-5 h-5 text-amber-600" />}
            <h3 className="text-lg font-bold text-gray-900">
                {activeTab === 'kinematics' ? 'Motion Editor' :
                 activeTab === 'constraints' ? 'Constraints' :
                 activeTab === 'kinetics' ? 'External Forces' :
                 activeTab === 'capacities' ? 'Joint Capacities' :
                 activeTab === 'limits' ? 'Joint Limits' :
                 activeTab === 'muscles' ? 'Muscles' :
                 activeTab === 'modifications' ? 'Cross-Joint Modifications' :
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

                        {isHinge ? (
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
                            {/* Symmetry mode: spine lateral flex (X) and axial rotation are
                                disabled because they're inherently asymmetric — bending
                                or twisting the torso breaks bilateral symmetry. The
                                handlers also clamp these inputs to 0 if anything sneaks
                                past the disabled state. */}
                            {(() => {
                                const spineLocked = symmetryMode && selectedBone === 'spine';
                                return (
                                <>
                                    <div><div className="flex justify-between mb-2"><label className={`font-bold text-xs flex items-center gap-2 ${spineLocked ? 'text-gray-300' : 'text-gray-700'}`}><span className="w-2 h-2 rounded-full bg-red-500"></span>X Axis (Left/Right){spineLocked && <span className="text-[9px] font-medium text-gray-400 normal-case">— locked by symmetry</span>}</label><span className={`font-mono font-bold text-xs ${spineLocked ? 'text-gray-300' : 'text-gray-500'}`}>{intentCoords.x}</span></div><input type="range" min="-150" max="150" step="1" disabled={spineLocked} value={intentCoords.x} onChange={(e) => handlePointChange('x', parseFloat(e.target.value))} className={`bio-range w-full text-gray-900 ${spineLocked ? 'opacity-40 cursor-not-allowed' : ''}`}/></div>
                                    <div><div className="flex justify-between mb-2"><label className="font-bold text-gray-700 text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span>Y Axis (Down/Up)</label><span className="font-mono text-gray-500 font-bold text-xs">{intentCoords.y}</span></div><input type="range" min="-150" max="150" step="1" value={intentCoords.y} onChange={(e) => handlePointChange('y', parseFloat(e.target.value))} className="bio-range w-full text-gray-900"/></div>
                                    <div><div className="flex justify-between mb-2"><label className="font-bold text-gray-700 text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Z Axis (Ext/Flex)</label><span className="font-mono text-gray-500 font-bold text-xs">{intentCoords.z}</span></div><input type="range" min="-150" max="150" step="1" value={intentCoords.z} onChange={(e) => handlePointChange('z', parseFloat(e.target.value))} className="bio-range w-full text-gray-900"/></div>
                                    <div className="pt-4 mt-4 border-t border-gray-100">
                                        <div className="flex justify-between mb-2">
                                            <label className={`font-bold text-xs flex items-center gap-2 ${spineLocked ? 'text-gray-300' : 'text-gray-700'}`}><RefreshCw className={`w-3 h-3 ${spineLocked ? 'text-gray-300' : 'text-orange-500'}`} />Rotation {selectedBone === 'spine' ? '(R/L)' : '(Int/Ext)'}{spineLocked && <span className="text-[9px] font-medium text-gray-400 normal-case">— locked by symmetry</span>}</label>
                                            <span className={`font-mono font-bold text-xs ${spineLocked ? 'text-gray-300' : 'text-gray-500'}`}>{displayTwist}°</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={ROTATION_LIMITS[selectedBone]?.min ?? -90}
                                            max={ROTATION_LIMITS[selectedBone]?.max ?? 90}
                                            step="1"
                                            disabled={spineLocked}
                                            value={displayTwist}
                                            onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
                                            className={`bio-range w-full text-orange-500 ${spineLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        />
                                        {ROTATION_LIMITS[selectedBone] && (
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[9px] font-bold text-gray-400">{ROTATION_LIMITS[selectedBone].min}° ({selectedBone === 'spine' ? 'R' : 'Int'})</span>
                                                <span className="text-[9px] font-bold text-gray-400">{ROTATION_LIMITS[selectedBone].max}° ({selectedBone === 'spine' ? 'L' : 'Ext'})</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                                );
                            })()}
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

                          {/* Constraint complex presets — only shows the
                              presets that make sense for the selected bone
                              (e.g. "Ground" only on foot bones). Each click
                              adds the full bundle of constraints in one
                              shot; in symmetry mode the opposite side gets
                              the mirrored bundle automatically. */}
                          {CONSTRAINT_COMPLEX_PRESETS.filter(p => p.appliesTo(selectedBone)).length > 0 && (
                              <div className="space-y-2">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Complex Presets</span>
                                  <div className="flex gap-2 flex-wrap">
                                      {CONSTRAINT_COMPLEX_PRESETS
                                          .filter(p => p.appliesTo(selectedBone))
                                          .map(p => (
                                              <button
                                                  key={p.id}
                                                  onClick={() => addConstraintComplex(selectedBone, p.id)}
                                                  className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-sm shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2 text-xs"
                                                  title={p.description}
                                              >
                                                  <Plus className="w-3.5 h-3.5" /> {p.name}
                                              </button>
                                          ))}
                                  </div>
                              </div>
                          )}

                          {(constraints[selectedBone] || []).map((c, idx) => {
                              // Border + badge colors are now driven by the
                              // physicsEnabled flag, NOT by constraint type. A
                              // physical constraint (default) gets rose; a
                              // guide-only constraint gets violet. This
                              // matches the 3D marker palette so the panel
                              // and the figure stay visually in sync.
                              const isPhysics = c.physicsEnabled !== false;
                              const borderClass = c.active
                                  ? (isPhysics ? 'border-rose-200' : 'border-violet-200') + ' shadow-sm'
                                  : 'border-gray-100 opacity-70';
                              const badgeClass = !c.active
                                  ? 'bg-gray-100 text-gray-500'
                                  : isPhysics ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700';
                              return (
                              <div
                                key={c.id}
                                className={`bg-white border rounded-2xl p-4 transition-all ${borderClass}`}
                                onMouseEnter={() => setHoveredConstraintId(c.id)}
                                onMouseLeave={() => setHoveredConstraintId(prev => prev === c.id ? null : prev)}
                              >
                                  <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${badgeClass}`}>{c.type === 'fixed' ? <Lock className="w-3 h-3" /> : idx + 1}</div>
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

                                  {c.active && (() => {
                                      const isPhysics = c.physicsEnabled !== false;
                                      return (
                                          <div className={`mb-3 flex items-center justify-between px-3 py-2 rounded-lg ${isPhysics ? 'bg-gray-50' : 'bg-amber-50 border border-amber-200'}`}>
                                              <div className="flex items-center gap-2 min-w-0">
                                                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 flex-shrink-0">
                                                      {isPhysics ? 'Physical' : 'Guide Only'}
                                                  </span>
                                                  <span className="text-[10px] text-gray-400 truncate">
                                                      {isPhysics
                                                          ? 'path + force reaction'
                                                          : 'path only, no physics'}
                                                  </span>
                                              </div>
                                              <button
                                                  onClick={() => updateConstraint(selectedBone, c.id, { physicsEnabled: !isPhysics })}
                                                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${isPhysics ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                  title={isPhysics ? 'Disable physics — constraint becomes a kinematic guide' : 'Enable physics — constraint participates in force analysis'}
                                              >
                                                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${isPhysics ? 'translate-x-4' : 'translate-x-0'}`} />
                                              </button>
                                          </div>
                                      );
                                  })()}

                                  {/* Direction picker: only meaningful for planar constraints. Arc/fixed don't have a "side" concept. */}
                                  {c.active && c.type === 'planar' && (() => {
                                      const mode: 'both' | 'half-space' | 'one-way' = c.directional ?? 'both';
                                      const setMode = (m: 'both' | 'half-space' | 'one-way') => {
                                          updateConstraint(selectedBone, c.id, {
                                              directional: m === 'both' ? undefined : m,
                                          });
                                      };
                                      const blurb =
                                          mode === 'both'      ? 'plane blocks both sides (equality)' :
                                          mode === 'half-space' ? 'wall blocks +normal side; free in -normal' :
                                                                  'ratchet: wall slides with limb; no return';
                                      return (
                                          <div className="mb-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                                              <div className="flex items-center justify-between mb-2">
                                                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                                      Direction
                                                  </span>
                                                  <span className="text-[10px] text-gray-400 truncate ml-2">{blurb}</span>
                                              </div>
                                              <div className="flex gap-1">
                                                  <button
                                                      onClick={() => setMode('both')}
                                                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${mode === 'both' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-violet-50 border border-gray-200'}`}
                                                      title="Bidirectional plane: tip locked exactly on the plane (current default behavior)."
                                                  >
                                                      Both Sides
                                                  </button>
                                                  <button
                                                      onClick={() => setMode('half-space')}
                                                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${mode === 'half-space' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-violet-50 border border-gray-200'}`}
                                                      title="One-sided wall: tip can be anywhere on the −normal side; blocked when crossing into +normal. Wall stays where you place it (e.g. safety pins, floor)."
                                                  >
                                                      Half-Space
                                                  </button>
                                                  <button
                                                      onClick={() => setMode('one-way')}
                                                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${mode === 'one-way' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-violet-50 border border-gray-200'}`}
                                                      title="Ratchet: wall slides with the tip as it moves into the −normal halfspace, never letting it return. Models one-way bearings, latching mechanisms."
                                                  >
                                                      One-Way
                                                  </button>
                                              </div>
                                          </div>
                                      );
                                  })()}

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
                                                          if (c.type === 'arc' && c.axis) {
                                                              // Use live pivot for radius re-snap so
                                                              // anchored constraints stay coherent
                                                              // when the user drags the application
                                                              // point along the bone.
                                                              const curPivot = resolveArcPivot(c, kin) || c.pivot;
                                                              if (curPivot) {
                                                                  const snapped = snapArcToTip(curPivot, c.axis, newCenter);
                                                                  if (c.anchor) {
                                                                      // Anchored: radius is the only
                                                                      // pivot-related field that
                                                                      // updates; pivot itself is
                                                                      // joint-driven.
                                                                      updateConstraint(selectedBone, c.id, { position: newPos, center: newCenter, radius: snapped.radius });
                                                                  } else {
                                                                      updateConstraint(selectedBone, c.id, { position: newPos, center: newCenter, pivot: snapped.pivot, radius: snapped.radius });
                                                                  }
                                                              } else {
                                                                  updateConstraint(selectedBone, c.id, { position: newPos, center: newCenter });
                                                              }
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
                                  {c.active && c.type === 'arc' && c.axis && (() => {
                                      // Resolve the live pivot once for this row's render.
                                      // When `c.anchor` is set we display the live joint
                                      // position as read-only; otherwise the user edits
                                      // c.pivot directly.
                                      const liveKin = calculateKinematics(posture, twists);
                                      const livePivot = resolveArcPivot(c, liveKin) || c.pivot || { x: 0, y: 0, z: 0 };
                                      const isAnchored = !!c.anchor;
                                      return (
                                      <div className="space-y-4">
                                          {/* Joint anchor: pivot follows a body joint as the
                                              figure moves through the ROM. None = pivot is
                                              fixed in world space (legacy behavior). */}
                                          <div>
                                              <div className="flex justify-between items-center mb-2">
                                                  <label className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Anchor Pivot To Joint</label>
                                                  {isAnchored && <span className="font-mono text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">live</span>}
                                              </div>
                                              <select
                                                  value={c.anchor?.joint || ''}
                                                  onChange={(e) => {
                                                      const newJoint = e.target.value || null;
                                                      const kin = calculateKinematics(posture, twists);
                                                      const tip = kin.boneEndPoints[selectedBone];
                                                      if (!tip || !c.axis) return;
                                                      // Pivot snaps to the EXACT joint position
                                                      // (no axial projection), so the dropdown
                                                      // doubles as a "snap pivot to limb" tool:
                                                      // pick a joint to position the pivot
                                                      // there, then pick None to keep it frozen
                                                      // at that position without live-tracking.
                                                      // Radius = raw 3D distance from pivot to
                                                      // tip, so the constraint can have axial
                                                      // residual the solver will work to close.
                                                      if (newJoint === null) {
                                                          const cur = resolveArcPivot(c, kin) || c.pivot;
                                                          if (!cur) return;
                                                          const radius = magnitude(sub(tip, cur));
                                                          updateConstraint(selectedBone, c.id, { anchor: undefined, pivot: cur, radius });
                                                      } else {
                                                          const jp = getJointAnchorPos(newJoint, kin);
                                                          if (!jp) return;
                                                          const radius = magnitude(sub(tip, jp));
                                                          updateConstraint(selectedBone, c.id, { anchor: { joint: newJoint }, pivot: jp, radius });
                                                      }
                                                  }}
                                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700"
                                              >
                                                  <option value="">— None (manual pivot) —</option>
                                                  {Object.keys(JOINT_ANCHOR_POINTS).map(j => (
                                                      <option key={j} value={j}>{j}</option>
                                                  ))}
                                              </select>
                                              {isAnchored && (
                                                  <p className="text-[9px] text-emerald-600 mt-1.5 leading-snug">
                                                      Pivot follows <b>{c.anchor!.joint}</b> live as the figure moves.
                                                  </p>
                                              )}
                                          </div>
                                          <div>
                                              <div className="flex justify-between items-center mb-2">
                                                  <label className={`text-[9px] font-bold uppercase tracking-wide ${isAnchored ? 'text-gray-300' : 'text-gray-400'}`}>Pivot (x, y, z){isAnchored && <span className="ml-2 normal-case font-medium text-[8px] text-gray-300">— driven by anchor</span>}</label>
                                                  <span className="font-mono text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">r={Math.round(c.radius ?? 0)}</span>
                                              </div>
                                              <div className="space-y-2">
                                                  {(['x', 'y', 'z'] as const).map(axis => (
                                                      <div key={axis} className="flex items-center gap-2">
                                                          <span className={`text-[10px] font-bold w-2 uppercase ${isAnchored ? 'text-gray-300' : 'text-gray-400'}`}>{axis}</span>
                                                          <input type="number" step="5" disabled={isAnchored} value={Math.round(livePivot[axis])}
                                                              onChange={(e) => {
                                                                  if (isAnchored || !c.pivot) return;
                                                                  const rawPivot = { ...c.pivot, [axis]: parseFloat(e.target.value) || 0 };
                                                                  const kin = calculateKinematics(posture, twists);
                                                                  const tip = kin.boneEndPoints[selectedBone];
                                                                  if (!tip || !c.axis) return;
                                                                  const snapped = snapArcToTip(rawPivot, c.axis, tip);
                                                                  updateConstraint(selectedBone, c.id, { pivot: snapped.pivot, radius: snapped.radius });
                                                              }}
                                                              className={`flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono text-center ${isAnchored ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700'}`} />
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
                                                          // Use live pivot — works for both anchored
                                                          // (joint position) and manual (stored pivot).
                                                          const curPivot = resolveArcPivot(c, kin) || c.pivot;
                                                          if (!curPivot) return;
                                                          const snapped = snapArcToTip(curPivot, p.v, tip);
                                                          // For anchored constraints, only update axis +
                                                          // radius (pivot is anchor-driven). For manual,
                                                          // update pivot too so the snap takes effect.
                                                          if (isAnchored) {
                                                              updateConstraint(selectedBone, c.id, { axis: p.v, radius: snapped.radius });
                                                          } else {
                                                              updateConstraint(selectedBone, c.id, { axis: p.v, pivot: snapped.pivot, radius: snapped.radius });
                                                          }
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
                                                                  const curPivot = resolveArcPivot(c, kin) || c.pivot;
                                                                  if (!curPivot) return;
                                                                  const snapped = snapArcToTip(curPivot, newAxis, tip);
                                                                  if (isAnchored) {
                                                                      updateConstraint(selectedBone, c.id, { axis: newAxis, radius: snapped.radius });
                                                                  } else {
                                                                      updateConstraint(selectedBone, c.id, { axis: newAxis, pivot: snapped.pivot, radius: snapped.radius });
                                                                  }
                                                              }}
                                                              className="bio-range w-full text-amber-500" />
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      </div>
                                      );
                                  })()}
                              </div>
                              );
                          })}

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
                                                                {/* Current ROM position indicator */}
                                                                <line x1={PAD + currentRomT * plotW} x2={PAD + currentRomT * plotW} y1={PAD} y2={PAD + plotH} stroke="#0d9488" strokeWidth="1" opacity="0.85" />
                                                                <circle cx={PAD + currentRomT * plotW} cy={PAD} r="2" fill="#0d9488" />
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
                           {/* View toggle: joint actions (default) vs muscle activation. */}
                           <div className="bg-gray-50 rounded-xl p-1 flex gap-1">
                               <button
                                   onClick={() => setAnalysisView('joint')}
                                   className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${analysisView === 'joint' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                               >
                                   Joint Actions
                               </button>
                               <button
                                   onClick={() => setAnalysisView('muscle')}
                                   className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${analysisView === 'muscle' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                               >
                                   Muscles
                               </button>
                           </div>
                           {(() => {
                               // Compute the global normalization scale for this frame.
                               // 1rm-local: scale so the hardest (sub-)joint reaches
                               //   100%. Sub-joints split the shoulder/hip into
                               //   translation vs. rotation, and the scapula into
                               //   vertical vs. horizontal — each uses a distinct
                               //   muscle pool and has its own capacity ceiling.
                               // raw: no scaling (multiplier = 1, showing raw effort × 100).
                               const subJointSuffix = (jg: string, action: string): string => {
                                   // Mirrors the timeline-path subJointSuffix — see
                                   // there for the bucketing rule. Rotation is NOT
                                   // split out for shoulder/hip; only scapula splits
                                   // (vert vs horiz, mechanically independent axes).
                                   if (jg === 'Scapula') {
                                       if (/Elevation|Depression/.test(action)) return 'vert';
                                       if (/Protraction|Retraction/.test(action)) return 'horiz';
                                   }
                                   return '';
                               };
                               // Aggregate effort per (sub-)joint regardless of display mode
                               // so we can identify the limiting JOINT (not joint action) for
                               // the "Limiting Factor" header. In 1rm-local mode the same map
                               // also gives us the normalization scale.
                               type JointEffortInfo = { effort: number; boneId: string; jointGroup: JointGroup };
                               const jointEfforts: Record<string, JointEffortInfo> = {};
                               for (const d of torqueDistribution.demands) {
                                   const side = d.boneId === 'spine' ? '' :
                                                d.boneId.startsWith('l') ? 'L' :
                                                d.boneId.startsWith('r') ? 'R' : 'C';
                                   const sub = subJointSuffix(d.jointGroup, d.action);
                                   const k = d.boneId === 'spine' ? 'spine'
                                            : sub ? `${d.jointGroup}-${side}-${sub}` : `${d.jointGroup}-${side}`;
                                   const cur = jointEfforts[k];
                                   if (cur) cur.effort += d.effort;
                                   else jointEfforts[k] = { effort: d.effort, boneId: d.boneId, jointGroup: d.jointGroup };
                               }
                               let maxJointEffort = 0;
                               let limitingJointInfo: JointEffortInfo | null = null;
                               for (const je of Object.values(jointEfforts)) {
                                   if (je.effort > maxJointEffort) {
                                       maxJointEffort = je.effort;
                                       limitingJointInfo = je;
                                   }
                               }
                               const scale = (torqueDisplayMode === '1rm-local' && maxJointEffort > 1e-9)
                                   ? 1 / maxJointEffort
                                   : 1;
                               // Keep the action-level `limiting` around for the legacy
                               // muscle-view scale below; it's no longer used for the
                               // Limiting Factor header (which now reports the joint).
                               let limiting: JointActionDemand | null = null;
                               for (const d of torqueDistribution.demands) {
                                   if (!limiting || d.effort > limiting.effort) limiting = d;
                               }
                               // Group by (side, jointGroup, sub-joint) for display.
                               // Sub-joint suffix separates rotation from translation
                               // at shoulder/hip, and splits scapula by axis.
                               const subJointLabel = (jg: string, action: string): string => {
                                   // No sub-joint label split — shoulder/hip rotation
                                   // now sums into the main joint bucket alongside
                                   // flex/abd/etc. (non-competing axes). Scapula is
                                   // also treated as one joint group at the display
                                   // level (max of 2 scapula rows per pose: Left
                                   // Scapula and Right Scapula).
                                   return '';
                               };
                               const groups: Record<string, JointActionDemand[]> = {};
                               for (const d of torqueDistribution.demands) {
                                   const side = d.boneId.startsWith('l') ? 'Left' : d.boneId.startsWith('r') ? 'Right' : '';
                                   const subLabel = subJointLabel(d.jointGroup, d.action);
                                   const key = [side, d.jointGroup, subLabel].filter(Boolean).join(' ');
                                   if (!groups[key]) groups[key] = [];
                                   groups[key].push(d);
                               }
                               return (
                                   <>
                                       {limitingJointInfo && (() => {
                                           // Limiting joint = whichever joint's
                                           // SUMMED action effort is highest.
                                           // Matches the joint-level bar that
                                           // displays 100% in the grouped list
                                           // below.
                                           const lj = limitingJointInfo;
                                           const side = lj.boneId.startsWith('l') ? 'Left ' : lj.boneId.startsWith('r') ? 'Right ' : '';
                                           const jointLabel = side + lj.jointGroup;
                                           return (
                                           <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                                               <p className="text-[9px] font-bold uppercase tracking-wide text-red-400 mb-1">Limiting Factor</p>
                                               <p className="font-bold text-red-800 text-sm">{jointLabel}</p>
                                               <p className="text-[10px] text-red-500 font-medium">
                                                   {torqueDisplayMode === '1rm-local'
                                                       ? 'Highest demand at current pose · reads 100%'
                                                       : `Raw effort: ${(lj.effort * 100).toFixed(0)}% of capacity`}
                                               </p>
                                           </div>
                                           );
                                       })()}
                                       {/* Muscle activation roll-up. Splits each
                                         * joint-action demand across its assigned
                                         * muscles using their angle-weighted
                                         * relative shares, then sums per (side,
                                         * muscle). Same display scale as the
                                         * joint demands above (1RM-local: max
                                         * muscle reads 100%; raw: passes through).
                                         */}
                                       {analysisView === 'muscle' && muscleActivation.length > 0 && (() => {
                                           // Muscle auto-normalization using maxJointEffort — the
                                           // SAME denominator the joint-demand display uses above.
                                           // Solo-muscle sections (e.g. tibialis anterior on Ankle.
                                           // dorsiFlexion) read identical percentages on the joint
                                           // bar and the muscle bar. Earlier versions used max
                                           // single-action effort, which diverged from the joint
                                           // display whenever the limiting joint had multiple
                                           // co-active actions.
                                           const muscleScale = (torqueDisplayMode === '1rm-local' && maxJointEffort > 1e-9)
                                               ? 1 / maxJointEffort
                                               : 1;
                                           return (
                                               <div className="bg-white border border-gray-100 rounded-2xl p-4">
                                                   <div className="flex items-center gap-2 mb-3">
                                                       <Activity className="w-4 h-4 text-teal-600" />
                                                       <h4 className="font-bold text-gray-900 text-sm">Muscle Activation</h4>
                                                   </div>
                                                   <div className="space-y-2">
                                                       {muscleActivation.map(ma => {
                                                           const pct = Math.min(100, ma.activation * muscleScale * 100);
                                                           const barColor = pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-teal-400';
                                                           const sideTag = ma.side ? `${ma.side[0]} ` : '';
                                                           return (
                                                               <div key={ma.key}>
                                                                   <div className="flex justify-between items-center mb-1">
                                                                       <div className="flex items-center gap-2 min-w-0">
                                                                           <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: muscleColor(ma.muscleId) }} />
                                                                           <span className="font-bold text-gray-700 text-xs truncate">
                                                                               {sideTag && <span className="text-gray-400 font-mono">{sideTag}</span>}
                                                                               {ma.muscleName}
                                                                           </span>
                                                                       </div>
                                                                       <span className="font-mono text-xs font-bold text-gray-500 ml-2">{pct.toFixed(0)}%</span>
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
                                       })()}
                                       {analysisView === 'joint' && Object.entries(groups).map(([groupName, groupDemands]) => {
                                           const sorted = [...groupDemands].sort((a, b) => b.effort - a.effort);
                                           // Joint-level summary: sum of action efforts at this joint
                                           // is the joint's combined load; the 1RM scale makes the
                                           // hardest joint read 100%. Each action's bar underneath
                                           // reads as its proportion of the joint's capacity usage.
                                           const jointEffortRaw = groupDemands.reduce((s, d) => s + d.effort, 0);
                                           const jointPct = jointEffortRaw * scale * 100;
                                           const jointBarColor = jointPct > 80 ? 'bg-red-500' : jointPct > 50 ? 'bg-amber-500' : 'bg-indigo-500';
                                           return (
                                               <div key={groupName} className="bg-white border border-gray-100 rounded-2xl p-4">
                                                   <div className="flex items-baseline justify-between mb-1">
                                                       <h4 className="font-bold text-gray-900 text-sm">{groupName}</h4>
                                                       <span className="font-mono text-sm font-bold text-gray-700 tabular-nums">{jointPct.toFixed(0)}%</span>
                                                   </div>
                                                   <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                                                       <div className={`h-full rounded-full ${jointBarColor} transition-all duration-300`} style={{ width: `${Math.min(jointPct, 100)}%` }} />
                                                   </div>
                                                   <div className="space-y-1.5 pl-3 border-l-2 border-gray-100">
                                                       {sorted.map((d, i) => {
                                                           const actionName = d.action.replace(/^(Left|Right)\s+\w+\s+/, '');
                                                           const pct = d.effort * scale * 100;
                                                           const barColor = d.effort > 0.8 ? 'bg-red-400' : d.effort > 0.5 ? 'bg-amber-400' : 'bg-indigo-400';
                                                           return (
                                                               <div key={`${d.boneId}-${d.action}-${i}`}>
                                                                   <div className="flex justify-between items-center mb-0.5">
                                                                       <span className="font-bold text-gray-600 text-[11px]">{actionName}</span>
                                                                       <span className="font-mono text-[10px] font-bold text-gray-400 tabular-nums">{pct.toFixed(0)}%</span>
                                                                   </div>
                                                                   <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
                          {/* View toggle: joint actions (default) vs muscles. */}
                          <div className="bg-gray-50 rounded-xl p-1 flex gap-1">
                              <button
                                  onClick={() => setTimelineView('joint')}
                                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${timelineView === 'joint' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                              >
                                  Joint Actions
                              </button>
                              <button
                                  onClick={() => setTimelineView('muscle')}
                                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${timelineView === 'muscle' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                              >
                                  Muscles
                              </button>
                          </div>
                          {/* Limiting factor: the JOINT (not joint-action) whose
                              SUMMED action effort reaches the timeline's max load.
                              Both the label and the "peaks at X% of range" reflect
                              the joint-level peak — so if a joint's load is split
                              across two simultaneous actions, the displayed peak
                              frame matches when the joint's combined effort tops
                              out, not when any single action does. */}
                          {timelineView === 'joint' && timelineAnalysis.limitingJoint && (() => {
                              const lj = timelineAnalysis.limitingJoint;
                              const side = lj.boneId.startsWith('l') ? 'Left ' : lj.boneId.startsWith('r') ? 'Right ' : '';
                              const jointLabel = side + lj.jointGroup;
                              return (
                              <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-red-400 mb-1">Limiting Factor</p>
                                  <p className="font-bold text-red-800 text-sm">{jointLabel}</p>
                                  <p className="text-[10px] text-red-500 font-medium">
                                      Peaks at {lj.peakFramePct.toFixed(0)}% of range
                                  </p>
                              </div>
                              );
                          })()}
                          {timelineView === 'muscle' && timelineAnalysis.limitingMuscle && (
                              <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-red-400 mb-1">Most Activated Muscle</p>
                                  <p className="font-bold text-red-800 text-sm">
                                      {timelineAnalysis.limitingMuscle.side && <span className="text-red-400 font-mono">{timelineAnalysis.limitingMuscle.side[0]} </span>}
                                      {timelineAnalysis.limitingMuscle.muscleName}
                                  </p>
                                  <p className="text-[10px] text-red-500 font-medium">
                                      Peaks at {timelineAnalysis.limitingMuscle.peakFramePct.toFixed(0)}% of range
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
                                              {/* Current ROM position indicator */}
                                              <line x1={tx(currentRomT)} x2={tx(currentRomT)} y1={PAD_T} y2={PAD_T + plotH} stroke="#0d9488" strokeWidth="1" opacity="0.85" />
                                              <circle cx={tx(currentRomT)} cy={PAD_T} r="2.5" fill="#0d9488" stroke="white" strokeWidth="0.75" />
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
                          {timelineView === 'joint' && (() => {
                              // Group peaks by (side, jointGroup, sub-joint), matching
                              // the Joint Analysis tab. Sub-joint splits rotation from
                              // translation (shoulder/hip) and separates scapula by axis.
                              const subJointLabel = (jg: string, action: string): string => {
                                  // No sub-joint label split — see the live-path
                                  // subJointLabel for reasoning. Each joint rolls up
                                  // into one row per side (Left Shoulder, Right Hip,
                                  // Spine, etc.) regardless of action axis.
                                  return '';
                              };
                              const groups: Record<string, TimelinePeak[]> = {};
                              for (const p of timelineAnalysis.peaks) {
                                  const side = p.boneId.startsWith('l') ? 'Left' : p.boneId.startsWith('r') ? 'Right' : '';
                                  const subLabel = subJointLabel(p.jointGroup, p.action);
                                  const key = [side, p.jointGroup, subLabel].filter(Boolean).join(' ');
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
                                  peakT?: number,
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
                                          {/* Peak-position marker (matches the @X% in the
                                              header above this sparkline) */}
                                          {peakT !== undefined && peakT >= 0 && peakT <= 1 && (
                                              <line
                                                  x1={PAD + peakT * plotW}
                                                  x2={PAD + peakT * plotW}
                                                  y1={PAD}
                                                  y2={PAD + plotH}
                                                  stroke={color} strokeWidth="0.75" strokeDasharray="2 2" opacity="0.6"
                                              />
                                          )}
                                          {/* Current ROM position indicator */}
                                          <line
                                              x1={PAD + currentRomT * plotW}
                                              x2={PAD + currentRomT * plotW}
                                              y1={PAD}
                                              y2={PAD + plotH}
                                              stroke="#0d9488" strokeWidth="0.75" opacity="0.85"
                                          />
                                      </svg>
                                  );
                              };

                              return Object.entries(groups).map(([groupName, groupPeaks]) => {
                                  const sorted = [...groupPeaks].sort((a, b) => b.peakEffort - a.peakEffort);

                                  // Per-joint aggregate: SUM of action efforts across all
                                  // actions in this group at each frame index. Under the
                                  // joint-level 1RM model, a joint's effort is the sum of
                                  // its action efforts (simultaneous actions stack toward
                                  // the joint's ceiling).
                                  const nFrames = timelineAnalysis.profile.length;
                                  const jointEfforts = new Array(nFrames).fill(0);
                                  // Per-joint total torque at each frame (for computing
                                  // per-action proportions below).
                                  const jointTotalTorque = new Array(nFrames).fill(0);
                                  for (const p of sorted) {
                                      const series = seriesLookup.get(`${p.boneId}::${p.action}`);
                                      if (!series) continue;
                                      for (let i = 0; i < Math.min(nFrames, series.efforts.length); i++) {
                                          jointEfforts[i] += series.efforts[i];
                                      }
                                      for (let i = 0; i < Math.min(nFrames, series.torques.length); i++) {
                                          jointTotalTorque[i] += series.torques[i];
                                      }
                                  }
                                  // Peak joint effort + when it occurs.
                                  let jointPeakEffort = 0;
                                  let jointPeakFrame = 0;
                                  for (let i = 0; i < jointEfforts.length; i++) {
                                      if (jointEfforts[i] > jointPeakEffort) {
                                          jointPeakEffort = jointEfforts[i];
                                          jointPeakFrame = i;
                                      }
                                  }
                                  const jointPeakPct = jointPeakEffort * 100;
                                  const jointPeakFramePct = nFrames > 1 ? (jointPeakFrame / (nFrames - 1)) * 100 : 0;
                                  const jointBarColor = jointPeakPct > 80 ? 'bg-red-500' : jointPeakPct > 50 ? 'bg-amber-500' : 'bg-indigo-500';

                                  return (
                                      <div key={groupName} className="bg-white border border-gray-100 rounded-2xl p-4">
                                          {/* Joint-level peak header: single value for the
                                              joint's combined peak effort across the ROM. */}
                                          <div className="flex items-baseline justify-between mb-1">
                                              <h4 className="font-bold text-gray-900 text-sm">{groupName}</h4>
                                              <div className="flex items-center gap-2">
                                                  <span className="text-[9px] font-mono font-bold text-gray-400">@{jointPeakFramePct.toFixed(0)}%</span>
                                                  <span className="font-mono text-sm font-bold text-gray-700 tabular-nums">{jointPeakPct.toFixed(0)}%</span>
                                              </div>
                                          </div>
                                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                                              <div className={`h-full rounded-full ${jointBarColor} transition-all duration-300`} style={{ width: `${Math.min(jointPeakPct, 100)}%` }} />
                                          </div>
                                          {/* Per-joint aggregate sparkline: sum-of-actions over ROM */}
                                          <div className="mb-3 rounded overflow-hidden">
                                              {renderSparkline(jointEfforts, '#6b7280', 'rgba(107, 114, 128, 0.1)', 20, jointPeakFramePct / 100)}
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
                                                          {/* Per-action sparkline: normalized to the
                                                              action's OWN peak across the ROM. Absolute
                                                              magnitude + relative-to-other-actions info
                                                              already lives in the header bar above; this
                                                              graph is just for seeing WHERE each action
                                                              peaks within the ROM. Normalizing to its own
                                                              peak lets even small-magnitude actions fill
                                                              the Y axis so the shape is readable. */}
                                                          {series && series.torques.length > 1 && (() => {
                                                              const proportions = series.torques.map((t, i) => jointTotalTorque[i] > 1e-9 ? t / jointTotalTorque[i] : 0);
                                                              const peak = Math.max(...proportions, 1e-9);
                                                              const normalized = proportions.map(v => v / peak);
                                                              return (
                                                                  <div className="mt-1 rounded overflow-hidden">
                                                                      {renderSparkline(normalized, lineColor, fillColor, 16, p.peakFramePct / 100)}
                                                                  </div>
                                                              );
                                                          })()}
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  );
                              });
                          })()}
                          {timelineView === 'muscle' && (() => {
                              // Flat list of all muscles, sorted by peak
                              // activation descending. No region grouping —
                              // the user wants the hardest-working muscles
                              // up top regardless of anatomical category.
                              const sortedPeaks = [...timelineAnalysis.musclePeaks]
                                  .sort((a, b) => b.peakActivation - a.peakActivation);

                              if (sortedPeaks.length === 0) {
                                  return (
                                      <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
                                          <p className="text-xs text-gray-400">No muscle activation across this timeline. Make sure the loaded joint actions have assigned muscles in the Muscles tab.</p>
                                      </div>
                                  );
                              }

                              // Lookup table for activation series by `${side}|${id}`.
                              const muscleSeriesLookup = new Map<string, MuscleTimeSeries>();
                              for (const ms of timelineAnalysis.muscleSeries) {
                                  muscleSeriesLookup.set(`${ms.side}|${ms.muscleId}`, ms);
                              }

                              // Sparkline (duplicate of the joint view's renderer
                              // because it lives inside the joint IIFE — keeping
                              // both blocks self-contained is simpler than
                              // hoisting).
                              const renderSparkline = (
                                  values: number[],
                                  color: string,
                                  fillColor: string,
                                  height: number = 16,
                                  peakT?: number,
                              ) => {
                                  if (values.length < 2) return null;
                                  const profPts = timelineAnalysis.profile;
                                  const W = 260, H = height, PAD = 1;
                                  const plotW = W - PAD * 2, plotH = H - PAD * 2;
                                  const pathD = values.map((e, i) => {
                                      const t = profPts[i] ? profPts[i].t : (values.length > 1 ? i / (values.length - 1) : 0);
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
                                          {/* Peak-position marker (matches the @X% in the
                                              header above this sparkline) */}
                                          {peakT !== undefined && peakT >= 0 && peakT <= 1 && (
                                              <line
                                                  x1={PAD + peakT * plotW}
                                                  x2={PAD + peakT * plotW}
                                                  y1={PAD}
                                                  y2={PAD + plotH}
                                                  stroke={color} strokeWidth="0.75" strokeDasharray="2 2" opacity="0.6"
                                              />
                                          )}
                                          {/* Current ROM position indicator */}
                                          <line
                                              x1={PAD + currentRomT * plotW}
                                              x2={PAD + currentRomT * plotW}
                                              y1={PAD}
                                              y2={PAD + plotH}
                                              stroke="#0d9488" strokeWidth="0.75" opacity="0.85"
                                          />
                                      </svg>
                                  );
                              };

                              const nFrames = timelineAnalysis.profile.length;

                              // Global aggregate sparkline: max muscle activation
                              // per frame across the entire muscle list. Replaces
                              // the per-region aggregates.
                              const globalAgg = new Array(nFrames).fill(0);
                              for (const mp of sortedPeaks) {
                                  const series = muscleSeriesLookup.get(`${mp.side}|${mp.muscleId}`);
                                  if (!series) continue;
                                  for (let i = 0; i < Math.min(nFrames, series.activations.length); i++) {
                                      if (series.activations[i] > globalAgg[i]) globalAgg[i] = series.activations[i];
                                  }
                              }

                              // Bracing slider visibility: spine-extension demand
                              // anywhere on the timeline. Used to be conditionally
                              // rendered inside the Core region card; lives in the
                              // single flat card now.
                              const hasSpineExt = timelineAnalysis.peaks.some(p =>
                                  p.jointGroup === 'Spine' && /Extension/.test(p.action) && p.peakEffort > 1e-6
                              );

                              return (
                                      <div className="bg-white border border-gray-100 rounded-2xl p-4">
                                          <div className="mb-3 rounded overflow-hidden">
                                              {renderSparkline(globalAgg, '#6b7280', 'rgba(107, 114, 128, 0.1)', 20)}
                                          </div>
                                          <div className="space-y-3">
                                              {sortedPeaks.map((mp, i) => {
                                                  const pct = mp.peakActivation * 100;
                                                  const lineColor = mp.peakActivation > 0.8 ? '#f87171' : mp.peakActivation > 0.5 ? '#fbbf24' : '#34d399';
                                                  const fillColor = mp.peakActivation > 0.8 ? 'rgba(248, 113, 113, 0.15)' : mp.peakActivation > 0.5 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(52, 211, 153, 0.15)';
                                                  const barColor = mp.peakActivation > 0.8 ? 'bg-red-400' : mp.peakActivation > 0.5 ? 'bg-amber-400' : 'bg-emerald-400';
                                                  const series = muscleSeriesLookup.get(`${mp.side}|${mp.muscleId}`);
                                                  return (
                                                      <div key={`${mp.side}-${mp.muscleId}-${i}`}>
                                                          <div className="flex justify-between items-center mb-1">
                                                              <div className="flex items-center gap-2 min-w-0">
                                                                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: muscleColor(mp.muscleId) }} />
                                                                  <span className="font-bold text-gray-700 text-xs truncate">
                                                                      {mp.side && <span className="text-gray-400 font-mono">{mp.side[0]} </span>}
                                                                      {mp.muscleName}
                                                                  </span>
                                                              </div>
                                                              <div className="flex items-center gap-2 flex-shrink-0">
                                                                  <span className="text-[9px] font-mono font-bold text-gray-400">@{mp.peakFramePct.toFixed(0)}%</span>
                                                                  <span className="font-mono text-xs font-bold text-gray-500">{pct.toFixed(0)}%</span>
                                                              </div>
                                                          </div>
                                                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                              <div className={`h-full rounded-full ${barColor} transition-all duration-300`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                          </div>
                                                          {/* Per-muscle activation sparkline, normalized
                                                              to the muscle's OWN peak across the ROM.
                                                              Absolute peak + relative-to-other-muscles
                                                              info already lives in the header bar above;
                                                              this graph is just for seeing WHERE each
                                                              muscle peaks within the ROM. Normalizing lets
                                                              even lightly-recruited muscles fill the Y
                                                              axis so the shape is readable. */}
                                                          {series && series.activations.length > 1 && (() => {
                                                              const peak = Math.max(...series.activations, 1e-9);
                                                              const normalized = series.activations.map(v => v / peak);
                                                              return (
                                                                  <div className="mt-1 rounded overflow-hidden">
                                                                      {renderSparkline(normalized, lineColor, fillColor, 16, mp.peakFramePct / 100)}
                                                                  </div>
                                                              );
                                                          })()}
                                                          {/* Contribution chips: which joint actions
                                                              drove this muscle's activation. + chips
                                                              are agonist routes (the action made the
                                                              muscle work), − chips are antagonist
                                                              routes (the action suppressed it via the
                                                              opposite-section rule). Labels are
                                                              side-agnostic since the muscle row itself
                                                              is already side-tagged. */}
                                                          {(mp.positiveContributors.length > 0 || mp.negativeContributors.length > 0) && (
                                                              <div className="mt-1.5 flex flex-wrap gap-1">
                                                                  {mp.positiveContributors.map(a => (
                                                                      <span key={`pos-${a}`} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[9px] font-mono font-semibold">
                                                                          +{a}
                                                                      </span>
                                                                  ))}
                                                                  {mp.negativeContributors.map(a => (
                                                                      <span key={`neg-${a}`} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[9px] font-mono font-semibold">
                                                                          −{a}
                                                                      </span>
                                                                  ))}
                                                              </div>
                                                          )}
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                          {/* Bracing slider — only when spine extension is
                                              active anywhere on the timeline. Abdominal
                                              bracing represents the portion of Spine Extension
                                              demand off-loaded to rectus abdominis (via
                                              intra-abdominal pressure) instead of being carried
                                              purely by the erectors. */}
                                          {hasSpineExt && (() => {
                                              const bPct = Math.round(bracingFraction * 100);
                                              const ePct = 100 - bPct;
                                              return (
                                                  <div className="mt-4 pt-3 border-t border-gray-100">
                                                      <div className="flex items-baseline justify-between mb-1">
                                                          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Bracing / Erector Split</span>
                                                          <span className="font-mono text-[10px] font-bold text-gray-600 tabular-nums">
                                                              {bPct}% bracing · {ePct}% erectors
                                                          </span>
                                                      </div>
                                                      <input
                                                          type="range"
                                                          min={0}
                                                          max={100}
                                                          step={1}
                                                          value={bPct}
                                                          onChange={e => setBracingFraction(Number(e.target.value) / 100)}
                                                          className="w-full"
                                                      />
                                                      <p className="text-[9px] text-gray-400 mt-1 leading-snug">
                                                          Portion of Spine Extension demand routed to rectus abdominis as
                                                          abdominal bracing. Remainder goes to the erectors. Rectus is
                                                          exempted from the normal antagonist-suppression by this route,
                                                          so its activation shown here reflects bracing work alone.
                                                      </p>
                                                  </div>
                                              );
                                          })()}
                                      </div>
                                  );
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
                   {/* Biarticular coupling toggle. When enabled, a two-joint
                       muscle being used as an antagonist at one of its joints
                       reduces the capacity of its agonist actions at the
                       OTHER joint (bounded by 15% per action). Flip off to
                       A/B-test effort distribution. */}
                   <div className={`flex items-center justify-between px-4 py-3 rounded-xl border mb-4 ${biarticularCouplingEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                       <div className="flex flex-col gap-0.5 min-w-0 mr-3">
                           <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                               Biarticular Coupling
                           </span>
                           <span className="text-[10px] text-gray-500 leading-snug">
                               {biarticularCouplingEnabled
                                   ? 'ON — two-joint muscles reduce the other joint\u2019s capacity when antagonized'
                                   : 'OFF — capacities are raw bell values, no cross-joint inhibition'}
                           </span>
                       </div>
                       <button
                           onClick={() => setBiarticularCouplingEnabled(v => !v)}
                           className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${biarticularCouplingEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                           title={biarticularCouplingEnabled ? 'Disable biarticular coupling' : 'Enable biarticular coupling'}
                       >
                           <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${biarticularCouplingEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                       </button>
                   </div>
                   {/* Effort-exponent slider. p = 2 is the quadratic min-
                       neural-drive norm (linear response to mechanical
                       advantage); p < 2 concentrates demand on high-leverage
                       joints so low-leverage synergists drop proportionally.
                       p = 1 would be fully sparse (only the limiting joint
                       loaded) but is unstable near F = 0, so the UI floor
                       is 1.1. IRLS under the hood, ~5 iterations per solve. */}
                   <div className="px-4 py-3 rounded-xl border bg-amber-50 border-amber-200 mb-6">
                       <div className="flex items-center justify-between mb-2">
                           <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                               Effort Exponent (p)
                           </span>
                           <span className="text-xs font-mono font-bold text-amber-800 tabular-nums">
                               {effortExponent.toFixed(2)}
                           </span>
                       </div>
                       <input
                           type="range"
                           min={1.1}
                           max={3.0}
                           step={0.05}
                           value={effortExponent}
                           onChange={(e) => setEffortExponent(parseFloat(e.target.value))}
                           className="w-full accent-amber-500"
                       />
                       <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1 font-mono">
                           <span>1.1 concentrated</span>
                           <span>2.0 quadratic</span>
                           <span>3.0 balanced</span>
                       </div>
                       <p className="text-[10px] text-amber-900/70 mt-2 leading-snug">
                           Lower p punishes mechanically-disadvantaged joints harder — at 1RM the limiting joint still reads 100% but synergists drop faster. 1.5 is the default; try 1.25 for stronger differentiation.
                       </p>
                   </div>
                   <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                       {Object.entries(jointCapacities).map(([group, actions]) => {
                           const groupBones = GROUP_BONES[group as JointGroup];
                           const groupExpanded = expandedCapacityGroups.has(group);
                           const actionCount = Object.keys(actions).length;
                           return (
                           <div key={group} className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                               <button
                                   onClick={() => toggleCapacityGroup(group)}
                                   className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition-colors"
                               >
                                   <div className="flex items-center gap-2 min-w-0">
                                       {groupExpanded ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                       <span className="text-xs font-bold uppercase tracking-wide text-gray-800">{group}</span>
                                   </div>
                                   <span className="text-[10px] font-mono font-bold text-gray-400 flex-shrink-0 ml-2">{actionCount} action{actionCount === 1 ? '' : 's'}</span>
                               </button>
                               {groupExpanded && (
                               <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-4">
                                   {Object.entries(actions).map(([action, config]) => {
                                       // Find the ActionAxis that matches this capacity entry's
                                       // action-key. Uses capacityKey() (strips " L"/" R" side
                                       // suffixes) so side-agnostic entries like 'rotation' and
                                       // 'lateralFlexion' still match the side-specific action
                                       // names 'Rotation L' / 'Lateral Flexion L'. Capacity
                                       // peak angles are stored in the DIRECTIONANGLE convention
                                       // matching the Muscles tab.
                                       const ax = JOINT_ACTIONS[group as JointGroup]?.find(a =>
                                           capacityKey(a.positiveAction) === action ||
                                           capacityKey(a.negativeAction) === action
                                       );
                                       const isPos = ax ? capacityKey(ax.positiveAction) === action : true;
                                       const lCap = (ax && groupBones)
                                           ? sectionDirectionAngle(groupBones.left, ax, isPos, posture, twists)
                                           : null;
                                       const rCap = (ax && groupBones)
                                           ? sectionDirectionAngle(groupBones.right, ax, isPos, posture, twists)
                                           : null;
                                       // Per-section computed range (same sphere-sampled approach
                                       // the Muscles tab uses) so the track spans the joint's
                                       // actual reachable ROM for this section, not a fixed ±180.
                                       const sectionRange = ax
                                           ? getActionRange(group as JointGroup, ax, isPos)
                                           : { min: -180, max: 180 };
                                       // Widen the range to include the peak angle + L/R live
                                       // positions so nothing clips at the edges.
                                       const candidates = [sectionRange.min, sectionRange.max, config.angle || 0];
                                       if (lCap !== null) candidates.push(lCap);
                                       if (rCap !== null) candidates.push(rCap);
                                       const capTrackMin = Math.min(...candidates);
                                       const capTrackMax = Math.max(...candidates);
                                       const capPct = (v: number) =>
                                           capTrackMax === capTrackMin
                                               ? 50
                                               : ((v - capTrackMin) / (capTrackMax - capTrackMin)) * 100;
                                       // Bell-curve graph points. Sample capacity across the
                                       // section's ROM (per-section computed range) so the user
                                       // can SEE the torque profile at a glance. 40 samples is
                                       // plenty for a smooth curve at this size.
                                       const capSvgW = 240;
                                       const capSvgH = 48;
                                       const bellN = 40;
                                       const bellSamples: Array<{ angle: number; val: number }> = [];
                                       const bellCap = { base: config.base, specific: config.specific, angle: config.angle || 0 };
                                       // Apply cross-joint modifications at the current pose for
                                       // the right-side bone — the displayed bell reflects the
                                       // EFFECTIVE capacity after modifications, so as the user
                                       // moves a source joint (e.g. knee flex) the capacity bell
                                       // shrinks live.
                                       const capModMultDisplay = getModificationMultiplier(
                                           modifications,
                                           { kind: 'capacity', jointGroup: group as JointGroup, actionKey: action },
                                           'right', posture, twists,
                                       );
                                       for (let bi = 0; bi <= bellN; bi++) {
                                           const angle = capTrackMin + (capTrackMax - capTrackMin) * (bi / bellN);
                                           bellSamples.push({ angle, val: evaluateCapacity(bellCap, angle) * capModMultDisplay });
                                       }
                                       const bellValMax = Math.max(config.base, config.specific, 1);
                                       const bellValMin = Math.min(0, config.base, config.specific);
                                       const bellYSpan = Math.max(bellValMax - bellValMin, 1);
                                       const bellX = (a: number) =>
                                           capTrackMax === capTrackMin
                                               ? capSvgW / 2
                                               : ((a - capTrackMin) / (capTrackMax - capTrackMin)) * capSvgW;
                                       const bellY = (v: number) =>
                                           capSvgH - ((v - bellValMin) / bellYSpan) * (capSvgH - 4) - 2;
                                       const bellPoints = bellSamples.map(s => `${bellX(s.angle).toFixed(2)},${bellY(s.val).toFixed(2)}`).join(' ');
                                       // Close the polygon to the bottom for a filled area.
                                       const bellPolygon =
                                           `${bellX(capTrackMin).toFixed(2)},${(capSvgH - 2).toFixed(2)} ` +
                                           bellPoints + ' ' +
                                           `${bellX(capTrackMax).toFixed(2)},${(capSvgH - 2).toFixed(2)}`;
                                       return (
                                       <div key={action} className="bg-white rounded-xl p-3 border border-gray-100">
                                           <div className="flex justify-between items-center mb-2">
                                               <span className="text-xs font-bold text-gray-700 capitalize">{action.replace(/([A-Z])/g, ' $1').trim()}</span>
                                               {groupBones && (
                                                   <div className="flex items-center gap-2 text-[9px] font-mono">
                                                       <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                                           L {lCap !== null ? `${Math.round(lCap)}°` : '—'}
                                                       </span>
                                                       <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                                           R {rCap !== null ? `${Math.round(rCap)}°` : '—'}
                                                       </span>
                                                   </div>
                                               )}
                                           </div>
                                           {/* Torque-ROM bell graph: filled-area curve showing
                                               the capacity (Nm) at every angle across the ROM.
                                               Zero-reference dashed line, peak angle marker, and
                                               L/R live-position markers overlaid. */}
                                           <div className="bg-gray-50 rounded-lg border border-gray-200 p-1.5 mb-2">
                                               <svg width="100%" viewBox={`0 0 ${capSvgW} ${capSvgH + 14}`} preserveAspectRatio="none" className="block">
                                                   {/* Zero-Nm reference line (only draw if 0 is inside the y-range) */}
                                                   {bellValMin <= 0 && bellValMax >= 0 && (
                                                       <line
                                                           x1="0" x2={capSvgW}
                                                           y1={bellY(0)} y2={bellY(0)}
                                                           stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2 2"
                                                       />
                                                   )}
                                                   {/* Zero-angle vertical reference */}
                                                   {capTrackMin <= 0 && capTrackMax >= 0 && (
                                                       <line
                                                           x1={bellX(0)} x2={bellX(0)}
                                                           y1="0" y2={capSvgH}
                                                           stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2 2"
                                                       />
                                                   )}
                                                   {/* Filled bell curve */}
                                                   <polygon
                                                       points={bellPolygon}
                                                       fill="#a78bfa" fillOpacity="0.35"
                                                       stroke="#8b5cf6" strokeWidth="1"
                                                   />
                                                   {/* Peak-angle marker */}
                                                   <line
                                                       x1={bellX(config.angle || 0)} x2={bellX(config.angle || 0)}
                                                       y1={0} y2={capSvgH}
                                                       stroke="#8b5cf6" strokeWidth="1" strokeDasharray="3 2" opacity="0.6"
                                                   />
                                                   {/* L/R live-position markers */}
                                                   {lCap !== null && (
                                                       <g>
                                                           <line x1={bellX(lCap)} x2={bellX(lCap)} y1={0} y2={capSvgH} stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.9" />
                                                           <circle cx={bellX(lCap)} cy={3} r="2.5" fill="#3b82f6" />
                                                           <title>{`Left: ${Math.round(lCap)}°`}</title>
                                                       </g>
                                                   )}
                                                   {rCap !== null && (
                                                       <g>
                                                           <line x1={bellX(rCap)} x2={bellX(rCap)} y1={0} y2={capSvgH} stroke="#4f46e5" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.9" />
                                                           <circle cx={bellX(rCap)} cy={3} r="2.5" fill="#4f46e5" />
                                                           <title>{`Right: ${Math.round(rCap)}°`}</title>
                                                       </g>
                                                   )}
                                                   {/* X-axis min/mid/max labels */}
                                                   <text x="0" y={capSvgH + 10} fontSize="8" fill="#9ca3af">{capTrackMin.toFixed(0)}°</text>
                                                   <text x={capSvgW / 2} y={capSvgH + 10} fontSize="8" fill="#9ca3af" textAnchor="middle">{((capTrackMin + capTrackMax) / 2).toFixed(0)}°</text>
                                                   <text x={capSvgW} y={capSvgH + 10} fontSize="8" fill="#9ca3af" textAnchor="end">{capTrackMax.toFixed(0)}°</text>
                                               </svg>
                                           </div>
                                           <div className="grid grid-cols-2 gap-4 mb-2">
                                               <div>
                                                   <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Base (Nm)</label>
                                                   <input type="number" value={isNaN(config.base) ? 0 : config.base} onChange={(e) => updateCapacity(group as JointGroup, action, 'base', parseFloat(e.target.value))} className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-purple-500" />
                                               </div>
                                               <div>
                                                   <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Peak (Nm)</label>
                                                   <input type="number" value={isNaN(config.specific) ? 0 : config.specific} onChange={(e) => updateCapacity(group as JointGroup, action, 'specific', parseFloat(e.target.value))} className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-purple-500" />
                                               </div>
                                           </div>
                                           <div>
                                               <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Peak Angle (°)</label>
                                               <div className="flex items-center gap-2">
                                                   <input type="range" min={-180} max={180} value={isNaN(config.angle) ? 0 : config.angle} onChange={(e) => updateCapacity(group as JointGroup, action, 'angle', parseFloat(e.target.value))} className="flex-1 bio-range text-purple-500" />
                                                   <span className="text-[10px] font-mono font-bold text-gray-500 w-10 text-right">{isNaN(config.angle) ? 0 : config.angle}°</span>
                                               </div>
                                           </div>
                                       </div>
                                       );
                                   })}
                               </div>
                               )}
                           </div>
                           );
                       })}
                   </div>
               </div>
          )}

          {activeTab === 'muscles' && (() => {
              // getActionRange is hoisted to component scope (used by the
              // Capacities tab too, so both tabs render consistent ranges).

              return (
                  <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 mb-6">
                          <p className="text-xs text-teal-900 font-medium leading-relaxed">
                              Assign muscles to each joint action and shape their relative contribution across the ROM. Numbers are dimensionless weights — only their ratio at a given angle matters. The graph normalises each angle's column to 100%.
                          </p>
                      </div>
                      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                          {(Object.keys(JOINT_ACTIONS) as JointGroup[]).map(group => {
                              const acts = JOINT_ACTIONS[group];
                              if (!acts || acts.length === 0) return null;
                              // Each ActionAxis is one DOF with two opposing
                              // muscle groups (e.g. flexors vs extensors).
                              // Render two sections per axis.
                              const sections: { directionName: string; ax: ActionAxis; isPositive: boolean }[] = [];
                              for (const ax of acts) {
                                  sections.push({ directionName: ax.positiveAction, ax, isPositive: true });
                                  sections.push({ directionName: ax.negativeAction, ax, isPositive: false });
                              }
                              const groupExpanded = expandedMuscleSections.has(group);
                              // Total muscles assigned across this group, for the header summary.
                              let groupTotalMuscles = 0;
                              for (const { directionName } of sections) {
                                  const k = `${group}.${actionKey(directionName)}`;
                                  groupTotalMuscles += Object.keys(muscleAssignments[k] || {}).length;
                              }
                              return (
                                  <div key={group} className="border border-gray-100 rounded-xl overflow-hidden">
                                      <button
                                          onClick={() => toggleMuscleSection(group)}
                                          className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 px-3 py-2.5 transition-colors"
                                      >
                                          <div className="flex items-center gap-2">
                                              {groupExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                              <span className="font-bold text-gray-900 text-xs uppercase tracking-wide">{group}</span>
                                          </div>
                                          <span className="text-[10px] font-mono font-bold text-gray-400">{sections.length} actions · {groupTotalMuscles} muscles</span>
                                      </button>
                                      {groupExpanded && (
                                      <div className="space-y-2 p-2 bg-white">
                                          {sections.map(({ directionName, ax, isPositive }) => {
                                              const sectionKey = `${group}.${actionKey(directionName)}`;
                                              const assigned = muscleAssignments[sectionKey] || {};
                                              const assignedIds = Object.keys(assigned);
                                              const baseRange = getActionRange(group, ax, isPositive);
                                              // Extend the range to include any muscle peak angles
                                              // outside the default. Some muscles peak when the
                                              // joint is in the OPPOSITE direction of this section
                                              // (e.g. adductor magnus peaks in hip extension when
                                              // hip is deeply flexed → negative section-direction
                                              // angle; pec-sternal peaks in shoulder extension when
                                              // arm is elevated → negative section angle). Showing
                                              // those bells requires extending the X axis into
                                              // negative territory.
                                              const peakAngles = assignedIds.map(id => assigned[id].angle);
                                              const range = {
                                                  min: Math.min(baseRange.min, ...peakAngles),
                                                  max: Math.max(baseRange.max, ...peakAngles),
                                              };

                                              // Current live directionAngle for each side's bone in this
                                              // section, computed the same way distributeMuscleLoadForFrame
                                              // does it so the marker lands exactly where the bell is
                                              // evaluated at runtime. The range is NOT widened to include
                                              // the live positions: the graph represents the joint's full
                                              // reachable ROM (from the limit box, independent of the
                                              // current pose). If the live marker ever lands outside the
                                              // sphere-sampled range, that's a sampling-precision issue
                                              // — bump N in getActionRange rather than making the graph
                                              // rubber-band with the pose.
                                              const sectionGroupBones = GROUP_BONES[group];
                                              const sectionIsHinge = sectionGroupBones
                                                  ? /Forearm|Tibia|Foot/.test(sectionGroupBones.left)
                                                  : false;
                                              const sectionActionSign = ax.isBoneAxis ? 1 :
                                                  ax.useWorldAxis ? -1 :
                                                  sectionIsHinge ? -1 :
                                                  1;
                                              const liveDirAngle = (boneId: string): number => {
                                                  const ra = getActionAngle(boneId, ax, posture, twists);
                                                  return ra * sectionActionSign * (isPositive ? 1 : -1);
                                              };
                                              const lLive = sectionGroupBones ? liveDirAngle(sectionGroupBones.left) : null;
                                              const rLive = sectionGroupBones ? liveDirAngle(sectionGroupBones.right) : null;

                                              // Cross-joint modification multipliers per muscle
                                              // at the current pose (right-side bone). The
                                              // stacked-area visualization is a bell-share
                                              // display, so only 'relative' modifiers apply here
                                              // — 'isolated' modifiers affect the post-share
                                              // activation, not the bell weight shown in this graph.
                                              const sectionActionKeyLocal = actionKey(directionName);
                                              const muscleModMult: Record<string, number> = {};
                                              for (const id of assignedIds) {
                                                  muscleModMult[id] = getModificationMultiplier(
                                                      modifications,
                                                      { kind: 'muscle', jointGroup: group, actionKey: sectionActionKeyLocal, muscleId: id },
                                                      'right', posture, twists, 'relative',
                                                  );
                                              }

                                              // Sample the bell curves across
                                              // the X range, normalize each
                                              // sample column to sum=1.
                                              const N_SAMPLES = 60;
                                              const samples: { angle: number; values: { id: string; v: number }[]; total: number }[] = [];
                                              for (let i = 0; i <= N_SAMPLES; i++) {
                                                  const angle = range.min + (range.max - range.min) * (i / N_SAMPLES);
                                                  const values: { id: string; v: number }[] = [];
                                                  let total = 0;
                                                  for (const id of assignedIds) {
                                                      const c = assigned[id];
                                                      // Reuse the same cosine
                                                      // bell as joint capacities
                                                      // so muscle contributions
                                                      // share the curve shape.
                                                      const v = evaluateCapacity({ base: c.base, specific: c.peak, angle: c.angle }, angle, c.steepness ?? 1) * (muscleModMult[id] ?? 1);
                                                      values.push({ id, v });
                                                      total += v;
                                                  }
                                                  samples.push({ angle, values, total });
                                              }

                                              // Build stacked SVG paths. For
                                              // each muscle, walk the samples
                                              // building (angle → cumulative
                                              // bottom, cumulative top), then
                                              // render as a polygon.
                                              const SVG_W = 280;
                                              const SVG_H = 110;
                                              const xAt = (angle: number) =>
                                                  ((angle - range.min) / (range.max - range.min || 1)) * SVG_W;
                                              const polygonsForMuscle = (id: string, idx: number): string => {
                                                  const top: { x: number; y: number }[] = [];
                                                  const bot: { x: number; y: number }[] = [];
                                                  for (const s of samples) {
                                                      let cumLow = 0;
                                                      let cumHigh = 0;
                                                      for (let k = 0; k < s.values.length; k++) {
                                                          const v = s.total > 0 ? s.values[k].v / s.total : 0;
                                                          if (k < idx) cumLow += v;
                                                          if (k <= idx) cumHigh += v;
                                                      }
                                                      const x = xAt(s.angle);
                                                      top.push({ x, y: SVG_H - cumHigh * SVG_H });
                                                      bot.push({ x, y: SVG_H - cumLow * SVG_H });
                                                  }
                                                  const fwd = top.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
                                                  const back = bot.slice().reverse().map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
                                                  return `${fwd} ${back}`;
                                              };

                                              // Available muscles to add.
                                              const available = MUSCLE_CATALOG.filter(m => !assigned[m.id]);
                                              const byRegion: Record<string, MuscleDef[]> = {};
                                              for (const m of available) {
                                                  if (!byRegion[m.region]) byRegion[m.region] = [];
                                                  byRegion[m.region].push(m);
                                              }

                                              const sectionExpanded = expandedMuscleSections.has(sectionKey);
                                              return (
                                                  <div key={sectionKey} className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                                                      <button
                                                          onClick={() => toggleMuscleSection(sectionKey)}
                                                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition-colors"
                                                      >
                                                          <div className="flex items-center gap-2 min-w-0">
                                                              {sectionExpanded ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                                              <span className="text-xs font-bold text-gray-800 truncate">{directionName}</span>
                                                          </div>
                                                          <span className="text-[10px] font-mono font-bold text-gray-400 flex-shrink-0 ml-2">{assignedIds.length} muscle{assignedIds.length === 1 ? '' : 's'}</span>
                                                      </button>
                                                      {sectionExpanded && (
                                                      <div className="px-3 pb-3 pt-1 border-t border-gray-100">
                                                      <div className="flex items-center justify-between gap-3 mb-3 pt-2">
                                                          {/* Per-section activation scale. Multiplier
                                                              applied AFTER share distribution — lets this
                                                              section's muscles read higher (set scale ≈
                                                              number of co-max muscles so each can hit
                                                              100% at 1RM) or lower, with a hard clamp
                                                              at 100% MVC so nothing ever displays
                                                              above ceiling. Default 1.0. */}
                                                          <div className="flex items-center gap-1.5 min-w-0">
                                                              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 flex-shrink-0">Scale</span>
                                                              <input
                                                                  type="number"
                                                                  min={0}
                                                                  step={0.1}
                                                                  value={sectionScales[sectionKey] ?? 1}
                                                                  onChange={(e) => {
                                                                      const v = parseFloat(e.target.value);
                                                                      setSectionScales(prev => ({
                                                                          ...prev,
                                                                          [sectionKey]: isNaN(v) ? 1 : Math.max(0, v),
                                                                      }));
                                                                  }}
                                                                  className="w-14 text-[10px] font-mono font-bold text-center bg-white border border-gray-200 rounded px-1 py-1 outline-none focus:border-teal-500 tabular-nums"
                                                                  title="Multiplier applied after share distribution. Set ≈ number of co-max muscles (e.g. 3 for 3-headed triceps) so each muscle can hit 100% at 1RM. Values are clamped at 100% MVC."
                                                              />
                                                              <span className="text-[9px] text-gray-400 flex-shrink-0">×</span>
                                                          </div>
                                                          <select
                                                              value=""
                                                              onChange={(e) => {
                                                                  if (e.target.value) addMuscleToAction(sectionKey, e.target.value);
                                                              }}
                                                              className="text-[10px] font-medium bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-teal-500 max-w-[150px]"
                                                          >
                                                              <option value="">+ Add muscle…</option>
                                                              {Object.entries(byRegion).map(([region, muscles]) => (
                                                                  <optgroup key={region} label={region}>
                                                                      {muscles.map(m => (
                                                                          <option key={m.id} value={m.id}>{m.name}</option>
                                                                      ))}
                                                                  </optgroup>
                                                              ))}
                                                          </select>
                                                      </div>

                                                      {/* Stacked-area normalised graph. Empty when no muscles assigned. */}
                                                      {assignedIds.length > 0 && (
                                                          <div className="bg-white rounded-lg border border-gray-200 p-2 mb-3">
                                                              <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H + 16}`} preserveAspectRatio="none" className="block">
                                                                  {/* Stacked polygons */}
                                                                  {assignedIds.map((id, idx) => (
                                                                      <polygon
                                                                          key={id}
                                                                          points={polygonsForMuscle(id, idx)}
                                                                          fill={muscleColor(id)}
                                                                          fillOpacity="0.85"
                                                                          stroke="white"
                                                                          strokeWidth="0.5"
                                                                      />
                                                                  ))}
                                                                  {/* Current-position indicators: vertical dashed lines
                                                                      at each side's live directionAngle, matching
                                                                      the colors used by the Joint Limits tab
                                                                      (blue L / indigo R). The range was widened
                                                                      above to always include these positions. */}
                                                                  {lLive !== null && (
                                                                      <g>
                                                                          <line
                                                                              x1={xAt(lLive)} x2={xAt(lLive)}
                                                                              y1={0} y2={SVG_H}
                                                                              stroke="#3b82f6" strokeWidth="1.2"
                                                                              strokeDasharray="3 2" opacity="0.9"
                                                                          />
                                                                          <circle cx={xAt(lLive)} cy={3} r="2.5" fill="#3b82f6" />
                                                                          <title>{`Left: ${Math.round(lLive)}°`}</title>
                                                                      </g>
                                                                  )}
                                                                  {rLive !== null && (
                                                                      <g>
                                                                          <line
                                                                              x1={xAt(rLive)} x2={xAt(rLive)}
                                                                              y1={0} y2={SVG_H}
                                                                              stroke="#4f46e5" strokeWidth="1.2"
                                                                              strokeDasharray="3 2" opacity="0.9"
                                                                          />
                                                                          <circle cx={xAt(rLive)} cy={3} r="2.5" fill="#4f46e5" />
                                                                          <title>{`Right: ${Math.round(rLive)}°`}</title>
                                                                      </g>
                                                                  )}
                                                                  {/* X-axis labels: min, three intermediate ticks
                                                                      at 25 / 50 / 75 % of the range, and max. Min
                                                                      anchors start, max anchors end, intermediate
                                                                      labels anchor middle so they center on their
                                                                      x position. */}
                                                                  <text x="0" y={SVG_H + 12} fontSize="9" fill="#9ca3af">{range.min.toFixed(0)}°</text>
                                                                  {[0.25, 0.5, 0.75].map(t => {
                                                                      const ang = range.min + (range.max - range.min) * t;
                                                                      return (
                                                                          <text key={t} x={SVG_W * t} y={SVG_H + 12} fontSize="9" fill="#9ca3af" textAnchor="middle">{ang.toFixed(0)}°</text>
                                                                      );
                                                                  })}
                                                                  <text x={SVG_W} y={SVG_H + 12} fontSize="9" fill="#9ca3af" textAnchor="end">{range.max.toFixed(0)}°</text>
                                                              </svg>
                                                          </div>
                                                      )}

                                                      {assignedIds.length === 0 && (
                                                          <div className="text-[10px] text-gray-400 italic px-1 py-3 text-center">No muscles assigned yet.</div>
                                                      )}

                                                      {/* Per-muscle controls. */}
                                                      <div className="space-y-2">
                                                          {assignedIds.map(id => {
                                                              const def = MUSCLE_CATALOG.find(m => m.id === id);
                                                              const c = assigned[id];
                                                              return (
                                                                  <div key={id} className="bg-white rounded-lg border border-gray-200 p-2">
                                                                      <div className="flex items-center justify-between mb-2">
                                                                          <div className="flex items-center gap-2 min-w-0">
                                                                              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: muscleColor(id) }} />
                                                                              <span className="text-[11px] font-bold text-gray-700 truncate">{def?.name || id}</span>
                                                                          </div>
                                                                          <button
                                                                              onClick={() => removeMuscleFromAction(sectionKey, id)}
                                                                              className="text-gray-400 hover:text-rose-500 transition-colors flex-shrink-0"
                                                                              title="Remove muscle"
                                                                          >
                                                                              <Trash2 className="w-3 h-3" />
                                                                          </button>
                                                                      </div>
                                                                      <div className="grid grid-cols-2 gap-2 mb-2">
                                                                          <div>
                                                                              <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Base</label>
                                                                              <input
                                                                                  type="number"
                                                                                  value={isNaN(c.base) ? 0 : c.base}
                                                                                  onChange={(e) => updateMuscleContribution(sectionKey, id, 'base', parseFloat(e.target.value))}
                                                                                  className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-teal-500"
                                                                              />
                                                                          </div>
                                                                          <div>
                                                                              <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Peak</label>
                                                                              <input
                                                                                  type="number"
                                                                                  value={isNaN(c.peak) ? 0 : c.peak}
                                                                                  onChange={(e) => updateMuscleContribution(sectionKey, id, 'peak', parseFloat(e.target.value))}
                                                                                  className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-teal-500"
                                                                              />
                                                                          </div>
                                                                      </div>
                                                                      <div>
                                                                          <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Peak Angle (°)</label>
                                                                          <div className="flex items-center gap-2">
                                                                              <input
                                                                                  type="range"
                                                                                  min={-180}
                                                                                  max={180}
                                                                                  value={isNaN(c.angle) ? 0 : c.angle}
                                                                                  onChange={(e) => updateMuscleContribution(sectionKey, id, 'angle', parseFloat(e.target.value))}
                                                                                  className="flex-1 bio-range text-teal-500"
                                                                              />
                                                                              <span className="text-[10px] font-mono font-bold text-gray-500 w-10 text-right">{Math.round(c.angle)}°</span>
                                                                          </div>
                                                                      </div>
                                                                      <div className="mt-2">
                                                                          <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">
                                                                              Steepness <span className="text-gray-300 normal-case">(1 = gradual, higher = narrower)</span>
                                                                          </label>
                                                                          <div className="flex items-center gap-2">
                                                                              <input
                                                                                  type="range"
                                                                                  min={0.25}
                                                                                  max={5}
                                                                                  step={0.05}
                                                                                  value={isNaN(c.steepness ?? 1) ? 1 : (c.steepness ?? 1)}
                                                                                  onChange={(e) => updateMuscleContribution(sectionKey, id, 'steepness', parseFloat(e.target.value))}
                                                                                  className="flex-1 bio-range text-purple-500"
                                                                              />
                                                                              <span className="text-[10px] font-mono font-bold text-gray-500 w-10 text-right">{(c.steepness ?? 1).toFixed(2)}</span>
                                                                          </div>
                                                                      </div>
                                                                  </div>
                                                              );
                                                          })}
                                                      </div>
                                                      </div>
                                                      )}
                                                  </div>
                                              );
                                          })}
                                      </div>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              );
          })()}

          {activeTab === 'modifications' && (() => {
              // Pre-build flat (joint, action) option lists. Capacity targets
              // use the combined joint+action list since there aren't that
              // many — easier than a two-dropdown dance.
              const allJointActions: { jointGroup: JointGroup; actionKey: string; label: string }[] = [];
              for (const jg of Object.keys(JOINT_ACTIONS) as JointGroup[]) {
                  const acts = JOINT_ACTIONS[jg] || [];
                  for (const ax of acts) {
                      allJointActions.push({ jointGroup: jg, actionKey: actionKey(ax.positiveAction), label: `${jg} · ${ax.positiveAction}` });
                      allJointActions.push({ jointGroup: jg, actionKey: actionKey(ax.negativeAction), label: `${jg} · ${ax.negativeAction}` });
                  }
              }

              return (
              <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4">
                      <p className="text-xs text-amber-900 font-medium leading-relaxed">
                          Scale a capacity or a specific muscle's contribution based on another joint's current angle. Example: knee flexion shortens gastroc, lowering its plantar-flexion share and the ankle's total plantar-flexion capacity.
                      </p>
                      <p className="text-[10px] text-amber-500 font-mono mt-2">
                          Curve Y = % of max effect (0–100, dimensionless). Three-point curve spans the source action's joint-limit range; endpoints pin to min/max, middle point's X is movable. Each target below picks its own Max % and direction — same curve, different magnitudes/signs per target.
                      </p>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                      {modifications.map((mod, modIdx) => {
                          // Source action options — one entry per DOF axis, labeled
                          // with the positive-direction action only. The two action
                          // names per axis (e.g., flexion / extension) read the same
                          // physical angle with opposite signs, so showing both in
                          // the source dropdown would be redundant. Curves can still
                          // express "modifier active at the negative end" by
                          // placing the peak on the negative side of the X range
                          // (e.g., midX = -45° on a Flexion source means the
                          // modifier fires when the joint is in extension).
                          const srcActs = JOINT_ACTIONS[mod.sourceJoint] || [];
                          const srcActionOptions: { key: string; label: string }[] = [];
                          for (const ax of srcActs) {
                              srcActionOptions.push({ key: actionKey(ax.positiveAction), label: ax.positiveAction });
                          }

                          // X range from the source action's joint limits.
                          const srcAx = getActionAxisByKey(mod.sourceJoint, mod.sourceActionKey);
                          const range = srcAx
                              ? getActionRange(mod.sourceJoint, srcAx.axis, srcAx.isPositive)
                              : { min: -180, max: 180 };
                          const clampedMidX = Math.max(range.min, Math.min(range.max, mod.midX));
                          // Both-side live readouts. Spine sources read the same
                          // angle for either side (the spine bone is unsided), so
                          // the two values will be identical and the markers will
                          // overlap. For bilateral source joints they may diverge
                          // when the figure is in an asymmetric pose.
                          const srcAngleLeft = getModificationSourceAngle(mod, 'left', posture, twists);
                          const srcAngleRight = getModificationSourceAngle(mod, 'right', posture, twists);
                          const curveYLeft = srcAngleLeft !== null ? evaluateCurveY(mod, range, srcAngleLeft) : 0;
                          const curveYRight = srcAngleRight !== null ? evaluateCurveY(mod, range, srcAngleRight) : 0;

                          const setMod = (patch: Partial<CrossJointModification>) =>
                              setModifications(mods => mods.map((m, i) => i === modIdx ? { ...m, ...patch } : m));

                          // SVG graph dimensions + point positions. Y axis is
                          // fixed 0–100 (dimensionless "percent of max effect");
                          // target direction + maxChange convert that into a
                          // real multiplier.
                          const GW = 260, GH = 80, PAD = 8;
                          const plotW = GW - PAD * 2, plotH = GH - PAD * 2;
                          const xScale = (a: number) => {
                              if (range.max === range.min) return PAD + plotW / 2;
                              return PAD + ((a - range.min) / (range.max - range.min)) * plotW;
                          };
                          const yScale = (y: number) => {
                              return PAD + plotH - (Math.max(0, Math.min(100, y)) / 100) * plotH;
                          };
                          const xL = xScale(range.min);
                          const xM = xScale(clampedMidX);
                          const xR = xScale(range.max);
                          const yL = yScale(mod.leftY);
                          const yMv = yScale(mod.midY);
                          const yR = yScale(mod.rightY);
                          const polyPoints = `${xL},${yScale(0)} ${xL},${yL} ${xM},${yMv} ${xR},${yR} ${xR},${yScale(0)}`;
                          const livePtXRight = srcAngleRight !== null ? xScale(Math.max(range.min, Math.min(range.max, srcAngleRight))) : null;
                          const livePtXLeft = srcAngleLeft !== null ? xScale(Math.max(range.min, Math.min(range.max, srcAngleLeft))) : null;
                          // Suppress duplicate marker when both sides land at the
                          // same X (spine sources, symmetric poses, or any case
                          // where the angles coincide within rendering precision).
                          const sidesCoincide = livePtXLeft !== null && livePtXRight !== null
                              && Math.abs(livePtXLeft - livePtXRight) < 0.5;

                          return (
                              <div key={mod.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
                                  {/* Header */}
                                  <div className="flex items-center gap-2">
                                      <input
                                          type="text"
                                          value={mod.name}
                                          onChange={(e) => setMod({ name: e.target.value })}
                                          className="flex-1 text-xs font-bold bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-amber-500"
                                          placeholder="Modification name"
                                      />
                                      <button
                                          onClick={() => setModifications(mods => mods.filter((_, i) => i !== modIdx))}
                                          className="text-gray-400 hover:text-rose-500 flex-shrink-0"
                                          title="Delete modification"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>

                                  {/* Source joint + action */}
                                  <div>
                                      <label className="text-[9px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Source joint angle</label>
                                      <div className="grid grid-cols-2 gap-2">
                                          <select
                                              value={mod.sourceJoint}
                                              onChange={(e) => {
                                                  const jg = e.target.value as JointGroup;
                                                  const firstAx = (JOINT_ACTIONS[jg] || [])[0];
                                                  const firstKey = firstAx ? actionKey(firstAx.positiveAction) : 'flexion';
                                                  const newAx = firstAx ? { axis: firstAx, isPositive: true } : null;
                                                  const newRange = newAx ? getActionRange(jg, newAx.axis, newAx.isPositive) : { min: 0, max: 90 };
                                                  setMod({
                                                      sourceJoint: jg,
                                                      sourceActionKey: firstKey,
                                                      midX: (newRange.min + newRange.max) / 2,
                                                  });
                                              }}
                                              className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-amber-500"
                                          >
                                              {(Object.keys(JOINT_ACTIONS) as JointGroup[]).map(jg => (
                                                  <option key={jg} value={jg}>{jg}</option>
                                              ))}
                                          </select>
                                          <select
                                              value={mod.sourceActionKey}
                                              onChange={(e) => {
                                                  const newAx = getActionAxisByKey(mod.sourceJoint, e.target.value);
                                                  const newRange = newAx ? getActionRange(mod.sourceJoint, newAx.axis, newAx.isPositive) : { min: 0, max: 90 };
                                                  setMod({
                                                      sourceActionKey: e.target.value,
                                                      midX: (newRange.min + newRange.max) / 2,
                                                  });
                                              }}
                                              className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-amber-500"
                                          >
                                              {srcActionOptions.map(o => (
                                                  <option key={o.key} value={o.key}>{o.label}</option>
                                              ))}
                                          </select>
                                      </div>
                                  </div>

                                  {/* 3-point graph — minimalist resistance-profile style */}
                                  <div>
                                      <label className="text-[9px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Curve (% of max effect)</label>
                                      <svg viewBox={`0 0 ${GW} ${GH + 14}`} className="w-full bg-white rounded-lg border border-gray-100" style={{ display: 'block' }}>
                                          {/* Baseline (0% of max effect) */}
                                          <line x1={PAD} x2={PAD + plotW} y1={yScale(0)} y2={yScale(0)} stroke="#e5e7eb" strokeWidth="1" />
                                          {/* Filled area */}
                                          <polygon points={polyPoints} fill="#fbbf24" fillOpacity="0.18" />
                                          {/* Curve */}
                                          <path d={`M${xL},${yL} L${xM},${yMv} L${xR},${yR}`} stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                                          {/* 3 control points */}
                                          <circle cx={xL} cy={yL} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="1" />
                                          <circle cx={xM} cy={yMv} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="1" />
                                          <circle cx={xR} cy={yR} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="1" />
                                          {/* Live source-angle markers — one per side.
                                              Right is red, left is blue. When both
                                              land at the same X (spine source or
                                              symmetric pose), only the right marker
                                              is drawn to avoid stacking. */}
                                          {livePtXLeft !== null && !sidesCoincide && (
                                              <line x1={livePtXLeft} x2={livePtXLeft} y1={PAD} y2={PAD + plotH} stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
                                          )}
                                          {livePtXRight !== null && (
                                              <line x1={livePtXRight} x2={livePtXRight} y1={PAD} y2={PAD + plotH} stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
                                          )}
                                          {/* Axis labels */}
                                          <text x={PAD} y={GH + 10} fontSize="8" fill="#9ca3af">{Math.round(range.min)}°</text>
                                          <text x={PAD + plotW} y={GH + 10} textAnchor="end" fontSize="8" fill="#9ca3af">{Math.round(range.max)}°</text>
                                          <text x={PAD} y={PAD + 7} fontSize="8" fill="#9ca3af">100%</text>
                                          <text x={PAD} y={yScale(0) - 2} fontSize="8" fill="#9ca3af">0%</text>
                                      </svg>
                                      <p className="text-[9px] font-mono text-gray-400 mt-1">
                                          {sidesCoincide ? (
                                              // Same value for both sides (spine source or
                                              // symmetric pose) — show one combined readout.
                                              <>Current: {srcAngleRight !== null ? `${Math.round(srcAngleRight)}°` : '—'} → curve at {curveYRight.toFixed(0)}%</>
                                          ) : (
                                              <>
                                                  <span className="text-blue-500">L: {srcAngleLeft !== null ? `${Math.round(srcAngleLeft)}°` : '—'} → {curveYLeft.toFixed(0)}%</span>
                                                  {' · '}
                                                  <span className="text-red-500">R: {srcAngleRight !== null ? `${Math.round(srcAngleRight)}°` : '—'} → {curveYRight.toFixed(0)}%</span>
                                              </>
                                          )}
                                      </p>

                                      {/* Per-point inputs */}
                                      <div className="mt-2 grid grid-cols-3 gap-2">
                                          <div>
                                              <label className="text-[8px] font-bold text-gray-400 uppercase block mb-0.5">Left Y ({Math.round(range.min)}°)</label>
                                              <input
                                                  type="number"
                                                  min="0"
                                                  max="100"
                                                  step="1"
                                                  value={isNaN(mod.leftY) ? 0 : mod.leftY}
                                                  onChange={(e) => setMod({ leftY: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                                                  className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none text-center"
                                              />
                                          </div>
                                          <div>
                                              <label className="text-[8px] font-bold text-gray-400 uppercase block mb-0.5">Mid X (°)</label>
                                              <input
                                                  type="number"
                                                  min={range.min}
                                                  max={range.max}
                                                  step="1"
                                                  value={Math.round(clampedMidX)}
                                                  onChange={(e) => setMod({ midX: Math.max(range.min, Math.min(range.max, parseFloat(e.target.value) || 0)) })}
                                                  className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none text-center"
                                              />
                                          </div>
                                          <div>
                                              <label className="text-[8px] font-bold text-gray-400 uppercase block mb-0.5">Right Y ({Math.round(range.max)}°)</label>
                                              <input
                                                  type="number"
                                                  min="0"
                                                  max="100"
                                                  step="1"
                                                  value={isNaN(mod.rightY) ? 0 : mod.rightY}
                                                  onChange={(e) => setMod({ rightY: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                                                  className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none text-center"
                                              />
                                          </div>
                                      </div>
                                      <div className="mt-1">
                                          <label className="text-[8px] font-bold text-gray-400 uppercase block mb-0.5">Mid Y</label>
                                          <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              step="1"
                                              value={isNaN(mod.midY) ? 0 : mod.midY}
                                              onChange={(e) => setMod({ midY: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                                              className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none text-center"
                                          />
                                      </div>
                                  </div>

                                  {/* Targets */}
                                  <div>
                                      <label className="text-[9px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Targets</label>
                                      <div className="space-y-1.5">
                                          {mod.targets.length === 0 && (
                                              <p className="text-[10px] italic text-gray-400">No targets — this modification has no effect until a capacity or muscle is added.</p>
                                          )}
                                          {mod.targets.map((t, tIdx) => {
                                              const sectionKey = `${t.jointGroup}.${t.actionKey}`;
                                              const assignedForTarget = muscleAssignments[sectionKey] || {};
                                              const muscleIdsInSection = Object.keys(assignedForTarget);
                                              const comboValue = `${t.jointGroup}::${t.actionKey}`;
                                              // Preview: what multiplier does THIS target produce
                                              // right now, given the curve + current source angle?
                                              // Per side, since left and right may diverge in
                                              // asymmetric scenes.
                                              const previewMultLeft  = srcAngleLeft  !== null ? applyTargetScaling(curveYLeft,  t) : 1;
                                              const previewMultRight = srcAngleRight !== null ? applyTargetScaling(curveYRight, t) : 1;

                                              const setTarget = (patch: Partial<ModificationTarget>) => setMod({
                                                  targets: mod.targets.map((tt, ti) => ti === tIdx ? { ...tt, ...patch } : tt),
                                              });

                                              return (
                                                  <div key={tIdx} className="bg-gray-50 border border-gray-100 rounded-lg p-2 space-y-1.5">
                                                      {/* Row 1: kind + target pickers + delete */}
                                                      <div className="flex items-center gap-1.5">
                                                          <select
                                                              value={t.kind}
                                                              onChange={(e) => {
                                                                  const newKind = e.target.value as 'capacity' | 'muscle';
                                                                  const firstMuscle = Object.keys(muscleAssignments[sectionKey] || {})[0] || '';
                                                                  setTarget({ kind: newKind, muscleId: newKind === 'muscle' ? firstMuscle : undefined });
                                                              }}
                                                              className={`text-[10px] font-bold rounded px-1.5 py-0.5 outline-none border ${t.kind === 'capacity' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-teal-50 border-teal-200 text-teal-700'}`}
                                                          >
                                                              <option value="capacity">capacity</option>
                                                              <option value="muscle">muscle</option>
                                                          </select>
                                                          {t.kind === 'capacity' ? (
                                                              <select
                                                                  value={comboValue}
                                                                  onChange={(e) => {
                                                                      const [jg, ak] = e.target.value.split('::');
                                                                      setTarget({ jointGroup: jg as JointGroup, actionKey: ak });
                                                                  }}
                                                                  className="flex-1 min-w-0 text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none"
                                                              >
                                                                  {allJointActions.map(o => (
                                                                      <option key={`${o.jointGroup}::${o.actionKey}`} value={`${o.jointGroup}::${o.actionKey}`}>
                                                                          {o.label}
                                                                      </option>
                                                                  ))}
                                                              </select>
                                                          ) : (
                                                              <div className="flex-1 min-w-0 grid grid-cols-2 gap-1.5">
                                                                  <select
                                                                      value={comboValue}
                                                                      onChange={(e) => {
                                                                          const [jg, ak] = e.target.value.split('::');
                                                                          const newSection = `${jg}.${ak}`;
                                                                          const firstMuscle = Object.keys(muscleAssignments[newSection] || {})[0] || '';
                                                                          setTarget({ jointGroup: jg as JointGroup, actionKey: ak, muscleId: firstMuscle });
                                                                      }}
                                                                      className="min-w-0 text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none"
                                                                  >
                                                                      {allJointActions.map(o => (
                                                                          <option key={`${o.jointGroup}::${o.actionKey}`} value={`${o.jointGroup}::${o.actionKey}`}>
                                                                              {o.label}
                                                                          </option>
                                                                      ))}
                                                                  </select>
                                                                  <select
                                                                      value={t.muscleId || ''}
                                                                      onChange={(e) => setTarget({ muscleId: e.target.value })}
                                                                      className="min-w-0 text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none"
                                                                  >
                                                                      {muscleIdsInSection.length === 0 && (
                                                                          <option value="" disabled>— no muscles in this section —</option>
                                                                      )}
                                                                      {muscleIdsInSection.map(mid => (
                                                                          <option key={mid} value={mid}>
                                                                              {MUSCLE_CATALOG.find(m => m.id === mid)?.name || mid}
                                                                          </option>
                                                                      ))}
                                                                  </select>
                                                              </div>
                                                          )}
                                                          <button
                                                              onClick={() => setMod({ targets: mod.targets.filter((_, ti) => ti !== tIdx) })}
                                                              className="text-gray-300 hover:text-rose-400 flex-shrink-0"
                                                              title="Remove target"
                                                          >
                                                              <Trash2 className="w-3 h-3" />
                                                          </button>
                                                      </div>
                                                      {/* Row 2: direction toggle + max change + live preview */}
                                                      <div className="flex items-center gap-1.5">
                                                          <div className="flex rounded overflow-hidden border border-gray-200">
                                                              <button
                                                                  onClick={() => setTarget({ direction: 'reduce' })}
                                                                  className={`text-[10px] font-bold px-2 py-0.5 transition-colors ${t.direction === 'reduce' ? 'bg-rose-100 text-rose-700' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                                                                  title="Reduce the target"
                                                              >
                                                                  ↓ Reduce
                                                              </button>
                                                              <button
                                                                  onClick={() => setTarget({ direction: 'increase' })}
                                                                  className={`text-[10px] font-bold px-2 py-0.5 transition-colors ${t.direction === 'increase' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                                                                  title="Increase the target"
                                                              >
                                                                  ↑ Increase
                                                              </button>
                                                          </div>
                                                          <div className="flex items-center gap-1">
                                                              <label className="text-[9px] font-bold text-gray-400">Max %</label>
                                                              <input
                                                                  type="number"
                                                                  min="0"
                                                                  step="1"
                                                                  value={isNaN(t.maxChange) ? 0 : t.maxChange}
                                                                  onChange={(e) => setTarget({ maxChange: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                                  className="w-14 text-[10px] font-mono bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-center"
                                                              />
                                                          </div>
                                                          <span className="ml-auto text-[9px] font-mono text-gray-400">
                                                              {Math.abs(previewMultLeft - previewMultRight) < 0.005
                                                                  ? <>× {previewMultRight.toFixed(2)}</>
                                                                  : <><span className="text-blue-500">× {previewMultLeft.toFixed(2)}</span>{' / '}<span className="text-red-500">× {previewMultRight.toFixed(2)}</span></>
                                                              }
                                                          </span>
                                                      </div>
                                                      {/* Row 3 (muscle only): isolated / relative mode. */}
                                                      {t.kind === 'muscle' && (
                                                          <div className="flex items-center gap-1.5">
                                                              <span className="text-[9px] font-bold text-gray-400">Mode</span>
                                                              <div className="flex rounded overflow-hidden border border-gray-200">
                                                                  <button
                                                                      onClick={() => setTarget({ muscleMode: 'relative' })}
                                                                      className={`text-[10px] font-bold px-2 py-0.5 transition-colors ${(t.muscleMode ?? 'relative') === 'relative' ? 'bg-teal-100 text-teal-700' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                                                                      title="Relative: shrinking this muscle raises the others' shares proportionally (same as editing the bell in the Muscles tab)."
                                                                  >
                                                                      Relative
                                                                  </button>
                                                                  <button
                                                                      onClick={() => setTarget({ muscleMode: 'isolated' })}
                                                                      className={`text-[10px] font-bold px-2 py-0.5 transition-colors ${t.muscleMode === 'isolated' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                                                                      title="Isolated: changes only this muscle's activation; others stay exactly as they are."
                                                                  >
                                                                      Isolated
                                                                  </button>
                                                              </div>
                                                          </div>
                                                      )}
                                                  </div>
                                              );
                                          })}
                                          <button
                                              onClick={() => {
                                                  const defaultJg: JointGroup = 'Ankle';
                                                  const firstAx = (JOINT_ACTIONS[defaultJg] || [])[0];
                                                  const defaultKey = firstAx ? actionKey(firstAx.positiveAction) : 'plantarFlexion';
                                                  setMod({
                                                      targets: [...mod.targets, { kind: 'capacity', jointGroup: defaultJg, actionKey: defaultKey, maxChange: 20, direction: 'reduce' }],
                                                  });
                                              }}
                                              className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 mt-1"
                                          >
                                              <Plus className="w-3 h-3" /> Add target
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}

                      <button
                          onClick={() => {
                              const defaultJg: JointGroup = 'Knee';
                              const firstAx = (JOINT_ACTIONS[defaultJg] || [])[0];
                              // Default to positive-direction action — matches the
                              // unified-axis source dropdown, which only lists the
                              // positive direction per DOF.
                              const defaultKey = firstAx ? actionKey(firstAx.positiveAction) : 'flexion';
                              const ax = firstAx ? { axis: firstAx, isPositive: true } : null;
                              const newRange = ax ? getActionRange(defaultJg, ax.axis, ax.isPositive) : { min: 0, max: 90 };
                              setModifications(mods => [...mods, {
                                  id: `mod-${Date.now()}`,
                                  name: 'New modification',
                                  sourceJoint: defaultJg,
                                  sourceActionKey: defaultKey,
                                  leftY: 0,
                                  midX: (newRange.min + newRange.max) / 2,
                                  midY: 50,
                                  rightY: 100,
                                  targets: [],
                              }]);
                          }}
                          className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-2"
                      >
                          <Plus className="w-4 h-4" /> New Modification
                      </button>
                  </div>
              </div>
              );
          })()}

        </div>
      </div>
    </div>
  );
};

export default BioModelPage;
