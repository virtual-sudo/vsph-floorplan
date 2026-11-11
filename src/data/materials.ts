// Material library. Each entry is a physically based finish that any matching slot can take.
// Textures live in public/tex. rep is texture repeats per metre (the geometry carries metre-scale UVs).

export type MatKind =
  | 'fabric' | 'leather' | 'wood' | 'stone' | 'metal' | 'glass' | 'rug'
  | 'lacquer' | 'ceramic' | 'outdoor' | 'paint' | 'foliage' | 'pot' | 'linen' | 'emissive' | 'floor' | 'fixture';

export interface MatDef {
  id: string;
  name: string;
  kind: MatKind;
  color: string;
  map?: string;          // albedo texture
  normal?: string;       // normal map
  rough?: string;        // roughness map
  rep?: number;          // repeats per metre
  rot?: number;          // texture rotation in radians
  normalScale?: number;
  roughness: number;
  metalness?: number;
  sheen?: number;        // fabric sheen 0..1
  sheenColor?: string;
  sheenRoughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  opacity?: number;
  ior?: number;
  emissive?: string;
  emissiveIntensity?: number;
  swatch?: string;       // CSS background for the picker
  spec?: string;         // code in the Park Villas specs book (FCD Specs Book Rev 02, 11 July 2025)
}

const T = (f: string) => 'tex/' + f + '.jpg';

const fabric = (id: string, name: string, color: string, normal = 'fab_linen_n', sheen = 0.6, rough = 0.9, sheenColor?: string): MatDef => ({
  id, name, kind: 'fabric', color, normal: T(normal), rep: normal === 'fab_boucle_n' ? 2.5 : 5, normalScale: normal === 'fab_boucle_n' ? 0.9 : 0.45,
  roughness: rough, sheen, sheenColor: sheenColor || color, sheenRoughness: 0.55
});
const velvet = (id: string, name: string, color: string, sheenColor: string): MatDef => ({
  id, name, kind: 'fabric', color, normal: T('fab_velvet_n'), rep: 1.5, normalScale: 0.35,
  roughness: 0.95, sheen: 1, sheenColor, sheenRoughness: 0.35
});
const leather = (id: string, name: string, color: string): MatDef => ({
  id, name, kind: 'leather', color, normal: T('leather_n'), rep: 6, normalScale: 0.35, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.45
});
const wood = (id: string, name: string, tex: string, color = '#ffffff', rough = 0.48): MatDef => ({
  id, name, kind: 'wood', color, map: T('wood_' + tex), normal: T('wood_' + tex + '_n'), rep: 0.9, normalScale: 0.35, roughness: rough,
  clearcoat: 0.25, clearcoatRoughness: 0.35, swatch: `url(tex/wood_${tex}.jpg) center/180%`
});
const stone = (id: string, name: string, tex: string, rough = 0.18): MatDef => ({
  id, name, kind: 'stone', color: '#ffffff', map: T(tex), rough: tex.startsWith('marble') ? T(tex + '_r') : undefined,
  normal: tex === 'travertine' ? T('travertine_n') : undefined, normalScale: 0.4,
  rep: 0.55, roughness: rough, clearcoat: tex === 'travertine' ? 0 : 0.35, clearcoatRoughness: 0.08, swatch: `url(${T(tex)}) center/160%`
});
const metal = (id: string, name: string, color: string, rough = 0.32, brushed = true): MatDef => ({
  id, name, kind: 'metal', color, metalness: 1, roughness: rough, normal: brushed ? T('brushed_n') : undefined, rep: 4, normalScale: 0.15,
  swatch: `linear-gradient(135deg, ${color}, #ffffff 45%, ${color} 60%, #00000055)`
});
const lacquer = (id: string, name: string, color: string, rough = 0.35): MatDef => ({ id, name, kind: 'lacquer', color, roughness: rough, clearcoat: 0.6, clearcoatRoughness: 0.2 });
const rug = (id: string, name: string, color: string, normal = 'fab_boucle_n'): MatDef => ({
  id, name, kind: 'rug', color, normal: T(normal), rep: 3, normalScale: 1.2, roughness: 1, sheen: 0.7, sheenColor: color, sheenRoughness: 0.8
});
const outdoor = (id: string, name: string, color: string): MatDef => ({
  id, name, kind: 'outdoor', color, normal: T('weave_n'), rep: 10, normalScale: 0.8, roughness: 0.85, sheen: 0.3, sheenColor: color
});

