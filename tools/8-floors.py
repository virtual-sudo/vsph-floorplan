# Tileable floor finishes: oak planks (light, grey), herringbone, limestone and grey stone tiles, marble tiles, decking
import numpy as np, cv2, os
from scipy.ndimage import gaussian_filter, map_coordinates
OUT='public/tex/'
N=2048
rng=np.random.default_rng(11)
def tn(n,cx,cy,seed):
    r=np.random.default_rng(seed); g=r.random((cy,cx)).astype(np.float32); g=np.tile(g,(3,3))
    return cv2.resize(g,(n*3,n*3),interpolation=cv2.INTER_CUBIC)[n:2*n,n:2*n]
def fbm(n,cx,cy,oct,seed,gain=0.5):
    s=np.zeros((n,n),np.float32);a=1;t=0
    for o in range(oct):
        x=cx*2**o;y=cy*2**o
        if x>n/2 or y>n/2: break
        s+=a*tn(n,x,y,seed*13+o);t+=a;a*=gain
    s/=t; return (s-s.min())/(s.max()-s.min()+1e-6)
def nmap(h,s):
    gx=(np.roll(h,-1,1)-np.roll(h,1,1))*0.5; gy=(np.roll(h,-1,0)-np.roll(h,1,0))*0.5
    nx=-gx*s; ny=gy*s; nz=np.ones_like(nx); l=np.sqrt(nx*nx+ny*ny+nz*nz)
    return (np.stack([nx/l,ny/l,nz/l],-1)*0.5+0.5)*255
def save(name,img,q=86):
    cv2.imwrite(OUT+name+'.jpg',np.clip(img,0,255).astype(np.uint8)[:,:,::-1] if img.ndim==3 else np.clip(img,0,255).astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,q])

# wood grain field (long along y), tileable
def grain(seed,n=N,ring=60):
    yy,xx=np.mgrid[0:n,0:n].astype(np.float32)/n
    w=fbm(n,4,1,5,seed); f1=fbm(n,160,3,3,seed+1); f2=fbm(n,320,5,2,seed+2)
    ph=2*np.pi*(xx*ring+1.2*(w-0.5)+0.15*(fbm(n,16,2,3,seed+3)-0.5))
    rings=(np.sin(ph)*0.5+0.5)**2
    return np.clip(0.45*rings+0.35*f1+0.2*f2,0,1)

def planks(name,light,dark,tile_m=2.4,pw=0.19,seed=1,gap_dark=0.72,var=0.10,rough=(0.42,0.6)):
    px=N/tile_m
    cols=int(round(tile_m/pw)); cw=N/cols
    g1=grain(seed); g2=grain(seed+50)
    alb=np.zeros((N,N,3),np.float32); h=np.ones((N,N),np.float32); rgh=np.zeros((N,N),np.float32)
    r=np.random.default_rng(seed)
    for c in range(cols):
        x0=int(round(c*cw)); x1=int(round((c+1)*cw))
        # plank joints down this column (wrap)
        y=r.random()*N; joints=[]
        acc=0
        while acc<N:
            L=(1.2+r.random()*1.2)*px
            joints.append((y+acc)%N); acc+=L
        joints=sorted(joints)
        bounds=joints+[joints[0]+N]
        for j in range(len(joints)):
            a=bounds[j]; b=bounds[j+1]
            tone=r.random(); shift=r.integers(0,N)
            base=np.array(light,np.float32)*(1-tone*0.5)+np.array(dark,np.float32)*(tone*0.5)
            base*=1+(r.random()-0.5)*var
            src=g1 if r.random()<0.5 else g2
            ys=(np.arange(int(a),int(b))%N)
            col=np.roll(src[:,x0:x1],shift,axis=0)[ys]
            t=col[...,None]
            alb[ys,x0:x1]=base*(1.08-0.28*t)
            rgh[ys,x0:x1]=rough[0]+(rough[1]-rough[0])*(0.3+0.4*r.random())+0.08*col
            # end joint
            ya=int(a)%N
            for k in range(-2,2): h[(ya+k)%N,x0:x1]=0.0 if abs(k)<1 else 0.45
        h[:,x0:min(x0+2,N)]=0.0
        if x0>0: h[:,x0-1]=0.45
    seam=gaussian_filter(h,0.8,mode='wrap')
    alb*=(gap_dark+(1-gap_dark)*seam)[...,None]
    save('floor_'+name,alb)
    save('floor_'+name+'_n',nmap(seam*3+0.6*(g1),1.6))
    save('floor_'+name+'_r',np.stack([rgh*255]*3,-1))

