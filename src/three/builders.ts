// Procedural furniture. Every builder works in metres in the item's own frame:
// x to the right, z toward the front (where you sit or where the foot of the bed is), y up, origin on the floor.
// A builder returns geometry grouped by material slot. Slots listed in `slots` can be changed in the picker;
// parts under other keys use the fixed material named in `fixed`.
import * as THREE from 'three';
import {
  V2, rbox, cushion, extrudeUp, ellipse, squircle, pebble, arcBand, band, offsetLine, splitPath, pathLength, pathAt,
  lathe, cyl, tube, sphere, tr, rand, worldUV
} from './geo';
import { clubChair, sectional, loungeChair } from './soft/seating';

export interface SlotDef { label: string; kind: string; def: string }
export interface Built {
  parts: Record<string, THREE.BufferGeometry[]>;
  slots: Record<string, SlotDef>;
  fixed?: Record<string, string>;
  noShadow?: string[];
}
type P = Record<string, any>;

const add = (b: Built, slot: string, g: THREE.BufferGeometry) => { (b.parts[slot] ||= []).push(g); };
const D = Math.PI / 180;

// ---------------- sofas (straight, L-shaped, curved: all from the back line) ----------------
function sofa(p: P): Built {
  if (p.style === 'soft') {
    if (p.arc && !p.path) {
      const { r, a0, a1, cx = 0, cz = 0 } = p.arc;
      const n = Math.max(8, Math.round(Math.abs(a1 - a0) / 3));
      p = { ...p, path: Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * (i / n)) * D; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; }), cornerR: 0.01 };
    }
    return sectional(p);
  }
  const b: Built = { parts: {}, slots: {
    upholstery: { label: 'Upholstery', kind: 'upholstery', def: p.fabric || 'boucle-ivory' },
    cushions: { label: 'Scatter cushions', kind: 'fabric', def: p.cushions || 'linen-flax' },
    base: { label: 'Plinth', kind: 'metal', def: p.base || 'bronze' }
  } };
  let path: V2[] = p.path;
  if (p.arc) {
    const { r, a0, a1, cx = 0, cz = 0 } = p.arc;
    path = [];
    const n = Math.max(8, Math.round(Math.abs(a1 - a0) / 4));
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * (i / n)) * D; path.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  }
  const side = p.side ?? 1;
  const depth = p.depth ?? 0.98, seatH = p.seatH ?? 0.42, backH = p.backH ?? 0.74, backT = p.backT ?? 0.22;
  const L = pathLength(path);
  add(b, 'base', extrudeUp(band(path, depth - 0.08, side, 0.04), 0, 0.06, 0, undefined, 16));
  add(b, 'upholstery', extrudeUp(band(path, depth, side), 0.05, 0.24, 0.035, undefined, 16));
  add(b, 'upholstery', extrudeUp(band(path, backT, side), 0.05, backH - 0.05, 0.07, undefined, 16, 4));
  // seat cushions with seams
  const n = Math.max(1, Math.round(L / (p.cushionLen || 0.9)));
  for (const piece of splitPath(path, n)) {
    const inner = offsetLine(piece, backT - 0.02, side);
    // pull the ends in a little so neighbouring cushions show a seam
    const pl = pathLength(inner);
    if (pl < 0.1) continue;
    const a = pathAt(inner, 0.012), z = pathAt(inner, pl - 0.012);
    const trimmed: V2[] = [a.p, ...inner.slice(1, -1), z.p];
    add(b, 'upholstery', extrudeUp(band(trimmed, depth - backT - 0.01, side), 0.27, seatH - 0.27 + 0.03, 0.06, undefined, 16, 4));
  }
  // back cushions leaning on the back
  if (p.pillows !== false) {
    const rail = offsetLine(path, backT + 0.07, side);
    const RL = pathLength(rail);
    const k = Math.max(1, Math.round(RL / 0.78));
    const r = rand(p.seed || 3);
    for (let i = 0; i < k; i++) {
      const s = (RL * (i + 0.5)) / k;
      const { p: q, t } = pathAt(rail, s);
      const ang = Math.atan2(t[1], t[0]);
      const w = Math.min(0.66, (RL / k) * 0.92);
      const g = cushion(w, 0.17, 0.48, 0.07, 0.04);
      g.rotateX(-1.25 + r() * 0.08);
      g.rotateY(-ang + (side > 0 ? 0 : Math.PI));
      g.translate(q[0], seatH + 0.25, q[1]);
      add(b, 'upholstery', g);
    }
    // a few scatter cushions
    const m = Math.max(1, Math.round(RL / 1.4));
    for (let i = 0; i < m; i++) {
      const s = RL * (0.12 + (0.76 * (i + 0.5)) / m) + (r() - 0.5) * 0.2;
      const { p: q, t } = pathAt(rail, s);
      const ang = Math.atan2(t[1], t[0]);
      const g = cushion(0.44, 0.13, 0.42, 0.06, 0.035);
      g.rotateX(-1.05);
      g.rotateZ((r() - 0.5) * 0.4);
      g.rotateY(-ang + (side > 0 ? 0 : Math.PI));
      const nx = -t[1] * side, nz = t[0] * side;
      g.translate(q[0] + nx * 0.1, seatH + 0.2, q[1] + nz * 0.1);
      add(b, 'cushions', g);
    }
  }
  if (p.arms) {
    const ends: [boolean, number][] = [[p.arms[0], 0], [p.arms[1], L]];
    for (const [on, s] of ends) {
      if (!on) continue;
      const { p: q, t } = pathAt(path, s);
      const dir = s === 0 ? -1 : 1; // outward along the path
      const tx = t[0] * dir, tz = t[1] * dir;
      const nx = -t[1] * side, nz = t[0] * side;
      const aw = p.armW || 0.2;
      const foot: V2[] = [
        [q[0], q[1]], [q[0] - tx * aw, q[1] - tz * aw], [q[0] - tx * aw + nx * depth, q[1] - tz * aw + nz * depth], [q[0] + nx * depth, q[1] + nz * depth]
      ];
      add(b, 'upholstery', extrudeUp(foot, 0.05, (p.armH || 0.6) - 0.05, 0.07, undefined, 4, 4));
    }
  }
  return b;
}

// ---------------- chairs ----------------
function armchair(p: P): Built {
  const st = p.style || 'barrel';
  if (st === 'club2') return clubChair(p);
  if (st === 'lounge') return loungeChair(p);
  const b: Built = { parts: {}, slots: {
    upholstery: { label: 'Upholstery', kind: 'upholstery', def: p.fabric || 'boucle-ivory' },
    base: { label: st === 'out' ? 'Frame' : 'Base', kind: st === 'out' ? 'wood' : 'metal', def: p.base || (st === 'out' ? 'teak' : 'bronze') }
  } };
  if (st === 'barrel') {
    const r = p.r || 0.42;
    add(b, 'base', cyl(0.2, 0.24, 0.05, 40));
    add(b, 'upholstery', extrudeUp(ellipse(r, r * 0.96, 56), 0.05, 0.32, 0.06, undefined, 40, 4));
    add(b, 'upholstery', extrudeUp(arcBand(r - 0.14, r, (-90 - 118) * D, (-90 + 118) * D, 40), 0.05, 0.7, 0.065, undefined, 40, 4));
    add(b, 'upholstery', extrudeUp(ellipse(r - 0.13, r - 0.15, 48, 0, 0.05), 0.34, 0.13, 0.055, undefined, 40, 4));
  } else if (st === 'club') {
    const w = p.w || 0.86, d = p.d || 0.86;
    add(b, 'base', tr(rbox(w - 0.06, 0.06, d - 0.06, 0.01), 0, 0.03, 0));
    add(b, 'upholstery', tr(rbox(w, 0.3, d, 0.06), 0, 0.06 + 0.15, 0));
    for (const sx of [-1, 1]) add(b, 'upholstery', tr(rbox(0.18, 0.58, d, 0.07), sx * (w / 2 - 0.09), 0.06 + 0.29, 0));
    add(b, 'upholstery', tr(rbox(w, 0.72, 0.2, 0.08), 0, 0.06 + 0.36, -d / 2 + 0.1));
    add(b, 'upholstery', tr(cushion(w - 0.38, 0.13, d - 0.24, 0.06, 0.025), 0, 0.42, 0.1));
    add(b, 'upholstery', tr(cushion(w - 0.4, 0.4, 0.15, 0.06, 0.03).rotateX(-0.18), 0, 0.68, -d / 2 + 0.26));
  } else if (st === 'shell') {
    const r = p.r || 0.4;
    const prof: [number, number][] = [[0.0, 0.33], [r - 0.06, 0.33], [r - 0.01, 0.38], [r, 0.52], [r - 0.01, 0.72], [r - 0.05, 0.74], [r - 0.07, 0.72], [r - 0.08, 0.52], [r - 0.1, 0.41], [0.0, 0.41]];
    const g = lathe(prof, 48, Math.PI * 2 - 1.9, Math.PI + 0.95);
    add(b, 'upholstery', g);
    add(b, 'upholstery', extrudeUp(ellipse(r - 0.08, r - 0.09, 48, 0, 0.02), 0.39, 0.11, 0.05, undefined, 40, 4));
    for (const a of [45, 135, 225, 315]) {
      const x = Math.cos(a * D) * (r - 0.14), z = Math.sin(a * D) * (r - 0.14);
      add(b, 'base', tube([[x * 1.25, 0, z * 1.25], [x * 1.05, 0.17, z * 1.05], [x, 0.34, z]], 0.014, 8));
    }
  } else if (st === 'out') {
    // teak lounge chair with a woven seat and loose cushion
    b.slots.weave = { label: 'Weave', kind: 'outdoor', def: p.weave || 'weave-sand' };
    const w = p.w || 0.72, d = p.d || 0.78;
    for (const sx of [-1, 1]) {
      add(b, 'base', tr(rbox(0.05, 0.05, d, 0.008), sx * (w / 2 - 0.025), 0.56, 0));
      for (const sz of [-1, 1]) add(b, 'base', tr(rbox(0.05, 0.56, 0.05, 0.008), sx * (w / 2 - 0.025), 0.28, sz * (d / 2 - 0.025)));
      add(b, 'base', tr(rbox(0.04, 0.04, d - 0.05, 0.006), sx * (w / 2 - 0.025), 0.3, 0));
    }
    add(b, 'weave', tr(rbox(w - 0.1, 0.03, d - 0.1, 0.01), 0, 0.33, 0.02));
    add(b, 'weave', tr(rbox(w - 0.1, 0.03, 0.62, 0.01).rotateX(-1.2), 0, 0.6, -d / 2 + 0.12));
    add(b, 'upholstery', tr(cushion(w - 0.14, 0.09, d - 0.18, 0.04, 0.02), 0, 0.39, 0.04));
  }
  return b;
}

function diningChair(p: P): Built {
  if (p.style === 'horseshoe') return horseshoeChair(p);
  const b: Built = { parts: {}, slots: {
    upholstery: { label: 'Seat and back', kind: 'upholstery', def: p.fabric || 'velvet-olive' },
    frame: { label: 'Frame', kind: 'metal', def: p.frame || 'brass' }
  } };
  const sh = 0.46;
  add(b, 'upholstery', extrudeUp(squircle(0.245, 0.23, 3.2, 48), sh - 0.08, 0.1, 0.04, undefined, 32, 4));
  const back = arcBand(0.215, 0.27, (-90 - 98) * D, (-90 + 98) * D, 36, 0, 0.04);
  add(b, 'upholstery', extrudeUp(back, sh - 0.02, 0.36, 0.03, undefined, 32, 3));
  // brass rim following the back and four slim legs
  const rim: [number, number, number][] = [];
  for (let i = 0; i <= 24; i++) { const a = (-90 - 102 + (204 * i) / 24) * D; rim.push([Math.cos(a) * 0.285, sh + 0.16, 0.04 + Math.sin(a) * 0.285]); }
  add(b, 'frame', tube(rim, 0.011, 48));
  for (const [x, z] of [[-0.19, 0.17], [0.19, 0.17], [-0.2, -0.17], [0.2, -0.17]] as V2[]) {
    add(b, 'frame', tube([[x * 1.08, 0, z * 1.1], [x, sh - 0.08, z]], 0.012, 4));
  }
  add(b, 'frame', tr(rbox(0.42, 0.02, 0.4, 0.008), 0, sh - 0.09, 0));
  // crisp seat piping and a slim upholstered back rim give the chair a tailored, furniture-quality silhouette
  add(b, 'upholstery', tr(rbox(0.47, 0.012, 0.012, 0.004), 0, sh + 0.012, 0.205));
  add(b, 'upholstery', tr(rbox(0.012, 0.012, 0.43, 0.004), 0.205, sh + 0.012, 0));
  add(b, 'upholstery', tr(rbox(0.012, 0.012, 0.43, 0.004), -0.205, sh + 0.012, 0));
  for (const sx of [-1, 1]) {
    add(b, 'frame', tr(rbox(0.018, 0.34, 0.018, 0.004), sx * 0.19, sh * 0.62, -0.17));
  }
  return b;
}

