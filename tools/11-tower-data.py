# Tower and podium outlines for the building view -> src/data/tower.json (metres, x east, z south, tower centre at 0,0)
# Run from the project folder after 10-regularize-walls.py.
import json
from shapely.geometry import Polygon, box, Point
from shapely.ops import unary_union
from shapely import affinity
plan = json.load(open('src/data/plan.json'))
PPM, CX, CY = 58, 1178, 678
def m(poly):  # px polygon -> metres
    return affinity.scale(affinity.translate(poly, -CX, -CY), 1 / PPM, 1 / PPM, origin=(0, 0))
def coords(p, nd=3):
    return [[round(x, nd), round(y, nd)] for x, y in p.exterior.coords][:-1]
def rings(g):
    out = []
    for p in (g.geoms if hasattr(g, 'geoms') else [g]):
        if p.geom_type != 'Polygon' or p.area < 0.05: continue
        out.append({'o': coords(p), 'h': [[[round(x, 3), round(y, 3)] for x, y in r.coords][:-1] for r in p.interiors]})
    return out
slab = m(Polygon(plan['slab']).buffer(0))
interior = m(Polygon(plan['interior']).buffer(0))
walls = [Polygon(w['o'], w['h']).buffer(0) for w in plan['walls']]
# lift and stair core: the central wall mass, clipped to the core zone
coreBox = box(1000, 236, 1705, 962)
core = unary_union([w.intersection(coreBox) for w in walls if w.intersects(coreBox) and w.area > 2000])
# amenity floors show the core as one solid block with the lift lobby cut in from the west
coreSolid = box(-3.1, -7.6, 8.7, 4.5).difference(box(-3.2, -1.45, 7.6, 0.75))
core = m(core.buffer(0.5).buffer(-0.5))
liftDoors = [[x, -1.45, 1] for x in (2.6, 5.6)] + [[x, 0.75, -1] for x in (2.6, 5.6)]
# structural columns: small wall pieces standing on the facade line
ib = Polygon(plan['interior']).exterior
def compact(w):
    x0, y0, x1, y1 = w.bounds
    return max(x1 - x0, y1 - y0) / max(1, min(x1 - x0, y1 - y0)) < 4.5
cols = unary_union([w for w in walls if w.area < 11000 and w.distance(ib) < 40 and not w.intersects(coreBox) and compact(w)])
cols = m(cols)
# podium: tower slab plus an eastern wing for the porte cochere below and the pool deck above
wing = box(14.0, -16.0, 46.0, 16.0)
west = box(-23.0, -15.0, 0.0, 15.0)
podium = unary_union([slab.buffer(1.2), wing, west]).buffer(6, join_style=1).buffer(-6, join_style=1)
podium = podium.simplify(0.05)
# glass line of the podium floors, 0.6 m in from the slab edge
podGlass = podium.buffer(-0.6, join_style=2)
# porte cochere void at ground level and the open loggia of the Residents' Club
porte = podium.intersection(box(21.0, -17.0, 47.0, 17.0)).buffer(-0.6, join_style=2)
gfGlass = podium.buffer(-0.6, join_style=2).difference(box(21.0, -17.0, 47.0, 17.0))
clubGlass = podGlass.intersection(box(-40, -40, 40.0, 40))
# amenity deck elements (floor 5, podium roof)
pool = Polygon([(22.5, 6.0), (43.5, 6.0), (43.5, 12.0), (22.5, 12.0)]).buffer(1.2, join_style=1).buffer(-1.2, join_style=1)
jacuzzi = Point(19.6, 13.2).buffer(1.6, 32)
lawn = Polygon([(37.0, -14.0), (44.6, -14.0), (44.6, 2.5), (40.0, 2.5)]).buffer(0.8, join_style=1).buffer(-0.8, join_style=1)
out = {
    'slab': coords(slab), 'interior': coords(interior),
    'core': rings(core), 'coreSolid': rings(coreSolid), 'columns': rings(cols),
    'podium': coords(podium), 'podiumGlass': coords(podGlass),
    'groundGlass': rings(gfGlass), 'porte': coords(porte), 'clubGlass': rings(clubGlass),
    'pool': coords(pool), 'jacuzzi': coords(jacuzzi), 'lawn': coords(lawn),
    'site': coords(box(-34, -26, 58, 30)), 'liftDoors': liftDoors
}
json.dump(out, open('src/data/tower.json', 'w'), separators=(',', ':'))
print('core solid m2', round(coreSolid.area), [round(v,1) for v in coreSolid.bounds])
print('slab m2', round(slab.area), 'interior m2', round(interior.area), 'core m2', round(core.area), 'columns', len(out['columns']))
print('podium m2', round(podium.area), 'bounds', [round(v, 1) for v in podium.bounds])
