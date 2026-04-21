
import React, { useState, useEffect, useMemo, useRef } from 'react';
import BioMan, { Posture, Vector3, VisualForce, VisualPlane } from '../components/BioMan';
import { Settings2, RotateCcw, MousePointerClick, Move3d, Copy, Lock, Split, Play, Pause, Zap, Scale, Gauge, ChevronLeft, AlertCircle, ArrowDownUp, RefreshCw, ChevronRight, ChevronDown, BrainCircuit, Axis3d, Plus, Trash2, TrendingUp, Activity, Link2 } from 'lucide-react';

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
        // PF peak 150 Nm @ +15° dorsi (soleus/gastroc stretched — Sale 1982).
        // Base 60 ~40% of peak (steep curve — big torque loss at full PF).
        'plantarFlexion':       createCap(60, 150, 15),
        // DF peak 45 Nm @ -10° PF (tib anterior stretched when foot PF'd).
        // PF/DF ≈ 3.3 — ankle plantarflexion is dramatically stronger.
        'dorsiFlexion':         createCap(20, 45,  -10)
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

    'Shoulder.flexion': {
        'delt-front':        m(84, 36, 30, 1.15),
        'pec-clavicular':    m(0, 63, 37, 2),
        'biceps-brachii':    m(16, 55, 60, 1.6),  // merged from long + short, bases & peaks summed
        'traps-lower':       m(-5, 32, 140, 2.2),
        'serratus-anterior': m(-5, 28, 140, 2.2),
        'supraspinatus':     m(-2, 18, 15, 2.5),
        'pec-sternal':       m(0, 19, -65, 5),
    },
    'Shoulder.extension': {
        'lats':           m(-87, 105, -67, 1.05),
        'teres-major':    m(-15, 68, -60, 1.7),
        'pec-sternal':    m(-12, 87, -169, 3.35),
        'delt-rear':      m(27, 42, -20, 2.95),
        'triceps-long':   m(-5, 72, -86, 2.6),
        'rhomboids':      m(8, 18, -60),
    },
    'Shoulder.abduction': {
        'delt-side':         m(31, 79, 72, 2.75),
        'supraspinatus':     m(15, 70, 15, 2.2),
        'delt-front':        m(10, 81, 180, 1.9),
        'traps-lower':       m(-3, 41, 130, 3.2),
        'serratus-anterior': m(-3, 40, 130, 3.2),
        'biceps-brachii':    m(-2, 15, 120, 2),  // only long head contributes, retained under merged id
    },
    'Shoulder.adduction': {
        'lats':           m(-11, 118, -81, 2.5),
        'teres-major':    m(-5, 80, -80, 1.6),
        'pec-sternal':    m(36, 23, -35, 5),
        'pec-clavicular': m(-8, 13, 16, 2.5),
        'subscapularis':  m(-2, 34, -82, 2.55),
        'triceps-long':   m(1, 42, -107, 2.2),
        'delt-rear':      m(2, 19, -120, 1.8),
        'rhomboids':      m(9, 26, -75, 1.45),
    },
    'Shoulder.horizontalAdduction': {
        'pec-sternal':       m(20, 118, 70, 1.5),
        'pec-clavicular':    m(-5, 70, 40, 2),
        'delt-front':        m(2, 79, 56, 2.6),
        'biceps-brachii':    m(-2, 61, 60, 1.8),  // merged long + short, peaks summed
        'subscapularis':     m(0, 33, 30, 1.8),
        'serratus-anterior': m(0, 28, 60, 1.8),
    },
    'Shoulder.horizontalAbduction': {
        'delt-rear':     m(5, 120, 15, 1.8),
        'infraspinatus': m(-5, 82, 0, 2),
        'teres-minor':   m(-5, 70, 0, 2),
        'teres-major':   m(0, 22, 15, 1.8),
        'lats':          m(-2, 20, 30, 2),
        'triceps-long':  m(-5, 52, 25, 2.2),
        'rhomboids':     m(13, 36, 25, 2.5),
    },
    'Shoulder.internalRotation': {
        'subscapularis':  m(30, 105, 15, 1.5),
        'lats':           m(15, 80, -5, 1.3),
        'pec-sternal':    m(12, 70, 0, 1.3),
        'teres-major':    m(12, 65, 0, 1.3),
        'delt-front':     m(8, 42, 15, 1.4),
        'pec-clavicular': m(5, 30, 0, 1.4),
        'biceps-brachii': m(2, 16, 0, 1.5),  // only short head contributes, retained under merged id
    },
    'Shoulder.externalRotation': {
        'infraspinatus': m(25, 105, 10, 1.5),
        'teres-minor':   m(18, 92, 10, 1.5),
        'delt-rear':     m(10, 58, 0, 1.4),
        'supraspinatus': m(2, 20, 0, 1.6),
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
        'biceps-brachii':  m(47, 210, 45, 1.5),  // merged long + short, peak-weighted angle ≈ 45°
        'brachialis':      m(50, 100, 90, 0.85),
        'brachioradialis': m(5, 95, 120, 0.55),
    },
    'Elbow.extension': {
        'triceps-long':           m(-5, 169, -100, 1.4),
        'triceps-lateral-medial': m(115, 184, -53, 0.85),  // merged lateral + medial
    },

    // =========================================================================
    // HIP
    // =========================================================================
    // Flexion: 0=standing, +90=thigh forward horizontal, +180=full flex.
    // Extension: 0=standing, +30=extended behind, negative=hip flexed.
    // Abduction: 0=standing, +45-+90=leg out.
    // Adduction: 0=standing, -30-ish=leg abducted.

    'Hip.flexion': {
        'iliopsoas':       m(15, 120, 100, 2.2),
        'rectus-femoris':  m(10, 100, 30, 2),
        'tfl':             m(5, 72, 15, 1.7),
        'sartorius':       m(8, 50, 60, 1.4),
        'adductors':       m(0, 157, 4, 1.9),  // merged pectineus + longus + brevis + gracilis; anterior magnus doesn't flex
        'glute-med':       m(0, 18, 15, 1.8),
        'glute-min':       m(0, 13, 15, 1.8),
    },
    'Hip.extension': {
        'glute-max':                 m(55, 150, -15, 3.15),
        'hamstrings-biarticular':    m(30, 300, -54, 0.5),  // merged BF-long + semiten + semimem
        'adductor-magnus-posterior': m(-16, 132, -100),
        'glute-med':                 m(10, 25, 0),
        'glute-min':                 m(6, 15, 0),
    },
    'Hip.abduction': {
        'glute-med': m(20, 125, 30, 1.5),
        'glute-min': m(15, 88, 30, 1.5),
        'tfl':       m(12, 72, 15, 1.6),
        'glute-max': m(7, 41, 30, 1.8),
        'sartorius': m(2, 24, 0, 1.8),
    },
    'Hip.adduction': {
        'adductors':                 m(40, 335, -16, 1.4),  // merged anterior magnus + longus + brevis + gracilis + pectineus
        'adductor-magnus-posterior': m(5, 32, -30, 1.5),
        'hamstrings-biarticular':    m(0, 27, 0, 1.6),  // merged semitend + semimem
    },
    'Hip.horizontalAdduction': {
        'adductors':                 m(45, 388, 42, 1.4),  // merged anterior magnus + longus + brevis + gracilis + pectineus
        'adductor-magnus-posterior': m(3, 26, 45, 1.5),
        'iliopsoas':                 m(5, 50, 60, 1.5),
        'sartorius':                 m(0, 18, 45, 1.6),
    },
    'Hip.horizontalAbduction': {
        'glute-med': m(10, 88, 0, 1.4),
        'tfl':       m(8, 62, 0, 1.4),
        'glute-min': m(6, 56, 0, 1.5),
        'glute-max': m(3, 56, 0, 1.6),
        'sartorius': m(0, 15, 0, 1.7),
    },
    'Hip.internalRotation': {
        'glute-med':              m(10, 78, 0, 1.4),
        'glute-min':              m(8, 68, 0, 1.4),
        'tfl':                    m(8, 62, 0, 1.4),
        'adductors':              m(9, 112, 0, 1.5),  // merged longus + brevis + pectineus (anterior magnus doesn't IR)
        'hamstrings-biarticular': m(0, 48, 0, 1.6),   // merged semitend + semimem
    },
    'Hip.externalRotation': {
        'glute-max':              m(25, 108, 0, 1.2),
        'sartorius':              m(8, 50, 0, 1.4),
        'glute-med':              m(10, 56, 0, 1.4),
        'glute-min':              m(6, 36, 0, 1.4),
        'hamstrings-biarticular': m(2, 26, 0, 1.5),  // only BF-long ER'd; retained under merged id
        'iliopsoas':              m(0, 22, 0, 1.7),
    },

    // =========================================================================
    // KNEE
    // =========================================================================
    // Knee.flexion: 0=straight, +160=full flex. (Knee uses actionSign=-1
    // which inverts rawAngle's positive=flexion convention into the correct
    // section-positive=more-action direction.)
    // Knee.extension: 0=straight, -160=full flex (stretched quads).

    'Knee.flexion': {
        'hamstrings-biarticular': m(28, 259, 70, 1.4),  // merged BF-long + semiten + semimem
        'biceps-femoris-short':   m(36, 111, 11, 1.5),
        'gastrocnemius':          m(2, 56, 15, 4.15),
        'sartorius':              m(2, 26, 60, 1.6),
        // Gracilis intentionally omitted: adductor contribution to knee
        // flexion is insignificant vs. the actual knee flexors.
        'tfl':                    m(0, 14, 30, 2),
    },
    'Knee.extension': {
        'quads-vasti':    m(60, 375, -120, 0.25),  // merged lateralis + medialis + intermedius
        'rectus-femoris': m(20, 123, -180, 0.25),
        'tfl':            m(0, 14, -120, 0.25),
    },

    // =========================================================================
    // ANKLE
    // =========================================================================

    'Ankle.dorsiFlexion': {
        'tibialis-anterior': m(40, 105, 10),
        // EHL, EDL, peroneus tertius (not in catalog) assist.
    },
    'Ankle.plantarFlexion': {
        // Tight bells (steepness 5) so each muscle owns its zone sharply:
        // gastroc dominates the PF side, soleus the DF side.
        'gastrocnemius': m(0, 151, -30, 5),
        'soleus':        m(25, 140, 8, 5),
        // Tibialis posterior + peroneals (not in catalog) contribute.
    },

    // =========================================================================
    // SPINE
    // =========================================================================
    // Spine section angles come out near zero structurally (spine bone is
    // passive), so peak angle = 0 gives full weight and ratios matter.

    'Spine.flexion': {
        'rectus-abdominis':  m(40, 115, 0),
        'obliques-external': m(25, 75, 0),
        'obliques-internal': m(25, 75, 0),
        // Psoas pulls the lumbar spine forward when the femurs are fixed.
        'iliopsoas':         m(10, 25, 0),
    },
    'Spine.extension': {
        'erector-spinae':     m(50, 135, 0),
        'quadratus-lumborum': m(20, 50, 0),
        // Lats assist trunk extension via thoracolumbar fascia.
        'lats':               m(8, 20, 0),
        // Glute max indirectly via anterior pelvic tilt counter-action; small.
        'glute-max':          m(4, 10, 0),
    },
    'Spine.lateralFlexionL': {
        'obliques-external':  m(30, 85, 0),
        'obliques-internal':  m(30, 85, 0),
        'quadratus-lumborum': m(30, 85, 0),
        'erector-spinae':     m(25, 65, 0),
        'lats':               m(10, 22, 0),
        'iliopsoas':          m(8, 18, 0),
        // Rectus abdominis contributes to lateral flexion too (flexes +
        // laterally flexes).
        'rectus-abdominis':   m(8, 20, 0),
    },
    'Spine.lateralFlexionR': {
        'obliques-external':  m(30, 85, 0),
        'obliques-internal':  m(30, 85, 0),
        'quadratus-lumborum': m(30, 85, 0),
        'erector-spinae':     m(25, 65, 0),
        'lats':               m(10, 22, 0),
        'iliopsoas':          m(8, 18, 0),
        'rectus-abdominis':   m(8, 20, 0),
    },
    'Spine.rotationL': {
        'obliques-external': m(35, 105, 0),  // contralateral rotates trunk
        'obliques-internal': m(30, 85, 0),   // ipsilateral rotates trunk
        'erector-spinae':    m(15, 45, 0),
        'lats':              m(6, 18, 0),
        // Rectus abdominis assists rotation mildly.
        'rectus-abdominis':  m(5, 12, 0),
    },
    'Spine.rotationR': {
        'obliques-external': m(35, 105, 0),
        'obliques-internal': m(30, 85, 0),
        'erector-spinae':    m(15, 45, 0),
        'lats':              m(6, 18, 0),
        'rectus-abdominis':  m(5, 12, 0),
    },

    // =========================================================================
    // SCAPULA
    // =========================================================================
    // Scapula rawAngle also always ~0 in this model; ratios set relative
    // contributions.

    'Scapula.elevation': {
        'traps-upper':      m(55, 125, 0),
        'levator-scapulae': m(40, 95, 0),
        'rhomboids':        m(25, 60, 0),
        'traps-mid':        m(20, 42, 0),
    },
    'Scapula.depression': {
        'traps-lower':       m(45, 115, 0),
        'pec-minor':         m(25, 65, 0),
        'lats':              m(20, 55, 0),
        // Serratus anterior lower fibers depress the scapula along the
        // ribcage.
        'serratus-anterior': m(12, 28, 0),
        // Pec major (both heads) pulls the shoulder girdle down via the
        // humerus when pulling from overhead.
        'pec-sternal':       m(6, 15, 0),
    },
    'Scapula.protraction': {
        'serratus-anterior': m(55, 135, 0),
        'pec-minor':         m(25, 65, 0),
        // Sternal pec protracts the scapula via the humerus when pulling arm
        // across body. Clavicular pec removed — its fiber orientation is
        // more vertical and doesn't contribute meaningful protraction.
        'pec-sternal':       m(8, 20, 0),
    },
    'Scapula.retraction': {
        'traps-mid':   m(45, 115, 0),
        'rhomboids':   m(40, 110, 0),
        'traps-lower': m(20, 50, 0),
        'traps-upper': m(8, 20, 0),
        'lats':        m(6, 18, 0),
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

    // --- Hip (femur unit direction, right-normalized) ---
    // Standing rest: (0, 1, 0). Conservative realistic limits (was too
    // permissive):
    //   Abduction: x.max = 0.65 → 40.5° pure-path (typical 30-45°).
    //   Adduction: x.min = -0.35 → 20.5° (typical 20-30°).
    //   Flexion: y.min = -0.5 → caps at ~120° via combined paths (typical
    //     80-90° with straight knee, up to 120° bent knee; was -0.55 → 140°).
    //   Extension: z.max = 0.25 → 14.5° pure hyperextension (typical 10-15°).
    //   ER / IR: ±40° (typical 35-45°; was ±45°).
    'Hip.dir.x': { min: -0.35, max: 0.65 },
    'Hip.dir.y': { min: -0.5,  max: 1.02 },
    'Hip.dir.z': { min: -0.9,  max: 0.25 },
    'Hip.action.External Rotation': { min: -40, max: 40 },

    // --- Knee hinge. Same as Elbow — limit is in slider space (0=straight, 160=full flex). ---
    'Knee.action.Extension': { min: 0, max: 140 },

    // --- Ankle hinge. positiveAction = Dorsi Flexion. ---
    'Ankle.action.Dorsi Flexion': { min: -50, max: 20 },
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

      // Track total applied force (after F_∥ extraction at force bones
      // that are constrained). Phase B's constraint-subspace force balance
      // uses this as the RHS:
      //    for each consRef i:  Σ_j (n_i · n_j) λ_j = -(F_total · n_i)
      // Moment balance isn't enforced — point constraints can't absorb
      // moments, so the figure is treated as kinematically pinned and any
      // residual moment is absorbed by an implicit world anchor.
      let totalAppliedForce: Vector3 = { x: 0, y: 0, z: 0 };

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
              const activeCons = consAtBone.filter(c => c.active && c.physicsEnabled !== false);
              if (activeCons.length > 0) {
                  const normals: Vector3[] = [];
                  for (const c of activeCons) {
                      if (c.type === 'planar') {
                          const n = normalize(c.normal);
                          if (magnitude(n) > 0.1) normals.push(n);
                      } else if (c.type === 'fixed') {
                          normals.push({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 });
                      } else if (c.type === 'arc' && c.axis && c.pivot && c.radius !== undefined) {
                          const axisN = normalize(c.axis);
                          if (magnitude(axisN) > 0.1) normals.push(axisN);
                          const tipPt = getConstraintPoint(f.boneId, c, kin);
                          if (tipPt) {
                              const relTip = sub(tipPt, c.pivot);
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
                          const capLk = capacities[jg]?.[capacityKey(actName)] || capacities[jg]?.[actionKey(actName)] || capacities[jg]?.[actName] || null;
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
                          sens.push(s);
                      }
                      cols.push({ boneId: bone, jointGroup: jg, act, tau0, cap: capVal, sens, isLeft });
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
                  // Moment balance (Σ r × F + Σ r_tip × λn = 0) is NOT
                  // enforced. Point constraints can't resist moments about
                  // themselves, so whole-body moment balance is generally
                  // infeasible — the figure would rotate freely under any
                  // off-axis force. The assumption here is the standard
                  // biomechanics one: treat the figure as kinematically
                  // pinned in space, so any residual moment is absorbed
                  // by an implicit world anchor. Joint demands are what
                  // muscles produce to hold the pose under this assumption.
                  //
                  //   [AtWA     A_H     A_F   ] [λ  ]   [AtWb ]
                  //   [A_H^T    0       0    ] [μ_H] = [-b_H ]
                  //   [A_F^T    0       0    ] [μ_F]   [-b_F ]
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
                  const B = N;
                  const dim = N + H + B;

                  // IRLS parameters. EPS_EFFORT floors |u_c| so columns that
                  // are near-zero in the current iterate don't get infinite
                  // weight (which would explode the solve for p < 2).
                  const EPS_EFFORT = 0.01;
                  const isQuadratic = Math.abs(effortExponent - 2) < 1e-6;
                  const IRLS_ITERS = isQuadratic ? 1 : 5;
                  const colWeights: number[] = new Array(cols.length).fill(1);
                  let lam: number[] = new Array(N).fill(0);

                  for (let iter = 0; iter < IRLS_ITERS; iter++) {
                      // Build weighted AtWA, AtWb.
                      const AtWA: number[][] = Array.from({length: N}, () => new Array(N).fill(0));
                      const AtWb: number[] = new Array(N).fill(0);
                      for (let i = 0; i < N; i++) {
                          for (let j = 0; j < N; j++) {
                              let s = 0;
                              for (let ci = 0; ci < cols.length; ci++) {
                                  const c = cols[ci];
                                  s += colWeights[ci] * c.sens[i] * c.sens[j] / (c.cap * c.cap);
                              }
                              AtWA[i][j] = s;
                          }
                          let r = 0;
                          for (let ci = 0; ci < cols.length; ci++) {
                              const c = cols[ci];
                              r += colWeights[ci] * c.sens[i] * c.tau0 / (c.cap * c.cap);
                          }
                          AtWb[i] = -r;
                      }
                      for (let i = 0; i < N; i++) AtWA[i][i] += 1e-8;

                      // Force-balance rows (class 2 equality above). One
                      // row per consRef i:
                      //   row i:  Σ_j (n_i · n_j) λ_j = -(F_total · n_i)
                      // These are weight-independent; rebuilt each iter
                      // only because we're rebuilding the KKT matrix M.
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
                      for (let i = 0; i < B; i++) {
                          const ni = consRefs[i].n;
                          for (let j = 0; j < N; j++) {
                              const dotIJ = dotProduct(ni, consRefs[j].n);
                              Mm[j][N + H + i] = dotIJ;
                              Mm[N + H + i][j] = dotIJ;
                          }
                          RHS[N + H + i] = -dotProduct(totalAppliedForce, ni);
                      }
                      for (let k = 0; k < B; k++) Mm[N + H + k][N + H + k] += 1e-10;

                      const sol = solveSmall(Mm, RHS);
                      lam = sol.slice(0, N);

                      if (iter === IRLS_ITERS - 1) break;

                      // Update weights from current τ estimates. w_c =
                      // max(|u_c|, eps)^(p-2). For p < 2 this is > 1 at
                      // small u (punishes the near-zero columns less) and
                      // < 1 at large u (relaxes them). The converged fixed
                      // point is the minimizer of Σ (τ/cap)^p.
                      for (let ci = 0; ci < cols.length; ci++) {
                          const c = cols[ci];
                          let newTau = c.tau0;
                          for (let i = 0; i < N; i++) newTau += lam[i] * c.sens[i];
                          const u = Math.abs(newTau / c.cap);
                          const uSafe = Math.max(u, EPS_EFFORT);
                          colWeights[ci] = Math.pow(uSafe, effortExponent - 2);
                      }
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
                      const perJointDbg: Record<string, { tau0: number; newTau: number; cap: number; sensSum: number; }> = {};
                      for (const c of cols) {
                          if (!/Forearm|Humerus|Clavicle|spine|Tibia|Femur|Foot/.test(c.boneId)) continue;
                          let nt = c.tau0;
                          let ss = 0;
                          for (let i = 0; i < N; i++) { nt += lam[i] * c.sens[i]; ss += Math.abs(c.sens[i]); }
                          const key = `${c.boneId}.${c.act.positiveAction}/${c.act.negativeAction}`;
                          perJointDbg[key] = { tau0: c.tau0, newTau: nt, cap: c.cap, sensSum: ss };
                      }
                      // Bone positions for moment-arm verification across tests.
                      const bonePosDbg: Record<string, { start: Vector3; end: Vector3 }> = {};
                      for (const b of ['rHumerus','rForearm','lHumerus','lForearm','spine','rFemur','lFemur','rTibia','lTibia']) {
                          const s = kin2.boneStartPoints[b], e = kin2.boneEndPoints[b];
                          if (s && e) bonePosDbg[b] = { start: s, end: e };
                      }
                      (window as unknown as Record<string, unknown>).__phaseBDebug = {
                          appliedForces: Object.fromEntries(fByBoneDbg),
                          constraintNormalsByBone: Object.fromEntries(normalsByBoneDbg),
                          lambdas: lam.slice(),
                          reactionByBone: Object.fromEntries(reactionByBoneDbg),
                          fEffByBone: fEffByBoneDbg,
                          perJoint: perJointDbg,
                          bonePositions: bonePosDbg,
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
      const dir = curPosture[boneId];
      if (!dir) return 0;
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
      const isKneeOrAnkle = /Tibia|Foot/.test(boneId);
      const actionSign = action.isBoneAxis ? 1 :
                         action.useWorldAxis ? -1 :
                         isElbow ? 1 :
                         isKneeOrAnkle ? -1 :
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
      const actionSign = ax.isBoneAxis ? 1 :
                         ax.useWorldAxis ? -1 :
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
      if (act.useWorldAxis) return normalize(act.axis);
      if (act.isBoneAxis) {
          const bs = kin.boneStartPoints[bone];
          const be = kin.boneEndPoints[bone];
          if (!bs || !be) return null;
          return normalize(sub(be, bs));
      }
      const jf = kin.jointFrames[bone];
      if (!jf) return null;
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
      let result: Vector3 = { ...dir };
      const flipX = boneId.startsWith('l');
      for (let iter = 0; iter < 4; iter++) {
          // Each iteration sees the latest `result` via the posture snapshot.
          const snapshot = { ...curPosture, [boneId]: result };
          let changed = false;
          for (const dim of dims) {
              const eff = getEffectiveLimit(dim.key, boneId, snapshot, curTwists);
              if (!eff) continue;
              const comp = dim.component as 'x' | 'y' | 'z';
              const stored = result[comp];
              const normalized = (comp === 'x' && flipX) ? -stored : stored;
              const clamped = clamp(normalized, eff.min, eff.max);
              if (Math.abs(clamped - normalized) > 1e-6) {
                  result[comp] = (comp === 'x' && flipX) ? -clamped : clamped;
                  changed = true;
              }
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
  ): Record<string, { side: string; muscleId: string; activation: number }> => {
      const acc: Record<string, { side: string; muscleId: string; activation: number }> = {};

      // Distribute a (signed) effort across the muscles assigned to one
      // section. Positive effort = activation; negative effort = inhibition
      // for muscles in the opposite-direction section (antagonist rule).
      // angleInDirection is the joint angle measured positive in this
      // section's direction (so each muscle's bell evaluates correctly).
      const distributeToSection = (
          sectionKey: string,
          angleInDirection: number,
          side: string,
          effortSigned: number,
      ) => {
          const assigned = assignments[sectionKey];
          if (!assigned) return;
          const ids = Object.keys(assigned);
          if (ids.length === 0) return;
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
              acc[key].activation += effortSigned * share * isoMod;
          }
      };

      for (const d of demands) {
          // Parse `${side} ${group} ${directionName}` back out of d.action.
          let s = d.action;
          let side = '';
          if (s.startsWith('Left '))  { side = 'Left';  s = s.slice(5); }
          else if (s.startsWith('Right ')) { side = 'Right'; s = s.slice(6); }
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
          //   • Hinge KNEE/ANKLE (atan2(z,y) on tibia | atan2(y,-z) on
          //     foot): positive rawAngle = flexion for knee, plantar for
          //     ankle. Both are NEGATIVE actions (positiveAction = Extension
          //     / Dorsi Flexion). actionSign = −1.
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
          const isKneeOrAnkle = /Tibia|Foot/.test(d.boneId);
          const actionSign = ax.isBoneAxis ? 1 :
                             ax.useWorldAxis ? -1 :
                             isElbow ? 1 :
                             isKneeOrAnkle ? -1 :
                             1;
          const directionAngle = rawAngle * actionSign * (isPositive ? 1 : -1);

          const sectionKey = `${d.jointGroup}.${actionKey(directionName)}`;
          // 1) PRIMARY: muscles assigned to this direction get positive
          //    activation, distributed by their bell-weighted share.
          distributeToSection(sectionKey, directionAngle, side, d.effort);

          // 2) ANTAGONIST: muscles assigned to the OPPOSITE direction get
          //    negative activation of the same magnitude, distributed by
          //    their own bell-weighted share at the opposite-direction angle
          //    (which is just -directionAngle).
          //
          //    Net effect: a muscle that is purely a flexor disappears
          //    entirely under pure extension demand (negative → clamped
          //    away by the > 1e-6 filter). A multi-joint muscle whose
          //    actions partially oppose each other across joints sees its
          //    net activation lowered when the opposing demand is loaded —
          //    e.g. biceps under simultaneous elbow flexion + shoulder
          //    extension demand, or gastroc under plantarflexion + knee
          //    extension demand.
          const oppositeName = isPositive ? ax.negativeAction : ax.positiveAction;
          const oppositeKey = `${d.jointGroup}.${actionKey(oppositeName)}`;
          distributeToSection(oppositeKey, -directionAngle, side, -d.effort);
      }
      return acc;
  };

  const muscleActivation = useMemo<MuscleActivation[]>(() => {
      if (!torqueDistribution || torqueDistribution.demands.length === 0) return [];
      const acc = distributeMuscleLoadForFrame(torqueDistribution.demands, posture, twists, muscleAssignments);
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
  }, [torqueDistribution, muscleAssignments, posture, twists]);

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

          // --- Per-muscle activation for this frame ---
          // Distribute this frame's joint demands across assigned muscles
          // using the bell-curve weights at the joint's current angle.
          // Track per-(side, muscle) activation in time series + peak map.
          const frameMuscle = distributeMuscleLoadForFrame(dist.demands, framePose, frameTw, muscleAssignments);
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

      // --- Muscle peak normalization ---
      // Find the highest muscle activation peak across the timeline and
      // scale all muscle data so it reads exactly 1.0. This is a separate
      // scale from the joint 1RM scale because muscle activation values
      // are sums-across-multiple-joint-actions and can exceed any single
      // joint's effort. Display in the UI then multiplies by 100 for %.
      let muscleMaxRaw = 0;
      for (const mp of musclePeakMap.values()) {
          if (mp.peakActivation > muscleMaxRaw) muscleMaxRaw = mp.peakActivation;
      }
      if (muscleMaxRaw > 1e-9) {
          const mScale = 1 / muscleMaxRaw;
          for (const mp of musclePeakMap.values()) mp.peakActivation *= mScale;
          for (const ms of muscleSeriesMap.values()) {
              for (let i = 0; i < ms.activations.length; i++) ms.activations[i] *= mScale;
          }
      }

      const musclePeaks: MusclePeak[] = Array.from(musclePeakMap.values())
          // Drop muscles whose timeline peak is essentially zero — happens
          // when a muscle is purely antagonised across the whole rep (its
          // bell-share contributions all came in negative and got clamped).
          .filter(mp => mp.peakActivation > 1e-6)
          .map(mp => ({
          side: mp.side,
          muscleId: mp.muscleId,
          muscleName: MUSCLE_CATALOG.find(m => m.id === mp.muscleId)?.name || mp.muscleId,
          peakActivation: mp.peakActivation,
          peakFramePct: mp.peakFramePct,
      }));
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

      return { peaks, limitingPeak, framesAnalyzed, framesSkipped, profile, actionSeries, musclePeaks, muscleSeries, limitingMuscle };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startPosture, endPosture, startTwists, endTwists, forces, constraints, jointCapacities, jointLimits, muscleAssignments, effortExponent]);

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

  // Apply an exercise preset. Replaces the scene with the preset's poses,
  // forces, and constraints — IDs are assigned here since presets are
  // authored as pure data. The display pose is set to the start keyframe
  // and the timeline cursor is rewound to 0 so the user sees the start
  // position first. Symmetry mode is left as-is.
  const applyPreset = (preset: ExercisePreset) => {
    const sTwists = preset.startTwists || DEFAULT_TWISTS;
    const eTwists = preset.endTwists || DEFAULT_TWISTS;
    setStartPosture(preset.startPosture);
    setEndPosture(preset.endPosture);
    setStartTwists(sTwists);
    setEndTwists(eTwists);
    setPosture(preset.startPosture);
    setTwists(sTwists);
    setPoseMode('start');
    setCurrentRomT(0);
    setSelectedBone(null);
    setTargetPos(null);
    setTargetReferenceBone(null);
    setIsPlaying(false);

    const baseId = Date.now().toString();
    const newForces: ForceConfig[] = preset.forces.map((f, i) => ({
        ...f,
        id: `${baseId}-f${i}`,
    }));
    setForces(newForces);

    const newConstraints: Record<string, BoneConstraint[]> = {};
    let cidx = 0;
    for (const [bid, list] of Object.entries(preset.constraints)) {
        newConstraints[bid] = list.map(c => ({
            ...c,
            id: `${baseId}-c${cidx++}`,
            physicsEnabled: c.physicsEnabled !== false,
        }));
    }
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
                                       {/* Muscle activation roll-up. Splits each
                                         * joint-action demand across its assigned
                                         * muscles using their angle-weighted
                                         * relative shares, then sums per (side,
                                         * muscle). Same display scale as the
                                         * joint demands above (1RM-local: max
                                         * muscle reads 100%; raw: passes through).
                                         */}
                                       {analysisView === 'muscle' && muscleActivation.length > 0 && (() => {
                                           const muscleScale = torqueDisplayMode === '1rm-local'
                                               ? (muscleActivation[0].activation > 1e-9 ? 1 / muscleActivation[0].activation : 1)
                                               : 1;
                                           return (
                                               <div className="bg-white border border-gray-100 rounded-2xl p-4">
                                                   <div className="flex items-center gap-2 mb-3">
                                                       <Activity className="w-4 h-4 text-teal-600" />
                                                       <h4 className="font-bold text-gray-900 text-sm">Muscle Activation</h4>
                                                   </div>
                                                   <div className="space-y-2">
                                                       {muscleActivation.map(ma => {
                                                           const pct = ma.activation * muscleScale * 100;
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
                          {/* Limiting factor swaps with view: limiting joint action vs limiting muscle. */}
                          {timelineView === 'joint' && timelineAnalysis.limitingPeak && (
                              <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-red-400 mb-1">Limiting Factor</p>
                                  <p className="font-bold text-red-800 text-sm">{timelineAnalysis.limitingPeak.action}</p>
                                  <p className="text-[10px] text-red-500 font-medium">
                                      Peaks at {timelineAnalysis.limitingPeak.peakFramePct.toFixed(0)}% of range
                                  </p>
                              </div>
                          )}
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
                                                                      {renderSparkline(normalized, lineColor, fillColor, 16)}
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
                              // Group muscle peaks by anatomical region.
                              // Mirrors the joint view's "Side JointGroup"
                              // grouping but uses MUSCLE_CATALOG.region.
                              const regionMap = new Map<string, MusclePeak[]>();
                              for (const mp of timelineAnalysis.musclePeaks) {
                                  const region = MUSCLE_CATALOG.find(m => m.id === mp.muscleId)?.region || 'Other';
                                  if (!regionMap.has(region)) regionMap.set(region, []);
                                  regionMap.get(region)!.push(mp);
                              }
                              if (regionMap.size === 0) {
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
                                      </svg>
                                  );
                              };

                              // Stable region order: walk the catalog so
                              // the UI ordering is deterministic regardless
                              // of which muscles happen to be active.
                              const regionOrder = Array.from(new Set(MUSCLE_CATALOG.map(m => m.region)));
                              const orderedRegions = regionOrder.filter(r => regionMap.has(r));

                              return orderedRegions.map(regionName => {
                                  const peaks = regionMap.get(regionName)!;
                                  const sorted = [...peaks].sort((a, b) => b.peakActivation - a.peakActivation);
                                  const nFrames = timelineAnalysis.profile.length;

                                  // Region aggregate sparkline: max muscle
                                  // activation in this region per frame.
                                  const regionAgg = new Array(nFrames).fill(0);
                                  for (const mp of sorted) {
                                      const series = muscleSeriesLookup.get(`${mp.side}|${mp.muscleId}`);
                                      if (!series) continue;
                                      for (let i = 0; i < Math.min(nFrames, series.activations.length); i++) {
                                          if (series.activations[i] > regionAgg[i]) regionAgg[i] = series.activations[i];
                                      }
                                  }

                                  return (
                                      <div key={`muscle-region-${regionName}`} className="bg-white border border-gray-100 rounded-2xl p-4">
                                          <h4 className="font-bold text-gray-900 text-sm mb-1">{regionName}</h4>
                                          <div className="mb-3 rounded overflow-hidden">
                                              {renderSparkline(regionAgg, '#6b7280', 'rgba(107, 114, 128, 0.1)', 20)}
                                          </div>
                                          <div className="space-y-3">
                                              {sorted.map((mp, i) => {
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
                                                                      {renderSparkline(normalized, lineColor, fillColor, 16)}
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
                                                      <div className="flex items-center justify-end mb-3 pt-2">
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
                          // Source action options.
                          const srcActs = JOINT_ACTIONS[mod.sourceJoint] || [];
                          const srcActionOptions: { key: string; label: string }[] = [];
                          for (const ax of srcActs) {
                              srcActionOptions.push({ key: actionKey(ax.positiveAction), label: ax.positiveAction });
                              srcActionOptions.push({ key: actionKey(ax.negativeAction), label: ax.negativeAction });
                          }

                          // X range from the source action's joint limits.
                          const srcAx = getActionAxisByKey(mod.sourceJoint, mod.sourceActionKey);
                          const range = srcAx
                              ? getActionRange(mod.sourceJoint, srcAx.axis, srcAx.isPositive)
                              : { min: -180, max: 180 };
                          const clampedMidX = Math.max(range.min, Math.min(range.max, mod.midX));
                          const srcAngleRight = getModificationSourceAngle(mod, 'right', posture, twists);
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
                          const livePtX = srcAngleRight !== null ? xScale(Math.max(range.min, Math.min(range.max, srcAngleRight))) : null;

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
                                          {/* Live source-angle marker (right side) */}
                                          {livePtX !== null && (
                                              <line x1={livePtX} x2={livePtX} y1={PAD} y2={PAD + plotH} stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
                                          )}
                                          {/* Axis labels */}
                                          <text x={PAD} y={GH + 10} fontSize="8" fill="#9ca3af">{Math.round(range.min)}°</text>
                                          <text x={PAD + plotW} y={GH + 10} textAnchor="end" fontSize="8" fill="#9ca3af">{Math.round(range.max)}°</text>
                                          <text x={PAD} y={PAD + 7} fontSize="8" fill="#9ca3af">100%</text>
                                          <text x={PAD} y={yScale(0) - 2} fontSize="8" fill="#9ca3af">0%</text>
                                      </svg>
                                      <p className="text-[9px] font-mono text-gray-400 mt-1">
                                          Current (R): {srcAngleRight !== null ? `${Math.round(srcAngleRight)}°` : '—'} → curve at {curveYRight.toFixed(0)}%
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
                                              // Preview: what multiplier does THIS target produce right now, given the curve + current source angle?
                                              const previewMult = srcAngleRight !== null
                                                  ? applyTargetScaling(curveYRight, t)
                                                  : 1;

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
                                                              × {previewMult.toFixed(2)}
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
                              const defaultKey = firstAx ? actionKey(firstAx.negativeAction) : 'flexion';
                              const ax = firstAx ? { axis: firstAx, isPositive: false } : null;
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
