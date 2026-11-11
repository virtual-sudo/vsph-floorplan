# Extract plan geometry from the Park Villas bare plan into plan.json (pixel units on the 2356 x 1356 plan)
import cv2, numpy as np, json, sys
from shapely.geometry import Polygon, LineString, Point, MultiPolygon
from shapely.ops import unary_union
W='work/'
im=cv2.imread(W+'bare.png',cv2.IMREAD_UNCHANGED)
Bc,Gc,Rc,Ac=[im[:,:,i].astype(np.int32) for i in range(4)]
H,Wd=Ac.shape
lum=(Rc*299+Gc*587+Bc*114)//1000
k3=cv2.getStructuringElement(cv2.MORPH_RECT,(3,3))
def rnd(pts): return [[round(float(x),1),round(float(y),1)] for x,y in pts]

# ---------- slab ----------
alpha=(Ac>128).astype(np.uint8)*255
cs,_=cv2.findContours(alpha,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
c=max(cs,key=cv2.contourArea)
slab=cv2.approxPolyDP(c,1.0,True)[:,0,:]
slabP=Polygon(slab).buffer(0)
print('slab pts',len(slab),'area m2',slabP.area/58/58)

# ---------- glazing ----------
fit=json.load(open(W+'glz_fit.json'))
LT,LB,RT,RB=fit['LT'],fit['LB'],fit['RT'],fit['RB']
glz=[]
def add(name,pts,kind='facade'): glz.append({'id':name,'kind':kind,'pts':rnd(pts)})
add('LT',LT); add('LB',LB); add('RT',RT); add('RB',RB)
add('Lw1',[(175,67),(175,585)]); add('Lw2',[(175,770),(176,1285)]); add('L3',[(219,592),(219,758)])
add('Rw1',[(2178,62),(2178,420)]); add('Rw2',[(2178,925),(2178,1287)]); add('R2',[(2101,522),(2101,828)])
add('Lc1',[(1046,91),(1046,130)]); add('Rc1',[(1300,87),(1300,130)])
add('Lc2',[(1046,1266),(1046,1228)]); add('Rc2',[(1300,1263),(1300,1228)])
add('Mb',[(1088,1228),(1268,1228)])
add('Mt',[(1090,216),(1268,216)],'slider'); add('Mm',[(1090,1137),(1268,1137)],'slider')

# interior polygon (inside the facade glass)
inter=[]
inter+=LT
inter+=[(1046,215),(1300,215)]
inter+=RT
inter+=[(2178,420),(2101,520),(2101,830),(2178,925)]
inter+=RB[::-1]
inter+=[(1300,1228),(1046,1228)]
inter+=LB[::-1]
inter+=[(175,770),(219,760),(219,590),(175,585)]
interP=Polygon(inter).buffer(0)
print('interior m2',interP.area/58/58)
balc=slabP.difference(interP.buffer(3))
balcs=[g for g in (balc.geoms if hasattr(balc,'geoms') else [balc]) if g.area>2000]
print('balconies',len(balcs),[round(b.area/58/58,1) for b in balcs])

# balustrade: slab outline segments that are far from the interior polygon
ring=list(slabP.exterior.coords)
bal=[];cur=[]
ib=interP.exterior
for p in ring:
    far=ib.distance(Point(p))>45
    if far: cur.append(p)
    else:
        if len(cur)>2: bal.append(cur)
        cur=[]
if len(cur)>2: bal.append(cur)
# merge first/last if contiguous
if len(bal)>1 and bal[0][0]==ring[0] and bal[-1][-1]==ring[-1]: bal[0]=bal[-1][:-1]+bal[0]; bal.pop()
print('balustrade runs',len(bal),[len(b) for b in bal])

# ---------- walls ----------
wall=cv2.imread(W+'wall_clean.png',0)
cs,hier=cv2.findContours(wall,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_NONE)
walls=[]
hier=hier[0]
for i,cc in enumerate(cs):
    if hier[i][3]!=-1: continue
    if cv2.contourArea(cc)<60: continue
    outer=cv2.approxPolyDP(cc,1.1,True)[:,0,:]
    holes=[]
    j=hier[i][2]
    while j!=-1:
        if cv2.contourArea(cs[j])>40:
            holes.append(rnd(cv2.approxPolyDP(cs[j],1.1,True)[:,0,:]))
        j=hier[j][0]
    if len(outer)>=3: walls.append({'o':rnd(outer),'h':holes})
print('walls',len(walls),sum(len(w['o']) for w in walls))

# ---------- thin partitions (light double lines) ----------
thin=cv2.imread(W+'thin_lines.png',0)
inner_ok=interP.buffer(-14)
wallP=unary_union([Polygon(w['o']).buffer(0) for w in walls])
n,lab,st,_=cv2.connectedComponentsWithStats(thin,8)
thins=[]
for i in range(1,n):
    x,y,w,h,a=st[i]
    if max(w,h)<26: continue
    ys,xs=np.nonzero(lab[y:y+h,x:x+w]==i)
    pts=np.stack([xs+x,ys+y],1).astype(np.float32)
    (cx,cy),(rw,rh),ang=cv2.minAreaRect(pts)
    L=max(rw,rh); T=min(rw,rh)
    if T>14: continue
    if not inner_ok.contains(Point(cx,cy)): continue
    seg=LineString([(x,y),(x+w,y+h)])
    box=Polygon(cv2.boxPoints(((cx,cy),(rw,rh),ang)))
    if box.area>0 and box.intersection(wallP).area/box.area>0.6: continue
    if rw<rh: ang+=90; 
    thins.append({'c':[round(float(cx),1),round(float(cy),1)],'l':round(float(L),1),'t':round(float(max(T,5)),1),'a':round(float(ang),1)})
print('thin',len(thins))

# ---------- millwork (wood boxes) ----------
mw=((Rc-Bc>45)&(Rc>150)&(Gc>110)&(Ac>250)).astype(np.uint8)*255
mw=cv2.morphologyEx(mw,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(7,7)))
n,lab,st,_=cv2.connectedComponentsWithStats(mw,8)
mill=[]
for i in range(1,n):
    x,y,w,h,a=st[i]
    if a<500 or a/(w*h)<0.8: continue
    if not interP.contains(Point(x+w/2,y+h/2)): continue
    mill.append([int(x),int(y),int(w),int(h)])
