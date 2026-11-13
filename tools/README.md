# Plan pipeline

These Python scripts turned the two rendered plans into the data the app uses. You only need them to rebuild the
geometry from a new plan picture. Run them from the project folder, in order, with Python 3, OpenCV, NumPy, SciPy
and Shapely installed (`pip install opencv-python numpy scipy shapely`).

Put the inputs here first:

- `work/bare.png` and `work/dressed.png`: the 2356 x 1356 plan renders (taupe walls, transparent outside the slab).
- `tour-media/`: the `*_hd_t.jpg` previews from the 3DVista export (room pictures and the 360 previews).
- `work/pano-labels.json`: panorama id to label, read from the tour's `script_general.js`.

| Script | Makes |
|---|---|
| `1-walls-mask.py` (run inside `work/`, like 2 and 3) | `work/wall_clean.png`, the cleaned wall mask (taupe fill plus its light outline) |
| `2-thin-walls.py` | `work/thin_lines.png`, thin partitions drawn as light double lines |
| `3-facade-fit.py` | `work/glz_fit.json`, the curved facade glass lines fitted to the dark window frames |
| `4-extract-plan.py` | `src/data/plan.json`: slab outline, walls, thin walls, joinery boxes, glazing, balustrade |
| `5-rooms.py` | `src/data/rooms.json` and `public/thumbs/`: room outlines, areas, pins and pictures |
| `6-textures-a.py`, `7-textures-b.py` | marble, wood, fabric and plaster textures in `public/tex/` |
| `8-floors.py` | the floor finishes (oak, herringbone, limestone, stone, marble, decking) in `public/tex/` |
| `9-floor-zones.py` | `src/data/floors.json`, which finish goes where |
| `10-regularize-walls.py` | straightens the walls in `plan.json`, finds thin walls and shower glass, adds skirting |

The furniture positions (`src/data/furniture.ts`) were set by hand from
the dressed plan. Scale is about 58 pixels per metre.

## Sharp 360 photos

`13-pano-hd.sh` makes the 360 photos from the tour's full-size panoramas (macOS only; it uses Swift and the
built-in image engine, nothing to install). Put the panoramas in `panoramas/` (kept out of git and out of
`public/`), named like the tour's views, e.g. `Grand Living 02_12K.jpg` and `Grand Living 02_Bare_12K.jpg`, then run
`tools/13-pano-hd.sh`. For every view and finish it writes a 2048-pixel preview to `public/pano/` and 1024-pixel
tiles at 4096 and 8192 pixels around to `public/pano-hd/`, listed in `public/pano-hd/index.json`. The app shows the
preview first and fades in the tile set that suits the screen. The work is done by `pano-tiles.swift`; set
`PANO_Q` and `PANO_PREVIEW_Q` (0 to 1, defaults 0.5 and 0.45) to change the JPEG quality.
