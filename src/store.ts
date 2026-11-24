import { create } from 'zustand';
import { roomById } from './data/plan';

export type Finish = 'bare' | 'dressed';
export type TimeOfDay = 'day' | 'night';
export type WallMode = 'full' | 'cutaway';
export type Panel = 'rooms' | 'finishes' | 'views' | null;

interface State {
  finish: Finish;
  time: TimeOfDay;
  walls: WallMode;
  panel: Panel;
  navHidden: boolean;
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
  favourites: string[];
  undoStack: Array<{ overrides: Record<string, Record<string, string>>; wallPaint: string; floorMats: Record<string, string> }>;
  redoStack: Array<{ overrides: Record<string, Record<string, string>>; wallPaint: string; floorMats: Record<string, string> }>;
  viewReq: { kind: 'home' | 'room' | 'top' | 'item' | 'preset'; id?: string; n: number };
  help: boolean;
  pano: { room: string; cam: number } | null;
  toast: string | null;
  ready: boolean; // shaders compiled and the first frame drawn; the loading screen waits for this
  inside: boolean; // the 3D camera is flying into / standing in a room for its 360 view (walls back to full height)
  reveal: boolean; // the 360 photo has been dissolved in over the 3D view
  panoShown: boolean; // the 360 photo has loaded and is on its canvas, ready to be revealed
  panoMount: boolean; // the 360 viewer may be created (near the end of the fly-in)
  set: (p: Partial<State>) => void;
  selectRoom: (id: string | null, fly?: boolean) => void;
  openRoom: (id: string) => void;
  openPanel: (p: Exclude<Panel, null>) => void;
  toggleHelp: () => void;
  selectItem: (id: string | null) => void;
  setMaterial: (key: string, slot: string, mat: string) => void;
  resetMaterials: (key?: string) => void;
  requestView: (kind: State['viewReq']['kind'], id?: string) => void;
  snapshotBeforeStyle: () => void;
  undo: () => void;
  redo: () => void;
  toggleFavourite: (id: string) => void;
}

let viewN = 0;
export const useStore = create<State>((set, get) => ({
  finish: 'dressed',
  time: 'day',
  walls: 'cutaway',
  panel: 'rooms',
  navHidden: false,
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
  favourites: (() => {
    try { return JSON.parse(localStorage.getItem('pv-favourites') || '[]'); } catch { return []; }
  })(),
  undoStack: [],
  redoStack: [],
  viewReq: { kind: 'home', n: 0 },
  help: false,
  pano: null,
  toast: null,
  ready: false,
  inside: false,
  reveal: false,
  panoShown: false,
  panoMount: false,
  set: (p) => set(p),
  // Only one menu or card is open at a time: choosing a room or a piece closes the side menus and help,
  // and opening a menu or help puts away the room or piece card.
  selectRoom: (id, fly = true) => {
    set(id ? { roomId: id, itemId: null, panel: null, help: false } : { roomId: null, itemId: null });
    // keep the entry's history state (the 360 view uses it to know which entries are its own)
    try { history.replaceState(history.state, '', id ? '#room=' + id : location.pathname + location.search); } catch (e) { /* ignore */ }
    if (fly) get().requestView(id ? 'room' : 'home', id || undefined);
  },
  // From the rooms list or a room label: fly into the room and open its 360 view full screen
  // (rooms without 360 photos just get the fly-in and their card)
  openRoom: (id) => {
    const r = roomById(id);
    const has360 = !!(r && r.cams.length);
    get().selectRoom(id, !has360); // with a 360 view, the camera flies in to where the photo was taken instead
    if (has360) set({ pano: { room: id, cam: r!.cams[0].n } });
  },
  openPanel: (p) => {
    const next = get().panel === p ? null : p;
    set({ panel: next, help: false });
    if (next && (get().roomId || get().itemId)) get().selectRoom(null, false);
  },
  toggleHelp: () => {
    const on = !get().help;
    set({ help: on, ...(on ? { panel: null } : {}) });
    if (on && (get().roomId || get().itemId)) get().selectRoom(null, false);
  },
  selectItem: (id) => set(id ? { itemId: id, panel: null, help: false, pano: null } : { itemId: null }),
  setMaterial: (key, slot, mat) => {
    get().snapshotBeforeStyle();
    const o = { ...get().overrides };
    o[key] = { ...(o[key] || {}), [slot]: mat };
    set({ overrides: o });
  },
  resetMaterials: (key) => {
    get().snapshotBeforeStyle();
    if (!key) { set({ overrides: {} }); return; }
    const o = { ...get().overrides };
    delete o[key];
    set({ overrides: o });
  },
  requestView: (kind, id) => set({ viewReq: { kind, id, n: ++viewN } })
  ,
  snapshotBeforeStyle: () => {
    const s = get();
    set({ undoStack: [...s.undoStack.slice(-19), { overrides: s.overrides, wallPaint: s.wallPaint, floorMats: s.floorMats }], redoStack: [] });
  },
  undo: () => {
    const s = get();
    if (!s.undoStack.length) return;
    const previous = s.undoStack[s.undoStack.length - 1];
    set({
      ...previous,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, { overrides: s.overrides, wallPaint: s.wallPaint, floorMats: s.floorMats }]
    });
  },
  redo: () => {
    const s = get();
    if (!s.redoStack.length) return;
    const next = s.redoStack[s.redoStack.length - 1];
    set({
      ...next,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, { overrides: s.overrides, wallPaint: s.wallPaint, floorMats: s.floorMats }]
    });
  },
  toggleFavourite: (id) => {
    const s = get();
    const favourites = s.favourites.includes(id) ? s.favourites.filter((x) => x !== id) : [...s.favourites, id];
    try { localStorage.setItem('pv-favourites', JSON.stringify(favourites)); } catch {}
    set({ favourites, toast: s.favourites.includes(id) ? 'Removed from favourites' : 'Saved to favourites' });
  }
}));

// test hooks, only with ?debug in the address
if (typeof window !== 'undefined' && /[?&]debug/.test(window.location.search)) (window as any).__pv = useStore;
