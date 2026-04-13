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

**Coordinate system:** Y is down. Torso is fixed at origin. Bones store unit direction vectors in parent-local coordinates (except clavicles which are offset vectors).

**Frame system:** Each joint has an orthonormal frame {x, y, z} where y = bone axis, x = hinge axis, z = flexion direction. Humerus/Femur use `createAbsoluteFrame` (swing-twist from {0,1,0} + above-horizontal coronal correction). Child bones use `transportFrame` (parallel transport).

**IR/ER rotation:** Swing-twist decomposition with a smooth correction for above-horizontal coronal-plane motion. The correction smoothly twists from 0 deg at the horizon to 180 deg at overhead, modulated by how "coronal" the arm direction is (`signedCoronal = u.x * |u.x| / (u.x^2 + u.z^2)`). This prevents the forearm from snapping at the antiparallel singularity during coronal abduction past 90 deg. The ramp uses smoothstep: `t*t*(3-2*t)` where t = excess elevation / 90 deg.

**Bone types:**
- Ball-and-socket (Humerus, Femur): 2-DOF direction + 1-DOF twist (IR/ER)
- Hinge (Forearm, Tibia, Foot): 1-DOF arc in parent's y-z plane (x=0 in parent-local)
- Clavicle: offset vector (elevation + protraction), not unit direction
- Spine: fixed (see design note below)

**Constraint system (BoneConstraint):**
- `type: 'planar'`: bone tip locked to a plane (normal + center). Used for flat motion paths.
- `type: 'arc'`: bone tip locked to a circular arc (pivot + axis + radius). Pivot auto-projects along axis so arc always passes through the bone tip (`snapArcToTip`). Used for lever-based machines.
- Constraints are enforced by `solveConstraintsAccommodating` — a gradient-descent optimizer with Armijo backtracking that finds the smallest perturbation of free bones to satisfy all active constraints.
- Cost function: planar = signed distance squared; arc = radial error squared + axial error squared.
- The solver handles 2-DOF (tangent-space), 1-DOF axis-locked, 1-DOF hinge, and twist DOFs.

**Force system (ForceConfig):**
- Fixed forces: manual direction vector + magnitude + bone + application point
- Cable forces: `pulley` field set -> direction auto-recalculates from attachment point toward pulley each frame. Renders as cyan dashed line + pulley dot.
- Forces do NOT require specific Newton values. The model assumes maximal effort (1RM). The absolute load is irrelevant — only the relative distribution across joints matters for muscle targeting.

**Joint torque distribution system (calculateTorqueDistribution):**
- For each force, walks the kinematic chain from the force's bone to the root, computing `torque = cross(momentArm, forceDir)` at each joint.
- Projects accumulated torque onto user-defined joint action axes (e.g., shoulder flexion = torque about X axis, IR/ER = torque about bone axis).
- More joint actions than DOFs is valid — projections are individually correct, just non-independent. E.g., shoulder has 4 actions (flex/ext, abd/add, horiz abd/add, IR/ER) for 3 DOFs.
- Computes effort = torque / capacity for each action, identifies limiting factor.
- Results displayed in the "Joint Analysis" tab as sorted percentage bars.
- AXIS SIGN MAPPING NEEDS EMPIRICAL CALIBRATION — the positive/negative action labels may be swapped for some joint actions. Test with a known pose + force.

**Joint actions defined:**
- Scapula: elevation/depression, protraction/retraction
- Shoulder: flexion/extension (X axis), abduction/adduction (Z axis), horizontal adduction/abduction (Y axis), internal/external rotation (bone axis)
- Elbow: flexion/extension
- Spine: flexion/extension, lateral flexion L/R, rotation L/R
- Hip: flexion/extension (X axis), abduction/adduction (Z axis), horizontal adduction/abduction (Y axis), internal/external rotation (bone axis)
- Knee: flexion/extension
- Ankle: plantar flexion/dorsi flexion

### Design Decisions (important for future work)

1. **No gravity in the model.** All forces are manually defined vectors on bones. A dumbbell press is just a downward force at the hands. A leg press is a force at the feet pushing in the correct direction.

