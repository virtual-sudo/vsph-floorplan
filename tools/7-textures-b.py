import numpy as np, cv2, os
from scipy.ndimage import gaussian_filter, map_coordinates
OUT='public/tex/'
N=1024
def tn(n,cx,cy,seed):
    r=np.random.default_rng(seed); g=r.random((cy,cx)).astype(np.float32); g=np.tile(g,(3,3))
    up=cv2.resize(g,(n*3,n*3),interpolation=cv2.INTER_CUBIC); return up[n:2*n,n:2*n]
def fbm(n,cx,cy,oct,seed,gain=0.5):
    s=np.zeros((n,n),np.float32);a=1;t=0
    for o in range(oct):
        x=cx*2**o;y=cy*2**o
        if x>n/2 or y>n/2: break
        s+=a*tn(n,x,y,seed*17+o);t+=a;a*=gain
    s/=t; return (s-s.min())/(s.max()-s.min()+1e-6)
def warp(f,dx,dy,amt):
    n=f.shape[0]; yy,xx=np.mgrid[0:n,0:n].astype(np.float32)
    return map_coordinates(f,[(yy+dy*amt)%n,(xx+dx*amt)%n],order=1,mode='wrap')
def mix(c1,c2,t): t=np.clip(t,0,1)[...,None]; return np.array(c1,np.float32)*(1-t)+np.array(c2,np.float32)*t
def save(name,img,q=88):
    cv2.imwrite(OUT+name+'.jpg',np.clip(img,0,255).astype(np.uint8)[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,q])
def nmap(h,s):
    gx=(np.roll(h,-1,1)-np.roll(h,1,1))*0.5; gy=(np.roll(h,-1,0)-np.roll(h,1,0))*0.5
    nx=-gx*s; ny=gy*s; nz=np.ones_like(nx); l=np.sqrt(nx*nx+ny*ny+nz*nz)
    return (np.stack([nx/l,ny/l,nz/l],-1)*0.5+0.5)*255

def marble(name,base,cloud2,veins,seed,scale=2,warpamt=180,rough=(0.12,0.3)):
    # veins: list of (colour, threshold, width, softness, opacity, octave scale)
    dx=fbm(N,scale,scale,6,seed+1)-0.5; dy=fbm(N,scale,scale,6,seed+2)-0.5
    cl=fbm(N,3,3,6,seed+3)
    col=mix(base,cloud2,gaussian_filter(cl,8,mode='wrap')*0.9)
    acc=np.zeros((N,N),np.float32)
    for k,(vc,th,wd,soft,op,sc) in enumerate(veins):
        f=fbm(N,sc,sc,7,seed+10+k)
        f=warp(f,dx,dy,warpamt)
        d=np.abs(f-th)
        line=np.exp(-(d/wd)**2)
        if soft>0: line=np.maximum(line*0.85,gaussian_filter(line,soft,mode='wrap')*1.6)
        line=np.clip(line,0,1)
        # break up the vein intensity along its length
        line*= (0.45+0.75*fbm(N,6,6,4,seed+40+k))
        col=mix(col,vc,line*op); acc=np.maximum(acc,line*op)
    col*= (0.97+0.05*fbm(N,96,96,2,seed+60))[...,None]
    save('marble_'+name,col)
    r=rough[0]+(rough[1]-rough[0])*acc
    save('marble_'+name+'_r',np.stack([r*255]*3,-1))
MARB=0
if MARB: marble('calacatta',(238,236,232),(226,222,216),[((150,146,140),0.5,0.012,6,0.9,2),((110,106,100),0.52,0.004,0,0.9,2),((180,176,170),0.35,0.006,3,0.6,4),((196,192,186),0.7,0.004,2,0.5,5)],seed=3)
if MARB: marble('taj',(222,212,196),(204,190,170),[((150,122,92),0.5,0.03,8,0.8,2),((110,88,68),0.48,0.006,0,0.8,2),((176,156,128),0.3,0.012,4,0.6,3),((236,230,220),0.7,0.01,3,0.7,4)],seed=11)
if MARB: marble('nero',(30,30,32),(20,20,22),[((210,210,206),0.5,0.004,0,0.9,2),((150,150,148),0.42,0.006,3,0.6,3),((235,235,230),0.62,0.002,0,0.8,4)],seed=21,rough=(0.08,0.2))
if MARB: marble('verde',(36,64,52),(24,44,36),[((190,206,190),0.5,0.005,0,0.85,3),((96,130,112),0.4,0.02,6,0.7,2),((150,180,160),0.6,0.003,0,0.7,5)],seed=31)
if MARB: marble('patagonia',(206,194,176),(170,150,126),[((84,66,52),0.5,0.02,4,0.85,3),((236,228,214),0.4,0.03,6,0.8,2),((120,96,74),0.62,0.008,0,0.8,4),((60,50,44),0.3,0.006,0,0.7,5)],seed=41,warpamt=260)

# ---------- woods: anisotropic fibres + flat-sawn cathedral rings ----------
def wood(name,light,dark,seed,ring=7,fib=0.35,cath=1.0,rough=(0.35,0.55)):
    n=N; yy,xx=np.mgrid[0:n,0:n].astype(np.float32)/n
    # fibre streaks: long along y
    fibres=fbm(n,96,3,3,seed)*0.6+fbm(n,192,4,2,seed+1)*0.4
    lowf=fbm(n,2,1,4,seed+2)
    w=fbm(n,3,2,5,seed+3)
    # cathedral: rings of a cone cut -> distance from a wavy centre line, periodic in x
    cx=0.5+0.18*(w-0.5)
    d=np.abs(((xx-cx+0.5)%1.0)-0.5)
    rings=np.sin(2*np.pi*(d*ring*2+ (yy*0.9+0.4*lowf))*1.0 + 3*(fbm(n,8,2,4,seed+4)-0.5))*0.5+0.5
    rings=np.power(rings,3)
    straight=np.sin(2*np.pi*(xx*ring*3+0.6*(w-0.5)))*0.5+0.5
    pat=cath*rings+(1-cath)*np.power(straight,3)
    t=np.clip(0.55*pat+fib*(fibres-0.5)*2*0.5+0.25*(lowf-0.5)+0.35,0,1)
    col=mix(light,dark,t)
    col*= (0.95+0.08*fbm(n,4,2,3,seed+5))[...,None]
    pores=(fbm(n,256,8,2,seed+6)<0.3).astype(np.float32)*0.25
    col*= (1-pores*0.25)[...,None]
    save('wood_'+name,col)
    cv2.imwrite(OUT+'wood_'+name+'_n.jpg',nmap(t*0.8+fibres*0.8-pores,2.2)[:,:,::-1].astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,88])
wood('oak',(214,182,140),(166,128,88),51,ring=16)
wood('walnut',(128,90,64),(70,46,34),52,ring=18,cath=0.8)
wood('smoked',(132,116,104),(84,72,62),53,ring=16)
wood('ebony',(54,48,46),(26,23,22),54,ring=22,cath=0.4)
wood('teak',(176,124,80),(124,80,48),55,ring=14,cath=0.6)
wood('ash',(230,218,198),(194,174,146),56,ring=16)
print('ok')
