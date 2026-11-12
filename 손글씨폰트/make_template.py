# 손글씨 양식지(A4 세로) PDF 만들기. 레이아웃 값은 layout.json에 저장 → 나중에 스캔본 읽을 때 같은 값 사용
import json
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('MG','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('SY','C:/Windows/Fonts/seguisym.ttf'))
cs=json.load(open('charset.json',encoding='utf-8'))
W,H=210,297
L=dict(page=[W,H], marker=6.0, mk_inset=7.0, cols=10, rows=12,
       gx0=14.0, gx1=196.0, gy0=24.0, gy1=286.0, label_h=5.0, baseline=0.80)
cw=(L['gx1']-L['gx0'])/L['cols']; ch=(L['gy1']-L['gy0'])/L['rows']
per=L['cols']*L['rows']; pages=(len(cs)+per-1)//per
L['pages']=pages
c=canvas.Canvas('손글씨_양식지.pdf',pagesize=(W*mm,H*mm))
def Y(y): return (H-y)*mm   # 위에서부터 mm → pdf 좌표
for p in range(pages):
    # 네 모서리 검은 사각형(스캔 정렬용)
    m=L['marker']; i=L['mk_inset']
    for (x,y) in [(i,i),(W-i-m,i),(i,H-i-m),(W-i-m,H-i-m)]:
        c.setFillColorRGB(0,0,0); c.rect(x*mm,Y(y+m),m*mm,m*mm,fill=1,stroke=0)
    # 페이지 번호 표시: 위 가운데 검은 칸 개수(1~)와 글자
    c.setFont('MG',10); c.setFillColorRGB(0,0,0)
    c.drawCentredString(W/2*mm,Y(12),f'김민관 손글씨 양식지  {p+1} / {pages} 쪽')
    c.setFont('MG',7); c.setFillColorRGB(.35,.35,.35)
    c.drawCentredString(W/2*mm,Y(17.5),'검은 펜으로, 칸 안 회색 점선 위에 평소 풀이 쓰듯 또박또박. 칸 밖으로 나가지 않게. 잘못 쓴 칸은 까맣게 칠하세요(그 글자는 빼고 만듭니다).')
    for k in range(per):
        idx=p*per+k
        r,cc=divmod(k,L['cols'])
        x0=L['gx0']+cc*cw; y0=L['gy0']+r*ch
        # 칸 테두리(연한 회색)
        c.setStrokeColorRGB(.72,.72,.72); c.setLineWidth(.4)
        c.rect(x0*mm,Y(y0+ch),cw*mm,ch*mm,stroke=1,fill=0)
        c.line(x0*mm,Y(y0+L['label_h']),(x0+cw)*mm,Y(y0+L['label_h']))
        if idx>=len(cs): continue
        g=cs[idx]
        c.setFillColorRGB(.25,.25,.25)
        c.setFont('SY' if g=='✓' else 'MG',8.5)
        c.drawString((x0+1.2)*mm,Y(y0+L['label_h']-1.3),g)
        c.setFont('MG',5); c.setFillColorRGB(.6,.6,.6)
        c.drawRightString((x0+cw-1)*mm,Y(y0+L['label_h']-1.4),str(idx+1))
        # 기준선(아주 연한 점선)
        by=y0+L['label_h']+(ch-L['label_h'])*L['baseline']
        c.setStrokeColorRGB(.85,.85,.85); c.setDash(1,1.5)
        c.line((x0+1)*mm,Y(by),(x0+cw-1)*mm,Y(by)); c.setDash()
    c.showPage()
c.save()
json.dump(L,open('layout.json','w'),indent=1)
print('pages',pages,'cell',round(cw,1),'x',round(ch,1),'mm')
