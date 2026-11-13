import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../store';
import { roomById, wx, wz, CUT_H, WALL_H, Room } from '../data/plan';
import { setCutHeight, isCutOn } from './matlib';
import { refreshShadows } from './redraw';
import { roomFraming, baseFov, HOME } from './CameraRig';
import { reducedMotion } from '../ui/motion';
import { panoLink, yawOf } from './panoLink';

// Stepping into a 360 view, in the spirit of a Matterport dollhouse: the camera flies from the model down
// to the spot where the photo was taken, at eye height, while the cut-away walls grow back to full height
// and the view widens; near the end the 3D view dissolves into the photo. "Back to 3D" plays it in reverse.

export const EYE = 1.55; // camera height of the photos, in metres
const IN_TIME = 2.1, OUT_TIME = 1.8; // seconds
const REVEAL_AT = 0.8; // share of the flight after which the photo may dissolve in (as soon as it is on screen)
const INSIDE_FOV = 72; // close to the 360 viewer's 75 degrees

// How far the cut walls have grown back: 0 = cut height, 1 = full height. Read by Architecture every frame.
export const walls = { rise: 0 };
export const riseScale = () => (CUT_H + (WALL_H - CUT_H) * walls.rise) / WALL_H;

const MOUNT_AT = 0.8; // the 360 viewer is created here, when the camera is nearly still, so its set-up pause doesn't show

// CSS-style cubic-bezier timing: gets moving promptly, then a long, soft landing
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x: number) => {
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
    return by(t);
  };
}
const ease = cubicBezier(0.42, 0, 0.18, 1);
const smooth = (a: number, b: number, t: number) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const bez = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, t: number, out: THREE.Vector3) => {
  const u = 1 - t;
  return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
};

interface Flight {
  kind: 'in' | 'out';
  t: number; dur: number;
  p: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]; // camera path (cubic Bezier)
  d0: THREE.Vector3; d1: THREE.Vector3; // look direction at the start and the end
  dist0: number; dist1: number; // distance to the look target
  fov0: number; fov1: number;
  rise0: number; rise1: number;
}

// Which way to look on arrival: into the room (toward its middle), so the view never ends facing a nearby wall
// or window; if the photo was taken in the middle, keep the way the visitor was already looking
function facing(r: Room, eye: THREE.Vector3, along: THREE.Vector3) {
  let x = 0, y = 0;
  for (const p of r.poly) { x += p[0]; y += p[1]; }
  const mid = new THREE.Vector3(wx(x / r.poly.length), eye.y, wz(y / r.poly.length)).sub(eye).setY(0);
  if (mid.length() >= 0.6) return mid.normalize();
  const ahead = along.clone().setY(0);
  return ahead.lengthSq() < 1e-6 ? ahead.set(0, 0, -1) : ahead.normalize();
}
const _q = new THREE.Quaternion(), _q0 = new THREE.Quaternion();
// turn smoothly from one look direction to another (never through a degenerate in-between)
const turn = (a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) => {
  _q.setFromUnitVectors(a, b);
  return out.copy(a).applyQuaternion(_q0.identity().slerp(_q, t));
};