print('millwork',len(mill),mill)

# ---------- dark solid blocks (columns / shafts) ----------
dk=((lum<35)&(Ac>250)).astype(np.uint8)*255
dk=cv2.morphologyEx(dk,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(9,9)))
n,lab,st,_=cv2.connectedComponentsWithStats(dk,8)
dblk=[]
for i in range(1,n):
    x,y,w,h,a=st[i]
    if a<250 or a/(w*h)<0.7 or max(w,h)>80: continue
    dblk.append([int(x),int(y),int(w),int(h)])
print('dark blocks',dblk)

out={'px':[Wd,H],'ppm':58,'slab':rnd(slab),'interior':rnd(interP.exterior.coords),
     'balustrade':[rnd(b) for b in bal],
     'glazing':glz,'walls':walls,'thin':thins,'millwork':mill,'columns':dblk}
json.dump(out,open(W+'plan.json','w'),separators=(',',':'))
import os; print('bytes',os.path.getsize(W+'plan.json'))

# overlay
vis=cv2.cvtColor(im[:,:,:3],cv2.COLOR_BGR2GRAY)
vis=cv2.cvtColor((vis*0.35+140).astype(np.uint8),cv2.COLOR_GRAY2BGR)
for b in balcs: cv2.fillPoly(vis,[np.array(b.exterior.coords,np.int32)],(200,230,200))
for w in walls: cv2.fillPoly(vis,[np.array(w['o'],np.int32)],(60,60,200))
for w in walls:
    for h in w['h']: cv2.fillPoly(vis,[np.array(h,np.int32)],(235,235,235))
for t in thins:
    bp=cv2.boxPoints(((t['c'][0],t['c'][1]),(t['l'],t['t']),t['a'])); cv2.fillPoly(vis,[bp.astype(np.int32)],(200,60,200))
for m in mill: cv2.rectangle(vis,(m[0],m[1]),(m[0]+m[2],m[1]+m[3]),(40,140,230),-1)
for d in dblk: cv2.rectangle(vis,(d[0],d[1]),(d[0]+d[2],d[1]+d[3]),(0,0,0),-1)
for g in glz:
    cv2.polylines(vis,[np.array(g['pts'],np.int32)],False,(255,120,0) if g['kind']=='facade' else (0,200,255),3)
for b in bal: cv2.polylines(vis,[np.array(b,np.int32)],False,(0,160,0),3)
cv2.polylines(vis,[np.array(interP.exterior.coords,np.int32)],True,(255,0,255),1)
cv2.imwrite(W+'extract_vis.jpg',vis,[cv2.IMWRITE_JPEG_QUALITY,85])
cv2.imwrite(W+'extract_vis_s.jpg',cv2.resize(vis,(1600,921)))
