import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { DEBUG } from '../debug';

// Saves the current view as a large PNG: the scene is re-rendered at a higher pixel ratio
// (about 3840 px wide, 4K, or more on wide screens), read back, then the screen returns to normal.
export const captureApi: { run?: (longSide?: number) => Promise<{ blob: Blob; width: number; height: number } | null> } = {};

// the canvas only draws on request, so ask for a frame each step
const frames = (n: number, invalidate: () => void) => new Promise<void>((res) => {
  const step = () => { if (n-- <= 0) res(); else { invalidate(); requestAnimationFrame(step); } };
  invalidate();
  requestAnimationFrame(step);
});

export function Capture() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const setDpr = useThree((s) => s.setDpr);
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    captureApi.run = async (longSide = 3840) => {
      const max = Math.min(gl.capabilities.maxTextureSize, 8192);
      const long = Math.max(size.width, size.height);
      const ratio = Math.max(1, Math.min(longSide / long, max / long));
      const before = dpr;
      setDpr(ratio);
      // one frame applies the new size, one renders it, one spare
      await frames(3, invalidate);
      const width = gl.domElement.width, height = gl.domElement.height;
      const blob = await new Promise<Blob | null>((res) => gl.domElement.toBlob(res, 'image/png'));
      setDpr(before);
      invalidate();
      return blob ? { blob, width, height } : null;
    };
    if (DEBUG) (window as any).__capture = captureApi.run;
    return () => { captureApi.run = undefined; };
  }, [gl, size.width, size.height, setDpr, dpr, invalidate]);
  return null;
}
