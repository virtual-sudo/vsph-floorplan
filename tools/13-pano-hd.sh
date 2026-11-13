#!/bin/bash
# Sharp 360 photos for the app, from the full-size panoramas of the tour (macOS: uses Swift and the built-in
# image engine, nothing to install).
#
# Usage:  tools/13-pano-hd.sh [folder]        (default folder: panoramas/)
#
# The folder holds the 2:1 panoramas named like the tour's views, e.g. "Grand Living 02_12K.jpg" and
# "Grand Living 02_Bare_12K.jpg". Each file is matched to a view of src/data/rooms.json by its name (see OVERRIDES
# below for names that differ), then tools/pano-tiles.swift writes, per view and finish:
#   public/pano/c<n>-<d|b>.jpg                   the 2048 x 1024 preview the app shows first
#   public/pano-hd/c<n>-<d|b>/1/<row>_<col>.jpg  4096 x 2048 in 1024-pixel tiles (phones and small screens)
#   public/pano-hd/c<n>-<d|b>/2/<row>_<col>.jpg  8192 x 4096 in 1024-pixel tiles (computers)
# and lists them in public/pano-hd/index.json. The app fades the tiles in over the preview as they arrive.
#
# Keep the full-size folder out of public/ (everything in public/ is copied to the site) and out of git.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="$(cd "${1:-$here/panoramas}" && pwd)"
mkdir -p "$here/work"
jobs="$here/work/pano-jobs.json"

# view number -> file names; d = dressed, b = bare
OVERRIDES='{"27": "Primary Bedroom 06 Balcony"}'
node - "$here/src/data/rooms.json" "$src" "$jobs" "$OVERRIDES" <<'JS'
const fs = require('fs');
const [rooms, dir, out, over] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f));
const key = (s) => s.toLowerCase().replace(/\.jpe?g$/, '').replace(/_12k$/, '').replace(/_bare$/, '').replace(/\s+/g, ' ').trim();
const isBare = (f) => /_bare(_|\.)/i.test(f);
const names = JSON.parse(over);
const jobs = [], seen = new Set(), missing = [];
for (const r of JSON.parse(fs.readFileSync(rooms, 'utf8')).rooms) for (const c of r.cams) {
  if (seen.has(c.n)) continue;
  seen.add(c.n);
  const want = key(names[c.n] || c.name);
  const d = files.find((f) => !isBare(f) && key(f) === want);
  const b = files.find((f) => isBare(f) && key(f) === want);
  if (d) jobs.push({ src: dir + '/' + d, name: `c${c.n}-d` }); else missing.push(c.n + ' ' + c.name);
  if (b) jobs.push({ src: dir + '/' + b, name: `c${c.n}-b` });
}
fs.writeFileSync(out, JSON.stringify(jobs, null, 1));
console.log(`${jobs.length} panoramas for ${seen.size} views` + (missing.length ? `; no file for: ${missing.join(', ')}` : ''));
JS

# compile once (much faster than running the script directly), then convert
bin="$here/work/pano-tiles"
if [ ! -x "$bin" ] || [ "$here/tools/pano-tiles.swift" -nt "$bin" ]; then
  swiftc -O -o "$bin" "$here/tools/pano-tiles.swift"
fi
"$bin" "$jobs" "$here/public"
