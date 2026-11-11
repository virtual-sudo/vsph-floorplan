import { useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { useStore } from '../store';
import { rooms, roomById, ZONES, RESIDENCE, Room, floorZones } from '../data/plan';
import { ITEMS, itemById, groupKey } from '../data/furniture';
import { MATERIALS, MAT, SLOT_KINDS, swatchCss } from '../data/materials';
import { getBuilt, matFor } from '../three/Furniture';
import { PRESETS, presetOverrides } from './presets';
import { Icon } from './icons';
import { PanoModal } from './Pano';
import { TOUR_URL } from '../config';
import { captureApi } from '../three/Capture';

// ---------------- left rail ----------------
function Rail() {
  const panel = useStore((s) => s.panel);
  const set = useStore((s) => s.set);
  const requestView = useStore((s) => s.requestView);
  const btn = (id: 'rooms' | 'finishes' | 'views', icon: string, label: string) => (
    <button className={'rail-btn' + (panel === id ? ' on' : '')} onClick={() => set({ panel: panel === id ? null : id })} aria-label={label}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="rail glass">
      <div className="brand" title="Ayala Land Premier">
        <svg viewBox="0 0 32 32" width="30" height="30"><rect width="32" height="32" rx="9" fill="#1f2a24" /><path d="M8 22V12l8-5 8 5v10" fill="none" stroke="#d8c7a3" strokeWidth="2" /><path d="M13 22v-5h6v5" fill="none" stroke="#d8c7a3" strokeWidth="2" /></svg>
      </div>
      <button className="rail-btn" onClick={() => { useStore.getState().selectRoom(null); useStore.getState().selectItem(null); requestView('home'); }} aria-label="Overview">
        <Icon name="home" size={20} /><span>Overview</span>
      </button>
      {btn('rooms', 'rooms', 'Rooms')}
      {btn('finishes', 'palette', 'Styling')}
      {btn('views', 'camera', 'Views')}
      <div className="rail-fill" />
      <button className={'rail-btn' + (useStore.getState().help ? ' on' : '')} onClick={() => set({ help: !useStore.getState().help })} aria-label="Help">
        <Icon name="help" size={20} /><span>Help</span>
      </button>
    </nav>
  );
}

// inside an embedded preview the browser blocks downloads, so the picture button is only offered on the full site
export const canDownload = (() => { try { return window.self === window.top; } catch (e) { return false; } })();

export async function saveShot() {
  const st = useStore.getState();
  if (!captureApi.run) return;
  st.set({ hoverItem: null, hoverRoom: null, toast: 'Rendering a high-resolution picture…' });
  const r = await captureApi.run(3840);
  if (!r) { st.set({ toast: 'The picture could not be saved. Try again.' }); return; }
  const a = document.createElement('a');
  a.download = 'park-villas-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.png';
  a.href = URL.createObjectURL(r.blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  st.set({ toast: `Saved a ${r.width} × ${r.height} PNG` });
}

// ---------------- top bar ----------------
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string; icon?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)} title={o.label}>
          {o.icon && <Icon name={o.icon} size={16} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
function TopBar() {
  const s = useStore();
  return (
    <header className="topbar">
      <div className="title">
        <h1>Park Villas</h1>
        <p>3D Residence Plan</p>
      </div>
      <div className="controls">
        <Seg label="Finish" value={s.finish} onChange={(v) => s.set({ finish: v })} options={[{ v: 'bare', label: 'Bare' }, { v: 'dressed', label: 'Dressed' }]} />
        <Seg label="Light" value={s.time} onChange={(v) => s.set({ time: v })} options={[{ v: 'day', label: 'Day', icon: 'sun' }, { v: 'night', label: 'Night', icon: 'moon' }]} />
        <Seg label="Walls" value={s.walls} onChange={(v) => s.set({ walls: v })} options={[{ v: 'full', label: 'Full', icon: 'walls' }, { v: 'cutaway', label: 'Cut', icon: 'cut' }]} />
        <div className="icon-row">
          {canDownload && <button className="icon-btn glass" title="Save a picture of this view" onClick={saveShot}><Icon name="camera" /></button>}
          <button className="icon-btn glass" title="Top view" onClick={() => s.requestView('top')}><Icon name="top" /></button>
          <button className="icon-btn glass" title="Reset view" onClick={() => { s.selectItem(null); s.selectRoom(null); }}><Icon name="reset" /></button>
        </div>
      </div>
    </header>
  );
}

// ---------------- rooms list ----------------
function RoomsCard() {
  const roomId = useStore((s) => s.roomId);
  const hover = useStore((s) => s.hoverRoom);
  const selectRoom = useStore((s) => s.selectRoom);
  const set = useStore((s) => s.set);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const order: Room['zone'][] = ['arrival', 'living', 'private', 'outdoor', 'service', 'circulation'];
    const f = q.trim().toLowerCase();
    return order.map((z) => ({ z, list: rooms.filter((r) => r.zone === z && (!f || r.name.toLowerCase().includes(f))) })).filter((g) => g.list.length);
  }, [q]);
  return (
    <section className="card glass left-card rooms-card">
      <div className="card-head">
        <div>
          <h2>Rooms</h2>
          <p className="muted">{rooms.length} spaces, {rooms.filter((r) => r.zone !== 'outdoor').reduce((a, r) => a + r.area, 0).toFixed(0)} m² inside</p>
        </div>
        <button className="icon-btn" onClick={() => set({ panel: null })} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
      <input className="search" placeholder="Find a room" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="scroll">
        {groups.map((g) => (
          <div key={g.z} className="zone">
            <div className="zone-name">{ZONES[g.z]}</div>
            {g.list.map((r) => (
              <button key={r.id} className={'room-row' + (r.id === roomId ? ' on' : '') + (r.id === hover ? ' hot' : '')}
                onClick={() => { selectRoom(r.id); if (window.innerWidth < 760) set({ panel: null }); }}
                onMouseEnter={() => set({ hoverRoom: r.id })} onMouseLeave={() => set({ hoverRoom: null })}>
                <span className="thumb" style={r.thumb ? { backgroundImage: `url(${r.thumb})` } : undefined}>{!r.thumb && <Icon name={r.icon} size={18} />}</span>
                <span className="rr-text">
                  <b>{r.name}</b>
                  <small>{r.area.toFixed(1)} m² <i>/</i> {r.cams.length ? r.cams.length + ' views' : 'plan only'}</small>
                </span>
                <Icon name="chevR" size={16} />
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- styling ----------------
function FinishesCard() {
  const s = useStore();
  const walls = MATERIALS.filter((m) => m.kind === 'paint');
  return (
    <section className="card glass left-card">
      <div className="card-head">
        <div><h2>Styling</h2><p className="muted">Restyle the whole home at once</p></div>
        <button className="icon-btn" onClick={() => s.set({ panel: null })} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
      <div className="scroll">
        <div className="sub">Palettes</div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.id} className="preset" onClick={() => { s.set({ overrides: presetOverrides(p), wallPaint: p.walls, floorMats: p.floors || {}, finish: 'dressed' }); }}>
              <span className="chips">{p.colors.map((c) => <i key={c} style={{ background: c }} />)}</span>
              <b>{p.name}</b>
              <small>{p.note}</small>
            </button>
          ))}
        </div>
        <div className="sub">Wall paint</div>
        <div className="swatches">
          {walls.map((m) => (
            <button key={m.id} className={'sw' + (s.wallPaint === m.id ? ' on' : '')} style={{ background: swatchCss(m) }} title={m.name} onClick={() => s.set({ wallPaint: m.id })}><span>{m.name}</span></button>
          ))}
        </div>
        <div className="sub">Floors</div>
        {floorZones.filter((z) => z.id !== 'lift').map((z) => {
          const cur = s.floorMats[z.id] || z.mat;
          return (
            <div key={z.id} className="floor-row">
              <div className="fr-head"><b>{z.name}</b><small>{MAT[cur]?.name}</small></div>
              <div className="swatches small">
                {MATERIALS.filter((m) => m.kind === 'floor' && m.id !== 'floor-dark').map((m) => (
                  <button key={m.id} className={'sw' + (m.id === cur ? ' on' : '')} style={{ background: swatchCss(m) }} title={m.name} onClick={() => s.set({ floorMats: { ...s.floorMats, [z.id]: m.id } })}><span>{m.name}</span></button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="sub">Show</div>
        <label className="toggle"><input type="checkbox" checked={s.showPins} onChange={(e) => s.set({ showPins: e.target.checked })} /><span />Room labels</label>
        <label className="toggle"><input type="checkbox" checked={s.showPlan} onChange={(e) => s.set({ showPlan: e.target.checked })} /><span />Rendered plan on the floor</label>
        <label className="toggle"><input type="checkbox" checked={s.quality === 'high'} onChange={(e) => s.set({ quality: e.target.checked ? 'high' : 'balanced' })} /><span />High quality (soft shadows and ambient occlusion)</label>
        <p className="tip">Click any piece of furniture to change its own materials.</p>
      </div>
    </section>
  );
}

// ---------------- camera views ----------------
function ViewsCard() {
  const s = useStore();
  const go = (kind: 'home' | 'top' | 'room', id?: string) => { if (kind === 'room' && id) s.selectRoom(id); else { s.selectRoom(null, false); s.requestView(kind); } };
  const list: { label: string; icon: string; act: () => void }[] = [
    { label: 'Overview', icon: 'home', act: () => go('home') },
    { label: 'Plan from above', icon: 'plan', act: () => go('top') },
    { label: 'Grand Living', icon: 'sofa', act: () => go('room', 'living') },
    { label: 'Show Kitchen and Dining', icon: 'dining', act: () => go('room', 'dining') },
    { label: 'Salon', icon: 'lounge', act: () => go('room', 'salon') },
    { label: 'Primary Bedroom', icon: 'bed', act: () => go('room', 'primary') },
    { label: 'Bedroom 2', icon: 'bed', act: () => go('room', 'bed2') },
    { label: 'Living Terrace', icon: 'leaf', act: () => go('room', 'living-terrace') }
  ];
  return (
    <section className="card glass left-card">
      <div className="card-head">
        <div><h2>Views</h2><p className="muted">Jump to a framed view</p></div>
        <button className="icon-btn" onClick={() => s.set({ panel: null })} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
      <div className="scroll">
        {list.map((v) => (
          <button key={v.label} className="view-row" onClick={v.act}><span className="vi"><Icon name={v.icon} size={18} /></span>{v.label}<Icon name="chevR" size={16} /></button>
        ))}
      </div>
    </section>
  );
}

// ---------------- right column ----------------
function Summary() {
  const [open, setOpen] = useState(true);
  const inside = rooms.filter((r) => r.zone !== 'outdoor').reduce((a, r) => a + r.area, 0);
  const out = rooms.filter((r) => r.zone === 'outdoor').reduce((a, r) => a + r.area, 0);
  return (
    <section className="card glass summary">
      <button className="card-head as-btn" onClick={() => setOpen(!open)}>
        <div><h2>The Residence</h2><p className="muted">{RESIDENCE.developer}</p></div>
        <span className={'chev' + (open ? ' up' : '')}><Icon name="chevD" size={16} /></span>
      </button>
      {open && (
        <>
          <div className="stats">
            <div><b>{inside.toFixed(0)}</b><small>m² interior</small></div>
            <div><b>{out.toFixed(0)}</b><small>m² terraces</small></div>
            <div><b>{RESIDENCE.bedrooms}</b><small>bedrooms</small></div>
            <div><b>{RESIDENCE.baths}+{RESIDENCE.powder}</b><small>baths</small></div>
          </div>
          <p className="fine">Areas measured from the plan drawing. Ayala Land Premier publishes 610 m² for each villa; figures are indicative.</p>
        </>
      )}
    </section>
  );
}

function RoomCard({ r }: { r: Room }) {
  const s = useStore();
  const pieces = ITEMS.filter((i) => i.room === r.id && i.pick !== false && (s.finish === 'dressed' || i.finish === 'both'));
  const uniq = Array.from(new Map(pieces.map((p) => [groupKey(p), p])).values());
  return (
    <section className="card glass room-card">
      <div className="hero" style={r.thumb ? { backgroundImage: `url(${r.thumb})` } : undefined}>
        {!r.thumb && <div className="hero-empty"><Icon name={r.icon} size={30} /></div>}
        <button className="icon-btn close" onClick={() => s.selectRoom(null)} aria-label="Close room"><Icon name="x" size={16} /></button>
        {r.cams.length > 0 && <button className="hero-btn" onClick={() => s.set({ pano: { room: r.id, cam: r.cams[0].n } })}><Icon name="pano" size={16} />360° view</button>}
      </div>
      <div className="room-body">
        <div className="chip">{ZONES[r.zone]}</div>
        <h2>{r.name}</h2>
        <p className="desc">{r.info}</p>
        <div className="facts">
          <div><Icon name="area" size={16} /><span><b>{r.area.toFixed(1)} m²</b><small>Floor area</small></span></div>
          <div><Icon name="ruler" size={16} /><span><b>{r.dims[0].toFixed(1)} × {r.dims[1].toFixed(1)} m</b><small>Overall</small></span></div>
          <div><Icon name="height" size={16} /><span><b>{r.ceiling.toFixed(1)} m</b><small>Ceiling</small></span></div>
          <div><Icon name="floor" size={16} /><span><b>{r.floor}</b><small>Floor</small></span></div>
        </div>
        <ul className="feat">{r.features.map((f) => <li key={f}>{f}</li>)}</ul>
        {uniq.length > 0 && (
          <>
            <div className="sub">In this room</div>
            <div className="pieces">
              {uniq.map((p) => (
                <button key={p.id} className="piece" onClick={() => { s.selectItem(p.id); }} onMouseEnter={() => s.set({ hoverItem: p.id })} onMouseLeave={() => s.set({ hoverItem: null })}>{p.name}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function MaterialCard() {
  const s = useStore();
  const it = itemById(s.itemId);
  const b = it ? getBuilt(it.id) : null;
  const [slot, setSlot] = useState<string | null>(null);
  useEffect(() => { setSlot(null); }, [s.itemId]);
  if (!it || !b) return null;
  const slots = Object.entries(b.built.slots);
  const cur = slot && b.built.slots[slot] ? slot : slots[0] ? slots[0][0] : null;
  const key = groupKey(it);
  const count = ITEMS.filter((i) => groupKey(i) === key).length;
  const room = roomById(it.room);
  const def = cur ? b.built.slots[cur] : null;
  const options = def ? MATERIALS.filter((m) => (SLOT_KINDS[def.kind] || [def.kind]).includes(m.kind)) : [];
  const active = cur ? matFor(it, b.built, cur, s.overrides) : '';
  return (
    <section className="card glass mat-card">
      <div className="card-head">
        <div>
          <div className="chip">{room ? room.name : 'Residence'}</div>
          <h2>{it.name}</h2>
          <p className="muted">{it.desc || (count > 1 ? `Changes apply to all ${count}` : 'Choose a finish for each part')}</p>
        </div>
        <button className="icon-btn" onClick={() => s.selectItem(null)} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
      <div className="slot-tabs">
        {slots.map(([k, d]) => (
          <button key={k} className={k === cur ? 'on' : ''} onClick={() => setSlot(k)}>
            <i style={{ background: swatchCss(MAT[matFor(it, b.built, k, s.overrides)] || MAT['boucle-ivory']) }} />
            {d.label}
          </button>
        ))}
      </div>
      {cur && (
        <>
          <div className="cur-mat"><span>{def!.label}</span><b>{MAT[active]?.name}</b></div>
          <div className="swatches">
            {options.map((m) => (
              <button key={m.id} className={'sw' + (m.id === active ? ' on' : '')} style={{ background: swatchCss(m) }} title={m.name} onClick={() => s.setMaterial(key, cur, m.id)}>
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="card-actions">
        <button className="btn ghost" onClick={() => s.requestView('item', it.id)}><Icon name="focus" size={16} />Focus</button>
        <button className="btn ghost" onClick={() => s.resetMaterials(key)}><Icon name="reset" size={16} />Reset</button>
      </div>
    </section>
  );
}

function RightColumn() {
  const roomId = useStore((s) => s.roomId);
  const itemId = useStore((s) => s.itemId);
  const r = roomById(roomId);
  return (
    <aside className="right-col">
      {!itemId && !r && <Summary />}
      {itemId ? <MaterialCard /> : r ? <RoomCard r={r} /> : null}
    </aside>
  );
}

function Hint() {
  const help = useStore((s) => s.help);
  const set = useStore((s) => s.set);
  const [first, setFirst] = useState(true);
  useEffect(() => { const t = setTimeout(() => setFirst(false), 9000); return () => clearTimeout(t); }, []);
  if (help) {
    return (
      <div className="help-pop glass" role="dialog" aria-label="How to use">
        <div className="card-head"><h2>Getting around</h2><button className="icon-btn" onClick={() => set({ help: false })}><Icon name="x" size={16} /></button></div>
        <ul>
          <li><b>Turn</b> drag with the left mouse button or one finger</li>
          <li><b>Move</b> drag with the right mouse button or two fingers</li>
          <li><b>Zoom</b> scroll, or pinch</li>
          <li><b>Rooms</b> click a label or the floor of a room to fly there</li>
          <li><b>Materials</b> click a sofa, table, bed or chair to change its finish</li>
          <li><b>Bare or Dressed</b> switches between the empty and the furnished home</li>
        </ul>
      </div>
    );
  }
  return (
    <div className={'hint glass' + (first ? '' : ' quiet')}>
      <span><Icon name="info" size={15} /> Drag to turn, scroll to zoom. Click a room or a piece of furniture.</span>
    </div>
  );
}

export function Loader({ what = 'the residence' }: { what?: string }) {
  const { progress, active } = useProgress();
  const ready = useStore((s) => s.ready);
  const [gone, setGone] = useState(false);
  const done = !active && progress >= 100 && ready;
  useEffect(() => { if (done) { const t = setTimeout(() => setGone(true), 600); return () => clearTimeout(t); } }, [done]);
  if (gone) return null;
  return (
    <div className={'loader' + (done ? ' out' : '')}>
      <div className="loader-in">
        <div className="brand-big">Park Villas</div>
        <div className="bar"><i style={{ width: progress.toFixed(0) + '%' }} /></div>
        <small>Preparing {what} {progress.toFixed(0)}%</small>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const set = useStore((s) => s.set);
  useEffect(() => {
    if (!toast || toast.endsWith('…')) return;
    const t = setTimeout(() => set({ toast: null }), 3200);
    return () => clearTimeout(t);
  }, [toast, set]);
  return toast ? <div className="toast glass" role="status">{toast}</div> : null;
}

function HoverLabel() {
  const hoverItem = useStore((s) => s.hoverItem);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mv = (e: PointerEvent) => { if (ref.current) ref.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`; };
    window.addEventListener('pointermove', mv);
    return () => window.removeEventListener('pointermove', mv);
  }, []);
  const it = itemById(hoverItem);
  return <div ref={ref} className={'hover-label' + (it ? ' on' : '')}>{it ? it.name : ''}{it && <small>Click to change materials</small>}</div>;
}

function Keys() {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useStore.getState();
      if (s.pano) return;
      if (s.itemId) s.selectItem(null);
      else if (s.roomId) s.selectRoom(null);
      else if (s.panel) s.set({ panel: null });
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return null;
}

export function UI() {
  const panel = useStore((s) => s.panel);
  return (
    <>
      <Rail />
      <TopBar />
      {panel === 'rooms' && <RoomsCard />}
      {panel === 'finishes' && <FinishesCard />}
      {panel === 'views' && <ViewsCard />}
      <RightColumn />
      <Hint />
      <HoverLabel />
      <Toast />
      <Keys />
      <PanoModal />
      <Loader />
      {TOUR_URL ? null : null}
    </>
  );
}