const floor = (id: string, name: string, tex: string, tile: number, extra: Partial<MatDef> = {}): MatDef => ({
  id, name, kind: 'floor', color: '#ffffff', map: T('floor_' + tex), normal: T('floor_' + tex + '_n'), rough: T('floor_' + tex + '_r'),
  rep: 1 / tile, normalScale: 0.45, roughness: 1, swatch: `url(tex/floor_${tex}.jpg) center/220%`, ...extra
});

export const MATERIALS: MatDef[] = [
  // floors
  floor('floor-oak-light', 'Pale oak planks', 'oak_light', 2.4, { clearcoat: 0.12, clearcoatRoughness: 0.35 }),
  floor('floor-oak-grey', 'Smoked grey oak', 'oak_grey', 2.4, { clearcoat: 0.12, clearcoatRoughness: 0.35 }),
  floor('floor-herring', 'Oak herringbone', 'herring', 1.8, { rot: Math.PI / 4, clearcoat: 0.15, clearcoatRoughness: 0.3 }),
  floor('floor-limestone', 'Limestone tiles', 'limestone', 2.4),
  floor('floor-stone', 'Grey stone tiles', 'stone_grey', 2.4),
  floor('floor-marble', 'Marble tiles', 'marble', 2.7, { clearcoat: 0.4, clearcoatRoughness: 0.08 }),
  floor('floor-deck', 'Grey decking', 'deck', 2.24),
  { id: 'floor-dark', name: 'Dark stone', kind: 'floor', color: '#3a3836', roughness: 0.55 },

  // upholstery
  fabric('boucle-ivory', 'Ivory boucle', '#e9e2d6', 'fab_boucle_n', 0.7, 0.95),
  fabric('boucle-oat', 'Oat boucle', '#d6c8b2', 'fab_boucle_n', 0.7, 0.95),
  fabric('boucle-stone', 'Stone boucle', '#b9b1a5', 'fab_boucle_n', 0.7, 0.95),
  fabric('linen-white', 'White linen', '#efece6'),
  fabric('linen-flax', 'Flax linen', '#cbbba0'),
  fabric('linen-sky', 'Mist blue linen', '#aab7c4'),
  fabric('wool-charcoal', 'Charcoal wool', '#4a4846', 'fab_linen_n', 0.4),
  fabric('wool-taupe', 'Taupe wool', '#8f8274', 'fab_linen_n', 0.4),
  fabric('wool-mauve', 'Mauve wool', '#9a7f7c', 'fab_linen_n', 0.5),
  fabric('wool-slate', 'Slate wool', '#6f7682', 'fab_linen_n', 0.45),
  velvet('velvet-olive', 'Olive velvet', '#6b6a26', '#b8b35a'),
  velvet('velvet-moss', 'Moss velvet', '#3f4a2c', '#7f8f5a'),
  velvet('velvet-rust', 'Rust velvet', '#7a3a22', '#c87650'),
  velvet('velvet-navy', 'Navy velvet', '#1f2b44', '#5a6f9a'),
  velvet('velvet-blush', 'Blush velvet', '#b48a80', '#e8c2b8'),
  velvet('velvet-emerald', 'Emerald velvet', '#174a3c', '#4f9a80'),
  leather('leather-cognac', 'Cognac leather', '#8a4d26'),
  leather('leather-tan', 'Tan leather', '#b07a4a'),
  leather('leather-black', 'Black leather', '#1d1b1a'),
  leather('leather-taupe', 'Taupe leather', '#7d6d60'),

  // bedding
  { id: 'bed-white', name: 'Hotel white', kind: 'linen', color: '#f2f0ec', normal: T('fab_linen_n'), rep: 6, normalScale: 0.3, roughness: 0.92, sheen: 0.5, sheenColor: '#ffffff', sheenRoughness: 0.6 },
  { id: 'bed-dove', name: 'Dove grey', kind: 'linen', color: '#c9c8c6', normal: T('fab_linen_n'), rep: 6, normalScale: 0.3, roughness: 0.92, sheen: 0.5, sheenColor: '#e8e8e8', sheenRoughness: 0.6 },
  { id: 'bed-sand', name: 'Sand', kind: 'linen', color: '#d8ccb8', normal: T('fab_linen_n'), rep: 6, normalScale: 0.3, roughness: 0.92, sheen: 0.5, sheenColor: '#efe4d2', sheenRoughness: 0.6 },
  { id: 'bed-chambray', name: 'Chambray', kind: 'linen', color: '#a3afbf', normal: T('fab_linen_n'), rep: 6, normalScale: 0.3, roughness: 0.92, sheen: 0.5, sheenColor: '#d0d8e4', sheenRoughness: 0.6 },
  { id: 'bed-mink', name: 'Mink', kind: 'linen', color: '#8e7e74', normal: T('fab_linen_n'), rep: 6, normalScale: 0.3, roughness: 0.92, sheen: 0.5, sheenColor: '#b9a99c', sheenRoughness: 0.6 },
  { id: 'bed-espresso', name: 'Espresso', kind: 'linen', color: '#3b302b', normal: T('fab_linen_n'), rep: 6, normalScale: 0.3, roughness: 0.92, sheen: 0.5, sheenColor: '#6b5a50', sheenRoughness: 0.6 },

  // woods
  wood('oak', 'Natural oak', 'oak'),
  wood('ash', 'Bleached ash', 'ash'),
  wood('walnut', 'American walnut', 'walnut'),
  wood('smoked-oak', 'Smoked oak', 'smoked'),
  wood('ebony', 'Ebonised oak', 'ebony', '#ffffff', 0.42),
  wood('teak', 'Teak', 'teak', '#ffffff', 0.6),

  // stones
  stone('calacatta', 'Calacatta marble', 'marble_calacatta'),
  stone('taj', 'Taj Mahal quartzite', 'marble_taj'),
  stone('patagonia', 'Patagonia quartzite', 'marble_patagonia'),
  stone('nero', 'Nero Marquina', 'marble_nero'),
  stone('verde', 'Verde Alpi', 'marble_verde'),
  stone('travertine', 'Honed travertine', 'travertine', 0.55),

  // metals
  metal('brass', 'Brushed brass', '#c9a465', 0.3),
  metal('bronze', 'Dark bronze', '#5a4636', 0.38),
  metal('nickel', 'Satin nickel', '#c4c3c0', 0.28),
  metal('black-steel', 'Black steel', '#26262a', 0.45),
  metal('chrome', 'Polished chrome', '#e6e6e6', 0.06, false),
  metal('copper', 'Aged copper', '#b06a45', 0.35),

  // glass
  { id: 'glass-clear', name: 'Clear glass', kind: 'glass', color: '#e8f1f0', roughness: 0.04, metalness: 0, opacity: 0.22, ior: 1.5, swatch: 'linear-gradient(135deg,#eaf3f2,#ffffff 50%,#cfe0de)' },
  { id: 'glass-smoke', name: 'Smoked glass', kind: 'glass', color: '#4b4f50', roughness: 0.05, metalness: 0, opacity: 0.55, ior: 1.5, swatch: 'linear-gradient(135deg,#4b4f50,#9aa0a2 50%,#3d4142)' },
  { id: 'glass-bronze', name: 'Bronze glass', kind: 'glass', color: '#8a6a48', roughness: 0.05, metalness: 0, opacity: 0.5, ior: 1.5, swatch: 'linear-gradient(135deg,#8a6a48,#d6b894 50%,#6e5338)' },
  { id: 'glass-green', name: 'Sea glass', kind: 'glass', color: '#6f9c8c', roughness: 0.05, metalness: 0, opacity: 0.4, ior: 1.5, swatch: 'linear-gradient(135deg,#6f9c8c,#cfe6dc 50%,#4f7e6d)' },

  // lacquers and ceramics
  lacquer('lacquer-ivory', 'Ivory lacquer', '#ece6da'),
  lacquer('lacquer-black', 'Black lacquer', '#1c1c1d', 0.25),
  lacquer('lacquer-olive', 'Olive lacquer', '#5d5d3a'),
  lacquer('lacquer-clay', 'Clay lacquer', '#b9876a'),
  lacquer('lacquer-sage', 'Sage lacquer', '#9aa58f'),
  { id: 'ceramic-white', name: 'Gloss white', kind: 'ceramic', color: '#f4f3f0', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 },
  { id: 'ceramic-stone', name: 'Matte stone', kind: 'ceramic', color: '#d9d4cb', roughness: 0.6 },
  { id: 'ceramic-black', name: 'Matte black', kind: 'ceramic', color: '#2a2a2b', roughness: 0.55 },

  // rugs
  rug('rug-ivory', 'Ivory wool', '#e3ddd1'),
  rug('rug-sand', 'Sand wool', '#cdbfa6'),
  rug('rug-silver', 'Silver shag', '#b9bcc0'),
  rug('rug-mist', 'Mist blue', '#9eaab6'),
  rug('rug-navy', 'Navy', '#2b3550'),
  rug('rug-teal', 'Deep teal', '#2f5a5c'),
  rug('rug-charcoal', 'Charcoal', '#4a4a4c'),
  rug('rug-terracotta', 'Terracotta', '#b26a4c', 'weave_n'),
  rug('rug-sage', 'Sage', '#97a08a'),

  // outdoor weaves
  outdoor('weave-sand', 'Sand weave', '#c9b590'),
  outdoor('weave-charcoal', 'Charcoal weave', '#4d4a46'),
  outdoor('weave-natural', 'Natural rope', '#a88b62'),

  // wall paints
  { id: 'paint-warm-white', name: 'Warm white', kind: 'paint', color: '#e8e2d8', normal: T('plaster_n'), rep: 1.2, normalScale: 0.12, roughness: 0.92 },
  { id: 'paint-greige', name: 'Greige', kind: 'paint', color: '#cfc5b7', normal: T('plaster_n'), rep: 1.2, normalScale: 0.12, roughness: 0.92 },
  { id: 'paint-sand', name: 'Sandstone', kind: 'paint', color: '#d6c3a5', normal: T('plaster_n'), rep: 1.2, normalScale: 0.12, roughness: 0.92 },
  { id: 'paint-mist', name: 'Pale mist', kind: 'paint', color: '#d5d8d6', normal: T('plaster_n'), rep: 1.2, normalScale: 0.12, roughness: 0.92 },
  { id: 'paint-sage', name: 'Soft sage', kind: 'paint', color: '#bcc2ad', normal: T('plaster_n'), rep: 1.2, normalScale: 0.12, roughness: 0.92 },
  { id: 'paint-clay', name: 'Limewash clay', kind: 'paint', color: '#c9a991', normal: T('plaster_n'), rep: 1.2, normalScale: 0.25, roughness: 0.95 },

  // plants and pots
  { id: 'foliage', name: 'Foliage', kind: 'foliage', color: '#4f6b3a', roughness: 0.65, sheen: 0.3, sheenColor: '#a8c27a' },
  { id: 'foliage-dark', name: 'Foliage', kind: 'foliage', color: '#33502c', roughness: 0.6, sheen: 0.3, sheenColor: '#88a868' },
  { id: 'foliage-silver', name: 'Foliage', kind: 'foliage', color: '#7d8c6c', roughness: 0.7, sheen: 0.3, sheenColor: '#c4d0b0' },
  { id: 'leaf-broad', name: 'Leaves', kind: 'foliage', color: '#ffffff', map: 'tex/leaf_broad.png', rep: 1, roughness: 0.6, sheen: 0.25, sheenColor: '#b8d08a' },
  { id: 'leaf-long', name: 'Leaves', kind: 'foliage', color: '#ffffff', map: 'tex/leaf_long.png', rep: 1, roughness: 0.6, sheen: 0.25, sheenColor: '#c4d49a' },
  { id: 'trunk', name: 'Bark', kind: 'pot', color: '#6b5a4a', roughness: 0.95 },
  { id: 'pot-concrete', name: 'Concrete', kind: 'pot', color: '#b9b5ae', roughness: 0.85 },
  { id: 'pot-white', name: 'White stone', kind: 'pot', color: '#ece9e3', roughness: 0.6 },
  { id: 'pot-terracotta', name: 'Terracotta', kind: 'pot', color: '#b26a4c', roughness: 0.85 },
  { id: 'pot-charcoal', name: 'Charcoal', kind: 'pot', color: '#3d3c3b', roughness: 0.7 },
  { id: 'soil', name: 'Soil', kind: 'pot', color: '#3b2e25', roughness: 1 },

  // light emitters (lamp shades, bulbs)
  { id: 'shade-linen', name: 'Linen shade', kind: 'emissive', color: '#efe6d6', roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0 },
  { id: 'bulb', name: 'Bulb', kind: 'emissive', color: '#fff4e0', roughness: 0.3, emissive: '#ffd59a', emissiveIntensity: 0 },
  // ---- Park Villas specs book finishes (lobby and amenity floors). Colours are read from the scanned swatches. ----
  { id: 'st500', name: 'Moca fine-grain limestone, honed 20 mm', kind: 'floor', spec: 'ST-500', color: '#ffffff', map: T('stone_moca'), normal: T('stone_moca_n'), rep: 1 / 2.4, normalScale: 0.5, roughness: 0.42, clearcoat: 0.15, clearcoatRoughness: 0.3 },
  { id: 'st501', name: 'Moleanos limestone, bush-hammered 10 mm', kind: 'floor', spec: 'ST-501', color: '#ffffff', map: T('stone_moleanos'), normal: T('stone_moleanos_n'), rep: 1 / 2.4, normalScale: 0.8, roughness: 0.85 },
  { id: 'st503', name: 'Silver Wave, honed 20 mm', kind: 'floor', spec: 'ST-503', color: '#ffffff', map: T('stone_silverwave'), rough: T('stone_silverwave_r'), rep: 1 / 2.2, roughness: 1, clearcoat: 0.1 },
  { id: 'st502', name: 'Cartier Gray, honed', kind: 'stone', spec: 'ST-502', color: '#9a9a9a', map: T('stone_wavepanel'), rough: T('stone_wavepanel_r'), rep: 1 / 2.6, roughness: 1 },
  { id: 'st507', name: 'Venice Brown, honed 20 mm', kind: 'stone', spec: 'ST-507', color: '#a39882', map: T('marble_patagonia'), rough: T('marble_patagonia_r'), rep: 0.5, roughness: 0.4 },
  { id: 'st508', name: 'Fusion quartzite, honed 20 mm', kind: 'stone', spec: 'ST-508', color: '#a4a495', map: T('marble_verde'), rough: T('marble_verde_r'), rep: 0.45, roughness: 0.35, clearcoat: 0.2 },
  { id: 'st510', name: "Crema d'Orcia, honed 20 mm", kind: 'stone', spec: 'ST-510', color: '#f1e3cf', map: T('travertine'), normal: T('travertine_n'), rep: 0.5, roughness: 0.5 },
  { id: 'soapstone', name: 'Soapstone Patinato (Eggersmann island)', kind: 'stone', spec: 'E-501', color: '#6d6e6c', map: T('marble_nero'), rough: T('marble_nero_r'), rep: 0.4, roughness: 0.5 },
  { id: 'tl501', name: 'Sicis Garbino 15 mm glass mosaic', kind: 'floor', spec: 'TL-501', color: '#ffffff', map: T('mosaic_garbino'), normal: T('mosaic_garbino_n'), rep: 1 / 1.2, normalScale: 0.5, roughness: 0.2, clearcoat: 0.6 },
  { id: 'tl502', name: 'Sicis Tannis 15 mm glass mosaic', kind: 'floor', spec: 'TL-502', color: '#ffffff', map: T('mosaic_tannis'), normal: T('mosaic_tannis_n'), rep: 1 / 1.2, normalScale: 0.5, roughness: 0.2, clearcoat: 0.6 },
  { id: 'rv500', name: 'Kent Silence Pause rubber, 2.5 mm', kind: 'floor', spec: 'RV-500', color: '#ffffff', map: T('rubber_weave'), normal: T('rubber_weave_n'), rep: 1 / 1.5, normalScale: 0.6, roughness: 0.9 },
  { id: 'cp500', name: 'Tajima Tapis carpet tile', kind: 'floor', spec: 'CP-500', color: '#ffffff', map: T('carpet_tile'), normal: T('carpet_tile_n'), rep: 1 / 2, normalScale: 0.6, roughness: 1, sheen: 0.4, sheenColor: '#8a7f72' },
  { id: 'deck-paving', name: 'Grey-green stone paving with marble bands', kind: 'floor', color: '#ffffff', map: T('deck_paving'), normal: T('deck_paving_n'), rep: 1 / 3.6, normalScale: 0.5, roughness: 0.7 },
  { id: 'grass', name: 'Lawn', kind: 'floor', color: '#ffffff', map: T('grass'), normal: T('grass_n'), rep: 1 / 3, normalScale: 1, roughness: 1, sheen: 0.4, sheenColor: '#b6d08a' },
  { id: 'wd501', name: 'White oak, heavy wire-brushed', kind: 'wood', spec: 'WD-501', color: '#efe8de', map: T('wood_ash'), normal: T('wood_ash_n'), rep: 0.9, normalScale: 0.6, roughness: 0.75 },
  { id: 'wd503', name: 'Nature Squared custom bamboo panel', kind: 'wood', spec: 'WD-503', color: '#ffffff', map: T('bamboo_panel'), rep: 0.5, roughness: 0.6 },
  { id: 'wd504', name: 'White oak, taupe stain, matte', kind: 'wood', spec: 'WD-504', color: '#b8a493', map: T('wood_oak'), normal: T('wood_oak_n'), rep: 0.9, normalScale: 0.35, roughness: 0.6 },
  { id: 'wd506', name: 'White oak, grey stain, brushed', kind: 'wood', spec: 'WD-506', color: '#a39d9a', map: T('wood_smoked'), normal: T('wood_smoked_n'), rep: 0.9, normalScale: 0.35, roughness: 0.6 },
  { id: 'wd508', name: 'White oak, blue stain, matte', kind: 'wood', spec: 'WD-508', color: '#6b6d88', map: T('wood_smoked'), normal: T('wood_smoked_n'), rep: 0.9, normalScale: 0.35, roughness: 0.6 },
  { id: 'wd510', name: 'Tylo sauna wood, 178 x 20 mm', kind: 'wood', spec: 'WD-510', color: '#9a8a86', map: T('wood_smoked'), normal: T('wood_smoked_n'), rep: 1.2, normalScale: 0.5, roughness: 0.8 },
  { id: 'wd520', name: 'Fumed oak, quarter cut, espresso stain', kind: 'wood', spec: 'WD-520', color: '#8a7a6c', map: T('wood_ebony'), normal: T('wood_ebony_n'), rep: 0.9, normalScale: 0.35, roughness: 0.7 },
  { id: 'ml501', name: 'Textured light bronze', kind: 'metal', spec: 'ML-501', color: '#8a7350', metalness: 1, roughness: 0.42, normal: T('brushed_n'), rep: 3, normalScale: 0.3 },
  { id: 'ml505', name: 'Dark bronze', kind: 'metal', spec: 'ML-505', color: '#3a2c24', metalness: 1, roughness: 0.4 },
  { id: 'pt500', name: "Lamb's Wool limewash", kind: 'paint', spec: 'PT-500', color: '#e3ddd2', normal: T('plaster_n'), rep: 1.2, normalScale: 0.2, roughness: 0.95 },
  { id: 'pt502', name: 'Dulux Intense Ink, flat', kind: 'paint', spec: 'PT-502', color: '#454d50', normal: T('plaster_n'), rep: 1.2, normalScale: 0.15, roughness: 0.95 },
  { id: 'pt505', name: 'Dulux Stone Sensation, matte', kind: 'paint', spec: 'PT-505', color: '#d6cec3', normal: T('plaster_n'), rep: 1.2, normalScale: 0.15, roughness: 0.92 },
  { id: 'sp502', name: 'Raked plaster', kind: 'paint', spec: 'SP-502A', color: '#cfd0cb', normal: T('wood_ash_n'), rep: 0.6, normalScale: 0.5, roughness: 0.95 },
  { id: 'sp508', name: 'Plaster, Dulux Taupe Tower', kind: 'paint', spec: 'SP-508', color: '#a69d94', normal: T('plaster_n'), rep: 1.2, normalScale: 0.2, roughness: 0.92 },
  { id: 'mr501', name: 'Bronze mirror, 6 mm', kind: 'fixture', spec: 'MR-501', color: '#a49189', roughness: 0.05, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.02 },
  { id: 'water', name: 'Pool water', kind: 'fixture', color: '#2f8a98', roughness: 0.04, metalness: 0, normal: T('water_n'), rep: 0.25, normalScale: 0.25, opacity: 0.8, transmission: 0 },
  { id: 'car-paint', name: 'Car paint', kind: 'fixture', color: '#3a3c3e', roughness: 0.25, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.05 },
  { id: 'tyre', name: 'Tyre', kind: 'fixture', color: '#1b1b1c', roughness: 0.9 },
  { id: 'gym-black', name: 'Matte black', kind: 'fixture', color: '#1e1f21', roughness: 0.55, metalness: 0.3 },
  { id: 'screen-on', name: 'Screen', kind: 'fixture', color: '#0d1b24', roughness: 0.2, emissive: '#2c6f8f', emissiveIntensity: 0.6 },
  { id: 'mirror', name: 'Mirror', kind: 'fixture', color: '#7d878b', roughness: 0.06, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.02 },
  { id: 'screen', name: 'Screen', kind: 'emissive', color: '#0b0c0e', roughness: 0.15, metalness: 0.2 }
];

