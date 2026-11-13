import type { Built } from '../builders';
import * as THREE from 'three';
import { meshSDF, PlanPath, roundedPath, roundRect, roundRect4, extrudeRound, smoothstep, smin, softNoise } from './sdf';
import { cushion } from '../geo';
import { bakedFor } from './baked';

// Upholstered seating for Grand Living, rebuilt from the 12K panoramas with the img2threejs pipeline
// (specs, reviews and renders: work/i2t/<piece>/). Every piece is a few welded soft volumes, so edges have real
// radii and arms flow into backs. Frame: x to the right, z toward the front (where you sit), y up, metres.

// meshed pieces by their parameters; `npm run bake` stores them in public/furniture/soft.bin (see baked.ts)
export const softCache = new Map<string, Built>();
const cache = softCache;
const memo = (key: string, make: () => Built): Built => {
  const baked = bakedFor(key);
  if (baked) return baked;
  const hit = cache.get(key);
  if (hit) return { ...hit, parts: Object.fromEntries(Object.entries(hit.parts).map(([k, v]) => [k, v.map((g) => g.clone())])) };
  const b = make();
  cache.set(key, b);
  return b;
};

// ---------------- club chair (work/i2t/club) ----------------
// A tall tub shell (back and both arms in one piece: highest at the two rounded back corners, dipping slightly
// across the back, the arms sloping down to the front) sits on a lower rounded plinth band and overhangs it by
// 2.5 cm, leaving a crease; a domed loose seat cushion fills the U.
export function clubChair(p: Record<string, any>): Built {
  if (p.round) return barrelChair(p);
  const W = p.w ?? 0.95, D = p.d ?? 0.88, cell = p.cell ?? 0.011;
  return memo('club:' + [W, D, cell, p.fabric].join(','), () => {
    const sx = W / 0.89, sz = D / 0.84;
    const noise = softNoise(p.seed ?? 2);
    // plinth: rounded-rectangle band 20 cm tall
    // (about 85% of the shell's width at the crease, as measured on the isolated reference)
    const plinth = meshSDF((x, y, z) => extrudeRound(roundRect(x, z + 0.01 * sz, 0.39 * sx, 0.38 * sz, 0.085), y, 0, 0.2, 0.035) + 0.0015 * noise(x, y, z), {
      min: [-0.46 * sx, -0.01, -0.45 * sz], max: [0.46 * sx, 0.22, 0.43 * sz], cell
    });
    // shell: a rounded U path swept with a bolster-like section (round on top, a small roll at the bottom)
    const ax = 0.345 * sx, front = 0.18 * sz, back = -0.3 * sz;
    const path = new PlanPath(roundedPath([[-ax, front], [-ax, back], [ax, back], [ax, front]], 0.2));
    const shellSDF = (x: number, y: number, z: number) => {
      // the tub flares: about 7% wider at the top than at the crease, the back leaning out a little too
      const fl = 1 + 0.07 * smoothstep(0.2, 0.78, y);
      x /= fl; z = z < 0 ? z / (1 + 0.04 * smoothstep(0.2, 0.78, y)) : z;
      const n = path.nearest(x, z);
      const u = Math.abs((2 * n.s) / path.total - 1); // 0 at the middle of the back, 1 at the arm ends
      const hw0 = 0.11 + 0.02 * (1 - smoothstep(0.25, 0.6, u)); // the back is a little thicker than the arms
      // tall tub: highest at the two back corners, a slight dip across the back, the arms sloping down to the front
      const top = 0.735 + 0.02 * smoothstep(0.05, 0.36, u) - 0.17 * smoothstep(0.5, 1.0, u);
      const y0 = 0.185, hh = (top - y0) / 2;
      // the outside of the shell swells a little at mid-height, like a stuffed cushion
      const bulge = 0.018 * Math.sin(Math.PI * smoothstep(y0, top, y));
      const hw = hw0 + bulge;
      return roundRect4(n.d, y - (y0 + hh), hw, hh, [hw * 0.98, 0.035, hw * 0.98, 0.035]) + 0.0025 * noise(x * 1.3, y, z);
    };
    const shell = meshSDF(shellSDF, { min: [-0.5 * sx, 0.15, -0.5 * sz], max: [0.5 * sx, 0.86, 0.42 * sz], cell });
    // seat cushion: a domed rounded block tucked into the U, its front edge rolled over
    const cz0 = -0.2 * sz, cz1 = 0.385 * sz, cx = 0.235 * sx;
    const cushion = meshSDF((x, y, z) => {
      const zc = (cz0 + cz1) / 2, hz = (cz1 - cz0) / 2;
      const crown = 0.016 * Math.max(0, 1 - (x / cx) ** 2) * Math.max(0, 1 - ((z - zc) / hz) ** 2);
      return extrudeRound(roundRect(x, z - zc, cx, hz, 0.07), y, 0.195, 0.43 + crown, 0.065) + 0.002 * noise(x, y * 2, z);
    }, { min: [-0.3 * sx, 0.18, cz0 - 0.03], max: [0.3 * sx, 0.49, cz1 + 0.03], cell });
    // three parts, each its own mesh and finish (they share one fabric unless a visitor restyles one)
    const fabric = p.fabric || 'boucle-pebble-ivory';
    return {
      parts: { upholstery: [shell], plinth: [plinth], cushion: [cushion] },
      slots: {
        upholstery: { label: 'Shell', kind: 'upholstery', def: fabric },
        cushion: { label: 'Seat cushion', kind: 'upholstery', def: p.cushion || fabric },
        plinth: { label: 'Plinth', kind: 'upholstery', def: p.plinth || fabric }
      }
    };
  });
}

