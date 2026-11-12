import json, numpy as np, cv2, fitz, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
OUTTTF=sys.argv[1]
best=json.load(open('hwfont/best.json',encoding='utf-8'))
ACCEPT=set('''수 1 a 을 의 n 이 . 다 , 가 ( = ) 0 는 x 로 + A 를 o y 지 - 그 기 3 에 b 한 함 대 2 O 일 정 고 은 m t C 서 B 해 하 > 행 식 사 성 < 위 값 밍 g 점 각 인 선 두 건 l 으 4 P 실 π 과 근 래 있 주 최 라 곱 계 어 프 갈 방 반 동 부 나 도 K 진 등 면 만 경 T 6 시 렬 음 제 자 c 단 9 개 표 질 원 모 므 관 리 중 할 d 상 우 E 치 댓 용 미 직 증 교 분 든 밑 때 범 호 립 7 구 적 차 합 와 른 소 크 삼 공 조 8 거 없 또
현 된 e 환 통 측 칭 집 려 결 야 게 않 D 평 갖 되 말 것 포 입 억 J 드 산 확 법 문 체 q 꼴 칙 즉 세 록 키 재 항 유 셈 외 길 허 k 작 아 내 향 층 ! 듭 히 전 익 임 옮 특 복 생 ? 니 들 비 변 운 화 배 큼 p 터 절 풀 본 찰 택 학 여 며 w 경 장 명 육 처 감 깝 석 저 했 역 순 낸 군 쓰 덧 곳 짐 먼 신 바 던 혀
난 져 끼 황 채 접 받 번 네 연 홀 닌 써 담 뜻 십 빈 누 쳐 디 균 친 색 읽 떤 편 많 암 참 묶 겁 낼 잘 졌 높 꽂 숫
회 영 쓴 겹 엄 득 놓 숙 첨 테 칠 앞 잇 못 끝 책'''.split())
REJECT=set("""G F K 무 v 감 양 Y s L 행 여 며 나 평 자 칭 f C 판 π r 항 예 민 징 5 권 얇 증 른 히 연 출 매 재 h 검 닌 법 결 향 년 셔 존 능 ① 군 타 익 분 림 먹 런 멈 침 김 율 망 던 발 요 메 더 보 루 란 추 축 족 d 저 틈 틀 름 목 순 좌 R 차 됨 많 잡 명 당 련 찾 꾸 먼 신 D 글 릴 춤 형 태 u 디 뤄 퀴 피 솟 온 ⑤ 속 불 ! 술 창 령 첫 학 했 딩 급 끈 옷 둔 ② 뜻 맨 경 쓰 엔 스 설 뚜 밸 레 백 공 훈 완 벽 병 략 알 ③ 밀 탈 릿 남 길 맞 힘 철 욱 긴 헌 품 밤 손 Q 숨 눈 초 월 헷 간 파 악 줏 코 쉽 천 마 몽 뀌 류 z 몇 찔 황""".split())
# 개수 2 이하 중 눈으로 확인한 좋은 글자만 허용
LOWOK=set("떤 번 즉 키 역 국 짝 편 담 트 갔 i 줄 곳 육 처 W 짓 난 균 끼 꼴 네 허 낸 써 암 넘 끔 빠 십 빈 혀 빨 째 머 짐 누 묶 져 겁 낼 석 잘 임 높 안 절 졌 둥 될 꽂 늦".split())
IDX=json.load(open('hwfont/samples/index.json',encoding='utf-8')); DOCS=[fitz.open(s) for s in IDX['srcs']]; Z=12; UPM=1000
glyphs={}; cmap={}; adv={}
names=['.notdef','space']
def contours_to_glyph(mask,box,Zs):
    # box: (x0,y0,x1,y1) 페이지 좌표*Zs  → em: 상단 880, 하단 -120
    x0,y0,x1,y1=box; h=y1-y0; s=1000.0/h
    cs,hier=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_NONE)
    pen=TTGlyphPen(None); xs=[]
    for c in cs:
        if len(c)<8: continue
        c=cv2.approxPolyDP(c,0.8,True).reshape(-1,2).astype(float)
        if len(c)<3: continue
        pts=[((px)*s,880-(py)*s) for px,py in c]
        xs+= [p[0] for p in pts]
        a=sum(pts[i][0]*pts[(i+1)%len(pts)][1]-pts[(i+1)%len(pts)][0]*pts[i][1] for i in range(len(pts)))
        # 바깥 윤곽: 시계방향(면적<0). cv2 RETR_CCOMP의 바깥/구멍은 방향이 반대라 면적 부호로 판단 → 바깥이 더 큰 면적이므로 아래에서 정리
        yield pts,a
    return
