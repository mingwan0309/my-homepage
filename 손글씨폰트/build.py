import json, numpy as np, cv2, fitz, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
SRC=sys.argv[1]; OUTTTF=sys.argv[2]
best=json.load(open('hwfont/best.json',encoding='utf-8'))
ACCEPT=set('''수 a 의 이 , = ) 1 0 . ( 로 함 는 지 다 가 그 o y 대 기 2 g n - 에 3 m 를 고 을 x 은 한 서 일 > 점 선 곱 근 정 l 실 해 위 b 4 + < 성 값 으 밍 밑 식 용 O 계 있 진 증 라 인 래 소 프 과 9 제 t 방 최 평 두 등 치 상 건 각 단 직 음 부 어 만 범 미 나 시 응 면 w 관 질 동 칭 와 도 7 환 A 거 므 표 T P 교 할 리 8 행 구 듭 되 적 사 확 또 현 야 반 작 게 조 된 감 측 댓 장 문 않 옮 중 생 우 c
항 립 주 록 외 6 q 칙 말 개 오 호 원 N 운 통 모 합 여 것 없 ? 전 포 비 V 바 든 깝 집 새 러 르 재 유 니 들 활 셈 크 숫 큼 터 울 번 세 복 짝 홀 편 담 입 갖 변 체 곳 육 처 배 참 쳐 난 끼 량 풀 꼴 떤 키 네 연 역 념 허
국 순 낸 써 암 뜻 줄 십 빈 혀 빨 째 머 내 짐 누 짓 묶 져 겁 낼 석 잘 임 높 안 절 졌 둥 꽂 늦 끔 넘'''.split())
REJECT=set("""G F K 무 v 감 양 Y s L 행 여 며 나 평 자 칭 f C 판 π r 항 예 민 징 5 권 얇 증 른 히 연 출 매 재 h 검 닌 법 결 향 년 셔 존 능 ① 군 타 익 분 림 먹 런 멈 침 김 율 망 던 발 요 메 더 보 루 란 추 축 족 d 저 틈 틀 름 목 순 좌 R 차 됨 많 잡 명 당 련 찾 꾸 먼 신 D 글 릴 춤 형 태 u 디 뤄 퀴 피 솟 온 ⑤ 속 불 ! 술 창 령 첫 학 했 딩 급 끈 옷 둔 ② 뜻 맨 경 쓰 엔 스 설 뚜 밸 레 백 공 훈 완 벽 병 략 알 ③ 밀 탈 릿 남 길 맞 힘 철 욱 긴 헌 품 밤 손 Q 숨 눈 초 월 헷 간 파 악 줏 코 쉽 천 마 몽 뀌 류 z 몇 찔 황""".split())
# 개수 2 이하 중 눈으로 확인한 좋은 글자만 허용
LOWOK=set("떤 번 즉 키 역 국 짝 편 담 트 갔 i 줄 곳 육 처 W 짓 난 균 끼 꼴 네 허 낸 써 암 넘 끔 빠 십 빈 혀 빨 째 머 짐 누 묶 져 겁 낼 석 잘 임 높 안 절 졌 둥 될 꽂 늦".split())
d=fitz.open(SRC); Z=12; UPM=1000
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
_H=[x for c,L in json.load(open('hwfont/samples/index.json',encoding='utf-8')).items() if '가'<=c<='힣' for x in L if x['sat']<=60]
TOP=_st.median((x['box'][1]-x['line'][1])/(x['line'][3]-x['line'][1]) for x in _H)
BOT=_st.median((x['line'][3]-x['box'][3])/(x['line'][3]-x['line'][1]) for x in _H)
print('TOP',TOP,'BOT',BOT)
for ch,b in best.items():
    if ch not in ACCEPT: continue
    p=d[b['page']]; Z0=4.0
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
