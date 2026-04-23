# Session Notes — 2026-04-22

Rolling log for the active work phase: testing whether Claude can author
gym-machine presets from general knowledge, and scaling that into a fitness-
app catalog.

---

## What we changed today

### Solver / biomechanics model

1. **Spine axial rotation** — `twists['pelvis']` (pelvisYaw) added as a
   solver-controllable DOF. User drags the spine's rotation slider, solver
   counter-rotates the pelvis+legs when upper-body constraints make it
   necessary. Influence chain widens to the whole skeleton when any pelvis
   DOF is free.

2. **Pelvis frame (`pelvisFrame`)** — a rigid-body frame that tilts with
   `spineDir` and yaws with `pelvisYaw`. Hip joint frames and the hip line
   (pelvis-pelvis-to-hip sockets) anchor to this frame. Consequences:
   - Tilting the spine backward now correctly increases hip **extension**
     in the joint-angle readout (femur direction stays in `rootFrame`,
     pelvis-local angle is computed through `pelvisFrame`).
   - The visual hip line swings with the spine tilt instead of staying
     horizontal in world.

3. **Cross-bone limit enforcement (`postureViolatesLimits`)** — spine
   drags that would push a hip angle past its limit now clamp at the
   boundary instead of silently letting the hip exceed its range. Hooked
   into every adaptive step-halving drag loop (scapula, hinge, IK-two-bone,
   intent-coord, rotation). A drag that started in a limit-violating pose
   is waived through so the user can still move.

4. **Hip limits raised** — extension 14.5° → **45°** (`Hip.dir.z.max`
   0.25 → 0.707), flexion continuous to **120°** (`Hip.dir.z.min` -0.9 →
   -1.0 removes a gap that previously blocked pure-sagittal flex between
   ~64° and ~116°). `Hip.dir.y.min = -0.5` remains the sole flex stop.

5. **Hamstring bell retuned for Hip.extension** — peak shifted -54° →
   -65°, steepness 0.5 → 2.5. Concentrates contribution in the 50-80°
   hip-flex range and fades it outside. glute-max and adductor-magnus-
   posterior narrowed for cleaner primary hand-offs. 1:1:1 peak ratio
   between the three primaries preserved; glute-med/glute-min secondary
   ratios unchanged.

6. **Pelvis translation DOFs (`pelvisTx`, `pelvisTy`, `pelvisTz`)** —
   solver can move the whole body in world space to satisfy distal
   constraints. Fixes the class of "feet pinned + knee flex = nothing
   moves" bugs where hip-to-ankle distance was fixed by the hardcoded
   pelvis origin. Used for squats, pull-ups, deadlifts, leg press,
   anywhere a closed chain needs the body to translate.

   Ranges: `POSITION_LIMITS.pelvisT{x,y,z} = ±100` world units. Torso is
   60 units tall, so this comfortably spans squat depth / hang range.

   Gradient is **L²-scaled** to match angular gradient magnitude (raw
   position gradient is ~1/L smaller than angular gradient per rad;
   without this, Armijo steps moved pelvis ~1/L as fast as bone angles
   and convergence exceeded MAX_ITERS=150). See the comment block in
   `solveConstraintsAccommodating` around `POS_GRAD_SCALE` for the
   derivation.

### Machine cataloging (stress-test phase)

7. **Decided on a per-machine data format** — Option A:
   - Per-machine JSON with **metadata + physics-only** (~1-2 KB each)
   - **No** output cache in the per-machine file
   - A build step runs the sim on every machine's physics and writes one
     consolidated output bundle the fitness app queries
   - When the biomodel changes, re-run the build — every machine's
     derived output refreshes automatically

   Rationale: physics is compact and authoritative; output is derived
   and regenerable. Storing outputs per-file creates stale-data risk on
   every biomodel change, and file-size arguments are reversed — the
   physics section is actually smaller than a full output time-series.

   See the back-and-forth in today's conversation before implementation
   begins — schema is **draft** until 3-5 real machine entries have
   stress-tested it.

8. **First machine preset: HAMMER STRENGTH ISO-LATERAL CHEST PRESS** —
   authored from general machine knowledge (no photo), added to the
   existing `EXERCISE_PRESETS` array for UI testing. Needs verification.

---

## Current testing state

### What's being tested right now

The Hammer Strength preset is the first data point on this question:
**can Claude author a gym-machine preset from memory that produces a
physically plausible simulation with reasonable muscle activation?**

If yes → we scale. If no → we figure out what authoring aids or
validation steps need to exist first.

### How to continue testing on another device

1. Pull this branch (`claude/stupefied-poitras-ed6206`).
2. Open the sim in dev mode.
3. From the preset dropdown, load **HAMMER STRENGTH ISO-LATERAL CHEST PRESS**.
4. Step through the checklist below and report observations.

