import { Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useStore } from '../store';
import { roomById } from '../data/plan';
import { Icon } from './icons';
import { TOUR_URL } from '../config';

function Sphere({ url }: { url: string }) {
  const tex = useLoader(THREE.TextureLoader, url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 40]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}
function Fov() {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    const el = document.querySelector('.pano-view');
    const onWheel = (e: Event) => { const w = e as WheelEvent; w.preventDefault(); cam.fov = Math.min(95, Math.max(35, cam.fov + w.deltaY * 0.04)); cam.updateProjectionMatrix(); };
    el?.addEventListener('wheel', onWheel, { passive: false });
    return () => el?.removeEventListener('wheel', onWheel);
  }, [cam]);
  return null;
}

export function PanoModal() {
  const pano = useStore((s) => s.pano);
  const finish = useStore((s) => s.finish);
  const set = useStore((s) => s.set);
  const [f, setF] = useState(finish);
  useEffect(() => { setF(finish); }, [finish, pano]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') set({ pano: null }); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [set]);
  if (!pano) return null;
  const r = roomById(pano.room);
  if (!r) return null;
  const cam = r.cams.find((c) => c.n === pano.cam) || r.cams[0];
  const hasBare = cam.n !== 1;
  const url = `pano/c${cam.n}-${f === 'bare' && hasBare ? 'b' : 'd'}.jpg`;
  const tour = TOUR_URL ? `${TOUR_URL}#media-name=${encodeURIComponent(cam.name + (f === 'bare' ? ' unfurnished' : ' furnished'))}` : '';
  return (
    <div className="pano-back" onClick={() => set({ pano: null })}>
      <div className="pano glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={r.name + ' 360 view'}>
        <div className="pano-head">
          <div>
            <h2>{r.name}</h2>
            <p className="muted">360° preview from the virtual tour. Drag to look around.</p>
          </div>
          <button className="icon-btn" onClick={() => set({ pano: null })} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="pano-view">
          <Canvas camera={{ fov: 75, position: [0, 0, 0.1] }} flat>
            <Suspense fallback={null}><Sphere url={url} /></Suspense>
            <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={-0.35} target={[0, 0, 0]} />
            <Fov />
          </Canvas>
        </div>
        <div className="pano-foot">
          <div className="cams">
            {r.cams.map((c) => (
              <button key={c.n} className={c.n === cam.n ? 'on' : ''} onClick={() => set({ pano: { room: r.id, cam: c.n } })}>{c.name}</button>
            ))}
          </div>
          <div className="pano-actions">
            {hasBare && (
              <div className="seg small">
                <button className={f === 'bare' ? 'on' : ''} onClick={() => setF('bare')}>Bare</button>
                <button className={f === 'dressed' ? 'on' : ''} onClick={() => setF('dressed')}>Dressed</button>
              </div>
            )}
            {tour && <a className="btn" href={tour} target="_blank" rel="noreferrer"><Icon name="pano" size={16} />Open in the tour</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
