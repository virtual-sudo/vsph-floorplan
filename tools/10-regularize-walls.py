# Straightens the traced walls: removes raster notches and bumps, snaps near-horizontal and near-vertical edges,
# drops thin "partitions" that are only a wall's light outline, and sorts the rest into doors and glass screens.
# Run from the project folder after 4-extract-plan.py and 9-floor-zones.py. Rewrites src/data/plan.json.
import json, math, cv2, numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
W = 'work/'
plan = json.load(open('src/data/plan.json'))
wall = cv2.imread(W + 'wall_clean.png', 0)
k5 = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
m = cv2.morphologyEx(wall, cv2.MORPH_CLOSE, k5)
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k5)
# drop crumbs left by the opening
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
clean = np.zeros_like(m)
for i in range(1, n):
    if st[i, 4] >= 150: clean[lab == i] = 255
TAN = math.tan(math.radians(14))

def classify(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    if abs(dy) <= TAN * abs(dx): return 'H'
    if abs(dx) <= TAN * abs(dy): return 'V'
    return 'D'

def rectilinear(pts):
    pts = [tuple(map(float, p)) for p in pts]
    for _ in range(3):
        # merge consecutive collinear H or V edges
        n = len(pts)
        if n < 4: return pts
        cls = [classify(pts[i], pts[(i + 1) % n]) for i in range(n)]
        keep = [not (cls[i - 1] == cls[i] and cls[i] in 'HV') for i in range(n)]
        pts = [p for p, k in zip(pts, keep) if k]
    n = len(pts)
    cls = [classify(pts[i], pts[(i + 1) % n]) for i in range(n)]
    hy = {}; vx = {}
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if cls[i] == 'H': hy[i] = (a[1] + b[1]) / 2
        if cls[i] == 'V': vx[i] = (a[0] + b[0]) / 2
    out = []
    for i in range(n):
        pe, ne = (i - 1) % n, i  # edge before and after vertex i
        x, y = pts[i]
        for e in (pe, ne):
            if e in vx: x = vx[e]
            if e in hy: y = hy[e]
        out.append((round(x, 1), round(y, 1)))
    # remove very short edges and duplicates
    res = []
    for p in out:
        if not res or math.hypot(p[0] - res[-1][0], p[1] - res[-1][1]) > 1.5: res.append(p)
    if len(res) > 2 and math.hypot(res[0][0] - res[-1][0], res[0][1] - res[-1][1]) <= 1.5: res.pop()
    return res

cs, hier = cv2.findContours(clean, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
hier = hier[0]
walls = []; polys = []
for i, c in enumerate(cs):
    if hier[i][3] != -1 or cv2.contourArea(c) < 60: continue
    o = rectilinear(cv2.approxPolyDP(c, 2.2, True)[:, 0, :])
    holes = []
    j = hier[i][2]
    while j != -1:
        x_, y_, w_, h_ = cv2.boundingRect(cs[j])
        # keep real voids (shafts, ducts); fill thin slots, which are drawing lines inside a wall
        if cv2.contourArea(cs[j]) > 60 and min(w_, h_) > 18:
            h = rectilinear(cv2.approxPolyDP(cs[j], 2.2, True)[:, 0, :])
            if len(h) >= 3: holes.append(h)
        j = hier[j][0]
    if len(o) < 3: continue
    P = Polygon(o, holes)
    if not P.is_valid:
        P = P.buffer(0)
        if P.geom_type != 'Polygon':
            P = max(P.geoms, key=lambda g: g.area)
        o = [(round(x, 1), round(y, 1)) for x, y in P.exterior.coords][:-1]
        holes = [[(round(x, 1), round(y, 1)) for x, y in r.coords][:-1] for r in P.interiors]
    walls.append({'o': [list(p) for p in o], 'h': [[list(p) for p in h] for h in holes]})
    polys.append(Polygon(o, holes).buffer(0))
wallU = unary_union(polys)
print('walls', len(walls), 'vertices', sum(len(w['o']) for w in walls), '(was', sum(len(w['o']) for w in plan['walls']), ')')

# thin walls: the plan draws them as single light lines; find straight horizontal and vertical runs
from skimage.morphology import skeletonize
im = cv2.imread(W + 'bare.png', cv2.IMREAD_UNCHANGED)
Bc, Gc, Rc, Ac = [im[:, :, i].astype(np.int32) for i in range(4)]
lum = (Rc * 299 + Gc * 587 + Bc * 114) // 1000
sat = np.max(np.stack([Rc, Gc, Bc]), 0) - np.min(np.stack([Rc, Gc, Bc]), 0)
light = ((lum > 196) & (sat < 28) & (Ac > 250)).astype(np.uint8)
interior = Polygon(plan['interior']).buffer(-10)
blockU = unary_union([wallU] + [box(x, y, x + w, y + h) for x, y, w, h in plan['millwork']])
segs = []
for axis in ('H', 'V'):
    ker = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 1) if axis == 'H' else (1, 21))
    run = cv2.morphologyEx(light, cv2.MORPH_OPEN, ker)
    n, lab, st, _ = cv2.connectedComponentsWithStats(run, 8)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        L = w if axis == 'H' else h
        T = h if axis == 'H' else w
        if L < 24 or T > 9: continue
        segs.append([axis, x, y, w, h])
