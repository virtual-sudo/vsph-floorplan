// Meshes the soft upholstery once and stores it, simplified, in public/furniture/soft.bin, so the app doesn't spend
// seconds shaping it on every visit. Run `npm run bake` after changing a soft piece or its parameters in
// src/data/furniture.ts (the app still meshes anything the file lacks, just more slowly).
import * as THREE from 'three';
import { writeFileSync, mkdirSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ITEMS } from '../src/data/furniture';
import { BUILDERS, Built } from '../src/three/builders';
import { softCache } from '../src/three/soft/seating';
import { encodeBaked } from '../src/three/soft/baked';

const S = 1 / 58;
const RATIO = 0.24; // keep about a quarter of the triangles
const ERROR = 0.0025; // at most ~2.5 mm away from the full-resolution surface (absolute, metres)

await MeshoptSimplifier.ready;
const t0 = performance.now();
for (const it of ITEMS) {
  const p: Record<string, any> = { ...(it.p || {}) };
  const soft = (it.type === 'sofa' && p.style === 'soft') || (it.type === 'armchair' && (p.style === 'club2' || p.style === 'lounge'));
  if (!soft) continue;
  if (p.pathPx) p.path = (p.pathPx as number[][]).map(([x, y]) => [(x - it.x) * S, (y - it.y) * S]);
  BUILDERS[it.type](p);
}
function simplify(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.index || g.index.count < 3000) return g;
  const pos = new Float32Array(g.getAttribute('position').array as ArrayLike<number>);
  const nrm = new Float32Array(g.getAttribute('normal').array as ArrayLike<number>);
  const idx = new Uint32Array(g.index.array as ArrayLike<number>);
  const target = Math.floor((idx.length * RATIO) / 3) * 3;
  const [out] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, nrm, 3, [0.4, 0.4, 0.4], null, target, ERROR, ['ErrorAbsolute']);
  const [remap, count] = MeshoptSimplifier.compactMesh(out);
  const p2 = new Float32Array(count * 3), n2 = new Float32Array(count * 3);
  for (let v = 0; v < remap.length; v++) { const r = remap[v]; if (r === 0xffffffff) continue; for (let k = 0; k < 3; k++) { p2[r * 3 + k] = pos[v * 3 + k]; n2[r * 3 + k] = nrm[v * 3 + k]; } }
  const s = new THREE.BufferGeometry();
  s.setAttribute('position', new THREE.BufferAttribute(p2, 3));
  s.setAttribute('normal', new THREE.BufferAttribute(n2, 3));
  s.setIndex(new THREE.BufferAttribute(out, 1));
  return s;
}
const entries: { key: string; built: Built }[] = [];
let before = 0, after = 0;
for (const [key, built] of softCache) {
  const parts: Built['parts'] = {};
  for (const [slot, gs] of Object.entries(built.parts)) {
    parts[slot] = gs.map((g) => {
      // the soft parts are indexed surface nets; the scatter cushions get shared vertices here
      const ig = g.index ? g : mergeVertices(g.deleteAttribute('uv'), 1e-5);
      const s = simplify(ig);
      before += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      after += (s.index ? s.index.count : s.getAttribute('position').count) / 3;
      return s;
    });
  }
  entries.push({ key, built: { ...built, parts } });
}
const bin = encodeBaked(entries);
mkdirSync('public/furniture', { recursive: true });
writeFileSync('public/furniture/soft.bin', bin);
console.log(`${entries.length} soft pieces: ${Math.round(before / 1000)}k -> ${Math.round(after / 1000)}k triangles, ${(bin.byteLength / 1048576).toFixed(2)} MB, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
