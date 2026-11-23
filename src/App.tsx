import { useEffect } from 'react';
import { Stage, VillaContent } from './three/Scene';
import { UI } from './ui/UI';
import { useStore } from './store';
import { roomById } from './data/plan';

// the address opens a room directly: #room=living
function openFromHash() {
  const m = /#room=([\w-]+)/.exec(location.hash);
  if (m && roomById(m[1])) setTimeout(() => useStore.getState().selectRoom(m[1]), 900);
}

export function App() {
  const time = useStore((s) => s.time);
  const inside = useStore((s) => s.inside);
  const navHidden = useStore((s) => s.navHidden);
  useEffect(() => { openFromHash(); }, []);
  return (
    <div className={'app ' + time + (inside ? ' inside' : '') + (navHidden ? ' nav-hidden' : '')}>
      <div className="stage"><Stage><VillaContent /></Stage></div>
      <UI />
    </div>
  );
}
