import * as THREE from 'three';
import { invalidate } from '@react-three/fiber';
import { MAT, MatDef } from '../data/materials';
import { getRenderer, refreshShadows } from './redraw';

// Texture images are decoded off the main thread (ImageBitmap) where browsers handle it reliably; Safari and
// Firefox before 98 keep the regular image loader. The pixels are the same either way: the bitmap is flipped and
// left unconverted exactly as WebGL uploads a regular image for three.js.
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const firefox = /Firefox\/(\d+)/.exec(ua);
const useBitmaps = typeof createImageBitmap !== 'undefined' && typeof fetch !== 'undefined'
  && !/^((?!chrome|android).)*safari/i.test(ua) && !(firefox && Number(firefox[1]) < 98);
const bitmapLoader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
const imageLoader = new THREE.ImageLoader();

const texCache = new Map<string, THREE.Texture>();
const sharing = new Map<string, THREE.Texture[]>(); // every texture that uses one image file
let maxAniso = 8;
export function setMaxAniso(n: number) { maxAniso = n; }

function loadImage(url: string): THREE.Texture {
  const base = new THREE.Texture();
  const users = [base];
  sharing.set(url, users);
  const done = (img: ImageBitmap | HTMLImageElement) => {
    base.image = img;
    for (const t of users) t.needsUpdate = true;
    // upload it now, while the rest is still downloading, rather than all together in the first frame
    const gl = getRenderer();
    if (gl) gl.initTexture(base);
    refreshShadows(); // leaf cut-outs shape the shadows
    invalidate();
  };
  if (useBitmaps) bitmapLoader.load(url, done, undefined, () => undefined);
  else imageLoader.load(url, done);
  return base;
}

function tex(url: string, rep: number, srgb: boolean, rot = 0): THREE.Texture {
  const key = url + '|' + rep + '|' + srgb + '|' + rot;
  let t = texCache.get(key);
  if (t) return t;
  const base = texCache.get(url + '|base');
  if (base) {
    // another repeat or rotation of an image already requested: share its pixels
    t = new THREE.Texture();
    t.source = base.source;
    sharing.get(url)!.push(t);
    if (base.image) t.needsUpdate = true;
  } else {
    t = loadImage(url);
    texCache.set(url + '|base', t);
  }
  t.flipY = !useBitmaps; // bitmaps are flipped while decoding
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.rotation = rot;
  t.anisotropy = maxAniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texCache.set(key, t);
  return t;
}

const matCache = new Map<string, THREE.MeshPhysicalMaterial>();

export function buildMaterial(d: MatDef): THREE.MeshPhysicalMaterial {
  const rep = d.rep || 1;
  const m = new THREE.MeshPhysicalMaterial({
    name: d.id,
    color: new THREE.Color(d.color),
    roughness: d.roughness,
    metalness: d.metalness || 0
  });
  const rot = d.rot || 0;
  if (d.map) m.map = tex(d.map, rep, true, rot);
  if (d.normal) { m.normalMap = tex(d.normal, rep, false, rot); const s = d.normalScale ?? 0.5; m.normalScale.set(s, s); }
  if (d.rough) m.roughnessMap = tex(d.rough, rep, false, rot);
  if (d.sheen) { m.sheen = d.sheen; m.sheenColor = new THREE.Color(d.sheenColor || d.color); m.sheenRoughness = d.sheenRoughness ?? 0.5; }
  if (d.clearcoat) { m.clearcoat = d.clearcoat; m.clearcoatRoughness = d.clearcoatRoughness ?? 0.2; }
  if (d.id === 'water') {
    m.transparent = true; m.opacity = d.opacity ?? 0.75; m.depthWrite = false; m.envMapIntensity = 0.55; m.ior = 1.33; m.specularIntensity = 0.8;
  }
  if (d.kind === 'glass') {
    m.transparent = true;
    m.opacity = d.opacity ?? 0.25;
    m.depthWrite = false;
    m.envMapIntensity = 1.6;
    m.side = THREE.DoubleSide;
    m.specularIntensity = 1;
    m.ior = d.ior || 1.5;
  }
  if (d.emissive) { m.emissive = new THREE.Color(d.emissive); m.emissiveIntensity = d.emissiveIntensity || 0; }
  if (d.kind === 'foliage') {
    m.side = THREE.DoubleSide;
    if (d.map && d.map.endsWith('.png')) { m.alphaTest = 0.5; m.map!.repeat.set(1, 1); m.map!.wrapS = m.map!.wrapT = THREE.ClampToEdgeWrapping; }
  }
  return m;
}

