import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Select } from '@react-three/postprocessing';
import { ITEMS, Item, groupKey } from '../data/furniture';
import { BUILDERS, Built } from './builders';
import { merge } from './geo';
import { getMat } from './matlib';
import { useStore } from '../store';
import { wx, wz, S } from '../data/plan';
import { refreshShadows } from './redraw';

export interface BuiltItem { item: Item; built: Built; geos: Record<string, THREE.BufferGeometry>; bounds: THREE.Box3 }
const cache = new Map<string, BuiltItem>();

function buildItem(it: Item): BuiltItem {
  const hit = cache.get(it.id);
  if (hit) return hit;
  const p = { ...(it.p || {}) };
  if (p.pathPx) p.path = (p.pathPx as number[][]).map(([x, y]) => [(x - it.x) * S, (y - it.y) * S]);
  const fn = BUILDERS[it.type];
  const built: Built = fn ? fn(p) : { parts: {}, slots: {} };
  const geos: Record<string, THREE.BufferGeometry> = {};
  for (const [slot, gs] of Object.entries(built.parts)) {
    if (!gs.length) continue;
    const g = merge(gs);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    geos[slot] = g;
  }
  const m = new THREE.Matrix4().compose(new THREE.Vector3(wx(it.x), 0, wz(it.y)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((it.rot || 0) * Math.PI) / 180), new THREE.Vector3(1, 1, 1));
  const bounds = new THREE.Box3();
  for (const g of Object.values(geos)) if (g.boundingBox) bounds.union(g.boundingBox.clone().applyMatrix4(m));
  const r = { item: it, built, geos, bounds };
  cache.set(it.id, r);
  return r;
}
export function getBuilt(id: string): BuiltItem | null {
  const it = ITEMS.find((i) => i.id === id);
  return it ? buildItem(it) : null;
}
export function itemBounds(id: string): THREE.Box3 | null {
  const b = getBuilt(id);
  return b ? b.bounds : null;
}
export function matFor(it: Item, built: Built, slot: string, overrides: Record<string, Record<string, string>>): string {
  const o = overrides[groupKey(it)];
  if (o && o[slot]) return o[slot];
  if (built.slots[slot]) return built.slots[slot].def;
  return (built.fixed && built.fixed[slot]) || 'boucle-ivory';
}

function Piece({ b, interactive = true }: { b: BuiltItem; interactive?: boolean }) {
  const { item } = b;
  const overrides = useStore((s) => s.overrides);
  const hover = useStore((s) => s.hoverItem);
  const sel = useStore((s) => s.itemId);
  const set = useStore((s) => s.set);
  const selectItem = useStore((s) => s.selectItem);
  const pick = interactive && item.pick !== false;
  const k = groupKey(item);
  const hi = pick && ((hover && (hover === item.id || groupOf(hover) === k)) || (sel && (sel === item.id || groupOf(sel) === k)));
  const handlers = pick ? {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); set({ hoverItem: item.id }); document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { if (useStore.getState().hoverItem === item.id) set({ hoverItem: null }); document.body.style.cursor = ''; },
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta > 6) return; selectItem(item.id); set({ panel: null }); }
  } : {};
  const noShadow = new Set(b.built.noShadow || []);
  return (
    <group position={[wx(item.x), 0, wz(item.y)]} rotation={[0, ((item.rot || 0) * Math.PI) / 180, 0]} name={item.id} {...handlers}>
      <Select enabled={!!hi}>
        {Object.entries(b.geos).map(([slot, g]) => (
          <mesh key={slot} geometry={g} material={getMat(matFor(item, b.built, slot, overrides))} castShadow={!noShadow.has(slot)} receiveShadow />
        ))}
      </Select>
    </group>
  );
}
const groupOf = (id: string) => { const it = ITEMS.find((i) => i.id === id); return it ? groupKey(it) : id; };

export function Furniture({ interactive = true }: { interactive?: boolean } = {}) {
  const finish = useStore((s) => s.finish);
  const all = useMemo(() => ITEMS.map(buildItem), []);
  const dressedRef = useRef<THREE.Group>(null!);
  const anim = useRef({ t: finish === 'dressed' ? 1 : 0, target: finish === 'dressed' ? 1 : 0 });
  useEffect(() => { anim.current.target = finish === 'dressed' ? 1 : 0; refreshShadows(); }, [finish]);
  useFrame((state, dt) => {
    const a = anim.current;
    if (a.t === a.target) return;
    a.t = a.target > a.t ? Math.min(a.target, a.t + dt * 2.2) : Math.max(a.target, a.t - dt * 2.8);
    const g = dressedRef.current;
    if (!g) return;
    const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
    g.visible = a.t > 0.001;
    g.scale.set(1, Math.max(0.001, e), 1);
    // keep drawing (with the shadow following the furniture) until the animation settles
    refreshShadows(2);
    state.invalidate();
  });
  const fixed = all.filter((b) => b.item.finish === 'both');
  const loose = all.filter((b) => b.item.finish !== 'both');
  return (
    <group>
      <group>{fixed.map((b) => <Piece key={b.item.id} b={b} interactive={interactive} />)}</group>
      <group ref={dressedRef} visible={finish === 'dressed'}>{loose.map((b) => <Piece key={b.item.id} b={b} interactive={interactive} />)}</group>
    </group>
  );
}
