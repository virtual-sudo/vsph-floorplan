import planJson from './plan.json';
import roomsJson from './rooms.json';
import floorsJson from './floors.json';

// The plan pictures are 2356 x 1356 pixels at about 58 pixels per metre.
// World units are metres: X runs east (right on the plan), Z runs south (down on the plan), Y is up.
export const PPM = 58;
export const S = 1 / PPM;
export const PLAN_W = 2356;
export const PLAN_H = 1356;
export const CX = PLAN_W / 2;
export const CY = PLAN_H / 2;
export const wx = (px: number) => (px - CX) * S;
export const wz = (py: number) => (py - CY) * S;
export const toWorld = (p: number[]): [number, number] => [wx(p[0]), wz(p[1])];

export const WALL_H = 3.1;
export const CUT_H = 1.3;

export type Pt = [number, number];
export interface WallPoly { o: Pt[]; h: Pt[][] }
export interface Thin { c: Pt; l: number; t: number; a: number; kind?: 'wall' | 'glass' }
export interface Glazing { id: string; kind: 'facade' | 'slider'; pts: Pt[] }
export interface PlanData {
  px: [number, number];
  slab: Pt[];
  interior: Pt[];
  balustrade: Pt[][];
  glazing: Glazing[];
  walls: WallPoly[];
  thin: Thin[];
  millwork: [number, number, number, number][];
  columns: [number, number, number, number][];
  skirt?: WallPoly[];
}
export const plan = planJson as unknown as PlanData;

// yaw: how far the 360 photo is turned in the plan (degrees, see three/panoLink.ts)
// bare: false when there is no bare photo for this view; missing: no photo of its own (left out of the app)
export interface RoomCam { n: number; name: string; x: number; y: number; yaw?: number; bare?: boolean; missing?: boolean }
export interface Room {
  id: string;
  name: string;
  zone: 'arrival' | 'living' | 'outdoor' | 'service' | 'private' | 'circulation';
  icon: string;
  poly: Pt[];
  area: number;
  dims: [number, number];
  pin: Pt;
  cams: RoomCam[];
  thumb: string | null;
  floor: string;
  ceiling: number;
  info: string;
  features: string[];
}
export const rooms = (roomsJson as unknown as { rooms: Room[] }).rooms.map((r) => ({ ...r, cams: r.cams.filter((c) => !c.missing) }));
export const roomById = (id: string | null) => rooms.find((r) => r.id === id) || null;

export const ZONES: Record<Room['zone'], string> = {
  arrival: 'Arrival',
  living: 'Living and dining',
  private: 'Bedrooms',
  outdoor: 'Terraces',
  service: 'Service',
  circulation: 'Circulation'
};

// Temporary residence figures for the summary card (placeholders until the sales data is supplied)
export const RESIDENCE = {
  name: 'Park Villas',
  unit: 'Sky Villa, Level 38',
  developer: 'Ayala Land Premier',
  bedrooms: 4,
  baths: 5,
  powder: 1,
  lifts: 2,
  parking: 4,
  view: 'Park and skyline, east and west',
  tourUrl: ''
};

export interface FloorZone { id: string; name: string; mat: string; area: number; polys: WallPoly[] }
export const floorZones = (floorsJson as unknown as { zones: FloorZone[] }).zones;
