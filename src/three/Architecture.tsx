import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame, invalidate } from '@react-three/fiber';
import { riseScale } from './Dive';
import { plan, rooms, wx, wz, S, CX, CY, PLAN_W, PLAN_H, WALL_H, CUT_H, Pt, floorZones } from '../data/plan';
import { archMat, getMat, setCut } from './matlib';
import { refreshShadows } from './redraw';
import { merge, worldUV, V2 } from './geo';
import { useStore } from '../store';

const W = (p: Pt): V2 => [wx(p[0]), wz(p[1])];

function shapeFrom(pts: V2[], holes: V2[][] = []): THREE.Shape {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  return s;
}
function signedArea(pts: V2[]) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }

// ---------- floor slab with the bare plan as its finish ----------
function useFloorGeometry() {
  return useMemo(() => {
    const pts = plan.slab.map(W);
    const shape = shapeFrom(pts);
    const top = new THREE.ShapeGeometry(shape, 1);
    top.rotateX(-Math.PI / 2);
    const p = top.getAttribute('position');
    const uv = new Float32Array(p.count * 2), uv1 = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const X = p.getX(i), Z = p.getZ(i);
      uv[i * 2] = (X / S + CX) / PLAN_W;
      uv[i * 2 + 1] = 1 - (Z / S + CY) / PLAN_H;
      uv1[i * 2] = X; uv1[i * 2 + 1] = Z;
    }
    top.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    top.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    top.computeVertexNormals();
    const body = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: false, curveSegments: 1 });
    body.rotateX(-Math.PI / 2);
    body.translate(0, -0.425, 0);
    return { top, body: worldUV(body) };
  }, []);
}

// finish zones (planks, herringbone, stone, marble, decking) as separate floor meshes with metre UVs
function useZoneGeometries() {
  return useMemo(() => floorZones.map((z) => {
    const gs = z.polys.map((p) => {
      const g = new THREE.ShapeGeometry(shapeFrom(p.o.map(W), p.h.map((h) => h.map(W))), 1);
      g.rotateX(-Math.PI / 2);
      return worldUV(g);
    });
    return { z, geo: merge(gs) };
  }), []);
}

let planMatCache: THREE.MeshStandardMaterial | null = null;

export function Floor() {
  const { top, body } = useFloorGeometry();
  const zones = useZoneGeometries();
  const gl = useThree((s) => s.gl);
  const showPlan = useStore((s) => s.showPlan);
  const floorMats = useStore((s) => s.floorMats);
  const planMat = useMemo(() => {
    if (!showPlan) return null;
    if (!planMatCache) {
      const t = new THREE.TextureLoader().load('tex/plan_dressed.jpg', () => invalidate());
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = gl.capabilities.getMaxAnisotropy();
      planMatCache = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0, envMapIntensity: 0.7 });
    }
    return planMatCache;
  }, [showPlan, gl]);
  return (
    <group>
      {showPlan && planMat ? (
        <mesh geometry={top} material={planMat} receiveShadow name="floor" />
      ) : (
        zones.map(({ z, geo }) => (
          <mesh key={z.id} geometry={geo} material={getMat(floorMats[z.id] || z.mat)} receiveShadow name={'floor-' + z.id} />
        ))
      )}
      <mesh geometry={body} material={[archMat('slabUnder'), archMat('slabEdge')]} receiveShadow />
    </group>
  );
}

