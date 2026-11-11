# Park Villas 3D: project overview and performance report

*Measured 11 Nov 2026 on your MacBook Pro 2019 (AMD Radeon Pro 5500M, Retina 2× pixels), production build (`vite preview`), Chromium with ANGLE/Metal.*

---

## Update: fixes 1–5 applied (same day)

The original source is backed up in `../backup-before-perf/`. Changed files: `src/three/redraw.ts` (new), `Scene.tsx`, `Lighting.tsx`, `Furniture.tsx`, `CameraRig.tsx`, `Capture.tsx`, `Architecture.tsx`, `matlib.ts`, `src/store.ts`, `src/ui/UI.tsx`, `netlify.toml`. `dist/` has been rebuilt.

**Results** (same machine, original vs optimized build, measured one after the other with a pause before each):

| | Original | Optimized |
|---|---|---|
| Longest page freeze while loading | 4.4 s (10.9 s on a first-ever visit) | **1.1 s** |
| Loading screen gone | 7.9 s | 7.2 s |
| Redraws while nothing moves | continuous (~30 frames/s) | **none** |
| Orbiting the model | ~25 fps | **~33–50 fps** |
| Night / Full walls switch | ~1.6 s / ~0.7 s once Chrome has cached the shaders, ~20 s / ~7.5 s on a first visit | unchanged (fix 3b not applied) |

Chrome keeps compiled shaders between visits, so after a day of testing both builds start faster than on the first measurement above. The first-visit freeze for the optimized build could not be re-measured for the same reason. In an isolated test, background compiling took the compile step from 8.5 s blocking to 0.6 s non-blocking.

**Looks the same:** textures reach the GPU bit-for-bit identical (checked for the 2K floors, wood, marble and the transparent leaf PNG). With the camera fixed, the night view renders 100% identical and the overview 99.96% identical (largest difference 12/255 at a few edges). After a camera flight, two runs of the *original* already differ slightly from each other, because the camera comes to rest at a marginally different spot each time.

**Also checked:** room flights and Bare/Dressed animate smoothly even after the view has been idle; the hover highlight clears; Save picture works; the picture redraws on its own after the browser drops and restores the graphics context; dev mode (`npm run dev`) works.

**Two safeguards that came out of testing:**
- React Three Fiber 9.8.1 doesn't request a redraw when an object is only *removed* (for example when a hover highlight ends). `RedrawOnChange` in `Scene.tsx` redraws after every interface change.
- A MacBook Pro 2019 can switch graphics cards, which makes the browser drop and restore the WebGL context. The canvas now redraws when that happens. The original only recovered because it redrew constantly.

### Fix 3b applied: Night and Full walls prepared in the background

After the residence appears, the page uses idle moments to download the night sky and compile the Night, Full-walls and Night + Full shaders in the background (`PrewarmVariants` in `Scene.tsx`). It only runs from the opening Day + Cut view and stops if the visitor switches first. Nothing is drawn while it works, so the picture doesn't change. As a side effect, the first switch to Night no longer blanks the 3D view while the night sky downloads.

**Corrected numbers.** To measure a real first visit, I used test copies that give every page load fresh shaders, so Chrome's shader cache can't help. On that basis the first-visit switches cost far less than the 20 s / 7.5 s measured this morning, which came from a "cold" machine while the original was redrawing constantly:

| First visit (simulated) | Before 3b | With 3b |
|---|---|---|
| Full walls | 0.5 s freeze, 9 new shaders | **0.07 s**, 0 new shaders |
| Night | 1.1 s freeze, 23 new shaders | **0.18 s**, 3 new shaders (glow effect) |
| Night + Full walls | 0.5 s freeze, 9 new shaders | **0.08 s**, 0 new shaders |
| Original build, Night + Full walls | 10.1 s freeze | |

The background work takes about 2 s right after the page appears. Its own main-thread cost is small (31–54 ms per compile step), plus decoding the night sky file (a few hundred ms). This machine's timings vary a lot between runs (idle hitches of up to ~1 s appeared even without 3b), so these numbers come from one clean back-to-back pair. Reading the "new shaders" counts is the reliable part.

