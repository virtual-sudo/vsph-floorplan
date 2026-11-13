import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraControls } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useStore } from '../store';
import { roomById, wx, wz, Room } from '../data/plan';
import { itemBounds } from './Furniture';
import { DEBUG } from '../debug';

export const HOME = { pos: new THREE.Vector3(11, 34, 31), target: new THREE.Vector3(0.6, 0, 1.2) };
// phones in portrait: look along the long side of the plan so it fills the tall screen
export const HOME_PORTRAIT = { pos: new THREE.Vector3(30, 50, 4.5), target: new THREE.Vector3(0.6, 0, 0.8) };
const homeFor = (w: number, h: number) => (w / h < 0.8 ? HOME_PORTRAIT : HOME);
export const baseFov = (w: number, h: number) => (w / h < 0.8 ? 44 : 32);

// The overview of a room: keep the compass direction az, look down at about 52 degrees
export function roomFraming(r: Room, az: number, narrow: boolean) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of r.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const cx = wx((x0 + x1) / 2), cz = wz((y0 + y1) / 2);
  const span = Math.max(wx(x1) - wx(x0), wz(y1) - wz(y0));
  const dist = (Math.max(5, span) * 1.85 + 4) * (narrow ? 1.25 : 1);
  const pol = 0.66;
  return {
    pos: new THREE.Vector3(cx + Math.sin(az) * Math.sin(pol) * dist, Math.cos(pol) * dist, cz + Math.cos(az) * Math.sin(pol) * dist),
    target: new THREE.Vector3(cx, 0.4, cz)
  };
}

export function CameraRig() {
  const ref = useRef<CameraControls>(null!);
  const viewReq = useStore((s) => s.viewReq);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const panel = useStore((s) => s.panel);
  const roomId = useStore((s) => s.roomId);
  const itemId = useStore((s) => s.itemId);
  const help = useStore((s) => s.help);
  const pano = useStore((s) => s.pano);
  const invalidate = useThree((s) => s.invalidate);

  // Keep the model centred in the space left free by the side panels (and above the bottom sheet on phones).
  // When a panel opens or closes, the framing glides to its new centre instead of jumping.
  const off = useRef({ x: 0, y: 0, tx: 0, ty: 0, init: false });
  const applyOffset = () => {
    const o = off.current;
    if (Math.abs(o.x) > 0.01 || Math.abs(o.y) > 0.01) camera.setViewOffset(size.width, size.height, o.x, o.y, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  useEffect(() => {
    const desktop = size.width >= 760;
    let sx = 0, sy = 0;
    if (pano) {
      // stepping into a 360 view: the whole screen is the view, so centre it
    } else if (desktop) {
      // the right column's width is always kept free, so the wide plan doesn't run off the right edge
      const left = 90 + (panel ? 345 : 0);
      const right = 356;
      sx = (right - left) / 2;
    } else if (panel || roomId || itemId || help) {
      sy = Math.min(size.height * 0.24, 230);
    }
    // (while standing inside a room for its 360 view, the fly-in owns the field of view)
    if (!useStore.getState().inside) camera.fov = baseFov(size.width, size.height);
    const o = off.current;
    o.tx = sx; o.ty = sy;
    if (!o.init) { o.x = sx; o.y = sy; o.init = true; }
    applyOffset();
    invalidate();
  }, [size.width, size.height, panel, roomId, itemId, help, pano, camera, invalidate]);
  useFrame((state, dt) => {
    const o = off.current;
    const dx = o.tx - o.x, dy = o.ty - o.y;
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) { o.x = o.tx; o.y = o.ty; }
    else { const k = 1 - Math.exp(-dt * 6); o.x += dx * k; o.y += dy * k; state.invalidate(); }
    applyOffset();
  });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const H = homeFor(size.width, size.height);
    c.setLookAt(H.pos.x, H.pos.y, H.pos.z, H.target.x, H.target.y, H.target.z, false);
    invalidate();
    if (DEBUG) (window as any).__cc = c;
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c || viewReq.n === 0) return;
    const narrow = size.width < 760;
    const k = narrow ? 1.25 : 1;
    if (viewReq.kind === 'home') {
      const H = homeFor(size.width, size.height);
      c.setLookAt(H.pos.x, H.pos.y, H.pos.z, H.target.x, H.target.y, H.target.z, true);
    } else if (viewReq.kind === 'top') {
      if (size.width / size.height < 0.8) c.setLookAt(0.0001, 70, 0.6, 0, 0, 0.6, true).then(() => c.rotateAzimuthTo(Math.PI / 2, true));
      else c.setLookAt(0.0001, 46, 0.6, 0, 0, 0.6, true);
    } else if (viewReq.kind === 'room') {
      const r = roomById(viewReq.id || null);
      if (!r) return;
      const f = roomFraming(r, c.azimuthAngle, narrow);
      c.setLookAt(f.pos.x, f.pos.y, f.pos.z, f.target.x, f.target.y, f.target.z, true);
    } else if (viewReq.kind === 'item') {
      const b = itemBounds(viewReq.id || '');
      if (!b) return;
      const ctr = b.getCenter(new THREE.Vector3());
      const sz = b.getSize(new THREE.Vector3());
      const dist = (Math.max(1.4, sz.x, sz.z) * 2.2 + 2.2) * k;
      const az = c.azimuthAngle;
      const pol = 0.95;
      c.setLookAt(ctr.x + Math.sin(az) * Math.sin(pol) * dist, ctr.y + Math.cos(pol) * dist, ctr.z + Math.cos(az) * Math.sin(pol) * dist, ctr.x, ctr.y, ctr.z, true);
    }
  }, [viewReq, size.width]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={1.2}
      maxDistance={80}
      minPolarAngle={0.02}
      maxPolarAngle={1.48}
      smoothTime={0.6}
      draggingSmoothTime={0.14}
      dollySpeed={0.6}
      truckSpeed={1.2}
    />
  );
}