def herringbone(name,light,dark,seed=3,k=5,W=0.09,m=2):
    # 90 degree herringbone, boards k*W by W; lattice (1,1),(k,-k) in board-width units; tile = 2*k*m widths
    T=2*k*m; tile=T*W
    r=np.random.default_rng(seed)
    yy,xx=np.mgrid[0:N,0:N].astype(np.float32)*(T/N)
    best=np.full((N,N),-1,np.int64); lu=np.zeros((N,N),np.float32); lv=np.zeros((N,N),np.float32); vert=np.zeros((N,N),bool)
    a0=np.floor((xx+yy)/2).astype(np.int64); b0=np.floor((xx-yy)/(2*k)).astype(np.int64)
    for da in range(-k-1,k+2):
        for db in (-1,0,1):
            a=a0+da; b=b0+db
            ox=a+b*k; oy=a-b*k
            px=xx-ox; py=yy-oy
            inH=(px>=0)&(px<k)&(py>=0)&(py<1)
            inV=(px>=k)&(px<k+1)&(py>=1-k)&(py<1)
            key=((a%(T))*1000+(b%(T)))*2
            sel=inH&(best<0); best[sel]=key[sel]; lu[sel]=px[sel]; lv[sel]=py[sel]
            sel=inV&(best<0); best[sel]=key[sel]+1; lu[sel]=py[sel]-(1-k); lv[sel]=px[sel]-k; vert[sel]=True
    ids,inv=np.unique(best,return_inverse=True); inv=inv.reshape(N,N)
    tone=r.random(len(ids)).astype(np.float32)[inv]
    g=grain(seed,ring=40)
    # grain along each board's length: sample grain by board-local coordinates
    gx=((lv*0.11+ (inv%97)/97.0)%1*N).astype(np.int32)%N; gy=((lu/k)*N*0.4+(inv%53)*37).astype(np.int32)%N
    gg=g[gy,gx]
    base=np.array(light,np.float32)[None,None]*(1-tone[...,None]*0.4)+np.array(dark,np.float32)[None,None]*(tone[...,None]*0.4)
    alb=base*(1.05-0.2*gg[...,None])
    edge=np.minimum(np.minimum(lu,k-lu)/k*k,np.minimum(lv,1-lv))
    seam=np.clip(edge/0.06,0,1)
    alb*=(0.62+0.38*seam)[...,None]
    save('floor_'+name,alb); save('floor_'+name+'_n',nmap(seam*2.5+0.3*gg,1.5))
    rg=0.38+0.14*gg; save('floor_'+name+'_r',np.stack([rg*255]*3,-1))
    return tile

def tiles(name,base,var,tw,th,tile_m,seed=5,grout=(150,146,140),gw=0.003,veins=False,rough=0.3):
    px=N/tile_m
    yy,xx=np.mgrid[0:N,0:N].astype(np.float32)/px
    r=np.random.default_rng(seed)
    cx=np.floor(xx/tw); cy=np.floor(yy/th)
    # stagger every other row by half for long tiles
    xx2=xx+np.where((cy%2)==1,tw/2 if th<tw*0.9 or tw<th*0.9 else 0,0)
    cx=np.floor(xx2/tw)%round(tile_m/tw)
    idx=(cx*997+cy*131).astype(np.int64)
    rv=(np.sin(idx*12.9898)*43758.5453)%1
    m1=fbm(N,6,6,6,seed); m2=fbm(N,40,40,3,seed+1)
    col=np.array(base,np.float32)[None,None]*(1+var*(rv[...,None]-0.5))*(0.94+0.1*m1[...,None])*(0.97+0.05*m2[...,None])
    if veins:
        dx=fbm(N,3,3,5,seed+2)-0.5; dy=fbm(N,3,3,5,seed+3)-0.5
        f=fbm(N,3,3,6,seed+4)
        yy2,xx2b=np.mgrid[0:N,0:N].astype(np.float32)
        f=map_coordinates(f,[(yy2+dy*220)%N,(xx2b+dx*220)%N],order=1,mode='wrap')
        v=np.exp(-((f-0.5)/0.012)**2)*(0.4+0.6*fbm(N,6,6,3,seed+5))
        v2=np.exp(-((f-0.32)/0.02)**2)*0.4
        col=col*(1-0.35*v[...,None])-0*v2[...,None]
        col=col*(1-0.12*v2[...,None])
    fx=(xx2/tw)%1; fy=(yy/th)%1
    gx=np.minimum(fx,1-fx)*tw; gy=np.minimum(fy,1-fy)*th
    gd=np.minimum(gx,gy)
    joint=np.clip(gd/gw,0,1)
    col=col*joint[...,None]+np.array(grout,np.float32)[None,None]*(1-joint[...,None])
    save('floor_'+name,col)
    hgt=joint*1.0+0.15*m2
    save('floor_'+name+'_n',nmap(gaussian_filter(hgt,0.7,mode='wrap'),2.0))
    rg=rough+0.08*m1+(1-joint)*0.4
    save('floor_'+name+'_r',np.stack([np.clip(rg,0,1)*255]*3,-1))