# merge parallel lines a few pixels apart (both faces of the same thin wall)
merged = []
used = [False] * len(segs)
for i, a in enumerate(segs):
    if used[i]: continue
    ax, x0, y0, w0, h0 = a
    X0, Y0, X1, Y1 = x0, y0, x0 + w0, y0 + h0
    for j in range(i + 1, len(segs)):
        b = segs[j]
        if used[j] or b[0] != ax: continue
        _, x1, y1, w1, h1 = b
        if ax == 'H':
            if abs(y1 - Y0) <= 9 and min(X1, x1 + w1) - max(X0, x1) > 0.6 * min(w1, X1 - X0):
                X0, X1, Y0, Y1 = min(X0, x1), max(X1, x1 + w1), min(Y0, y1), max(Y1, y1 + h1); used[j] = True
        else:
            if abs(x1 - X0) <= 9 and min(Y1, y1 + h1) - max(Y0, y1) > 0.6 * min(h1, Y1 - Y0):
                X0, X1, Y0, Y1 = min(X0, x1), max(X1, x1 + w1), min(Y0, y1), max(Y1, y1 + h1); used[j] = True
    used[i] = True
    merged.append((ax, float(X0), float(Y0), float(X1), float(Y1)))
wet = unary_union([Polygon(p['o']).buffer(0) for z in json.load(open('src/data/floors.json'))['zones'] if z['id'] == 'baths' for p in z['polys']])
# places where light lines are joinery, lift cars or vanity edges rather than walls
SKIP = unary_union([box(1268, 405, 1430, 575), box(1268, 720, 1430, 890), box(1478, 720, 1610, 890), box(1478, 440, 1612, 580),
                    box(1665, 250, 1725, 425), box(440, 30, 600, 90), box(2050, 30, 2110, 170), box(2050, 1180, 2110, 1300),
                    box(1690, 1300, 1760, 1340), box(1700, 1070, 1740, 1100), box(1640, 1035, 1700, 1100)])
keep = []
for ax, X0, Y0, X1, Y1 in merged:
    rect = box(X0, Y0, X1, Y1)
    if not interior.contains(rect.centroid): continue
    if SKIP.contains(rect.centroid): continue
    # skip outlines that run along a wall face
    face = rect.buffer(7, cap_style=2).difference(rect)
    if face.intersection(blockU).area / max(1, face.area) > 0.22: continue
    # an edge of a light object (vanity top, bath, counter) has light on one side
    if ax == 'H':
        sideA = light[int(max(0, Y0 - 7)):int(Y0 - 1), int(X0):int(X1)]; sideB = light[int(Y1 + 1):int(Y1 + 7), int(X0):int(X1)]
    else:
        sideA = light[int(Y0):int(Y1), int(max(0, X0 - 7)):int(X0 - 1)]; sideB = light[int(Y0):int(Y1), int(X1 + 1):int(X1 + 7)]
    if (sideA.size and sideA.mean() > 0.45) or (sideB.size and sideB.mean() > 0.45): continue
    if rect.intersection(wallU).area / max(1, rect.area) > 0.4: continue
    L = (X1 - X0) if ax == 'H' else (Y1 - Y0)
    T = max(6, (Y1 - Y0) if ax == 'H' else (X1 - X0))
    cx, cy = (X0 + X1) / 2, (Y0 + Y1) / 2
    kind = 'glass' if wet.contains(rect.centroid) and L < 95 else 'wall'
    keep.append({'c': [round(cx, 1), round(cy, 1)], 'l': round(L + 2, 1), 't': round(T, 1), 'a': 0 if ax == 'H' else 90, 'kind': kind})
print('thin walls', len(keep), {k: sum(1 for t in keep if t['kind'] == k) for k in ('wall', 'glass')})
plan['walls'] = walls
plan['thin'] = keep
# skirting: a 1 cm band round every wall face that is inside the home
inner = Polygon(plan['interior']).buffer(-2)
sk = wallU.buffer(0.75, join_style=2).difference(wallU).intersection(inner)
skirt = []
for g in (sk.geoms if hasattr(sk, 'geoms') else [sk]):
    if g.geom_type != 'Polygon' or g.area < 3: continue
    g = g.simplify(0.3)
    skirt.append({'o': [[round(x, 1), round(y, 1)] for x, y in g.exterior.coords][:-1], 'h': [[[round(x, 1), round(y, 1)] for x, y in r.coords][:-1] for r in g.interiors]})
plan['skirt'] = skirt
print('skirting pieces', len(skirt))
json.dump(plan, open('src/data/plan.json', 'w'), separators=(',', ':'))

vis = cv2.cvtColor(cv2.imread(W + 'bare.png'), cv2.COLOR_BGR2GRAY)
vis = cv2.cvtColor((vis * 0.4 + 140).astype(np.uint8), cv2.COLOR_GRAY2BGR)
for w in walls:
    cv2.fillPoly(vis, [np.array(w['o'], np.int32)], (60, 60, 200))
    for h in w['h']: cv2.fillPoly(vis, [np.array(h, np.int32)], (230, 230, 230))
col = {'wall': (40, 120, 200), 'glass': (200, 160, 40)}
for t in keep:
    bp = cv2.boxPoints(((t['c'][0], t['c'][1]), (t['l'], max(4, t['t'])), t['a'])); cv2.fillPoly(vis, [bp.astype(np.int32)], col[t['kind']])
cv2.imwrite(W + 'walls_regular.png', vis)
