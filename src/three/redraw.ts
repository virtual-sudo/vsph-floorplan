import * as THREE from 'three';
import { invalidate } from '@react-three/fiber';

// The canvas only draws when something changes (frameloop "demand"), and the sun shadow is only
// redrawn when the scene changes, because neither the sun nor the furniture moves with the camera.

let renderer: THREE.WebGLRenderer | null = null;
let shadowFrames = 0;

export function setRenderer(gl: THREE.WebGLRenderer) { renderer = gl; }
export function getRenderer() { return renderer; }

// Redraw the shadow on the next few frames. A couple of extra frames cover changes that React applies
// a moment after the store changes (new wall heights, materials swapped in).
export function refreshShadows(frames = 3) {
  shadowFrames = Math.max(shadowFrames, frames);
  if (renderer) renderer.shadowMap.needsUpdate = true;
  invalidate();
}

// Called once per drawn frame, before the scene is rendered
export function takeShadowFrame() {
  if (shadowFrames <= 0 || !renderer) return;
  shadowFrames--;
  renderer.shadowMap.needsUpdate = true;
  if (shadowFrames > 0) invalidate();
}
