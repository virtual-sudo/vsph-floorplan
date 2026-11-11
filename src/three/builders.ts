// Procedural furniture. Every builder works in metres in the item's own frame:
// x to the right, z toward the front (where you sit or where the foot of the bed is), y up, origin on the floor.
// A builder returns geometry grouped by material slot. Slots listed in `slots` can be changed in the picker;
// parts under other keys use the fixed material named in `fixed`.
import * as THREE from 'three';
import {
  V2, rbox, cushion, extrudeUp, ellipse, squircle, pebble, arcBand, band, offsetLine, splitPath, pathLength, pathAt,
  lathe, cyl, tube, sphere, tr, rand, worldUV
} from './geo';

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
  return b;
}

// ---------------- tables ----------------
function table(p: P): Built {
  const st = p.style || 'drum';
  const b: Built = { parts: {}, slots: {
    top: { label: 'Top', kind: 'top', def: p.top || 'calacatta' }
  } };
  const base = (def: string, label = 'Base', kind = 'metal') => { b.slots.base = { label, kind, def: p.base || def }; };
  if (st === 'oval') {
    const rx = p.rx || 1.9, rz = p.rz || 0.8, h = p.h || 0.75, t = 0.05;
    add(b, 'top', extrudeUp(ellipse(rx, rz, 96), h - t, t, 0.014, undefined, 96, 3));
    base(p.top || 'travertine', 'Pedestals', 'top');
    for (const sx of [-1, 1]) add(b, 'base', extrudeUp(ellipse(0.17, 0.34, 40, sx * rx * 0.46, 0), 0, h - t, 0.02, undefined, 32));
    if (p.runner !== false) {
      b.slots.runner = { label: 'Runner', kind: 'fabric', def: p.runner || 'linen-white' };
      add(b, 'runner', tr(rbox(rx * 1.72, 0.006, 0.42, 0.002), 0, h + 0.003, 0));
    }
  } else if (st === 'pebble') {
    const rx = p.rx || 0.7, rz = p.rz || 0.4, h = p.h || 0.34;
    add(b, 'top', extrudeUp(pebble(rx, rz, p.seed || 1, 0.09), 0.04, h - 0.04, 0.035, undefined, 72, 4));
    add(b, 'top', extrudeUp(pebble(rx * 0.86, rz * 0.82, p.seed || 1, 0.09), 0, 0.05, 0, undefined, 48));
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
  add(b, 'bedding', tr(rbox(w - 0.08, 0.22, l - 0.08, 0.07), 0, 0.36 + 0.11, 0));
  // duvet over the lower two thirds, folded back at the top
  const dl = l * 0.72;
  const duvet = cushion(w + 0.06, 0.07, dl, 0.035, 0.03, 5);
  tr(duvet, 0, 0.58 + 0.035, l / 2 - dl / 2 + 0.03);
  add(b, 'bedding', duvet);
  add(b, 'bedding', tr(cushion(w + 0.04, 0.07, 0.24, 0.035, 0.02), 0, 0.6 + 0.04, l / 2 - dl - 0.06));
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
function island(p: P): Built {
  const w = p.w || 3.6, d = p.d || 1.25, h = p.h || 0.92, t = 0.05;
  const b: Built = { parts: {}, slots: {
    top: { label: 'Worktop', kind: 'stone', def: p.top || 'patagonia' },
    body: { label: 'Cabinetry', kind: 'wood', def: p.body || 'ebony' }
  }, fixed: { inset: 'black-steel', glass: 'lacquer-black', tap: 'nickel' } };
  add(b, 'body', tr(rbox(w - 2 * t - 0.02, h - t - 0.08, d - 0.1, 0.008), 0, 0.08 + (h - t - 0.08) / 2, 0));
  add(b, 'top', tr(rbox(w, t, d, 0.006), 0, h - t / 2, 0));
  for (const sx of [-1, 1]) add(b, 'top', tr(rbox(t, h - t, d, 0.004), sx * (w / 2 - t / 2), (h - t) / 2, 0));
  if (p.sink) {
    add(b, 'inset', tr(rbox(0.62, 0.006, 0.42, 0.004), p.sink[0], h + 0.001, p.sink[1]));
    add(b, 'tap', tube([[p.sink[0], h, p.sink[1] - 0.28], [p.sink[0], h + 0.38, p.sink[1] - 0.28], [p.sink[0], h + 0.42, p.sink[1] - 0.14], [p.sink[0], h + 0.32, p.sink[1] - 0.06]], 0.014, 24));
  }
  if (p.hob) add(b, 'glass', tr(rbox(0.86, 0.008, 0.52, 0.004), p.hob[0], h + 0.002, p.hob[1]));
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
  }, fixed: { obj1: 'ceramic-stone', obj2: 'lacquer-clay', obj3: 'leather-tan', bulb: 'bulb', bottle: 'glass-bronze' } };
  add(b, 'body', tr(rbox(w, h, 0.04, 0.004), 0, h / 2, -d / 2 + 0.02));
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
  } else if (st === 'candles') {
    for (let i = 0; i < 3; i++) add(b, 'd', tr(lathe([[0, 0], [0.03, 0], [0.012, 0.02], [0.008, 0.18 + i * 0.05], [0.02, 0.2 + i * 0.05], [0, 0.2 + i * 0.05]], 16), (i - 1) * 0.12, 0, 0));
  }
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
  sofa, armchair, diningChair, table, bed, nightstand, lamp, bench, rug, plant, sculpture, island, counter, vanity, tub, wc, shelving, wardrobe, daybed, decor,
  pool, lounger, cabana, treadmill, bike, reformer, weights, massage, reception, car, bollard, lockers, hotpool, steamBench, canopyTree
};