// ---------------- round swivel barrel chair (ref/c12-h270.jpg, ref/rug-down-12.jpg) ----------------
// Seen from above it is a C: a thick round shell wrapping about three quarters of a circle, highest at the back and
// sloping down toward the opening at the front, on a round plinth, with a round seat cushion inside.
export function barrelChair(p: Record<string, any>): Built {
  const R = p.r ?? 0.37, cell = p.cell ?? 0.011;
  return memo('barrel:' + [R, cell, p.fabric].join(','), () => {
    const noise = softNoise(p.seed ?? 3);
    const pts: [number, number][] = [];
    for (let a = 42; a <= 318; a += 6) pts.push([Math.sin((a * Math.PI) / 180) * R, Math.cos((a * Math.PI) / 180) * R]);
    const path = new PlanPath(pts);
    const plinth = meshSDF((x, y, z) => extrudeRound(Math.hypot(x, z + 0.01) - (R + 0.02), y, 0, 0.2, 0.035) + 0.0015 * noise(x, y, z), { min: [-R - 0.1, -0.01, -R - 0.1], max: [R + 0.1, 0.22, R + 0.1], cell });
    const shell = meshSDF((x, y, z) => {
      const fl = 1 + 0.06 * smoothstep(0.2, 0.75, y);
      x /= fl; z /= fl;
      const n = path.nearest(x, z);
      const u = Math.abs((2 * n.s) / path.total - 1);
      const hw = 0.085 + 0.02 * (1 - smoothstep(0.2, 0.7, u));
      const top = 0.74 - 0.2 * smoothstep(0.35, 1.0, u);
      const y0 = 0.185, hh = (top - y0) / 2;
      return roundRect4(n.d, y - (y0 + hh), hw, hh, [hw * 0.98, 0.035, hw * 0.98, 0.035]) + 0.0025 * noise(x * 1.3, y, z);
    }, { min: [-R - 0.16, 0.15, -R - 0.16], max: [R + 0.16, 0.82, R + 0.16], cell });
    const cushion = meshSDF((x, y, z) => {
      const r = Math.hypot(x, z - 0.03), crown = 0.016 * Math.max(0, 1 - (r / 0.3) ** 2);
      return extrudeRound(r - 0.3, y, 0.195, 0.43 + crown, 0.065) + 0.002 * noise(x, y * 2, z);
    }, { min: [-0.36, 0.18, -0.33], max: [0.36, 0.49, 0.39], cell });
    const fabric = p.fabric || 'boucle-ivory';
    return {
      parts: { upholstery: [shell], plinth: [plinth], cushion: [cushion] },
      slots: {
        upholstery: { label: 'Shell', kind: 'upholstery', def: fabric },
        cushion: { label: 'Seat cushion', kind: 'upholstery', def: p.cushion || fabric },
        plinth: { label: 'Plinth', kind: 'upholstery', def: p.plinth || fabric }
      }
    };
  });
}

