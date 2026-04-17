
import React, { useState, useRef, useMemo } from 'react';

// A normalized vector representing the direction a bone points relative to its parent
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type Posture = Record<string, Vector3>;

export interface VisualForce {
  id: string;
  boneId: string;
  position: number; // 0 (Start) to 1 (End) of the bone
  vector: Vector3;
  color?: string;
  pulley?: Vector3; // If set, draw a pulley point and cable line
}

export interface VisualPlane {
  id: string;
  center: Vector3;
  normal: Vector3;
  size: number;
  color?: string;
  boneId?: string;
  // Arc constraint fields
  type?: 'planar' | 'arc';
  pivot?: Vector3;
  axis?: Vector3;
  radius?: number;
}

interface BioManProps {
  posture: Posture;
  twists?: Record<string, number>;
  externalForces?: VisualForce[];
  reactionForces?: VisualForce[];
  planes?: VisualPlane[];
  selectedBone: string | null;
  onSelectBone: (boneId: string) => void;
  targetPos?: Vector3 | null;
  targetReferenceBone?: string | null; // NEW: If set, targetPos is relative to this bone's start
}

// Coordinate Frame (Right, Direction/Y, Back/Z)
interface Frame {
    x: Vector3; // Right
    y: Vector3; // Direction (Bone Axis)
    z: Vector3; // Back
}

// Drawables can be lines (bones) or circles (joints/control points)
type Drawable = 
  | { type: 'line'; id: string; z: number; props: React.SVGProps<SVGLineElement> }
  | { type: 'circle'; id: string; z: number; props: React.SVGProps<SVGCircleElement> }
  | { type: 'rect'; id: string; z: number; props: React.SVGProps<SVGRectElement> }
  | { type: 'path'; id: string; z: number; props: React.SVGProps<SVGPathElement> };

const normalize = (v: Vector3): Vector3 => {
    const len = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    return len > 0.00001 ? {x: v.x/len, y: v.y/len, z: v.z/len} : {x:0, y:0, z:0};
};

const sub = (a: Vector3, b: Vector3) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vector3, b: Vector3) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (v: Vector3, s: number) => ({ x: v.x * s, y: v.y * s, z: v.z * s });

const crossProduct = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});

const dotProduct = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;

// Helper: Rotate vector v around axis k by angleDeg degrees (Rodrigues' rotation formula)
const rotateAroundAxis = (v: Vector3, axis: Vector3, angleDeg: number): Vector3 => {
  if (Math.abs(angleDeg) < 0.001) return v;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  // Ensure axis is normalized
  const k = normalize(axis);

  // v_rot = v*cos + (k x v)*sin + k*(k.v)*(1-cos)
  const kDotV = k.x*v.x + k.y*v.y + k.z*v.z;
  const kxV = {
      x: k.y*v.z - k.z*v.y,
      y: k.z*v.x - k.x*v.z,
      z: k.x*v.y - k.y*v.x
  };
  const oneMinusCos = 1 - cos;
  
  return {
      x: v.x*cos + kxV.x*sin + k.x*kDotV*oneMinusCos,
      y: v.y*cos + kxV.y*sin + k.y*kDotV*oneMinusCos,
      z: v.z*cos + kxV.z*sin + k.z*kDotV*oneMinusCos
  };
};

