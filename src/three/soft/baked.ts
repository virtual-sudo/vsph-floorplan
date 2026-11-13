import * as THREE from 'three';
import { worldUV } from '../geo';
import type { Built } from '../builders';

// The soft upholstery is shaped from distance fields, which takes seconds to mesh. `npm run bake`
// (tools/bake-soft.ts) meshes it once, simplifies it and stores it in public/furniture/soft.bin; the app loads that
// file at start-up and only meshes a piece itself when the file has nothing for it (a new or changed piece).
//
// File: 'SOFT' | header length (u32) | header JSON | data, 4-byte aligned. Positions are 16-bit, quantised in each
// part's box; normals are signed bytes; indices are 16-bit where a part has fewer than 65536 vertices.

export interface BakedPart { n: number; i: number; min: number[]; max: number[]; pos: number; nrm: number; idx: number; wide: boolean }
export interface BakedEntry { key: string; slots: Built['slots']; fixed?: Built['fixed']; noShadow?: string[]; parts: Record<string, BakedPart[]> }

const store = new Map<string, Built>();
export const bakedFor = (key: string) => store.get(key) || null;

export function registerBaked(buf: ArrayBuffer) {
  if (buf.byteLength < 8 || new TextDecoder().decode(new Uint8Array(buf, 0, 4)) !== 'SOFT') return 0;
  const hl = new DataView(buf).getUint32(4, true);
  const head: { v: number; entries: BakedEntry[] } = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
  const base = 8 + Math.ceil(hl / 4) * 4;
  for (const e of head.entries) {
    const parts: Built['parts'] = {};
    for (const [slot, list] of Object.entries(e.parts)) {
      parts[slot] = list.map((p) => {
        const q = new Uint16Array(buf, base + p.pos, p.n * 3), pos = new Float32Array(p.n * 3);
        for (let k = 0; k < 3; k++) {
          const lo = p.min[k], span = (p.max[k] - p.min[k]) / 65535;
          for (let v = 0; v < p.n; v++) pos[v * 3 + k] = lo + q[v * 3 + k] * span;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(buf.slice(base + p.nrm, base + p.nrm + p.n * 3)), 3, true));
        g.setIndex(new THREE.BufferAttribute(p.wide ? new Uint32Array(buf, base + p.idx, p.i) : new Uint16Array(buf, base + p.idx, p.i), 1));
        g.computeBoundingBox();
        g.computeBoundingSphere();
        return worldUV(g);
      });
    }
    store.set(e.key, { parts, slots: e.slots, fixed: e.fixed, noShadow: e.noShadow });
  }
  return head.entries.length;
}

// (used by the bake tool) one entry's geometry, already simplified, into the file layout
export function encodeBaked(entries: { key: string; built: Built }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let off = 0;
  const push = (a: ArrayBufferView) => {
    const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), pad = (4 - (b.byteLength % 4)) % 4;
    const at = off;
    chunks.push(new Uint8Array(b), new Uint8Array(pad));
    off += b.byteLength + pad;
    return at;
  };
  const head: { v: number; entries: BakedEntry[] } = { v: 1, entries: [] };
  for (const { key, built } of entries) {
    const e: BakedEntry = { key, slots: built.slots, fixed: built.fixed, noShadow: built.noShadow, parts: {} };
    for (const [slot, gs] of Object.entries(built.parts)) {
      e.parts[slot] = gs.map((g) => {
        const P = g.getAttribute('position'), N = g.getAttribute('normal'), I = g.index!;
        const n = P.count, min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
        for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) { const x = P.getComponent(v, k); min[k] = Math.min(min[k], x); max[k] = Math.max(max[k], x); }
        const q = new Uint16Array(n * 3), nr = new Int8Array(n * 3);
        for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) {
          q[v * 3 + k] = Math.round(((P.getComponent(v, k) - min[k]) / Math.max(1e-9, max[k] - min[k])) * 65535);
          nr[v * 3 + k] = Math.round(Math.max(-1, Math.min(1, N.getComponent(v, k))) * 127);
        }
        const wide = n >= 65536, idx = wide ? Uint32Array.from(I.array as ArrayLike<number>) : Uint16Array.from(I.array as ArrayLike<number>);
        return { n, i: I.count, min, max, pos: push(q), nrm: push(nr), idx: push(idx), wide };
      });
    }
    head.entries.push(e);
  }
  const hj = new TextEncoder().encode(JSON.stringify(head)), hp = Math.ceil(hj.byteLength / 4) * 4;
  const out = new Uint8Array(8 + hp + off);
  out.set(new TextEncoder().encode('SOFT'), 0);
  new DataView(out.buffer).setUint32(4, hj.byteLength, true);
  out.set(hj, 8);
  let o = 8 + hp;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}