// ---------- walls ----------
export function useWallGeometry(height: number) {
  return useMemo(() => {
    const gs: THREE.BufferGeometry[] = [];
    for (const w of plan.walls) {
      const o = w.o.map(W);
      const holes = w.h.map((h) => h.map(W));
      const g = new THREE.ExtrudeGeometry(shapeFrom(o, holes), { depth: height, bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2);
      gs.push(g);
    }
    // thin walls along their centre line; shower screens are glass, 2.1 m high, on a slim frame
    const thin: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    const frame: THREE.BufferGeometry[] = [];
    for (const t of plan.thin) {
      const ang = -(t.a * Math.PI) / 180;
      if (t.kind === 'glass') {
        const gh = Math.min(height, 2.1);
        const g = new THREE.BoxGeometry(t.l * S, gh, 0.012);
        g.rotateY(ang); g.translate(wx(t.c[0]), gh / 2, wz(t.c[1]));
        glass.push(g);
        for (const y of [0.01, gh - 0.008]) {
          const f = new THREE.BoxGeometry(t.l * S, 0.016, 0.022);
          f.rotateY(ang); f.translate(wx(t.c[0]), y, wz(t.c[1]));
          frame.push(f);
        }
        continue;
      }
      const g = new THREE.BoxGeometry(t.l * S, height, Math.max(0.1, t.t * S));
      g.rotateY(ang);
      g.translate(wx(t.c[0]), height / 2, wz(t.c[1]));
      thin.push(g);
    }
    for (const c of plan.columns) {
      const g = new THREE.BoxGeometry(c[2] * S, height, c[3] * S);
      g.translate(wx(c[0] + c[2] / 2), height / 2, wz(c[1] + c[3] / 2));
      thin.push(g);
    }
    const walls = mergeGroups(gs);
    const parts = merge(thin.map((g) => worldUV(g)));
    return { walls, parts, glass: merge(glass), frame: merge(frame.map((g) => worldUV(g))) };
  }, [height]);
}

// keep ExtrudeGeometry's cap/side groups when merging so caps and sides take different materials
function mergeGroups(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const caps: THREE.BufferGeometry[] = [], sides: THREE.BufferGeometry[] = [];
  for (const g of gs) {
    const ni = g.index ? g.toNonIndexed() : g;
    for (const grp of g.groups) {
      const sub = new THREE.BufferGeometry();
      for (const k of ['position', 'normal']) {
        const a = ni.getAttribute(k) as THREE.BufferAttribute;
        sub.setAttribute(k, new THREE.BufferAttribute((a.array as Float32Array).slice(grp.start * 3, (grp.start + grp.count) * 3), 3));
      }
      (grp.materialIndex === 0 ? caps : sides).push(sub);
    }
  }
  const c = merge(caps.map((g) => worldUV(g)));
  const s = merge(sides.map((g) => worldUV(g)));
  const m = merge([c, s]);
  m.clearGroups();
  const nc = c.getAttribute('position').count, ns = s.getAttribute('position').count;
  m.addGroup(0, nc, 0);
  m.addGroup(nc, ns, 1);
  return m;
}

// While stepping into a 360 view, the cut-away walls grow back: the full-height walls are shown, squashed down to
// the cut height, and stretch up as the camera descends (the "rise" is driven by Dive).
function useTall() {
  const mode = useStore((s) => s.walls);
  const inside = useStore((s) => s.inside);
  return { cut: mode === 'cutaway' && !inside, tall: mode === 'cutaway' && inside };
}
function Rise({ on, children }: { on: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = on ? riseScale() : 1;
    if (g.current && g.current.scale.y !== s) g.current.scale.y = s;
  });
  return <group ref={g} scale={[1, on ? riseScale() : 1, 1]}>{children}</group>;
}

export function Walls() {
  const mode = useStore((s) => s.walls);
  const paint = useStore((s) => s.wallPaint);
  const { cut, tall } = useTall();
  // both heights are built up front, so switching between them never stalls
  const low = useWallGeometry(CUT_H);
  const high = useWallGeometry(WALL_H);
  const { walls, parts, glass, frame } = cut ? low : high;
  const gl = useThree((s) => s.gl);
  useEffect(() => { gl.localClippingEnabled = true; setCut(mode === 'cutaway', CUT_H + 0.02); refreshShadows(); }, [mode, gl]);
  const side = getMat(paint);
  const cap = archMat('wallCap');
  return (
    <group>
      <Rise on={tall}>
        <mesh geometry={walls} material={[cap, side]} castShadow receiveShadow name="walls" />
        <mesh geometry={parts} material={side} castShadow receiveShadow />
        <mesh geometry={glass} material={archMat('showerGlass')} renderOrder={2} />
        <mesh geometry={frame} material={getMat('black-steel')} castShadow />
        <Millwork height={cut ? CUT_H : WALL_H - 0.05} />
      </Rise>
      <Skirting />
    </group>
  );
}

// 9 cm skirting board round every wall face inside the home
function Skirting() {
  const g = useMemo(() => {
    const gs = (plan.skirt || []).map((p) => {
      const e = new THREE.ExtrudeGeometry(shapeFrom(p.o.map(W), p.h.map((h) => h.map(W))), { depth: 0.09, bevelEnabled: false, curveSegments: 1 });
      e.rotateX(-Math.PI / 2);
      return worldUV(e);
    });
    return merge(gs);
  }, []);
  return <mesh geometry={g} material={archMat('skirting')} receiveShadow />;
}

