import { useStore } from '../store';
import { Room } from '../data/plan';
import { ITEMS, groupKey } from '../data/furniture';
import { Icon } from './icons';

// Floor area, size, ceiling, floor finish and the feature list of a room
export function RoomFacts({ r }: { r: Room }) {
  return (
    <>
      <div className="facts">
        <div><Icon name="area" size={16} /><span><b>{r.area.toFixed(1)} m²</b><small>Floor area</small></span></div>
        <div><Icon name="ruler" size={16} /><span><b>{r.dims[0].toFixed(1)} × {r.dims[1].toFixed(1)} m</b><small>Overall</small></span></div>
        <div><Icon name="height" size={16} /><span><b>{r.ceiling.toFixed(1)} m</b><small>Ceiling</small></span></div>
        <div><Icon name="floor" size={16} /><span><b>{r.floor}</b><small>Floor</small></span></div>
      </div>
      <ul className="feat">{r.features.map((f) => <li key={f}>{f}</li>)}</ul>
    </>
  );
}

// The furniture in a room that can be restyled; one button per set (all dining chairs count once)
export function RoomPieces({ r, onPick, hover = true }: { r: Room; onPick: (id: string) => void; hover?: boolean }) {
  const finish = useStore((s) => s.finish);
  const set = useStore((s) => s.set);
  const pieces = ITEMS.filter((i) => i.room === r.id && i.pick !== false && (finish === 'dressed' || i.finish === 'both'));
  const uniq = Array.from(new Map(pieces.map((p) => [groupKey(p), p])).values());
  if (!uniq.length) return null;
  return (
    <>
      <div className="sub">In this room</div>
      <div className="pieces">
        {uniq.map((p) => (
          <button key={p.id} className="piece" onClick={() => onPick(p.id)}
            onMouseEnter={hover ? () => set({ hoverItem: p.id }) : undefined} onMouseLeave={hover ? () => set({ hoverItem: null }) : undefined}>
            {p.name}
          </button>
        ))}
      </div>
    </>
  );
}
