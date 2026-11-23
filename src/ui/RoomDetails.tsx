import { Room } from '../data/plan';
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
