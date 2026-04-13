## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

## Project Vision

GymMap2 is a universal exercise physics engine. The goal is to recreate the physics environment of any strength training exercise (machines, free weights, cables) so that the actual muscle targeting can be derived from physics rather than generic labels like "press = chest and triceps."

Pipeline: build exercise geometry -> compute joint force distribution -> derive muscle activation

## Architecture Decisions

### Biomechanics Model (pages/BioModelPage.tsx + components/BioMan.tsx)

**Coordinate system:** Y is down. Torso is fixed at origin. Bones store unit direction vectors in parent-local coordinates (except clavicles which are offset vectors).

**Frame system:** Each joint has an orthonormal frame {x, y, z} where y = bone axis, x = hinge axis, z = flexion direction. Humerus/Femur use `createAbsoluteFrame` (swing-twist from {0,1,0} + above-horizontal coronal correction). Child bones use `transportFrame` (parallel transport).

**IR/ER rotation:** Swing-twist decomposition with a smooth correction for above-horizontal coronal-plane motion. The correction smoothly twists from 0 deg at the horizon to 180 deg at overhead, modulated by how "coronal" the arm direction is. This prevents the forearm from snapping at the antiparallel singularity during coronal abduction past 90 deg.

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
- Forces will NOT require specific Newton values in the final system. The model assumes maximal effort (1RM). The absolute load is irrelevant — only the relative distribution across joints matters for muscle targeting.

### Design Decisions (important for future work)

1. **No gravity in the model.** All forces are manually defined vectors on bones. A dumbbell press is just a downward force at the hands. A leg press is a force at the feet.

2. **Fixed spine is intentional.** The spine stays fixed, meaning we assume core bracing. Spinal erector/ab demands will be calculated as static torque at the spine from external loads (inverse dynamics) without making the spine a free joint. This avoids massive complexity while still capturing core muscle demands.

3. **No "equipment objects."** Exercises are built by posing the figure and adding constraints + forces to body parts. A barbell isn't an object — it's constraints on the hands. A cable machine is a point-tracking force.

4. **1RM / maximal effort assumption.** The system doesn't need to know absolute force capacities to determine muscle targeting. At maximal effort, the relative distribution is what matters.

## Roadmap (agreed priority order)

1. ~~Arc constraints~~ (DONE)
2. ~~Point-tracking cable forces~~ (DONE)
3. **Joint torque distribution** — the coupled-joint optimization. For exercises where multiple joints are mechanically linked (e.g., bench press: shoulder + elbow), compute the effort-minimizing force distribution across all joints in the chain. This is NOT a simple moment-arm calculation — it's a constrained optimization because coupled joints have interchangeable forces. The brain minimizes total effort, taking into account mechanical advantage at each joint.
4. **Static spine torque analysis** — calculate net moment at the spine from all external loads, translate to erector/ab demands with co-contraction optimization.
5. **Multi-position force curves** — torque distribution at each frame of the start-to-end animation.
6. **Muscle activation mapping** — combine joint torques with manually-defined strength curves and per-muscle recruitment ratios to produce per-muscle activation percentages. Includes two-joint muscle inhibition (e.g., gastroc turned off in plantarflexion when knee is flexed) as separate manually-defined modifiers on capacity and recruitment ratios.

## Key Technical Concepts for Joint Torque System

- **Joint-tandem problem:** In constrained exercises, multiple joints share the endpoint force. The system is underdetermined — infinite valid distributions exist. The optimization finds the one that minimizes total neural drive.
- **Jacobian:** Each joint's contribution to endpoint force, derived from the kinematic chain geometry. Determines mechanical advantage.
- **Muscle capacity curves:** Manually defined per joint action at each joint angle. Also affected by other joint angles (e.g., gastroc weaker when knee flexed). These are INPUTS the user defines, not derived from muscle mechanics.
- **Recruitment ratios:** Manually defined per joint action — which muscles contribute and in what proportion. Can vary by joint angle and by angles at other joints. A shortened muscle being weaker does NOT automatically mean it's biased less in recruitment — these are independent variables.
- **Two-joint muscle inhibition:** Muscles crossing two joints may be "turned off" when their antagonist function is loaded. This is defined as a modifier on the capacity and/or recruitment ratio, not derived from length-tension curves.
