# Renders the app icon on a 1.5x canvas (the Android adaptive-icon canvas: 108dp, of which the middle 72dp shows).
from PIL import Image, ImageDraw
import math, random, os, sys
OUTDIR=sys.argv[1]
S=2048; P=512; B=S+2*P   # big canvas 3072
OUT=(40,20,70)
def background():
    bg=Image.new('RGB',(B,B),(120,60,220)); d=ImageDraw.Draw(bg)
    cx,cy=B//2,P+int(S*0.50); n=20
    for i in range(n):
        a0=2*math.pi*i/n+0.1; a1=2*math.pi*(i+1)/n+0.1
        col=(140,70,235) if i%2 else (255,80,170); R=B*1.6
        d.polygon([(cx,cy),(cx+R*math.cos(a0),cy+R*math.sin(a0)),(cx+R*math.cos(a1),cy+R*math.sin(a1))],fill=col)
    d.ellipse([cx-760,cy-800,cx+760,cy+720],fill=(255,214,60),outline=OUT,width=28)
    d.ellipse([cx-640,cy-680,cx+640,cy+600],fill=(255,238,130))
    random.seed(7); gy=P+int(S*0.80); px=64
    for y in range(gy,B,px):
        for x in range(0,B,px):
            if y<gy+3*px: g=random.choice([(52,168,60),(64,186,70),(44,150,54),(76,200,80)])
            else: g=random.choice([(122,78,46),(108,66,38),(136,90,54),(96,58,34)])
            d.rectangle([x,y,x+px,y+px],fill=g)
    for x in range(0,B,px):
        if random.random()<0.5: d.rectangle([x,gy+3*px,x+px,gy+4*px],fill=(52,168,60))
    d.line([(0,gy),(B,gy)],fill=OUT,width=28)
    return bg
def foreground():
    ch=Image.new('RGBA',(B,B),(0,0,0,0)); c=ImageDraw.Draw(ch); W=30
    SK=(232,178,140); HA=(92,52,34); HA2=(70,38,24); BL=(40,98,214); BL2=(28,70,170); GO=(250,200,50)
    hx,hy=B//2,P+860; o=P
    c.rounded_rectangle([hx-470,o+1330,hx+470,B+600],radius=200,fill=BL,outline=OUT,width=W)
    c.rounded_rectangle([hx-700,o+1400,hx-440,B+600],radius=130,fill=BL,outline=OUT,width=W)
    c.rounded_rectangle([hx+440,o+1400,hx+700,B+600],radius=130,fill=BL,outline=OUT,width=W)
    c.rounded_rectangle([hx-250,o+1250,hx+250,o+1420],radius=80,fill=BL2,outline=OUT,width=W)
    for i in range(-5,6):
        x=hx+i*62; y=o+1470+int(110*(1-(i/5.5)**2))
        c.ellipse([x-24,y-24,x+24,y+24],fill=GO,outline=OUT,width=8)
    c.rectangle([hx+60,o+1700,hx+200,o+1820],fill=BL2)
    for sx in (-1,1):
        c.ellipse([hx+sx*500-190,hy-200,hx+sx*500+190,hy+180],fill=HA,outline=OUT,width=W)
    c.ellipse([hx-480,hy-470,hx+480,hy+470],fill=SK,outline=OUT,width=W)
    for x in range(-380,381,152):
        c.ellipse([hx+x-120,hy-330,hx+x+120,hy-90],fill=HA,outline=OUT,width=20)
    c.rounded_rectangle([hx-450,hy-330,hx+450,hy-190],radius=50,fill=HA2,outline=OUT,width=W)
    for sx in (-1,1):
        ex=hx+sx*190; ey=hy+10
        c.ellipse([ex-105,ey-125,ex+105,ey+125],fill=(255,255,255),outline=OUT,width=22)
        c.ellipse([ex-62+sx*12,ey-62,ex+62+sx*12,ey+82],fill=(40,30,50))
        c.ellipse([ex-40+sx*12,ey-50,ex+5+sx*12,ey-5],fill=(255,255,255))
    for sx in (-1,1):
        c.ellipse([hx+sx*330-80,hy+140,hx+sx*330+80,hy+250],fill=(255,130,150))
    c.ellipse([hx-60,hy+70,hx+60,hy+170],fill=HA)
    c.pieslice([hx-170,hy+90,hx+170,hy+380],20,160,fill=(120,30,50),outline=OUT,width=22)
    c.ellipse([hx-70,hy+290,hx+70,hy+390],fill=(255,110,130))
    ch=ch.rotate(8,resample=Image.BICUBIC,center=(hx,o+1400))
    d=ImageDraw.Draw(ch)
    def star(x,y,r,col):
        pts=[]
        for i in range(8):
            a=math.pi/4*i-math.pi/2; rr=r if i%2==0 else r*0.32
            pts.append((o+x+rr*math.cos(a),o+y+rr*math.sin(a)))
        d.polygon(pts,fill=col,outline=OUT,width=14)
    star(300,330,150,(255,255,255)); star(1760,420,110,(120,240,255)); star(1700,1180,80,(255,255,255)); star(260,1250,90,(120,240,255))
    gx,gy2=o+1690,o+1560
    d.polygon([(gx,gy2-170),(gx+140,gy2-40),(gx,gy2+170),(gx-140,gy2-40)],fill=(60,230,200),outline=OUT,width=22)
    d.polygon([(gx,gy2-170),(gx+140,gy2-40),(gx,gy2-40)],fill=(150,255,235))
    d.line([(gx-140,gy2-40),(gx+140,gy2-40)],fill=OUT,width=14)
    return ch
bg=background(); fg=foreground()
full=bg.convert('RGBA'); full.alpha_composite(fg)
sq=full.crop((P,P,P+S,P+S)).convert('RGB')
L=Image.LANCZOS
os.makedirs(OUTDIR,exist_ok=True)
sq.resize((512,512),L).save(os.path.join(OUTDIR,'icon-512.png'),optimize=True)
mask=Image.new('L',(S,S),0); ImageDraw.Draw(mask).ellipse([0,0,S-1,S-1],fill=255)
rnd=sq.convert('RGBA'); rnd.putalpha(mask)
for name,dp in (('mdpi',1),('hdpi',1.5),('xhdpi',2),('xxhdpi',3),('xxxhdpi',4)):
    d=os.path.join(OUTDIR,'android-res','mipmap-'+name); os.makedirs(d,exist_ok=True)
    a=int(48*dp); b=int(108*dp)
    sq.resize((a,a),L).save(os.path.join(d,'ic_launcher.png'),optimize=True)
    rnd.resize((a,a),L).save(os.path.join(d,'ic_launcher_round.png'),optimize=True)
    fg.resize((b,b),L).save(os.path.join(d,'ic_launcher_foreground.png'),optimize=True)
    bg.resize((b,b),L).save(os.path.join(d,'ic_launcher_background.png'),optimize=True)
d=os.path.join(OUTDIR,'android-res','mipmap-anydpi-v26'); os.makedirs(d,exist_ok=True)
xml='<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@mipmap/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n'
for n in ('ic_launcher.xml','ic_launcher_round.xml'): open(os.path.join(d,n),'w').write(xml)
# preview of the adaptive icon as a circle-masked phone would show it
prev=full.crop((P,P,P+S,P+S)); prev.putalpha(mask); prev.resize((256,256),L).save('/tmp/adaptive-preview.png')