// Formal Dining (work/i2t/DINING-INVENTORY.md item 2): an upholstered horseshoe rail carried by two wide flat oak
// posts under the arm ends and two slim tapered back legs, over a separate upholstered seat on a thin oak frame
function horseshoeChair(p: P): Built {
  const b: Built = { parts: {}, slots: {
    upholstery: { label: 'Seat and rail', kind: 'upholstery', def: p.fabric || 'wool-chartreuse' },
    frame: { label: 'Legs', kind: 'wood', def: p.frame || 'oak-greywash' }
  } };
  const sh = 0.47, ry = 0.6, rh = 0.13, cz = -0.03, r0 = 0.235, r1 = 0.325, span = 116;
  add(b, 'upholstery', extrudeUp(arcBand(r0, r1, (-90 - span) * D, (-90 + span) * D, 56, 0, cz), ry, rh, 0.04, undefined, 48, 4));
  add(b, 'upholstery', extrudeUp(squircle(0.235, 0.225, 3.2, 48).map(([x, z]) => [x, z + 0.03] as V2), sh - 0.09, 0.09, 0.035, undefined, 32, 4));
  const rm = (r0 + r1) / 2, ea = (-90 + span) * D;
  const fx = Math.cos(ea) * rm, fz = cz + Math.sin(ea) * rm;
  for (const sx of [-1, 1]) add(b, 'frame', tr(rbox(0.042, ry + 0.01, 0.088, 0.01), sx * fx, (ry + 0.01) / 2, fz - 0.015, sx * 0.35, -0.03, sx * 0.04)); // flat boards set along the arms
  // two slim tapered back legs under the rail's back corners, splayed out a little
  for (const sx of [-1, 1]) {
    const a = (-90 + sx * 52) * D, x = Math.cos(a) * rm, z = cz + Math.sin(a) * rm;
    add(b, 'frame', tube([[x * 1.12, 0, z * 1.12 - 0.02], [x * 1.04, ry * 0.5, z * 1.05], [x, ry + 0.01, z]], 0.015, 6));
  }
  add(b, 'frame', tr(rbox(0.4, 0.03, 0.36, 0.006), 0, sh - 0.105, 0.0));
  return b;
}

// ---------------- tables ----------------
function table(p: P): Built {
  const st = p.style || 'drum';
  const b: Built = { parts: {}, slots: {
    top: { label: 'Top', kind: 'top', def: p.top || 'calacatta' }
  } };
  const base = (def: string, label = 'Base', kind = 'metal') => { b.slots.base = { label, kind, def: p.base || def }; };
  if (st === 'stadium') {
    // Formal Dining (DINING-INVENTORY item 1): a long racetrack top in grey-washed oak on one flared oval pedestal,
    // laid for twelve
    const rx = p.rx || 1.92, rz = p.rz || 0.6, h = p.h || 0.75, t = 0.065;
    const pts: V2[] = [];
    for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 40; pts.push([rx - rz + Math.cos(a) * rz, Math.sin(a) * rz]); }
    for (let i = 0; i <= 40; i++) { const a = Math.PI / 2 + (Math.PI * i) / 40; pts.push([-(rx - rz) + Math.cos(a) * rz, Math.sin(a) * rz]); }
    add(b, 'top', extrudeUp(pts, h - t, t, 0.016, undefined, 96, 3));
    base(p.top || 'oak-greywash', 'Pedestal', 'wood');
    add(b, 'base', lathe([[0, 0], [0.3, 0], [0.3, 0.025], [0.24, 0.07], [0.2, 0.25], [0.2, 0.48], [0.25, h - t - 0.03], [0.27, h - t], [0, h - t]], 64).scale(rx * 0.62 / 0.3 * 0.5, 1, rz * 0.62 / 0.3 * 0.6));
    if (p.runner !== false) {
      b.slots.runner = { label: 'Runner', kind: 'fabric', def: p.runner || 'linen-white' };
      add(b, 'runner', tr(rbox(rx * 2 - 0.5, 0.005, 0.46, 0.002), 0, h + 0.003, 0));
    }
    if (p.settings) {
      b.fixed = { ...(b.fixed || {}), plate: 'ceramic-white', glass: 'glass-clear', cutlery: 'brass', napkin: 'linen-flax' };
      // the twelve seats of the Formal Dining chair ring (src/data/furniture.ts): five a side, one at each end
      const seats: [number, number, number][] = [];
      for (const x of [-1.3, -0.65, 0, 0.65, 1.3]) { seats.push([x, rz - 0.21, 0]); seats.push([x, -(rz - 0.21), Math.PI]); }
      seats.push([rx - 0.27, 0, Math.PI / 2]); seats.push([-(rx - 0.27), 0, -Math.PI / 2]);
      for (const [sx, sz, a] of seats) {
        const put = (g: THREE.BufferGeometry, slot: string, lx: number, ly: number, lz: number, ry = 0) => add(b, slot, tr(g.rotateY(ry).translate(lx, ly, lz), sx, h, sz, a));
        put(lathe([[0, 0], [0.14, 0], [0.16, 0.012], [0.155, 0.014], [0, 0.006]], 40), 'plate', 0, 0, 0);
        put(lathe([[0, 0], [0.1, 0], [0.13, 0.016], [0.125, 0.018], [0, 0.008]], 40), 'plate', 0, 0.012, 0);
        put(lathe([[0, 0], [0.035, 0], [0.065, 0.035], [0.062, 0.037], [0.03, 0.006], [0, 0.006]], 32), 'plate', 0, 0.026, 0);
        put(lathe([[0, 0], [0.035, 0], [0.004, 0.006], [0.004, 0.11], [0.03, 0.13], [0.04, 0.2], [0.037, 0.2], [0.027, 0.135], [0, 0.125]], 24), 'glass', 0.16, 0, -0.17);
        put(lathe([[0, 0], [0.032, 0], [0.034, 0.1], [0.031, 0.1], [0.029, 0.006], [0, 0.006]], 24), 'glass', 0.07, 0, -0.21);
        put(rbox(0.018, 0.004, 0.2, 0.001), 'cutlery', -0.2, 0.003, 0.01);
        put(rbox(0.016, 0.004, 0.21, 0.001), 'cutlery', 0.19, 0.003, 0.01);
        put(rbox(0.016, 0.004, 0.17, 0.001), 'cutlery', 0.22, 0.003, 0.01);
        put(rbox(0.12, 0.01, 0.2, 0.004), 'napkin', -0.25, 0.006, 0.01, 0.05);
      }
    }
  } else if (st === 'oval') {
    const rx = p.rx || 1.9, rz = p.rz || 0.8, h = p.h || 0.75, t = 0.05;
    add(b, 'top', extrudeUp(ellipse(rx, rz, 96), h - t, t, 0.014, undefined, 96, 3));
    base(p.top || 'travertine', 'Pedestals', 'top');
    for (const sx of [-1, 1]) add(b, 'base', extrudeUp(ellipse(0.17, 0.34, 40, sx * rx * 0.46, 0), 0, h - t, 0.02, undefined, 32));
    if (p.runner !== false) {
      b.slots.runner = { label: 'Runner', kind: 'fabric', def: p.runner || 'linen-white' };
      add(b, 'runner', tr(rbox(rx * 1.72, 0.006, 0.42, 0.002), 0, h + 0.003, 0));
    }
  } else if (st === 'pebble' && p.legs === 'cyl2') {
    // Grand Living: a 6 cm pebble-shaped marble slab with a soft 2.5 cm edge on two round travertine pedestals
    // (work/i2t/GRAND-LIVING-INVENTORY.md item 5)
    const rx = p.rx || 0.7, rz = p.rz || 0.4, h = p.h || 0.36, t = 0.06, lr = p.legR || 0.12;
    add(b, 'top', extrudeUp(pebble(rx, rz, p.seed || 1, 0.09), h - t, t, 0.025, undefined, 96, 4));
    base('travertine', 'Pedestals', 'top');
    for (const sx of [-1, 1]) add(b, 'base', extrudeUp(ellipse(lr, lr, 48, sx * rx * 0.48, (p.legZ || 0) * rz), 0, h - t + 0.005, 0.006, undefined, 48, 2));
  } else if (st === 'pebble') {
    const rx = p.rx || 0.7, rz = p.rz || 0.4, h = p.h || 0.34;
    add(b, 'top', extrudeUp(pebble(rx, rz, p.seed || 1, 0.09), 0.04, h - 0.04, 0.035, undefined, 72, 4));
    add(b, 'top', extrudeUp(pebble(rx * 0.86, rz * 0.82, p.seed || 1, 0.09), 0, 0.05, 0, undefined, 48));
  } else if (st === 'nest') {
    // Grand Living nesting side tables: oval dark tops on antique-bronze trumpet stems that flare into disc feet
    b.slots.top.def = p.top || 'walnut';
    base('ml501', 'Stems', 'metal');
    const pair: [number, number, number, number, number][] = [[0, 0, 0.27, 0.23, 0.56], [0.36, 0.12, 0.22, 0.19, 0.61]]; // x, z, rx, rz, h
    for (const [x, z, rx, rz, h] of pair.slice(0, p.single ? 1 : 2)) {
      add(b, 'top', extrudeUp(pebble(rx, rz, (p.seed || 2) + x * 10, 0.06), h - 0.022, 0.022, 0.008, undefined, 72, 2).translate(x, 0, z));
      const stem = lathe([[0, 0], [0.11, 0], [0.115, 0.012], [0.105, 0.032], [0.05, 0.05], [0.026, 0.12], [0.02, h * 0.55], [0.022, h - 0.05], [0.05, h - 0.024], [0, h - 0.024]], 40);
      stem.scale(1, 1, rz / rx);
      add(b, 'base', stem.translate(x, 0, z));
    }
  } else if (st === 'drum') {
    const r = p.r || 0.25, h = p.h || 0.48;
    add(b, 'top', extrudeUp(ellipse(r, r, 48), 0, h, 0.012, undefined, 48));
  } else if (st === 'pouf') {
    const r = p.r || 0.25, h = p.h || 0.42;
    b.slots.top = { label: 'Upholstery', kind: 'upholstery', def: p.top || 'leather-black' };
    add(b, 'top', extrudeUp(ellipse(r, r, 48), 0, h, 0.08, undefined, 48, 5));
  } else if (st === 'glass') {
    const rx = p.rx || 0.7, rz = p.rz || 0.85, h = p.h || 0.38;
    b.slots.top = { label: 'Glass', kind: 'glass', def: p.top || 'glass-green' };
    add(b, 'top', extrudeUp(ellipse(rx, rz, 72), h - 0.02, 0.02, 0.004, undefined, 72));
    base('chrome');
    add(b, 'base', extrudeUp(ellipse(rx * 0.5, rz * 0.5, 48), 0, h - 0.02, 0.01, undefined, 48));
  } else if (st === 'round') {
    const r = p.r || 0.65, h = p.h || 0.75;
    add(b, 'top', extrudeUp(ellipse(r, r, 72), h - 0.04, 0.04, 0.01, undefined, 72));
    base('bronze');
    add(b, 'base', lathe([[0, 0], [0.32, 0], [0.33, 0.02], [0.09, 0.08], [0.06, 0.4], [0.07, h - 0.04], [0, h - 0.04]], 40));
  } else if (st === 'desk') {
    const w = p.w || 1.6, d = p.d || 0.6, h = p.h || 0.75;
    add(b, 'top', tr(rbox(w, 0.04, d, 0.01), 0, h - 0.02, 0));
    base('ebony', 'Frame', 'wood');
    for (const sx of [-1, 1]) add(b, 'base', tr(rbox(0.05, h - 0.04, d - 0.06, 0.01), sx * (w / 2 - 0.08), (h - 0.04) / 2, 0));
    add(b, 'base', tr(rbox(w * 0.5, 0.12, 0.42, 0.01), w * 0.18, h - 0.1, -0.02));
  } else if (st === 'console') {
    const w = p.w || 1.8, d = p.d || 0.45, h = p.h || 0.75;
    base('walnut', 'Body', 'wood');
    add(b, 'base', tr(rbox(w - 0.02, h - 0.09, d - 0.02, 0.012), 0, 0.03 + (h - 0.09) / 2, 0));
    add(b, 'top', tr(rbox(w, 0.04, d, 0.006), 0, h - 0.02, 0));
    // door reveal lines
    const k = Math.max(2, Math.round(w / 0.6));
    for (let i = 1; i < k; i++) add(b, 'base', tr(rbox(0.006, h - 0.16, 0.004, 0.001), -w / 2 + (w * i) / k, 0.04 + (h - 0.12) / 2, d / 2));
  }
  return b;
}