function Millwork({ height }: { height: number }) {
  const g = useMemo(() => {
    const gs = plan.millwork.map(([x, y, w, h]) => {
      const b = new THREE.BoxGeometry(w * S - 0.02, height, h * S - 0.02);
      b.translate(wx(x + w / 2), height / 2, wz(y + h / 2));
      return worldUV(b);
    });
    return merge(gs);
  }, [height]);
  return <mesh geometry={g} material={getMat('walnut')} castShadow receiveShadow />;
}

// ---------- facade glazing with black mullions ----------
function glazingGeometry(height: number) {
  const glass: THREE.BufferGeometry[] = [];
  const frame: THREE.BufferGeometry[] = [];
  const slider: THREE.BufferGeometry[] = [];
  const sliderFrame: THREE.BufferGeometry[] = [];
  const mullionGap = 1.55;
  for (const run of plan.glazing) {
    const pts = run.pts.map(W);
    const isSlider = run.kind === 'slider';
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.01) continue;
      const ang = Math.atan2(z1 - z0, x1 - x0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const pane = new THREE.PlaneGeometry(len + 0.01, height - 0.08);
      pane.rotateY(-ang);
      pane.translate(mx, height / 2, mz);
      (isSlider ? slider : glass).push(pane);
      for (const y of [0.03, height - 0.03]) {
        const r = new THREE.BoxGeometry(len + 0.02, 0.06, 0.09);
        r.rotateY(-ang); r.translate(mx, y, mz);
        (isSlider ? sliderFrame : frame).push(r);
      }
      // mullions every ~1.55 m along the run
      let d = mullionGap - (acc % mullionGap);
      while (d < len) {
        const t = d / len;
        const m = new THREE.BoxGeometry(0.05, height, 0.11);
        m.rotateY(-ang);
        m.translate(x0 + (x1 - x0) * t, height / 2, z0 + (z1 - z0) * t);
        (isSlider ? sliderFrame : frame).push(m);
        d += mullionGap;
      }
      acc += len;
    }
    // end posts
    for (const p of [pts[0], pts[pts.length - 1]]) {
      const m = new THREE.BoxGeometry(0.07, height, 0.07);
      m.translate(p[0], height / 2, p[1]);
      (isSlider ? sliderFrame : frame).push(m);
    }
  }
  return { glass: merge(glass), frame: merge(frame), slider: merge(slider), sliderFrame: merge(sliderFrame) };
}

