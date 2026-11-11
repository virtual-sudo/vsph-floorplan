import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, ThreeEvent, useFrame, useThree, addEffect, addAfterEffect, addTail, invalidate } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA, ToneMapping, Outline, Selection, Bloom, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import { Architecture } from './Architecture';
import { Furniture } from './Furniture';
import { Lighting, nightLightRig, preloadNightSky } from './Lighting';
import { CameraRig } from './CameraRig';
import { Capture } from './Capture';
import { useStore } from '../store';
import { rooms, wx, wz, S, CX, CY, Room } from '../data/plan';
import { Icon } from '../ui/icons';
import { setMaxAniso, withCut } from './matlib';
import { setRenderer, refreshShadows } from './redraw';
import { DEBUG } from '../debug';

function inPoly(x: number, y: number, poly: number[][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function roomAt(X: number, Z: number): Room | null {
  const px = X / S + CX, py = Z / S + CY;
  let best: Room | null = null;
  for (const r of rooms) if (inPoly(px, py, r.poly)) { if (!best || r.area < best.area) best = r; }
  return best;
}

function RoomOverlay() {
  const roomId = useStore((s) => s.roomId);
  const hover = useStore((s) => s.hoverRoom);
  const shapes = useMemo(() => {
    const m = new Map<string, { geo: THREE.ShapeGeometry; line: [number, number, number][] }>();
    for (const r of rooms) {
      const pts = r.poly.map(([x, y]) => new THREE.Vector2(wx(x), -wz(y)));
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1);
      g.rotateX(-Math.PI / 2);
      const line = r.poly.map(([x, y]) => [wx(x), 0.03, wz(y)] as [number, number, number]);
      line.push(line[0]);
      m.set(r.id, { geo: g, line });
    }
    return m;
  }, []);
  const show = [roomId, hover && hover !== roomId ? hover : null].filter(Boolean) as string[];
  return (
    <group>
      {show.map((id) => {
        const s = shapes.get(id);
        if (!s) return null;
        const sel = id === roomId;
        return (
          <group key={id}>
            <mesh geometry={s.geo} position={[0, 0.02, 0]} renderOrder={3}>
              <meshBasicMaterial color={sel ? '#c9a66b' : '#ffffff'} transparent opacity={sel ? 0.16 : 0.14} depthWrite={false} toneMapped={false} />
            </mesh>
            <Line points={s.line} color={sel ? '#b8925a' : '#ffffff'} lineWidth={sel ? 2.4 : 1.6} transparent opacity={0.95} renderOrder={4} />
          </group>
        );
      })}
    </group>
  );
}

function Pins() {
  const roomId = useStore((s) => s.roomId);
  const hover = useStore((s) => s.hoverRoom);
  const showPins = useStore((s) => s.showPins);
  const selectRoom = useStore((s) => s.selectRoom);
  const set = useStore((s) => s.set);
  const walls = useStore((s) => s.walls);
  if (!showPins) return null;
  const y = walls === 'cutaway' ? 1.9 : 3.5;
  return (
    <group>
      {rooms.map((r) => {
        const active = r.id === roomId, hot = r.id === hover;
        return (
          <Html key={r.id} position={[wx(r.pin[0]), y, wz(r.pin[1])]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <button
              className={'pin' + (active ? ' active' : '') + (hot ? ' hot' : '') + (roomId && !active ? ' dim' : '') + (r.zone === 'outdoor' ? ' out' : '')}
              onClick={(e) => { e.stopPropagation(); selectRoom(r.id); set({ panel: null }); }}
              onPointerEnter={() => set({ hoverRoom: r.id })}
              onPointerLeave={() => { if (useStore.getState().hoverRoom === r.id) set({ hoverRoom: null }); }}
              aria-label={r.name}
            >
              <span className="pin-dot"><Icon name={r.icon} size={14} /></span>
              <span className="pin-label">{r.name}</span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.43, 0]} receiveShadow>
      <planeGeometry args={[140, 140]} />
      <shadowMaterial transparent opacity={0.12} />
    </mesh>
  );
}

function FloorPicker() {
  const selectRoom = useStore((s) => s.selectRoom);
  const set = useStore((s) => s.set);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    const r = roomAt(e.point.x, e.point.z);
    if (r) { selectRoom(r.id); set({ panel: null }); }
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const r = roomAt(e.point.x, e.point.z);
    const id = r ? r.id : null;
    if (useStore.getState().hoverRoom !== id) set({ hoverRoom: id });
  };
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} onClick={onClick} onPointerMove={onMove} onPointerOut={() => set({ hoverRoom: null })}>
      <planeGeometry args={[42, 25]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}

function Effects() {
  const quality = useStore((s) => s.quality);
  const time = useStore((s) => s.time);
  const hi = quality === 'high';
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} autoClear={false}>
      {hi ? <N8AO aoRadius={0.55} distanceFalloff={0.6} intensity={2.4} quality="medium" halfRes={false} color={new THREE.Color('#2a2420')} /> : <></>}
      <Outline visibleEdgeColor={0xc89b55} hiddenEdgeColor={0x7a6a50} edgeStrength={5} blur width={1600} xRay={false} />
      {time === 'night' ? <Bloom intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur /> : <></>}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.32} darkness={0.32} blendFunction={BlendFunction.NORMAL} />
      <SMAA />
    </EffectComposer>
  );
}