planks('oak_light',(214,200,182),(170,152,132),seed=1)
planks('oak_grey',(150,140,132),(98,90,86),seed=2,var=0.12)
t=herringbone('herring',(226,214,196),(186,170,150),seed=3)
print('herring tile',t)
tiles('limestone',(222,212,196),0.08,0.6,0.6,2.4,seed=7,grout=(176,168,156))
tiles('stone_grey',(150,150,152),0.10,0.6,1.2,2.4,seed=8,grout=(110,110,112),rough=0.45)
def marble_tiles():
    src=cv2.imread(OUT+'marble_calacatta.jpg')[:,:,::-1].astype(np.float32)
    src=cv2.resize(src,(N,N))
    tile=2.7; tw=0.9; px=N/tile; n=int(round(tile/tw)); cs=int(round(tw*px))
    out=np.zeros((N,N,3),np.float32); r=np.random.default_rng(31)
    for i in range(n):
        for j in range(n):
            sx=r.integers(0,N-cs); sy=r.integers(0,N-cs)
            blk=src[sy:sy+cs,sx:sx+cs]
            if r.random()<0.5: blk=blk[::-1]
            if r.random()<0.5: blk=blk[:,::-1]
            out[i*cs:(i+1)*cs,j*cs:(j+1)*cs]=blk[:min(cs,N-i*cs),:min(cs,N-j*cs)]*(0.97+0.06*r.random())
    yy,xx=np.mgrid[0:N,0:N].astype(np.float32)/px
    fx=(xx/tw)%1; fy=(yy/tw)%1; gd=np.minimum(np.minimum(fx,1-fx),np.minimum(fy,1-fy))*tw
    joint=np.clip(gd/0.0025,0,1)
    out=out*joint[...,None]+np.array((196,194,190),np.float32)*(1-joint[...,None])
    save('floor_marble',out); save('floor_marble_n',nmap(gaussian_filter(joint,0.7,mode='wrap'),2.0))
    save('floor_marble_r',np.stack([np.clip(0.16+(1-joint)*0.5,0,1)*255]*3,-1))
marble_tiles()
# decking: boards 0.14 wide with dark gaps
def decking():
    tile=2.24; px=N/tile; cols=16; cw=N/cols
    r=np.random.default_rng(21); g=grain(22,ring=50)
    alb=np.zeros((N,N,3),np.float32); h=np.ones((N,N),np.float32)
    for c in range(cols):
        x0=int(round(c*cw)); x1=int(round((c+1)*cw))
        tone=r.random(); base=np.array((132,126,120),np.float32)*(0.9+0.2*tone)
        alb[:,x0:x1]=base*(1.06-0.25*np.roll(g,r.integers(0,N),0)[:,x0:x1,None])
        h[:,x0:x0+int(0.006*px)]=0
        j=r.integers(0,N); h[j:j+3,x0:x1]=0.3
    seam=gaussian_filter(h,0.8,mode='wrap'); alb*=(0.35+0.65*seam)[...,None]
    save('floor_deck',alb); save('floor_deck_n',nmap(seam*4+0.5*g,1.6)); save('floor_deck_r',np.stack([(0.7-0.1*g)*255]*3,-1))
decking()
print('ok')
