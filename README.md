# Park Villas 3D Residence Plan

An interactive, single-floor residence viewer built with React, TypeScript, Vite, Three.js, and React Three Fiber. The floor plan is modelled in 3D, with room selection, furniture styling, lighting options, and embedded 360° previews.

## Run locally

Requirements: Node.js 18 or newer and npm.

```sh
npm install
npm run dev
```

Vite prints the local URL (usually <http://localhost:5173>). Other useful commands:

```sh
npm run build      # Type-check and create the static site in dist/
npm run preview    # Preview the built site locally
```

## How the app is put together

The app has two main layers: the regular React interface and a React Three Fiber canvas. Both read and update shared UI state in Zustand.

```text
src/main.tsx
  └─ src/App.tsx
       ├─ src/three/Scene.tsx     Canvas and scene composition
       │    ├─ Architecture.tsx  Floor, walls, glazing, curtains, millwork
       │    ├─ Furniture.tsx     Builds, positions, and selects furniture
       │    ├─ Lighting.tsx      Day/night environment and lights
       │    ├─ CameraRig.tsx     Camera controls and room/item framing
       │    └─ Capture.tsx       High-resolution PNG capture
       └─ src/ui/UI.tsx          Controls, panels, and selection details
            └─ src/ui/Pano.tsx   360° image viewer
```

On startup, `main.tsx` mounts `App`. `App` displays the 3D `Stage` and the HTML interface. The scene and interface use `src/store.ts` to stay in sync: for example, choosing a room updates the selected room in the interface and requests the camera to frame it. Scene geometry and content are driven primarily by the files in `src/data/`.

### Source map

| Path | Responsibility |
|---|---|
| `src/main.tsx` | React entry point, global styles, fonts, and root mount |
| `src/App.tsx` | Top-level layout and support for opening a shared `#room=...` link |
| `src/store.ts` | Shared UI state: finish, time of day, selection, materials, panels, and camera requests |
| `src/config.ts` | Optional published-tour URL and placeholder-content flag |
| `src/data/plan.ts` | Types and coordinate conversion helpers; loads plan, room, and floor JSON |
| `src/data/plan.json` | Traced architectural outlines and geometry |
| `src/data/rooms.json` | Room polygons, areas, names, labels, camera IDs, and descriptions |
| `src/data/floors.json` | Floor-finish zones and their default materials |
| `src/data/furniture.ts` | Furniture and fixture inventory, placements, rotations, room IDs, and defaults |
| `src/data/materials.ts` | Material catalogue, finish properties, texture references, and picker swatches |
| `src/three/` | Three.js geometry, rendering, lighting, camera behavior, and image capture |
| `src/three/builders.ts` | Procedural geometry builders for furniture types |
| `src/three/geo.ts` | Shared geometry helpers used by architecture and furniture builders |
| `src/three/matlib.ts` | Creates and caches Three.js materials from the catalogue |
| `src/ui/UI.tsx` | Main controls, room/material panels, help, and selection details |
| `src/ui/Pano.tsx` | 360° panorama modal |
| `src/ui/presets.ts` | Whole-home material palettes |
| `src/styles.css` | Interface layout and visual styling |
| `src/debug.ts` | Enables development hooks when the URL has `?debug` |
| `public/` | Static images and textures loaded by URL at runtime |
| `tools/` | Python scripts for rebuilding plan geometry and generated assets |

### Rendering and coordinate system

`src/data/plan.ts` maps source-plan pixels into Three.js world units. The source plan is 2356 × 1356 pixels, with approximately 58 pixels per metre. World X runs right across the plan, world Z runs down the plan, and Y is vertical. Furniture `x` and `y` positions are source-plan pixels; `rot` is degrees.

The scene combines the architectural plan geometry with procedural furniture. The plan pipeline produces architectural outlines and floor zones; `Furniture.tsx` looks up each item’s type in the builder registry in `builders.ts`, merges its geometry by material slot, and places it using the item data. `matlib.ts` turns material IDs into Three.js materials. Assets under `public/` are served from the site root (for example, `public/tex/floor_deck.jpg` is referenced as `tex/floor_deck.jpg`).

## Common changes

| To change… | Edit… |
|---|---|
| Residence summary details shown in the UI | `RESIDENCE` in `src/data/plan.ts` |
| Room labels, descriptions, areas, pins, and panorama camera IDs | `src/data/rooms.json` |
| Room/floor/wall geometry | `src/data/plan.json` and related geometry components |
| Floor zone outlines or their default finish | `src/data/floors.json` |
| Furniture location, rotation, finish, and initial material values | `src/data/furniture.ts` |
| Available materials and their texture/physical properties | `src/data/materials.ts` and corresponding files in `public/tex/` |
| Palette options | `src/ui/presets.ts` |
| Day/night lighting | `src/three/Lighting.tsx` |
| Camera home positions or framing | `src/three/CameraRig.tsx` |
| Published 360 tour link | `TOUR_URL` in `src/config.ts` |
| Interface appearance | `src/styles.css` and `src/ui/UI.tsx` |

### Adding or changing furniture

1. Edit or add an entry in `src/data/furniture.ts`. Its `type` must have a matching builder in `src/three/builders.ts`.
2. The builder returns geometry grouped by material slot. Slots with defaults are selectable in the styling UI; fixed parts use their fixed material.
3. Use a unique `id`, a room ID that exists in `rooms.json`, and source-plan pixel coordinates for `x` and `y`. Use `finish: 'both'` for built-in fixtures shown in both modes; otherwise items are part of the dressed view.
4. Use the `set` field when multiple pieces should share material overrides (for example, a set of chairs).

## Rebuilding plan assets

Most app development does not require Python. The scripts in `tools/` are a separate pipeline for extracting plan geometry, room data, and textures from source plan images. Their inputs and run order are described in [`tools/README.md`](tools/README.md). After running the pipeline, inspect the generated data/assets and use `npm run build` to validate the app.

## Static build and deployment

`npm run build` type-checks the TypeScript project and writes the static site to `dist/`. The Vite config uses relative asset paths so the build can be hosted from a subdirectory. Netlify settings are in `netlify.toml`; other static hosts can serve the contents of `dist/`.

## Notes

- The residence figures and some room descriptions are placeholders until verified sales information is available.
- The model uses approximate building heights and procedural furniture based on plan footprints; it is not a construction or specification model.
- The 360° previews are static panorama images from the tour export. Set `TOUR_URL` in `src/config.ts` to enable links back to a published tour.
