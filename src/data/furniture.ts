// Furniture and fixtures placed from the dressed plan. x and y are pixels on the 2356 x 1356 plan,
// rot is the turn in degrees (0 = the front faces down the plan, 90 = faces right, 180 = up, -90 = left).
// finish 'both' means the piece is part of the architecture and stays in the bare finish too.
// set groups pieces that change material together (all twelve dining chairs, for example).
import { S } from './plan';

export interface Item {
  id: string;
  type: string;
  name: string;
  room: string;
  x: number;
  y: number;
  rot?: number;
  p?: Record<string, any>;
  set?: string;
  finish?: 'both' | 'dressed';
  pick?: boolean;
  desc?: string;
}

const px = (v: number) => v * S;

const items: Item[] = [
  // ---------------- Bedroom 2 ----------------
  { id: 'b2-rug', type: 'rug', name: 'Runner rug', room: 'bed2', x: 334, y: 232, p: { w: 2.15, d: 6.25, mat: 'rug-navy' } },
  { id: 'b2-rug2', type: 'rug', name: 'Round rug', room: 'bed2', x: 333, y: 95, p: { shape: 'ellipse', rx: 1.05, rz: 1.05, mat: 'rug-teal', t: 0.024 } },
  { id: 'b2-bed', type: 'bed', name: 'King bed', room: 'bed2', x: 340, y: 252, rot: -90, p: { w: 2.0, l: 2.12, head: 'panel', hw: 2.3, hh: 1.15, frame: 'wool-taupe', headboard: 'leather-taupe', bedding: 'bed-dove', throw: 'bed-chambray', accent: 'velvet-olive' }, desc: 'Upholstered king bed with a padded leather headboard.' },
  { id: 'b2-bench', type: 'bench', name: 'Pair of ottomans', room: 'bed2', x: 262, y: 252, rot: -90, p: { style: 'pouf2', w: 1.05, d: 0.48, h: 0.42, fabric: 'velvet-olive' } },
  { id: 'b2-ns1', type: 'nightstand', name: 'Bedside table', room: 'bed2', x: 411, y: 166, rot: -90, set: 'b2-ns', p: { style: 'round', r: 0.24, top: 'walnut' } },
  { id: 'b2-ns2', type: 'nightstand', name: 'Bedside table', room: 'bed2', x: 411, y: 336, rot: -90, set: 'b2-ns', p: { style: 'round', r: 0.24, top: 'walnut' } },
  { id: 'b2-desk', type: 'table', name: 'Writing desk', room: 'bed2', x: 344, y: 66, rot: 0, p: { style: 'desk', w: 1.35, d: 0.55, top: 'walnut', base: 'ebony' } },
  { id: 'b2-desk-chair', type: 'armchair', name: 'Desk chair', room: 'bed2', x: 360, y: 98, rot: 180, p: { style: 'barrel', r: 0.3, fabric: 'leather-cognac' } },
  { id: 'b2-desk-books', type: 'decor', name: 'Books', room: 'bed2', x: 320, y: 64, rot: 10, pick: false, p: { style: 'books', seed: 2 }, },
  { id: 'b2-chaise', type: 'sofa', name: 'Curved chaise', room: 'bed2', x: 246, y: 383, rot: -30, p: { arc: { r: 1.9, a0: 62, a1: 118, cz: -1.9 }, depth: 0.78, backH: 0.62, backT: 0.18, fabric: 'boucle-stone', cushions: 'linen-flax', pillows: false } },
  // terrace
  { id: 'b2t-daybed', type: 'daybed', name: 'Outdoor daybed', room: 'bed2-terrace', x: 80, y: 203, rot: -27, p: { w: 0.9, l: 1.95, fabric: 'linen-white', accent: 'velvet-rust' } },
  { id: 'b2t-side', type: 'table', name: 'Side table', room: 'bed2-terrace', x: 110, y: 253, p: { style: 'drum', r: 0.26, h: 0.42, top: 'lacquer-clay' } },
  { id: 'b2t-plant1', type: 'plant', name: 'Planter', room: 'bed2-terrace', x: 110, y: 126, p: { style: 'bush', r: 0.42, h: 0.8, pr: 0.34, ph: 0.55, seed: 3, pot: 'pot-white' } },
  { id: 'b2t-sculpt', type: 'sculpture', name: 'Stone sculpture', room: 'bed2-terrace', x: 150, y: 108, p: { s: 0.42, n: 3, seed: 2 } },
  { id: 'b2t-plant2', type: 'plant', name: 'Agave', room: 'bed2-terrace', x: 143, y: 146, p: { style: 'spiky', h: 0.7, pr: 0.2, ph: 0.35, seed: 5, pot: 'pot-charcoal' } },
  { id: 'b2t-table', type: 'table', name: 'Outdoor table', room: 'bed2-terrace', x: 97, y: 382, p: { style: 'drum', r: 0.32, h: 0.45, top: 'ceramic-stone' } },
  { id: 'b2t-ch1', type: 'armchair', name: 'Teak lounge chair', room: 'bed2-terrace', x: 143, y: 388, rot: -80, set: 'b2t-ch', p: { style: 'out' } },
  { id: 'b2t-ch2', type: 'armchair', name: 'Teak lounge chair', room: 'bed2-terrace', x: 104, y: 434, rot: 175, set: 'b2t-ch', p: { style: 'out' } },
  { id: 'b2t-plant3', type: 'plant', name: 'Planter', room: 'bed2-terrace', x: 62, y: 375, p: { style: 'spiky', h: 0.6, pr: 0.18, ph: 0.3, seed: 8, pot: 'pot-concrete' } },
  { id: 'b2t-plant4', type: 'plant', name: 'Planter', room: 'bed2-terrace', x: 152, y: 452, p: { style: 'bush', r: 0.4, h: 0.85, pr: 0.33, ph: 0.6, seed: 11, pot: 'pot-white' } },
  { id: 'b2t-plant5', type: 'plant', name: 'Planter', room: 'bed2-terrace', x: 146, y: 522, p: { style: 'bush', r: 0.45, h: 0.9, pr: 0.36, ph: 0.6, seed: 12, pot: 'pot-white' } },

  // ---------------- Bedroom 2 ensuite ----------------
  { id: 'b2b-vanity', type: 'vanity', name: 'Vanity', room: 'bed2-bath', x: 516, y: 66, rot: 0, finish: 'both', p: { w: 2.4, d: 0.5, basins: [-0.55], top: 'calacatta' } },
  { id: 'b2b-wc', type: 'wc', name: 'WC', room: 'bed2-bath', x: 640, y: 88, rot: 0, finish: 'both' },

  // ---------------- Bedroom 3 terrace (bedroom shown empty, as in the tour) ----------------
  { id: 'b3t-plant1', type: 'plant', name: 'Planter', room: 'bed3-terrace', x: 192, y: 612, p: { style: 'bush', r: 0.45, h: 0.95, pr: 0.36, ph: 0.6, seed: 21, pot: 'pot-white' } },
  { id: 'b3t-plant2', type: 'plant', name: 'Agave', room: 'bed3-terrace', x: 200, y: 657, p: { style: 'spiky', h: 0.75, pr: 0.2, ph: 0.35, seed: 22, pot: 'pot-charcoal' } },

  // ---------------- Primary suite ----------------
  { id: 'pr-rug', type: 'rug', name: 'Shag rug', room: 'primary', x: 289, y: 1054, p: { w: 2.95, d: 4.75, mat: 'rug-silver', t: 0.024 } },
  { id: 'pr-bed', type: 'bed', name: 'King bed', room: 'primary', x: 346, y: 1089, rot: -90, p: { w: 2.0, l: 2.1, head: 'wing', hw: 3.75, hh: 1.45, frame: 'linen-sky', headboard: 'linen-sky', bedding: 'bed-white', throw: 'linen-sky', accent: 'wool-slate' }, desc: 'King bed against a bowed, upholstered headboard wall.' },
  { id: 'pr-bench', type: 'bench', name: 'Bed bench', room: 'primary', x: 269, y: 1089, rot: -90, p: { style: 'arms', w: 1.5, d: 0.55, fabric: 'linen-sky', base: 'nickel' } },
  { id: 'pr-ns1', type: 'nightstand', name: 'Bedside table', room: 'primary', x: 386, y: 1000, rot: -90, set: 'pr-ns', p: { style: 'oval', rx: 0.3, rz: 0.22, top: 'smoked-oak', lampMat: 'brass' } },
  { id: 'pr-ns2', type: 'nightstand', name: 'Bedside table', room: 'primary', x: 386, y: 1172, rot: -90, set: 'pr-ns', p: { style: 'oval', rx: 0.3, rz: 0.22, top: 'smoked-oak', lampMat: 'brass' } },
  { id: 'pr-sofa', type: 'sofa', name: 'Chaise sofa', room: 'primary', x: 290, y: 893, rot: 8, p: { path: [[-1.25, -0.38], [1.2, -0.38]], depth: 0.95, fabric: 'wool-mauve', cushions: 'velvet-blush', arms: [false, true], seed: 4 }, desc: 'Lounge sofa in mauve wool.' },
  { id: 'pr-chaise', type: 'bench', name: 'Chaise end', room: 'primary', x: 226, y: 922, rot: -22, set: 'pr-sofa-x', p: { w: 0.9, d: 0.75, h: 0.42, fabric: 'wool-mauve' } },
  { id: 'pr-coffee', type: 'table', name: 'Drum coffee table', room: 'primary', x: 271, y: 955, p: { style: 'drum', r: 0.42, h: 0.36, top: 'nero' } },
  { id: 'pr-coffee-deco', type: 'decor', name: 'Tray', room: 'primary', x: 271, y: 955, pick: false, p: { style: 'books', seed: 7 }, desc: '' },
  { id: 'pr-armchair', type: 'armchair', name: 'Shell chair', room: 'primary', x: 357, y: 1252, rot: 150, p: { style: 'shell', fabric: 'wool-slate', base: 'black-steel' } },
  { id: 'pr-desk', type: 'table', name: 'Desk', room: 'primary', x: 343, y: 1285, rot: 176, p: { style: 'desk', w: 1.7, d: 0.58, top: 'verde', base: 'bronze' } },
  // ensuite
  { id: 'pb-vanity', type: 'vanity', name: 'Double vanity', room: 'primary-bath', x: 456, y: 1100, rot: 90, finish: 'both', p: { w: 3.2, d: 0.52, basins: [0.75, -0.62], top: 'calacatta' } },
  { id: 'pb-tub', type: 'tub', name: 'Freestanding bath', room: 'primary-bath', x: 535, y: 1281, rot: 0, finish: 'both', p: { w: 1.85, d: 0.92 } },
  { id: 'pb-wc', type: 'wc', name: 'WC', room: 'primary-bath', x: 577, y: 1080, rot: 0, finish: 'both' },
  { id: 'pb-wc2', type: 'wc', name: 'WC', room: 'primary-bath', x: 648, y: 1272, rot: 0, finish: 'both' },
  // dressing room
  { id: 'pc-island', type: 'island', name: 'Dressing island', room: 'primary-closet', x: 522, y: 741, rot: 90, finish: 'both', p: { w: 3.4, d: 0.9, h: 0.9, top: 'taj', body: 'smoked-oak' } },
  { id: 'pc-wardrobe1', type: 'wardrobe', name: 'Wardrobe', room: 'primary-closet', x: 449, y: 741, rot: 90, finish: 'both', set: 'pc-wardrobes', p: { w: 3.6, d: 0.58, h: 2.7 } },
  { id: 'pc-wardrobe2', type: 'wardrobe', name: 'Wardrobe', room: 'primary-closet', x: 583, y: 741, rot: -90, finish: 'both', set: 'pc-wardrobes', p: { w: 3.6, d: 0.58, h: 2.7 } },
  // terrace
  { id: 'pt-daybed', type: 'daybed', name: 'Outdoor daybed', room: 'primary-terrace', x: 107, y: 930, rot: 30, p: { w: 0.9, l: 1.9, fabric: 'linen-white', accent: 'velvet-rust' } },
  { id: 'pt-side', type: 'table', name: 'Side table', room: 'primary-terrace', x: 141, y: 952, p: { style: 'drum', r: 0.25, h: 0.42, top: 'lacquer-clay' } },
  { id: 'pt-table', type: 'table', name: 'Outdoor table', room: 'primary-terrace', x: 79, y: 1144, p: { style: 'drum', r: 0.34, h: 0.45, top: 'ceramic-stone' } },
  { id: 'pt-ch1', type: 'armchair', name: 'Teak lounge chair', room: 'primary-terrace', x: 125, y: 1146, rot: -95, set: 'pt-ch', p: { style: 'out' } },
  { id: 'pt-ch2', type: 'armchair', name: 'Teak lounge chair', room: 'primary-terrace', x: 87, y: 1190, rot: 170, set: 'pt-ch', p: { style: 'out' } },
  { id: 'pt-plant1', type: 'plant', name: 'Planter', room: 'primary-terrace', x: 110, y: 1228, p: { style: 'bush', r: 0.42, h: 0.85, pr: 0.34, ph: 0.55, seed: 31, pot: 'pot-white' } },
  { id: 'pt-sculpt', type: 'sculpture', name: 'Stone sculpture', room: 'primary-terrace', x: 150, y: 1250, p: { s: 0.44, n: 3, seed: 5 } },
  { id: 'pt-plant2', type: 'plant', name: 'Planter', room: 'primary-terrace', x: 132, y: 866, p: { style: 'bush', r: 0.45, h: 0.95, pr: 0.36, ph: 0.6, seed: 33, pot: 'pot-white' } },
  { id: 'pt-plant3', type: 'plant', name: 'Planter', room: 'primary-terrace', x: 150, y: 822, p: { style: 'bush', r: 0.42, h: 0.85, pr: 0.33, ph: 0.6, seed: 34, pot: 'pot-white' } },
  { id: 'pt-plant4', type: 'plant', name: 'Agave', room: 'primary-terrace', x: 118, y: 858, p: { style: 'spiky', h: 0.7, pr: 0.18, ph: 0.32, seed: 35, pot: 'pot-charcoal' } },

  // ---------------- Bedroom 4 ----------------
  { id: 'b4-rug', type: 'rug', name: 'Rug', room: 'bed4', x: 941, y: 1142, p: { w: 2.95, d: 2.05, mat: 'rug-silver' } },
  { id: 'b4-bed', type: 'bed', name: 'Queen bed', room: 'bed4', x: 938, y: 1103, rot: 0, p: { w: 1.85, l: 2.12, head: 'wall', hw: 3.05, hh: 1.1, frame: 'wool-charcoal', headboard: 'bed-dove', bedding: 'bed-white', throw: 'bed-espresso', accent: 'velvet-blush', panel: 'walnut' }, desc: 'Queen bed set into a walnut wall panel with reading lights.' },
  { id: 'b4-ns1', type: 'nightstand', name: 'Floating bedside', room: 'bed4', x: 867, y: 1066, set: 'b4-ns', p: { style: 'float', w: 0.42, d: 0.36, h: 0.5, top: 'walnut', lampStyle: 'globe', lx: 0, lz: 0 } },
  { id: 'b4-ns2', type: 'nightstand', name: 'Floating bedside', room: 'bed4', x: 1010, y: 1066, set: 'b4-ns', p: { style: 'float', w: 0.42, d: 0.36, h: 0.5, top: 'walnut', lampStyle: 'globe', lx: 0, lz: 0 } },
  { id: 'b4-bench', type: 'bench', name: 'Bed bench', room: 'bed4', x: 940, y: 1183, rot: 0, p: { w: 1.7, d: 0.46, fabric: 'boucle-ivory' } },
  { id: 'b4-chair', type: 'armchair', name: 'Reading chair', room: 'bed4', x: 868, y: 1238, rot: 35, p: { style: 'barrel', r: 0.36, fabric: 'boucle-ivory' } },
  { id: 'b4-desk', type: 'table', name: 'Desk', room: 'bed4', x: 899, y: 1270, rot: 193, p: { style: 'desk', w: 1.7, d: 0.55, top: 'verde', base: 'bronze' } },
  { id: 'b4-plant', type: 'plant', name: 'Plant', room: 'bed4', x: 1019, y: 1233, p: { style: 'spiky', h: 0.75, pr: 0.17, ph: 0.4, seed: 41, pot: 'pot-concrete' } },

  // ---------------- Flex lounge ----------------
  { id: 'fx-rug', type: 'rug', name: 'Rug', room: 'flex', x: 1177, y: 1041, p: { w: 4.25, d: 2.95, mat: 'rug-mist' } },
  { id: 'fx-coffee', type: 'table', name: 'Marble coffee table', room: 'flex', x: 1135, y: 1036, rot: -34, p: { style: 'pebble', rx: 0.72, rz: 0.42, h: 0.36, seed: 2, top: 'calacatta' } },
  { id: 'fx-coffee-deco', type: 'decor', name: 'Vase', room: 'flex', x: 1150, y: 1044, pick: false, p: { style: 'vase' } },
  { id: 'fx-ch1', type: 'armchair', name: 'Lounge chair', room: 'flex', x: 1075, y: 1053, rot: 65, set: 'fx-ch', p: { style: 'shell', r: 0.44, fabric: 'wool-taupe' } },
  { id: 'fx-ch2', type: 'armchair', name: 'Lounge chair', room: 'flex', x: 1131, y: 1098, rot: 170, set: 'fx-ch', p: { style: 'shell', r: 0.44, fabric: 'wool-taupe' } },
  { id: 'fx-side', type: 'table', name: 'Side table', room: 'flex', x: 1102, y: 1074, p: { style: 'drum', r: 0.17, h: 0.45, top: 'nero' } },

  // ---------------- Show kitchen and dining ----------------
  { id: 'k-island', type: 'island', name: 'Kitchen island', room: 'kitchen', x: 1911, y: 156, rot: 0, finish: 'both', p: { w: 3.62, d: 1.28, top: 'marble-island', body: 'oak-kitchen', doors: true, sink: [1.1, 0.15], sinkSize: [0.75, 0.45], tapSide: 1, tapMat: 'black-steel', hob: [-0.28, 0], hobSize: [0.9, 0.55] }, desc: 'Statement island in dark veined marble with waterfall ends, clad in stone toward the dining room; smoked oak cupboards, a dishwasher, an undermount sink and a wide induction hob on the kitchen side.' },
  { id: 'k-hood', type: 'hood', name: 'Range hood', room: 'kitchen', x: 1895, y: 156, finish: 'both', pick: false, p: { style: 'canopy', w: 1.8, d: 0.95, y: 1.95, hh: 0.35 } },
  { id: 'k-bowl', type: 'decor', name: 'Bowl', room: 'kitchen', x: 1828, y: 150, pick: false, p: { style: 'bowl', a: 'ceramic-stone' } },
  { id: 'k-tall', type: 'tallRun', name: 'Tall joinery', room: 'kitchen', x: 1710.6, y: 123.5, rot: 90, finish: 'both', p: { cols: [{ k: 'door', w: 1.07 }, { k: 'oven', w: 0.62 }, { k: 'fridge', w: 1.05 }], joint: 2.25, ovenY: 1.25, ends: true }, desc: 'Floor-to-ceiling smoked rift oak joinery: an integrated fridge-freezer pair, a built-in oven and pantry cupboards.' },
  { id: 'k-halldoor', type: 'tallRun', name: 'Service door', room: 'kitchen', x: 1699.6, y: 228.5, rot: 90, finish: 'both', pick: false, p: { cols: [{ k: 'door', w: 0.88 }], joint: 0, d: 0.05 } },
  { id: 'k-hallceil', type: 'soffit', name: 'Hall ceiling', room: 'dining', x: 1731, y: 635.5, pick: false, p: { w: 1.07, l: 15.17, y: 2.98, slot: -1 } },
  { id: 'd-bar', type: 'bar', name: 'Bar', room: 'dining', x: 1688.2, y: 332, rot: 90, finish: 'both', p: { w: 2.69, d: 0.42, cooler: 0.05, top: 3.08 }, desc: 'Bar in the hall recess: black speckled granite cupboards round a wine cooler, a veined marble top and book-matched splashback, and lit bronze display boxes.' },
  { id: 'd-table', type: 'table', name: 'Dining table', room: 'dining', x: 1937, y: 302, rot: 9, p: { style: 'stadium', rx: 1.92, rz: 0.7, top: 'oak-greywash', runner: 'linen-white', settings: true }, desc: 'Racetrack table for twelve in grey-washed oak on a flared oval pedestal, laid with porcelain, glassware and brass cutlery.' },
  { id: 'd-candles', type: 'decor', name: 'Pampas centrepiece', room: 'dining', x: 1937, y: 302, rot: 9, pick: false, p: { style: 'pampas', lift: 0.755 } },
  { id: 'd-pend1', type: 'lamp', name: 'Branching chandelier', room: 'dining', x: 1937, y: 302, rot: 20, p: { style: 'branch', y: 2.3, metal: 'bronze' }, desc: 'Dark bronze branching chandelier with frosted glass tube lights.' },
  // dining terrace
  { id: 'dt-table', type: 'table', name: 'Outdoor dining table', room: 'dining-terrace', x: 2247, y: 266, p: { style: 'round', r: 0.68, top: 'travertine', base: 'bronze' } },
  { id: 'dt-ch1', type: 'diningChair', name: 'Outdoor chair', room: 'dining-terrace', x: 2219, y: 231, rot: 39, set: 'dt-ch', p: { fabric: 'weave-sand', frame: 'bronze' } },
  { id: 'dt-ch2', type: 'diningChair', name: 'Outdoor chair', room: 'dining-terrace', x: 2222, y: 305, rot: 148, set: 'dt-ch', p: { fabric: 'weave-sand', frame: 'bronze' } },
  { id: 'dt-ch3', type: 'diningChair', name: 'Outdoor chair', room: 'dining-terrace', x: 2291, y: 267, rot: -92, set: 'dt-ch', p: { fabric: 'weave-sand', frame: 'bronze' } },
  { id: 'dt-plant1', type: 'plant', name: 'Olive tree', room: 'dining-terrace', x: 2212, y: 163, p: { style: 'tree', r: 0.55, h: 0.9, trunk: 1.1, pr: 0.38, ph: 0.6, leaf: 0.1, n: 520, seed: 51, pot: 'pot-white' } },
  { id: 'dt-sculpt', type: 'sculpture', name: 'Stone sculpture', room: 'dining-terrace', x: 2206, y: 108, p: { s: 0.4, n: 3, seed: 8 } },
  { id: 'dt-plant2', type: 'plant', name: 'Agave', room: 'dining-terrace', x: 2241, y: 100, p: { style: 'spiky', h: 0.75, pr: 0.2, ph: 0.35, seed: 52, pot: 'pot-charcoal' } },

  // ---------------- Grand living ----------------
  { id: 'l-rug', type: 'rug', name: 'Croc pile rug', room: 'living', x: 1960, y: 700, p: { w: 3.95, d: 8.6, mat: 'rug-croc' } },
  // Grand Living, placed and shaped from the 12K panoramas (work/i2t/: img2threejs specs, fits and reviews).
  // The sectional sits 0.97 m west and 0.38 m north of the dressed plan's position, as fitted to the Grand Living 02
  // photo; its south end runs on past the bolster's scroll, the back slopes into a backless chaise on the north leg.
  { id: 'l-sect', type: 'sofa', name: 'Curved sectional', room: 'living', x: 1904, y: 508, rot: 1.5, p: { style: 'soft', pathPx: [[1837, 653], [1837, 618], [1830, 445], [2002, 448]], backStart: 0.6, backEnd: 5.0, pillows: 4, fabric: 'boucle-pebble-ivory', cushions: 'boucle-oat', seed: 5 }, desc: 'Modular curved sectional in ivory pebble boucle: a round bolster back that scrolls at the end and slopes into a chaise.' },
  { id: 'l-coffee1', type: 'table', name: 'Marble coffee table', room: 'living', x: 1961, y: 555, rot: 0, p: { style: 'pebble', legs: 'cyl2', rx: 0.7, rz: 0.4, h: 0.36, seed: 1, top: 'calacatta' }, desc: 'Pebble-shaped Calacatta slab on two round travertine pedestals.' },
  { id: 'l-deco1', type: 'decor', name: 'Books', room: 'living', x: 1974, y: 551, rot: 20, pick: false, p: { style: 'books', seed: 3 } },
  { id: 'l-swivel1', type: 'armchair', name: 'Swivel barrel chair', room: 'living', x: 1986, y: 638, rot: 180, set: 'l-swivel', p: { style: 'club2', round: true, fabric: 'boucle-ivory' } },
  { id: 'l-swivel2', type: 'armchair', name: 'Swivel barrel chair', room: 'living', x: 2047, y: 638, rot: 180, set: 'l-swivel', p: { style: 'club2', round: true, fabric: 'boucle-ivory' } },
  { id: 'l-side1', type: 'table', name: 'Side table', room: 'living', x: 1935, y: 640, p: { style: 'drum', r: 0.17, h: 0.48, top: 'nero' } },
  { id: 'l-club1', type: 'armchair', name: 'Club tub chair', room: 'living', x: 1875, y: 755, rot: 20, p: { style: 'club2', fabric: 'boucle-pebble-ivory' }, desc: 'Tall tub chair in pebble boucle: one-piece shell on a recessed plinth.' },
  { id: 'l-club2', type: 'armchair', name: 'Lounge chair', room: 'living', x: 2041, y: 755, rot: -119, p: { style: 'lounge', mirror: true, fabric: 'boucle-pebble-ivory' }, desc: 'Deep lounge chair with a bolster wrapping the back and one side.' },
  { id: 'l-side2', type: 'table', name: 'Nesting side tables', room: 'living', x: 1998, y: 728, rot: -30, p: { style: 'nest', top: 'walnut' }, desc: 'Oval walnut tops on antique bronze trumpet stems.' },
  { id: 'l-coffee2', type: 'table', name: 'Marble coffee table', room: 'living', x: 1984, y: 816, rot: 6, p: { style: 'pebble', legs: 'cyl2', rx: 0.66, rz: 0.4, h: 0.36, seed: 3, top: 'calacatta' }, desc: 'Pebble-shaped Calacatta slab on two round travertine pedestals.' },
  { id: 'l-deco2', type: 'decor', name: 'Vase', room: 'living', x: 1972, y: 812, pick: false, p: { style: 'vase' } },
  { id: 'l-sofa', type: 'sofa', name: 'Curved sofa', room: 'living', x: 1968, y: 920, p: { style: 'soft', arc: { r: 4.2, a0: 69, a1: 111, cz: -4.2 }, backStart: 0.35, backEnd: 2.75, pillows: 3, fabric: 'boucle-pebble-ivory', cushions: 'boucle-oat', seed: 6 }, desc: 'Gently curved three-metre sofa in pebble boucle with a round bolster back.' },
  { id: 'l-console', type: 'table', name: 'Sofa console', room: 'living', x: 1956, y: 938, rot: 0, p: { style: 'console', w: 1.95, d: 0.42, h: 0.62, top: 'nero', base: 'walnut' } },
  { id: 'l-console-deco', type: 'decor', name: 'Tray', room: 'living', x: 1930, y: 938, pick: false, p: { style: 'tray' }, desc: '' },
  { id: 'l-wine1', type: 'shelving', name: 'Wine wall', room: 'living', x: 1711, y: 545, rot: 90, finish: 'both', set: 'l-wine', p: { w: 1.5, d: 0.34, h: 2.85, wine: true, body: 'ebony', bottle: 'glass-smoke', shelf: 'bronze', shelves: 6 } },
  { id: 'l-wine2', type: 'shelving', name: 'Wine wall', room: 'living', x: 1711, y: 800, rot: 90, finish: 'both', set: 'l-wine', p: { w: 2.6, d: 0.34, h: 2.85, wine: true, body: 'ebony', bottle: 'glass-smoke', shelf: 'bronze', shelves: 6 } },
  // The wine rooms' fronts as the photos show them (front plane x = 1827, measured from views 4 and 12): veneered
  // piers carrying the two large artworks, smoked glass between them and a bulkhead with a linear air grille over the
  // glass and the corridor opening. The wine walls stand behind the glass.
  { id: 'l-pier1', type: 'pier', name: 'Wine room pier', room: 'living', x: 1818.5, y: 471, rot: 90, finish: 'both', pick: false, p: { w: 1.72, d: 0.29, mat: 'veneer-limed' } },
  { id: 'l-pier2', type: 'pier', name: 'Wine room pier', room: 'living', x: 1818.5, y: 836.5, rot: 90, finish: 'both', pick: false, p: { w: 1.57, d: 0.29, mat: 'veneer-limed' } },
  { id: 'l-wglass1', type: 'glassScreen', name: 'Wine room glass', room: 'living', x: 1824, y: 559.5, rot: 90, finish: 'both', pick: false, p: { w: 1.33 } },
  { id: 'l-wdoor', type: 'glassScreen', name: 'Wine room opening', room: 'living', x: 1824, y: 658.5, rot: 90, finish: 'both', pick: false, p: { w: 2.09, open: true } },
  { id: 'l-wglass2', type: 'glassScreen', name: 'Wine room glass', room: 'living', x: 1824, y: 755, rot: 90, finish: 'both', pick: false, p: { w: 1.24 } },
  { id: 'l-wglass3', type: 'glassScreen', name: 'Wine room glass', room: 'living', x: 1824, y: 910, rot: 90, finish: 'both', pick: false, p: { w: 0.97 } },
  { id: 'l-wside1', type: 'glassScreen', name: 'Wine room glass', room: 'living', x: 1762, y: 598, rot: 0, finish: 'both', pick: false, p: { w: 2.14 } },
  { id: 'l-wside2', type: 'glassScreen', name: 'Wine room glass', room: 'living', x: 1762, y: 719, rot: 180, finish: 'both', pick: false, p: { w: 2.14 } },
  { id: 'l-wside3', type: 'glassScreen', name: 'Wine room glass', room: 'living', x: 1762, y: 938, rot: 0, finish: 'both', pick: false, p: { w: 2.14 } },
  // artworks, sized and hung as measured in the photos; pictures straightened from the 360 photos
  { id: 'l-art1', type: 'art', name: 'Stacked stones print', room: 'living', x: 2082, y: 469.5, rot: -90, p: { w: 1.17, h: 1.62, cy: 1.74, art: 'art-stones-a', fw: 0.018 }, desc: 'Framed print of stacked stone forms in black steel.' },
  { id: 'l-art2', type: 'art', name: 'Stacked stones print', room: 'living', x: 2082, y: 879, rot: -90, p: { w: 1.17, h: 1.62, cy: 1.74, art: 'art-stones-b', fw: 0.018 }, desc: 'Companion print of stacked stone forms.' },
  { id: 'l-art3', type: 'art', name: 'Carved wave relief', room: 'living', x: 1827, y: 482, rot: 90, p: { w: 1.09, h: 1.82, cy: 1.75, art: 'art-waves', fw: 0.012 }, desc: 'Large carved plaster relief of sweeping lines on the north wine-room pier.' },
  { id: 'l-art4', type: 'art', name: 'Washed abstract', room: 'living', x: 1827, y: 836, rot: 90, p: { w: 0.93, h: 1.69, cy: 1.725, art: 'art-rain', fw: 0.012 }, desc: 'Washed mineral abstract on linen on the south wine-room pier.' },
  { id: 'l-floorlamp', type: 'lamp', name: 'Floor lamp', room: 'living', x: 1900, y: 488, p: { style: 'floor', metal: 'brass' } },
  // living terrace
  { id: 'lt-plant1', type: 'plant', name: 'Agave', room: 'living-terrace', x: 2202, y: 466, p: { style: 'spiky', h: 0.75, pr: 0.2, ph: 0.38, seed: 61, pot: 'pot-charcoal' } },
  { id: 'lt-plant2', type: 'plant', name: 'Planter', room: 'living-terrace', x: 2205, y: 500, p: { style: 'bush', r: 0.42, h: 0.85, pr: 0.34, ph: 0.6, seed: 62, pot: 'pot-white' } },
  { id: 'lt-plant3', type: 'plant', name: 'Olive tree', room: 'living-terrace', x: 2150, y: 552, p: { style: 'tree', r: 0.62, h: 1.0, trunk: 1.15, pr: 0.45, ph: 0.6, leaf: 0.1, n: 620, seed: 63, pot: 'pot-white' } },
  { id: 'lt-plant4', type: 'plant', name: 'Planter', room: 'living-terrace', x: 2067, y: 532, p: { style: 'bush', r: 0.3, h: 0.6, pr: 0.22, ph: 0.4, seed: 64, pot: 'pot-concrete' } },
  { id: 'lt-sculpt', type: 'sculpture', name: 'Stone sculpture', room: 'living-terrace', x: 2140, y: 808, p: { s: 0.5, n: 3, seed: 11 } },
  { id: 'lt-plant5', type: 'plant', name: 'Agave', room: 'living-terrace', x: 2165, y: 780, p: { style: 'spiky', h: 0.8, pr: 0.2, ph: 0.38, seed: 65, pot: 'pot-charcoal' } },
  { id: 'lt-plant6', type: 'plant', name: 'Planter', room: 'living-terrace', x: 2198, y: 822, p: { style: 'bush', r: 0.45, h: 0.9, pr: 0.36, ph: 0.6, seed: 66, pot: 'pot-white' } },
  { id: 'lt-plant7', type: 'plant', name: 'Olive tree', room: 'living-terrace', x: 2228, y: 868, p: { style: 'tree', r: 0.55, h: 0.9, trunk: 1.0, pr: 0.4, ph: 0.6, leaf: 0.1, n: 520, seed: 67, pot: 'pot-white' } },

  // ---------------- Salon ----------------
  { id: 's-rug', type: 'rug', name: 'Organic rug', room: 'salon', x: 1925, y: 1176, rot: 8, p: { shape: 'pebble', rx: 2.45, rz: 2.1, seed: 4, mat: 'rug-silver' } },
  { id: 's-sofa', type: 'sofa', name: 'Curved sofa', room: 'salon', x: 1935, y: 1190, p: { arc: { r: 2.08, a0: 172, a1: 258 }, depth: 0.95, fabric: 'wool-mauve', cushions: 'velvet-blush', seed: 8 }, desc: 'Bespoke curved sofa in mauve wool.' },
  { id: 's-coffee', type: 'table', name: 'Glass cocktail table', room: 'salon', x: 1940, y: 1176, rot: 10, p: { style: 'glass', rx: 0.68, rz: 0.85, h: 0.38, top: 'glass-green', base: 'chrome' } },
  { id: 's-deco', type: 'decor', name: 'Bowl', room: 'salon', x: 1945, y: 1165, pick: false, p: { style: 'bowl', a: 'lacquer-clay' } },
  { id: 's-side1', type: 'table', name: 'Brass side table', room: 'salon', x: 1930, y: 1090, p: { style: 'drum', r: 0.26, h: 0.45, top: 'brass' } },
  { id: 's-side2', type: 'table', name: 'Brass side table', room: 'salon', x: 2026, y: 1131, p: { style: 'drum', r: 0.19, h: 0.5, top: 'brass' } },
  { id: 's-ch1', type: 'armchair', name: 'Shell chair', room: 'salon', x: 2026, y: 1178, rot: -95, p: { style: 'shell', r: 0.42, fabric: 'wool-slate' } },
  { id: 's-ch2', type: 'armchair', name: 'Barrel chair', room: 'salon', x: 1947, y: 1272, rot: 175, p: { style: 'barrel', r: 0.36, fabric: 'velvet-navy' } },
  { id: 's-ch3', type: 'armchair', name: 'Barrel chair', room: 'salon', x: 1862, y: 1236, rot: 127, p: { style: 'barrel', r: 0.36, fabric: 'velvet-blush' } },
  { id: 's-drum1', type: 'table', name: 'Stone drum', room: 'salon', x: 1877, y: 1213, p: { style: 'drum', r: 0.29, h: 0.42, top: 'nero' } },
  { id: 's-drum2', type: 'table', name: 'Stone drum', room: 'salon', x: 1843, y: 1253, p: { style: 'drum', r: 0.25, h: 0.38, top: 'nero' } },
  { id: 's-bar', type: 'table', name: 'Bar console', room: 'salon', x: 2052, y: 1234, rot: -125, p: { style: 'console', w: 2.5, d: 0.42, h: 0.92, top: 'nero', base: 'walnut' } },
  { id: 's-bar-deco', type: 'decor', name: 'Tray', room: 'salon', x: 2052, y: 1234, rot: -125, pick: false, p: { style: 'tray' } },
  // salon terrace
  { id: 'st-ch1', type: 'armchair', name: 'Teak lounge chair', room: 'salon-terrace', x: 2210, y: 977, rot: 45, set: 'st-ch', p: { style: 'out' } },
  { id: 'st-ch2', type: 'armchair', name: 'Teak lounge chair', room: 'salon-terrace', x: 2211, y: 1036, rot: 135, set: 'st-ch', p: { style: 'out' } },
  { id: 'st-side', type: 'table', name: 'Side table', room: 'salon-terrace', x: 2229, y: 1006, p: { style: 'drum', r: 0.26, h: 0.42, top: 'lacquer-clay' } },
  { id: 'st-rug', type: 'rug', name: 'Outdoor rug', room: 'salon-terrace', x: 2248, y: 1127, p: { w: 1.95, d: 1.9, mat: 'rug-terracotta' } },
  { id: 'st-ch3', type: 'armchair', name: 'Teak lounge chair', room: 'salon-terrace', x: 2284, y: 1069, rot: -35, set: 'st-ch', p: { style: 'out' } },
  { id: 'st-ch4', type: 'armchair', name: 'Teak lounge chair', room: 'salon-terrace', x: 2211, y: 1179, rot: 180, set: 'st-ch', p: { style: 'out' } },
  { id: 'st-ch5', type: 'armchair', name: 'Teak lounge chair', room: 'salon-terrace', x: 2271, y: 1179, rot: 180, set: 'st-ch', p: { style: 'out' } },
  { id: 'st-table', type: 'table', name: 'Coffee table', room: 'salon-terrace', x: 2243, y: 1127, p: { style: 'drum', r: 0.32, h: 0.36, top: 'travertine' } },
  { id: 'st-plant1', type: 'plant', name: 'Planter', room: 'salon-terrace', x: 2230, y: 1233, p: { style: 'bush', r: 0.45, h: 0.9, pr: 0.36, ph: 0.6, seed: 71, pot: 'pot-white' } },
  { id: 'st-plant2', type: 'plant', name: 'Planter', room: 'salon-terrace', x: 2245, y: 892, p: { style: 'bush', r: 0.42, h: 0.85, pr: 0.34, ph: 0.6, seed: 72, pot: 'pot-white' } },

  // ---------------- Service kitchen, powder rooms ----------------
  { id: 'sk-counter1', type: 'counter', name: 'Counter', room: 'service-kitchen', x: 1405, y: 168, rot: 90, finish: 'both', p: { w: 2.3, d: 0.6, top: 'calacatta', body: 'lacquer-ivory', upper: true } },
  { id: 'sk-counter2', type: 'counter', name: 'Cooking wall', room: 'service-kitchen', x: 1545, y: 318, rot: 180, finish: 'both', p: { w: 3.3, d: 0.62, top: 'calacatta', body: 'lacquer-ivory', hob: 0.6, upper: true } },
  { id: 'sk-fridge', type: 'counter', name: 'Tall units', room: 'service-kitchen', x: 1457, y: 183, rot: 90, finish: 'both', p: { w: 1.45, d: 0.62, tall: true, body: 'lacquer-sage' } },
  { id: 'pw-wc', type: 'wc', name: 'WC', room: 'gallery', x: 872, y: 330, rot: 180, finish: 'both' },
  { id: 'pw2-wc', type: 'wc', name: 'WC', room: 'study', x: 1345, y: 1062, rot: 90, finish: 'both' },
  { id: 'pw2-vanity', type: 'vanity', name: 'Vanity', room: 'study', x: 1457, y: 1062, rot: -90, finish: 'both', p: { w: 0.9, d: 0.48, basins: [0], top: 'nero', tap: 'bronze' } }
];

