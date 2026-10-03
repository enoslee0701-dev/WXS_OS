import numpy as np
from PIL import Image, ImageFilter
W,H=780,640
rng=np.random.default_rng(7)
x=np.linspace(0,1,W); y=np.linspace(0,1,H)
X,Y=np.meshgrid(x,y)
def ridge(seed,base,amp,rough=0.55,oct=9,peaks=None):
    r=np.random.default_rng(seed); n=2**oct+1; a=np.zeros(n); a[0]=r.uniform(-1,1); a[-1]=r.uniform(-1,1)
    step=n-1; s=1.0
    while step>1:
        h=step//2
        for i in range(h,n-1,step): a[i]=(a[i-h]+a[i+h])/2+r.uniform(-s,s)
        s*=rough; step=h
    a=np.interp(np.linspace(0,n-1,W),np.arange(n),a)
    out=base+amp*a
    if peaks is not None:
        for px,ph,pw in peaks: out=out-ph*np.exp(-((x-px)/pw)**2)
    return out
# sky
sun=(0.84,0.22)
d=np.sqrt(((X-sun[0])*1.2)**2+((Y-sun[1]))**2)
top=np.array([168,182,200]); mid=np.array([214,205,200]); warm=np.array([250,214,166])
t=np.clip(Y/0.45,0,1)[...,None]
sky=top*(1-t)+mid*t
glow=np.exp(-d*3.2)[...,None]
sky=sky*(1-glow*0.85)+warm*glow*0.85
core=np.exp(-d*18)[...,None]; sky=sky*(1-core)+np.array([255,246,225])*core
img=sky.copy()
def fbm(seed,oct=5):
    r=np.random.default_rng(seed); acc=np.zeros((H,W)); amp=1; tot=0
    for o in range(oct):
        gh,gw=4*2**o,6*2**o
        n=np.array(Image.fromarray((r.random((gh,gw))*255).astype(np.uint8)).resize((W,H),Image.BICUBIC))/255
        acc+=n*amp; tot+=amp; amp*=0.55
    return acc/tot
def layer(ry,col_top,col_bot,haze,rim=0.0,snow=0.0,tex=0.15,seed=0):
    global img
    mask=(Y*H>=ry[None,:]).astype(float)
    depth=np.clip((Y*H-ry[None,:])/120,0,1)[...,None]
    col=col_top*(1-depth)+col_bot*depth
    r=np.random.default_rng(seed)
    n=Image.fromarray((r.random((H//4,W//6))*255).astype(np.uint8)).resize((W,H),Image.BICUBIC)
    n=np.array(n)/255.0-0.5
    streak=np.array(Image.fromarray(((r.random((H//2,W//3)))*255).astype(np.uint8)).resize((W,H),Image.BICUBIC).filter(ImageFilter.GaussianBlur(1)))/255-0.5
    col=col*(1+tex*0.5*(n*0.7+streak*0.1))[...,None]
    hf=fbm(seed+50,4)
    sh=np.gradient(hf,axis=1)*W/6+np.gradient(hf,axis=0)*H/14
    col=col*(1+np.clip(sh,-1,1)[...,None]*tex*0.8)
    k=np.ones(15)/15; slope=np.convolve(np.gradient(ry),k,mode='same')
    lit=np.clip(-slope/3,0,1)[None,:]*np.exp(-np.clip(Y*H-ry[None,:],0,999)/18)
    lightsun=np.clip(1.2-np.abs(x-sun[0])*1.4,0.25,1)[None,:]
    col=col+ (np.array([255,190,120])*rim*(lit*lightsun)[...,None])
    if snow>0:
        sn=np.exp(-np.clip(Y*H-ry[None,:],0,999)/14)*snow*np.clip((300-ry[None,:])/80,0,1)*np.clip(hf*2.2-0.9,0,1)
        sn=sn*(0.6+0.8*(n+0.5))
        col=col*(1-sn[...,None])+np.array([236,232,236])*sn[...,None]
    col=col*(1-haze)+np.array([214,212,214])*haze
    m=mask[...,None]
    img=img*(1-m)+col*m
def fog(cy,th,a):
    global img
    r=np.random.default_rng(int(cy*99))
    n=np.array(Image.fromarray((r.random((12,30))*255).astype(np.uint8)).resize((W,H),Image.BICUBIC))/255
    f=np.exp(-((Y*H-cy)/th)**2)*a*(0.5+0.7*n)
    fc=np.array([236,226,220])*(1-glow*0.3)+np.array([255,226,190])*glow*0.3
    img=img*(1-f[...,None])+fc*f[...,None]
far=ridge(1,250,40,rough=0.62,peaks=[(0.48,95,0.05),(0.62,55,0.06),(0.2,40,0.07),(0.08,30,0.05)])
layer(far,np.array([150,154,178]),np.array([110,118,142]),0.3,rim=0.7,snow=0.55,tex=0.35,seed=1)
fog(300,28,0.55)
m1=ridge(2,330,35,peaks=[(0.3,40,0.08),(0.7,30,0.1)])
layer(m1,np.array([96,108,128]),np.array([70,82,100]),0.28,rim=0.6,tex=0.25,seed=2)
fog(372,24,0.5)
m2=ridge(3,400,45,rough=0.6,peaks=[(0.58,70,0.07),(0.75,40,0.06)])
layer(m2,np.array([78,82,92]),np.array([44,50,60]),0.12,rim=1.0,snow=0.15,tex=0.35,seed=3)
fog(455,22,0.35)
near=ridge(4,520,55,rough=0.62,peaks=[(0.55,95,0.08),(0.08,30,0.1)])
layer(near,np.array([92,86,84]),np.array([40,38,40]),0.04,rim=1.4,tex=0.45,seed=4)
# trees on near ridge
from PIL import ImageDraw
im=Image.fromarray(np.clip(img,0,255).astype(np.uint8))
dr=ImageDraw.Draw(im)
rt=np.random.default_rng(9)
for _ in range(38):
    tx=int(rt.choice([rt.uniform(0.25,0.42),rt.uniform(0.47,0.62),rt.uniform(0.0,0.12)])*W)
    ty=near[min(tx,W-1)]+rt.uniform(2,50)
    h=rt.uniform(16,40); w=h*0.32
    c=tuple(int(v) for v in rt.choice([[30,40,32],[40,52,36],[26,34,30],[56,62,40]]))
    for k in range(4):
        yy=ty-h+k*h/4; ww=w*(k+1)/4
        dr.polygon([(tx,yy-h/5),(tx-ww,yy+h/4),(tx+ww,yy+h/4)],fill=c)
img=np.array(im).astype(float)
# sun rays
ang=np.arctan2(Y-sun[1],(X-sun[0])*1.2)
rays=(np.sin(ang*18)*0.5+0.5)**4*np.exp(-d*2.6)*np.clip(Y-sun[1]+0.05,0,1)*0.6
img=img+np.array([255,215,160])*rays[...,None]*0.55
img=img+np.array([255,200,140])*glow*40/255*1.0
im=Image.fromarray(np.clip(img,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
im.save('hero.jpg',quality=74,optimize=True,progressive=True)
print(open('hero.jpg','rb').read().__len__())