export const MAT = Object.fromEntries(MATERIALS.map((m) => [m.id, m])) as Record<string, MatDef>;

// what a slot of each kind may switch to
export const SLOT_KINDS: Record<string, MatKind[]> = {
  upholstery: ['fabric', 'leather'],
  fabric: ['fabric'],
  leather: ['leather', 'fabric'],
  bedding: ['linen'],
  throw: ['linen', 'fabric'],
  wood: ['wood', 'lacquer'],
  top: ['stone', 'wood', 'lacquer'],
  stone: ['stone'],
  metal: ['metal'],
  glass: ['glass'],
  rug: ['rug'],
  outdoor: ['outdoor', 'fabric'],
  lacquer: ['lacquer', 'wood', 'metal'],
  ceramic: ['ceramic', 'stone'],
  pot: ['pot'],
  shade: ['emissive'],
  floor: ['floor']
};

export function swatchCss(m: MatDef): string {
  if (m.swatch) return m.swatch;
  const tex = m.kind === 'rug' ? (m.normal && m.normal.includes('weave') ? 'weave' : 'rug')
    : m.kind === 'outdoor' ? 'weave'
    : m.kind === 'leather' ? 'leather'
    : m.kind === 'fabric' || m.kind === 'linen' ? (m.normal && m.normal.includes('boucle') ? 'boucle' : m.normal && m.normal.includes('velvet') ? 'velvet' : 'linen')
    : '';
  if (tex) return `url(tex/sw_${tex}.jpg) center/cover, ${m.color}`;
  if (m.map) return `url(${m.map}) center/240%, ${m.color}`;
  return `linear-gradient(145deg, #ffffff40, transparent 50%), ${m.color}`;
}
