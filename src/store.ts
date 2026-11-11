import { create } from 'zustand';

export type Finish = 'bare' | 'dressed';
export type TimeOfDay = 'day' | 'night';
export type WallMode = 'full' | 'cutaway';
export type Panel = 'rooms' | 'finishes' | 'views' | null;

interface State {
  finish: Finish;
  time: TimeOfDay;
  walls: WallMode;
  panel: Panel;
  roomId: string | null;
  hoverRoom: string | null;
  itemId: string | null;
  hoverItem: string | null;
  overrides: Record<string, Record<string, string>>; // item id or set id -> slot -> material id
  wallPaint: string;
  floorMats: Record<string, string>;
  showPins: boolean;
  showPlan: boolean;
  quality: 'high' | 'balanced';
  viewReq: { kind: 'home' | 'room' | 'top' | 'item' | 'preset'; id?: string; n: number };
  help: boolean;
  pano: { room: string; cam: number } | null;
  toast: string | null;
  ready: boolean; // shaders compiled and the first frame drawn; the loading screen waits for this
  set: (p: Partial<State>) => void;
  selectRoom: (id: string | null, fly?: boolean) => void;
  selectItem: (id: string | null) => void;
  setMaterial: (key: string, slot: string, mat: string) => void;
  resetMaterials: (key?: string) => void;
  requestView: (kind: State['viewReq']['kind'], id?: string) => void;
}

let viewN = 0;
export const useStore = create<State>((set, get) => ({
  finish: 'dressed',
  time: 'day',
  walls: 'cutaway',
  panel: 'rooms',
  roomId: null,
  hoverRoom: null,
  itemId: null,
  hoverItem: null,
  overrides: {},
  wallPaint: 'paint-warm-white',
  floorMats: {},
  showPins: true,
  showPlan: false,
  quality: typeof window !== 'undefined' && (window.innerWidth < 760 || /Mobi|Android/i.test(navigator.userAgent)) ? 'balanced' : 'high',
  viewReq: { kind: 'home', n: 0 },
  help: false,
  pano: null,
  toast: null,
  ready: false,
  set: (p) => set(p),
  selectRoom: (id, fly = true) => {
    set({ roomId: id, itemId: null });
    try { history.replaceState(null, '', id ? '#room=' + id : location.pathname + location.search); } catch (e) { /* ignore */ }
    if (fly) get().requestView(id ? 'room' : 'home', id || undefined);
  },
  selectItem: (id) => set({ itemId: id }),
  setMaterial: (key, slot, mat) => {
    const o = { ...get().overrides };
    o[key] = { ...(o[key] || {}), [slot]: mat };
    set({ overrides: o });
  },
  resetMaterials: (key) => {
    if (!key) { set({ overrides: {} }); return; }
    const o = { ...get().overrides };
    delete o[key];
    set({ overrides: o });
  },
  requestView: (kind, id) => set({ viewReq: { kind, id, n: ++viewN } })
}));

// test hooks, only with ?debug in the address
if (typeof window !== 'undefined' && /[?&]debug/.test(window.location.search)) (window as any).__pv = useStore;
