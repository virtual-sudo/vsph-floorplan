import * as THREE from 'three';

// Shared by the 3D fly-in and the 360 viewer, so the photo opens facing exactly where the 3D view looks when it
// lands, and the 3D view takes over facing wherever the visitor was looking in the photo.
//
// Headings are compass angles in the plan, in radians, measured from east (+x) toward south (+z).
// Each 360 photo's "yaw" (rooms.json, degrees) is how far it is turned in the plan: a direction in the photo
// points to (its angle in the photo + yaw) in the plan. The yaws were measured by matching every photo against
// the 3D model rendered from the same spot.
export const panoLink = {
  heading: null as number | null, // where the 3D view faced when it landed; null = open the photo as it is
  camera: null as THREE.PerspectiveCamera | null // the 360 viewer's camera while it is open
};
export const yawOf = (cam?: { yaw?: number } | null) => ((cam?.yaw ?? 0) * Math.PI) / 180;