// ---------------- curved sectional (work/i2t/sofa) ----------------
// Swept along its back line in plan (p.path, metres, seat on side p.side): a base band, separate seat blocks with
// seams, and a thick round bolster back that curls forward into the arm at the start and slopes down into a
// backless chaise after p.backEnd metres. Ribbed linen scatter cushions lean on the bolster.
export function sectional(p: Record<string, any>): Built {
  const key = 'sect:' + JSON.stringify([p.path, p.side, p.depth, p.backStart, p.backEnd, p.cornerR, p.armStart, p.armEnd, p.backT, p.cell, p.fabric, p.cushions, p.pillows, p.seed]);
  return memo(key, () => {
    const path = new PlanPath(roundedPath(p.path as [number, number][], p.cornerR ?? 0.85));
    const L = path.total, side = p.side ?? 1, D = p.depth ?? 1.0, bt = p.backT ?? 0.36;
    const baseTop = 0.22, seatTop = p.seatH ?? 0.43, backTop = p.backH ?? 0.72;
    const backEnd = Math.min(L, p.backEnd ?? L), backStart = Math.max(0, p.backStart ?? 0), cell = p.cell ?? 0.016;
    const noise = softNoise(p.seed ?? 4);
    const fr = (x: number, z: number) => { const f = path.frame(x, z); return { s: f.s, l: f.lat * side }; };
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, z] of path.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const box = (y0: number, y1: number) => ({ min: [x0 - D - 0.15, y0, z0 - D - 0.15] as [number, number, number], max: [x1 + D + 0.15, y1, z1 + D + 0.15] as [number, number, number] });
    // base band: rounded in plan at the ends, a soft roll top and bottom
    const base = meshSDF((x, y, z) => {
      const { s, l } = fr(x, z);
      return extrudeRound(roundRect(s - L / 2, l - D / 2, L / 2, D / 2, 0.2), y, 0, baseTop + 0.01, 0.05) + 0.0015 * noise(x, y, z);
    }, { ...box(-0.01, baseTop + 0.05), cell: cell * 1.25 });
    // seat blocks ~1 m long with 1.2 cm seams; behind the back they stop at the bolster, in the chaise they run full depth
    const n = Math.max(1, Math.round(L / 1.0)), ml = L / n;
    const seats = meshSDF((x, y, z) => {
      const { s, l } = fr(x, z);
      const i = Math.max(0, Math.min(n - 1, Math.floor(s / ml)));
      let d = 1e9;
      for (let k = Math.max(0, i - 1); k <= Math.min(n - 1, i + 1); k++) {
        const a = k * ml + 0.006, b = (k + 1) * ml - 0.006, mid = (a + b) / 2;
        const l0 = mid < backEnd - 0.2 && mid > backStart + 0.2 ? bt - 0.04 : 0.015, l1 = D - 0.012;
        const crown = 0.012 * Math.max(0, 1 - ((s - mid) / ((b - a) / 2)) ** 2) * Math.max(0, 1 - ((l - (l0 + l1) / 2) / ((l1 - l0) / 2)) ** 2);
        d = Math.min(d, extrudeRound(roundRect(s - mid, l - (l0 + l1) / 2, (b - a) / 2, (l1 - l0) / 2, 0.09), y, baseTop - 0.005, seatTop + crown, 0.065));
      }
      return d + 0.002 * noise(x * 1.2, y, z);
    }, { ...box(baseTop - 0.03, seatTop + 0.05), cell });
    // bolster back (+ the arm curl at the start and/or the end), one welded roll
    const bolsterSDF = (x: number, y: number, z: number) => {
      const { s, l } = fr(x, z);
      // slopes down into the chaise at its end; at its start it finishes in a round scroll a little lower than the back
      const top = backTop - (backTop - seatTop - 0.03) * smoothstep(backEnd - 0.75, backEnd, s) - 0.05 * (1 - smoothstep(backStart, backStart + 0.5, s));
      const bm = (backStart + backEnd) / 2, bh = (backEnd - backStart) / 2;
      let d = extrudeRound(roundRect(s - bm, l - bt / 2, bh, bt / 2, bt * 0.48), y, baseTop - 0.02, top, bt * 0.46);
      const arm = (s0: number) => {
        const armTop = backTop - 0.06 * smoothstep(0.3, D, l);
        return extrudeRound(roundRect(s - s0, l - (D - 0.04) / 2, bt / 2, (D - 0.04) / 2, bt * 0.48), y, baseTop - 0.02, armTop, bt * 0.46);
      };
      if (p.armStart) d = smin(d, arm(backStart + bt / 2), 0.06);
      if (p.armEnd) d = smin(d, arm(backEnd - bt / 2), 0.06);
      return d + 0.0025 * noise(x, y * 1.3, z);
    };
    const bolster = meshSDF(bolsterSDF, { ...box(baseTop - 0.05, backTop + 0.06), cell });
    // ribbed linen scatter cushions leaning on the bolster
    const pillows: THREE.BufferGeometry[] = [];
    const count = p.pillows ?? Math.max(2, Math.round((backEnd - backStart) / 0.9));
    for (let i = 0; i < count; i++) {
      const sAt = backStart + 0.55 + ((backEnd - backStart - 1.3) * (i + 0.5)) / count;
      const q = path.at(sAt);
      const g = cushion(0.48, 0.15, 0.46, 0.07, 0.04);
      g.rotateX(-1.18 + ((i * 37) % 7) * 0.02);
      g.rotateZ((((i * 53) % 9) - 4) * 0.025);
      g.rotateY(-Math.atan2(q.tz, q.tx) + (side > 0 ? 0 : Math.PI));
      const nx = -q.tz * side, nz = q.tx * side; // toward the seat
      g.translate(q.x + nx * (bt + 0.1), seatTop + 0.21, q.z + nz * (bt + 0.1));
      pillows.push(g);
    }
    const fabric = p.fabric || 'boucle-pebble-ivory';
    return {
      parts: { upholstery: [bolster], seats: [seats], base: [base], cushions: pillows },
      slots: {
        upholstery: { label: 'Back', kind: 'upholstery', def: fabric },
        seats: { label: 'Seats', kind: 'upholstery', def: p.seatFabric || fabric },
        base: { label: 'Base', kind: 'upholstery', def: p.baseFabric || fabric },
        cushions: { label: 'Scatter cushions', kind: 'fabric', def: p.cushions || 'linen-flax' }
      }
    };
  });
}

// ---------------- asymmetric lounge chair (inventory item 2, ref/chair-a.jpg) ----------------
// A deep soft seat with a bolster that wraps the back and one side, built like a short sectional on an L path.
export function loungeChair(p: Record<string, any>): Built {
  const w = p.w ?? 1.15, d = p.d ?? 0.9, m = p.mirror ? -1 : 1;
  const path: [number, number][] = [[-m * w / 2, d / 2], [-m * w / 2, -d / 2], [m * w / 2, -d / 2]];
  return sectional({ ...p, path, side: m, depth: p.depth ?? 0.95, backT: 0.32, backStart: 0, backEnd: 10, cornerR: 0.32, seatH: 0.42, backH: 0.68, pillows: 0, cell: 0.013 });
}

export const softBuilders: Record<string, (p: Record<string, any>) => Built> = { clubChair, sectional, loungeChair };
