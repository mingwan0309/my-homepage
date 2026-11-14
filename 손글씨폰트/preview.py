from PIL import Image,ImageDraw,ImageFont
from fontTools.ttLib import TTFont
cm=TTFont('hwfont/MinkwanHand.ttf').getBestCmap()
f=ImageFont.truetype('hwfont/MinkwanHand.ttf',60); fb=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',46)
lines=['풀이) 양변에 x=2를 대입하면','이차함수의 그래프와 직선의 교점','따라서 최솟값은 -3 이다','실근의 개수는 2개이므로','답: (4, 7)  a+b=10','집합 A의 원소의 개수를 구하면','두 점 사이의 거리는 같으므로','명제의 대우가 참이면 원래 명제도 참']
img=Image.new('RGB',(1200,92*len(lines)+20),'white');d=ImageDraw.Draw(img)
miss=0;tot=0
for i,t in enumerate(lines):
  x=20;y=15+i*92
  for ch in t:
    if ch!=' ': tot+=1
    if ord(ch) in cm or ch==' ': d.text((x,y),ch,font=f,fill='black'); x+=d.textlength(ch,font=f)
    else: miss+=1; d.text((x,y+10),ch,font=fb,fill=(200,0,0)); x+=d.textlength(ch,font=fb)
img.save('hwfont/preview.png'); print('missing',miss,'/',tot)