export function getMat(id: string): THREE.MeshPhysicalMaterial {
  let m = matCache.get(id);
  if (m) return m;
  const d = MAT[id] || MAT['boucle-ivory'];
  m = buildMaterial(d);
  matCache.set(id, m);
  if (cutOn) applyCut(m);
  return m;
}

// Night mode lights up lamp shades and bulbs
export function setNight(night: number) {
  const shade = getMat('shade-linen');
  shade.emissiveIntensity = night * 1.6;
  const bulb = getMat('bulb');
  bulb.emissiveIntensity = night * 6;
}

// Architectural materials that are not in the picker library
const arch = new Map<string, THREE.Material>();
export function archMat(id: string): THREE.Material {
  let m = arch.get(id);
  if (m) return m;
  switch (id) {
    case 'wallCap':
      m = new THREE.MeshStandardMaterial({ color: '#8f8a7c', roughness: 0.9 });
      break;
    case 'slabEdge':
      m = new THREE.MeshStandardMaterial({ color: '#efede8', roughness: 0.75 });
      break;
    case 'slabUnder':
      m = new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.9 });
      break;
    case 'mullion':
      m = new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.42, metalness: 0.6 });
      break;
    case 'bronzeFrame':
      m = new THREE.MeshStandardMaterial({ color: '#6d5a44', roughness: 0.35, metalness: 0.85 });
      break;
    case 'facadeGlass':
      m = new THREE.MeshPhysicalMaterial({ color: '#dfeceb', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.8 });
      break;
    case 'railGlass':
      m = new THREE.MeshPhysicalMaterial({ color: '#d8ecea', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
      break;
    case 'showerGlass':
      m = new THREE.MeshPhysicalMaterial({ color: '#d4e6e3', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.8 });
      break;
    case 'skirting':
      m = new THREE.MeshStandardMaterial({ color: '#d9d3c8', roughness: 0.55 });
      break;
    case 'mirror':
      m = new THREE.MeshStandardMaterial({ color: '#c8ccce', roughness: 0.02, metalness: 1, envMapIntensity: 1.4 });
      break;
    case 'sheer':
      m = new THREE.MeshPhysicalMaterial({ color: '#f3efe8', roughness: 0.95, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') });
      break;
    case 'liftDoor':
      m = new THREE.MeshStandardMaterial({ color: '#4a3b2e', roughness: 0.3, metalness: 0.8 });
      break;
    default:
      m = new THREE.MeshStandardMaterial({ color: '#cccccc' });
  }
  arch.set(id, m);
  return m;
}

// Cutaway: a horizontal section through everything above the cut height (plants are left whole)
const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.3);
let cutOn = false;
function applyCut(m: THREE.Material) {
  const k = (MAT[m.name] && MAT[m.name].kind) || '';
  if (k === 'foliage' || m.name === 'trunk' || m.name === 'soil') return;
  m.clippingPlanes = cutOn ? [cutPlane] : null;
  m.clipShadows = true;
  m.needsUpdate = true;
}
export function setCut(on: boolean, h: number) {
  cutOn = on;
  cutPlane.constant = h;
  matCache.forEach(applyCut);
}

// Run fn with the cut-away switched on or off, then put it back (used to compile the other wall mode ahead of time)
export function withCut(on: boolean, fn: () => void) {
  const was = cutOn, h = cutPlane.constant;
  if (on === was) { fn(); return; }
  setCut(on, h);
  try { fn(); } finally { setCut(was, h); }
}
