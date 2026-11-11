import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V2 = [number, number]; // [x, z] in metres (local or world)

// Box-projected UVs in metres, so every texture keeps its real-world scale on any shape
export function worldUV(g: THREE.BufferGeometry, scale = 1): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  let n = g.getAttribute('normal');
  if (!n) { g.computeVertexNormals(); n = g.getAttribute('normal'); }
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function rbox(w: number, h: number, d: number, r = 0.02, segs = 3): THREE.BufferGeometry {
  const rr = Math.max(0.0005, Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005, d / 2 - 0.0005));
  const g = new RoundedBoxGeometry(w, h, d, segs, rr);
  return worldUV(g);
}

// a soft cushion: rounded box whose top (and a little the bottom) domes up in the middle
export function cushion(w: number, h: number, d: number, r = 0.05, bulge = 0.03, segs = 4): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, segs, Math.min(r, h / 2 - 0.001, w / 2 - 0.001, d / 2 - 0.001));
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = p.getY(i), z = p.getZ(i) / (d / 2);
    const f = Math.max(0, 1 - x * x) * Math.max(0, 1 - z * z);
    if (y > 0) p.setY(i, y + bulge * f);
    else p.setY(i, y - bulge * 0.25 * f);
  }
  g.computeVertexNormals();
  return worldUV(g);
}

function toShape(pts: V2[], holes?: V2[][]): THREE.Shape {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  if (holes) for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  return s;
}

// Extrude a footprint upward from y0 by h; optional bevel rounds the edges (for cushions, table tops, organic shapes)
export function extrudeUp(pts: V2[], y0: number, h: number, bevel = 0, holes?: V2[][], curveSegs = 24, bevelSegs = 3): THREE.BufferGeometry {
  const b = Math.min(bevel, h / 2 - 0.0005);
  const g = new THREE.ExtrudeGeometry(toShape(pts, holes), {
    depth: Math.max(0.0005, h - 2 * Math.max(0, b)),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: bevelSegs,
    curveSegments: curveSegs
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + Math.max(0, b), 0);
  g.computeVertexNormals();
  return worldUV(g);
}

export function ellipse(rx: number, rz: number, n = 48, cx = 0, cz = 0): V2[] {
  const o: V2[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); }
  return o;
}
// superellipse (squircle) footprint, p = 2 is an ellipse, p = 4 a soft rectangle
export function squircle(rx: number, rz: number, p = 4, n = 64): V2[] {
  const o: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    o.push([Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * rx, Math.sign(s) * Math.pow(Math.abs(s), 2 / p) * rz]);
  }
  return o;
}
// organic pebble outline: an ellipse with a few soft harmonic wobbles
export function pebble(rx: number, rz: number, seed = 1, wob = 0.08, n = 72): V2[] {
  const o: V2[] = [];
  const ph1 = seed * 1.7, ph2 = seed * 2.9, ph3 = seed * 0.6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wob * (Math.sin(2 * a + ph1) * 0.6 + Math.sin(3 * a + ph2) * 0.4 + Math.sin(5 * a + ph3) * 0.15);
    o.push([Math.cos(a) * rx * k, Math.sin(a) * rz * k]);
  }
  return o;
}
// ring sector (for curved sofas, barrel chairs): angles in radians, measured in the x-z plane from +x toward +z
export function arcBand(r0: number, r1: number, a0: number, a1: number, n = 32, cx = 0, cz = 0): V2[] {
  const o: V2[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); o.push([cx + Math.cos(a) * r1, cz + Math.sin(a) * r1]); }
  for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * (i / n); o.push([cx + Math.cos(a) * r0, cz + Math.sin(a) * r0]); }
  return o;
}
// offset an open polyline to a closed band of width w on one side (side 1 = left of travel, mitred corners)
export function offsetLine(path: V2[], w: number, side = 1): V2[] {
  const out: V2[] = [];
  const nrm = (a: V2, b: V2): V2 => { let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; return [-tz * side, tx * side]; };
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    let n: V2;
    if (i === 0) n = nrm(path[0], path[1]);
    else if (i === path.length - 1) n = nrm(path[i - 1], path[i]);
    else {
      const n1 = nrm(path[i - 1], path[i]), n2 = nrm(path[i], path[i + 1]);
      let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
      const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      const d = Math.max(0.35, mx * n1[0] + mz * n1[1]);
      n = [mx / d, mz / d];
    }
    out.push([p[0] + n[0] * w, p[1] + n[1] * w]);
  }
  return out;
}
export function band(path: V2[], w: number, side = 1, start = 0): V2[] {
  const a = start ? offsetLine(path, start, side) : path.map((p) => [p[0], p[1]] as V2);
  const b = offsetLine(path, start + w, side);
  return a.concat(b.reverse());
}
// cut a polyline into pieces of roughly equal arc length
export function splitPath(path: V2[], pieces: number): V2[][] {
  const seg: number[] = []; let L = 0;
  for (let i = 0; i < path.length - 1; i++) { const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); seg.push(d); L += d; }
  const at = (s: number): V2 => {
    let acc = 0;
    for (let i = 0; i < seg.length; i++) { if (acc + seg[i] >= s || i === seg.length - 1) { const t = seg[i] ? Math.min(1, (s - acc) / seg[i]) : 0; return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t]; } acc += seg[i]; }
    return path[path.length - 1];
  };
  const out: V2[][] = [];
  for (let k = 0; k < pieces; k++) {
    const s0 = (L * k) / pieces, s1 = (L * (k + 1)) / pieces;
    const pts: V2[] = [at(s0)];
    let acc = 0;
    for (let i = 0; i < seg.length; i++) { acc += seg[i]; if (acc > s0 + 1e-4 && acc < s1 - 1e-4) pts.push(path[i + 1]); }
    pts.push(at(s1));
    out.push(pts);
  }
  return out;
}
export function pathLength(path: V2[]) { let L = 0; for (let i = 0; i < path.length - 1; i++) L += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); return L; }
// point and unit tangent at arc length s
export function pathAt(path: V2[], s: number): { p: V2; t: V2 } {
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1][0] - path[i][0], dz = path[i + 1][1] - path[i][1], d = Math.hypot(dx, dz);
    if (acc + d >= s || i === path.length - 2) { const t = d ? Math.min(1, Math.max(0, (s - acc) / d)) : 0; return { p: [path[i][0] + dx * t, path[i][1] + dz * t], t: [dx / (d || 1), dz / (d || 1)] }; }
    acc += d;
  }
  return { p: path[0], t: [1, 0] };
}
export function lathe(profile: [number, number][], segs = 40, phiLen = Math.PI * 2, phiStart = 0): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs, phiStart, phiLen);
  g.computeVertexNormals();
  return worldUV(g);
}
export function cyl(rTop: number, rBot: number, h: number, segs = 36, y0 = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs, 1);
  g.translate(0, y0 + h / 2, 0);
  return worldUV(g);
}
export function tube(pts: [number, number, number][], r: number, segs = 48, closed = false): THREE.BufferGeometry {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.2);
  const g = new THREE.TubeGeometry(c, segs, r, 10, closed);
  return worldUV(g);
}
export function sphere(r: number, ws = 24, hs = 16): THREE.BufferGeometry {
  return worldUV(new THREE.SphereGeometry(r, ws, hs));
}

export function merge(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = gs.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') ng.deleteAttribute(k);
    return ng;
  });
  const m = mergeGeometries(clean, false);
  return m || new THREE.BufferGeometry();
}
export { mergeVertices };

export function tr(g: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0): THREE.BufferGeometry {
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

// deterministic pseudo random
export function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
