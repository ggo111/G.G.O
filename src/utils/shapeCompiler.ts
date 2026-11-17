import type { DrawnBlueprint, Point2D, ShapeStats } from '../types/game.ts';

export const MAX_INK_LENGTH = 3.2; // Total normalized stroke length allowed per round

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function perpendicularDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return dist(p, a);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + clamped * dx, y: a.y + clamped * dy });
}

export function simplifyStrokeRDP(points: Point2D[], epsilon = 0.018): Point2D[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = simplifyStrokeRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyStrokeRDP(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[end]];
}

export function measureStrokesLength(strokes: Point2D[][]): number {
  let total = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      total += dist(stroke[i - 1], stroke[i]);
    }
  }
  return total;
}

/**
 * Builds a thickened capsule quad between two points for reliable Matter.js compound parts.
 */
function buildSegmentQuad(a: Point2D, b: Point2D, halfThickness: number): Point2D[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 0.001;
  const nx = (-dy / len) * halfThickness;
  const ny = (dx / len) * halfThickness;
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ];
}

/**
 * Converts player strokes (normalized 0..1) into a physics-ready DrawnBlueprint
 * with derived mass, friction, restitution, speed, and spike damage stats.
 */
export function compileDrawnBlueprint(rawStrokes: Point2D[][]): DrawnBlueprint {
  const validStrokes = rawStrokes
    .map((s) => s.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
    .filter((s) => s.length >= 2);

  if (validStrokes.length === 0) {
    return compileDrawnBlueprint(getPresetStrokes('wheel'));
  }

  const simplified = validStrokes.map((s) => simplifyStrokeRDP(s, 0.02));
  const allPts = simplified.flat();

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  let sumX = 0;
  let sumY = 0;
  for (const p of allPts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    sumX += p.x;
    sumY += p.y;
  }

  const centroid: Point2D = {
    x: sumX / allPts.length,
    y: sumY / allPts.length,
  };

  const width = Math.max(0.18, maxX - minX);
  const height = Math.max(0.16, maxY - minY);
  const rawLength = measureStrokesLength(validStrokes);
  const inkUsed = Math.min(100, Math.round((rawLength / MAX_INK_LENGTH) * 100));

  // Detect sharp corners (spikes!) and smooth curved segments (wheel/ski factor)
  const spikeTips: Point2D[] = [];
  let sharpCorners = 0;
  let smoothAngles = 0;
  let bottomCurvatureCount = 0;

  for (const stroke of simplified) {
    for (let i = 1; i < stroke.length - 1; i++) {
      const prev = stroke[i - 1];
      const curr = stroke[i];
      const next = stroke[i + 1];
      const v1x = prev.x - curr.x;
      const v1y = prev.y - curr.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const l1 = Math.hypot(v1x, v1y) || 0.001;
      const l2 = Math.hypot(v2x, v2y) || 0.001;
      const cosTheta = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
      const angleDeg = (Math.acos(cosTheta) * 180) / Math.PI;

      if (angleDeg < 82) {
        sharpCorners++;
        spikeTips.push({
          x: curr.x - centroid.x,
          y: curr.y - centroid.y,
        });
      } else if (angleDeg > 125) {
        smoothAngles++;
        if (curr.y >= centroid.y) {
          bottomCurvatureCount++;
        }
      }
    }
    // Check stroke endpoints pointing outward as potential ram spikes
    if (stroke.length >= 2) {
      const endPt = stroke[stroke.length - 1];
      if (Math.abs(endPt.x - centroid.x) > width * 0.34) {
        spikeTips.push({ x: endPt.x - centroid.x, y: endPt.y - centroid.y });
      }
    }
  }

  // Compute closed-loop tendency for wheel-like speed/bounciness
  let closedLoops = 0;
  for (const stroke of validStrokes) {
    if (stroke.length >= 6 && dist(stroke[0], stroke[stroke.length - 1]) < 0.14) {
      closedLoops++;
    }
  }

  const areaEstimate = width * height;
  const mass = Number((1.4 + areaEstimate * 5.2 + rawLength * 0.65).toFixed(2));
  const roundnessFactor = Math.min(1, (closedLoops * 0.45 + bottomCurvatureCount * 0.12 + smoothAngles * 0.06));
  const friction = Number(Math.max(0.03, 0.24 - roundnessFactor * 0.18).toFixed(3));
  const restitution = Number(Math.min(0.62, 0.16 + closedLoops * 0.22 + smoothAngles * 0.025).toFixed(2));
  const speedRating = Math.min(10, Math.max(3, Math.round(4 + roundnessFactor * 5.5 - areaEstimate * 2.2)));
  const spikePower = Math.min(10, Math.max(1, 2 + sharpCorners * 2 + Math.min(3, spikeTips.length)));
  const armorHp = Math.round(85 + Math.min(95, rawLength * 28 + areaEstimate * 85));

  // Build Matter.js compound hull parts centered around centroid (normalized -0.5..0.5)
  const hullParts: Point2D[][] = [];
  const halfThick = 0.036;
  for (const stroke of simplified) {
    for (let i = 1; i < stroke.length && hullParts.length < 28; i++) {
      const a = { x: stroke[i - 1].x - centroid.x, y: stroke[i - 1].y - centroid.y };
      const b = { x: stroke[i].x - centroid.x, y: stroke[i].y - centroid.y };
      if (dist(a, b) < 0.015) continue;
      hullParts.push(buildSegmentQuad(a, b, halfThick));
    }
  }

  if (hullParts.length === 0) {
    hullParts.push([
      { x: -0.22, y: -0.1 },
      { x: 0.22, y: -0.1 },
      { x: 0.22, y: 0.1 },
      { x: -0.22, y: 0.1 },
    ]);
  }

  const stats: ShapeStats = {
    mass,
    friction,
    restitution,
    speedRating,
    spikePower,
    armorHp,
    inkUsed,
    spikeCount: Math.min(8, sharpCorners + (spikeTips.length > 0 ? 1 : 0)),
    spikeTips: spikeTips.slice(0, 8),
  };

  return {
    strokes: simplified,
    hullParts,
    centroid,
    bounds: { width, height },
    stats,
  };
}

export type PresetKind = 'wheel' | 'wedge' | 'sled' | 'spiker' | 'hammer' | 'titan';

export function getPresetStrokes(kind: PresetKind): Point2D[][] {
  if (kind === 'wheel') {
    const pts: Point2D[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push({ x: 0.5 + Math.cos(a) * 0.24, y: 0.55 + Math.sin(a) * 0.24 });
    }
    return [pts, [{ x: 0.26, y: 0.55 }, { x: 0.74, y: 0.55 }]];
  }
  if (kind === 'wedge') {
    return [
      [
        { x: 0.2, y: 0.72 },
        { x: 0.85, y: 0.72 },
        { x: 0.52, y: 0.34 },
        { x: 0.2, y: 0.72 },
      ],
    ];
  }
  if (kind === 'sled') {
    return [
      [
        { x: 0.18, y: 0.48 },
        { x: 0.28, y: 0.72 },
        { x: 0.68, y: 0.74 },
        { x: 0.86, y: 0.54 },
      ],
      [
        { x: 0.3, y: 0.52 },
        { x: 0.72, y: 0.52 },
      ],
    ];
  }
  if (kind === 'spiker') {
    return [
      [
        { x: 0.2, y: 0.72 },
        { x: 0.42, y: 0.36 },
        { x: 0.58, y: 0.62 },
        { x: 0.82, y: 0.38 },
        { x: 0.76, y: 0.74 },
        { x: 0.2, y: 0.72 },
      ],
    ];
  }
  if (kind === 'hammer') {
    return [
      [
        { x: 0.22, y: 0.72 },
        { x: 0.78, y: 0.72 },
        { x: 0.74, y: 0.42 },
        { x: 0.26, y: 0.42 },
        { x: 0.22, y: 0.72 },
      ],
      [
        { x: 0.5, y: 0.42 },
        { x: 0.86, y: 0.32 },
      ],
    ];
  }
  // titan
  return [
    [
      { x: 0.16, y: 0.76 },
      { x: 0.35, y: 0.38 },
      { x: 0.55, y: 0.55 },
      { x: 0.84, y: 0.42 },
      { x: 0.82, y: 0.76 },
      { x: 0.16, y: 0.76 },
    ],
    [
      { x: 0.26, y: 0.62 },
      { x: 0.74, y: 0.62 },
    ],
  ];
}
