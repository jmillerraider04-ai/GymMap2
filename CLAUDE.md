## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

## Project Vision

GymMap2 is a universal exercise physics engine. The goal is to recreate the physics environment of any strength training exercise (machines, free weights, cables) so that the actual muscle targeting can be derived from physics rather than generic labels like "press = chest and triceps."

Pipeline: build exercise geometry -> compute joint force distribution -> derive muscle activation

The target exercises are basic strength training (pull-ups, dumbbell shoulder press, machine chest press, t-bar row, pin-loaded/plate-loaded machines). Not complex movements like olympic lifts.

## Architecture Decisions

### Biomechanics Model (pages/BioModelPage.tsx + components/BioMan.tsx)

**Coordinate system:** Y is down. Bones store unit direction vectors in parent-local coordinates (except clavicles which are offset vectors, and spine which is a world-space unit direction).

**Frame system:** Each joint has an orthonormal frame {x, y, z} where y = bone axis, x = hinge axis, z = flexion direction. Humerus/Femur use `createAbsoluteFrame` (swing-twist from {0,1,0} + above-horizontal coronal correction). Child bones use `transportFrame` (parallel transport). Spine uses `transportFrame` from rootFrame.

**IR/ER rotation:** Swing-twist decomposition with a smooth correction for above-horizontal coronal-plane motion. The correction smoothly twists from 0 deg at the horizon to 180 deg at overhead, modulated by how "coronal" the arm direction is (`signedCoronal = u.x * |u.x| / (u.x^2 + u.z^2)`). This prevents the forearm from snapping at the antiparallel singularity during coronal abduction past 90 deg. The ramp uses smoothstep: `t*t*(3-2*t)` where t = excess elevation / 90 deg.

**Bone types:**
- Ball-and-socket (Humerus, Femur): 2-DOF direction + 1-DOF twist (IR/ER)
- Hinge (Forearm, Tibia, Foot): 1-DOF arc in parent's y-z plane (x=0 in parent-local)
- Clavicle: offset vector (elevation + protraction), not unit direction
- Spine: passive 2-DOF unit direction bone (pelvis → ribcage). No user controls — positioned only by the solver to accommodate constraints. Torque demands detected via the force chain. Arms parent off spineFrame, legs off rootFrame.

**Constraint system (BoneConstraint):**
- `type: 'planar'`: bone tip locked to a plane (normal + center). Used for flat motion paths.
- `type: 'arc'`: bone tip locked to a circular arc (pivot + axis + radius). Pivot auto-projects along axis so arc always passes through the bone tip (`snapArcToTip`). Used for lever-based machines. Decomposed into axial + radial reaction directions for Phase B.
- `type: 'fixed'`: bone tip locked to a point in 3D space. Equivalent to 3 orthogonal planar constraints but one click, less visual clutter. Emits 3 reaction directions (X, Y, Z) for Phase B.
- Constraints are enforced by `solveConstraintsAccommodating` — a gradient-descent optimizer with Armijo backtracking that finds the smallest perturbation of free bones to satisfy all active constraints.
- Cost function: planar = signed distance²; arc = radial error² + axial error²; fixed = 3D distance².
- The solver handles 2-DOF (tangent-space), 1-DOF axis-locked, 1-DOF hinge, and twist DOFs.
- Solver enforces hinge joint limits (clamps candidate angles in Armijo line search).
- All drag handlers use adaptive step-halving: on solver failure, halve the step and retry (up to 6 halvings) instead of hard-stopping.

**Force system (ForceConfig):**
- Fixed forces: manual direction vector + magnitude + bone + application point
- Cable forces: `pulley` field → direction auto-recalculates from attachment toward pulley each frame.
- Bone-local forces: `localFrame: true` → direction interpreted in the bone's own transported frame (rotates with the limb). `localFrameIgnoreTwist: true` → excludes IR/ER from the local frame (tracks swing but not twist).
- Resistance profiles: `profile: { points: [{t, multiplier}] }` → piecewise-linear magnitude curve over ROM t (0=start, 1=end). Models cams, bands, lever profiles. Presets: Ascending, Descending, Peaked, Bell.
- Force magnitudes are in arbitrary units. Only relative magnitudes between forces matter. The system auto-normalizes to 1RM.
- Magnitudes now scale torque proportionally (multiple forces with different magnitudes produce proportionally different torques).

