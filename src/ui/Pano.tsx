import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useStore } from '../store';
import { roomById, ZONES } from '../data/plan';
import { Icon } from './icons';
import { Seg } from './Seg';
import { RoomFacts } from './RoomDetails';
import { Switcher, reducedMotion } from './motion';
import { TOUR_URL } from '../config';
import { panoLink, yawOf } from '../three/panoLink';

const loader = new THREE.TextureLoader();
const sphere = new THREE.SphereGeometry(50, 64, 40);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---- full-quality photos (see tools/13-pano-hd.sh) ----
// The 2048-pixel preview shows at once; the full-quality photo then arrives in 1024-pixel tiles that are decoded off
// the main thread, handed to the graphics card one per frame and faded in, so nothing ever stalls. Each screen gets
// the size it can actually show: 8192 pixels around on a sharp (Retina) or large screen, 4096 on phones and
// ordinary laptop screens.
type HdIndex = Record<string, Record<string, number[]>>; // level -> [width, height, columns, rows]
let hdIndex: Promise<HdIndex> | null = null;
const getHdIndex = (): Promise<HdIndex> => (hdIndex ||= fetch('pano-hd/index.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<HdIndex>);
const tileLoader = new THREE.ImageBitmapLoader(new THREE.LoadingManager()).setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
// the pieces of the sphere the tiles sit on, for each grid (columns x rows)
const grids = new Map<string, THREE.SphereGeometry[]>();
function tileGrid(cols: number, rows: number) {
  const k = cols + 'x' + rows;
  let g = grids.get(k);
  if (!g) {
    g = [];
    const ws = Math.max(8, Math.ceil(96 / cols)), hs = Math.max(8, Math.ceil(64 / rows));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      g.push(new THREE.SphereGeometry(50, ws, hs, (c * 2 * Math.PI) / cols, (2 * Math.PI) / cols, (r * Math.PI) / rows, Math.PI / rows));
    }
    grids.set(k, g);
  }
  return g;
}
// where a tile's middle is, seen from inside the (mirrored) sphere, to load the ones in view first
const tileDir = (i: number, cols: number, rows: number) => {
  const p = ((i % cols) + 0.5) * ((2 * Math.PI) / cols), t = (Math.floor(i / cols) + 0.5) * (Math.PI / rows);
  return new THREE.Vector3(Math.cos(p) * Math.sin(t), Math.cos(t), Math.sin(p) * Math.sin(t));
};
// The tile set for this screen: the smallest one with (nearly) a photo pixel for every screen pixel, else the
// largest; phones and small screens stay on the 4096 set to spare memory and data
function pickLevel(sizes: Record<string, number[]>, cam: THREE.PerspectiveCamera, widthPx: number) {
  const levels = Object.entries(sizes).sort((a, b) => a[1][0] - b[1][0]);
  if (!levels.length) return null;
  const hfov = 2 * Math.atan(Math.tan(((cam.fov * Math.PI) / 180) / 2) * cam.aspect);
  const need = (widthPx * 2 * Math.PI) / hfov; // photo width that gives one photo pixel per screen pixel
  const small = Math.min(window.innerWidth, window.innerHeight) < 760;
  const fits = levels.filter(([, v]) => !small || v[0] <= 4096);
  const pick = fits.find(([, v]) => v[0] >= need * 0.75) || fits[fits.length - 1] || levels[0];
  return { lv: pick[0], w: pick[1][0], cols: pick[1][2] || 4, rows: pick[1][3] || 2, need };
}

function HdTiles({ name, start, order }: { name: string; start: boolean; order: number }) {
  type Tile = { i: number; tex: THREE.Texture; a: number; mat?: THREE.MeshBasicMaterial | null };
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [grid, setGrid] = useState<THREE.SphereGeometry[]>([]);
  const mips = useRef(false); // smooth the tiles when the photo has more pixels than the screen shows
  const waiting = useRef<{ i: number; bmp: ImageBitmap }[]>([]);
  const made = useRef<Tile[]>([]);
  useEffect(() => {
    if (!start) return;
    let off = false;
    getHdIndex().then((idx) => {
      const sizes = idx[name];
      if (off || !sizes) return;
      const L = pickLevel(sizes, camera, gl.domElement.width);
      if (!L) return;
      const { lv, cols, rows } = L;
      mips.current = L.w > L.need * 1.3;
      setGrid(tileGrid(cols, rows));
      const look = camera.getWorldDirection(new THREE.Vector3());
      const all = Array.from({ length: cols * rows }, (_, i) => i);
      const byView = all.sort((a, b) => tileDir(b, cols, rows).dot(look) - tileDir(a, cols, rows).dot(look));
      for (const i of byView) {
        tileLoader.load(`pano-hd/${name}/${lv}/${Math.floor(i / cols)}_${i % cols}.jpg`, (bmp) => {
          if (off) { bmp.close(); return; }
          waiting.current.push({ i, bmp });
          invalidate();
        }, undefined, () => undefined);
      }
    });
    return () => { off = true; };
  }, [start, name, gl, camera, invalidate]);
  useEffect(() => () => {
    for (const w of waiting.current) w.bmp.close();
    for (const t of made.current) { t.tex.dispose(); (t.tex.image as ImageBitmap | undefined)?.close?.(); }
  }, []);
  useFrame((state, dt) => {
    // one decoded tile goes to the graphics card per frame
    const next = waiting.current.shift();
    if (next) {
      const tex = new THREE.Texture(next.bmp as unknown as HTMLImageElement);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false; // flipped while decoding
      // shown at about one photo pixel per screen pixel, so smoothing levels (mipmaps) would only cost memory and
      // time, except where the photo is finer than the screen
      tex.generateMipmaps = mips.current;
      tex.minFilter = mips.current ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      if (mips.current) tex.anisotropy = 4;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      gl.initTexture(tex);
      const t: Tile = { i: next.i, tex, a: reducedMotion() ? 1 : 0 };
      made.current.push(t);
      setTiles((l) => [...l, t]);
    }
    let fading = false;
    for (const t of made.current) {
      if (t.a >= 1) continue;
      t.a = Math.min(1, t.a + dt / 0.45);
      if (t.mat) t.mat.opacity = easeInOut(t.a);
      fading = true;
    }
    if (fading || waiting.current.length) state.invalidate();
  });
  return (
    <>
      {tiles.map((t) => grid[t.i] && (
        <mesh key={t.i} geometry={grid[t.i]} scale={[-1, 1, 1]} renderOrder={order}>
          <meshBasicMaterial
            ref={(m: THREE.MeshBasicMaterial | null) => { t.mat = m; if (m) m.opacity = easeInOut(t.a); }}
            map={t.tex} side={THREE.BackSide} toneMapped={false} transparent depthTest={false} depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

// The 360 photo on the inside of a sphere. A new photo (another view, or Bare/Dressed) fades in over the
// previous one instead of popping, and the first one fades in over the blurred room thumbnail.
function Photo({ url, onShown, instant }: { url: string; onShown?: () => void; instant?: boolean }) {
  type Layer = { url: string; tex: THREE.Texture; a: number; mat?: THREE.MeshBasicMaterial };
  const [layers, setLayers] = useState<Layer[]>([]);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let off = false;
    loader.load(url, (tex) => {
      if (off) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      // the first photo appears at once when the whole view dissolves in over the 3D model; later ones crossfade
      setLayers((l) => [...l.filter((x) => x.url !== url).slice(-1), { url, tex, a: reducedMotion() || (instant && !l.length) ? 1 : 0 }]);
      invalidate();
    });
    return () => { off = true; };
  }, [url, invalidate]);
  // free the photos that are no longer shown
  const prev = useRef<Layer[]>([]);
  useEffect(() => {
    for (const l of prev.current) if (!layers.includes(l)) l.tex.dispose();
    prev.current = layers;
  }, [layers]);
  useEffect(() => () => { for (const l of prev.current) l.tex.dispose(); }, []);
  const shown = useRef(false);
  useFrame((state, dt) => {
    const top = layers[layers.length - 1];
    if (!top) return;
    if (top.a < 1) {
      top.a = Math.min(1, top.a + dt / 0.75);
      if (top.mat) top.mat.opacity = easeInOut(top.a);
      if (top.a >= 1) setLayers((l) => l.slice(-1));
      else state.invalidate();
    }
    if (top.a >= 1 && !shown.current) { shown.current = true; onShown?.(); }
  });
  return (
    <>
      {layers.map((l, i) => (
        <group key={l.url}>
          <mesh geometry={sphere} scale={[-1, 1, 1]} renderOrder={i * 10}>
            <meshBasicMaterial
              ref={(m: THREE.MeshBasicMaterial | null) => { if (m && l.mat !== m) { l.mat = m; m.opacity = easeInOut(l.a); } }}
              map={l.tex} side={THREE.BackSide} toneMapped={false} transparent depthTest={false} depthWrite={false}
            />
          </mesh>
          {/* the full-quality tiles follow once this photo's preview is fully on screen */}
          <HdTiles name={l.url.replace(/^.*\/|\.jpg$/g, '')} start={l.a >= 1} order={i * 10 + 1} />
        </group>
      ))}
    </>
  );
}

// Points the 360 view the right way. When it first opens it faces exactly where the 3D view faced on landing; when
// the visitor switches to another view of the room, they keep facing the same way in the room.
function Heading({ yaw }: { yaw: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    panoLink.camera = camera;
    return () => { if (panoLink.camera === camera) panoLink.camera = null; };
  }, [camera]);
  useLayoutEffect(() => {
    const p = camera.position;
    if (prev.current === null) {
      if (panoLink.heading !== null) {
        const a = panoLink.heading - yaw; // the same direction, in the photo's own angles
        p.set(-Math.cos(a) * 0.1, 0, -Math.sin(a) * 0.1);
      }
    } else if (prev.current !== yaw) {
      const a = Math.atan2(p.z, p.x) + (prev.current - yaw), r = Math.hypot(p.x, p.z);
      p.set(Math.cos(a) * r, p.y, Math.sin(a) * r);
    }
    camera.lookAt(0, 0, 0);
    prev.current = yaw;
    invalidate();
  }, [yaw, camera, invalidate]);
  return null;
}

// Scroll to zoom, eased toward the target field of view
function Zoom({ el }: { el: HTMLElement | null }) {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const target = useRef(cam.fov);
  useEffect(() => {
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); target.current = Math.min(95, Math.max(35, target.current + e.deltaY * 0.05)); invalidate(); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [el, invalidate]);
  useFrame((state, dt) => {
    const d = target.current - cam.fov;
    if (Math.abs(d) < 0.01) return;
    cam.fov += d * (1 - Math.exp(-dt * 10));
    cam.updateProjectionMatrix();
    state.invalidate();
  });
  return null;
}

function PanoScreen({ roomId, camN }: { roomId: string; camN: number }) {
  const r = roomById(roomId)!;
  const finish = useStore((s) => s.finish);
  const reveal = useStore((s) => s.reveal);
  const set = useStore((s) => s.set);
  const [f, setF] = useState(finish);
  const [sheet, setSheet] = useState(false); // phones: the details sheet starts folded
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const cam = r.cams.find((c) => c.n === camN) || r.cams[0];
  const hasBare = cam.n !== 1 && cam.bare !== false;
  const url = `pano/c${cam.n}-${f === 'bare' && hasBare ? 'b' : 'd'}.jpg`;
  const tour = TOUR_URL ? `${TOUR_URL}#media-name=${encodeURIComponent(cam.name + (f === 'bare' ? ' unfurnished' : ' furnished'))}` : '';
  const back = () => set({ pano: null });
  return (
    <div className={'pano-full' + (reveal ? ' revealed' : '')} role="dialog" aria-modal="true" aria-label={r.name + ' 360° view'}>
      <div className="pano-stage" ref={setStage} style={r.thumb ? ({ '--thumb': `url(${r.thumb})` } as React.CSSProperties) : undefined}>
        <Canvas frameloop="demand" camera={{ fov: 72, position: [0, 0, 0.1] }} flat>
          <Heading yaw={yawOf(cam)} />
          <Photo url={url} instant={useStore.getState().inside} onShown={() => { if (!useStore.getState().panoShown) set({ panoShown: true }); }} />
          <OrbitControls enableZoom={false} enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={-0.35} target={[0, 0, 0]} />
          <Zoom el={stage} />
        </Canvas>
      </div>
      <div className="pano-top">
        <button className="back-btn" onClick={back}><Icon name="chevL" size={18} /><span>Back to 3D</span></button>
      </div>
      <aside className={'pano-side glass' + (sheet ? ' open' : '')}>
        <button className="pano-side-head" onClick={() => setSheet(!sheet)} aria-expanded={sheet}>
          <span>
            <span className="chip">{ZONES[r.zone]}</span>
            <h2>{r.name}</h2>
          </span>
          <span className="sheet-chev"><Icon name="chevD" size={18} /></span>
        </button>
        <div className="pano-side-body">
          <p className="desc">{r.info}</p>
          {r.cams.length > 1 && (
            <>
              <div className="sub">Views</div>
              <div className="cams">
                {r.cams.map((c) => (
                  <button key={c.n} className={c.n === cam.n ? 'on' : ''} onClick={() => set({ pano: { room: r.id, cam: c.n } })}>{c.name}</button>
                ))}
              </div>
            </>
          )}
          {hasBare && (
            <div className="pano-finish">
              <Seg small label="Finish" value={f} onChange={setF} options={[{ v: 'bare', label: 'Bare' }, { v: 'dressed', label: 'Dressed' }]} />
            </div>
          )}
          <RoomFacts r={r} />
          {tour && <a className="btn tour-btn" href={tour} target="_blank" rel="noreferrer"><Icon name="pano" size={16} />Open in the tour</a>}
        </div>
      </aside>
      <div className="pano-hint"><Icon name="info" size={14} /> Drag to look around · scroll to zoom</div>
    </div>
  );
}

type PanoState = { room: string; cam: number };
const BASE_TITLE = typeof document !== 'undefined' ? document.title : '';

// Keep the 360 view in step with browser history, so the browser's Back button and the phone's back
// gesture close it, and Forward opens it again. Opening adds one history entry; switching between the
// room's views only updates that entry, so one Back always returns to the 3D model. Closing it in the app
// (Back to 3D, Esc) steps back over the entry, so the history never collects stale ones.
function usePanoHistory() {
  useEffect(() => {
    // a 360 view left open by a page reload isn't restored, so drop its marker
    if (history.state?.pv360) history.replaceState({ ...history.state, pv360: undefined }, '');
    let last: PanoState | null = useStore.getState().pano;
    let fromHistory = false; // the change came from Back/Forward: don't touch history again
    let stepping = false;    // we called history.back() and its popstate hasn't arrived yet
    let pushLater: PanoState | null = null; // opened again before that popstate arrived
    const title = (p: PanoState | null) => {
      const r = p && roomById(p.room);
      document.title = r ? `${r.name} · 360° | ${BASE_TITLE.split('|')[0].trim()}` : BASE_TITLE;
    };
    const off = useStore.subscribe((s) => {
      const p = s.pano;
      if (p === last) return;
      const was = last;
      last = p;
      title(p);
      if (fromHistory) return;
      if (p && !was) {
        if (stepping) pushLater = p; // wait until the pending Back has landed, or the new entry would be undone
        else history.pushState({ ...history.state, pv360: p }, '');
      } else if (p && was) {
        if (history.state?.pv360) history.replaceState({ ...history.state, pv360: p }, '');
        else if (stepping) pushLater = p;
      } else if (!p && was) {
        pushLater = null;
        if (history.state?.pv360 && !stepping) { stepping = true; history.back(); }
      }
    });
    const onPop = (e: PopStateEvent) => {
      if (stepping) {
        // the Back we triggered ourselves: the view is already closed
        stepping = false;
        if (pushLater) {
          // a room was opened while that Back was on its way: give it its entry now, with the right address
          const p = pushLater, rid = useStore.getState().roomId;
          pushLater = null;
          const url = rid ? '#room=' + rid : location.pathname + location.search;
          history.replaceState(history.state, '', url);
          history.pushState({ ...history.state, pv360: p }, '', url);
        }
        return;
      }
      const p: PanoState | null = e.state?.pv360 ?? null;
      const s = useStore.getState();
      fromHistory = true;
      try {
        if (p && roomById(p.room)) {
          // Forward into a 360 view: the camera flies in again (see Dive)
          if (s.roomId !== p.room) s.set({ roomId: p.room, itemId: null });
          s.set({ pano: p, panel: null, help: false });
        } else if (s.pano) {
          // a phone's swipe-back already animates the change itself; close without our fade so it isn't doubled
          if ((e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition) {
            document.documentElement.classList.add('ua-transition');
            setTimeout(() => document.documentElement.classList.remove('ua-transition'), 300);
          }
          s.set({ pano: null });
        }
      } finally {
        fromHistory = false;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => { off(); window.removeEventListener('popstate', onPop); };
  }, []);
}

// Full-screen 360 view with the room details on the right and a way back to the 3D model
export function PanoView() {
  usePanoHistory();
  const pano = useStore((s) => s.pano);
  const mount = useStore((s) => s.panoMount || !s.inside);
  // keyboard focus moves into the 360 view when it opens (also when Forward reopens it mid-fade),
  // and returns to where it came from when it closes
  const open = !!pano && mount;
  const from = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      from.current = document.activeElement as HTMLElement | null;
      document.querySelector<HTMLElement>('.fx:not([data-closing]) > .pano-full .back-btn')?.focus({ preventScroll: true });
    } else if (from.current) {
      const f = from.current;
      from.current = null;
      if (f.isConnected && !f.closest('[inert]')) f.focus({ preventScroll: true });
    }
  }, [open]);
  return (
    <Switcher k={open ? 'pano' : null}>
      {open && roomById(pano!.room) ? <PanoScreen roomId={pano!.room} camN={pano!.cam} /> : null}
    </Switcher>
  );
}
