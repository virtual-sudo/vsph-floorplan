import * as THREE from 'three';
import { worldUV } from '../geo';

// Soft, welded shapes for upholstery, built from signed distance functions (negative inside) and meshed with
// surface nets: one continuous surface with smooth normals, so a sofa's arm flows into its back without a seam
// and every edge has a real radius. Units are metres in the piece's own frame.

export type SDF = (x: number, y: number, z: number) => number;

// ---- primitives ----
export const len2 = (x: number, y: number) => Math.sqrt(x * x + y * y);
export const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// polynomial smooth minimum: blends two surfaces with a fillet of radius k
export const smin = (a: number, b: number, k: number) => { const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
// 2D rounded rectangle (half sizes bx, by, corner radius r)
export const roundRect = (x: number, y: number, bx: number, by: number, r: number) => {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r;
  return len2(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
// 2D rounded rectangle with its own radius per corner: [top-right, bottom-right, top-left, bottom-left]
export const roundRect4 = (x: number, y: number, bx: number, by: number, r: [number, number, number, number]) => {
  const rr = x > 0 ? (y > 0 ? r[0] : r[1]) : y > 0 ? r[2] : r[3];
  const qx = Math.abs(x) - bx + rr, qy = Math.abs(y) - by + rr;
  return len2(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
};
// a footprint d2 (2D distance in plan) raised between y0 and y1, its edges rolled with radius r
export const extrudeRound = (d2: number, y: number, y0: number, y1: number, r: number) => {
  const wx = d2 + r, wy = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r);
  return Math.min(Math.max(wx, wy), 0) + len2(Math.max(wx, 0), Math.max(wy, 0)) - r;
};

// ---- a path in plan (x, z) with distance and position along it ----
export class PlanPath {
  pts: [number, number][];
  cum: number[];
  total: number;
  constructor(pts: [number, number][]) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.total = this.cum[this.cum.length - 1];
  }
  // nearest point: distance in plan, arc length s, which side (+1 left of travel, -1 right), and whether it is past an end
  nearest(x: number, z: number) {
    let best = 1e9, bs = 0, side = 1, end = 0;
    const p = this.pts;
    for (let i = 0; i < p.length - 1; i++) {
      const ax = p[i][0], az = p[i][1], dx = p[i + 1][0] - ax, dz = p[i + 1][1] - az;
      const L2 = dx * dx + dz * dz || 1e-12;
      const tr = ((x - ax) * dx + (z - az) * dz) / L2, t = clamp(tr, 0, 1);
      const ex = x - (ax + dx * t), ez = z - (az + dz * t), d = ex * ex + ez * ez;
      if (d < best) {
        best = d; bs = this.cum[i] + t * Math.sqrt(L2);
        side = dx * ez - dz * ex >= 0 ? 1 : -1;
        end = i === 0 && tr < 0 ? -1 : i === p.length - 2 && tr > 1 ? 1 : 0;
      }
    }
    return { d: Math.sqrt(best), s: bs, side, end };
  }
  // position along the path (carried on straight past both ends) and signed distance to its side
  frame(x: number, z: number): { s: number; lat: number } {
    const n = this.nearest(x, z);
    if (n.end === 0) return { s: n.s, lat: n.d * n.side };
    const p = this.pts, i = n.end < 0 ? 0 : p.length - 2;
    const dx = p[i + 1][0] - p[i][0], dz = p[i + 1][1] - p[i][1], L = Math.hypot(dx, dz) || 1, tx = dx / L, tz = dz / L;
    const o = n.end < 0 ? p[0] : p[p.length - 1];
    return { s: (n.end < 0 ? 0 : this.total) + (x - o[0]) * tx + (z - o[1]) * tz, lat: tx * (z - o[1]) - tz * (x - o[0]) };
  }
  at(s: number): { x: number; z: number; tx: number; tz: number } {
    const c = this.cum, p = this.pts;
    let i = 0;
    while (i < c.length - 2 && c[i + 1] < s) i++;
    const L = c[i + 1] - c[i] || 1e-9, t = clamp((s - c[i]) / L, 0, 1);
    const dx = (p[i + 1][0] - p[i][0]) / L, dz = (p[i + 1][1] - p[i][1]) / L;
    return { x: p[i][0] + (p[i + 1][0] - p[i][0]) * t, z: p[i][1] + (p[i + 1][1] - p[i][1]) * t, tx: dx, tz: dz };
  }
}
// a polyline that turns corners with arcs of radius r (sampled every ~3 cm)
export function roundedPath(corners: [number, number][], r: number, step = 0.03): [number, number][] {
  if (corners.length < 3) return corners;
  const out: [number, number][] = [corners[0]];
  for (let i = 1; i < corners.length - 1; i++) {
    const [px, pz] = corners[i - 1], [cx, cz] = corners[i], [nx, nz] = corners[i + 1];
    const a = Math.atan2(pz - cz, px - cx), b = Math.atan2(nz - cz, nx - cx);
    let turn = b - a; while (turn > Math.PI) turn -= 2 * Math.PI; while (turn < -Math.PI) turn += 2 * Math.PI;
    const half = Math.abs(turn) / 2, cut = Math.min(r / Math.tan(half), Math.hypot(px - cx, pz - cz) * 0.5, Math.hypot(nx - cx, nz - cz) * 0.5);
    const rr = cut * Math.tan(half);
    const ax = cx + Math.cos(a) * cut, az = cz + Math.sin(a) * cut, bx = cx + Math.cos(b) * cut, bz = cz + Math.sin(b) * cut;
    // arc centre along the bisector
    const bis = a + turn / 2, dc = rr / Math.sin(half);
    const ox = cx + Math.cos(bis) * dc, oz = cz + Math.sin(bis) * dc;
    const s0 = Math.atan2(az - oz, ax - ox), s1 = Math.atan2(bz - oz, bx - ox);
    let sw = s1 - s0; while (sw > Math.PI) sw -= 2 * Math.PI; while (sw < -Math.PI) sw += 2 * Math.PI;
    const n = Math.max(2, Math.ceil((Math.abs(sw) * rr) / step));
    for (let k = 0; k <= n; k++) { const t = s0 + (sw * k) / n; out.push([ox + Math.cos(t) * rr, oz + Math.sin(t) * rr]); }
  }
  out.push(corners[corners.length - 1]);
  return out;
}

// gentle deterministic waviness, for the soft unevenness of stuffed upholstery (a few millimetres)
export function softNoise(seed: number) {
  const r = (k: number) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const f = [3 + r(1) * 3, 4 + r(2) * 3, 5 + r(3) * 3, 2 + r(4) * 2], ph = [r(5) * 6, r(6) * 6, r(7) * 6, r(8) * 6];
  return (x: number, y: number, z: number) =>
    (Math.sin(x * f[0] + ph[0]) * Math.sin(z * f[1] + ph[1]) + Math.sin(y * f[2] + ph[2]) * Math.sin((x + z) * f[3] + ph[3])) * 0.5;
}

// ---- meshing (surface nets) ----
export interface MeshOpts { min: [number, number, number]; max: [number, number, number]; cell: number }
export function meshSDF(f: SDF, o: MeshOpts): THREE.BufferGeometry {
  const c = o.cell;
  const nx = Math.ceil((o.max[0] - o.min[0]) / c) + 1, ny = Math.ceil((o.max[1] - o.min[1]) / c) + 1, nz = Math.ceil((o.max[2] - o.min[2]) / c) + 1;
  const X = (i: number) => o.min[0] + i * c, Y = (j: number) => o.min[1] + j * c, Z = (k: number) => o.min[2] + k * c;
  const v = new Float32Array(nx * ny * nz);
  const id = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  // sample in 4x4x4 blocks; a block far from the surface is filled from its centre value without sampling it all
  const B = 4, reach = c * B * 0.9;
  for (let k0 = 0; k0 < nz; k0 += B) for (let j0 = 0; j0 < ny; j0 += B) for (let i0 = 0; i0 < nx; i0 += B) {
    const i1 = Math.min(nx, i0 + B), j1 = Math.min(ny, j0 + B), k1 = Math.min(nz, k0 + B);
    const dc = f(X((i0 + i1 - 1) / 2), Y((j0 + j1 - 1) / 2), Z((k0 + k1 - 1) / 2));
    const far = Math.abs(dc) > reach * 1.25;
    for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) v[id(i, j, k)] = far ? dc : f(X(i), Y(j), Z(k));
  }
  // one vertex per cell the surface passes through, at the mean of its edge crossings
  const vid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i: number, j: number, k: number) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos: number[] = [];
  const E: [number, number, number, number, number, number][] = [
    [0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1]
  ];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const e of E) {
      const a = v[id(i + e[0], j + e[1], k + e[2])], b = v[id(i + e[3], j + e[4], k + e[5])];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b);
      sx += X(i + e[0] + (e[3] - e[0]) * t); sy += Y(j + e[1] + (e[4] - e[1]) * t); sz += Z(k + e[2] + (e[5] - e[2]) * t); n++;
    }
    if (!n) continue;
    vid[cid(i, j, k)] = pos.length / 3;
    pos.push(sx / n, sy / n, sz / n);
  }
  // pull every vertex onto the true surface (two Newton steps) and take normals from the field's gradient
  const h = c * 0.25, nrm = new Float32Array(pos.length);
  for (let q = 0; q < pos.length; q += 3) {
    let x = pos[q], y = pos[q + 1], z = pos[q + 2];
    let gx = 0, gy = 0, gz = 1;
    for (let it = 0; it < 3; it++) {
      const d = f(x, y, z);
      gx = f(x + h, y, z) - f(x - h, y, z); gy = f(x, y + h, z) - f(x, y - h, z); gz = f(x, y, z + h) - f(x, y, z - h);
      const g = len3(gx, gy, gz) || 1;
      gx /= g; gy /= g; gz /= g;
      if (it < 2) { const step = clamp(d, -c, c); x -= gx * step; y -= gy * step; z -= gz * step; }
    }
    pos[q] = x; pos[q + 1] = y; pos[q + 2] = z;
    nrm[q] = gx; nrm[q + 1] = gy; nrm[q + 2] = gz;
  }
  // a quad for every grid edge the surface crosses, joining the four cells around it
  const idx: number[] = [];
  const quad = (a: number, b: number, cc: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || cc < 0 || d < 0) return;
    if (flip) idx.push(a, b, cc, a, cc, d); else idx.push(a, cc, b, a, d, cc);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = v[id(i, j, k)], b = v[id(i + 1, j, k)]; if ((a < 0) === (b < 0)) continue;
    quad(vid[cid(i, j - 1, k - 1)], vid[cid(i, j, k - 1)], vid[cid(i, j, k)], vid[cid(i, j - 1, k)], a < 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = v[id(i, j, k)], b = v[id(i, j + 1, k)]; if ((a < 0) === (b < 0)) continue;
    quad(vid[cid(i - 1, j, k - 1)], vid[cid(i - 1, j, k)], vid[cid(i, j, k)], vid[cid(i, j, k - 1)], a < 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = v[id(i, j, k)], b = v[id(i, j, k + 1)]; if ((a < 0) === (b < 0)) continue;
    quad(vid[cid(i - 1, j - 1, k)], vid[cid(i, j - 1, k)], vid[cid(i, j, k)], vid[cid(i - 1, j, k)], a < 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return worldUV(g);
}
