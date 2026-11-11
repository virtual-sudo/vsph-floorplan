# Floor finish zones in plan pixels -> src/data/floors.json (run from the project folder)
import json
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
plan=json.load(open('src/data/plan.json'))
slab=Polygon(plan['slab']).buffer(0); inter=Polygon(plan['interior']).buffer(0)
lobby=unary_union([Polygon([(1100,440),(1265,440),(1265,595),(1630,595),(1630,720),(1265,720),(1265,915),(1100,915)]),box(1478,455,1610,560)])
lift=unary_union([box(1268,405,1430,575),box(1268,720,1430,890),box(1478,720,1610,890)])
marble=unary_union([box(432,1000,605,1322),box(440,40,620,210),box(850,225,980,352),box(612,1130,730,1205)])
ledge=slab.difference(inter).intersection(box(1046,90,1300,216))
stone=unary_union([box(1300,55,1700,232),ledge])
lime=unary_union([box(1000,212,1700,335),box(1000,335,1250,440)])
oakl=unary_union([box(1690,0,2200,1356),box(1040,925,1310,1240),box(1310,1080,1700,1320),box(430,925,1100,1012)])
used=Polygon(); zones=[]
def take(zid,name,mat,geom,within):
    global used
    g=geom.intersection(within).difference(used).buffer(0); used=used.union(g); zones.append((zid,name,mat,g))
# earlier entries win where zones overlap
take('lift','Lift shafts','floor-dark',lift,inter)
take('lobby','Lift lobby','floor-herring',lobby,inter)
take('baths','Bathrooms','floor-marble',marble,inter)
take('service','Service areas','floor-stone',stone,slab)
take('hall','Entrance hall','floor-limestone',lime,inter)
take('living','Living wing','floor-oak-light',oakl,inter)
take('bedrooms','Bedroom wing','floor-oak-grey',inter,inter)
take('terraces','Terraces','floor-deck',slab,slab)
out=[]
for zid,name,mat,g in zones:
    polys=[]
    for p in (g.geoms if hasattr(g,'geoms') else [g]):
        if p.geom_type!='Polygon' or p.area<30: continue
        p=p.simplify(0.6)
        polys.append({'o':[[round(x,1),round(y,1)] for x,y in p.exterior.coords][:-1],'h':[[[round(x,1),round(y,1)] for x,y in r.coords][:-1] for r in p.interiors if Polygon(r).area>20]})
    out.append({'id':zid,'name':name,'mat':mat,'polys':polys,'area':round(g.area/58/58,1)})
json.dump({'zones':out},open('src/data/floors.json','w'),separators=(',',':'))
print('zones',[(z['id'],z['area']) for z in out])