**Joint torque distribution system (calculateTorqueDistribution):**
- For each force, walks the kinematic chain from the force's bone to the root, computing `torque = cross(momentArm, scaledForce)` at each joint. Scaled force = direction × magnitude × profile multiplier.
- Projects accumulated torque onto joint action axes.
- Phase B: constrained joint optimization via Lagrange multipliers. For each constraint on the force's chain, solves `min Σ((τ0 + λ·sens) / cap)²` to redistribute load optimally. Arc constraints decompose into 2 rows (axial + radial), fixed constraints into 3 rows (X, Y, Z).
- Angle-dependent capacity via `evaluateCapacity()`: cosine interpolation between `base` (worst angle) and `specific` (optimal `angle`). Creates realistic strength curves and sticking points.
- Joint limit zeroing: if a joint is at its passive end-range and torque pushes further into the stop, demand is dropped (passive anatomy absorbs).
- jointForces: net transmitted force at each bone's proximal joint (applied forces + Phase B constraint reactions λ·n). Visualized as gray arrows.

**Joint actions defined:**
- Scapula: elevation/depression (Y axis), protraction/retraction (Z axis)
- Shoulder: flexion/extension (local X axis), abduction/adduction (local Z axis), horizontal adduction/abduction (WORLD Y axis — `useWorldAxis: true` to avoid bone-axis aliasing with IR/ER), internal/external rotation (bone axis)
- Elbow: extension/flexion (local X axis). positiveAction = Extension (matches dirToHingeAngle sign convention where positive = extension direction). Limits = {min: 0, max: 160} in slider space.
- Spine: flexion/extension, lateral flexion L/R, rotation L/R
- Hip: flexion/extension (local X axis), abduction/adduction (local Z axis), horizontal adduction/abduction (WORLD Y axis), internal/external rotation (bone axis)
- Knee: extension/flexion (same sign convention as elbow)
- Ankle: dorsi flexion/plantar flexion