export function Dive() {
  const controls = useThree((s) => s.controls) as any;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const live = useRef({ controls, camera, size, invalidate });
  live.current = { controls, camera, size, invalidate };
  const flight = useRef<Flight | null>(null);

  useEffect(() => {
    const st = useStore.getState;
    const begin = (kind: 'in' | 'out', closing?: { room: string; cam: number } | null) => {
      const { controls: c, camera: cam, size: sz, invalidate: inv } = live.current;
      const s = st();
      const r = roomById(s.pano?.room || s.roomId);
      if (kind === 'in') {
        const shot = s.pano && r ? r.cams.find((k) => k.n === s.pano!.cam) || r.cams[0] : null;
        if (!c || !r || !shot || reducedMotion()) {
          // no flight: show the photo straight away (the room is framed in 3D for when the view closes)
          s.set({ reveal: true, panoMount: true });
          if (r && !s.inside) s.requestView('room', r.id);
          return;
        }
        const from = cam.position.clone();
        const target = c.getTarget(new THREE.Vector3());
        const look = target.clone().sub(from);
        const eye = new THREE.Vector3(wx(shot.x), EYE, wz(shot.y));
        const dir = facing(r, eye, look);
        panoLink.heading = Math.atan2(dir.z, dir.x); // the photo will open facing exactly this way
        // glide over the room, then drop into it from above (never through a wall), easing forward at the end
        const over = new THREE.Vector3(eye.x, Math.max(EYE + 4, from.y * 0.35), eye.z);
        // fetch the photo now, so it is ready when the 360 viewer is created near the landing
        const img = new Image();
        img.src = `pano/c${shot.n}-${s.finish === 'bare' && shot.n !== 1 ? 'b' : 'd'}.jpg`;
        img.decode?.().catch(() => undefined);
        flight.current = {
          kind, t: 0, dur: IN_TIME,
          p: [from, from.clone().lerp(over, 0.6), eye.clone().addScaledVector(dir, -0.4).setY(EYE + 2), eye],
          d0: look.clone().normalize(), d1: dir.clone().setY(-0.04).normalize(),
          dist0: look.length(), dist1: 3,
          fov0: cam.fov, fov1: INSIDE_FOV, rise0: walls.rise, rise1: 1
        };
        c.enabled = false;
        c.maxPolarAngle = Math.PI * 0.85; // allow eye-height views, also looking up (to match the photo on the way out)
        s.set({ inside: true, reveal: false, panoShown: false, panoMount: false });
      } else {
        s.set({ reveal: false, panoShown: false, panoMount: false });
        if (!s.inside || !c) {
          if (s.itemId) s.requestView('item', s.itemId);
          return;
        }
        // behind the photo (still fully visible), turn the 3D view to face wherever the visitor was looking in it,
        // at the same zoom, so the photo dissolves into a matching view
        const pc = panoLink.camera, was = closing && roomById(closing.room)?.cams.find((k) => k.n === closing.cam);
        if (pc && was) {
          const v = pc.position.clone().negate().normalize();
          const az = Math.atan2(v.z, v.x) + yawOf(was), el = Math.asin(Math.max(-0.95, Math.min(0.95, v.y)));
          const p0 = cam.position;
          c.setLookAt(p0.x, p0.y, p0.z, p0.x + Math.cos(el) * Math.cos(az) * 3, p0.y + Math.sin(el) * 3, p0.z + Math.cos(el) * Math.sin(az) * 3, false);
          c.update(0);
          cam.fov = pc.fov;
          cam.updateProjectionMatrix();
        }
        const from = cam.position.clone();
        const target = c.getTarget(new THREE.Vector3());
        const look = target.clone().sub(from);
        const flat = look.clone().setY(0).normalize();
        const narrow = sz.width < 760;
        // rise back out behind where we were looking, to the room's overview (or the home view)
        const az = Math.atan2(-flat.x, -flat.z);
        const to = r ? roomFraming(r, az, narrow) : { pos: HOME.pos.clone(), target: HOME.target.clone() };
        const toLook = to.target.clone().sub(to.pos);
        flight.current = {
          kind, t: 0, dur: OUT_TIME,
          p: [from, from.clone().addScaledVector(flat, -0.8).setY(from.y + 1.8), new THREE.Vector3(from.x, Math.max(EYE + 4, to.pos.y * 0.35), from.z).lerp(to.pos, 0.4), to.pos],
          d0: look.clone().normalize(), d1: toLook.clone().normalize(),
          dist0: look.length(), dist1: toLook.length(),
          fov0: cam.fov, fov1: baseFov(sz.width, sz.height), rise0: walls.rise, rise1: 0
        };
      }
      inv();
    };
    // another view of the same room while inside: move to it behind the photo, ready for the way out
    const moveTo = () => {
      const { controls: c } = live.current;
      const s = st();
      const r = roomById(s.pano?.room || null);
      const shot = s.pano && r ? r.cams.find((k) => k.n === s.pano!.cam) : null;
      if (!c || !r || !shot || !s.inside || flight.current) return;
      const eye = new THREE.Vector3(wx(shot.x), EYE, wz(shot.y));
      const dir = facing(r, eye, c.getTarget(new THREE.Vector3()).sub(live.current.camera.position));
      const t = eye.clone().addScaledVector(dir, 3).setY(EYE - 0.12);
      c.setLookAt(eye.x, eye.y, eye.z, t.x, t.y, t.z, false);
      live.current.camera.fov = INSIDE_FOV;
      live.current.camera.updateProjectionMatrix();
    };
    return useStore.subscribe((s, prev) => {
      if (s.pano !== prev.pano) {
        if (s.pano && !prev.pano) begin('in');
        else if (!s.pano && prev.pano) begin('out', prev.pano);
        else moveTo();
      }
      // the photo finished loading after the flight had already landed
      if (s.panoShown && !prev.panoShown && s.pano && s.inside && !s.reveal && (!flight.current || flight.current.t >= REVEAL_AT)) s.set({ reveal: true });
    });
  }, []);

  const pos = useRef(new THREE.Vector3());
  const shadowClock = useRef(0);
  const dir = useRef(new THREE.Vector3());
  useFrame((state, dt) => {
    const f = flight.current;
    const c = live.current.controls;
    if (!f || !c) return;
    // a slow frame (a shader compiling) lengthens the flight a little rather than skipping part of it
    f.t = Math.min(1, f.t + Math.min(dt, 1 / 15) / f.dur);
    const e = ease(f.t);
    bez(f.p[0], f.p[1], f.p[2], f.p[3], e, pos.current);
    // going in, keep looking down at the room and tilt up to eye level near the end; going out, the reverse
    turn(f.d0, f.d1, f.kind === 'in' ? ease(smooth(0.3, 1, f.t)) : ease(smooth(0, 0.7, f.t)), dir.current);
    const tgt = pos.current.clone().addScaledVector(dir.current, f.dist0 + (f.dist1 - f.dist0) * e);
    c.setLookAt(pos.current.x, pos.current.y, pos.current.z, tgt.x, tgt.y, tgt.z, false);
    const cam = live.current.camera;
    cam.fov = f.fov0 + (f.fov1 - f.fov0) * (f.kind === 'in' ? smooth(0.3, 1, f.t) : smooth(0, 0.7, f.t));
    cam.updateProjectionMatrix();
    // walls grow back during the middle of the descent, and come down in the first part of the way out
    walls.rise = f.rise0 + (f.rise1 - f.rise0) * (f.kind === 'in' ? smooth(0.2, 0.8, f.t) : smooth(0.15, 0.75, f.t));
    if (isCutOn()) setCutHeight(walls.rise >= 0.999 ? 1000 : CUT_H + 0.02 + (WALL_H - CUT_H) * walls.rise);
    // the sun shadow follows the walls a few times a second (redrawing it every frame would slow the flight)
    shadowClock.current += dt;
    if (shadowClock.current > 0.18 || f.t >= 1) { shadowClock.current = 0; refreshShadows(1); }
    const s = useStore.getState();
    if (f.kind === 'in' && f.t >= MOUNT_AT && !s.panoMount) s.set({ panoMount: true });
    if (f.kind === 'in' && f.t >= REVEAL_AT && s.panoShown && !s.reveal) s.set({ reveal: true });
    if (f.t >= 1) {
      flight.current = null;
      if (f.kind === 'out') {
        walls.rise = 0;
        if (isCutOn()) setCutHeight(CUT_H + 0.02);
        c.maxPolarAngle = 1.48;
        c.enabled = true;
        s.set({ inside: false });
        if (s.itemId) s.requestView('item', s.itemId);
      }
    }
    state.invalidate();
  });
  return null;
}