// ---------------- beds ----------------
function bed(p: P): Built {
  const w = p.w || 2.0, l = p.l || 2.15;
  const b: Built = { parts: {}, slots: {
    frame: { label: 'Bed frame', kind: 'upholstery', def: p.frame || 'wool-taupe' },
    headboard: { label: 'Headboard', kind: 'upholstery', def: p.headboard || p.frame || 'wool-taupe' },
    bedding: { label: 'Bedding', kind: 'bedding', def: p.bedding || 'bed-white' },
    throw: { label: 'Throw', kind: 'throw', def: p.throw || 'bed-dove' },
    accent: { label: 'Accent cushions', kind: 'fabric', def: p.accent || 'velvet-olive' }
  } };
  add(b, 'frame', tr(rbox(w, 0.28, l, 0.05), 0, 0.08 + 0.14, 0));
  b.fixed = { plinth: 'black-steel' };
  add(b, 'plinth', tr(rbox(w - 0.14, 0.08, l - 0.14, 0.01), 0, 0.04, 0));
  // upholstered side rails and a separate mattress plinth make beds read as furniture rather than stacked blocks
  for (const sx of [-1, 1]) add(b, 'frame', tr(rbox(0.12, 0.18, l - 0.12, 0.035), sx * (w / 2 - 0.06), 0.31, 0));
  add(b, 'frame', tr(rbox(w - 0.12, 0.18, 0.12, 0.035), 0, 0.31, l / 2 - 0.06));
  add(b, 'bedding', tr(rbox(w - 0.08, 0.22, l - 0.08, 0.07), 0, 0.36 + 0.11, 0));
  // duvet over the lower two thirds, folded back at the top
  const dl = l * 0.72;
  const duvet = cushion(w + 0.06, 0.07, dl, 0.035, 0.03, 5);
  tr(duvet, 0, 0.58 + 0.035, l / 2 - dl / 2 + 0.03);
  add(b, 'bedding', duvet);
  add(b, 'bedding', tr(cushion(w + 0.04, 0.07, 0.24, 0.035, 0.02), 0, 0.6 + 0.04, l / 2 - dl - 0.06));
  // soft duvet fold and piped mattress edge
  add(b, 'bedding', tr(rbox(w + 0.08, 0.025, 0.055, 0.012), 0, 0.68, l / 2 - dl - 0.03));
  add(b, 'bedding', tr(rbox(w + 0.1, 0.018, 0.018, 0.008), 0, 0.485, l / 2 - 0.02));
  for (const sx of [-1, 1]) add(b, 'bedding', tr(rbox(0.018, 0.018, l - 0.08, 0.008), sx * (w / 2 + 0.04), 0.485, 0));
  for (const sx of [-1, 1]) add(b, 'bedding', tr(rbox(0.03, 0.3, dl, 0.015), sx * (w / 2 + 0.03), 0.48, l / 2 - dl / 2 + 0.03));
  // throw across the foot, falling over the sides
  add(b, 'throw', tr(rbox(w + 0.14, 0.025, 0.55, 0.01), 0, 0.665, l / 2 - 0.42));
  for (const sx of [-1, 1]) add(b, 'throw', tr(rbox(0.025, 0.32, 0.55, 0.01), sx * (w / 2 + 0.07), 0.52, l / 2 - 0.42));
  // pillows
  const pw = (w - 0.2) / 2;
  for (const sx of [-1, 1]) {
    add(b, 'bedding', tr(cushion(pw, 0.2, 0.5, 0.08, 0.05).rotateX(-0.95), sx * (pw / 2 + 0.03), 0.84, -l / 2 + 0.22));
    add(b, 'bedding', tr(cushion(pw - 0.06, 0.17, 0.42, 0.07, 0.04).rotateX(-0.75), sx * (pw / 2 + 0.03), 0.78, -l / 2 + 0.38));
    add(b, 'accent', tr(cushion(0.42, 0.13, 0.36, 0.06, 0.035).rotateX(-0.55).rotateZ(sx * 0.08), sx * 0.24, 0.74, -l / 2 + 0.55));
  }
  // headboards
  const hs = p.head || 'panel';
  if (hs === 'panel') {
    const hw = p.hw || w + 0.3, hh = p.hh || 1.2;
    add(b, 'headboard', tr(rbox(hw, hh, 0.12, 0.05), 0, hh / 2 + 0.02, -l / 2 - 0.07));
    for (let i = 0; i < 3; i++) add(b, 'headboard', tr(cushion((hw - 0.2) / 3 - 0.02, 0.12, hh - 0.35, 0.05, 0.03).rotateX(Math.PI / 2), -hw / 2 + 0.1 + ((hw - 0.2) / 3) * (i + 0.5), hh / 2 + 0.12, -l / 2 + 0.0));
  } else if (hs === 'wing') {
    // a wide, gently bowed upholstered wall panel
    const hw = p.hw || 3.8, hh = p.hh || 1.45, bow = 0.16;
    const path: V2[] = [];
    for (let i = 0; i <= 16; i++) { const x = -hw / 2 + (hw * i) / 16; const t = x / (hw / 2); path.push([x, -l / 2 - 0.05 - bow * (1 - t * t)]); }
    add(b, 'headboard', extrudeUp(band(path.reverse(), 0.12, 1), 0.02, hh, 0.05, undefined, 16, 4));
  } else if (hs === 'wall') {
    // timber wall panel with an upholstered centre and reading lights
    const hw = p.hw || 3.0, hh = p.hh || 1.15;
    b.slots.panel = { label: 'Wall panel', kind: 'wood', def: p.panel || 'walnut' };
    add(b, 'panel', tr(rbox(hw, hh + 0.25, 0.06, 0.01), 0, (hh + 0.25) / 2, -l / 2 - 0.1));
    add(b, 'headboard', tr(rbox(w + 0.1, hh - 0.1, 0.1, 0.04), 0, (hh - 0.1) / 2 + 0.1, -l / 2 - 0.03));
    b.fixed.bulb = 'bulb';
    for (const sx of [-1, 1]) add(b, 'bulb', tr(rbox(0.22, 0.02, 0.03, 0.005), sx * (w / 2 + 0.36), hh + 0.05, -l / 2 - 0.06));
  }
  return b;
}

function nightstand(p: P): Built {
  const st = p.style || 'round';
  const b: Built = { parts: {}, slots: {
    top: { label: 'Body', kind: 'top', def: p.top || 'walnut' },
    lamp: { label: 'Lamp base', kind: 'metal', def: p.lampMat || 'brass' },
    shade: { label: 'Shade', kind: 'shade', def: 'shade-linen' }
  } };
  let h = p.h || 0.52;
  if (st === 'round') add(b, 'top', extrudeUp(ellipse(p.r || 0.24, p.r || 0.24, 48), 0, h, 0.01, undefined, 48));
  else if (st === 'oval') add(b, 'top', extrudeUp(ellipse(p.rx || 0.3, p.rz || 0.22, 48), 0, h, 0.012, undefined, 48));
  else if (st === 'float') { add(b, 'top', tr(rbox(p.w || 0.5, 0.16, p.d || 0.4, 0.01), 0, h - 0.08, 0)); }
  else add(b, 'top', tr(rbox(p.w || 0.5, h, p.d || 0.42, 0.012), 0, h / 2, 0));
  // cabinet body, shadow-gap base and a darker recessed lower shelf
  if (st !== 'round' && st !== 'oval') {
    add(b, 'top', tr(rbox((p.w || 0.5) - 0.035, 0.012, (p.d || 0.42) - 0.035, 0.004), 0, 0.025, 0));
    add(b, 'top', tr(rbox((p.w || 0.5) - 0.045, 0.012, (p.d || 0.42) - 0.045, 0.004), 0, h * 0.58, 0));
  }
  if (p.lamp !== false) addLamp(b, p.lx || 0.05, h, p.lz || -0.04, p.lampStyle || 'drum');
  return b;
}
function addLamp(b: Built, x: number, y: number, z: number, style: string) {
  if (style === 'globe') {
    add(b, 'lamp', tr(cyl(0.07, 0.08, 0.02, 32), x, y, z));
    add(b, 'shade', tr(sphere(0.13, 32, 20), x, y + 0.15, z));
    return;
  }
  add(b, 'lamp', tr(lathe([[0, 0], [0.08, 0], [0.085, 0.015], [0.03, 0.05], [0.018, 0.12], [0.02, 0.36], [0, 0.36]], 32), x, y, z));
  add(b, 'shade', tr(lathe([[0.12, 0], [0.16, 0], [0.13, 0.22], [0.1, 0.22]], 40), x, y + 0.26, z));
}

function lamp(p: P): Built {
  const b: Built = { parts: {}, slots: {
    lamp: { label: 'Metal', kind: 'metal', def: p.metal || 'brass' },
    shade: { label: 'Shade', kind: 'shade', def: 'shade-linen' }
  } };
  const st = p.style || 'pendant';
  if (st === 'pendant') {
    const y = p.y || 2.15, r = p.r || 0.28;
    b.fixed = { bulb: 'bulb' };
    add(b, 'lamp', cyl(0.004, 0.004, 3.1 - y - r, 6, y + r));
    add(b, 'lamp', tr(cyl(0.07, 0.07, 0.03, 24), 0, 3.07, 0));
    add(b, 'shade', tr(sphere(r, 40, 28), 0, y, 0));
    add(b, 'lamp', tr(lathe([[0, 0], [0.06, 0], [0.05, 0.05], [0, 0.06]], 24), 0, y + r - 0.02, 0));
  } else if (st === 'branch') {
    // Formal Dining (DINING-INVENTORY item 3): a dark bronze stem that branches into angled arms, each ending in a
    // frosted glass tube that is lit (by day too, as in the photos)
    const y = p.y || 2.25, top = 3.1;
    b.fixed = { tube: 'lamp-frost' };
    add(b, 'lamp', cyl(0.007, 0.007, top - y, 8, y));
    add(b, 'lamp', tr(cyl(0.05, 0.05, 0.02, 24), 0, top - 0.02, 0));
    add(b, 'lamp', tr(sphere(0.016, 12, 8), 0, y, 0));
    const tip = (pts: [number, number, number][]) => {
      add(b, 'lamp', tube(pts, 0.007, 12));
      const [a, c] = [pts[pts.length - 2], pts[pts.length - 1]];
      const d = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      const g = lathe([[0, 0], [0.024, 0], [0.034, 0.05], [0.03, 0.13], [0.012, 0.15], [0, 0.15]], 16).applyQuaternion(q).translate(c[0], c[1], c[2]);
      add(b, 'tube', g);
      add(b, 'lamp', cyl(0.026, 0.026, 0.018, 16, -0.009).applyQuaternion(q).translate(c[0], c[1], c[2]));
    };
    const arms: [number, number, number][] = [[0, 0.62, -0.05], [72, 0.5, 0.06], [144, 0.58, -0.02], [216, 0.46, 0.08], [288, 0.6, -0.04]];
    for (const [az, len, rise] of arms) {
      const c = Math.cos(az * D), sn = Math.sin(az * D);
      const k = [c * len * 0.45, y - 0.12, sn * len * 0.45] as [number, number, number];
      tip([[0, y, 0], k, [c * len, y - 0.2 + rise, sn * len]]);
    }
    tip([[0, y, 0], [0.02, y - 0.25, 0.01]]);
  } else if (st === 'floor') {
    add(b, 'lamp', cyl(0.16, 0.17, 0.025, 32));
    add(b, 'lamp', cyl(0.012, 0.012, 1.45, 8, 0.02));
    add(b, 'shade', tr(lathe([[0.2, 0], [0.24, 0], [0.22, 0.32], [0.18, 0.32]], 40), 0, 1.3, 0));
  }
  return b;
}