// Curtains are drawn open, as in the photos: the facade is split into bays of about 4 m, and at each end of a bay
// hangs a gathered stack of sheer (15 cm inside the glass) with a linen drape in front of it; the glass between
// them stays clear.
function inside(x: number, z: number) {
  const P = plan.interior; let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = wx(P[i][0]), zi = wz(P[i][1]), xj = wx(P[j][0]), zj = wz(P[j][1]);
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
type Sheet = { pos: number[]; idx: number[] };
// one gathered panel from s0 to s1 along a glazing run (s = distance along the run)
function panel(out: Sheet, pts: V2[], cum: number[], side: number, s0: number, s1: number, off: number, amp: number, period: number, top: number) {
  const steps = Math.max(2, Math.ceil((s1 - s0) / 0.011));
  const base = out.pos.length / 3;
  let i = 0;
  for (let k = 0; k <= steps; k++) {
    const s = s0 + ((s1 - s0) * k) / steps;
    while (i < pts.length - 2 && cum[i + 1] < s) i++;
    const len = cum[i + 1] - cum[i] || 1e-6, t = (s - cum[i]) / len;
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const tx = (x1 - x0) / len, tz = (z1 - z0) / len, nx = -tz * side, nz = tx * side;
    const w = off + amp * Math.sin(((s - s0) / period) * Math.PI * 2);
    const x = x0 + (x1 - x0) * t + nx * w, z = z0 + (z1 - z0) * t + nz * w;
    out.pos.push(x, 0.02, z, x, top, z);
  }
  for (let k = 0; k < steps; k++) { const a = base + k * 2; out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}
function sheetGeometry(o: Sheet) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  g.setIndex(o.idx);
  g.computeVertexNormals();
  return g;
}
function curtainGeometry(height: number) {
  const sheer: Sheet = { pos: [], idx: [] }, linen: Sheet = { pos: [], idx: [] };
  const top = height - 0.06;
  for (const run of plan.glazing) {
    if (run.kind !== 'facade' || run.pts.length < 2) continue;
    const pts = run.pts.map(W);
    const cum = [0];
    for (let i = 0; i < pts.length - 1; i++) cum.push(cum[i] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
    const L = cum[cum.length - 1];
    if (L < 1.2) continue;
    // which side is inside: test the middle of the run
    const m = Math.floor((pts.length - 1) / 2);
    const [ax, az] = pts[m], [bx, bz] = pts[m + 1];
    const dl = Math.hypot(bx - ax, bz - az) || 1;
    const side = inside((ax + bx) / 2 - ((bz - az) / dl) * 0.4, (az + bz) / 2 + ((bx - ax) / dl) * 0.4) ? 1 : -1;
    const bays = Math.max(1, Math.round(L / 4.2)), bay = L / bays;
    const sw = Math.min(0.6, bay * 0.14), lw = Math.min(0.42, bay * 0.1);
    for (let k = 0; k <= bays; k++) {
      const c = k * bay;
      // a stack each side of a bay division; one at each end of the run
      const [s0, s1] = k === 0 ? [0, sw] : k === bays ? [L - sw, L] : [c - sw * 0.6, c + sw * 0.6];
      const [l0, l1] = k === 0 ? [0, lw] : k === bays ? [L - lw, L] : [c - lw * 0.55, c + lw * 0.55];
      panel(sheer, pts, cum, side, s0, s1, 0.15, 0.04, 0.085, top);
      panel(linen, pts, cum, side, l0, l1, 0.25, 0.05, 0.13, top);
    }
  }
  return { sheer: sheetGeometry(sheer), linen: sheetGeometry(linen) };
}
export function Curtains() {
  const finish = useStore((s) => s.finish);
  const { cut, tall } = useTall();
  const low = useMemo(() => curtainGeometry(CUT_H), []);
  const high = useMemo(() => curtainGeometry(WALL_H), []);
  if (finish !== 'dressed') return null;
  const g = cut ? low : high;
  return (
    <Rise on={tall}>
      <mesh geometry={g.sheer} material={archMat('sheer')} renderOrder={1} />
      <mesh geometry={g.linen} material={archMat('drape')} castShadow receiveShadow />
    </Rise>
  );
}

// ---------- ceiling ----------
// A flat white ceiling over the interior at wall height. Only its underside is drawn, so from the overview (above)
// the home stays open and from eye level (inside a room, full-height walls) the room is closed like in the photos.
// It casts no shadow: the sun still reaches the rooms through the open top, as before.
export function Ceiling() {
  const { cut, tall } = useTall();
  const geo = useMemo(() => {
    const g = new THREE.ShapeGeometry(shapeFrom(plan.interior.map(W)), 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, WALL_H - 0.002, 0);
    return worldUV(g);
  }, []);
  if (cut) return null;
  return <Rise on={tall}><mesh geometry={geo} material={archMat('ceiling')} receiveShadow name="ceiling" /></Rise>;
}

// ---------- ceiling lights ----------
// Recessed downlights on a grid in every indoor room, plus the black linear tracks with adjustable spots that the
// Grand Living photos show (measured from view 12 at the app's ceiling height). They hang off the ceiling, so they
// are drawn only while the camera is below it: from the overview the home stays open.
const TRACKS: { a: Pt; b: Pt; spots: number }[] = [
  { a: [1872, 462], b: [1872, 915], spots: 7 },
  { a: [1899, 500], b: [2012, 500], spots: 2 }
];
function inPoly(P: V2[], x: number, z: number) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function nearTrack(x: number, z: number, d: number) {
  for (const t of TRACKS) {
    const [ax, az] = W(t.a), [bx, bz] = W(t.b), ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez;
    const k = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2));
    if (Math.hypot(ax + ex * k - x, az + ez * k - z) < d) return true;
  }
  return false;
}
function downlightSpots(): V2[] {
  const out: V2[] = [], step = 1.75, inset = 0.65, m = 0.45;
  for (const r of rooms) {
    if (r.zone === 'outdoor') continue;
    const P = r.poly.map(W);
    const xs = P.map((p) => p[0]), zs = P.map((p) => p[1]);
    const x0 = Math.min(...xs) + inset, x1 = Math.max(...xs) - inset, z0 = Math.min(...zs) + inset, z1 = Math.max(...zs) - inset;
    if (x1 < x0 || z1 < z0) continue;
    const nx = Math.floor((x1 - x0) / step) + 1, nz = Math.floor((z1 - z0) / step) + 1;
    const ox = x0 + (x1 - x0 - (nx - 1) * step) / 2, oz = z0 + (z1 - z0 - (nz - 1) * step) / 2;
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const x = ox + i * step, z = oz + k * step;
      if (![[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]].every(([dx, dz]) => inPoly(P, x + dx, z + dz))) continue;
      if (nearTrack(x, z, 0.6)) continue;
      out.push([x, z]);
    }
  }
  return out;
}
export function CeilingLights() {
  const { cut, tall } = useTall();
  const g = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const y = WALL_H - 0.004;
    const baffle: THREE.BufferGeometry[] = [], lens: THREE.BufferGeometry[] = [], track: THREE.BufferGeometry[] = [];
    for (const [x, z] of downlightSpots()) {
      baffle.push(new THREE.CircleGeometry(0.055, 20).rotateX(Math.PI / 2).translate(x, y, z));
      lens.push(new THREE.CircleGeometry(0.022, 14).rotateX(Math.PI / 2).translate(x, y - 0.003, z));
    }
    for (const t of TRACKS) {
      const [ax, az] = W(t.a), [bx, bz] = W(t.b), len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
      track.push(new THREE.PlaneGeometry(len, 0.07).rotateX(Math.PI / 2).rotateY(-ang).translate((ax + bx) / 2, y, (az + bz) / 2));
      for (let i = 0; i < t.spots; i++) {
        const k = (i + 0.5) / t.spots, x = ax + (bx - ax) * k, z = az + (bz - az) * k;
        track.push(new THREE.CylinderGeometry(0.03, 0.03, 0.075, 16, 1, true).translate(x, y - 0.0375, z));
        lens.push(new THREE.CircleGeometry(0.024, 14).rotateX(Math.PI / 2).translate(x, y - 0.074, z));
      }
    }
    return { baffle: merge(baffle), lens: merge(lens), track: merge(track) };
  }, []);
  useFrame(({ camera }) => { if (g.current) g.current.visible = camera.position.y < WALL_H - 0.05; });
  if (cut) return null;
  return (
    <Rise on={tall}>
      <group ref={g}>
        <mesh geometry={geo.baffle} material={archMat('lightTrim')} />
        <mesh geometry={geo.track} material={archMat('lightTrim')} />
        <mesh geometry={geo.lens} material={getMat('bulb')} />
      </group>
    </Rise>
  );
}