// The canvas only draws when something changes. When it starts drawing again after a pause, the first frame
// is timed as a normal 1/60 s step, so animations (room flights, Bare/Dressed) play from the start instead of jumping.
function SteadyClock() {
  const clock = useThree((s) => s.clock);
  const drew = useRef(false);
  useFrame(() => { drew.current = true; }, -10);
  useEffect(() => {
    let idle = true;
    const offBefore = addEffect(() => { if (idle) clock.oldTime = performance.now() - 1000 / 60; });
    const offAfter = addAfterEffect(() => { idle = !drew.current; drew.current = false; });
    const offTail = addTail(() => { idle = true; });
    return () => { offBefore(); offAfter(); offTail(); };
  }, [clock]);
  return null;
}

// Redraw after every interface change, once React has applied it to the scene. Adding or changing objects already
// asks for a frame, but React Three Fiber 9.8.1 does not when an object is only removed (a hover highlight ending,
// for example), which would leave the old picture on screen.
function RedrawOnChange() {
  useStore();
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { invalidate(); });
  useEffect(() => { if (DEBUG) (window as any).__invalidate = invalidate; }, [invalidate]);
  return null;
}

// Compile every material's shader in the background (the GPU's parallel compile) while the loading screen is up,
// instead of all at once on the first frame, which froze the page. Drawing is paused meanwhile, because drawing
// a material that is still compiling forces the browser to wait for it.
function Warmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    let alive = true;
    setFrameloop('never');
    // compile for the same kind of target the effects pipeline draws the scene into, so the shaders match
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const prev = gl.getRenderTarget();
    let job: Promise<unknown>;
    try {
      gl.setRenderTarget(rt);
      job = gl.compileAsync(scene, camera);
    } catch (e) {
      job = Promise.resolve();
    } finally {
      gl.setRenderTarget(prev);
    }
    job.catch(() => undefined).then(() => {
      rt.dispose();
      if (!alive) return;
      setFrameloop('demand');
      invalidate();
      // the first real frame finishes the GPU side of the work behind the loading screen; reveal after it
      requestAnimationFrame(() => requestAnimationFrame(() => { if (alive) useStore.getState().set({ ready: true }); }));
    });
    return () => { alive = false; setFrameloop('demand'); };
  }, [gl, scene, camera, setFrameloop]);
  return null;
}

// Once the residence is on screen, use idle moments to get the other modes ready: download the night sky and
// compile the Night, Full-walls and Night + Full shaders in the background (the GPU's parallel compile), so the
// first switch doesn't stall. It works from the opening Day + Cut view only and stops if the visitor switches
// first; that switch then compiles as before. Nothing is drawn, so the picture on screen is untouched.
function PrewarmVariants() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const ready = useStore((s) => s.ready);
  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    const idle = () => new Promise<void>((res) => {
      const w = window as any;
      if (w.requestIdleCallback) w.requestIdleCallback(() => res(), { timeout: 3000 });
      else setTimeout(res, 1000);
    });
    const opening = () => { const s = useStore.getState(); return s.time === 'day' && s.walls === 'cutaway'; };
    const compile = (night: boolean, cut: boolean) => {
      // the lights come from the scene (sun, sky light) plus this rig (the night lamps)
      const rig = new THREE.Scene();
      rig.environment = scene.environment;
      if (night) for (const l of nightLightRig()) rig.add(l);
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
      const prev = gl.getRenderTarget();
      let job: Promise<unknown> = Promise.resolve();
      try {
        gl.setRenderTarget(rt);
        withCut(cut, () => { job = gl.compileAsync(scene, camera, rig); });
      } catch (e) {
        // leave it to the switch
      } finally {
        gl.setRenderTarget(prev);
      }
      return job.catch(() => undefined).finally(() => rt.dispose());
    };
    (async () => {
      await idle();
      if (stopped) return;
      preloadNightSky();
      const variants: [boolean, boolean][] = [[true, true], [false, false], [true, false]]; // [night, cut]
      for (const [night, cut] of variants) {
        await idle();
        if (stopped || !opening()) return;
        await compile(night, cut);
      }
      if (DEBUG) (window as any).__prewarmed = true;
    })();
    return () => { stopped = true; };
  }, [ready, gl, scene, camera]);
  return null;
}

// everything inside the canvas: the residence floorplan
export function VillaContent() {
  return (
    <>
      <Suspense fallback={null}>
        <Selection>
          <Effects />
          <Lighting />
          <Architecture />
          <Furniture />
          <RoomOverlay />
          <FloorPicker />
          <Ground />
          <Pins />
        </Selection>
        <Warmup />
        <PrewarmVariants />
      </Suspense>
      <CameraRig />
      <SteadyClock />
      <RedrawOnChange />
    </>
  );
}

export function Stage({ children }: { children: React.ReactNode }) {
  const quality = useStore((s) => s.quality);
  const selectItem = useStore((s) => s.selectItem);
  return (
    <Canvas
      frameloop="demand"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
      camera={{ fov: 32, near: 0.1, far: 300, position: [9, 27, 25] }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false }}
      flat
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        setMaxAniso(Math.min(8, gl.capabilities.getMaxAnisotropy()));
        setRenderer(gl);
        // if the browser drops and restores the graphics context (GPU switch, memory pressure), draw everything again
        gl.domElement.addEventListener('webglcontextrestored', () => refreshShadows());
      }}
      onPointerMissed={() => selectItem(null)}
    >
      {children}
      <Capture />
    </Canvas>
  );
}
