import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Wait for every running CSS transition/animation inside el to finish (with a failsafe), then call done
function afterAnimations(el: Element | null, done: () => void) {
  const anims = el ? el.getAnimations({ subtree: true }) : [];
  if (!anims.length) { done(); return; }
  Promise.race([Promise.allSettled(anims.map((a) => a.finished)), new Promise((r) => setTimeout(r, 1200))]).then(done);
}

// One item in a Switcher. While closing it keeps its last content on screen, marked data-closing,
// so CSS can play the exit; it is removed once that exit has finished.
function Fx({ k, closing, onDone, children }: { k: string; closing: boolean; onDone: (k: string) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!closing) return;
    let off = false;
    const raf = requestAnimationFrame(() => afterAnimations(ref.current, () => { if (!off) onDone(k); }));
    return () => { off = true; cancelAnimationFrame(raf); };
  }, [closing, k, onDone]);
  return (
    <div className="fx" data-closing={closing ? '' : undefined} inert={closing || undefined} ref={ref}>
      {children}
    </div>
  );
}

// Shows the content for key k. When k changes, the old content plays its exit while the new one enters
// (a crossfade); k = null closes. Re-opening something that is still closing reverses it smoothly,
// because it is the same element. Entry styles come from CSS @starting-style, exit styles from [data-closing].
export function Switcher({ k, children }: { k: string | null; children?: React.ReactNode }) {
  type Entry = { k: string; closing: boolean; node?: React.ReactNode };
  const live = useRef<React.ReactNode>(children);
  const [cur, setCur] = useState<string | null>(k);
  const [list, setList] = useState<Entry[]>(k ? [{ k, closing: false }] : []);
  if (cur !== k) {
    const prev = cur, snapshot = live.current;
    setCur(k);
    setList((l) => {
      let n = l.map((e) => (e.k === prev && !e.closing ? { k: e.k, closing: true, node: snapshot } : e));
      if (k) {
        const i = n.findIndex((e) => e.k === k);
        if (i >= 0) n[i] = { k, closing: false };
        else n = [...n, { k, closing: false }];
      }
      return n;
    });
  }
  useLayoutEffect(() => { live.current = children; });
  const done = useCallback((key: string) => setList((l) => l.filter((e) => !(e.k === key && e.closing))), []);
  return (
    <>
      {list.map((e) => (
        <Fx key={e.k} k={e.k} closing={e.closing} onDone={done}>
          {e.closing ? e.node : e.k === k ? children : null}
        </Fx>
      ))}
    </>
  );
}

// Crossfade the 3D view through a change of look (day/night, walls, finishes): freeze the current picture on
// top, apply the change, and once the new picture has been drawn, dissolve the frozen one away.
export function crossfade(change: () => void, ms = 650) {
  const canvas = document.querySelector('.stage canvas') as HTMLCanvasElement | null;
  if (!canvas || reducedMotion() || !canvas.width) { change(); return; }
  const snap = document.createElement('canvas');
  snap.width = canvas.width;
  snap.height = canvas.height;
  snap.className = 'stage-snap';
  snap.style.setProperty('--dur', ms + 'ms');
  try { snap.getContext('2d')!.drawImage(canvas, 0, 0); } catch (e) { change(); return; }
  canvas.after(snap);
  change();
  // two frames: one for React to apply the change, one for the scene to draw it
  requestAnimationFrame(() => requestAnimationFrame(() => {
    snap.classList.add('out');
    afterAnimations(snap, () => snap.remove());
    setTimeout(() => snap.remove(), ms + 800);
  }));
}
