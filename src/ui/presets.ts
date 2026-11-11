import { ITEMS, groupKey } from '../data/furniture';
import { getBuilt } from '../three/Furniture';

// Whole-home styling presets: each rule maps a builder type and slot to a material.
export interface Preset { id: string; name: string; note: string; colors: string[]; walls: string; floors?: Record<string, string>; rules: { type: string; slot: string; mat: string; when?: (p: any) => boolean }[] }

export const PRESETS: Preset[] = [
  { id: 'design', name: 'As designed', note: 'The palette in the show unit', colors: ['#e9e2d6', '#6b6a26', '#cbbba0', '#2b3550'], walls: 'paint-warm-white', rules: [] },
  {
    id: 'midnight', name: 'Midnight', note: 'Navy velvet, black marble, smoked oak', colors: ['#1f2b44', '#1c1c1d', '#7d6d60', '#c9a465'], walls: 'paint-greige', floors: { living: 'floor-oak-grey', lobby: 'floor-marble' },
    rules: [
      { type: 'sofa', slot: 'upholstery', mat: 'velvet-navy' },
      { type: 'sofa', slot: 'cushions', mat: 'velvet-rust' },
      { type: 'armchair', slot: 'upholstery', mat: 'leather-cognac' },
      { type: 'diningChair', slot: 'upholstery', mat: 'velvet-navy' },
      { type: 'table', slot: 'top', mat: 'nero', when: (p) => ['pebble', 'drum', 'oval', 'console'].includes(p.style) },
      { type: 'rug', slot: 'rug', mat: 'rug-charcoal' },
      { type: 'bed', slot: 'frame', mat: 'velvet-navy' },
      { type: 'bed', slot: 'headboard', mat: 'velvet-navy' },
      { type: 'bed', slot: 'throw', mat: 'bed-espresso' },
      { type: 'nightstand', slot: 'top', mat: 'ebony' },
      { type: 'island', slot: 'top', mat: 'nero' }
    ]
  },
  {
    id: 'sage', name: 'Sand and sage', note: 'Linen, travertine and soft greens', colors: ['#cbbba0', '#97a08a', '#e3ddd1', '#b9876a'], walls: 'paint-sage', floors: { bedrooms: 'floor-oak-light', hall: 'floor-limestone' },
    rules: [
      { type: 'sofa', slot: 'upholstery', mat: 'linen-flax' },
      { type: 'sofa', slot: 'cushions', mat: 'velvet-moss' },
      { type: 'armchair', slot: 'upholstery', mat: 'boucle-oat' },
      { type: 'diningChair', slot: 'upholstery', mat: 'velvet-moss' },
      { type: 'table', slot: 'top', mat: 'travertine', when: (p) => ['pebble', 'drum', 'oval', 'console'].includes(p.style) },
      { type: 'rug', slot: 'rug', mat: 'rug-sage' },
      { type: 'bed', slot: 'frame', mat: 'linen-flax' },
      { type: 'bed', slot: 'headboard', mat: 'linen-flax' },
      { type: 'bed', slot: 'bedding', mat: 'bed-sand' },
      { type: 'nightstand', slot: 'top', mat: 'ash' },
      { type: 'island', slot: 'top', mat: 'travertine' },
      { type: 'island', slot: 'body', mat: 'oak' }
    ]
  },
  {
    id: 'terracotta', name: 'Terracotta', note: 'Rust velvet, walnut and clay', colors: ['#7a3a22', '#b26a4c', '#80583c', '#e9e2d6'], walls: 'paint-clay', floors: { living: 'floor-herring', lobby: 'floor-limestone' },
    rules: [
      { type: 'sofa', slot: 'upholstery', mat: 'boucle-oat' },
      { type: 'sofa', slot: 'cushions', mat: 'velvet-rust' },
      { type: 'armchair', slot: 'upholstery', mat: 'velvet-rust' },
      { type: 'diningChair', slot: 'upholstery', mat: 'velvet-rust' },
      { type: 'table', slot: 'top', mat: 'walnut', when: (p) => ['drum', 'oval', 'console'].includes(p.style) },
      { type: 'rug', slot: 'rug', mat: 'rug-terracotta' },
      { type: 'bed', slot: 'throw', mat: 'velvet-rust' },
      { type: 'bed', slot: 'frame', mat: 'leather-cognac' },
      { type: 'bed', slot: 'headboard', mat: 'leather-cognac' },
      { type: 'nightstand', slot: 'top', mat: 'walnut' },
      { type: 'island', slot: 'top', mat: 'taj' }
    ]
  }
];

export function presetOverrides(pr: Preset): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const it of ITEMS) {
    for (const r of pr.rules) {
      if (r.type !== it.type) continue;
      if (r.when && !r.when(it.p || {})) continue;
      const b = getBuilt(it.id);
      if (!b || !b.built.slots[r.slot]) continue;
      const k = groupKey(it);
      (out[k] ||= {})[r.slot] = r.mat;
    }
  }
  return out;
}
