import json, numpy as np, cv2, collections
from PIL import Image, ImageDraw, ImageFont
S=json.load(open('hwfont/samples/index.json',encoding='utf-8'))['s']
def vec(f):
    m=255-cv2.imread(f,0); h,w=m.shape; s=max(h,w)
    c=np.zeros((s,s),np.uint8); c[(s-h)//2:(s-h)//2+h,(s-w)//2:(s-w)//2+w]=m
    v=cv2.GaussianBlur(cv2.resize(c,(32,32),interpolation=cv2.INTER_AREA).astype(float),(5,5),1.5).ravel()
    v-=v.mean(); n=np.linalg.norm(v); return v/n if n else v, (w/max(h,1))
import statistics
MEDL=statistics.median(x['line'][3]-x['line'][1] for L in S.values() for x in L if x['sat']<=60)
best={}
for ch,L in S.items():
    def good(x):
        X0,Y0,X1,Y1=x['ink']; w=X1-X0; h=Y1-Y0; bh=x['box'][3]-x['box'][1]; lh=x['line'][3]-x['line'][1]
        if x['sat']>60: return False
        if not (MEDL*0.75<=lh<=MEDL*1.3): return False
        bw=x['box'][2]-x['box'][0]
        if '가'<=ch<='힣': return 0.6*bh<=w<=1.3*bh and h>=0.6*bh and 0.8*bw<=w<=1.35*bw
        return True
    G=[x for x in L if good(x)]
    L=(G or L)[:150]
    V=[vec(x['f']) for x in L]
    M=np.array([v for v,_ in V])
    sim=M@M.T; np.fill_diagonal(sim,np.nan)
    score=np.nanmean(sim,1) if len(L)>1 else np.array([0.0])
    i=int(np.nanargmax(score)) if len(L)>1 else 0
    best[ch]=dict(L[i],n=len(L),cons=float(np.nanmax(score)) if len(L)>1 else 0.0)
json.dump(best,open('hwfont/best.json','w',encoding='utf-8'),ensure_ascii=False)
# 확인용 시트
items=sorted(best.items(),key=lambda kv:-kv[1]['n'])
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',16)
cols=16; cw,chh=70,90
for sh in range(0,len(items),cols*10):
    part=items[sh:sh+cols*10]; rows=(len(part)+cols-1)//cols
    img=Image.new('RGB',(cols*cw,rows*chh),'white'); dr=ImageDraw.Draw(img)
    for k,(ch,b) in enumerate(part):
        r,c=divmod(k,cols); g=Image.open(b['f']).convert('L'); g.thumbnail((60,56))
        img.paste(g,(c*cw+5,r*chh+4))
        col=(200,0,0) if b['n']<3 else (0,0,180)
        dr.text((c*cw+4,r*chh+64),f"{ch} {b['n']}",font=font,fill=col)
        dr.rectangle([c*cw,r*chh,c*cw+cw-1,r*chh+chh-1],outline=(220,220,220))
    img.save(f'hwfont/sheet{sh//(cols*10)}.png')
print(len(items))