function bench(p: P): Built {
  const w = p.w || 1.4, d = p.d || 0.45, h = p.h || 0.44;
  const b: Built = { parts: {}, slots: {
    upholstery: { label: 'Upholstery', kind: 'upholstery', def: p.fabric || 'boucle-oat' },
    base: { label: 'Legs', kind: 'metal', def: p.base || 'bronze' }
  } };
  if (p.style === 'pouf2') {
    for (const sx of [-1, 1]) add(b, 'upholstery', tr(cushion(w / 2 - 0.03, h, d, 0.06, 0.02), sx * (w / 4), h / 2, 0));
    return b;
  }
  add(b, 'upholstery', tr(cushion(w, h - 0.12, d, 0.05, 0.02), 0, 0.12 + (h - 0.12) / 2, 0));
  if (p.style === 'arms') {
    for (const sx of [-1, 1]) {
      const pts: [number, number, number][] = [[sx * (w / 2 + 0.03), 0, d / 2 - 0.04], [sx * (w / 2 + 0.03), h + 0.16, d / 2 - 0.08], [sx * (w / 2 + 0.03), h + 0.2, 0], [sx * (w / 2 + 0.03), h + 0.16, -d / 2 + 0.08], [sx * (w / 2 + 0.03), 0, -d / 2 + 0.04]];
      add(b, 'upholstery', tube(pts, 0.05, 32));
    }
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(b, 'base', tr(cyl(0.018, 0.012, 0.12, 12), x * (w / 2 - 0.08), 0, z * (d / 2 - 0.07)));
  return b;
}

// ---------------- rugs ----------------
function rug(p: P): Built {
  const b: Built = { parts: {}, slots: { rug: { label: 'Rug', kind: 'rug', def: p.mat || 'rug-ivory' } } };
  let pts: V2[];
  if (p.shape === 'ellipse') pts = ellipse(p.rx, p.rz, 96);
  else if (p.shape === 'pebble') pts = pebble(p.rx, p.rz, p.seed || 2, 0.1, 96);
  else pts = squircle(p.w / 2, p.d / 2, 18, 96);
  add(b, 'rug', extrudeUp(pts, 0.001, p.t || 0.016, 0.006, undefined, 96, 2));
  b.noShadow = ['rug'];
  return b;
}

// ---------------- plants ----------------
function leafQuad(len: number, wid: number, bend = 0.25): THREE.BufferGeometry {
  // a two-segment leaf with a slight droop, uv 0..1 along its length
  const g = new THREE.PlaneGeometry(wid, len, 1, 3);
  g.translate(0, len / 2, 0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / len; p.setZ(i, bend * len * y * y); }
  g.computeVertexNormals();
  return g;
}
function plant(p: P): Built {
  const st = p.style || 'bush';
  const r = rand(p.seed || 7);
  const b: Built = { parts: {}, slots: { pot: { label: 'Planter', kind: 'pot', def: p.pot || 'pot-white' } }, fixed: { leaves: st === 'spiky' ? 'leaf-long' : 'leaf-broad', soil: 'soil', trunk: 'trunk' } };
  const pr = p.pr ?? (p.r ? p.r * 0.7 : 0.3), ph = p.ph ?? 0.5;
  if (pr > 0) {
    if (p.potShape === 'bowl') add(b, 'pot', lathe([[0, 0], [pr * 0.6, 0], [pr, ph * 0.7], [pr * 1.02, ph], [pr * 0.94, ph], [0, ph * 0.95]], 40));
    else add(b, 'pot', lathe([[0, 0], [pr * 0.82, 0], [pr, ph * 0.9], [pr, ph], [pr * 0.92, ph], [0, ph * 0.9]], 40));
    add(b, 'soil', tr(cyl(pr * 0.92, pr * 0.92, 0.01, 24), 0, ph - 0.04, 0));
  }
  const top = pr > 0 ? ph - 0.03 : 0;
  const R = p.r || 0.45, H = p.h || 0.9;
  const leaves: THREE.BufferGeometry[] = [];
  if (st === 'spiky') {
    const n = p.n || 46;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, tilt = 0.25 + r() * 0.95;
      const len = H * (0.55 + r() * 0.5);
      const g = leafQuad(len, 0.05 + r() * 0.03, 0.18);
      g.rotateX(tilt); g.rotateY(a);
      g.translate((r() - 0.5) * 0.06, top, (r() - 0.5) * 0.06);
      leaves.push(g);
    }
  } else {
    let cy = top + H * 0.55;
    if (st === 'tree') {
      const th = p.trunk || 1.3;
      add(b, 'trunk', tube([[0, top, 0], [0.04, top + th * 0.4, 0.02], [-0.03, top + th * 0.8, 0.03], [0.02, top + th, 0]], 0.035, 16));
      cy = top + th + H * 0.4;
    }
    const n = p.n || Math.round(220 * R * R * 4);
    const ls = p.leaf || 0.16;
    for (let i = 0; i < n; i++) {
      // points in an ellipsoid shell, leaves facing outward and a little up
      const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = Math.pow(r(), 0.35);
      const sx = Math.sqrt(1 - u * u) * Math.cos(th) * rr, sz = Math.sqrt(1 - u * u) * Math.sin(th) * rr, sy = u * rr;
      const x = sx * R, y = cy + sy * H * 0.5, z = sz * R;
      const g = leafQuad(ls * (0.75 + r() * 0.5), ls * 0.5, 0.15);
      g.rotateX(0.6 + r() * 1.2);
      g.rotateY(Math.atan2(x, z) + (r() - 0.5) * 1.4);
      g.translate(x, y - ls * 0.3, z);
      leaves.push(g);
    }
  }
  b.parts.leaves = leaves;
  b.noShadow = [];
  return b;
}

function sculpture(p: P): Built {
  const b: Built = { parts: {}, slots: { top: { label: 'Stone', kind: 'stone', def: p.mat || 'travertine' } } };
  const r = rand(p.seed || 4);
  let y = 0;
  const n = p.n || 3;
  for (let i = 0; i < n; i++) {
    const s = (p.s || 0.45) * (1 - i * 0.22);
    const g = new THREE.IcosahedronGeometry(s, 4);
    const pa = g.getAttribute('position');
    for (let k = 0; k < pa.count; k++) {
      const vx = pa.getX(k), vy = pa.getY(k), vz = pa.getZ(k);
      const f = 1 + 0.08 * Math.sin(vx * 7 + i) * Math.cos(vz * 6) + 0.05 * Math.sin(vy * 9 + i * 2);
      pa.setXYZ(k, vx * f * (1.15 + r() * 0.0), vy * f * 0.55, vz * f);
    }
    g.computeVertexNormals();
    worldUV(g);
    y += s * 0.5;
    g.translate((r() - 0.5) * 0.12, y, (r() - 0.5) * 0.12);
    y += s * 0.42;
    add(b, 'top', g);
  }
  return b;
}