**Trade-off:** every visitor downloads the night sky (1.7 MB) in the background, including those who never switch to Night.

**Not done yet:** fixes 6–7 and the tidy-ups.

---

## 1. What the project is

A single web page that shows one Park Villas residence as an interactive 3D model. Visitors can orbit the floor plan, click rooms, switch Day/Night, Bare/Dressed and Full/Cut walls, restyle furniture materials, open 360° photos and save a 4K picture.

| Layer | What it does | Files |
|---|---|---|
| **Data** | Floor plan outlines, 21 rooms, 8 floor zones, 141 furniture items, ~120 materials | `src/data/*` |
| **3D scene** | Builds every wall, window, curtain and piece of furniture *in code* when the page opens (there are no 3D model files) | `src/three/*` |
| **Look** | Physically based materials, 4096 px sun shadow, ambient occlusion (N8AO), outline on hover, bloom at night, AgX tone mapping, SMAA | `Scene.tsx`, `Lighting.tsx`, `matlib.ts` |
| **Interface** | React panels over the 3D canvas with frosted-glass blur | `src/ui/*`, `styles.css` |
| **Shared state** | One Zustand store keeps the UI and the 3D view in sync | `src/store.ts` |
| **Assets** | 86 textures, 2 HDR skies, 84 panorama JPEGs, 21 room thumbnails | `public/` |

The code is clean and well organised, it type-checks with no errors, and the dependencies are recent.

---

## 2. Why it feels slow on your Mac (measured)

| What | Measured |
|---|---|
| Download on first visit | 79 files, **9.2 MB** (7.1 MB textures, 1.0 MB sky, 0.6 MB JS, 0.4 MB thumbnails) |
| All files downloaded | 1.9 s (local server) |
| Loading screen disappears | **13.9 s** |
| Longest single freeze | **10.9 s** (page fully unresponsive, loader stuck at 100%) |
| Switching to **Night** | **~20 s freeze** |
| Switching walls to **Full** | **~7.5 s freeze** |
| Frame rate while *nothing moves* | 26–34 fps: the GPU redraws the whole scene non-stop |
| Scene size | 381 meshes, 0.56 M triangles, 84 materials → 42 shader programs |

**The download is not the main problem. The work after the download is.** It has three causes:

1. **Shader compilation (the biggest cost).** Every distinct material setup (sheen, clearcoat, normal maps, cut-away clipping and so on) becomes a GPU program that has to be compiled before the first frame. On macOS (Metal) this is slow: compiling this scene's 84 materials from cold took **8.5 s** on its own. It all happens in one go on the first frame, so the page freezes.
   - **Night** adds about 15 point lights. three.js copies the full lighting code once for each light, so every material gets a much bigger shader that has to be compiled again, which takes **~20 s**.
   - **Full/Cut walls** switches clipping on or off for every furniture material, which forces a recompile (**~7.5 s**).
2. **Texture decoding on the main thread.** About 50 textures are decoded and uploaded during that same first frame, 21 of them 2048 × 2048 floor maps. Each 2K texture took **237 ms** this way. Decoding them off the main thread (ImageBitmap) took **74 ms**, about 3× faster, with identical pixels.
3. **It never stops rendering.** The app redraws at full speed even when the view is still. Each frame it also redraws all 0.54 M shadow-casting triangles into a 4096 × 4096 shadow map, although the sun and furniture never move. This keeps a 2019 MacBook hot and throttled and makes the frosted-glass panels sluggish.

---

## 3. Fixes that keep the same look and functionality

Ranked by impact. **None of these changes a single pixel of the final image.**

