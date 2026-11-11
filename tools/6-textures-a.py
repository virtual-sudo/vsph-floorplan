# Procedural PBR textures for the Park Villas 3D plan (albedo + normal + roughness), all tileable
import numpy as np, cv2, os
from scipy.ndimage import gaussian_filter
OUT='public/tex/'
os.makedirs(OUT,exist_ok=True)
rng=np.random.default_rng(7)

def tile_noise(n,cells,seed):
    r=np.random.default_rng(seed)
    g=r.random((cells,cells)).astype(np.float32)
    g=np.tile(g,(3,3))
    up=cv2.resize(g,(n*3,n*3),interpolation=cv2.INTER_CUBIC)
    return up[n:2*n,n:2*n]
def fbm(n,base=4,oct=6,seed=0,gain=0.5):
    s=np.zeros((n,n),np.float32);a=1;t=0
    for o in range(oct):
        c=base*2**o
        if c>n: break
        s+=a*tile_noise(n,c,seed*31+o); t+=a; a*=gain
    s/=t
    return (s-s.min())/(s.max()-s.min()+1e-6)
def save(name,img,q=88):
    img=np.clip(img,0,255).astype(np.uint8)
    if img.ndim==3: img=img[:,:,::-1]
    cv2.imwrite(OUT+name+'.jpg',img,[cv2.IMWRITE_JPEG_QUALITY,q])
def normal_from_height(h,strength=2.0):
    gy,gx=np.gradient(h.astype(np.float32))
    nx=-gx*strength; ny=-gy*strength; nz=np.ones_like(nx)
    l=np.sqrt(nx*nx+ny*ny+nz*nz)
    n=np.stack([nx/l,ny/l,nz/l],-1)
    return (n*0.5+0.5)*255
def wrapgrad(h):
    # tileable gradient via roll
    gx=(np.roll(h,-1,1)-np.roll(h,1,1))*0.5; gy=(np.roll(h,-1,0)-np.roll(h,1,0))*0.5
    return gx,gy
def nmap(h,strength):
    gx,gy=wrapgrad(h.astype(np.float32))
    nx=-gx*strength; ny=gy*strength; nz=np.ones_like(nx)
    l=np.sqrt(nx*nx+ny*ny+nz*nz)
    return (np.stack([nx/l,ny/l,nz/l],-1)*0.5+0.5)*255
def mix(c1,c2,t):
    t=t[...,None]; return np.array(c1)*(1-t)+np.array(c2)*t

N=1024
yy,xx=np.mgrid[0:N,0:N].astype(np.float32)/N

# ---------- marbles ----------
def marble(name,base,vein,vein2,freq=3.0,warp=2.2,sharp=10,seed=1,angle=0.6,cloud=0.12,vein_amt=0.85,thin=0.0):
    w1=fbm(N,3,7,seed); w2=fbm(N,3,7,seed+5)
    u=(xx*np.cos(angle)+yy*np.sin(angle))
    # tileable: use periodic coordinate by sin of 2pi
    ph=2*np.pi*(np.round(freq*np.cos(angle))*xx+np.round(freq*np.sin(angle)+1)*yy)+warp*6.28*(w1-0.5)+warp*3*(w2-0.5)
    v=np.abs(np.sin(ph))
    veins=np.power(1-v,sharp)
    w3=fbm(N,6,7,seed+9)
    ph2=2*np.pi*(3*xx+2*yy)+9*(w3-0.5)+5*(w1-0.5)
    veins2=np.power(1-np.abs(np.sin(ph2)),28)*0.6
    cl=fbm(N,4,6,seed+3)
    col=np.array(base,np.float32)*(1-cloud+cloud*2*cl[...,None])
    col=mix(col,vein2,np.clip(veins2*vein_amt,0,1))
    col=mix(col,vein,np.clip(veins*vein_amt,0,1))
    fine=fbm(N,64,3,seed+11)
    col=col*(0.97+0.06*fine[...,None])
    save('marble_'+name,col)
    r=0.18+0.08*cl+0.1*veins
    save('marble_'+name+'_r',np.stack([r*255]*3,-1))
marble('calacatta',(236,233,228),(120,118,116),(170,165,160),freq=2,warp=1.6,sharp=14,seed=2,cloud=0.06)
marble('taj',(214,203,188),(118,96,78),(168,150,128),freq=3,warp=2.8,sharp=7,seed=4,cloud=0.16)
marble('nero',(28,28,30),(205,205,205),(120,120,122),freq=2,warp=2.0,sharp=22,seed=6,cloud=0.2,vein_amt=0.9)
marble('verde',(38,62,52),(196,210,196),(80,110,96),freq=3,warp=2.4,sharp=16,seed=8,cloud=0.3)
marble('patagonia',(200,190,172),(70,58,50),(140,120,96),freq=4,warp=3.6,sharp=4,seed=10,cloud=0.25,vein_amt=0.7)