// ---------------- kitchen, bath, joinery ----------------
// A kitchen island: worktop with waterfall ends over a cabinet body. With p.doors (Gourmet Kitchen, KITCHEN-INVENTORY
// item 1) the working side (-z) gets flush veneered doors over a black carcass, a dishwasher panel at the -x end,
// and the far side (+z) is clad in the worktop stone. p.tapSide 1 stands the tap behind the sink on the +z side.
function island(p: P): Built {
  const w = p.w || 3.6, d = p.d || 1.25, h = p.h || 0.92, t = 0.05, kick = 0.08;
  const b: Built = { parts: {}, slots: {
    top: { label: 'Worktop', kind: 'stone', def: p.top || 'patagonia' },
    body: { label: p.doors ? 'Cupboard fronts' : 'Cabinetry', kind: 'wood', def: p.body || 'ebony' }
  }, fixed: { inset: 'black-steel', glass: 'lacquer-black', tap: p.tapMat || 'nickel', carcass: 'black-steel', steel: 'nickel' } };
  const bd = d - 0.1;
  add(b, p.doors ? 'carcass' : 'body', tr(rbox(w - 2 * t - 0.02, h - t - kick, bd, 0.008), 0, kick + (h - t - kick) / 2, 0));
  add(b, 'top', tr(rbox(w, t, d, 0.006), 0, h - t / 2, 0));
  for (const sx of [-1, 1]) add(b, 'top', tr(rbox(t, h - t, d, 0.004), sx * (w / 2 - t / 2), (h - t) / 2, 0));
  if (p.doors) {
    const iw = w - 2 * t - 0.02, n = Math.max(1, Math.round(iw / 0.6)), dw = iw / n, y0 = kick + 0.004, y1 = h - t - 0.004, zf = -bd / 2 - 0.01;
    for (let i = 0; i < n; i++) {
      const x = -iw / 2 + dw * (i + 0.5);
      if (i === 0) { // dishwasher: black glass with a steel control strip along the top
        add(b, 'glass', tr(rbox(dw - 0.006, y1 - y0 - 0.06, 0.02, 0.002), x, (y0 + y1 - 0.06) / 2, zf));
        add(b, 'steel', tr(rbox(dw - 0.006, 0.055, 0.02, 0.002), x, y1 - 0.0275, zf));
      } else add(b, 'body', tr(rbox(dw - 0.006, y1 - y0, 0.02, 0.002), x, (y0 + y1) / 2, zf));
    }
    add(b, 'top', tr(rbox(w - 2 * t - 0.002, h - t, 0.04, 0.004), 0, (h - t) / 2, d / 2 - 0.02)); // stone-clad far side
  }
  const [sw, sd] = p.sinkSize || [0.62, 0.42], [hw, hd] = p.hobSize || [0.86, 0.52];
  if (p.sink) {
    const [sx, sz] = p.sink, k = p.tapSide === 1 ? -1 : 1; // k: which way the spout reaches
    add(b, 'inset', tr(rbox(sw, 0.006, sd, 0.004), sx, h + 0.001, sz));
    const tz = sz - k * (sd / 2 + 0.07);
    add(b, 'tap', tube([[sx, h, tz], [sx, h + 0.38, tz], [sx, h + 0.42, tz + k * 0.14], [sx, h + 0.32, tz + k * 0.22]], 0.014, 24));
  }
  if (p.hob) add(b, 'glass', tr(rbox(hw, 0.008, hd, 0.004), p.hob[0], h + 0.002, p.hob[1]));
  return b;
}
// Gourmet Kitchen (KITCHEN-INVENTORY items 2-3): full-height flush joinery set into the wall cavity, so its doors
// sit on the wall line. Columns run from -x to +x (p.cols, each {k, w}): 'fridge' (a pair of doors with long bar
// handles), 'oven' (a built-in oven at p.ovenY), 'door' (a plain tall door). A shadow-gap joint crosses every column
// at p.joint (the top cupboards; 0 for none); the carcass behind is black, so every gap between doors reads dark.
function tallRun(p: P): Built {
  const h = p.h || 3.08, d = p.d || 0.6, jy = p.joint ?? 2.15, g = 0.006, plinth = 0.08, zf = d / 2;
  const cols: { k: string; w: number }[] = p.cols || [{ k: 'door', w: 0.6 }];
  const W = cols.reduce((s, c) => s + c.w, 0);
  const b: Built = { parts: {}, slots: {
    body: { label: 'Joinery', kind: 'wood', def: p.body || 'oak-kitchen' },
    handle: { label: 'Handles', kind: 'metal', def: p.handle || 'nickel' }
  }, fixed: { gap: 'black-steel', steel: 'stainless', glass: 'lacquer-black', knob: 'copper' } };
  add(b, 'gap', tr(rbox(W, h, d - 0.03, 0.002), 0, h / 2, -0.015));
  add(b, 'gap', tr(rbox(W, plinth, 0.02, 0.001), 0, plinth / 2, zf - 0.07));
  const door = (y0: number, y1: number, w: number, x: number) => add(b, 'body', tr(rbox(w - g, y1 - y0 - g, 0.02, 0.002), x, (y0 + y1) / 2, zf - 0.01));
  let x0 = -W / 2;
  for (const c of cols) {
    const cx = x0 + c.w / 2, y1 = jy || h;
    if (jy) door(jy, h, c.w, cx);
    if (c.k === 'fridge') {
      for (const s of [-1, 1]) {
        door(plinth, y1, c.w / 2, cx + (s * c.w) / 4);
        const hx = cx + s * 0.04; // bar handles beside the meeting edge
        add(b, 'handle', tr(cyl(0.011, 0.011, 1.3, 16), hx, 0.62, zf + 0.045));
        for (const yy of [0.66, 1.88]) add(b, 'handle', tr(rbox(0.016, 0.016, 0.045, 0.004), hx, yy, zf + 0.022));
      }
    } else if (c.k === 'oven') {
      const oy = p.ovenY ?? 1.3, os = 0.595;
      door(plinth, oy - os / 2 - 0.004, c.w, cx);
      door(oy + os / 2 + 0.004, y1, c.w, cx);
      add(b, 'steel', tr(rbox(os, os, 0.03, 0.004), cx, oy, zf - 0.005));
      add(b, 'glass', tr(rbox(0.46, 0.3, 0.006, 0.002), cx, oy - 0.07, zf + 0.012));
      add(b, 'steel', tr(cyl(0.008, 0.008, 0.46, 12), cx + 0.23, oy + 0.12, zf + 0.04, 0, 0, Math.PI / 2));
      for (const k of [-1, 0, 1]) add(b, 'knob', tr(cyl(0.017, 0.017, 0.022, 20), cx + k * 0.09, oy + 0.235, zf + 0.01, 0, Math.PI / 2));
    } else door(plinth, y1, c.w, cx);
    x0 += c.w;
  }
  if (p.ends) for (const s of [-1, 1]) add(b, 'body', tr(rbox(0.02, h, d, 0.002), s * (W / 2 + 0.01), h / 2, 0));
  return b;
}
// A lowered veneered ceiling over a corridor (Gourmet Kitchen hall, KITCHEN-INVENTORY item 8): a flat panel w wide
// (x) and l long (z) with its underside at p.y, a lit slot along one long edge (p.slot -1 / 1 for the -x / +x side)
// and recessed downlights down the middle every p.every metres
function soffit(p: P): Built {
  const w = p.w || 1.1, l = p.l || 4, y = p.y || 2.95, t = 3.1 - y, sw = 0.05;
  const b: Built = { parts: {}, slots: { panel: { label: 'Ceiling', kind: 'wood', def: p.mat || 'veneer-limed' } }, fixed: { led: 'led-warm', trim: 'black-steel', bulb: 'bulb' } };
  const sx = p.slot ? p.slot * (w / 2 - sw / 2) : null, pw = p.slot ? w - sw : w, px = p.slot ? -p.slot * (sw / 2) : 0;
  add(b, 'panel', tr(rbox(pw, t, l, 0.003), px, y + t / 2, 0));
  if (sx !== null) add(b, 'led', tr(rbox(sw - 0.01, 0.01, l - 0.02, 0.002), sx, y + 0.06, 0));
  const every = p.every || 1.6, n = Math.max(1, Math.floor(l / every));
  for (let i = 0; i < n; i++) {
    const z = -l / 2 + (l * (i + 0.5)) / n;
    add(b, 'trim', tr(cyl(0.045, 0.045, 0.006, 20), px, y - 0.004, z));
    add(b, 'bulb', tr(cyl(0.03, 0.03, 0.004, 20), px, y - 0.006, z));
  }
  return b;
}
// Gourmet Kitchen (KITCHEN-INVENTORY item 6): the bar in the hall recess. Base cupboards faced in black speckled
// granite around an under-counter wine cooler, a marble top, a book-matched marble splashback, and two staggered rows
// of open bronze boxes lit from inside against a charcoal niche wall. The back is at -z, the counter front at +z.
function bar(p: P): Built {
  const w = p.w || 2.5, d = p.d || 0.42, h = 0.9, t = 0.03, plinth = 0.08, zb = -d / 2, zf = d / 2;
  const sh = p.splashH || 0.55, top = p.top || 2.6;
  const b: Built = { parts: {}, slots: {
    front: { label: 'Cupboard fronts', kind: 'stone', def: p.front || 'stone-speckle' },
    worktop: { label: 'Worktop', kind: 'stone', def: p.worktop || 'marble-bar' },
    splash: { label: 'Splashback', kind: 'stone', def: p.splash || 'marble-splash' },
    shelf: { label: 'Display boxes', kind: 'metal', def: p.shelf || 'bronze-satin' }
  }, fixed: { gap: 'black-steel', back: 'ceramic-black', led: 'led-warm', steel: 'nickel', glass: 'glass-smoke', rack: 'oak', bottle: 'glass-wine', stem: 'glass-clear' }, noShadow: ['glass', 'stem'] };
  add(b, 'gap', tr(rbox(w, h - t - plinth, d - 0.04, 0.002), 0, plinth + (h - t - plinth) / 2, -0.02));
  add(b, 'gap', tr(rbox(w, plinth, d - 0.1, 0.001), 0, plinth / 2, -0.05));
  add(b, 'worktop', tr(rbox(w, t, d + 0.02, 0.004), 0, h - t / 2, 0.01));
  // doors of about half a metre either side of the wine cooler
  const cw = 0.6, cx = p.cooler ?? 0.15, y0 = plinth + 0.003, y1 = h - t - 0.003, fz = zf - 0.03;
  const run = (a: number, c: number) => { const n = Math.max(1, Math.round((c - a) / 0.5)); for (let i = 0; i < n; i++) { const xa = a + ((c - a) * i) / n, xb = a + ((c - a) * (i + 1)) / n; add(b, 'front', tr(rbox(xb - xa - 0.006, y1 - y0, 0.02, 0.002), (xa + xb) / 2, (y0 + y1) / 2, fz)); } };
  run(-w / 2, cx - cw / 2); run(cx + cw / 2, w / 2);
  // wine cooler: steel frame, smoked glass, warm-lit oak racks of bottles lying neck out
  const ch = y1 - y0, cyc = (y0 + y1) / 2, fw = 0.03;
  for (const [x, y, bw, bh] of [[cx, y1 - fw / 2, cw - 0.006, fw], [cx, y0 + fw / 2, cw - 0.006, fw], [cx - cw / 2 + fw / 2, cyc, fw, ch], [cx + cw / 2 - fw / 2, cyc, fw, ch]]) add(b, 'steel', tr(rbox(bw, bh, 0.025, 0.002), x, y, fz));
  add(b, 'glass', tr(new THREE.PlaneGeometry(cw - 2 * fw, ch - 2 * fw), cx, cyc, fz + 0.008));
  add(b, 'steel', tr(cyl(0.008, 0.008, ch - 0.12, 12), cx - cw / 2 + 0.06, y0 + 0.06, fz + 0.04));
  add(b, 'led', tr(rbox(cw - 0.1, 0.008, 0.02, 0.002), cx, y1 - fw - 0.01, fz - 0.05));
  const levels = 6;
  for (let i = 0; i < levels; i++) {
    const ly = y0 + fw + 0.02 + ((ch - 2 * fw - 0.08) * i) / (levels - 1);
    add(b, 'rack', tr(rbox(cw - 2 * fw - 0.01, 0.012, d - 0.12, 0.002), cx, ly, -0.03));
    for (let k = 0; k < 5; k++) {
      const bx = cx - (cw - 2 * fw) / 2 + 0.055 + k * 0.1;
      add(b, 'bottle', tr(cyl(0.037, 0.037, 0.24, 14), bx, ly + 0.044, fz - 0.33, 0, Math.PI / 2));
      add(b, 'bottle', tr(cyl(0.013, 0.033, 0.07, 10), bx, ly + 0.044, fz - 0.09, 0, Math.PI / 2));
    }
  }
  // splashback and the charcoal niche wall above it
  const splash = new THREE.PlaneGeometry(w, sh);
  add(b, 'splash', tr(splash, 0, h + sh / 2, zb + 0.004));
  add(b, 'back', tr(new THREE.PlaneGeometry(w, top - h - sh), 0, (h + sh + top) / 2, zb + 0.003));
  // open boxes: [centre x, width, bottom y]; each lit along its top, a few glasses in the lower row
  const bt = 0.012, bh = 0.36, bd = 0.3, bz = zb + 0.02 + bd / 2;
  const boxes: [number, number, number][] = p.boxes || [[-0.82, 0.56, h + sh], [0.02, 0.6, h + sh], [0.84, 0.54, h + sh], [-0.42, 0.6, h + sh + bh + 0.1], [0.46, 0.58, h + sh + bh + 0.1]];
  boxes.forEach(([x, bw, by], j) => {
    add(b, 'shelf', tr(rbox(bw, bt, bd, 0.002), x, by + bt / 2, bz));
    add(b, 'shelf', tr(rbox(bw, bt, bd, 0.002), x, by + bh - bt / 2, bz));
    for (const s of [-1, 1]) add(b, 'shelf', tr(rbox(bt, bh, bd, 0.002), x + (s * (bw - bt)) / 2, by + bh / 2, bz));
    add(b, 'led', tr(rbox(bw - 0.05, 0.006, 0.014, 0.002), x, by + bh - bt - 0.004, bz + bd / 2 - 0.03));
    if (by < h + sh + 0.01) for (let k = 0; k < 3; k++) {
      const gx = x - bw / 2 + 0.12 + k * ((bw - 0.24) / 2), gz = bz + 0.04 - (j % 2) * 0.05;
      add(b, 'stem', tr(cyl(0.035, 0.03, 0.1, 16), gx, by + bt + 0.12, gz));
      add(b, 'stem', tr(cyl(0.004, 0.004, 0.12, 6), gx, by + bt, gz));
    }
  });
  return b;
}
function counter(p: P): Built {
  const w = p.w || 2.4, d = p.d || 0.6, h = 0.9;
  const b: Built = { parts: {}, slots: {
    top: { label: 'Worktop', kind: 'stone', def: p.top || 'calacatta' },
    body: { label: 'Cabinetry', kind: 'wood', def: p.body || 'lacquer-ivory' }
  }, fixed: { glass: 'lacquer-black' } };
  add(b, 'body', tr(rbox(w, h - 0.1, d - 0.04, 0.006), 0, 0.1 + (h - 0.14) / 2, -0.02));
  add(b, 'top', tr(rbox(w, 0.03, d, 0.004), 0, h - 0.015, 0));
  if (p.upper) add(b, 'body', tr(rbox(w, 0.75, 0.36, 0.006), 0, 1.55 + 0.375, -d / 2 + 0.18));
  if (p.hob !== undefined) add(b, 'glass', tr(rbox(0.6, 0.008, 0.5, 0.004), p.hob, h + 0.002, 0));
  if (p.tall) add(b, 'body', tr(rbox(w, 2.3, d, 0.006), 0, 1.15, 0));
  return b;
}
function vanity(p: P): Built {
  const w = p.w || 2.4, d = p.d || 0.55, h = 0.86;
  const b: Built = { parts: {}, slots: {
    top: { label: 'Vanity top', kind: 'stone', def: p.top || 'calacatta' },
    basin: { label: 'Basins', kind: 'ceramic', def: p.basin || 'ceramic-white' },
    tap: { label: 'Taps', kind: 'metal', def: p.tap || 'brass' },
    body: { label: 'Cabinet', kind: 'wood', def: p.body || 'smoked-oak' }
  }, fixed: { mirror: 'mirror', handle: 'black-steel' } };
  add(b, 'top', tr(rbox(w, 0.14, d, 0.008), 0, h - 0.07, 0));
  // wall-hung drawers under the top, with a shadow gap, and a full-width mirror above
  add(b, 'body', tr(rbox(w - 0.04, 0.4, d - 0.06, 0.006), 0, h - 0.14 - 0.215, -0.02));
  const k = Math.max(1, Math.round(w / 0.8));
  for (let i = 1; i < k; i++) add(b, 'handle', tr(rbox(0.004, 0.36, 0.006, 0.001), -w / 2 + (w * i) / k, h - 0.355, d / 2 - 0.045));
  add(b, 'mirror', tr(rbox(w - 0.1, 0.95, 0.015, 0.004), 0, h + 0.25 + 0.475, -d / 2 + 0.01));
  for (const x of p.basins || [0]) {
    add(b, 'basin', tr(lathe([[0, 0], [0.12, 0], [0.2, 0.06], [0.22, 0.13], [0.2, 0.13], [0.18, 0.07], [0.0, 0.035]], 40).scale(1, 1, 0.8), x, h, 0.02));
    add(b, 'tap', tube([[x, h + 0.35, -d / 2 + 0.02], [x, h + 0.35, -d / 2 + 0.16], [x, h + 0.3, -d / 2 + 0.18]], 0.012, 12));
  }
  return b;
}
function tub(p: P): Built {
  const w = p.w || 1.8, d = p.d || 0.9;
  const b: Built = { parts: {}, slots: {
    basin: { label: 'Bath', kind: 'ceramic', def: p.mat || 'ceramic-white' },
    tap: { label: 'Bath filler', kind: 'metal', def: p.tap || 'brass' }
  }, fixed: { water: 'glass-clear' } };
  const prof: [number, number][] = [[0, 0], [0.38, 0], [0.45, 0.08], [0.5, 0.35], [0.5, 0.56], [0.47, 0.58], [0.44, 0.56], [0.43, 0.32], [0.36, 0.14], [0, 0.12]];
  const g = lathe(prof, 64);
  g.scale(w, 1, d);
  add(b, 'basin', g);
  add(b, 'water', tr(new THREE.CircleGeometry(0.42, 48).rotateX(-Math.PI / 2).scale(w, 1, d), 0, 0.4, 0));
  add(b, 'tap', tube([[w / 2 + 0.18, 0, 0], [w / 2 + 0.18, 0.95, 0], [w / 2 + 0.1, 1.02, 0], [w / 2 - 0.04, 0.95, 0]], 0.018, 24));
  return b;
}
function wc(p: P): Built {
  const b: Built = { parts: {}, slots: { basin: { label: 'Sanitaryware', kind: 'ceramic', def: p.mat || 'ceramic-white' } } };
  add(b, 'basin', extrudeUp(squircle(0.18, 0.27, 2.6, 48).map(([x, z]) => [x, z + 0.06] as V2), 0.22, 0.2, 0.05, undefined, 32, 3));
  add(b, 'basin', extrudeUp(squircle(0.19, 0.28, 2.6, 48).map(([x, z]) => [x, z + 0.06] as V2), 0.42, 0.03, 0.012, undefined, 32));
  add(b, 'basin', tr(rbox(0.5, 1.05, 0.12, 0.01), 0, 0.525, -0.27));
  return b;
}
function shelving(p: P): Built {
  const w = p.w || 2.4, d = p.d || 0.38, h = p.h || 2.7;
  const b: Built = { parts: {}, slots: {
    body: { label: 'Joinery', kind: 'wood', def: p.body || 'walnut' },
    shelf: { label: 'Shelves', kind: 'top', def: p.shelf || 'bronze' }
  }, fixed: { obj1: 'ceramic-stone', obj2: 'lacquer-clay', obj3: 'leather-tan', bulb: 'bulb', bottle: p.bottle || 'glass-bronze' } };
  if (p.stoneBack) {
    // a backlit stone niche (Formal Dining display wall): the back panel in stone, warm LED strips under the shelves
    b.slots.back = { label: 'Back panel', kind: 'stone', def: p.stoneBack };
    b.fixed!.bulb = 'led-warm';
    add(b, 'back', tr(rbox(w - 0.08, h - 0.56, 0.02, 0.002), 0, 0.5 + (h - 0.56) / 2, -d / 2 + 0.05));
  }
  add(b, 'body', tr(rbox(w, h, 0.04, 0.004), 0, h / 2, -d / 2 + 0.02));
  if (p.wine) {
    // a wine wall sits behind full-height smoked glass doors on slim bronze frames (Grand Living photos)
    b.slots.glass = { label: 'Door glass', kind: 'glass', def: p.glass || 'glass-smoke' };
    b.fixed!.frame = 'bronze';
    b.noShadow = ['glass'];
    b.fixed!.bulb = 'led-warm';
    add(b, 'glass', tr(new THREE.PlaneGeometry(w - 0.06, h - 0.56), 0, 0.5 + (h - 0.56) / 2, d / 2 + 0.005));
    const doors = Math.max(1, Math.round(w / 0.75));
    for (let i = 0; i <= doors; i++) add(b, 'frame', tr(rbox(0.022, h - 0.54, 0.018, 0.003), -w / 2 + 0.03 + ((w - 0.06) * i) / doors, 0.5 + (h - 0.54) / 2, d / 2 + 0.012));
    for (const y of [0.5, h - 0.06]) add(b, 'frame', tr(rbox(w - 0.04, 0.02, 0.018, 0.003), 0, y, d / 2 + 0.012));
  }
  for (const sx of [-1, 1]) add(b, 'body', tr(rbox(0.04, h, d, 0.004), sx * (w / 2 - 0.02), h / 2, 0));
  add(b, 'body', tr(rbox(w, 0.06, d, 0.004), 0, h - 0.03, 0));
  add(b, 'body', tr(rbox(w, 0.5, d, 0.004), 0, 0.25, 0));
  const shelves = p.shelves || 4;
  const r = rand(p.seed || 9);
  for (let i = 1; i <= shelves; i++) {
    const y = 0.5 + ((h - 0.6) * i) / (shelves + 0.4);
    add(b, 'shelf', tr(rbox(w - 0.08, 0.025, d - 0.04, 0.004), 0, y, 0.01));
    add(b, 'bulb', tr(rbox(w - 0.12, 0.006, 0.012, 0.002), 0, y + 0.42 * ((h - 0.6) / (shelves + 0.4)) / 0.55 * 0.5, -d / 2 + 0.07));
    // objects
    let x = -w / 2 + 0.12;
    while (x < w / 2 - 0.2) {
      const kind = r();
      if (p.wine) {
        for (let k = 0; k < 6 && x < w / 2 - 0.1; k++) { add(b, 'bottle', tr(lathe([[0, 0], [0.038, 0], [0.038, 0.2], [0.014, 0.25], [0.013, 0.31], [0, 0.31]], 12), x, y + 0.012, 0.02)); x += 0.085; }
        x += 0.05;
        continue;
      }
      if (kind < 0.35) { add(b, 'obj1', tr(lathe([[0, 0], [0.05, 0], [0.08, 0.1], [0.05, 0.22], [0.03, 0.26], [0, 0.26]], 24), x + 0.06, y + 0.012, 0.0)); x += 0.22; }
      else if (kind < 0.7) { for (let k = 0; k < 4 + Math.floor(r() * 5); k++) { const bh = 0.2 + r() * 0.08; add(b, 'obj3', tr(rbox(0.03, bh, 0.2, 0.004), x, y + 0.012 + bh / 2, 0)); x += 0.034; } x += 0.12; }
      else { add(b, 'obj2', tr(lathe([[0, 0], [0.09, 0], [0.12, 0.05], [0.12, 0.06], [0, 0.05]], 24), x + 0.1, y + 0.012, 0)); x += 0.3; }
    }
  }
  return b;
}
// A framed artwork hanging on the wall behind its origin, facing +z, centred at height p.cy. The canvas material
// carries the picture itself (straightened from the 360 photos), spanning the canvas once.
function art(p: P): Built {
  const w = p.w || 1, h = p.h || 1.4, cy = p.cy ?? 1.6, fw = p.fw ?? 0.022, fd = p.fd ?? 0.04;
  const b: Built = { parts: {}, slots: { frame: { label: 'Frame', kind: 'metal', def: p.frame || 'black-steel' } }, fixed: { canvas: p.art || 'art-stones-a' } };
  add(b, 'canvas', tr(new THREE.PlaneGeometry(w - 2 * fw + 0.004, h - 2 * fw + 0.004), 0, cy, fd - 0.006));
  for (const [x, y, bw, bh] of [[0, cy + h / 2 - fw / 2, w, fw], [0, cy - h / 2 + fw / 2, w, fw], [-w / 2 + fw / 2, cy, fw, h - 2 * fw], [w / 2 - fw / 2, cy, fw, h - 2 * fw]]) add(b, 'frame', tr(rbox(bw, bh, fd, 0.003), x, y, fd / 2));
  add(b, 'frame', tr(rbox(w - 0.01, h - 0.01, 0.01, 0.001), 0, cy, 0.006)); // backing board
  return b;
}
// A full-height wall pier clad in veneer, with a dark joint above a base panel (the wine-room piers in Grand Living)
function pier(p: P): Built {
  const w = p.w || 1.4, d = p.d || 0.3, h = p.h || 3.1, jy = p.joint ?? 0.56;
  const b: Built = { parts: {}, slots: { cladding: { label: 'Cladding', kind: 'wood', def: p.mat || 'veneer-limed' } }, fixed: { joint: 'black-steel' } };
  add(b, 'cladding', tr(rbox(w, h, d, 0.004), 0, h / 2, 0));
  add(b, 'joint', tr(rbox(w + 0.004, 0.008, d + 0.004, 0.001), 0, jy, 0));
  return b;
}
// A full-height glass screen on slim black channels, with a veneered bulkhead above carrying a linear air grille;
// p.open leaves the glass out (a doorway under the bulkhead)
function glassScreen(p: P): Built {
  const w = p.w || 1.2, h = p.h || 3.1, gh = p.gh ?? 2.55;
  const b: Built = { parts: {}, slots: {
    glass: { label: 'Glass', kind: 'glass', def: p.glass || 'glass-wine' },
    bulkhead: { label: 'Bulkhead', kind: 'wood', def: p.bulk || 'veneer-smoked' }
  }, fixed: { frame: 'black-steel' }, noShadow: ['glass'] };
  if (!p.open) {
    add(b, 'glass', tr(new THREE.PlaneGeometry(w, gh - 0.03), 0, (gh - 0.03) / 2 + 0.02, 0));
    add(b, 'frame', tr(rbox(w, 0.02, 0.03, 0.002), 0, 0.01, 0));
  }
  add(b, 'frame', tr(rbox(w, 0.025, 0.03, 0.002), 0, gh, 0));
  if (h > gh + 0.05) {
    const bh = h - gh - 0.0125;
    add(b, 'bulkhead', tr(rbox(w, bh, 0.24, 0.003), 0, gh + 0.0125 + bh / 2, -0.1));
    for (const y of [h - 0.12, h - 0.16, h - 0.2]) add(b, 'frame', tr(rbox(w - 0.12, 0.012, 0.01, 0.001), 0, y, 0.022));
  }
  return b;
}
// A box range hood hung from the ceiling over a kitchen island: a slim chimney and a shallow canopy
function hood(p: P): Built {
  const w = p.w || 0.9, d = p.d || 0.55, y = p.y || 2.25, top = 3.1;
  const b: Built = { parts: {}, slots: { body: { label: 'Hood', kind: 'metal', def: p.mat || 'nickel' } }, fixed: { grille: 'black-steel', lamp: 'lamp-frost' } };
  if (p.style === 'canopy') {
    // Gourmet Kitchen (KITCHEN-INVENTORY item 4): a broad stainless canopy hung on rods from the ceiling, its
    // underside three slotted grease filters with a round light at either end
    const hh = p.hh || 0.3, fw = (w - 0.4) / 3, fd = d - 0.18;
    add(b, 'body', tr(rbox(w, hh, d, 0.012), 0, y + hh / 2, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(b, 'body', tr(cyl(0.007, 0.007, top - y - hh, 8), sx * (w / 2 - 0.1), y + hh, sz * (d / 2 - 0.1)));
    for (let i = 0; i < 3; i++) {
      const fx = -w / 2 + 0.2 + fw * (i + 0.5), nx = 6, nz = 5, cw = (fw - 0.04) / nx, cd = (fd - 0.04) / nz;
      add(b, 'body', tr(rbox(fw - 0.02, 0.006, fd, 0.002), fx, y - 0.001, 0));
      for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) add(b, 'grille', tr(rbox(cw - 0.022, 0.004, cd - 0.022, 0.001), fx - (fw - 0.04) / 2 + cw * (a + 0.5), y - 0.005, -(fd - 0.04) / 2 + cd * (c + 0.5)));
    }
    for (const sx of [-1, 1]) add(b, 'lamp', tr(cyl(0.045, 0.045, 0.006, 24), sx * (w / 2 - 0.1), y - 0.005, 0));
    return b;
  }
  add(b, 'body', tr(rbox(0.34, top - y - 0.06, 0.28, 0.004), 0, y + 0.06 + (top - y - 0.06) / 2, 0));
  add(b, 'body', tr(rbox(w, 0.06, d, 0.006), 0, y + 0.03, 0));
  return b;
}
function wardrobe(p: P): Built {
  const w = p.w || 3.0, d = p.d || 0.62, h = p.h || 2.7;
  const b: Built = { parts: {}, slots: {
    body: { label: 'Joinery', kind: 'wood', def: p.body || 'smoked-oak' },
    glass: { label: 'Door glass', kind: 'glass', def: p.glass || 'glass-bronze' }
  }, fixed: { frame: 'bronze', clothes: 'wool-taupe', bulb: 'bulb' } };
  add(b, 'body', tr(rbox(w, h, 0.04, 0.004), 0, h / 2, -d / 2 + 0.02));
  for (let i = 0; i <= Math.round(w / 0.9); i++) add(b, 'body', tr(rbox(0.03, h, d, 0.004), -w / 2 + (w * i) / Math.round(w / 0.9), h / 2, 0));
  add(b, 'body', tr(rbox(w, 0.08, d, 0.004), 0, h - 0.04, 0));
  add(b, 'body', tr(rbox(w, 0.1, d, 0.004), 0, 0.05, 0));
  add(b, 'clothes', tr(rbox(w - 0.1, 1.0, d - 0.2, 0.05), 0, 1.45, -0.02));
  add(b, 'bulb', tr(rbox(w - 0.1, 0.01, 0.02, 0.003), 0, h - 0.1, 0.1));
  add(b, 'glass', tr(new THREE.PlaneGeometry(w - 0.04, h - 0.2), 0, h / 2, d / 2));
  const k = Math.round(w / 0.9);
  for (let i = 0; i <= k; i++) add(b, 'frame', tr(rbox(0.025, h - 0.18, 0.02, 0.004), -w / 2 + (w * i) / k, h / 2, d / 2 + 0.01));
  return b;
}
function daybed(p: P): Built {
  const w = p.w || 0.9, l = p.l || 1.95;
  const b: Built = { parts: {}, slots: {
    upholstery: { label: 'Cushion', kind: 'outdoor', def: p.fabric || 'linen-white' },
    base: { label: 'Frame', kind: 'wood', def: p.base || 'teak' },
    cushions: { label: 'Pillow', kind: 'fabric', def: p.accent || 'velvet-rust' }
  } };
  add(b, 'base', tr(rbox(w, 0.22, l, 0.02), 0, 0.15, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(b, 'base', tr(rbox(0.06, 0.06, 0.06, 0.01), x * (w / 2 - 0.05), 0.03, z * (l / 2 - 0.05)));
  add(b, 'upholstery', tr(cushion(w - 0.04, 0.12, l - 0.04, 0.05, 0.02), 0, 0.32, 0));
  add(b, 'base', tr(rbox(w, 0.5, 0.06, 0.02).rotateX(0.35), 0, 0.5, -l / 2 + 0.12));
  add(b, 'upholstery', tr(cushion(w - 0.1, 0.12, 0.5, 0.05, 0.03).rotateX(-1.2), 0, 0.55, -l / 2 + 0.22));
  add(b, 'cushions', tr(cushion(0.45, 0.12, 0.32, 0.05, 0.03).rotateX(-0.9).rotateZ(0.25), 0.12, 0.55, -l / 2 + 0.42));
  return b;
}
function decor(p: P): Built {
  const b: Built = { parts: {}, slots: {}, fixed: { a: p.a || 'ceramic-stone', bk: p.bk || 'leather-tan', c: p.c || 'lacquer-black', d: 'brass', f: 'leaf-broad' } };
  const st = p.style || 'books';
  if (st === 'books') {
    let y = 0; const r = rand(p.seed || 5);
    for (let i = 0; i < (p.n || 3); i++) { const t = 0.03 + r() * 0.025; add(b, i % 2 ? 'bk' : 'c', tr(rbox(0.3 - i * 0.03, t, 0.22 - i * 0.01, 0.004).rotateY((r() - 0.5) * 0.3), 0, y + t / 2, 0)); y += t; }
    add(b, 'a', tr(lathe([[0, 0], [0.04, 0], [0.06, 0.04], [0.06, 0.05], [0, 0.04]], 24), 0.02, y, 0));
  } else if (st === 'vase') {
    add(b, 'a', lathe([[0, 0], [0.07, 0], [0.11, 0.14], [0.08, 0.3], [0.05, 0.36], [0.055, 0.4], [0, 0.39]], 32));
    for (let i = 0; i < 5; i++) add(b, 'f', tr(new THREE.PlaneGeometry(0.06, 0.3).translate(0, 0.15, 0).rotateX(0.3).rotateY(i * 1.25), 0, 0.36, 0));
  } else if (st === 'bowl') {
    add(b, 'a', lathe([[0, 0], [0.08, 0], [0.18, 0.08], [0.2, 0.1], [0.18, 0.1], [0.07, 0.03], [0, 0.03]], 40));
  } else if (st === 'tray') {
    add(b, 'd', tr(rbox(0.45, 0.02, 0.3, 0.008), 0, 0.01, 0));
    add(b, 'a', tr(lathe([[0, 0], [0.04, 0], [0.045, 0.12], [0, 0.12]], 20), -0.1, 0.02, 0));
    add(b, 'c', tr(lathe([[0, 0], [0.035, 0], [0.04, 0.18], [0, 0.18]], 20), 0.08, 0.02, 0.03));
  } else if (st === 'pampas') {
    // a glass vase of dried pampas plumes (Formal Dining table)
    b.fixed = { ...b.fixed, v: 'glass-clear', stem: 'linen-flax', plume: 'pampas' };
    add(b, 'v', lathe([[0, 0], [0.07, 0], [0.085, 0.08], [0.06, 0.24], [0.065, 0.3], [0.058, 0.3], [0.052, 0.24], [0.077, 0.08], [0.062, 0.006], [0, 0.006]], 32));
    const r = rand(p.seed || 11);
    for (let i = 0; i < 34; i++) {
      const az = r() * Math.PI * 2, tilt = 0.15 + r() * 0.6, L = 0.3 + r() * 0.2;
      const dx = Math.sin(tilt) * Math.cos(az), dy = Math.cos(tilt), dz = Math.sin(tilt) * Math.sin(az);
      add(b, 'stem', tube([[0, 0.05, 0], [dx * L, 0.05 + dy * L, dz * L]], 0.003, 4));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz));
      add(b, 'plume', sphere(1, 10, 8).scale(0.045 + r() * 0.02, 0.12 + r() * 0.05, 0.045).applyQuaternion(q).translate(dx * (L + 0.06), 0.05 + dy * (L + 0.06), dz * (L + 0.06)));
    }
  } else if (st === 'candles') {
    for (let i = 0; i < 3; i++) {
      const hh = 0.18 + i * 0.05;
      add(b, 'd', tr(lathe([[0, 0], [0.03, 0], [0.012, 0.02], [0.008, hh], [0.02, hh + 0.02], [0, hh + 0.02]], 16), (i - 1) * 0.12, 0, 0));
      b.fixed = { ...b.fixed, flame: 'flame-warm' };
      add(b, 'flame', tr(sphere(0.012, 12, 8).scale(0.55, 1.5, 0.55), (i - 1) * 0.12, hh + 0.04, 0));
    }
  }
  // p.lift raises the piece onto a surface (decor is placed from the floor)
  if (p.lift) for (const gs of Object.values(b.parts)) for (const g of gs) g.translate(0, p.lift, 0);
  return b;
}


// ---------------- amenity pieces ----------------
// pool: water surface set 0.15 m below the deck, mosaic basin and a stone coping; pts is the outline in local metres
function pool(p: P): Built {
  const b: Built = { parts: {}, slots: {
    basin: { label: 'Pool tile', kind: 'floor', def: p.tile || 'tl502' },
    coping: { label: 'Coping', kind: 'floor', def: p.coping || 'st503' }
  }, fixed: { water: 'water' } };
  const pts: V2[] = p.pts;
  const depth = p.depth || 1.3;
  add(b, 'basin', extrudeUp(pts, -depth, 0.02, 0, undefined, 48));
  // basin walls: a thin ring between the outline and a slightly smaller outline
  const inner = pts.map(([x, z]) => [x, z] as V2);
  add(b, 'basin', extrudeUp(pts, -depth, depth - 0.02, 0, [shrink(inner, 0.04)], 48));
  add(b, 'water', extrudeUp(shrink(pts, 0.03), -0.17, 0.01, 0, undefined, 48));
  add(b, 'coping', extrudeUp(grow(pts, 0.45), -0.02, 0.06, 0.01, [pts], 48));
  b.noShadow = ['water'];
  return b;
}
function centroid(pts: V2[]): V2 { let x = 0, z = 0; for (const q of pts) { x += q[0]; z += q[1]; } return [x / pts.length, z / pts.length]; }
function shrink(pts: V2[], d: number): V2[] { const [cx, cz] = centroid(pts); return pts.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz) || 1; return [x - ((x - cx) / l) * d, z - ((z - cz) / l) * d] as V2; }); }
function grow(pts: V2[], d: number): V2[] { return shrink(pts, -d); }