// twelve dining chairs around the oval table, facing it
(() => {
  const cx = 1937, cy = 302, rot = 9 * Math.PI / 180, rx = 1.92, rz = 0.7;
  const spots: [number, number][] = [];
  for (const x of [-1.3, -0.65, 0, 0.65, 1.3]) { spots.push([x, -(rz + 0.36)]); spots.push([x, rz + 0.36]); }
  spots.push([-(rx + 0.34), 0]); spots.push([rx + 0.34, 0]);
  spots.forEach(([lx, lz], i) => {
    // rotate the local offset by the table turn (three.js Y rotation)
    const wxo = lx * Math.cos(rot) + lz * Math.sin(rot);
    const wzo = -lx * Math.sin(rot) + lz * Math.cos(rot);
    const x = cx + wxo / S, y = cy + wzo / S;
    const face = Math.atan2(-wxo, -wzo) * 180 / Math.PI;
    items.push({ id: 'd-chair' + (i + 1), type: 'diningChair', name: 'Dining chair', room: 'dining', x, y, rot: face, set: 'd-chairs', p: { style: 'horseshoe', fabric: 'wool-chartreuse', frame: 'oak-greywash' }, desc: 'Horseshoe dining chair in chartreuse wool on solid grey-washed oak legs. Changes apply to all twelve.' });
  });
})();

export const ITEMS = items;
export const itemById = (id: string | null) => items.find((i) => i.id === id) || null;
export const groupKey = (it: Item) => it.set || it.id;
export const pxToM = px;
