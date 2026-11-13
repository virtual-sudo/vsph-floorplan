import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useLoader, useFrame } from '@react-three/fiber';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Environment } from '@react-three/drei';
import { useStore } from '../store';
import { setNight } from './matlib';
import { refreshShadows, takeShadowFrame } from './redraw';
import { rooms, wx, wz } from '../data/plan';
import { DEBUG } from '../debug';

const PRESETS = {
  day: {
    bg: '#e9e7e2', env: 'hdr/lebombo_1k', envI: 0.42, envRot: 0.8,
    // the sun stands in the east, about 45 degrees up, as in the 360 photos (the Dining Terrace panorama shows it)
    sun: { pos: [20, 22, 9], color: '#fff1dc', i: 3.4 },
    hemi: { sky: '#e9eef5', ground: '#b9a68a', i: 0.32 },
    exposure: 0.95
  },
  night: {
    bg: '#20242c', env: 'hdr/dikhololo_night_1k', envI: 0.35, envRot: 0,
    sun: { pos: [12, 24, -10], color: '#9fb4dd', i: 0.25 },
    hemi: { sky: '#3b4a66', ground: '#1d1a17', i: 0.18 },
    exposure: 1.05
  }
} as const;

export function Lighting() {
  const time = useStore((s) => s.time);
  const P = PRESETS[time];
  const sun = useRef<THREE.DirectionalLight>(null!);
  const { scene, gl } = useThree();
  useEffect(() => { if (DEBUG) { (window as any).__three = { scene, gl }; (window as any).__THREE = THREE; } }, [scene, gl]);

  useEffect(() => {
    scene.background = new THREE.Color(P.bg);
    gl.toneMappingExposure = P.exposure;
    setNight(time === 'night' ? 1 : 0);
    refreshShadows(); // the sun moved; this also asks for a redraw
  }, [P, time, scene, gl]);

  // The sun shadow is drawn once and kept, instead of being redrawn every frame. It is refreshed when the
  // scene changes: here for materials, and from the walls, Bare/Dressed and lighting code for the rest.
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    refreshShadows();
    const off = useStore.subscribe((s, p) => {
      if (s.overrides !== p.overrides || s.wallPaint !== p.wallPaint || s.floorMats !== p.floorMats || s.showPlan !== p.showPlan) refreshShadows();
    });
    return () => { off(); gl.shadowMap.autoUpdate = true; };
  }, [gl]);
  useFrame(() => takeShadowFrame());

  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(0, 0, 0);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.left = -24; cam.right = 24; cam.top = 16; cam.bottom = -16; cam.near = 1; cam.far = 90;
    cam.updateProjectionMatrix();
    l.shadow.mapSize.set(4096, 4096);
    if (l.shadow.map) { l.shadow.map.dispose(); (l.shadow as any).map = null; }
    l.shadow.bias = -0.00025;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 4;
    l.shadow.blurSamples = 12;
    l.shadow.needsUpdate = true;
  }, []);

  return (
    <>
      <Sky url={P.env + HDR_EXT} intensity={P.envI} rot={P.envRot} />
      <hemisphereLight args={[P.hemi.sky, P.hemi.ground, P.hemi.i]} />
      <directionalLight ref={sun} position={P.sun.pos as unknown as [number, number, number]} color={P.sun.color} intensity={P.sun.i} castShadow />
      {time === 'night' && <NightLights strength={1} />}
    </>
  );
}

// warm interior pools of light, one per indoor room, at night
const NIGHT_SPOTS = rooms.filter((r) => r.zone !== 'outdoor').map((r) => {
  let x = 0, y = 0;
  for (const p of r.poly) { x += p[0]; y += p[1]; }
  x /= r.poly.length; y /= r.poly.length;
  return { id: r.id, p: [wx(x), 2.55, wz(y)] as [number, number, number], big: r.area > 25 };
});
function NightLights({ strength }: { strength: number }) {
  return (
    <group>
      {NIGHT_SPOTS.map((p) => (
        <pointLight key={p.id} position={p.p} color="#ffcf96" intensity={(p.big ? 14 : 8) * strength} distance={p.big ? 9 : 6.5} decay={1.6} />
      ))}
    </group>
  );
}

// The extra lights the night adds, as plain objects, so the night shaders can be compiled ahead of time
export function nightLightRig(): THREE.Object3D[] {
  return NIGHT_SPOTS.map((p) => new THREE.PointLight('#ffcf96', p.big ? 14 : 8, p.big ? 9 : 6.5, 1.6));
}

// some hosts only serve common file types, so the build can rename the sky files (VITE_HDR_EXT=.hdr.png)
const HDR_EXT: string = (import.meta as any).env?.VITE_HDR_EXT || '.hdr';

// Download the night sky ahead of time, so the first switch to Night doesn't have to wait for it
export function preloadNightSky() {
  useLoader.preload(HDRLoader, PRESETS.night.env + HDR_EXT);
}
function Sky({ url, intensity, rot }: { url: string; intensity: number; rot: number }) {
  const tex = useLoader(HDRLoader, url);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return <Environment map={tex} environmentIntensity={intensity} environmentRotation={[0, rot, 0]} />;
}
