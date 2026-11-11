import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useStore } from '../store';
import { roomById, wx, wz } from '../data/plan';
import { itemBounds } from './Furniture';
import { DEBUG } from '../debug';

export const HOME = { pos: new THREE.Vector3(11, 34, 31), target: new THREE.Vector3(0.6, 0, 1.2) };
// phones in portrait: look along the long side of the plan so it fills the tall screen
export const HOME_PORTRAIT = { pos: new THREE.Vector3(30, 50, 4.5), target: new THREE.Vector3(0.6, 0, 0.8) };
const homeFor = (w: number, h: number) => (w / h < 0.8 ? HOME_PORTRAIT : HOME);

export function CameraRig() {
  const ref = useRef<CameraControls>(null!);
  const viewReq = useStore((s) => s.viewReq);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const panel = useStore((s) => s.panel);
  const roomId = useStore((s) => s.roomId);
  const itemId = useStore((s) => s.itemId);
  const invalidate = useThree((s) => s.invalidate);

  // keep the model centred in the space left free by the side panels (and above the bottom sheet on phones)
  useEffect(() => {
    const desktop = size.width >= 760;
    let sx = 0, sy = 0;
    if (desktop) {
      const left = 90 + (panel ? 345 : 0);
      const right = 356;
      sx = Math.round((right - left) / 2);
    } else if (panel || roomId || itemId) {
      sy = Math.round(Math.min(size.height * 0.24, 230));
    }
    camera.fov = size.width / size.height < 0.8 ? 44 : 32;
    if (sx || sy) camera.setViewOffset(size.width, size.height, sx, sy, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    invalidate();
  }, [size.width, size.height, panel, roomId, itemId, camera, invalidate]);

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
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of r.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      const cx = wx((x0 + x1) / 2), cz = wz((y0 + y1) / 2);
      const span = Math.max(wx(x1) - wx(x0), wz(y1) - wz(y0));
      const dist = (Math.max(5, span) * 1.85 + 4) * k;
      // keep the current compass direction, look down at about 52 degrees
      const az = c.azimuthAngle;
      const pol = 0.66;
      const px = cx + Math.sin(az) * Math.sin(pol) * dist;
      const pz = cz + Math.cos(az) * Math.sin(pol) * dist;
      const py = Math.cos(pol) * dist;
      c.setLookAt(px, py, pz, cx, 0.4, cz, true);
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
      smoothTime={0.42}
      draggingSmoothTime={0.12}
      dollySpeed={0.6}
      truckSpeed={1.2}
    />
  );
}