out={}; raw={}
import statistics as _st
_H=[x for c,L in IDX['s'].items() if '가'<=c<='힣' for x in L if x['sat']<=60]
TOP=_st.median((x['box'][1]-x['line'][1])/(x['line'][3]-x['line'][1]) for x in _H)
BOT=_st.median((x['line'][3]-x['box'][3])/(x['line'][3]-x['line'][1]) for x in _H)
print('TOP',TOP,'BOT',BOT)
for ch,b in best.items():
    if ch not in ACCEPT: continue
    p=DOCS[b['src']][b['page']]; Z0=4.0
    ln=[v/Z0 for v in b['line']]; bb=[v/Z0 for v in b['box']]
    if '가'<=ch<='힣': bx=bb
    else:
        lh=ln[3]-ln[1]; bx=[bb[0],ln[1]+TOP*lh,bb[2],ln[3]-BOT*lh]
    ik=[v/Z0 for v in b['ink']]
    clip=fitz.Rect(ik[0]-1,ik[1]-1,ik[2]+1,ik[3]+1)
    pix=p.get_pixmap(matrix=fitz.Matrix(Z,Z),clip=clip,alpha=False)
    im=np.frombuffer(pix.samples,np.uint8).reshape(pix.h,pix.w,3).astype(int)
    ink=(((im.mean(2)<150)|((im.max(2)-im.min(2))>90))).astype(np.uint8)
    # 원래 뽑힌 모양(저해상도)과 겹치는 덩어리만 남김
    small=255-cv2.imread(b['f'],0)
    big=cv2.resize(small,(0,0),fx=Z/Z0,fy=Z/Z0,interpolation=cv2.INTER_NEAREST)
    pad=np.zeros_like(ink); oy=int(round(Z*1)); ox=int(round(Z*1))
    hh=min(big.shape[0],pad.shape[0]-oy); ww=min(big.shape[1],pad.shape[1]-ox)
    pad[oy:oy+hh,ox:ox+ww]=big[:hh,:ww]>0
    pad=cv2.dilate(pad,np.ones((5,5),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(ink,8)
    keep=[k for k in range(1,n) if (pad[lab==k]).mean()>0.5]
    m=(np.isin(lab,keep)*255).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    # 좌표: 마스크 원점 = clip 좌상단. box 기준으로 옮김
    offx=(clip.x0-bx[0])*Z; offy=(clip.y0-bx[1])*Z
    H=(bx[3]-bx[1])*Z; s=1000.0/H
    cs,_=cv2.findContours(m,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_NONE)
    polys=[]
    for c in cs:
        if len(c)<8: continue
        c=cv2.approxPolyDP(c,1.0,True).reshape(-1,2).astype(float)
        if len(c)<3: continue
        polys.append([((px+offx)*s,880-(py+offy)*s) for px,py in c])
    if not polys: continue
    raw[ch]=polys
    continue
    minx=min(x for P in polys for x,_ in P); maxx=max(x for P in polys for x,_ in P)
    lsb=50
    polys=[[(x-minx+lsb,y) for x,y in P] for P in polys]
    def area(P): return sum(P[i][0]*P[(i+1)%len(P)][1]-P[(i+1)%len(P)][0]*P[i][1] for i in range(len(P)))/2
    # 포함 관계로 바깥/구멍 판단: 다른 다각형 안에 들어있는 횟수가 홀수면 구멍
    def inside(pt,P):
        x,y=pt;c=False;j=len(P)-1
        for i in range(len(P)):
            xi,yi=P[i];xj,yj=P[j]
            if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi+1e-9)+xi: c=not c
            j=i
        return c
    pen=TTGlyphPen(None)
    for i,P in enumerate(polys):
        depth=sum(1 for j,Q in enumerate(polys) if j!=i and inside(P[0],Q))
        hole=depth%2==1; a=area(P)
        if (not hole and a>0) or (hole and a<0): P=P[::-1]   # 바깥=시계방향
        pen.moveTo((round(P[0][0]),round(P[0][1])))
        for x,y in P[1:]: pen.lineTo((round(x),round(y)))
        pen.closePath()
    gname='uni%04X'%ord(ch)
    out[gname]=(ch,pen.glyph(),int(maxx-minx+2*lsb))
def SYM_BOX(ch):
    X=430; CAP=640; HC=330   # 소문자 높이 / 대문자·숫자 높이 / 기호 중심
    if ch in 'acemnorsuvwxzπ': return ('h',0,X)
    if ch in 'bdhklt': return ('h',0,CAP)
    if ch in 'gpqy': return ('h',-200,X)
    if ch=='j': return ('h',-200,CAP)
    if ch=='f': return ('h',0,CAP)
    if ch.isdigit() or ch.isupper() or ch in '?!': return ('h',0,CAP)
    if ch in '()': return ('h',-120,760)
    if ch=='.': return ('h',0,90)
    if ch==',': return ('h',-110,90)
    if ch in '-': return ('w',HC,300)
    if ch in '=': return ('w',HC,340)
    if ch in '+': return ('h',HC-170,HC+170)
    if ch in '<>': return ('h',HC-180,HC+180)
    return None
import statistics
hb=[min(y for P in v for _,y in P) for c,v in raw.items() if '가'<=c<='힣']
ht=[max(y for P in v for _,y in P) for c,v in raw.items() if '가'<=c<='힣']
B=statistics.median(hb); T=statistics.median(ht); k=820.0/(T-B)
def area(P): return sum(P[i][0]*P[(i+1)%len(P)][1]-P[(i+1)%len(P)][0]*P[i][1] for i in range(len(P)))/2
def inside(pt,P):
    x,y=pt;c=False;j=len(P)-1
    for i in range(len(P)):
        xi,yi=P[i];xj,yj=P[j]
        if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi+1e-9)+xi: c=not c
        j=i
    return c
