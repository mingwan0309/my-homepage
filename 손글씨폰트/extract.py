import fitz, numpy as np, cv2, os, json, sys, collections
SRC=sys.argv[1]; OUT=sys.argv[2]; os.makedirs(OUT,exist_ok=True)
Z=4.0
d=fitz.open(SRC)
def ok(ch):
    return ('가'<=ch<='힣') or ch.isdigit() or ('a'<=ch<='z') or ('A'<=ch<='Z') or ch in '+-=()<>,.?!√π%'
samples=collections.defaultdict(list)
for pno,p in enumerate(d):
    pix=p.get_pixmap(matrix=fitz.Matrix(Z,Z),alpha=False)
    im=np.frombuffer(pix.samples,np.uint8).reshape(pix.h,pix.w,3).astype(int)
    g=im.mean(2); sat=im.max(2)-im.min(2)
    ink=((g<150)|(sat>90)).astype(np.uint8)
    n,lab,st,cen=cv2.connectedComponentsWithStats(ink,8)
    rd=p.get_text('rawdict')
    chars=[]
    for b in rd['blocks']:
        for l in b.get('lines',[]):
            for s in l['spans']:
                for c in s['chars']:
                    if ok(c['c']): chars.append((c['c'],[v*Z for v in c['bbox']],[v*Z for v in l['bbox']]))
    # 컴포넌트 → 중심이 들어가는 글자칸에 배정
    owner=collections.defaultdict(list)
    for k in range(1,n):
        x,y,w,h,a=st[k]
        if a<6: continue
        cx,cy=cen[k]
        best=None
        for i,(c,(x0,y0,x1,y1),_lb) in enumerate(chars):
            if x0-2<=cx<=x1+2 and y0-2<=cy<=y1+2:
                area=(x1-x0)*(y1-y0)
                if best is None or area<best[0]: best=(area,i)
        if best: owner[best[1]].append(k)
    for i,ks in owner.items():
        c,(x0,y0,x1,y1),lb=chars[i]
        # 컴포넌트가 칸 밖으로 많이 삐져나가면(옆 글자와 붙음) 버림
        xs=[st[k][0] for k in ks]; ys=[st[k][1] for k in ks]
        X0=min(xs); Y0=min(ys); X1=max(st[k][0]+st[k][2] for k in ks); Y1=max(st[k][1]+st[k][3] for k in ks)
        bw,bh=x1-x0,y1-y0
        if (X1-X0)>bw*1.6+8 or (Y1-Y0)>bh*1.8+8: continue
        m=np.isin(lab[Y0:Y1,X0:X1],ks).astype(np.uint8)*255
        satv=float(sat[Y0:Y1,X0:X1][m>0].mean()) if m.any() else 255
        if m.sum()==0: continue
        fn=f'{OUT}/{ord(c):05x}_{pno}_{i}.png'
        cv2.imwrite(fn,255-m)
        samples[c].append(dict(f=fn,page=pno,box=[x0,y0,x1,y1],ink=[int(X0),int(Y0),int(X1),int(Y1)],line_h=bh,line=lb,sat=satv))
json.dump(samples,open(OUT+'/index.json','w',encoding='utf-8'),ensure_ascii=False)
cnt=collections.Counter({k:len(v) for k,v in samples.items()})
print('distinct',len(cnt),'total',sum(cnt.values()))
print(' '.join(f'{k}{v}' for k,v in cnt.most_common(60)))
