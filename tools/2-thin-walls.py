import cv2, numpy as np
im=cv2.imread('bare.png',cv2.IMREAD_UNCHANGED)
B,G,R,A=[im[:,:,i].astype(np.int32) for i in range(4)]
lum=(R*299+G*587+B*114)//1000
sat=np.max(np.stack([R,G,B]),0)-np.min(np.stack([R,G,B]),0)
light=((lum>200)&(sat<25)&(A>250)).astype(np.uint8)*255
wall=cv2.imread('wall_clean.png',0)
cl=cv2.morphologyEx(light,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_RECT,(5,5)))
h=cv2.morphologyEx(cl,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(31,3)))
v=cv2.morphologyEx(cl,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(3,31)))
lines=cv2.bitwise_or(h,v)
vis=cv2.cvtColor(im[:,:,:3],cv2.COLOR_BGR2GRAY)
vis=cv2.cvtColor((vis*0.4+120).astype(np.uint8),cv2.COLOR_GRAY2BGR)
vis[light>0]=(0,160,255)
vis[lines>0]=(220,60,40)
vis[wall>0]=(40,40,220)
cv2.imwrite('light_vis.jpg',vis)
cv2.imwrite('thin_lines.png',lines)
cv2.imwrite('light_vis_s.jpg',cv2.resize(vis,(1178,678)))