for ch,polys in raw.items():
    polys=[[(x*k,(y-B)*k-40) for x,y in P] for P in polys]
    if not ('가'<=ch<='힣'):
        ys=[y for P in polys for _,y in P]; xs=[x for P in polys for x,_ in P]
        y0,y1=min(ys),max(ys); x0,x1=min(xs),max(xs); h=max(y1-y0,1); w=max(x1-x0,1)
        tgt=SYM_BOX(ch)
        if tgt:
            mode,a,bb=tgt
            if mode=='h': s=(bb-a)/h; ny0=a
            else:  # 'w': 폭 기준, a=세로 중심, bb=폭
                s=bb/w; ny0=a-h*s/2
            polys=[[((x-x0)*s,(y-y0)*s+ny0) for x,y in P] for P in polys]
    minx=min(x for P in polys for x,_ in P); maxx=max(x for P in polys for x,_ in P)
    lsb=45 if '가'<=ch<='힣' else 40
    polys=[[(x-minx+lsb,y) for x,y in P] for P in polys]
    pen=TTGlyphPen(None)
    for i,P in enumerate(polys):
        depth=sum(1 for j,Q in enumerate(polys) if j!=i and inside(P[0],Q))
        hole=depth%2==1; a=area(P)
        if (not hole and a>0) or (hole and a<0): P=P[::-1]
        pen.moveTo((round(P[0][0]),round(P[0][1])))
        for x,y in P[1:]: pen.lineTo((round(x),round(y)))
        pen.closePath()
    out['uni%04X'%ord(ch)]=(ch,pen.glyph(),int(maxx-minx+2*lsb))
fb=FontBuilder(UPM,isTTF=True)
order=['.notdef','space']+sorted(out)
fb.setupGlyphOrder(order)
fb.setupCharacterMap({32:'space',**{ord(v[0]):k for k,v in out.items()}})
e=TTGlyphPen(None); 
gl={'.notdef':e.glyph(),'space':TTGlyphPen(None).glyph(),**{k:v[1] for k,v in out.items()}}
fb.setupGlyf(gl)
fb.setupHorizontalMetrics({'.notdef':(500,0),'space':(330,0),**{k:(v[2],50) for k,v in out.items()}})
fb.setupHorizontalHeader(ascent=900,descent=-200)
fb.setupNameTable({'familyName':'MinkwanHand','styleName':'Regular'})
fb.setupOS2(sTypoAscender=900,sTypoDescender=-200,usWinAscent=1000,usWinDescent=250)
fb.setupPost(); fb.save(OUTTTF)
print('glyphs',len(out)); print(''.join(sorted(v[0] for v in out.values())))