**Joint limits system:**
- `JointLimit`: min/max + optional softZone + optional coupling (linear dependency on another dimension's live value).
- Dimensions: hinges use action-based (angle in degrees), ball-sockets/scapula/spine use DIR X/Y/Z on stored vector.
- Bilateral normalization: left-side DIR X is flipped for limit comparison so both sides share one table.
- Slider clamping: all drag handlers clamp input against effective limits.
- Solver enforcement: hinge angles clamped in the Armijo line search.
- Torque zeroing: demands pushing into a hit limit are dropped.
- Default scapula coupling: retraction range widens as scapula elevates.

**Symmetry mode:**
- `applyWholesaleSync(src)`: any edit on one side regenerates the other side's posture, twists, forces, AND constraints from scratch.
- `mirrorForceData` copies all force fields including localFrame, localFrameIgnoreTwist, profile.
- Active keyframe (start/end) also mirrored.

**Timeline system:**
- Start/end pose with slerp interpolation and constraint-aware playback.
- Timeline Peaks tab: samples 25 frames, 1RM-normalized. Shows resistance profile (total mechanical load shape), difficulty profile (max effort shape, always peaks at 100%), per-action sparklines, per-joint aggregate sparklines. ActionTimeSeries tracks effort per action per frame.
- Joint Analysis tab: 1RM-local / Raw toggle. Default normalizes so hardest action at current pose = 100%.
- `currentRomT` state tracks timeline position for profile evaluation (0=start, 1=end, animated t during playback).

### Design Decisions (important for future work)

1. **No gravity in the model.** All forces are manually defined vectors on bones. A dumbbell press is just a downward force at the hands. A leg press is a force at the feet pushing in the correct direction.

2. **Spine is passive.** The spine is in the kinematic chain (pelvis → spine → clavicles) and the solver can tilt it to accommodate constraints, but there are no dedicated user controls for spine position. For exercises requiring torso tilt (bent-over rows), the user can either constrain the feet and flex the hips (solver tilts spine), or rotate all forces by the desired angle to simulate a different gravity direction while keeping the figure upright. Spine torque demands (flexion, lateral flex, rotation) are detected from forces propagating through the chain.

3. **No "equipment objects."** Exercises are built by posing the figure and adding constraints + forces to body parts. A barbell isn't an object — it's constraints on the hands. A cable machine is a point-tracking force.

4. **1RM / maximal effort assumption.** Force magnitudes are in arbitrary units — only relative magnitudes between forces matter. The system auto-normalizes: Timeline Peaks scales so peak effort = 100%, Joint Analysis scales so current-frame peak = 100%. This means the user never needs to know absolute Newtons.

5. **Joint coupling increases upstream demand.** When constraints couple joints (e.g., barbell bench couples shoulder + elbow), the coupled system can handle more total load before the limiter hits capacity. This means upstream joints that aren't part of the coupling (e.g., scapula retraction in a bench press) see higher normalized demand than in an uncoupled exercise. This is already correctly captured by Phase B + 1RM normalization — verified empirically.

6. **Joint action decomposition is axis-based, not movement-based.** "Flexion" = torque about the mediolateral (X) axis, regardless of arm position. Horizontal abduction uses the WORLD vertical axis (not local frame Y, which would alias with IR/ER's bone axis).

7. **Muscle capacity and recruitment are independently defined.** A muscle being shortened does NOT automatically mean it's biased less in recruitment — capacity reduction and recruitment ratio changes are separate inputs the user defines independently.

8. **Two-joint muscle effects are manual modifiers.** E.g., gastroc inhibition during knee-flexed plantarflexion is defined by: (a) lower plantarflexion capacity at that knee angle, and (b) lower gastroc recruitment ratio at that knee angle. Not derived from muscle mechanics.

## Roadmap (agreed priority order)

1. ~~Arc constraints~~ (DONE)
2. ~~Point-tracking cable forces~~ (DONE)
3. ~~Joint torque distribution — Phase A~~ (DONE)
4. ~~Joint torque distribution — Phase B~~ (DONE) — constrained joint optimization via Lagrange multipliers. Arc + fixed constraints integrated.
5. ~~Static spine torque analysis~~ (DONE) — spine is now in the chain; torque demands detected automatically.
6. ~~Multi-position force curves~~ (DONE) — Timeline Peaks tab with resistance/difficulty profiles and per-action sparklines.
7. ~~Joint limits~~ (DONE) — passive end-range with slider clamping, solver enforcement, torque zeroing, coupling.
8. ~~Angle-dependent capacity~~ (DONE) — cosine interpolation creates realistic strength curves.
9. ~~Force refinement~~ (DONE) — bone-local direction, ignore-twist, resistance profiles, magnitude scaling.
10. ~~Spine unlock~~ (DONE) — passive chain element, solver-positionable, torque demands detected.
11. **Muscle activation mapping** — combine joint torques with manually-defined strength curves and per-muscle recruitment ratios to produce per-muscle activation percentages. Includes two-joint muscle inhibition as separate modifiers.

## Key Technical Concepts

- **Joint-tandem problem:** In constrained exercises (smith machine bench, leg press, t-bar row), multiple joints share the endpoint force. Phase B's Lagrange multiplier optimization finds the distribution that minimizes total neural drive `Σ(τ/cap)²`, accounting for mechanical advantage and position-dependent capacity at each joint.

- **Resistance profile:** Piecewise-linear multiplier on force magnitude over the ROM (t=0→1). Models cams, bands, and lever mechanisms. Evaluated at each timeline frame and at the live pose via `currentRomT`.

- **1RM normalization:** Global scale factor `1/maxEffort` applied after timeline sampling so the limiting action reads exactly 100%. All peaks, sparklines, and profiles share this scale. The Joint Analysis tab has a local variant (current-pose peak = 100%).

- **Phase B constraint reactions:** Each constraint type contributes reaction directions to a linear system. Planar = 1 direction (normal), arc = 2 (axial + radial), fixed = 3 (X, Y, Z). The solved λ values also feed into `jointForces` for the proximal force arrow visualization.

- **Adaptive step-halving:** All drag handlers use a while-loop with progress from 0→1, nominal step size, and halving on solver failure. Prevents the "slider only moves partway" issue where fixed-step loops hard-stopped on solver failure.

## Sign Convention Notes

- **Elbow/Knee hinge angle**: `dirToHingeAngle` returns `atan2(z, y)`. Positive = extension direction (forearm going backward past straight). The slider emits 0-160 (flexion degrees), and the existing code uses this directly as the angle target. positiveAction = Extension in JOINT_ACTIONS means `component > 0` → Extension label, `component < 0` → Flexion label. This is correct: a weight at 90° flex creates negative-X torque → Flexion demand (biceps resisting).

- **Shoulder/Hip horizontal ab/ad**: Uses `useWorldAxis: true` with axis {0,1,0} = world vertical. Without this flag, the local-frame Y would alias to the bone axis (since frame.y = bone direction for createAbsoluteFrame), colliding with IR/ER and causing horizontal adduction demand to be identically zero via residual subtraction.

- **Bilateral normalization**: For DIR-based limits and display, left-side bones negate their X component so both sides share one limits table. `getDimensionValue` handles this automatically.