| # | Fix | Expected gain | Effort / risk |
|---|---|---|---|
| **1** | **Render only when something changes** (`frameloop="demand"` on the Canvas, plus `invalidate()` for the furniture animation, texture loads, night/cut material switches and the capture). drei's CameraControls already supports this. | Idle GPU use drops from ~30 frames/s to **0**. Fans calm down and the UI responds instantly. | Small / low. Every interaction needs testing so the view never "forgets" to refresh. |
| **2** | **Draw the sun shadow once, not every frame** (`gl.shadowMap.autoUpdate = false`; refresh it only on Day/Night, walls, Bare/Dressed). | Removes a 4096² redraw of 0.54 M triangles from every frame while orbiting, for **smoother orbiting**. | Small / low |
| **3** | **Pre-compile shaders behind the loading screen** with `gl.compileAsync()`, using the GPU's parallel-compile extension (your Mac supports it), then do one hidden warm-up draw before revealing the scene. | Compile step tested on your Mac: **8.5 s blocking → 0.6 s in the background**. Metal still finishes some work on the first draw (~4 s). Estimated startup freeze: **11 s → ~4–6 s**, with the loader still showing during it rather than frozen at 100%. | Medium / low |
| **3b** | Same for **Night** and **Full walls**: compile those variants in the background after the first view is ready. | Turns the 20 s and 7.5 s freezes into much shorter ones. Some Metal first-draw cost remains. | Medium / medium |
| **4** | **Decode textures off the main thread** (`ImageBitmapLoader` in `matlib.ts` with matching flip and colour settings). | ~3× faster per texture. Estimated **2–4 s less freezing** at startup and when choosing a new finish. | Small / low |
| **5** | **Cache headers for `tex/`, `hdr/`, `pano/`, `thumbs/`** in `netlify.toml`. Today only `assets/` is cached, so every repeat visit re-checks ~75 files. | Faster repeat visits | Tiny / none |
| **6** | **Stop needless React re-renders.** All 141 furniture pieces re-render on every hover change, and five panels (`TopBar`, `FinishesCard`, `ViewsCard`, `RoomCard`, `MaterialCard`) re-render on every mouse move over a room because they read the whole store (`useStore()` with no selector). | Smoother hovering and less CPU | Small / low |
| **7** | **Faster hover detection** with `three-mesh-bvh`. Every mouse move currently tests the pointer against 0.56 M triangles. | Hover stays smooth on slower machines | Small / low (one new dependency) |

**Fixes 1 to 5 together should make the page usable in roughly half the time and keep the laptop cool while someone is browsing.** All of these are estimates from isolated tests; I'll re-measure after each change.

### Tidy-ups (no visible effect)
- `matlib.ts` copies textures before they finish loading, which causes the repeated console warning *"Texture marked for update but no image data found"*. It's harmless but easy to fix.
- `Scene.tsx` → `Effects` creates a `new THREE.Color` on every render. `Furniture.tsx` → `Piece` builds a new `Set` and runs a 141-item lookup on every render.
- `UI.tsx` line 447 `{TOUR_URL ? null : null}` is dead code.
- `preserveDrawingBuffer: true` costs a little every frame. It's only needed for "Save picture", and the capture could grab the frame right after drawing instead.

---

## 4. Optional speed-ups that change the look *slightly*

Only if you're happy with a small trade:

| Option | Gain | Visible difference |
|---|---|---|
| Floor textures 2048 → 1024 px (21 files) | −3 MB download, about −350 MB GPU memory, faster upload | Only when zoomed right down onto the floor |
| KTX2/Basis GPU-compressed textures | Much less GPU memory and near-instant upload | Very faint compression artefacts |
| Lower resolution *only while moving* (drei `PerformanceMonitor`) | Much smoother orbiting at Retina resolution | Slightly softer while dragging, sharp when still |
| Replace the ~15 night point lights with baked light pools | Night switch becomes instant | Light pools look a little different |

There is already a **High quality** switch under *Styling* that drops ambient occlusion and pixel density. It is the quickest relief today, but it changes the look.

---

## 5. Dependencies

Everything is recent. Safe patch updates: `@react-three/fiber` 9.8.2, `@react-three/postprocessing` 3.2.2, `postprocessing` 6.39.6, `react`/`react-dom` 19.3.1, `zustand` 5.1.0.
**Hold** `three` 0.187, Vite 8, TypeScript 7 and `@vitejs/plugin-react` 6. They're bigger jumps that can change rendering or the build, and they aren't needed for any of the fixes above.
