import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { useStore } from '../store';
import { rooms, roomById, ZONES, RESIDENCE, Room, floorZones } from '../data/plan';
import { ITEMS, itemById, groupKey } from '../data/furniture';
import { MATERIALS, MAT, SLOT_KINDS, swatchCss } from '../data/materials';
import { getBuilt, matFor } from '../three/Furniture';
import { PRESETS, presetOverrides } from './presets';
import { Icon } from './icons';
import { Seg } from './Seg';
import { RoomFacts, RoomPieces } from './RoomDetails';
import { PanoView } from './Pano';
import { Switcher, crossfade } from './motion';
import { captureApi } from '../three/Capture';

// ---------------- left rail ----------------
function Rail() {
  const panel = useStore((s) => s.panel);
  const help = useStore((s) => s.help);
  const openPanel = useStore((s) => s.openPanel);
  const toggleHelp = useStore((s) => s.toggleHelp);
  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const active = help ? 'help' : panel;
  // the highlight glides between the rail buttons
  useLayoutEffect(() => {
    const n = nav.current, p = pill.current;
    if (!n || !p) return;
    const place = () => {
      const on = active ? n.querySelector<HTMLElement>(`[data-id="${active}"]`) : null;
      p.toggleAttribute('data-on', !!on);
      if (!on) return;
      p.style.setProperty('--x', on.offsetLeft + 'px');
      p.style.setProperty('--y', on.offsetTop + 'px');
      p.style.setProperty('--w', on.offsetWidth + 'px');
      p.style.setProperty('--h', on.offsetHeight + 'px');
    };
    place();
    requestAnimationFrame(() => p.setAttribute('data-ready', ''));
    const ro = new ResizeObserver(place);
    ro.observe(n);
    return () => ro.disconnect();
  }, [active]);
  const btn = (id: 'rooms' | 'finishes' | 'views', icon: string, label: string) => (
    <button data-id={id} className={'rail-btn' + (panel === id && !help ? ' on' : '')} onClick={() => openPanel(id)} aria-label={label} aria-pressed={panel === id}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </button>
  );
  const overview = () => {
    const s = useStore.getState();
    s.set({ panel: null, help: false });
    s.selectRoom(null);
  };
  return (
    <nav className="rail glass" ref={nav}>
      <span className="rail-pill" ref={pill} aria-hidden="true" />
      <div className="brand" title="Ayala Land Premier">
        <svg viewBox="0 0 32 32" width="30" height="30"><rect width="32" height="32" rx="9" fill="#1f2a24" /><path d="M8 22V12l8-5 8 5v10" fill="none" stroke="#d8c7a3" strokeWidth="2" /><path d="M13 22v-5h6v5" fill="none" stroke="#d8c7a3" strokeWidth="2" /></svg>
      </div>
      <button className="rail-btn" onClick={overview} aria-label="Overview">
        <Icon name="home" size={20} /><span>Overview</span>
      </button>
      {btn('rooms', 'rooms', 'Rooms')}
      {btn('finishes', 'palette', 'Styling')}
      {btn('views', 'camera', 'Views')}
      <div className="rail-fill" />
      <button data-id="help" className={'rail-btn' + (help ? ' on' : '')} onClick={toggleHelp} aria-label="Help" aria-pressed={help}>
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
function TopBar() {
  const finish = useStore((s) => s.finish);
  const time = useStore((s) => s.time);
  const walls = useStore((s) => s.walls);
  const set = useStore((s) => s.set);
  const requestView = useStore((s) => s.requestView);
  return (
    <header className="topbar">
      <div className="title">
        <h1>Park Villas</h1>
        <p>3D Residence Plan</p>
      </div>
      <div className="controls">
        <Seg label="Finish" value={finish} onChange={(v) => set({ finish: v })} options={[{ v: 'bare', label: 'Bare' }, { v: 'dressed', label: 'Dressed' }]} />
        <Seg label="Light" value={time} onChange={(v) => crossfade(() => set({ time: v }), 800)} options={[{ v: 'day', label: 'Day', icon: 'sun' }, { v: 'night', label: 'Night', icon: 'moon' }]} />
        <Seg label="Walls" value={walls} onChange={(v) => crossfade(() => set({ walls: v }))} options={[{ v: 'full', label: 'Full', icon: 'walls' }, { v: 'cutaway', label: 'Cut', icon: 'cut' }]} />
        <div className="icon-row">
          {canDownload && <button className="icon-btn glass" data-tip="Save a picture" aria-label="Save a picture of this view" onClick={saveShot}><Icon name="camera" /></button>}
          <button className="icon-btn glass not-phone" data-tip="Plan from above" aria-label="View the plan from above" onClick={() => requestView('top')}><Icon name="top" /></button>
          <button className="icon-btn glass not-phone" data-tip="Reset view" aria-label="Reset the view" onClick={() => { const s = useStore.getState(); s.selectItem(null); s.selectRoom(null); }}><Icon name="reset" /></button>
        </div>
      </div>
    </header>
  );
}

// ---------------- rooms list ----------------
function RoomsCard() {
  const roomId = useStore((s) => s.roomId);
  const hover = useStore((s) => s.hoverRoom);
  const openRoom = useStore((s) => s.openRoom);
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
                onClick={() => openRoom(r.id)}
                onMouseEnter={() => set({ hoverRoom: r.id })} onMouseLeave={() => set({ hoverRoom: null })}>
                <span className="thumb" style={r.thumb ? { backgroundImage: `url(${r.thumb})` } : undefined}>
                  {!r.thumb && <Icon name={r.icon} size={18} />}
                  {r.cams.length > 0 && <em className="badge-360">360°</em>}
                </span>
                <span className="rr-text">
                  <b>{r.name}</b>
                  <small>{r.area.toFixed(1)} m² <i>/</i> {r.cams.length ? (r.cams.length === 1 ? '1 view' : r.cams.length + ' views') : 'plan only'}</small>
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
  const set = useStore((s) => s.set);
  const wallPaint = useStore((s) => s.wallPaint);
  const floorMats = useStore((s) => s.floorMats);
  const showPins = useStore((s) => s.showPins);
  const showPlan = useStore((s) => s.showPlan);
  const quality = useStore((s) => s.quality);
  const walls = MATERIALS.filter((m) => m.kind === 'paint');
  return (
    <section className="card glass left-card">
      <div className="card-head">
        <div><h2>Styling</h2><p className="muted">Restyle the whole home at once</p></div>
        <button className="icon-btn" onClick={() => set({ panel: null })} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
      <div className="scroll">
        <div className="sub">Palettes</div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.id} className="preset" onClick={() => crossfade(() => set({ overrides: presetOverrides(p), wallPaint: p.walls, floorMats: p.floors || {}, finish: 'dressed' }), 700)}>
              <span className="chips">{p.colors.map((c) => <i key={c} style={{ background: c }} />)}</span>
              <b>{p.name}</b>
              <small>{p.note}</small>
            </button>
          ))}
        </div>
        <div className="sub">Wall paint</div>
        <div className="swatches">
          {walls.map((m) => (
            <button key={m.id} className={'sw' + (wallPaint === m.id ? ' on' : '')} style={{ background: swatchCss(m) }} title={m.name} onClick={() => crossfade(() => set({ wallPaint: m.id }), 450)}><span>{m.name}</span></button>
          ))}
        </div>
        <div className="sub">Floors</div>
        {floorZones.filter((z) => z.id !== 'lift').map((z) => {
          const cur = floorMats[z.id] || z.mat;
          return (
            <div key={z.id} className="floor-row">
              <div className="fr-head"><b>{z.name}</b><small>{MAT[cur]?.name}</small></div>
              <div className="swatches small">
                {MATERIALS.filter((m) => m.kind === 'floor' && m.id !== 'floor-dark').map((m) => (
                  <button key={m.id} className={'sw' + (m.id === cur ? ' on' : '')} style={{ background: swatchCss(m) }} title={m.name} onClick={() => crossfade(() => set({ floorMats: { ...useStore.getState().floorMats, [z.id]: m.id } }), 450)}><span>{m.name}</span></button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="sub">Show</div>
        <label className="toggle"><input type="checkbox" checked={showPins} onChange={(e) => set({ showPins: e.target.checked })} /><span />Room labels</label>
        <label className="toggle"><input type="checkbox" checked={showPlan} onChange={(e) => { const v = e.target.checked; crossfade(() => set({ showPlan: v })); }} /><span />Rendered plan on the floor</label>
        <label className="toggle"><input type="checkbox" checked={quality === 'high'} onChange={(e) => { const v = e.target.checked; crossfade(() => set({ quality: v ? 'high' : 'balanced' })); }} /><span />High quality (soft shadows and ambient occlusion)</label>
        <p className="tip">Click any piece of furniture to change its own materials.</p>
      </div>
    </section>
  );
}

// ---------------- camera views ----------------
function ViewsCard() {
  const set = useStore((s) => s.set);
  const go = (kind: 'home' | 'top' | 'room', id?: string) => {
    const s = useStore.getState();
    if (kind === 'room' && id) s.selectRoom(id);
    else { s.selectRoom(null, false); s.requestView(kind); }
  };
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
        <button className="icon-btn" onClick={() => set({ panel: null })} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
      <div className="scroll">
        {list.map((v) => (
          <button key={v.label} className="view-row" onClick={v.act}><span className="vi"><Icon name={v.icon} size={18} /></span>{v.label}<Icon name="chevR" size={16} /></button>
        ))}
      </div>
    </section>
  );
}

function LeftPanel() {
  const panel = useStore((s) => s.panel);
  const pano = useStore((s) => s.pano);
  const k = pano ? null : panel;
  return (
    <Switcher k={k}>
      {k === 'rooms' ? <RoomsCard /> : k === 'finishes' ? <FinishesCard /> : k === 'views' ? <ViewsCard /> : null}
    </Switcher>
  );
}

// ---------------- right column ----------------
function Summary() {
  const [open, setOpen] = useState(true);
  const inside = rooms.filter((r) => r.zone !== 'outdoor').reduce((a, r) => a + r.area, 0);
  const out = rooms.filter((r) => r.zone === 'outdoor').reduce((a, r) => a + r.area, 0);
  return (
    <section className="card glass summary">
      <button className="card-head as-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div><h2>The Residence</h2><p className="muted">{RESIDENCE.developer}</p></div>
        <span className={'chev' + (open ? ' up' : '')}><Icon name="chevD" size={16} /></span>
      </button>
      <div className={'fold' + (open ? ' open' : '')}>
        <div className="fold-in">
          <div className="stats">
            <div><b>{inside.toFixed(0)}</b><small>m² interior</small></div>
            <div><b>{out.toFixed(0)}</b><small>m² terraces</small></div>
            <div><b>{RESIDENCE.bedrooms}</b><small>bedrooms</small></div>
            <div><b>{RESIDENCE.baths}+{RESIDENCE.powder}</b><small>baths</small></div>
          </div>
          <p className="fine">Areas measured from the plan drawing. Ayala Land Premier publishes 610 m² for each villa; figures are indicative.</p>
        </div>
      </div>
    </section>
  );
}

function RoomCard({ r }: { r: Room }) {
  const set = useStore((s) => s.set);
  const selectRoom = useStore((s) => s.selectRoom);
  const selectItem = useStore((s) => s.selectItem);
  return (
    <section className="card glass room-card">
      <div className={'hero' + (r.cams.length ? ' can-enter' : '')} onClick={r.cams.length ? () => set({ pano: { room: r.id, cam: r.cams[0].n } }) : undefined}>
        <div className="hero-img" style={r.thumb ? { backgroundImage: `url(${r.thumb})` } : undefined} />
        {!r.thumb && <div className="hero-empty"><Icon name={r.icon} size={30} /></div>}
        <button className="icon-btn close" onClick={(e) => { e.stopPropagation(); selectRoom(null); }} aria-label="Close room"><Icon name="x" size={16} /></button>
        {r.cams.length > 0 && <button className="hero-btn" onClick={(e) => { e.stopPropagation(); set({ pano: { room: r.id, cam: r.cams[0].n } }); }}><Icon name="pano" size={16} />Enter 360° view</button>}
      </div>
      <div className="room-body">
        <div className="chip">{ZONES[r.zone]}</div>
        <h2>{r.name}</h2>
        <p className="desc">{r.info}</p>
        <RoomFacts r={r} />
        <RoomPieces r={r} onPick={(id) => selectItem(id)} />
      </div>
    </section>
  );
}

function MaterialCard({ id }: { id: string }) {
  const overrides = useStore((s) => s.overrides);
  const setMaterial = useStore((s) => s.setMaterial);
  const resetMaterials = useStore((s) => s.resetMaterials);
  const requestView = useStore((s) => s.requestView);
  const selectItem = useStore((s) => s.selectItem);
  const it = itemById(id);
  const b = it ? getBuilt(it.id) : null;
  const [slot, setSlot] = useState<string | null>(null);
  if (!it || !b) return null;
  const slots = Object.entries(b.built.slots);
  const cur = slot && b.built.slots[slot] ? slot : slots[0] ? slots[0][0] : null;
  const key = groupKey(it);
  const count = ITEMS.filter((i) => groupKey(i) === key).length;
  const room = roomById(it.room);
  const def = cur ? b.built.slots[cur] : null;
  const options = def ? MATERIALS.filter((m) => (SLOT_KINDS[def.kind] || [def.kind]).includes(m.kind)) : [];
  const active = cur ? matFor(it, b.built, cur, overrides) : '';
  return (
    <section className="card glass mat-card">
      <div className="card-head">
        <div>
          <div className="chip">{room ? room.name : 'Residence'}</div>
          <h2>{it.name}</h2>
          <p className="muted">{it.desc || (count > 1 ? `Changes apply to all ${count}` : 'Choose a finish for each part')}</p>
        </div>
        <button className="icon-btn" onClick={() => selectItem(null)} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
      <div className="slot-tabs">
        {slots.map(([k, d]) => (
          <button key={k} className={k === cur ? 'on' : ''} onClick={() => setSlot(k)}>
            <i style={{ background: swatchCss(MAT[matFor(it, b.built, k, overrides)] || MAT['boucle-ivory']) }} />
            {d.label}
          </button>
        ))}
      </div>
      {cur && (
        <>
          <div className="cur-mat"><span>{def!.label}</span><b>{MAT[active]?.name}</b></div>
          <div className="swatches">
            {options.map((m) => (
              <button key={m.id} className={'sw' + (m.id === active ? ' on' : '')} style={{ background: swatchCss(m) }} title={m.name} onClick={() => crossfade(() => setMaterial(key, cur, m.id), 420)}>
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="card-actions">
        <button className="btn ghost" onClick={() => requestView('item', it.id)}><Icon name="focus" size={16} />Focus</button>
        <button className="btn ghost" onClick={() => crossfade(() => resetMaterials(key), 420)}><Icon name="reset" size={16} />Reset</button>
      </div>
    </section>
  );
}

// One card at a time on the right: the piece being styled, else the chosen room, else (with no menu open)
// the residence summary. Cards crossfade into each other.
function RightColumn() {
  const roomId = useStore((s) => s.roomId);
  const itemId = useStore((s) => s.itemId);
  const panel = useStore((s) => s.panel);
  const help = useStore((s) => s.help);
  const pano = useStore((s) => s.pano);
  const r = roomById(roomId);
  const k = pano ? null : itemId ? 'item:' + itemId : r ? 'room:' + r.id : !panel && !help ? 'summary' : null;
  return (
    <aside className="right-col">
      <Switcher k={k}>
        {k?.startsWith('item:') ? <MaterialCard id={itemId!} /> : k?.startsWith('room:') ? <RoomCard r={r!} /> : k === 'summary' ? <Summary /> : null}
      </Switcher>
    </aside>
  );
}

function HelpPop() {
  const set = useStore((s) => s.set);
  return (
    <div className="help-pop glass" role="dialog" aria-label="How to use">
      <div className="card-head"><h2>Getting around</h2><button className="icon-btn" onClick={() => set({ help: false })} aria-label="Close"><Icon name="x" size={16} /></button></div>
      <ul>
        <li><b>Turn</b> drag with the left mouse button or one finger</li>
        <li><b>Move</b> drag with the right mouse button or two fingers</li>
        <li><b>Zoom</b> scroll, or pinch</li>
        <li><b>Rooms</b> pick a room in the list or its label to step into its 360° view</li>
        <li><b>Materials</b> click a sofa, table, bed or chair to change its finish</li>
        <li><b>Bare or Dressed</b> switches between the empty and the furnished home</li>
      </ul>
    </div>
  );
}

function Hint() {
  const help = useStore((s) => s.help);
  const pano = useStore((s) => s.pano);
  const [first, setFirst] = useState(true);
  useEffect(() => { const t = setTimeout(() => setFirst(false), 9000); return () => clearTimeout(t); }, []);
  return (
    <>
      <Switcher k={help && !pano ? 'help' : null}>{help && !pano ? <HelpPop /> : null}</Switcher>
      <div className={'hint glass' + (first ? '' : ' quiet') + (help || pano ? ' gone' : '')}>
        <span><Icon name="info" size={15} /> Drag to turn, scroll to zoom. Pick a room to step inside.</span>
      </div>
    </>
  );
}

export function Loader({ what = 'the residence' }: { what?: string }) {
  const { progress, active } = useProgress();
  const ready = useStore((s) => s.ready);
  const [gone, setGone] = useState(false);
  const done = !active && progress >= 100 && ready;
  useEffect(() => { if (done) { const t = setTimeout(() => setGone(true), 900); return () => clearTimeout(t); } }, [done]);
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
  return <Switcher k={toast}>{toast ? <div className="toast glass" role="status">{toast}</div> : null}</Switcher>;
}

function HoverLabel() {
  const hoverItem = useStore((s) => s.hoverItem);
  const pano = useStore((s) => s.pano);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mv = (e: PointerEvent) => { if (ref.current) ref.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`; };
    window.addEventListener('pointermove', mv);
    return () => window.removeEventListener('pointermove', mv);
  }, []);
  const it = pano ? null : itemById(hoverItem);
  return <div ref={ref} className={'hover-label' + (it ? ' on' : '')}>{it ? it.name : ''}{it && <small>Click to change materials</small>}</div>;
}

function Keys() {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useStore.getState();
      // Esc leaves the 360 view, also while the camera is still flying in
      if (s.pano) { s.set({ pano: null }); return; }
      if (s.itemId) s.selectItem(null);
      else if (s.roomId) s.selectRoom(null);
      else if (s.help) s.set({ help: false });
      else if (s.panel) s.set({ panel: null });
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return null;
}

export function UI() {
  return (
    <>
      <Rail />
      <TopBar />
      <LeftPanel />
      <RightColumn />
      <Hint />
      <HoverLabel />
      <Toast />
      <Keys />
      <PanoView />
      <Loader />
    </>
  );
}