### Verification checklist for HS chest press

**Functional (does it load cleanly?)**
- [ ] Loads without console errors
- [ ] Starting posture looks like a seated chest press (elbows bent back,
      hands at chest, torso upright, legs in seated position)
- [ ] End posture looks like arms extended forward
- [ ] Timeline playback sweeps arms forward smoothly (no jitter, no
      solver hard-stop)

**Content (does it match the exercise?)**
- [ ] Timeline Peaks / Muscle view: chest-sternal appears in **primary**
- [ ] Triceps appears in primary or top of secondary
- [ ] Anterior deltoid in secondary/tertiary
- [ ] No legs firing meaningfully (<10% activation)
- [ ] Difficulty profile peaks near mid-ROM (matches the slightly peaked
      force profile)

**Feel (does it resemble the real machine?)**
- [ ] Resistance profile shape matches your memory of the machine
- [ ] Primary-muscle ratios look roughly right
- [ ] Difficulty at lockout is lower than mid-ROM (peaked profile intent)

### Things to specifically report back

Author is least confident about these and would like feedback:

| What | Current value | Questions |
|---|---|---|
| Starting hand world-Z | -42 | Too far forward? Too close to body? |
| Profile peak | 1.05× at t=0.5 | Right shape? Too subtle? Too much? |
| Starting elbow flex | ~95° | Correct for "at chest" position? |
| Shoulder abduction | ~20° | Wide enough for typical grip? |
| Leg pose noise | Seated bent, fixed | Is any leg muscle showing activation? |

### If something's broken

- **Preset fails to load**: check the browser console for errors,
  paste into a note so author can diagnose.
- **Posture looks wrong but preset loads**: adjust it in the UI, then
  use the scene-export console command (same one that originally
  captured `bb_bench_press` — search for `window.__scene`). Author can
  diff the corrected scene against the current preset and see where
  intuition was off.
- **Muscle activation looks off**: note which muscle, which ROM fraction,
  and what % it's showing. Author can inspect the torque chain and
  figure out whether it's a pose/profile/bell issue.

---

## Next up (pending HS chest press verification)

Once the chest press is validated (or fixed), write the remaining three
stress-test presets — each chosen to exercise a different mechanism class:

1. **Seated cable row (low pulley)** — tests cable force with `pulley`
   tracking + feet-pinned closed chain (stress-tests pelvis translation
   DOFs in practice). Pull-pattern muscle profile.

2. **45° leg press** — tests planar-sled constraint (feet on plate that
   translates along a fixed rail). Tests pelvis translation for squat-
   pattern body motion.

3. **Pec deck (fly)** — tests bell-shaped resistance profile (peaks mid-
   ROM, not lockout). Bilateral arc constraint on forearms.

After those four are in and verified, we have enough data to finalize
the schema for Option A and start building the loader / writer / batch
regenerator tools.

---

## Design decisions (for the record)

### Pelvis position is a 3-DOF solver variable
Not a fixed origin. Only moves when constraints force it. Unlocked by
default; can be locked per-scene if a preset needs the pelvis pinned
(BB bench press uses spine-fixed constraints which effectively pin
pelvis indirectly — works fine).

### Hip angles are measured in pelvis frame, not world frame
Consequence: any code reading stored femur direction must go through
`getActionAngle` or `getDimensionValue` which apply the
`rootFrame → world → pelvisFrame` transform. Direct `posture['lFemur']`
reads give world-frame components, which are wrong for hip-limit and
capacity-curve purposes when the spine is tilted.

### No hardcoded output caching per machine
Schema Option A: physics files only. A build step runs the sim and emits
one bundle. Keeps machine files lean and refreshes automatically when
the biomodel changes.

---

## Open questions / known limitations

- **Coordinate-system authoring is error-prone**: Y-down + rootFrame vs
  pelvisFrame + parent-local bone directions make mental math tricky.
  Claude's first-pass posture coordinates for new machines will likely
  need user corrections. A "snap to posture the user made" helper would
  improve authoring speed.

- **Hammer chest press arc is approximated as two planar constraints**
  (linear handle path). Real arc curvature over ~20° ROM is shallow
  enough that this is within a couple degrees, but if the approximation
  produces wrong muscle ratios, we'll need to use actual arc constraints
  for the next machines.

- **No validation tool yet**: we rely on the user loading presets and
  eyeballing the simulation. Building a headless test runner that loads
  each preset + checks "no console errors" + "primary muscles match a
  claimed list" would catch regressions faster than manual review.

- **The fitness app build-step bundle is still vapor**: designed but
  not implemented. EXERCISE_PRESETS array is the current testing venue
  until the external machine-file + bundle pipeline is built.