export function Glazing() {
  const { cut, tall } = useTall();
  const low = useMemo(() => glazingGeometry(CUT_H), []);
  const high = useMemo(() => glazingGeometry(WALL_H), []);
  const g = cut ? low : high;
  return (
    <Rise on={tall}>
      <mesh geometry={g.glass} material={archMat('facadeGlass')} renderOrder={2} />
      <mesh geometry={g.frame} material={archMat('mullion')} castShadow receiveShadow />
      <mesh geometry={g.slider} material={archMat('facadeGlass')} renderOrder={2} />
      <mesh geometry={g.sliderFrame} material={archMat('bronzeFrame')} castShadow />
    </Rise>
  );
}

// ---------- terrace balustrades ----------
export function Balustrade() {
  const g = useMemo(() => {
    const slab = plan.slab.map(W);
    const ccw = signedArea(slab) > 0;
    const glass: THREE.BufferGeometry[] = [], rail: THREE.BufferGeometry[] = [];
    const H = 1.1, inset = 0.16;
    for (const run of plan.balustrade) {
      const pts = run.map(W);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        if (len < 0.02) continue;
        const ang = Math.atan2(z1 - z0, x1 - x0);
        let nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
        if (!ccw) { nx = -nx; nz = -nz; }
        const mx = (x0 + x1) / 2 + nx * inset, mz = (z0 + z1) / 2 + nz * inset;
        const pane = new THREE.PlaneGeometry(len + 0.02, H);
        pane.rotateY(-ang); pane.translate(mx, H / 2 + 0.02, mz);
        glass.push(pane);
        const r = new THREE.BoxGeometry(len + 0.03, 0.035, 0.05);
        r.rotateY(-ang); r.translate(mx, H + 0.03, mz);
        rail.push(r);
        const s = new THREE.BoxGeometry(len + 0.03, 0.05, 0.06);
        s.rotateY(-ang); s.translate(mx, 0.025, mz);
        rail.push(s);
      }
    }
    return { glass: merge(glass), rail: merge(rail) };
  }, []);
  return (
    <group>
      <mesh geometry={g.glass} material={archMat('railGlass')} renderOrder={2} />
      <mesh geometry={g.rail} material={archMat('bronzeFrame')} castShadow />
    </group>
  );
}

export function Architecture() {
  return (
    <group>
      <Floor />
      <Walls />
      <Glazing />
      <Curtains />
      <Ceiling />
      <CeilingLights />
      <Balustrade />
    </group>
  );
}
