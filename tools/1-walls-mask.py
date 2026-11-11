import cv2, numpy as np
im=cv2.imread('bare.png',cv2.IMREAD_UNCHANGED)
B,G,R,A=[im[:,:,i].astype(np.int32) for i in range(4)]
d=np.sqrt((R-154)**2+(G-151)**2+(B-134)**2)
wall=((d<16)&(A>200)).astype(np.uint8)*255
# light outlines adjacent to walls
lum=(R*299+G*587+B*114)//1000
light=((lum>185)&(A>200)).astype(np.uint8)*255
k3=cv2.getStructuringElement(cv2.MORPH_RECT,(3,3))
k5=cv2.getStructuringElement(cv2.MORPH_RECT,(5,5))
w=cv2.morphologyEx(wall,cv2.MORPH_OPEN,k5)
# components
n,lab,st,_=cv2.connectedComponentsWithStats(w,8)
keep=np.zeros_like(w)
for i in range(1,n):
    if st[i,4]>=120: keep[lab==i]=255
# grow into adjacent light outline (up to 4px)
grow=keep.copy()
for _ in range(4):
    dil=cv2.dilate(grow,k3)
    grow=np.where((dil>0)&((light>0)|(wall>0)),255,grow).astype(np.uint8)
grow=cv2.morphologyEx(grow,cv2.MORPH_CLOSE,k3)
cv2.imwrite('wall_clean.png',grow)
vis=cv2.cvtColor(im[:,:,:3],cv2.COLOR_BGR2GRAY)
vis=cv2.cvtColor((vis*0.4+120).astype(np.uint8),cv2.COLOR_GRAY2BGR)
vis[grow>0]=(40,40,220)
cv2.imwrite('wall_vis.jpg',cv2.resize(vis,(1178,678)))
print(n, (grow>0).mean())