// Helper: Shortest Arc Rotation Quaternion/Matrix application
const applyShortestArcRotation = (src: Vector3, dst: Vector3, toRotate: Vector3): Vector3 => {
    const s = normalize(src);
    const d = normalize(dst);
    
    const dot = s.x*d.x + s.y*d.y + s.z*d.z;
    
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

const BioMan = React.memo(({ posture, twists, externalForces, reactionForces, planes, selectedBone, onSelectBone, targetPos, targetReferenceBone }: BioManProps) => {
  // --- CONFIGURATION ---
  const CONFIG = {
    TORSO_LEN: 60,
    HUMERUS_LEN: 44,
    FOREARM_LEN: 39,
    FEMUR_LEN: 54,
    TIBIA_LEN: 49,
    FOOT_LEN: 20
  };

  // --- CAMERA STATE ---
  const [camera, setCamera] = useState({ pitch: -10, yaw: 210 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // --- MATH HELPERS ---
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const rotateX = (p: Vector3, angle: number): Vector3 => {
    const rad = toRad(angle);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: p.x, y: p.y * cos - p.z * sin, z: p.y * sin + p.z * cos };
  };

  const rotateY = (p: Vector3, angle: number): Vector3 => {
    const rad = toRad(angle);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: p.x * cos + p.z * sin, y: p.y, z: -p.x * sin + p.z * cos };
  };

  const applyCamera = (p: Vector3): Vector3 => {
    let tp = rotateY(p, camera.yaw);
    tp = rotateX(tp, camera.pitch);
    return tp;
  };

  const project = (p: Vector3) => {
    const scale = 2.8; 
    return {
      x: 400 + p.x * scale,
      y: 370 + p.y * scale 
    };
  };

  /**
   * FRAME SYSTEM FOR KINEMATIC CHAIN
   */
  const createRootFrame = (dir: Vector3): Frame => {
      const u = normalize(dir);
      const neutralUp = { x: 0, y: 1, z: 0 };
      const neutralRight = { x: 1, y: 0, z: 0 };
      const neutralBack = { x: 0, y: 0, z: 1 };
      
      const right = applyShortestArcRotation(neutralUp, u, neutralRight);
      const back = applyShortestArcRotation(neutralUp, u, neutralBack);
      return { x: right, y: u, z: back };
  };

  // Checkpoint-based frame for humerus/femur — must match BioModelPage.tsx
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
      if (u.y < 0) {
          const hSq = u.x * u.x + u.z * u.z;
          if (hSq > 1e-8) {
              const excess = Math.acos(Math.max(-1, Math.min(1, u.y))) - Math.PI / 2;
              const t = Math.min(excess / (Math.PI / 2), 1);
              const ramp = t * t * (3 - 2 * t);
              const signedCoronal = u.x * Math.abs(u.x) / hSq;
              frame = twistFrame(frame, ramp * -180 * signedCoronal);
          }
      }
      return frame;
  };

  const twistFrame = (frame: Frame, angleDeg: number): Frame => {
      if (!angleDeg || angleDeg === 0) return frame;
      return {
          x: rotateAroundAxis(frame.x, frame.y, angleDeg),
          y: frame.y,
          z: rotateAroundAxis(frame.z, frame.y, angleDeg)
      };
  };

  const localToWorld = (parentFrame: Frame, localVec: Vector3): Vector3 => {
      return {
          x: localVec.x * parentFrame.x.x + localVec.y * parentFrame.y.x + localVec.z * parentFrame.z.x,
          y: localVec.x * parentFrame.x.y + localVec.y * parentFrame.y.y + localVec.z * parentFrame.z.y,
          z: localVec.x * parentFrame.x.z + localVec.y * parentFrame.y.z + localVec.z * parentFrame.z.z
      };
  };

  const transportFrame = (prevFrame: Frame, newDir: Vector3): Frame => {
      const u = normalize(newDir);
      const newRight = applyShortestArcRotation(prevFrame.y, u, prevFrame.x);
      const newBack = applyShortestArcRotation(prevFrame.y, u, prevFrame.z);
      return { x: newRight, y: u, z: newBack };
  };

  const getEndPos = (start: Vector3, dir: Vector3, len: number) => ({
        x: start.x + (dir.x * len),
        y: start.y + (dir.y * len),
        z: start.z + (dir.z * len)
    });

  // --- SKELETON BUILDER ---
  const drawables = useMemo(() => {
    const items: Drawable[] = [];
    const boneSegments: Record<string, { start: Vector3; end: Vector3 }> = {};

    const addLine = (id: string, start: Vector3, end: Vector3, width = 11) => {
      boneSegments[id] = { start, end };
      const camStart = applyCamera(start);
      const camEnd = applyCamera(end);
      const p1 = project(camStart);
      const p2 = project(camEnd);
      
      const avgZ = (camStart.z + camEnd.z) / 2;
      const minZ = -150;
      const maxZ = 150;
      const t = Math.max(0, Math.min(1, (avgZ - minZ) / (maxZ - minZ)));
      
      // Depth shading
      const lightness = 10 + (t * 40); 
      
      const isPostured = Object.prototype.hasOwnProperty.call(posture, id);
      const isSelectable = isPostured || id === 'spine';
      const isSelected = selectedBone === id;
      const color = isSelected ? '#4f46e5' : `hsl(0, 0%, ${lightness}%)`;

      items.push({
        type: 'line',
        id,
        z: avgZ,
        props: {
          x1: p1.x, y1: p1.y, 
          x2: p2.x, y2: p2.y,
          stroke: color,
          strokeWidth: width,
          strokeLinecap: 'round',
          cursor: isSelectable ? 'pointer' : 'default',
          'data-bone-id': id,
          onPointerDown: isSelectable ? (e) => {
            e.stopPropagation();
            onSelectBone(id);
          } : undefined
        }
      });
      
      if (isSelected && !targetPos && id !== 'spine') {
         items.push({
            type: 'circle',
            id: `${id}-end`,
            z: camEnd.z + 1,
            props: {
                cx: p2.x, cy: p2.y,
                r: 8,
                fill: '#ef4444',
                stroke: 'white',
                strokeWidth: 2,
                pointerEvents: 'none'
            }
         });
      }
    };

    const drawArrow = (id: string, origin: Vector3, vec: Vector3, color: string, zOffset: number) => {
        // Fix for TypeError: Check if vec exists and check magnitude
        if (!vec || (Math.abs(vec.x) < 0.001 && Math.abs(vec.y) < 0.001 && Math.abs(vec.z) < 0.001)) return;
        
        const end = { x: origin.x + vec.x, y: origin.y + vec.y, z: origin.z + vec.z };
        const camStart = applyCamera(origin);
        const camEnd = applyCamera(end);
        const p1 = project(camStart);
        const p2 = project(camEnd);
        const dist = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
        if (dist < 2) return; 

        items.push({
            type: 'line',
            id: `${id}-shaft`,
            z: camEnd.z + zOffset,
            props: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: color, strokeWidth: 4 }
        });

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const angle = Math.atan2(dy, dx);
        const headLen = 14; 
        const headAngle = Math.PI / 6; 
        const x3 = p2.x - headLen * Math.cos(angle - headAngle);
        const y3 = p2.y - headLen * Math.sin(angle - headAngle);
        const x4 = p2.x - headLen * Math.cos(angle + headAngle);
        const y4 = p2.y - headLen * Math.sin(angle + headAngle);
        const pathData = `M ${p2.x} ${p2.y} L ${x3} ${y3} L ${x4} ${y4} Z`;

        items.push({
            type: 'path',
            id: `${id}-head`,
            z: camEnd.z + zOffset + 1,
            props: { d: pathData, fill: color, stroke: 'none' }
        });
    };

    const getPointOnBone = (boneId: string, ratio: number): Vector3 | null => {
        const seg = boneSegments[boneId];
        if (!seg) return null;
        return {
            x: seg.start.x + (seg.end.x - seg.start.x) * ratio,
            y: seg.start.y + (seg.end.y - seg.start.y) * ratio,
            z: seg.start.z + (seg.end.z - seg.start.z) * ratio
        };
    };

    // --- KINEMATICS GENERATION ---
    const neckBase = { x: 0, y: -CONFIG.TORSO_LEN / 2, z: 0 };
    const pelvisBase = { x: 0, y: CONFIG.TORSO_LEN / 2, z: 0 };
    addLine('spine', neckBase, pelvisBase, 12);

    const lHipBase = { x: -20, y: pelvisBase.y, z: 0 };
    const rHipBase = { x: 20, y: pelvisBase.y, z: 0 };
    addLine('lPelvis', pelvisBase, lHipBase, 8);
    addLine('rPelvis', pelvisBase, rHipBase, 8);

    const buildLimb = (name: string, childName: string, grandChildName: string, startPos: Vector3, parentFrame: Frame, len1: number, len2: number, len3: number) => {
        const dir1Local = posture[name];
        const dir1World = localToWorld(parentFrame, dir1Local);
        
        let frame1Base: Frame;
        
        if (name.includes('Humerus')) {
            frame1Base = createAbsoluteFrame(dir1World, true);
        } else if (name.includes('Femur')) {
            frame1Base = createAbsoluteFrame(dir1World, false);
        } else {
            frame1Base = transportFrame(parentFrame, dir1World);
        }

        const frame1Twisted = twistFrame(frame1Base, twists?.[name] || 0);
        const end1 = getEndPos(startPos, frame1Twisted.y, len1);
        addLine(name, startPos, end1);

        let frame2Twisted = frame1Twisted;
        let end2 = end1;

        if (childName && posture[childName]) {
            const dir2Local = posture[childName];
            const dir2World = localToWorld(frame1Twisted, dir2Local);
            const frame2Base = transportFrame(frame1Twisted, dir2World);
            frame2Twisted = twistFrame(frame2Base, twists?.[childName] || 0);
            end2 = getEndPos(end1, frame2Twisted.y, len2);
            addLine(childName, end1, end2);
        }

        let frame3Twisted = frame2Twisted;

        if (grandChildName && posture[grandChildName]) {
            const dir3Local = posture[grandChildName];
            const dir3World = localToWorld(frame2Twisted, dir3Local);
            const frame3Base = transportFrame(frame2Twisted, dir3World);
            frame3Twisted = twistFrame(frame3Base, twists?.[grandChildName] || 0);
            const end3 = getEndPos(end2, frame3Twisted.y, len3);
            addLine(grandChildName, end2, end3);
        }
        return { frame1: frame1Twisted, frame2: frame2Twisted, frame3: frame3Twisted, end1, end2 };
    };

    const rootFrame = createRootFrame({x:0, y:1, z:0});

    // Dynamic Clavicles
    const lClavOffset = posture['lClavicle'] || { x: -25, y: 0, z: 0 };
    const rClavOffset = posture['rClavicle'] || { x: 25, y: 0, z: 0 };

    const lShoulderPos = { x: neckBase.x + lClavOffset.x, y: neckBase.y + lClavOffset.y, z: neckBase.z + lClavOffset.z };
    const rShoulderPos = { x: neckBase.x + rClavOffset.x, y: neckBase.y + rClavOffset.y, z: neckBase.z + rClavOffset.z };

    addLine('lClavicle', neckBase, lShoulderPos);
    addLine('rClavicle', neckBase, rShoulderPos);

    // Dynamic Limbs
    const lArm = buildLimb('lHumerus', 'lForearm', '', lShoulderPos, rootFrame, CONFIG.HUMERUS_LEN, CONFIG.FOREARM_LEN, 0);
    const rArm = buildLimb('rHumerus', 'rForearm', '', rShoulderPos, rootFrame, CONFIG.HUMERUS_LEN, CONFIG.FOREARM_LEN, 0);
    const lLeg = buildLimb('lFemur', 'lTibia', 'lFoot', lHipBase, rootFrame, CONFIG.FEMUR_LEN, CONFIG.TIBIA_LEN, CONFIG.FOOT_LEN);
    const rLeg = buildLimb('rFemur', 'rTibia', 'rFoot', rHipBase, rootFrame, CONFIG.FEMUR_LEN, CONFIG.TIBIA_LEN, CONFIG.FOOT_LEN);

    // --- OVERLAYS ---
    if (externalForces) {
        externalForces.forEach((f, idx) => {
            const pos = getPointOnBone(f.boneId, f.position);
            if (pos) {
                drawArrow(f.id, pos, f.vector, f.color || '#ef4444', 10 + idx);
                if (f.pulley) {
                    // Draw cable line from attachment to pulley
                    const camAttach = applyCamera(pos);
                    const camPulley = applyCamera(f.pulley);
                    const pA = project(camAttach);
                    const pP = project(camPulley);
                    items.push({
                        type: 'line',
                        id: `${f.id}-cable`,
                        z: (camAttach.z + camPulley.z) / 2 - 1,
                        props: {
                            x1: pA.x, y1: pA.y, x2: pP.x, y2: pP.y,
                            stroke: '#06b6d4', strokeWidth: 2,
                            strokeDasharray: '6 3', opacity: 0.6,
                            style: { pointerEvents: 'none' }
                        }
                    });
                    // Draw pulley dot
                    items.push({
                        type: 'circle',
                        id: `${f.id}-pulley`,
                        z: camPulley.z + 1,
                        props: {
                            cx: pP.x, cy: pP.y, r: 6,
                            fill: '#06b6d4', stroke: 'white', strokeWidth: 2,
                            style: { pointerEvents: 'none' }
                        }
                    });
                }
            }
        });
    }
    
    if (planes) {
        planes.forEach(plane => {
            const camCenter = applyCamera(plane.center);
            const isSelected = plane.boneId === selectedBone;
            const opacity = isSelected ? 0.25 : 0.05;
            const strokeOpacity = isSelected ? 0.6 : 0.15;

            if (plane.type === 'arc' && plane.pivot && plane.axis && plane.radius) {
                // Render arc as a circle of line segments
                const axisN = normalize(plane.axis);
                let tang: Vector3 = { x: 1, y: 0, z: 0 };
                if (Math.abs(dotProduct(axisN, tang)) > 0.9) tang = { x: 0, y: 1, z: 0 };
                const bitang = normalize(crossProduct(axisN, tang));
                tang = normalize(crossProduct(bitang, axisN));
                const SEGS = 48;
                const pts: { x: number; y: number }[] = [];
                for (let i = 0; i <= SEGS; i++) {
                    const angle = (i / SEGS) * Math.PI * 2;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const worldPt = add(plane.pivot, add(mul(tang, cos * plane.radius), mul(bitang, sin * plane.radius)));
                    pts.push(project(applyCamera(worldPt)));
                }
                const dPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
                items.push({
                    type: 'path',
                    id: plane.id,
                    z: camCenter.z - 50,
                    props: {
                        d: dPath,
                        fill: 'none',
                        stroke: plane.color ? plane.color.replace(/[\d.]+\)$/, `${strokeOpacity})`) : `rgba(245, 158, 11, ${strokeOpacity})`,
                        strokeWidth: isSelected ? 2.5 : 1.5,
                        style: { pointerEvents: 'none' }
                    }
                });
                // Draw pivot dot
                const pivotProj = project(applyCamera(plane.pivot));
                items.push({
                    type: 'circle',
                    id: `${plane.id}-pivot`,
                    z: camCenter.z - 49,
                    props: {
                        cx: pivotProj.x, cy: pivotProj.y, r: 4,
                        fill: `rgba(245, 158, 11, ${isSelected ? 0.8 : 0.3})`,
                        stroke: 'none',
                        style: { pointerEvents: 'none' }
                    }
                });
            } else {
                // Planar constraint: render as square
                let tangent: Vector3 = { x: 1, y: 0, z: 0 };
                if (Math.abs(dotProduct(plane.normal, tangent)) > 0.9) tangent = { x: 0, y: 1, z: 0 };
                const bitangent = normalize(crossProduct(plane.normal, tangent));
                tangent = normalize(crossProduct(bitangent, plane.normal));
                const halfSize = plane.size / 2;
                const p1 = add(add(plane.center, mul(tangent, halfSize)), mul(bitangent, halfSize));
                const p2 = add(sub(plane.center, mul(tangent, halfSize)), mul(bitangent, halfSize));
                const p3 = sub(sub(plane.center, mul(tangent, halfSize)), mul(bitangent, halfSize));
                const p4 = sub(add(plane.center, mul(tangent, halfSize)), mul(bitangent, halfSize));
                const proj1 = project(applyCamera(p1));
                const proj2 = project(applyCamera(p2));
                const proj3 = project(applyCamera(p3));
                const proj4 = project(applyCamera(p4));
                const dPath = `M ${proj1.x} ${proj1.y} L ${proj2.x} ${proj2.y} L ${proj3.x} ${proj3.y} L ${proj4.x} ${proj4.y} Z`;
                items.push({
                    type: 'path',
                    id: plane.id,
                    z: camCenter.z - 50,
                    props: {
                        d: dPath,
                        fill: plane.color ? plane.color.replace(/[\d.]+\)$/, `${opacity})`) : `rgba(139, 92, 246, ${opacity})`,
                        stroke: plane.color ? plane.color.replace(/[\d.]+\)$/, `${strokeOpacity})`) : `rgba(139, 92, 246, ${strokeOpacity})`,
                        strokeWidth: 1.5,
                        style: { pointerEvents: 'none' }
                    }
                });
            }
        });
    }

    if (reactionForces) {
        reactionForces.forEach((f, idx) => {
            const pos = getPointOnBone(f.boneId, f.position);
            if (pos) drawArrow(f.id, pos, f.vector, f.color || '#10b981', 20 + idx);
        });
    }

    const addControls = (id: string, parentFrame: Frame) => {
        if (selectedBone !== id || !targetPos) return;
        const seg = boneSegments[id];
        if (!seg) return;
        let worldTarget = { x: 0, y: 0, z: 0 };
        if (targetReferenceBone) {
            const refSeg = boneSegments[targetReferenceBone];
            if (refSeg) {
                worldTarget = {
                    x: refSeg.start.x + targetPos.x,
                    y: refSeg.start.y + targetPos.y,
                    z: refSeg.start.z + targetPos.z
                };
            }
        } else {
            if (id === 'lClavicle' || id === 'rClavicle') {
                 worldTarget = {
                    x: seg.start.x + targetPos.x,
                    y: seg.start.y + targetPos.y,
                    z: seg.start.z + targetPos.z
                 };
            } else {
                const worldOffsetRaw = localToWorld(parentFrame, targetPos);
                worldTarget = {
                    x: seg.start.x + worldOffsetRaw.x,
                    y: seg.start.y + worldOffsetRaw.y,
                    z: seg.start.z + worldOffsetRaw.z
                };
            }
        }
        const camEnd = applyCamera(seg.end);
        const camTarget = applyCamera(worldTarget);
        const pEnd = project(camEnd);
        const pTarget = project(camTarget);
        items.push({
            type: 'line',
            id: `${id}-connector`,
            z: camTarget.z + 0.5,
            props: { x1: pEnd.x, y1: pEnd.y, x2: pTarget.x, y2: pTarget.y, stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '4 4', opacity: 0.6, pointerEvents: 'none' }
        });
        items.push({
            type: 'circle',
            id: `${id}-target`,
            z: camTarget.z + 1,
            props: { cx: pTarget.x, cy: pTarget.y, r: 8, fill: '#ef4444', stroke: 'white', strokeWidth: 2, pointerEvents: 'none' }
        });
    };

    if (lLeg.frame1 && selectedBone === 'lFemur') addControls('lFemur', rootFrame);
    if (lLeg.frame1 && selectedBone === 'lTibia') addControls('lTibia', lLeg.frame1);
    if (lLeg.frame2 && selectedBone === 'lFoot') addControls('lFoot', lLeg.frame2);
    if (rLeg.frame1 && selectedBone === 'rFemur') addControls('rFemur', rootFrame);
    if (rLeg.frame1 && selectedBone === 'rTibia') addControls('rTibia', rLeg.frame1);
    if (rLeg.frame2 && selectedBone === 'rFoot') addControls('rFoot', rLeg.frame2);
    if (selectedBone === 'lClavicle') addControls('lClavicle', rootFrame);
    if (selectedBone === 'rClavicle') addControls('rClavicle', rootFrame);
    if (lArm.frame1 && selectedBone === 'lHumerus') addControls('lHumerus', rootFrame);
    if (lArm.frame1 && selectedBone === 'lForearm') addControls('lForearm', lArm.frame1);
    if (rArm.frame1 && selectedBone === 'rHumerus') addControls('rHumerus', rootFrame);
    if (rArm.frame1 && selectedBone === 'rForearm') addControls('rForearm', rArm.frame1);

    return items.sort((a, b) => {
        if (Math.abs(a.z - b.z) < 0.001) return a.id.localeCompare(b.id);
        return a.z - b.z;
    });

  }, [posture, twists, externalForces, reactionForces, planes, camera, selectedBone, targetPos, targetReferenceBone]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setCamera(prev => ({
      pitch: Math.max(-90, Math.min(90, prev.pitch - dy * 0.5)), 
      yaw: prev.yaw + dx * 0.5 
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => { isDragging.current = false; };

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden touch-none select-none">
       <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <svg viewBox="0 0 800 800" className="w-full h-full cursor-move z-10" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} style={{ shapeRendering: 'auto' }}>
        <style>{`
          svg * {
            transition: none !important;
          }
        `}</style>
        {drawables.map((d) => {
            if (d.type === 'line') return <line key={d.id} {...(d.props as React.SVGProps<SVGLineElement>)} />;
            if (d.type === 'circle') return <circle key={d.id} {...(d.props as React.SVGProps<SVGCircleElement>)} />;
            if (d.type === 'path') return <path key={d.id} {...(d.props as React.SVGProps<SVGPathElement>)} />;
            if (d.type === 'rect') return <rect key={d.id} {...(d.props as React.SVGProps<SVGRectElement>)} />;
            return null;
        })}
      </svg>
    </div>
  );
});

export default BioMan;