function lounger(p: P): Built {
  const b: Built = { parts: {}, slots: {
    upholstery: { label: 'Cushion', kind: 'outdoor', def: p.fabric || 'linen-white' },
    base: { label: 'Frame', kind: 'wood', def: p.base || 'teak' }
  } };
  const w = 0.72, l = 2.0;
  add(b, 'base', tr(rbox(w, 0.08, l, 0.02), 0, 0.28, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(b, 'base', tr(rbox(0.06, 0.28, 0.06, 0.01), x * (w / 2 - 0.05), 0.14, z * (l / 2 - 0.08)));
  add(b, 'upholstery', tr(cushion(w - 0.06, 0.08, l * 0.62, 0.035, 0.015), 0, 0.36, l * 0.17));
  add(b, 'upholstery', tr(cushion(w - 0.06, 0.08, l * 0.36, 0.035, 0.015).rotateX(0.6), 0, 0.5, -l * 0.3));
  return b;
}
function cabana(p: P): Built {
  const w = p.w || 3.2, d = p.d || 3.2, h = 2.8;
  const b: Built = { parts: {}, slots: {
    frame: { label: 'Timber', kind: 'wood', def: p.frame || 'teak' },
    curtain: { label: 'Curtains', kind: 'fabric', def: p.curtain || 'linen-white' },
    upholstery: { label: 'Daybed', kind: 'outdoor', def: p.fabric || 'linen-white' }
  } };
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(b, 'frame', tr(rbox(0.14, h, 0.14, 0.01), x * (w / 2 - 0.07), h / 2, z * (d / 2 - 0.07)));
  // slatted roof and back screen
  for (let i = 0; i < 16; i++) add(b, 'frame', tr(rbox(w + 0.2, 0.05, 0.06, 0.005), 0, h + 0.03, -d / 2 + (d * (i + 0.5)) / 16));
  for (let i = 0; i < 18; i++) add(b, 'frame', tr(rbox(0.05, h - 0.1, 0.06, 0.005), -w / 2 + (w * (i + 0.5)) / 18, (h - 0.1) / 2, -d / 2 + 0.03));
  for (const sx of [-1, 1]) add(b, 'curtain', tr(new THREE.PlaneGeometry(0.9, h - 0.15).translate(0, (h - 0.15) / 2, 0).rotateY(Math.PI / 2), sx * (w / 2 - 0.02), 0.05, d / 2 - 0.5));
  add(b, 'frame', tr(rbox(w - 0.6, 0.3, d - 1.0, 0.03), 0, 0.15, 0.1));
  add(b, 'upholstery', tr(cushion(w - 0.7, 0.14, d - 1.1, 0.06, 0.02), 0, 0.37, 0.1));
  return b;
}
function treadmill(p: P): Built {
  const b: Built = { parts: {}, slots: {}, fixed: { body: 'gym-black', belt: 'tyre', screen: 'screen-on', rail: 'nickel' } };
  add(b, 'body', tr(rbox(0.85, 0.22, 2.0, 0.05), 0, 0.11, 0));
  add(b, 'belt', tr(rbox(0.56, 0.02, 1.6, 0.005), 0, 0.23, 0.12));
  for (const sx of [-1, 1]) add(b, 'rail', tube([[sx * 0.38, 0.2, -0.75], [sx * 0.38, 1.25, -0.82], [sx * 0.38, 1.15, -0.55]], 0.022, 12));
  add(b, 'body', tr(rbox(0.8, 0.12, 0.2, 0.03).rotateX(-0.5), 0, 1.3, -0.85));
  add(b, 'screen', tr(rbox(0.5, 0.32, 0.03, 0.01).rotateX(-0.35), 0, 1.5, -0.84));
  return b;
}
function bike(p: P): Built {
  const b: Built = { parts: {}, slots: {}, fixed: { body: 'gym-black', seat: 'leather-black', rail: 'nickel' } };
  add(b, 'body', tr(rbox(0.5, 0.08, 1.15, 0.03), 0, 0.04, 0));
  add(b, 'body', tube([[0, 0.08, 0.35], [0, 0.6, 0.15], [0, 0.95, -0.35]], 0.05, 12));
  add(b, 'body', tr(cyl(0.26, 0.26, 0.08, 24).rotateZ(Math.PI / 2), 0, 0.35, -0.3));
  add(b, 'seat', tr(rbox(0.24, 0.08, 0.3, 0.03), 0, 0.92, 0.25));
  add(b, 'rail', tube([[0, 0.95, -0.35], [0, 1.15, -0.4], [0.2, 1.2, -0.48], [-0.2, 1.2, -0.48]], 0.016, 12));
  return b;
}
function reformer(p: P): Built {
  const b: Built = { parts: {}, slots: { pad: { label: 'Pads', kind: 'upholstery', def: p.pad || 'leather-black' } }, fixed: { frame: p.frame || 'oak', rail: 'black-steel' } };
  add(b, 'frame', tr(rbox(0.72, 0.28, 2.45, 0.03), 0, 0.14, 0));
  add(b, 'pad', tr(cushion(0.6, 0.08, 0.95, 0.03, 0.01), 0, 0.33, 0.15));
  add(b, 'rail', tube([[-0.3, 0.3, -1.1], [-0.3, 0.7, -1.15], [0.3, 0.7, -1.15], [0.3, 0.3, -1.1]], 0.018, 16));
  return b;
}
function weights(p: P): Built {
  const w = p.w || 2.0;
  const b: Built = { parts: {}, slots: {}, fixed: { frame: 'black-steel', bell: 'gym-black', grip: 'nickel' } };
  for (const sx of [-1, 1]) add(b, 'frame', tr(rbox(0.06, 0.8, 0.5, 0.01), sx * (w / 2 - 0.03), 0.4, 0));
  for (const y of [0.35, 0.7]) add(b, 'frame', tr(rbox(w, 0.04, 0.45, 0.005), 0, y, 0));
  const n = Math.round(w / 0.22);
  for (let i = 0; i < n; i++) for (const [y, r] of [[0.42, 0.06], [0.77, 0.05]]) {
    const x = -w / 2 + 0.15 + ((w - 0.3) * i) / Math.max(1, n - 1);
    add(b, 'grip', tr(cyl(0.015, 0.015, 0.22, 8).rotateX(Math.PI / 2), x, y, -0.11));
    for (const z of [-0.12, 0.12]) add(b, 'bell', tr(cyl(r, r, 0.05, 16).rotateX(Math.PI / 2), x, y, z));
  }
  return b;
}
function massage(p: P): Built {
  const b: Built = { parts: {}, slots: { pad: { label: 'Mattress', kind: 'upholstery', def: p.pad || 'wool-taupe' }, frame: { label: 'Frame', kind: 'wood', def: p.frame || 'wd508' } }, fixed: { towel: 'linen-white' } };
  add(b, 'frame', tr(rbox(0.8, 0.06, 2.0, 0.01), 0, 0.58, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(b, 'frame', tr(rbox(0.07, 0.58, 0.07, 0.01), x * 0.34, 0.29, z * 0.9));
  add(b, 'frame', tr(rbox(0.7, 0.03, 1.8, 0.005), 0, 0.15, 0));
  add(b, 'pad', tr(cushion(0.78, 0.1, 1.98, 0.04, 0.01), 0, 0.66, 0));
  add(b, 'towel', tr(rbox(0.55, 0.012, 0.7, 0.004), 0, 0.72, 0.35));
  return b;
}
function reception(p: P): Built {
  const w = p.w || 3.2, d = p.d || 0.9;
  const b: Built = { parts: {}, slots: { top: { label: 'Stone', kind: 'stone', def: p.top || 'nero' } } };
  add(b, 'top', extrudeUp(squircle(w / 2, d / 2, 3.2, 64), 0, 1.08, 0.06, undefined, 48, 4));
  add(b, 'top', extrudeUp(squircle(w * 0.18, d * 0.4, 3, 48).map(([x, z]) => [x + w * 0.42, z + 0.05] as V2), 0, 0.78, 0.05, undefined, 32, 4));
  return b;
}
function car(p: P): Built {
  const b: Built = { parts: {}, slots: {}, fixed: { body: 'car-paint', glass: 'glass-smoke', tyre: 'tyre', rim: 'nickel' } };
  const l = 4.9, w = 1.98;
  add(b, 'body', extrudeUp(squircle(w / 2, l / 2, 6, 48), 0.32, 0.72, 0.08, undefined, 32, 3));
  add(b, 'glass', extrudeUp(squircle(w / 2 - 0.08, l / 2 - 0.85, 5, 48).map(([x, z]) => [x, z + 0.1] as V2), 1.0, 0.55, 0.08, undefined, 32, 3));
  add(b, 'body', extrudeUp(squircle(w / 2 - 0.12, l / 2 - 1.05, 5, 32).map(([x, z]) => [x, z + 0.1] as V2), 1.52, 0.06, 0.02, undefined, 24));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    add(b, 'tyre', tr(cyl(0.38, 0.38, 0.26, 24).rotateZ(Math.PI / 2), x * (w / 2 - 0.12), 0.38, z * 1.5));
    add(b, 'rim', tr(cyl(0.22, 0.22, 0.27, 16).rotateZ(Math.PI / 2), x * (w / 2 - 0.12), 0.38, z * 1.5));
  }
  return b;
}
function bollard(p: P): Built {
  const b: Built = { parts: {}, slots: { metal: { label: 'Metal', kind: 'metal', def: p.metal || 'ml501' } } };
  add(b, 'metal', lathe([[0, 0], [0.11, 0], [0.11, 0.85], [0.09, 0.9], [0, 0.9]], 24));
  return b;
}
function lockers(p: P): Built {
  const w = p.w || 3.0, h = p.h || 2.4, d = 0.55;
  const b: Built = { parts: {}, slots: { body: { label: 'Lockers', kind: 'wood', def: p.body || 'wd504' } }, fixed: { handle: 'ml505' } };
  add(b, 'body', tr(rbox(w, h, d, 0.004), 0, h / 2, 0));
  const n = Math.max(1, Math.round(w / 0.5));
  for (let i = 1; i < n; i++) add(b, 'handle', tr(rbox(0.006, h - 0.1, 0.006, 0.001), -w / 2 + (w * i) / n, h / 2, d / 2));
  for (let i = 0; i < n; i++) add(b, 'handle', tr(rbox(0.02, 0.18, 0.02, 0.004), -w / 2 + (w * (i + 0.5)) / n + 0.18, h * 0.55, d / 2 + 0.01));
  return b;
}
function hotpool(p: P): Built {
  const r = p.r || 2.4;
  const b: Built = { parts: {}, slots: { basin: { label: 'Mosaic', kind: 'floor', def: p.tile || 'tl502' } }, fixed: { water: 'water', ring: 'nickel' } };
  add(b, 'basin', extrudeUp(ellipse(r + 0.35, r + 0.35, 64), 0, 0.55, 0.04, [ellipse(r, r, 64)], 64));
  add(b, 'basin', extrudeUp(ellipse(r, r, 64), 0, 0.02, 0, undefined, 64));
  add(b, 'water', extrudeUp(ellipse(r - 0.01, r - 0.01, 64), 0.45, 0.01, 0, undefined, 64));
  // the Aquamoon rain disc on the ceiling
  add(b, 'ring', tr(new THREE.RingGeometry(0.22, 0.62, 48).rotateX(Math.PI / 2), 0, (p.ceil || 4.6) - 0.02, 0));
  b.noShadow = ['water'];
  return b;
}
function steamBench(p: P): Built {
  const b: Built = { parts: {}, slots: { top: { label: 'Mosaic', kind: 'floor', def: p.tile || 'tl501' } } };
  const path: V2[] = p.path || [[-2, 0], [0, 0.4], [2, 0]];
  add(b, 'top', extrudeUp(band(path, 0.55, 1), 0, 0.46, 0.06, undefined, 32, 3));
  return b;
}
function canopyTree(p: P): Built {
  return plant({ style: 'tree', r: p.r || 1.6, h: p.h || 1.8, trunk: p.trunk || 2.2, pr: p.pr ?? 0.8, ph: p.ph ?? 0.7, leaf: 0.14, n: p.n || 900, seed: p.seed || 3, pot: p.pot || 'pot-concrete' });
}

export const BUILDERS: Record<string, (p: P) => Built> = {
  sofa, armchair, diningChair, table, bed, nightstand, lamp, bench, rug, plant, sculpture, island, counter, vanity, tub, wc, shelving, wardrobe, daybed, decor, art, pier, glassScreen, hood, tallRun, bar, soffit,
  pool, lounger, cabana, treadmill, bike, reformer, weights, massage, reception, car, bollard, lockers, hotpool, steamBench, canopyTree
};