# ---------- travertine ----------
def travertine(name,base,dark,seed=3):
    bands=fbm(N,4,6,seed)
    t=np.sin(2*np.pi*(yy*14)+6*(bands-0.5))*0.5+0.5
    pores=fbm(N,96,2,seed+2)
    pm=(pores<0.18).astype(np.float32)
    pm=gaussian_filter(pm,0.8,mode='wrap')
    col=mix(base,dark,np.clip(t*0.35+0.4*pm,0,1))
    col*=0.95+0.1*fbm(N,32,3,seed+4)[...,None]
    save(name,col)
    save(name+'_n',nmap(-pm*3+t*0.4,1.5))
travertine('travertine',(222,206,182),(176,156,130))

# ---------- woods ----------
def wood(name,light,dark,ring=34,seed=5,knots=0.0,rough=0.5,warp=0.6):
    g=fbm(N,3,6,seed); g2=fbm(N,8,5,seed+1)
    # long grain along v (y) direction; tileable sin pattern
    ph=2*np.pi*(xx*ring)+warp*12*(g-0.5)+3*(g2-0.5)
    rings=np.sin(ph)*0.5+0.5
    rings=np.power(rings,2.2)
    fib=fbm(N,64,3,seed+3)
    streak=cv2.resize(np.tile(rng.random((1,256)).astype(np.float32),(1,1)),(N,N),interpolation=cv2.INTER_CUBIC)
    t=np.clip(rings*0.7+0.18*fib+0.25*(streak-0.5),0,1)
    col=mix(light,dark,t)
    col*=0.94+0.12*fbm(N,4,4,seed+7)[...,None]
    save('wood_'+name,col)
    save('wood_'+name+'_n',nmap(t*1.0+fib*0.6,2.0))
wood('oak',(205,172,128),(150,112,72),ring=26,seed=5)
wood('walnut',(118,80,56),(62,40,28),ring=30,seed=9)
wood('smoked',(120,104,92),(70,60,54),ring=28,seed=12)
wood('ebony',(46,40,38),(22,19,18),ring=40,seed=14)
wood('teak',(168,116,72),(118,74,42),ring=22,seed=17)
wood('ash',(226,212,190),(184,164,134),ring=24,seed=19)

# ---------- fabric normal / detail maps (greyscale height -> normal) ----------
n=512
y5,x5=np.mgrid[0:n,0:n].astype(np.float32)/n
def tn(c,s): 
    r=np.random.default_rng(s); g=r.random((c,c)).astype(np.float32); g=np.tile(g,(3,3))
    return cv2.resize(g,(n*3,n*3),interpolation=cv2.INTER_CUBIC)[n:2*n,n:2*n]
# boucle: clumpy loops
bl=np.zeros((n,n),np.float32)
r=np.random.default_rng(21)
for i in range(4200):
    cx,cy=r.random()*n,r.random()*n; rad=2+r.random()*4
    cv2.circle(bl,(int(cx),int(cy)),int(rad),float(0.5+0.5*r.random()),-1,lineType=cv2.LINE_AA)
bl=np.maximum(bl,np.roll(bl,n//2,0)*0)  # keep
bl=gaussian_filter(bl,1.0,mode='wrap')+0.4*tn(64,22)
cv2.imwrite(OUT+'fab_boucle_n.jpg',nmap(bl,3.0)[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,90])
# linen weave
wv=(np.sin(2*np.pi*x5*96)*0.5+0.5)*(np.sin(2*np.pi*y5*96)>0)+(np.sin(2*np.pi*y5*96)*0.5+0.5)*(np.sin(2*np.pi*x5*96)<=0)
wv=wv+0.35*tn(128,23)+0.25*tn(16,24)
cv2.imwrite(OUT+'fab_linen_n.jpg',nmap(gaussian_filter(wv,0.6,mode='wrap'),1.4)[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,90])
# velvet: very soft, slight crush
vv=tn(16,25)*0.6+tn(64,26)*0.4
cv2.imwrite(OUT+'fab_velvet_n.jpg',nmap(vv,2.5)[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,90])
# leather grain
lg=tn(128,27)*0.6+tn(256,28)*0.4
lg=np.abs(lg-0.5)
cv2.imwrite(OUT+'leather_n.jpg',nmap(lg,4.0)[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,90])
# woven rattan / outdoor weave
rt=np.abs(np.sin(2*np.pi*(x5+y5)*40))*(np.sin(2*np.pi*(x5-y5)*40)>0)+np.abs(np.sin(2*np.pi*(x5-y5)*40))*(np.sin(2*np.pi*(x5+y5)*40)<=0)
cv2.imwrite(OUT+'weave_n.jpg',nmap(rt,2.0)[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,90])
# plaster
pl=tn(32,29)*0.5+tn(128,30)*0.3+tn(8,31)*0.2
cv2.imwrite(OUT+'plaster_n.jpg',nmap(pl,1.2)[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,90])
# brushed metal
bm=cv2.resize(np.random.default_rng(32).random((n,8)).astype(np.float32),(n,n),interpolation=cv2.INTER_LINEAR).T
bm=gaussian_filter(np.random.default_rng(33).random((n,n)).astype(np.float32),(0.5,12),mode='wrap')
cv2.imwrite(OUT+'brushed_n.jpg',nmap(bm,3.0)[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,90])
# foliage leaf texture (albedo, alpha in separate)
print('done',sorted(os.listdir(OUT)))