2. **Fixed spine is intentional.** The spine stays fixed, meaning we assume core bracing. Spinal erector/ab demands will be calculated as static torque at the spine from external loads (inverse dynamics) without making the spine a free joint. Abs can contribute to spinal extension via bracing (co-contraction), and the brain optimization would decide the erector/ab recruitment ratio.

3. **No "equipment objects."** Exercises are built by posing the figure and adding constraints + forces to body parts. A barbell isn't an object — it's constraints on the hands. A cable machine is a point-tracking force.

4. **1RM / maximal effort assumption.** The resistance is always the maximal that can be overcome at the hardest point in the ROM. The system doesn't need to know absolute force capacities to determine muscle targeting — only the relative distribution matters.

5. **Joint action decomposition is axis-based, not movement-based.** "Flexion" = torque about the mediolateral (X) axis, regardless of arm position. "Horizontal adduction" at 90 deg abduction decomposes into flexion + adduction + potentially other components. Users can define as many named joint actions as they want (each with a rotation axis), and the torque projects onto all of them. This makes muscle activation data easier to define for familiar concepts like "horizontal adduction."

6. **Muscle capacity and recruitment are independently defined.** A muscle being shortened does NOT automatically mean it's biased less in recruitment — capacity reduction and recruitment ratio changes are separate inputs the user defines independently.

7. **Two-joint muscle effects are manual modifiers.** E.g., gastroc inhibition during knee-flexed plantarflexion is defined by: (a) lower plantarflexion capacity at that knee angle, and (b) lower gastroc recruitment ratio at that knee angle. Not derived from muscle mechanics.

## Roadmap (agreed priority order)

1. ~~Arc constraints~~ (DONE)
2. ~~Point-tracking cable forces~~ (DONE)
3. ~~Joint torque distribution — Phase A~~ (DONE) — per-joint torque decomposition into joint actions, effort bars UI. Axis signs need calibration.
4. **Joint torque distribution — Phase B** — constrained joint optimization (tandem problem). When constraints couple multiple joints, the force distribution is underdetermined. Solve via optimization: minimize total neural drive subject to producing the required endpoint force. The Jacobian (how each joint rotation affects endpoint) determines mechanical advantage. Capacity curves weight the cost. This is NOT just a moment-arm calculation.
5. **Static spine torque analysis** — calculate net moment at the spine from all external loads, translate to erector/ab demands with co-contraction optimization.
6. **Multi-position force curves** — torque distribution at each frame of the start-to-end animation, identifying the hardest position for each joint action.
7. **Muscle activation mapping** — combine joint torques with manually-defined strength curves and per-muscle recruitment ratios to produce per-muscle activation percentages. Includes two-joint muscle inhibition as separate modifiers.

## Key Technical Concepts

- **Joint-tandem problem:** In constrained exercises (smith machine bench, leg press, t-bar row), multiple joints share the endpoint force. The system is underdetermined — infinite valid distributions exist. Can involve 2+ joints (e.g., 3 joints in leg press: hip + knee + ankle). The optimization finds the distribution that minimizes total neural drive, accounting for mechanical advantage and capacity at each joint.

- **Jacobian:** Each joint's contribution to endpoint force, derived from the kinematic chain geometry. Determines mechanical advantage.

- **Muscle capacity curves:** Manually defined per joint action at each joint angle. Also affected by other joint angles (e.g., gastroc weaker when knee flexed). These are INPUTS the user defines, not derived from muscle mechanics.

- **Recruitment ratios:** Manually defined per joint action — which muscles contribute and in what proportion. Can vary by joint angle and by angles at other joints.

- **Two-joint muscle inhibition:** Muscles crossing two joints may be "turned off" when their antagonist function is loaded. Defined as a modifier on the capacity and/or recruitment ratio, not derived from length-tension curves.

- **DOF vs movement pattern distinction:** Constraints define the physical DOFs of an exercise (what CAN move). The movement pattern is what the body actually DOES given those DOFs plus the force optimization. E.g., a barbell constrains both hands to a rigid bar — the allowed lateral force production by triceps emerges from the constraint, not from a separate "movement pattern" definition.

- **Brain recruitment model (future):** The brain minimizes total effort, spreading load across joints. It considers: mechanical advantage (Jacobian), capacity at current angle, two-joint inhibition effects. The optimization is a constrained minimization: minimize sum of (torque_j / capacity_j)^2 subject to producing the required endpoint force.
