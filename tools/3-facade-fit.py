import cv2, numpy as np, json
im=cv2.imread('bare.png',cv2.IMREAD_UNCHANGED)
B,G,R,A=[im[:,:,i].astype(np.int32) for i in range(4)]
lum=(R*299+G*587+B*114)//1000
dark=((lum<50)&(A>250))
def fit_curve(x0,x1,y0,y1,step=12,deg=4):
    xs=[];ys=[]
    for x in range(x0,x1,step):
        col=dark[y0:y1,x:x+step]
        yy=np.nonzero(col)[0]
        if len(yy)>3:
            xs.append(x+step/2); ys.append(np.median(yy)+y0)
    xs=np.array(xs); ys=np.array(ys)
    p=np.polyfit(xs,ys,deg)
    res=ys-np.polyval(p,xs)
    keep=np.abs(res)<6
    p=np.polyfit(xs[keep],ys[keep],deg)
    print('fit',x0,x1,'n',len(xs),'resid',np.abs(ys[keep]-np.polyval(p,xs[keep])).max())
    return p
out={}
pt=fit_curve(185,1040,10,110)
pb=fit_curve(185,1040,1240,1345)
prt=fit_curve(1310,2170,5,110)
prb=fit_curve(1310,2170,1240,1345)
for nm,p,(a,b) in [('LT',pt,(176,1046)),('LB',pb,(176,1046)),('RT',prt,(1300,2178)),('RB',prb,(1300,2178))]:
    xs=np.linspace(a,b,40)
    out[nm]=[[round(float(x),1),round(float(np.polyval(p,x)),1)] for x in xs]
    print(nm,out[nm][0],out[nm][len(xs)//2],out[nm][-1])
# vertical lines: median x of dark pixels in bands
def vline(x0,x1,y0,y1):
    m=dark[y0:y1,x0:x1]; xx=np.nonzero(m)[1]
    return float(np.median(xx)+x0) if len(xx) else None
print('Lv', vline(160,195,80,560), vline(160,195,790,1270), 'L3', vline(205,235,600,750))
print('Rv', vline(2160,2195,240,420), vline(2160,2195,930,1190), 'R2', vline(2085,2115,530,820))
json.dump(out,open('glz_fit.json','w'))
