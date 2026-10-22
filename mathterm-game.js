/* =====================================================================
   공통수학2 용어 타자 (game.html 미니게임, gameKey: 'mathterm')
   - 가운데 그림(그래프/도형/벤다이어그램)이 회색으로 나와 있고, 아래 회색 용어를 치면
     글자가 자모 단위로 하얗게 채워지면서 그림도 같이 그려짐. 다 치면 반짝 + 다음 용어로 넘어감.
   - 입력 비교는 "키 입력 단위(자모)"로 함: 한글 조합 방식(폰/PC, 두벌식/천지인)이나 영문 상태로 쳐도
     같은 결과가 나오도록 화면 글자를 자모로 풀어서 비교함(겹모음 ㅘ→ㅗㅏ, 겹받침 ㄳ→ㄱㅅ).
   - 사용: MathTermGame.open({canChallenge, todayBest, attemptsLabel, onChallengeEnd(score)→Promise<{ok,msg}>, onClose})
   ===================================================================== */
(function(){
'use strict';

/* ---------- 한글 자모 ---------- */
var CHO=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
var JUNG=['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
var JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
var SPLIT={'ㅘ':'ㅗㅏ','ㅙ':'ㅗㅐ','ㅚ':'ㅗㅣ','ㅝ':'ㅜㅓ','ㅞ':'ㅜㅔ','ㅟ':'ㅜㅣ','ㅢ':'ㅡㅣ',
  'ㄳ':'ㄱㅅ','ㄵ':'ㄴㅈ','ㄶ':'ㄴㅎ','ㄺ':'ㄹㄱ','ㄻ':'ㄹㅁ','ㄼ':'ㄹㅂ','ㄽ':'ㄹㅅ','ㄾ':'ㄹㅌ','ㄿ':'ㄹㅍ','ㅀ':'ㄹㅎ','ㅄ':'ㅂㅅ'};
var JOIN={}; Object.keys(SPLIT).forEach(function(k){ JOIN[SPLIT[k]]=k; });
// 영문 상태로 쳐도 두벌식 자판 위치대로 인정
var LAT={q:'ㅂ',w:'ㅈ',e:'ㄷ',r:'ㄱ',t:'ㅅ',y:'ㅛ',u:'ㅕ',i:'ㅑ',o:'ㅐ',p:'ㅔ',a:'ㅁ',s:'ㄴ',d:'ㅇ',f:'ㄹ',g:'ㅎ',h:'ㅗ',j:'ㅓ',k:'ㅏ',l:'ㅣ',z:'ㅋ',x:'ㅌ',c:'ㅊ',v:'ㅍ',b:'ㅠ',n:'ㅜ',m:'ㅡ',
  Q:'ㅃ',W:'ㅉ',E:'ㄸ',R:'ㄲ',T:'ㅆ',O:'ㅒ',P:'ㅖ'};
var KEYOF={}; Object.keys(LAT).forEach(function(k){ KEYOF[LAT[k]]={k:k.toLowerCase(),shift:k!==k.toLowerCase()}; });

function splitJ(j){ return SPLIT[j]?SPLIT[j].split(''):[j]; }
function keysOfChar(c){
  var code=c.charCodeAt(0);
  if(code>=0xAC00 && code<=0xD7A3){
    var s=code-0xAC00, ci=Math.floor(s/588), vi=Math.floor((s%588)/28), fi=s%28;
    return [CHO[ci]].concat(splitJ(JUNG[vi]), fi?splitJ(JONG[fi]):[]);
  }
  if(/\s/.test(c)) return [];
  if(LAT[c]) return splitJ(LAT[c]);
  if(LAT[c.toLowerCase()]) return splitJ(LAT[c.toLowerCase()]);
  return splitJ(c);
}
function streamOf(str){ var out=[]; for(var i=0;i<str.length;i++){ var k=keysOfChar(str[i]); for(var j=0;j<k.length;j++) out.push(k[j]); } return out; }
function joinJ(arr){ if(!arr.length) return ''; if(arr.length===1) return arr[0]; return JOIN[arr.join('')]||arr[0]; }
function compose(c,v,f){ return String.fromCharCode(0xAC00+(CHO.indexOf(c)*21+JUNG.indexOf(v))*28+JONG.indexOf(f||'')); }

function buildTarget(term){
  var syls=[], keys=[];
  for(var i=0;i<term.length;i++){
    var ch=term[i];
    if(/\s/.test(ch)){ syls.push({ch:ch,space:true,start:keys.length,end:keys.length}); continue; }
    var code=ch.charCodeAt(0), s={ch:ch,start:keys.length,keys:keysOfChar(ch)};
    if(code>=0xAC00 && code<=0xD7A3){
      var o=code-0xAC00, vi=Math.floor((o%588)/28), fi=o%28;
      s.cho=CHO[Math.floor(o/588)]; s.jv=splitJ(JUNG[vi]); s.jf=fi?splitJ(JONG[fi]):[];
    }
    keys=keys.concat(s.keys); s.end=keys.length; syls.push(s);
  }
  return {syls:syls, keys:keys};
}
// 음절 안에서 k개 키까지 쳤을 때 보이는 글자 (예: '골'을 ㄱㅗ까지 → '고')
function partialChar(s,k){
  if(k<=0) return '';
  if(!s.cho) return s.ch;
  if(k===1) return s.cho;
  var vk=Math.min(k-1,s.jv.length), fk=k-1-vk;
  return compose(s.cho, joinJ(s.jv.slice(0,vk)), fk>0?joinJ(s.jf.slice(0,fk)):'');
}

/* ---------- 그림 (SVG) ---------- */
var W='#f8fafc', AX='#8193ad', CY='#67e8f9', AM='#fcd34d', PK='#f9a8d4', GR='#86efac', VI='#c4b5fd', RD='#fb7185';
var UID=0;
function rnd(n){ return Math.round(n*10)/10; }
function escX(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function Fig(){ this.it=[]; this.defs=''; this.id='mtf'+(++UID); this.n=0; }
var F=Fig.prototype;
F.X=function(x){ return 100+x*16; };
F.Y=function(y){ return 100-y*16; };
F.pt=function(x,y){ return rnd(this.X(x))+' '+rnd(this.Y(y)); };
F._s=function(d,o){ o=o||{}; this.it.push({k:'s',d:d,c:o.c||W,w:o.w||2.2,dash:!!o.dash}); return d; };
F.S=function(d,o){ return this._s(d,o); };
F.dL=function(x1,y1,x2,y2){ return 'M'+this.pt(x1,y1)+'L'+this.pt(x2,y2); };
F.dC=function(cx,cy,r){ return this.dE(cx,cy,r,r); };
F.dE=function(cx,cy,rx,ry){
  var x=this.X(cx), y=this.Y(cy), a=rnd(rx*16), b=rnd(ry*16);
  return 'M'+rnd(x-a)+' '+rnd(y)+'A'+a+' '+b+' 0 1 0 '+rnd(x+a)+' '+rnd(y)+'A'+a+' '+b+' 0 1 0 '+rnd(x-a)+' '+rnd(y);
};
F.dR=function(x1,y1,x2,y2){ return 'M'+this.pt(x1,y1)+'L'+this.pt(x2,y1)+'L'+this.pt(x2,y2)+'L'+this.pt(x1,y2)+'Z'; };
F.dFn=function(fn,a,b){
  var d='', pen=false, N=140;
  for(var i=0;i<=N;i++){
    var x=a+(b-a)*i/N, y=fn(x);
    if(!isFinite(y) || Math.abs(y)>5.8){ pen=false; continue; }
    d+=(pen?'L':'M')+this.pt(x,y); pen=true;
  }
  return d;
};
F.L=function(x1,y1,x2,y2,o){ return this._s(this.dL(x1,y1,x2,y2),o); };
F.C=function(cx,cy,r,o){ return this._s(this.dC(cx,cy,r),o); };
F.E=function(cx,cy,rx,ry,o){ return this._s(this.dE(cx,cy,rx,ry),o); };
F.R=function(x1,y1,x2,y2,o){ return this._s(this.dR(x1,y1,x2,y2),o); };
F.Fn=function(fn,a,b,o){ return this._s(this.dFn(fn,a,b),o); };
F.Poly=function(pts,o){
  var self=this, d=pts.map(function(p,i){ return (i?'L':'M')+self.pt(p[0],p[1]); }).join('')+(o&&o.close?'Z':'');
  return this._s(d,o);
};
F.head=function(x1,y1,x2,y2,h){
  var ang=Math.atan2(y2-y1,x2-x1), a1=ang+Math.PI*0.83, a2=ang-Math.PI*0.83;
  return 'M'+this.pt(x2+h*Math.cos(a1),y2+h*Math.sin(a1))+'L'+this.pt(x2,y2)+'L'+this.pt(x2+h*Math.cos(a2),y2+h*Math.sin(a2));
};
F.A=function(x1,y1,x2,y2,o){ var h=(o&&o.h)||0.36; return this._s(this.dL(x1,y1,x2,y2)+this.head(x1,y1,x2,y2,h),o); };
F.A2=function(x1,y1,x2,y2,o){ var h=(o&&o.h)||0.36; return this._s(this.dL(x1,y1,x2,y2)+this.head(x1,y1,x2,y2,h)+this.head(x2,y2,x1,y1,h),o); };
F.P=function(x,y,o){
  o=o||{};
  this.it.push({k:'p',x:this.X(x),y:this.Y(y),r:o.r||3.4,c:o.c||W,hollow:!!o.hollow});
  if(o.l) this.T(x,y,o.l,{dx:o.lx||0,dy:o.ly==null?-10:o.ly,c:o.lc||o.c||W,size:o.ls||10.5,a:o.la});
  return this;
};
F.T=function(x,y,s,o){
  o=o||{};
  this.it.push({k:'t',x:this.X(x)+(o.dx||0),y:this.Y(y)+(o.dy||0),s:s,c:o.c||'#e2e8f0',size:o.size||11,a:o.a||'middle',w:o.w||600,it:!!o.it});
  return this;
};
F.Ra=function(x,y,u,v,s,o){
  s=s||0.42;
  return this._s('M'+this.pt(x+u[0]*s,y+u[1]*s)+'L'+this.pt(x+u[0]*s+v[0]*s,y+u[1]*s+v[1]*s)+'L'+this.pt(x+v[0]*s,y+v[1]*s),{c:(o&&o.c)||'#cbd5e1',w:1.4});
};
// 칠하는 영역: inc(합쳐서 칠함) − exc(빼기) ∩ clip(모두와 겹치는 부분만)
F.Fill=function(o){
  var id=this.id+'_'+(this.n++), c=o.c||CY, defs='';
  defs+='<mask id="'+id+'m" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><rect width="200" height="200" fill="#000"/>'
    +(o.inc||[]).map(function(d){ return '<path d="'+d+'" fill="#fff"/>'; }).join('')
    +(o.exc||[]).map(function(d){ return '<path d="'+d+'" fill="#000"/>'; }).join('')+'</mask>';
  var inner='<rect width="200" height="200" fill="'+c+'"/>';
  (o.clip||[]).forEach(function(d,i){
    defs+='<clipPath id="'+id+'c'+i+'"><path d="'+d+'"/></clipPath>';
    inner='<g clip-path="url(#'+id+'c'+i+')">'+inner+'</g>';
  });
  this.defs+=defs;
  this.it.push({k:'f',html:'<g mask="url(#'+id+'m)">'+inner+'</g>',op:o.op||0.3});
};
F.ax=function(){
  this._s(this.dL(-5.5,0,5.5,0)+this.head(-5.5,0,5.5,0,0.3)+this.dL(0,-5.5,0,5.5)+this.head(0,-5.5,0,5.5,0.3),{c:AX,w:1.3});
  this.T(5.35,0,'x',{dy:11,size:10,c:AX,it:true});
  this.T(0,5.4,'y',{dx:9,size:10,c:AX,it:true});
  this.T(0,0,'O',{dx:-7,dy:10,size:9,c:AX});
};
F.U=function(){
  var d=this.R(-5,-3.7,5,3.7,{c:'#94a3b8',w:1.6});
  this.T(-4.55,3.2,'U',{a:'start',size:11,c:'#94a3b8',w:700});
  return d;
};
F.V2=function(){
  var u=this.U();
  var a=this.C(-1.25,0,2.35), b=this.C(1.25,0,2.35);
  this.T(-2,0,'A',{size:14,w:700}); this.T(2,0,'B',{size:14,w:700});
  return {U:u,A:a,B:b};
};
// 대응 그림(X → Y)
F.Map=function(o){
  var self=this, xc=-2.6, yc=2.6;
  function ys(n,i){ return ((n-1)/2-i)*1.45; }
  var dX=this.E(xc,0,1.45,3.05,{w:2}), dY=this.E(yc,0,1.45,3.05,{w:2});
  this.T(xc,3.65,o.xl||'X',{size:12,w:700,dy:-2}); this.T(yc,3.65,o.yl||'Y',{size:12,w:700,dy:-2});
  if(o.fx) this.Fill({inc:[dX],c:o.fx,op:0.22});
  if(o.fy) this.Fill({inc:[dY],c:o.fy,op:0.22});
  o.X.forEach(function(s,i){ var y=ys(o.X.length,i); self.P(xc+0.35,y,{r:3}); self.T(xc-0.35,y,s,{size:11,a:'end'}); });
  o.Y.forEach(function(s,i){
    var y=ys(o.Y.length,i), hit=o.hit&&o.hit.indexOf(i)>=0;
    self.P(yc-0.35,y,{r:hit?4:3,c:hit?CY:W}); self.T(yc+0.35,y,s,{size:11,a:'start',c:hit?CY:'#e2e8f0'});
  });
  if(o.hit && o.ring){
    var y1=ys(o.Y.length,Math.min.apply(null,o.hit)), y2=ys(o.Y.length,Math.max.apply(null,o.hit));
    this.E(yc,(y1+y2)/2,1.0,Math.abs(y1-y2)/2+0.62,{dash:true,c:AM,w:1.6});
  }
  o.arr.forEach(function(p,i){
    var y1=ys(o.X.length,p[0]), y2=ys(o.Y.length,p[1]);
    var c=o.hl==null?(o.ac||CY):(o.hl===i?AM:'#64748b');
    self.A(xc+0.62,y1,yc-0.66,y2,{c:c,w:o.hl===i?2.6:1.9,h:0.3});
  });
  this.T(0,3.3,'f',{size:13,it:true,c:o.ac||CY,w:700});
};

/* ---------- 용어 목록 ---------- */
var CH=['도형의 방정식','집합과 명제','함수'];
function venn(fill){ return function(g){ var v=g.V2(); fill(g,v); }; }
function sq(hl){ // 역·이·대우 관계 그림
  return function(g){
    var c1=W, cTR=hl==='역'?CY:'#cbd5e1', cBR=hl==='대우'?CY:'#cbd5e1';
    g.T(-2.9,2.6,'p → q',{size:13,w:700,c:c1});
    g.T(2.9,2.6,'q → p',{size:13,w:700,c:cTR});
    g.T(-2.9,-2.6,'~p → ~q',{size:12,w:700,c:'#cbd5e1'});
    g.T(2.9,-2.6,'~q → ~p',{size:12,w:700,c:cBR});
    g.A2(-1.0,2.6,1.0,2.6,{c:hl==='역'?CY:'#64748b',w:hl==='역'?2.8:1.8});
    g.A2(-2.9,1.8,-2.9,-1.8,{c:'#64748b',w:1.8});
    g.A2(-1.5,1.7,1.5,-1.7,{c:hl==='대우'?CY:'#64748b',w:hl==='대우'?2.8:1.8});
    g.T(0,2.6,'역',{dy:-12,size:11,c:hl==='역'?CY:'#94a3b8',w:700});
    g.T(-2.9,0,'이',{dx:-12,size:11,c:'#94a3b8',w:700});
    g.T(0.35,0.35,'대우',{dx:12,size:11,c:hl==='대우'?CY:'#94a3b8',w:700,a:'start'});
  };
}
var TERMS=[
/* ===== 도형의 방정식 ===== */
{t:'두 점 사이의 거리',ch:0,d:'두 점 A(x₁, y₁), B(x₂, y₂) 사이의 거리는 AB = √{(x₂−x₁)² + (y₂−y₁)²}',fig:function(g){
  g.ax(); g.L(-3,-2,3,-2,{dash:true,c:AX}); g.L(3,-2,3,2.5,{dash:true,c:AX}); g.Ra(3,-2,[-1,0],[0,1],0.4);
  g.L(-3,-2,3,2.5,{c:CY,w:2.8}); g.P(-3,-2,{l:'A',lx:-9,ly:10}); g.P(3,2.5,{l:'B',lx:9,ly:-6});
  g.T(-0.8,0.9,'d',{c:CY,size:15,w:800,it:true});
}},
{t:'내분점',ch:0,d:'선분 AB 위의 점 P가 AP : PB = m : n 이 되도록 선분을 안쪽에서 나누는 점',fig:function(g){
  g.L(-4,-1.5,1.333,0.5,{c:CY,w:3}); g.L(1.333,0.5,4,1.5,{c:AM,w:3});
  g.P(-4,-1.5,{l:'A',ly:16}); g.P(4,1.5,{l:'B',ly:-11}); g.P(1.333,0.5,{r:4.6,l:'P',ly:17});
  g.T(-1.4,-0.5,'m',{c:CY,size:14,dx:-8,dy:-12,it:true,w:700}); g.T(2.7,1.0,'n',{c:AM,size:14,dx:-8,dy:-12,it:true,w:700});
  g.T(0,-3.9,'AP : PB = m : n',{size:12,c:'#cbd5e1'});
}},
{t:'외분점',ch:0,d:'선분 AB의 연장선 위의 점 Q가 AQ : QB = m : n (m ≠ n) 이 되도록 바깥에서 나누는 점',fig:function(g){
  g.L(-4.5,-1,0.5,0.6,{w:2.6}); g.L(0.5,0.6,3,1.4,{dash:true,c:AM,w:2.2});
  g.L(-4.5,-2,3,0.4,{c:CY,w:1.6}); g.T(-0.8,-0.6,'m',{c:CY,size:13,dy:12,it:true,w:700});
  g.L(0.5,1.6,3,2.4,{c:AM,w:1.6}); g.T(1.75,2.0,'n',{c:AM,size:13,dy:-11,it:true,w:700});
  g.P(-4.5,-1,{l:'A',ly:-10}); g.P(0.5,0.6,{l:'B',ly:14}); g.P(3,1.4,{r:4.6,c:AM,l:'Q',ly:15});
  g.T(0,-3.9,'AQ : QB = m : n',{size:12,c:'#cbd5e1'});
}},
{t:'중점',ch:0,d:'선분 AB를 1 : 1로 내분하는 점. M( (x₁+x₂)/2 , (y₁+y₂)/2 )',fig:function(g){
  g.ax(); g.L(-4,-2,4,2,{w:2.6});
  g.S(g.dL(-2-0.15,-1+0.3,-2+0.15,-1-0.3)+g.dL(2-0.15,1+0.3,2+0.15,1-0.3),{c:CY,w:2});
  g.P(-4,-2,{l:'A',ly:14}); g.P(4,2,{l:'B',ly:-10}); g.P(0,0,{r:4.8,c:CY,l:'M',lx:10,ly:14});
  g.T(-2.6,3.6,'AM = MB',{size:12,c:CY,w:700});
}},
{t:'무게중심',ch:0,d:'삼각형의 세 중선이 만나는 점. 각 중선을 꼭짓점에서부터 2 : 1로 나눈다',fig:function(g){
  g.Poly([[-1,4],[-4,-3],[4,-2]],{close:true,w:2.5});
  g.L(-1,4,0,-2.5,{c:CY,w:1.6}); g.L(-4,-3,1.5,1,{c:CY,w:1.6}); g.L(4,-2,-2.5,0.5,{c:CY,w:1.6});
  g.P(-1,4,{l:'A',ly:-10}); g.P(-4,-3,{l:'B',lx:-11,ly:0}); g.P(4,-2,{l:'C',lx:11,ly:0});
  g.P(-0.333,-0.333,{r:5,c:AM,l:'G',lx:12,ly:-4});
  g.T(0,-4.6,'G( (x₁+x₂+x₃)/3 , (y₁+y₂+y₃)/3 )',{size:9.5,c:'#cbd5e1'});
}},
{t:'기울기',ch:0,d:'직선이 기울어진 정도. 기울기 = (y의 증가량) ÷ (x의 증가량)',fig:function(g){
  g.ax(); g.Fn(function(x){return 0.6*x+0.5;},-5,5,{c:CY,w:2.8});
  g.L(-2,-0.7,2,-0.7,{dash:true,c:AM,w:2}); g.L(2,-0.7,2,1.7,{dash:true,c:PK,w:2});
  g.P(-2,-0.7,{r:3}); g.P(2,1.7,{r:3});
  g.T(0,-0.7,'Δx',{dy:13,size:12,c:AM,w:700}); g.T(2,0.5,'Δy',{dx:15,size:12,c:PK,w:700});
  g.T(-4.6,4.4,'기울기 = Δy / Δx',{a:'start',size:11,c:'#e2e8f0',w:700});
}},
{t:'직선의 방정식',ch:0,d:'점 (x₁, y₁)을 지나고 기울기가 m인 직선은 y − y₁ = m(x − x₁)',fig:function(g){
  g.ax(); g.Fn(function(x){return -0.8*x+1.5;},-4.5,5,{c:CY,w:2.8});
  g.L(2.5,0,2.5,-0.5,{dash:true,c:AX}); g.L(0,-0.5,2.5,-0.5,{dash:true,c:AX});
  g.P(2.5,-0.5,{r:4.2,c:AM,l:'(x₁, y₁)',lx:14,ly:15,lc:AM});
  g.T(0.6,4.4,'y − y₁ = m(x − x₁)',{a:'start',size:11,w:700});
}},
{t:'평행',ch:0,d:'두 직선의 기울기가 같고 y절편이 다르면 두 직선은 서로 평행하다 (만나지 않는다)',fig:function(g){
  g.ax(); g.Fn(function(x){return 0.7*x+2;},-5,4.5,{w:2.6}); g.Fn(function(x){return 0.7*x-2;},-4,5,{c:CY,w:2.6});
  g.T(-4.3,-1,'l',{size:14,it:true,w:700}); g.T(3.7,-0.2,'l′',{size:14,it:true,w:700,c:CY});
  g.T(2.6,-4.4,'기울기가 같다',{size:11,c:AM,w:700});
}},
{t:'수직',ch:0,d:'두 직선이 수직으로 만나면 두 직선의 기울기의 곱은 −1 이다 (mm′ = −1)',fig:function(g){
  g.ax(); g.Fn(function(x){return 1.5*(x-1)+1;},-5,5,{w:2.6}); g.Fn(function(x){return -2/3*(x-1)+1;},-5,5,{c:CY,w:2.6});
  g.Ra(1,1,[0.5547,0.8321],[0.8321,-0.5547],0.5,{c:AM}); g.P(1,1,{r:3.4,c:AM});
  g.T(-4.6,4.4,'mm′ = −1',{a:'start',size:12,w:700,c:AM});
}},
{t:'점과 직선 사이의 거리',ch:0,d:'점 (x₁, y₁)과 직선 ax + by + c = 0 사이의 거리는 |ax₁ + by₁ + c| ÷ √(a² + b²)',fig:function(g){
  g.ax(); g.Fn(function(x){return 0.5*x-1;},-5,5,{w:2.6});
  g.L(-1.5,3,0.4,-0.8,{dash:true,c:CY,w:2.4}); g.Ra(0.4,-0.8,[0.894,0.447],[-0.447,0.894],0.42,{c:CY});
  g.P(-1.5,3,{r:4.4,c:AM,l:'P',lx:-10,ly:-6}); g.P(0.4,-0.8,{r:2.8,l:'H',lx:9,ly:13});
  g.T(-0.55,1.1,'d',{c:CY,size:15,dx:-12,w:800,it:true});
}},
{t:'원의 방정식',ch:0,d:'중심이 (a, b)이고 반지름이 r인 원은 (x − a)² + (y − b)² = r²',fig:function(g){
  g.ax(); g.C(1,1,3,{c:CY,w:2.8}); g.L(1,1,3.598,2.5,{c:AM,w:2.2});
  g.P(1,1,{r:3.6,l:'(a, b)',ly:15}); g.T(2.2,1.9,'r',{c:AM,size:15,dy:-8,w:800,it:true});
}},
{t:'접선',ch:0,d:'원과 한 점에서만 만나는 직선. 접점에서 그은 반지름과 수직이다',fig:function(g){
  g.C(-0.6,-0.6,2.6,{w:2.6}); g.L(4.207,-1.732,-1.732,4.207,{c:CY,w:2.8});
  g.L(-0.6,-0.6,1.238,1.238,{c:AM,w:2}); g.Ra(1.238,1.238,[-0.707,-0.707],[0.707,-0.707],0.45,{c:AM});
  g.P(-0.6,-0.6,{r:3}); g.P(1.238,1.238,{r:4.4,c:CY,l:'접점',lx:18,ly:-2,ls:11});
}},
{t:'할선',ch:0,d:'원과 서로 다른 두 점에서 만나는 직선. 원 안에 생기는 선분을 현이라고 한다',fig:function(g){
  g.C(0,0,3,{w:2.6}); g.Fn(function(x){return 0.4*x+1.2;},-5.2,5.2,{w:1.8,c:'#cbd5e1'});
  g.L(-2.9,0.04,2.172,2.069,{c:CY,w:3.6});
  g.P(-2.9,0.04,{r:4,c:AM}); g.P(2.172,2.069,{r:4,c:AM});
  g.T(-0.36,1.05,'현',{c:CY,size:13,dy:15,w:800});
}},
{t:'공통현',ch:0,d:'두 원이 서로 다른 두 점에서 만날 때, 두 교점을 이은 선분',fig:function(g){
  g.C(-1.3,0,2.6,{w:2.4}); g.C(1.5,0,2.4,{w:2.4,c:'#cbd5e1'});
  g.L(0.2786,2.066,0.2786,-2.066,{c:CY,w:3.4});
  g.P(0.2786,2.066,{r:4,c:AM}); g.P(0.2786,-2.066,{r:4,c:AM});
  g.T(0.28,-3.4,'공통현',{c:CY,size:12,w:800});
}},
{t:'평행이동',ch:0,d:'점 (x, y)를 x축 방향으로 a만큼, y축 방향으로 b만큼 옮기면 (x + a, y + b)',fig:function(g){
  g.ax(); g.Poly([[-4,-3],[-1.5,-3],[-3,-0.8]],{close:true,w:2.2});
  g.A(-2.3,-1.85,0.55,0.55,{c:AM,w:2.2,h:0.4});
  g.Poly([[0.2,0.4],[2.7,0.4],[1.2,2.6]],{close:true,c:CY,w:2.6});
  g.T(2.7,2.8,'(x+a, y+b)',{size:11,c:CY,w:700});
}},
{t:'대칭이동',ch:0,d:'x축 대칭: (x, y) → (x, −y)   y축 대칭: (x, y) → (−x, y)',fig:function(g){
  g.ax(); g.Poly([[1,1],[3.8,1.3],[2.2,3.6]],{close:true,w:2.4});
  g.L(2.2,3.6,2.2,-3.6,{dash:true,c:AX}); g.L(2.2,3.6,-2.2,3.6,{dash:true,c:AX});
  g.Poly([[1,-1],[3.8,-1.3],[2.2,-3.6]],{close:true,c:CY,w:2.6});
  g.Poly([[-1,1],[-3.8,1.3],[-2.2,3.6]],{close:true,c:PK,w:2.6});
  g.T(3.3,-4.6,'x축 대칭',{size:11,c:CY,w:700}); g.T(-3.1,4.6,'y축 대칭',{size:11,c:PK,w:700});
}},
{t:'원점대칭',ch:0,d:'원점에 대하여 대칭이동하면 (x, y) → (−x, −y)',fig:function(g){
  g.ax(); g.L(3,2,-3,-2,{dash:true,c:AX,w:1.8});
  g.P(3,2,{r:4.4,l:'P(x, y)',ly:-11}); g.P(0,0,{r:3,c:AM});
  g.P(-3,-2,{r:4.4,c:CY,l:'P′(−x, −y)',ly:17,lc:CY});
}},
/* ===== 집합과 명제 ===== */
{t:'집합',ch:1,d:'기준이 분명해서 그 대상을 명확하게 정할 수 있는 것들의 모임',fig:function(g){
  g.E(0,0,4.3,3.1,{w:2.4}); g.T(-3.6,3.0,'A',{size:14,w:800});
  [[-2,1,'1'],[0,1.7,'2'],[2.1,0.8,'3'],[-1.3,-1.2,'4'],[1.3,-1.4,'5']].forEach(function(p){ g.P(p[0],p[1],{r:3.4,c:CY,l:p[2],lc:'#e2e8f0'}); });
  g.T(0,-4.4,'A = {1, 2, 3, 4, 5}',{size:12,c:'#cbd5e1'});
}},
{t:'원소',ch:1,d:'집합을 이루는 대상 하나하나. a가 집합 A의 원소이면 a ∈ A',fig:function(g){
  g.E(0,0,4.3,3.1,{w:2.4}); g.T(-3.6,3.0,'A',{size:14,w:800});
  [[-2.2,1],[-0.3,1.9],[2.3,1.2],[-1.6,-1.4],[2,-1.3]].forEach(function(p){ g.P(p[0],p[1],{r:3,c:'#64748b'}); });
  g.P(0.4,-0.1,{r:6,c:AM,l:'a',ly:-13,ls:13});
  g.T(0,-4.4,'a ∈ A',{size:14,c:AM,w:800});
}},
{t:'공집합',ch:1,d:'원소가 하나도 없는 집합. 기호 ∅로 나타내고, 모든 집합의 부분집합이다',fig:function(g){
  g.E(0,0,4,3,{w:2.4}); g.T(0,0,'∅',{size:54,c:CY,w:300,dy:2}); g.T(0,-4.3,'원소 0개',{size:12,c:'#cbd5e1'});
}},
{t:'부분집합',ch:1,d:'집합 A의 모든 원소가 집합 B에 속할 때, A는 B의 부분집합 (A ⊂ B)',fig:function(g){
  g.E(0,0,4.6,3.5,{w:2.4}); g.T(3.4,2.9,'B',{size:14,w:800});
  var a=g.C(-1,-0.3,1.9,{c:CY,w:2.6}); g.T(-1,-0.3,'A',{size:14,w:800,c:CY});
  g.Fill({inc:[a],c:CY,op:0.28}); g.T(0,-4.4,'A ⊂ B',{size:14,c:CY,w:800});
}},
{t:'진부분집합',ch:1,d:'A ⊂ B 이고 A ≠ B 일 때, A를 B의 진부분집합이라고 한다',fig:function(g){
  g.E(0,0,4.6,3.5,{w:2.4}); g.T(3.4,2.9,'B',{size:14,w:800});
  var a=g.C(-1,-0.3,1.9,{c:CY,w:2.6}); g.T(-1,-0.3,'A',{size:14,w:800,c:CY});
  g.P(2.5,-0.2,{r:4.4,c:AM,l:'B에만',ly:15,ls:10}); g.Fill({inc:[a],c:CY,op:0.28});
  g.T(0,-4.4,'A ⊂ B , A ≠ B',{size:13,c:CY,w:800});
}},
{t:'합집합',ch:1,d:'A 또는 B에 속하는 원소 전체의 집합. A ∪ B',fig:venn(function(g,v){ g.Fill({inc:[v.A,v.B],c:CY,op:0.32}); g.T(0,-4.45,'A ∪ B',{size:14,c:CY,w:800}); })},
{t:'교집합',ch:1,d:'A와 B에 동시에 속하는 원소 전체의 집합. A ∩ B',fig:venn(function(g,v){ g.Fill({inc:[v.A],clip:[v.B],c:CY,op:0.42}); g.T(0,-4.45,'A ∩ B',{size:14,c:CY,w:800}); })},
{t:'차집합',ch:1,d:'A에는 속하지만 B에는 속하지 않는 원소 전체의 집합. A − B',fig:venn(function(g,v){ g.Fill({inc:[v.A],exc:[v.B],c:CY,op:0.4}); g.T(0,-4.45,'A − B',{size:14,c:CY,w:800}); })},
{t:'여집합',ch:1,d:'전체집합 U의 원소 중 A에 속하지 않는 원소 전체의 집합. Aᶜ = U − A',fig:function(g){
  var u=g.U(); var a=g.C(0,0,2.4); g.T(0,0,'A',{size:14,w:800});
  g.Fill({inc:[u],exc:[a],c:CY,op:0.3}); g.T(0,-4.45,'Aᶜ = U − A',{size:13,c:CY,w:800});
}},
{t:'서로소',ch:1,d:'두 집합에 공통인 원소가 하나도 없을 때. A ∩ B = ∅',fig:function(g){
  g.U(); var a=g.C(-2.3,0,1.9), b=g.C(2.3,0,1.9); g.T(-2.3,0,'A',{size:14,w:800}); g.T(2.3,0,'B',{size:14,w:800});
  g.Fill({inc:[a],c:CY,op:0.28}); g.Fill({inc:[b],c:PK,op:0.28}); g.T(0,-4.45,'A ∩ B = ∅',{size:13,c:AM,w:800});
}},
{t:'벤 다이어그램',ch:1,d:'집합 사이의 관계를 원이나 사각형 같은 도형으로 나타낸 그림',fig:function(g){
  g.U(); var a=g.C(-1.15,0.75,2.05,{c:CY}), b=g.C(1.15,0.75,2.05,{c:PK}), c=g.C(0,-1.2,2.05,{c:AM});
  g.T(-2,1.4,'A',{size:13,w:800,c:CY}); g.T(2,1.4,'B',{size:13,w:800,c:PK}); g.T(0,-2.3,'C',{size:13,w:800,c:AM});
  g.Fill({inc:[a],c:CY,op:0.18}); g.Fill({inc:[b],c:PK,op:0.18}); g.Fill({inc:[c],c:AM,op:0.18});
}},
{t:'드모르간의 법칙',ch:1,d:'(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ ,  (A ∩ B)ᶜ = Aᶜ ∪ Bᶜ',fig:venn(function(g,v){ g.Fill({inc:[v.U],exc:[v.A,v.B],c:CY,op:0.32}); g.T(0,-4.45,'(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ',{size:12,c:CY,w:800}); })},
{t:'명제',ch:1,d:'참인지 거짓인지를 분명하게 판별할 수 있는 문장이나 식',fig:function(g){
  g.R(-4.4,0.6,4.4,4.1,{w:2}); g.T(-0.8,2.35,'2 + 3 = 5',{size:16,w:700}); g.T(3.1,2.35,'참',{size:15,c:GR,w:800});
  g.R(-4.4,-3.9,4.4,-0.4,{w:2}); g.T(-0.9,-2.15,'√2는 유리수',{size:14,w:700}); g.T(3.1,-2.15,'거짓',{size:14,c:RD,w:800});
}},
{t:'조건',ch:1,d:'변수의 값에 따라 참이 되기도 하고 거짓이 되기도 하는 문장이나 식',fig:function(g){
  var t=''; for(var i=-4;i<=4;i++) t+=g.dL(i,0.18,i,-0.18);
  g.S(g.dL(-5.2,0,5.3,0)+g.head(-5.2,0,5.3,0,0.3)+t,{c:'#94a3b8',w:1.6});
  g.T(0,0,'0',{dy:15,size:11,c:'#94a3b8'}); g.T(2,0,'2',{dy:15,size:11,c:'#e2e8f0'});
  g.L(2,0,5,0,{c:CY,w:4.5}); g.P(2,0,{r:5,c:CY,hollow:true});
  g.T(0,2.6,'x > 2',{size:24,w:800,it:true});
  g.T(0,-2.6,'x = 3 이면 참,  x = 1 이면 거짓',{size:11,c:'#cbd5e1'});
}},
{t:'진리집합',ch:1,d:'전체집합 U의 원소 중 조건 p를 참이 되게 하는 원소 전체의 집합 P',fig:function(g){
  g.T(0,4.4,'p : x는 짝수',{size:12,w:700,c:AM}); g.U();
  var p=g.E(-1.2,-0.3,2.6,2.2,{c:CY,w:2.6}); g.T(-3.3,1.7,'P',{size:14,w:800,c:CY});
  [[-2.2,0.5,'2'],[-0.3,0.6,'4'],[-2,-1.2,'6'],[-0.2,-1.4,'8']].forEach(function(q){ g.P(q[0],q[1],{r:3.2,c:CY,l:q[2]}); });
  [[2.6,2.2,'1'],[3.5,0.2,'3'],[2.2,-1.6,'5'],[3.8,-2.7,'7']].forEach(function(q){ g.P(q[0],q[1],{r:3,c:'#64748b',l:q[2],lc:'#94a3b8'}); });
  g.Fill({inc:[p],c:CY,op:0.22});
}},
{t:'부정',ch:1,d:'조건 p에 대하여 ‘p가 아니다’를 p의 부정이라 하고 ~p로 나타낸다. 진리집합은 Pᶜ',fig:function(g){
  var u=g.U(); var p=g.C(0,0,2.3); g.T(0,0,'P',{size:14,w:800});
  g.Fill({inc:[u],exc:[p],c:PK,op:0.3}); g.T(3.4,-2.9,'~p',{size:15,c:PK,w:800});
  g.T(0,-4.45,'~p의 진리집합 = Pᶜ',{size:12,c:PK,w:800});
}},
{t:'역',ch:1,d:'명제 p → q 에서 가정과 결론을 서로 바꾼 명제 q → p',fig:sq('역')},
{t:'대우',ch:1,d:'명제 p → q 의 가정과 결론을 부정하고 서로 바꾼 명제 ~q → ~p. 원래 명제와 참·거짓이 항상 같다',fig:sq('대우')},
{t:'충분조건',ch:1,d:'명제 p → q 가 참일 때, p는 q이기 위한 충분조건 (P ⊂ Q)',fig:function(g){
  g.E(0,0,4.5,3.4,{w:2.4}); g.T(3.3,2.8,'Q',{size:14,w:800});
  var p=g.C(-0.9,-0.2,1.9,{c:CY,w:2.6}); g.T(-0.9,-0.2,'P',{size:14,w:800,c:CY});
  g.Fill({inc:[p],c:CY,op:0.3}); g.T(0,-4.4,'p ⇒ q : p는 충분조건',{size:12,c:CY,w:800});
}},
{t:'필요조건',ch:1,d:'명제 p → q 가 참일 때, q는 p이기 위한 필요조건 (P ⊂ Q)',fig:function(g){
  var q=g.E(0,0,4.5,3.4,{w:2.6,c:AM}); g.T(3.3,2.8,'Q',{size:14,w:800,c:AM});
  g.C(-0.9,-0.2,1.9,{w:2.2}); g.T(-0.9,-0.2,'P',{size:14,w:800});
  g.Fill({inc:[q],c:AM,op:0.2}); g.T(0,-4.4,'p ⇒ q : q는 필요조건',{size:12,c:AM,w:800});
}},
{t:'필요충분조건',ch:1,d:'p → q 와 q → p 가 모두 참일 때 (p ⇔ q), 즉 P = Q',fig:function(g){
  var p=g.C(-0.12,0,2.8,{c:CY,w:2.4}); var q=g.C(0.12,0,2.8,{c:AM,w:2.4});
  g.Fill({inc:[p,q],c:GR,op:0.2}); g.T(0,0,'P = Q',{size:20,w:800});
  g.T(0,-4.2,'p ⇔ q',{size:15,c:GR,w:800});
}},
{t:'반례',ch:1,d:'가정은 만족하지만 결론은 만족하지 않아서, 명제가 거짓임을 보여 주는 예',fig:function(g){
  g.U(); var p=g.C(-1.2,0,2.3), q=g.C(1.3,0,2.3,{c:'#cbd5e1'});
  g.T(-1.6,1.4,'P',{size:13,w:800}); g.T(2,1.4,'Q',{size:13,w:800,c:'#cbd5e1'});
  g.Fill({inc:[p],exc:[q],c:RD,op:0.3}); g.P(-2.3,-0.4,{r:5,c:RD,l:'반례',ly:16,ls:11});
  g.T(0,-4.45,'p → q 는 거짓',{size:12,c:RD,w:800});
}},
{t:'귀류법',ch:1,d:'결론을 부정하면 모순이 생긴다는 것을 보여서, 원래 명제가 참임을 증명하는 방법',fig:function(g){
  g.R(-3.8,2.3,3.8,4.3,{w:1.8}); g.T(0,3.3,'결론을 부정 (~q)',{size:12,w:700});
  g.A(0,2.2,0,1.15,{c:AX,w:1.8,h:0.3});
  g.R(-3.8,-1,3.8,1,{w:2,c:RD}); g.T(0,0,'모순 발생!',{size:15,w:800,c:RD});
  g.A(0,-1.1,0,-2.15,{c:AX,w:1.8,h:0.3});
  g.R(-3.8,-4.3,3.8,-2.3,{w:2,c:GR}); g.T(0,-3.3,'∴ q는 참',{size:14,w:800,c:GR});
}},
{t:'절대부등식',ch:1,d:'문자에 어떤 실수를 대입해도 항상 성립하는 부등식 (예: x² + 1 > 0)',fig:function(g){
  g.ax(); var f=function(x){return 0.3*x*x+1;};
  g.Fn(f,-3.6,3.6,{c:CY,w:2.8});
  g.Fill({inc:[g.dFn(f,-3.6,3.6)+'L'+g.pt(3.6,0)+'L'+g.pt(-3.6,0)+'Z'],c:CY,op:0.14});
  g.T(-2.9,-2.3,'x² + 1 > 0',{size:14,w:800,c:CY}); g.T(2.6,-2.3,'항상 참',{size:12,w:800,c:GR});
}},
{t:'산술평균과 기하평균',ch:1,d:'a > 0, b > 0 일 때 (a + b)/2 ≥ √ab  (등호는 a = b 일 때 성립)',fig:function(g){
  g.L(-4.5,-2,4.5,-2,{w:2.2});
  g.S('M'+g.pt(-4.5,-2)+'A72 72 0 0 1 '+g.pt(4.5,-2),{w:2.4});
  g.L(0,-2,0,2.5,{c:CY,w:2.6}); g.L(1.5,-2,1.5,2.243,{c:AM,w:2.6}); g.Ra(1.5,-2,[-1,0],[0,1],0.38);
  g.T(0,0.4,'(a+b)/2',{a:'end',dx:-5,size:11,c:CY,w:800}); g.T(1.5,0.4,'√ab',{a:'start',dx:6,size:12,c:AM,w:800});
  g.T(-1.5,-2,'a',{dy:13,size:13,it:true,w:700}); g.T(3,-2,'b',{dy:13,size:13,it:true,w:700});
  g.T(0,-4.4,'(a+b)/2 ≥ √ab',{size:13,w:800});
}},
/* ===== 함수 ===== */
{t:'대응',ch:2,d:'집합 X의 원소에 집합 Y의 원소를 짝지어 주는 것. 모든 대응이 함수인 것은 아니다',fig:function(g){
  g.Map({X:['1','2','3'],Y:['a','b','c'],arr:[[0,0],[0,1],[1,2]],ac:AM});
  g.T(0,-4.2,'3은 짝이 없고, 1은 짝이 둘',{size:11,c:'#cbd5e1'});
}},
{t:'함수',ch:2,d:'집합 X의 각 원소에 집합 Y의 원소가 오직 하나씩 대응할 때, 이 대응을 X에서 Y로의 함수라고 한다',fig:function(g){
  g.Map({X:['1','2','3'],Y:['a','b','c','d'],arr:[[0,1],[1,0],[2,1]]}); g.T(0,-4.2,'f : X → Y',{size:14,w:800,c:CY});
}},
{t:'정의역',ch:2,d:'함수 f : X → Y 에서 집합 X를 함수 f의 정의역이라고 한다',fig:function(g){
  g.Map({X:['1','2','3'],Y:['a','b','c','d'],arr:[[0,1],[1,0],[2,2]],fx:CY}); g.T(-2.6,-4.2,'정의역 X',{size:13,w:800,c:CY});
}},
{t:'공역',ch:2,d:'함수 f : X → Y 에서 집합 Y를 함수 f의 공역이라고 한다',fig:function(g){
  g.Map({X:['1','2','3'],Y:['a','b','c','d'],arr:[[0,1],[1,0],[2,2]],fy:AM}); g.T(2.6,-4.2,'공역 Y',{size:13,w:800,c:AM});
}},
{t:'치역',ch:2,d:'함숫값 전체의 집합 { f(x) | x ∈ X }. 치역은 공역의 부분집합이다',fig:function(g){
  g.Map({X:['1','2','3'],Y:['a','b','c','d'],arr:[[0,0],[1,1],[2,1]],hit:[0,1],ring:true}); g.T(2.6,-4.2,'치역 = {a, b}',{size:12,w:800,c:AM});
}},
{t:'함숫값',ch:2,d:'함수 f에서 x에 대응하는 Y의 원소를 f(x)로 나타내고, 이것을 x의 함숫값이라고 한다',fig:function(g){
  g.Map({X:['1','2','3'],Y:['a','b','c','d'],arr:[[0,0],[1,1],[2,3]],hl:1}); g.T(0,-4.2,'f(2) = b',{size:15,w:800,c:AM});
}},
{t:'일대일함수',ch:2,d:'정의역의 서로 다른 원소에 서로 다른 함숫값이 대응하는 함수. x₁ ≠ x₂ 이면 f(x₁) ≠ f(x₂)',fig:function(g){
  g.Map({X:['1','2','3'],Y:['a','b','c','d'],arr:[[0,0],[1,2],[2,3]]}); g.T(0,-4.2,'x₁ ≠ x₂ → f(x₁) ≠ f(x₂)',{size:11,w:700,c:CY});
}},
{t:'일대일대응',ch:2,d:'일대일함수이면서 치역과 공역이 같은 함수',fig:function(g){
  g.Map({X:['1','2','3'],Y:['a','b','c'],arr:[[0,1],[1,2],[2,0]],ac:GR}); g.T(0,-4.2,'치역 = 공역, 짝이 딱 하나씩',{size:11,w:700,c:GR});
}},
{t:'항등함수',ch:2,d:'정의역의 각 원소에 자기 자신이 대응하는 함수. f(x) = x',fig:function(g){
  g.ax(); g.Fn(function(x){return x;},-5,5,{c:CY,w:2.8});
  g.P(-2,-2,{r:3.4}); g.P(1,1,{r:3.4}); g.P(3,3,{r:3.4,c:AM,l:'(3, 3)',lx:-24,ly:-8});
  g.T(4.2,2.8,'y = x',{size:13,w:800,c:CY,it:true});
}},
{t:'상수함수',ch:2,d:'정의역의 모든 원소에 공역의 단 하나의 원소만 대응하는 함수. f(x) = c',fig:function(g){
  g.ax(); g.Fn(function(){return 2;},-5,5,{c:CY,w:2.8});
  g.P(-3,2,{r:3.4}); g.P(1,2,{r:3.4}); g.P(3.5,2,{r:3.4});
  g.T(3.6,3,'y = c',{size:13,w:800,c:CY,it:true});
}},
{t:'합성함수',ch:2,d:'두 함수 f : X → Y, g : Y → Z 에 대하여 (g ∘ f)(x) = g(f(x))',fig:function(g){
  [-3.6,0,3.6].forEach(function(cx,i){ g.E(cx,0.5,1.05,2.3,{w:2}); g.T(cx,3.35,['X','Y','Z'][i],{size:12,w:800}); });
  [1.4,-0.4].forEach(function(y){ g.P(-3.6,y,{r:3}); g.P(0,y,{r:3}); g.P(3.6,y,{r:3}); });
  g.A(-3.3,1.4,-0.32,-0.4,{c:CY,w:1.9,h:0.28}); g.A(-3.3,-0.4,-0.32,1.4,{c:CY,w:1.9,h:0.28});
  g.A(0.3,-0.4,3.28,-0.4,{c:PK,w:1.9,h:0.28}); g.A(0.3,1.4,3.28,1.4,{c:PK,w:1.9,h:0.28});
  g.T(-1.8,2.6,'f',{size:13,c:CY,w:800,it:true}); g.T(1.8,2.6,'g',{size:13,c:PK,w:800,it:true});
  g.S('M'+g.pt(-3.6,-2.1)+'Q'+g.pt(0,-4.8)+' '+g.pt(3.45,-2.15)+g.head(1.7,-3.6,3.45,-2.15,0.36),{c:AM,w:2.4});
  g.T(0,-4.45,'g ∘ f',{size:13,c:AM,w:800,it:true});
}},
{t:'역함수',ch:2,d:'y = f(x)에서 x와 y를 서로 바꾼 함수 y = f⁻¹(x). 두 그래프는 직선 y = x에 대하여 대칭',fig:function(g){
  g.ax(); g.Fn(function(x){return x;},-5,5,{dash:true,c:AX,w:1.6});
  g.Fn(function(x){return 0.12*x*x*x+0.5;},-3.4,3.2,{w:2.6});
  g.Fn(function(x){return Math.cbrt((x-0.5)/0.12);},-4.2,4.4,{c:CY,w:2.8});
  g.L(2,1.46,1.46,2,{dash:true,c:AM,w:1.6}); g.P(2,1.46,{r:3.4}); g.P(1.46,2,{r:3.4,c:CY});
  g.T(1.0,3.4,'f',{size:14,w:800,it:true}); g.T(3.6,1.0,'f⁻¹',{size:14,w:800,c:CY,it:true}); g.T(4.4,4.9,'y = x',{size:10,c:AX});
}},
{t:'유리함수',ch:2,d:'y = k/(x − p) + q 꼴의 함수. 그래프는 점근선 x = p, y = q 를 가진다',fig:function(g){
  g.ax(); g.L(1,-5.4,1,5.4,{dash:true,c:AX,w:1.5}); g.L(-5.4,1,5.4,1,{dash:true,c:AX,w:1.5});
  var f=function(x){return 2/(x-1)+1;}; g.Fn(f,-5,0.9,{c:CY,w:2.8}); g.Fn(f,1.1,5,{c:CY,w:2.8});
  g.T(-4.7,4.5,'y = k/(x−p) + q',{a:'start',size:11,w:800,c:CY});
}},
{t:'점근선',ch:2,d:'그래프가 한없이 가까워지지만 만나지는 않는 직선',fig:function(g){
  g.ax(); var f=function(x){return 2/(x-1)+1;}; g.Fn(f,-5,0.9,{w:2.4}); g.Fn(f,1.1,5,{w:2.4});
  g.L(1,-5.4,1,5.4,{dash:true,c:AM,w:2.4}); g.L(-5.4,1,5.4,1,{dash:true,c:AM,w:2.4});
  g.T(1,-4.6,'x = p',{a:'start',dx:6,size:11,c:AM,w:800}); g.T(-4.8,1,'y = q',{a:'start',dy:-8,size:11,c:AM,w:800});
}},
{t:'무리함수',ch:2,d:'y = √a(x − p) + q 꼴의 함수. 근호 안이 0 이상이 되는 x에서만 정의된다',fig:function(g){
  g.ax(); g.Fn(function(x){return Math.sqrt(2*(x+3))-1;},-3,5,{c:CY,w:2.8});
  g.P(-3,-1,{r:4.4,c:AM,l:'(p, q)',ly:16,lc:AM});
  g.T(2.3,-2.8,'y = √a(x−p) + q',{size:11,w:800,c:CY});
}}
];

/* ---------- 그림 → SVG ---------- */
var GH='#26324a', GHT='#3a4760';
// 'ᶜ'(여집합)는 글꼴에 따라 점처럼 보여서 작은 위첨자 C로 바꿔 그림
function svgText(s,size){
  var up=rnd(size*0.38);
  return escX(s).replace(/ᶜ/g,'<tspan dy="-'+up+'" font-size="'+rnd(size*0.66)+'">C</tspan><tspan dy="'+up+'">​</tspan>');
}
function htmlText(s){ return escX(s).replace(/ᶜ/g,'<sup style="font-size:.7em">C</sup>'); }
function renderFig(term){
  var g=new Fig(); term.fig(g);
  var gh='', br='';
  g.it.forEach(function(it,i){
    if(it.k==='s'){
      gh+='<path d="'+it.d+'" fill="none" stroke="'+GH+'" stroke-width="'+it.w+'" stroke-linecap="round" stroke-linejoin="round"'+(it.dash?' stroke-dasharray="4 4"':'')+'/>';
      br+=it.dash
        ? '<path data-i="'+i+'" d="'+it.d+'" fill="none" stroke="'+it.c+'" stroke-width="'+it.w+'" stroke-linecap="round" stroke-dasharray="4 4" opacity="0"/>'
        : '<path data-i="'+i+'" d="'+it.d+'" fill="none" stroke="'+it.c+'" stroke-width="'+it.w+'" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>';
    } else if(it.k==='p'){
      gh+='<circle cx="'+rnd(it.x)+'" cy="'+rnd(it.y)+'" r="'+it.r+'" fill="'+(it.hollow?'none':GH)+'" stroke="'+GH+'" stroke-width="'+(it.hollow?2:0)+'"/>';
      br+='<circle data-i="'+i+'" cx="'+rnd(it.x)+'" cy="'+rnd(it.y)+'" r="0" fill="'+(it.hollow?'#0b1120':it.c)+'" stroke="'+it.c+'" stroke-width="'+(it.hollow?2.2:0)+'"/>';
    } else if(it.k==='t'){
      var attr=' x="'+rnd(it.x)+'" y="'+rnd(it.y)+'" font-size="'+it.size+'" text-anchor="'+it.a+'" dominant-baseline="central" font-weight="'+it.w+'"'+(it.it?' font-style="italic"':'');
      var tx=svgText(it.s,it.size);
      gh+='<text'+attr+' fill="'+GHT+'">'+tx+'</text>';
      br+='<text data-i="'+i+'"'+attr+' fill="'+it.c+'" opacity="0">'+tx+'</text>';
    } else if(it.k==='f'){
      br+='<g data-i="'+i+'" opacity="0">'+it.html+'</g>';
    }
  });
  var wrap=document.createElement('div');
  wrap.className='mt-fig';
  wrap.innerHTML='<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs>'+g.defs+'</defs><g class="mt-gh">'+gh+'</g><g class="mt-br">'+br+'</g></svg>';
  var els={}; wrap.querySelectorAll('[data-i]').forEach(function(e){ els[e.getAttribute('data-i')]=e; });
  return {el:wrap, items:g.it, els:els, last:[], dp:0, tp:0};
}
function easeOutBack(t){ var c1=1.70158,c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); }
function setFigProgress(f,p){
  var N=f.items.length;
  for(var i=0;i<N;i++){
    var r=Math.max(0,Math.min(1,p*(N+0.6)-i));
    if(f.last[i]===r) continue;
    f.last[i]=r;
    var it=f.items[i], el=f.els[i]; if(!el) continue;
    if(it.k==='s'){ if(it.dash) el.setAttribute('opacity',r); else el.setAttribute('stroke-dashoffset',(1-r).toFixed(4)); }
    else if(it.k==='p'){ el.setAttribute('r',Math.max(0,it.r*easeOutBack(r)).toFixed(2)); }
    else if(it.k==='t'){ el.setAttribute('opacity',r.toFixed(3)); }
    else if(it.k==='f'){ el.setAttribute('opacity',(r*it.op).toFixed(3)); }
  }
}

/* ---------- 효과음 (WebAudio, 파일 없음) ---------- */
var AC=null, soundOn=true;
try{ soundOn=localStorage.getItem('mt_sound')!=='off'; }catch(e){}
function ensureAudio(){
  if(!soundOn) return;
  try{ if(!AC){ var C=window.AudioContext||window.webkitAudioContext; if(C) AC=new C(); } if(AC && AC.state==='suspended') AC.resume(); }catch(e){}
}
function tone(freq,dur,type,vol,delay){
  if(!soundOn || !AC) return;
  try{
    var t=AC.currentTime+(delay||0), o=AC.createOscillator(), g=AC.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||0.05,t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t+dur+0.02);
  }catch(e){}
}
function sfxKey(){ tone(1500+Math.random()*250,0.045,'sine',0.025); }
function sfxErr(){ tone(150,0.16,'square',0.035); }
function sfxDone(combo){ var b=520*Math.pow(1.06,Math.min(combo,12)); tone(b,0.14,'triangle',0.06); tone(b*1.26,0.14,'triangle',0.05,0.07); tone(b*1.5,0.28,'triangle',0.05,0.14); }
function sfxTick(){ tone(880,0.06,'sine',0.04); }

/* ---------- 스타일 ---------- */
var CSS=[
'#mt-root{position:fixed;left:0;right:0;top:0;height:100vh;z-index:90;display:none;overflow:hidden;color:#f8fafc;background:radial-gradient(120% 80% at 50% 38%,#121b31 0%,#0a0f1c 55%,#05070d 100%);font-family:"Pretendard",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;}',
'#mt-root *{box-sizing:border-box;}',
'#mt-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}',
'.mt-screen{position:absolute;inset:0;display:none;flex-direction:column;}',
'.mt-screen.on{display:flex;}',
'.mt-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:12px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.55);color:#cbd5e1;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5;}',
'.mt-snd{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:12px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.55);color:#cbd5e1;font-size:17px;cursor:pointer;z-index:5;}',
/* 타이틀 */
'.mt-title{align-items:center;overflow-y:auto;padding:calc(env(safe-area-inset-top,0px) + 58px) 16px calc(env(safe-area-inset-bottom,0px) + 22px);}',
'.mt-show{width:min(280px,62vw,34vh);height:min(280px,62vw,34vh);flex-shrink:0;position:relative;}',
'.mt-show .mt-fig{position:absolute;inset:0;transition:opacity .5s;}',
'.mt-eyebrow{margin-top:6px;font-size:11px;letter-spacing:.42em;color:#64748b;font-weight:700;padding-left:.42em;}',
'.mt-h1{font-size:40px;font-weight:900;letter-spacing:-.02em;margin-top:6px;background:linear-gradient(100deg,#fff 20%,#a5f3fc 60%,#c4b5fd 95%);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.15;}',
'.mt-sub{font-size:13.5px;color:#7c8aa3;margin-top:8px;text-align:center;line-height:1.6;}',
'.mt-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:20px 0 6px;max-width:420px;}',
'.mt-chip{min-height:44px;padding:0 15px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.6);color:#94a3b8;font-size:13.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;}',
'.mt-chip b{font-size:11px;color:#64748b;font-weight:700;}',
'.mt-chip.on{background:#f8fafc;color:#0b1120;border-color:#f8fafc;}',
'.mt-chip.on b{color:#475569;}',
'.mt-btns{width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px;margin-top:16px;}',
'.mt-go{min-height:56px;border:none;border-radius:16px;font-size:16.5px;font-weight:900;cursor:pointer;background:linear-gradient(135deg,#f8fafc,#a5f3fc);color:#0b1120;box-shadow:0 10px 30px -10px rgba(103,232,249,.55);}',
'.mt-go:disabled{background:#1e293b;color:#64748b;box-shadow:none;cursor:default;}',
'.mt-go2{min-height:50px;border-radius:16px;font-size:14.5px;font-weight:800;cursor:pointer;background:transparent;color:#cbd5e1;border:1px solid rgba(148,163,184,.3);}',
'.mt-note{font-size:12px;color:#64748b;text-align:center;margin-top:12px;line-height:1.6;}',
/* 플레이 */
'.mt-hud{position:relative;z-index:3;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 0 64px;display:flex;align-items:center;gap:10px;min-height:54px;}',
'.mt-stats{flex:1;display:flex;justify-content:center;gap:16px;font-size:12px;color:#64748b;font-weight:600;white-space:nowrap;}',
'.mt-stats b{color:#e2e8f0;font-size:15px;font-weight:800;margin-right:2px;font-variant-numeric:tabular-nums;}',
'.mt-score{font-size:20px;font-weight:900;color:#fff;min-width:56px;text-align:right;font-variant-numeric:tabular-nums;}',
'.mt-bar{position:absolute;left:0;right:0;top:0;height:3px;background:rgba(148,163,184,.08);z-index:4;}',
'.mt-bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#67e8f9,#c4b5fd);transform-origin:left;}',
'.mt-bar.low i{background:#fb7185;}',
'.mt-stage{flex:1;position:relative;min-height:120px;}',
'.mt-item{position:absolute;left:50%;top:50%;width:var(--fs,260px);height:var(--fs,260px);transform:translate(-50%,-50%) translateX(var(--tx)) scale(var(--sc));opacity:var(--op);transition:transform .75s cubic-bezier(.2,.85,.2,1),opacity .75s;will-change:transform;}',
'.mt-item .mt-fig,.mt-fig svg{width:100%;height:100%;display:block;overflow:visible;}',
'.mt-fig text{font-family:"Pretendard",-apple-system,"Apple SD Gothic Neo",sans-serif;}',
'.pos-c{--tx:0px;--sc:1;--op:1;}',
'.pos-l{--tx:calc(var(--sw,390px)*-0.4);--sc:.4;--op:.4;}',
'.pos-r{--tx:calc(var(--sw,390px)*0.4);--sc:.4;--op:.28;}',
'.pos-ll{--tx:calc(var(--sw,390px)*-0.8);--sc:.3;--op:0;}',
'.pos-rr{--tx:calc(var(--sw,390px)*0.8);--sc:.3;--op:0;}',
'.mt-item.done .mt-br{filter:drop-shadow(0 0 5px rgba(165,243,252,.55));}',
'.mt-count{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:84px;font-weight:900;color:#fff;pointer-events:none;text-shadow:0 0 40px rgba(103,232,249,.5);}',
'.mt-count.pop{animation:mtPop .8s ease-out both;}',
'@keyframes mtPop{0%{transform:translate(-50%,-50%) scale(1.6);opacity:0}25%{opacity:1}100%{transform:translate(-50%,-50%) scale(.7);opacity:0}}',
'.mt-combo{position:absolute;left:50%;top:6px;transform:translateX(-50%);font-size:13px;font-weight:900;letter-spacing:.2em;color:#fcd34d;opacity:0;pointer-events:none;white-space:nowrap;}',
'.mt-combo.pop{animation:mtCombo 1.1s ease-out both;}',
'@keyframes mtCombo{0%{opacity:0;transform:translateX(-50%) scale(.7)}15%{opacity:1;transform:translateX(-50%) scale(1.15)}30%{transform:translateX(-50%) scale(1)}80%{opacity:1}100%{opacity:0}}',
'.mt-wordbox{position:relative;z-index:3;text-align:center;padding:4px 16px 14px;}',
'.mt-chap{font-size:10.5px;letter-spacing:.38em;color:#56627a;font-weight:700;padding-left:.38em;margin-bottom:6px;}',
'.mt-word{position:relative;display:inline-flex;align-items:center;justify-content:center;flex-wrap:nowrap;font-weight:800;letter-spacing:.01em;line-height:1.25;min-height:1.25em;}',
'.mt-s{position:relative;display:inline-block;color:#475266;transition:color .12s;}',
'.mt-s.sp{width:.32em;}',
'.mt-s.dn{color:#f8fafc;text-shadow:0 0 18px rgba(255,255,255,.18);}',
'.mt-s .pc{position:absolute;left:0;top:0;width:100%;text-align:center;color:#f8fafc;}',
'.mt-s.er{color:#fb7185;animation:mtShake .32s;}',
'@keyframes mtShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}',
'.mt-caret{display:inline-block;width:2px;height:.95em;background:#a5f3fc;margin:0 1px;vertical-align:-.08em;animation:mtBlink 1s steps(1) infinite;}',
'@keyframes mtBlink{50%{opacity:0}}',
'.mt-in,.mt-word.in,.mt-desc.in,.mt-chap.in{animation:mtIn .45s cubic-bezier(.2,.85,.2,1) both;}',
'@keyframes mtIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
'.mt-desc{font-size:13.5px;color:#6b7891;line-height:1.6;margin:8px auto 0;max-width:520px;min-height:2.2em;word-break:keep-all;}',
'.mt-hint{font-size:12px;color:#64748b;margin-top:6px;min-height:18px;font-weight:600;}',
'.mt-hint.err{color:#fb7185;}',
'.mt-plus{position:absolute;left:50%;top:-6px;font-size:18px;font-weight:900;color:#fcd34d;pointer-events:none;animation:mtPlus .9s ease-out both;}',
'@keyframes mtPlus{0%{opacity:0;transform:translate(-50%,6px)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-34px)}}',
'.mt-skip{margin-top:4px;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:transparent;color:#94a3b8;font-size:12.5px;font-weight:700;cursor:pointer;}',
'.mt-input{position:absolute;left:50%;top:40%;width:60%;height:40px;transform:translateX(-50%);opacity:0;font-size:16px;border:0;outline:0;background:transparent;color:transparent;caret-color:transparent;z-index:1;}',
/* 화면 키보드 (PC만) */
'.mt-kbd{display:none;position:relative;z-index:3;margin:0 auto 18px;padding:8px;border-radius:12px;background:rgba(15,23,42,.6);border:1px solid rgba(148,163,184,.1);}',
'.mt-kbd.on{display:block;}',
'.mt-krow{display:flex;justify-content:center;gap:5px;margin:5px 0;}',
'.mt-key{min-width:34px;height:34px;padding:0 6px;border-radius:7px;background:#141c2e;border:1px solid #1f2a40;color:#64748b;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all .08s;}',
'.mt-key.wide{min-width:64px;font-size:11px;}',
'.mt-key.on{background:#f8fafc;color:#0b1120;border-color:#fff;box-shadow:0 0 16px rgba(255,255,255,.35);}',
'.mt-key.bad{background:#fb7185;color:#fff;border-color:#fb7185;}',
/* 결과 */
'.mt-result{align-items:center;justify-content:center;overflow-y:auto;padding:calc(env(safe-area-inset-top,0px) + 50px) 16px calc(env(safe-area-inset-bottom,0px) + 22px);}',
'.mt-rlabel{font-size:11px;letter-spacing:.42em;color:#64748b;font-weight:800;padding-left:.42em;}',
'.mt-rscore{font-size:68px;font-weight:900;line-height:1.1;margin:6px 0 2px;background:linear-gradient(100deg,#fff,#a5f3fc);-webkit-background-clip:text;background-clip:text;color:transparent;font-variant-numeric:tabular-nums;}',
'.mt-rbest{font-size:13px;font-weight:800;color:#fcd34d;min-height:20px;}',
'.mt-rgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;max-width:420px;margin:16px 0 10px;}',
'.mt-rcell{background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.12);border-radius:14px;padding:12px 4px;text-align:center;}',
'.mt-rcell b{display:block;font-size:20px;font-weight:900;color:#f8fafc;font-variant-numeric:tabular-nums;}',
'.mt-rcell span{font-size:11px;color:#64748b;font-weight:700;}',
'.mt-learned{width:100%;max-width:420px;margin-top:6px;}',
'.mt-learned h4{font-size:12px;color:#94a3b8;font-weight:800;margin-bottom:8px;}',
'.mt-lchips{display:flex;flex-wrap:wrap;gap:6px;}',
'.mt-lchip{padding:8px 11px;border-radius:999px;background:rgba(103,232,249,.08);border:1px solid rgba(103,232,249,.2);color:#a5f3fc;font-size:12.5px;font-weight:700;cursor:pointer;min-height:36px;}',
'.mt-ldesc{font-size:12.5px;color:#94a3b8;line-height:1.6;margin-top:8px;min-height:20px;word-break:keep-all;}',
'.mt-rmsg{font-size:12.5px;color:#94a3b8;margin:12px 0 0;text-align:center;min-height:18px;line-height:1.5;}',
'@media (max-width:480px){.mt-h1{font-size:34px}.mt-stats{gap:11px;font-size:11px}.mt-stats b{font-size:14px}.mt-score{font-size:18px}.mt-desc{font-size:13px}.mt-rscore{font-size:58px}.mt-rcell b{font-size:17px}}',
'@media (prefers-reduced-motion:reduce){.mt-item{transition:none}}'
].join('\n');

/* ---------- 상태 ---------- */
var root, fx, fxc, ui={}, opts={}, built=false;
var mode='challenge', chapter=-1, deck=[], deckPos=0;
var phase='idle'; // title | count | play | result
var GAME_MS=60000, tStart=0, raf=0;
var items=[]; // 화면에 있는 그림들 [{term,fig,el,pos}]
var cur=null; // {term,target,fig}
var committed=0, lastLen=0, lastWrong=0, lastM=0, maxM=0, wordErr=false, composing=false;
var score=0, correctKeys=0, errors=0, combo=0, bestCombo=0, doneCount=0, learned=[];
var parts=[], amb=[], vw=0, vh=0, dpr=1;
var showTimer=0, showFig=null;

function $(sel){ return root.querySelector(sel); }
function build(){
  if(built) return; built=true;
  var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
  root=document.createElement('div'); root.id='mt-root';
  root.innerHTML=
   '<canvas id="mt-fx"></canvas>'
  +'<div class="mt-screen mt-title">'
  +  '<button class="mt-x" data-act="close" aria-label="닫기">✕</button>'
  +  '<button class="mt-snd" data-act="sound" aria-label="소리"></button>'
  +  '<div class="mt-show"></div>'
  +  '<div class="mt-eyebrow">공통수학2</div>'
  +  '<div class="mt-h1">용어 타자</div>'
  +  '<div class="mt-sub">그림을 보고 회색 용어를 입력하세요.<br>한 글자씩 칠 때마다 그림이 그려져요.</div>'
  +  '<div class="mt-chips"></div>'
  +  '<div class="mt-btns"><button class="mt-go" data-act="challenge"></button><button class="mt-go2" data-act="practice">연습 모드 · 시간 제한 없음</button></div>'
  +  '<div class="mt-note"></div>'
  +'</div>'
  +'<div class="mt-screen mt-play">'
  +  '<div class="mt-bar"><i></i></div>'
  +  '<button class="mt-x" data-act="quit" aria-label="그만하기">✕</button>'
  +  '<div class="mt-hud"><div class="mt-stats"><span><b class="h-cpm">0</b>타</span><span><b class="h-acc">100</b>%</span><span><b class="h-cnt">0</b>개</span></div><div class="mt-score">0</div></div>'
  +  '<div class="mt-stage"><div class="mt-combo"></div></div>'
  +  '<div class="mt-wordbox"><div class="mt-chap"></div><div class="mt-word"></div><div class="mt-desc"></div><div class="mt-hint"></div><button class="mt-skip" data-act="skip" style="display:none">건너뛰기 →</button>'
  +    '<input class="mt-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" aria-label="용어 입력"></div>'
  +  '<div class="mt-kbd"></div>'
  +'</div>'
  +'<div class="mt-screen mt-result">'
  +  '<div class="mt-rlabel">RESULT</div><div class="mt-rscore">0</div><div class="mt-rbest"></div>'
  +  '<div class="mt-rgrid"><div class="mt-rcell"><b class="r-cnt">0</b><span>완성한 용어</span></div><div class="mt-rcell"><b class="r-cpm">0</b><span>분당 타수</span></div><div class="mt-rcell"><b class="r-acc">0%</b><span>정확도</span></div><div class="mt-rcell"><b class="r-combo">0</b><span>최고 콤보</span></div></div>'
  +  '<div class="mt-learned"><h4>이번 판에서 익힌 용어 · 눌러서 뜻 보기</h4><div class="mt-lchips"></div><div class="mt-ldesc"></div></div>'
  +  '<div class="mt-rmsg"></div>'
  +  '<div class="mt-btns"><button class="mt-go" data-act="done">확인</button><button class="mt-go2" data-act="again">다시 하기</button></div>'
  +'</div>';
  document.body.appendChild(root);
  fx=root.querySelector('#mt-fx'); fxc=fx.getContext('2d');
  ui.title=$('.mt-title'); ui.play=$('.mt-play'); ui.result=$('.mt-result');
  ui.stage=$('.mt-stage'); ui.word=$('.mt-word'); ui.desc=$('.mt-desc'); ui.chap=$('.mt-chap'); ui.hint=$('.mt-hint');
  ui.input=$('.mt-input'); ui.kbd=$('.mt-kbd'); ui.bar=$('.mt-bar'); ui.barI=$('.mt-bar i'); ui.combo=$('.mt-combo');
  ui.wordbox=$('.mt-wordbox'); ui.score=$('.mt-score'); ui.cpm=$('.h-cpm'); ui.acc=$('.h-acc'); ui.cnt=$('.h-cnt'); ui.skip=$('.mt-skip');

  root.addEventListener('click',function(e){
    var b=e.target.closest('[data-act]');
    if(b){ act(b.getAttribute('data-act'),b); return; }
    if(phase==='play' || phase==='count') focusInput();
  });
  ui.input.addEventListener('input',onInput);
  ui.input.addEventListener('compositionstart',function(){ composing=true; });
  ui.input.addEventListener('compositionend',function(){ composing=false; setTimeout(trimCommitted,0); });
  ui.input.addEventListener('keydown',function(e){
    if(e.key==='Enter'){ e.preventDefault(); }
    if(e.key==='Escape'){ act('quit'); }
  });
  ui.input.addEventListener('blur',function(){ if(phase==='play') ui.hint.textContent='화면을 누르면 다시 입력할 수 있어요'; });
  ui.input.addEventListener('focus',function(){ if(phase==='play' && !lastWrong) ui.hint.textContent=''; });
  if(window.visualViewport){ visualViewport.addEventListener('resize',fit); visualViewport.addEventListener('scroll',fit); }
  window.addEventListener('resize',fit);
  // 설명 줄 수·글자 크기에 따라 그림 칸 높이가 바뀌므로 칸 크기가 바뀔 때마다 그림 크기를 다시 맞춤
  if(window.ResizeObserver) new ResizeObserver(sizeStage).observe(ui.stage);
  buildKbd();
  initAmbient();
}

function act(a){
  ensureAudio();
  if(a==='close'){ close(); }
  else if(a==='sound'){ soundOn=!soundOn; try{ localStorage.setItem('mt_sound',soundOn?'on':'off'); }catch(e){} paintSound(); if(soundOn){ ensureAudio(); sfxTick(); } }
  else if(a==='challenge'){ if(opts.canChallenge) startRun('challenge'); }
  else if(a==='practice'){ startRun('practice'); }
  else if(a==='again'){ showTitle(); }
  else if(a==='chap'){}
  else if(a==='skip'){
    if(phase==='play' && mode==='practice'){ combo=0; advance(true); committed=streamOf(ui.input.value).length; lastLen=committed; trimCommitted(); }
    focusInput();
  }
  else if(a==='quit'){
    if(phase==='count'){ showTitle(); return; }
    if(phase!=='play') return;
    if(mode==='practice'){ finish(); return; }
    if(confirm('도전을 그만할까요? 이번 판 점수는 기록되지 않아요.')) showTitle();
    else focusInput();
  }
  else if(a==='done'){ close(); }
}
function paintSound(){ root.querySelectorAll('[data-act="sound"]').forEach(function(b){ b.textContent=soundOn?'🔊':'🔇'; }); }

/* ---------- 열기/닫기 ---------- */
function open(o){
  build(); opts=o||{};
  root.style.display='block';
  document.documentElement.style.overflow='hidden';
  fit(); paintSound(); showTitle();
  if(!raf) raf=requestAnimationFrame(loop);
}
function close(){
  phase='idle';
  try{ ui.input.blur(); }catch(e){}
  root.style.display='none';
  document.documentElement.style.overflow='';
  if(raf){ cancelAnimationFrame(raf); raf=0; }
  clearInterval(showTimer);
  if(opts.onClose) opts.onClose();
}
function screen(name){
  [ui.title,ui.play,ui.result].forEach(function(s){ s.classList.remove('on'); });
  ui[name].classList.add('on');
}
function fit(){
  if(!root || root.style.display==='none') return;
  var vv=window.visualViewport;
  var h=vv?vv.height:window.innerHeight, top=vv?vv.offsetTop:0;
  root.style.height=h+'px'; root.style.top=top+'px';
  vw=root.clientWidth; vh=h;
  dpr=Math.min(2,window.devicePixelRatio||1);
  fx.width=Math.round(vw*dpr); fx.height=Math.round(vh*dpr);
  ui.kbd.classList.toggle('on', isDesktop() && vh>=620 && vw>=560);
  layoutStage();
}
function isDesktop(){ return window.matchMedia && window.matchMedia('(pointer:fine)').matches; }
function sizeStage(){
  var sw=ui.stage.clientWidth, sh=ui.stage.clientHeight;
  if(!sw || !sh) return;
  var fs=Math.max(100,Math.min(sh*0.94, sw*0.64, 360));
  ui.stage.style.setProperty('--fs',fs+'px');
  ui.stage.style.setProperty('--sw',sw+'px');
}
function layoutStage(){
  sizeStage();
  if(cur && phase==='play') paintWord(lastM,lastWrong);
}

/* ---------- 타이틀 ---------- */
function showTitle(){
  phase='title'; screen('title');
  try{ ui.input.blur(); }catch(e){}
  clearItems();
  var chips=$('.mt-chips');
  var live=liveTerms(), counts=[live.length,0,0,0]; live.forEach(function(t){ counts[t.ch+1]++; });
  if(chapter>=0 && !counts[chapter+1]) chapter=-1;
  chips.innerHTML=['전체'].concat(CH).map(function(n,i){
    if(i>0 && !counts[i]) return '';
    return '<button class="mt-chip'+((i-1)===chapter?' on':'')+'" data-ch="'+(i-1)+'">'+n+' <b>'+counts[i]+'</b></button>';
  }).join('');
  chips.querySelectorAll('.mt-chip').forEach(function(b){
    b.onclick=function(e){ e.stopPropagation(); chapter=+b.getAttribute('data-ch'); chips.querySelectorAll('.mt-chip').forEach(function(x){ x.classList.toggle('on',x===b); }); sfxTick(); startShowcase(); };
  });
  var go=$('[data-act="challenge"]');
  go.disabled=!opts.canChallenge;
  go.textContent=opts.canChallenge?'🏆 도전 시작 · 60초':'오늘 도전은 끝! 연습은 계속 가능해요';
  $('.mt-note').innerHTML=(opts.attemptsLabel?opts.attemptsLabel+'<br>':'')+'점수는 도전 모드만 기록돼요 · 띄어쓰기는 안 쳐도 돼요';
  startShowcase();
}
function liveTerms(){ var h=opts.hidden||[]; return TERMS.filter(function(t){ return h.indexOf(t.t)<0; }); }
function poolTerms(){
  var p=liveTerms().filter(function(t){ return chapter<0 || t.ch===chapter; });
  return p.length?p:liveTerms().length?liveTerms():TERMS.slice(); // 다 빼버린 경우에도 게임이 멈추지 않게
}
function startShowcase(){
  clearInterval(showTimer);
  var box=$('.mt-show'), pool=poolTerms(), i=Math.floor(Math.random()*pool.length);
  function next(){
    if(phase!=='title'){ clearInterval(showTimer); return; }
    var f=renderFig(pool[i++%pool.length]); f.tp=1; f.dp=0;
    var old=box.querySelector('.mt-fig'); if(old){ old.style.opacity=0; setTimeout(function(){ old.remove(); },500); }
    box.appendChild(f.el); showFig=f;
  }
  next(); showTimer=setInterval(next,2600);
}

/* ---------- 판 시작 ---------- */
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function nextTerm(){ if(deckPos>=deck.length){ var last=deck[deck.length-1]; deck=shuffle(poolTerms().slice()); if(deck.length>1 && deck[0]===last){ deck.push(deck.shift()); } deckPos=0; } return deck[deckPos++]; }
function startRun(m){
  mode=m; clearInterval(showTimer);
  score=0; correctKeys=0; errors=0; combo=0; bestCombo=0; doneCount=0; learned=[];
  deck=shuffle(poolTerms().slice()); deckPos=0;
  screen('play'); fit();
  ui.skip.style.display=mode==='practice'?'':'none';
  ui.bar.style.visibility=mode==='challenge'?'visible':'hidden';
  ui.barI.style.transform='scaleX(1)'; ui.bar.classList.remove('low');
  hudPaint();
  clearItems();
  var a=makeItem(nextTerm(),'pos-c'), b=makeItem(nextTerm(),'pos-r');
  setCurrent(a);
  ui.input.value=''; committed=0;
  focusInput(); // 폰: 사용자가 버튼을 누른 그 순간에 포커스해야 키보드가 올라옴
  phase='count';
  var n=3;
  function tick(){
    if(phase!=='count') return;
    if(n===0){ beginPlay(); return; }
    var c=document.createElement('div'); c.className='mt-count pop'; c.textContent=n;
    ui.stage.appendChild(c); setTimeout(function(){ c.remove(); },800);
    sfxTick(); n--; setTimeout(tick,650);
  }
  tick();
}
function beginPlay(){
  phase='play';
  committed=streamOf(ui.input.value).length; // 카운트다운 중에 친 건 무시
  lastLen=committed; lastWrong=0; maxM=0;
  tStart=performance.now();
  ui.hint.textContent=''; focusInput(); paintWord();
}
function focusInput(){ try{ ui.input.focus({preventScroll:true}); }catch(e){ ui.input.focus(); } }

/* ---------- 그림 캐러셀 ---------- */
function makeItem(term,pos){
  var f=renderFig(term), el=document.createElement('div');
  el.className='mt-item '+pos; el.appendChild(f.el); ui.stage.appendChild(el);
  var it={term:term,fig:f,el:el}; items.push(it); return it;
}
function clearItems(){ items.forEach(function(it){ it.el.remove(); }); items=[]; cur=null; }
function setCurrent(it){
  cur={item:it,term:it.term,target:buildTarget(it.term.t),fig:it.fig};
  cur.fig.tp=0;
  lastWrong=0; lastM=0; maxM=0; wordErr=false;
  ui.chap.textContent=CH[it.term.ch];
  ui.desc.innerHTML=htmlText(it.term.d);
  paintWord();
  [ui.word,ui.desc,ui.chap].forEach(function(e){ e.classList.remove('in'); void e.offsetWidth; e.classList.add('in'); });
}
function advance(skipped){
  var old=cur;
  var c=items.filter(function(x){ return x.el.classList.contains('pos-c'); })[0];
  var r=items.filter(function(x){ return x.el.classList.contains('pos-r'); })[0];
  items.filter(function(x){ return x.el.classList.contains('pos-l'); }).forEach(function(x){
    x.el.className='mt-item pos-ll'; setTimeout(function(){ x.el.remove(); items=items.filter(function(y){ return y!==x; }); },800);
  });
  if(c){ c.el.classList.remove('pos-c'); c.el.classList.add('pos-l'); if(!skipped){ c.fig.tp=1; } }
  if(c) setTimeout(function(){ c.el.classList.remove('done'); },900);
  var n=makeItem(nextTerm(),'pos-rr');
  void n.el.offsetWidth;
  n.el.classList.remove('pos-rr'); n.el.classList.add('pos-r');
  if(r){ r.el.classList.remove('pos-r'); r.el.classList.add('pos-c'); setCurrent(r); }
  return old;
}
// 끝난 단어는 입력칸에서 지움(조합 중이 아닐 때만 — 폰 키보드 조합을 깨지 않기 위해)
function trimCommitted(){
  if(composing || committed<=0) return;
  var v=ui.input.value, acc=0;
  for(var i=0;i<v.length;i++){
    acc+=keysOfChar(v[i]).length;
    if(acc===committed){
      var rest=v.slice(i+1);
      if(rest!==v){ ui.input.value=rest; committed=0; lastLen=streamOf(rest).length; try{ ui.input.setSelectionRange(rest.length,rest.length); }catch(e){} }
      return;
    }
    if(acc>committed) return;
  }
}

/* ---------- 입력 처리 ---------- */
function onInput(){
  if(phase!=='play'){ if(phase!=='count') ui.input.value=''; return; }
  var S=streamOf(ui.input.value);
  if(S.length<committed){ committed=S.length; } // 이전 단어까지 지운 경우 — 지금 단어 기준으로 다시 시작
  var cur0=S.slice(committed), T=cur.target.keys, m=0;
  while(m<cur0.length && m<T.length && cur0[m]===T[m]) m++;
  var wrong=cur0.length>T.length&&m===T.length?0:cur0.length-m;
  var grew=S.length>lastLen;
  if(grew){
    if(wrong>lastWrong){ errors++; combo=0; wordErr=true; sfxErr(); if(navigator.vibrate) try{ navigator.vibrate(25); }catch(e){} }
    else if(m>maxM){ correctKeys+=m-maxM; sfxKey(); sparkAtCaret(); }
  }
  if(m>maxM) maxM=m;
  lastLen=S.length; lastWrong=wrong; lastM=m;
  cur.fig.tp=m/T.length;
  ui.hint.textContent=wrong>0?'틀렸어요 · ⌫ 지우고 다시 입력하세요':'';
  ui.hint.classList.toggle('err',wrong>0);
  paintWord(m,wrong);
  hudPaint();
  if(m===T.length){
    complete();
    committed+=T.length;
    var rest=S.slice(committed);
    lastLen=committed; lastWrong=0;
    if(rest.length) onInput();
    else if(!composing) trimCommitted();
  }
}
function complete(){
  var t=cur.term, n=cur.target.keys.length;
  if(!wordErr){ combo++; if(combo>bestCombo) bestCombo=combo; }
  var pts=Math.round(n*2*(1+Math.min(combo,10)*0.1));
  score+=pts; doneCount++; if(learned.indexOf(t)<0) learned.push(t);
  sfxDone(combo);
  cur.fig.tp=1; cur.item.el.classList.add('done');
  var p=document.createElement('div'); p.className='mt-plus'; p.textContent=mode==='challenge'?'+'+pts:'✓'; ui.wordbox.appendChild(p); setTimeout(function(){ p.remove(); },900);
  if(combo>=2){ ui.combo.textContent=combo+' COMBO'; ui.combo.classList.remove('pop'); void ui.combo.offsetWidth; ui.combo.classList.add('pop'); }
  burst();
  hudPaint();
  // 다 그린 그림은 반짝이며 왼쪽으로 빠지고, 다음 용어가 바로 이어짐(빠르게 치는 학생이 기다리지 않도록 지연 없음)
  advance(false);
}
function paintWord(m,wrong){
  if(!cur) return;
  if(m==null){ m=0; wrong=0; }
  var syls=cur.target.syls, html='', caretPut=false;
  var errAt=-1;
  if(wrong>0){ for(var i=0;i<syls.length;i++){ if(!syls[i].space && syls[i].end>m){ errAt=i; break; } } }
  for(var j=0;j<syls.length;j++){
    var s=syls[j];
    if(s.space){ html+='<span class="mt-s sp"> </span>'; continue; }
    var k=Math.max(0,Math.min(s.keys.length,m-s.start));
    var cls='mt-s'+(k===s.keys.length?' dn':'')+(j===errAt?' er':'');
    if(!caretPut && k<s.keys.length && k===0 && phase==='play'){ html+='<span class="mt-caret"></span>'; caretPut=true; }
    html+='<span class="'+cls+'">'+escX(s.ch)+(k>0&&k<s.keys.length?'<span class="pc">'+escX(partialChar(s,k))+'</span>':'')+'</span>';
    if(!caretPut && k>0 && k<s.keys.length && phase==='play'){ html+='<span class="mt-caret"></span>'; caretPut=true; }
  }
  ui.word.innerHTML=html;
  // 글자 크기: 화면 폭에 맞춰
  var n=syls.length, avail=Math.max(200,ui.wordbox.clientWidth-24);
  var base=vw<=480?36:46;
  ui.word.style.fontSize=Math.max(20,Math.min(base,Math.floor(avail/(n*1.05+0.6))))+'px';
  updateKbd(m,wrong);
}
function hudPaint(){
  var el=phase==='play'?Math.max(3000,performance.now()-tStart):0;
  ui.cpm.textContent=el?Math.round(correctKeys/(el/60000)):0;
  ui.acc.textContent=correctKeys+errors?Math.round(correctKeys*100/(correctKeys+errors)):100;
  ui.cnt.textContent=doneCount;
  ui.score.textContent=mode==='practice'?'연습':score;
}

/* ---------- 화면 키보드 (PC) ---------- */
var KROWS=['qwertyuiop','asdfghjkl','zxcvbnm'];
function buildKbd(){
  var h='';
  KROWS.forEach(function(r,i){
    h+='<div class="mt-krow">'+(i===2?'<div class="mt-key wide" data-k="shift">Shift</div>':'')
      +r.split('').map(function(k){ return '<div class="mt-key" data-k="'+k+'">'+LAT[k]+'</div>'; }).join('')
      +(i===2?'<div class="mt-key wide" data-k="bs">⌫</div>':'')+'</div>';
  });
  ui.kbd.innerHTML=h;
}
function updateKbd(m,wrong){
  if(!ui.kbd.classList.contains('on')) return;
  ui.kbd.querySelectorAll('.mt-key.on,.mt-key.bad').forEach(function(k){ k.classList.remove('on','bad'); });
  if(phase!=='play' || !cur) return;
  if(wrong>0){ var b=ui.kbd.querySelector('[data-k="bs"]'); if(b) b.classList.add('bad'); return; }
  var j=cur.target.keys[m]; if(!j) return;
  var info=KEYOF[j]; if(!info) return;
  var e=ui.kbd.querySelector('[data-k="'+info.k+'"]'); if(e) e.classList.add('on');
  if(info.shift){ var s=ui.kbd.querySelector('[data-k="shift"]'); if(s) s.classList.add('on'); }
}

/* ---------- 끝 ---------- */
function finish(){
  phase='result';
  try{ ui.input.blur(); }catch(e){}
  ui.input.value='';
  var el=Math.max(1000,performance.now()-tStart);
  var cpm=Math.round(correctKeys/(el/60000)), acc=correctKeys+errors?Math.round(correctKeys*100/(correctKeys+errors)):0;
  screen('result');
  $('.mt-rlabel').textContent=mode==='challenge'?'TIME UP':'PRACTICE';
  $('.r-cnt').textContent=doneCount; $('.r-cpm').textContent=cpm; $('.r-acc').textContent=acc+'%'; $('.r-combo').textContent=bestCombo;
  var sc=$('.mt-rscore'), best=$('.mt-rbest'), msg=$('.mt-rmsg');
  best.textContent='';
  if(mode==='challenge'){
    countUp(sc,score);
    if(opts.todayBest!=null && score>opts.todayBest) best.textContent='🎉 오늘 내 최고 기록 경신!';
    else if(opts.todayBest==null && score>0) best.textContent='✨ 오늘 첫 기록!';
    msg.textContent='점수 기록하는 중...';
    var p=opts.onChallengeEnd?opts.onChallengeEnd(score):null;
    if(p && p.then) p.then(function(r){ msg.textContent=(r&&r.msg)||''; opts.canChallenge=!!(r&&r.canChallengeMore); }).catch(function(){ msg.textContent='점수 기록 중 오류가 났어요. 인터넷 연결을 확인해주세요.'; });
    else msg.textContent='';
    for(var i=0;i<3;i++) setTimeout(function(){ burst(vw*(0.2+Math.random()*0.6),vh*(0.2+Math.random()*0.3),true); },i*260);
  } else {
    sc.textContent=doneCount+'개'; msg.textContent='연습 모드는 점수가 기록되지 않아요';
  }
  var lc=$('.mt-lchips'), ld=$('.mt-ldesc');
  ld.textContent='';
  lc.innerHTML=learned.length?learned.map(function(t,i){ return '<button class="mt-lchip" data-li="'+i+'">'+escX(t.t)+'</button>'; }).join(''):'<span style="color:#64748b;font-size:12.5px;">아직 완성한 용어가 없어요</span>';
  lc.querySelectorAll('.mt-lchip').forEach(function(b){ b.onclick=function(e){ e.stopPropagation(); var t=learned[+b.getAttribute('data-li')]; ld.innerHTML='<b style="color:#e2e8f0">'+escX(t.t)+'</b> — '+htmlText(t.d); }; });
  clearItems();
}
function countUp(el,to){
  var t0=performance.now(), dur=Math.min(1400,300+to*4);
  (function step(t){ var k=Math.min(1,(t-t0)/dur); el.textContent=Math.round(to*(1-Math.pow(1-k,3))); if(k<1) requestAnimationFrame(step); })(t0);
}

/* ---------- 입자 효과 ---------- */
function initAmbient(){
  amb=[]; var n=(window.innerWidth<600)?34:60;
  for(var i=0;i<n;i++) amb.push({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*0.00012,vy:-0.00004-Math.random()*0.0001,r:0.5+Math.random()*1.3,a:0.15+Math.random()*0.45,ph:Math.random()*6.28});
}
function stageCenter(){
  var r=ui.stage.getBoundingClientRect(), rr=root.getBoundingClientRect();
  return {x:r.left-rr.left+r.width/2, y:r.top-rr.top+r.height/2};
}
function burst(x,y,big){
  if(x==null){ var c=stageCenter(); x=c.x; y=c.y; }
  var n=big?60:(vw<600?46:70);
  for(var i=0;i<n;i++){
    var a=Math.random()*Math.PI*2, sp=(big?2:1.2)+Math.random()*(big?6:4.6);
    parts.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0,max:50+Math.random()*40,r:0.8+Math.random()*1.9,c:Math.random()<0.7?'255,255,255':(Math.random()<.5?'165,243,252':'252,211,77')});
  }
}
function sparkAtCaret(){
  var c=ui.word.querySelector('.mt-caret'); if(!c) return;
  var r=c.getBoundingClientRect(), rr=root.getBoundingClientRect();
  for(var i=0;i<3;i++){ var a=-Math.PI/2+(Math.random()-.5)*1.6, sp=1.2+Math.random()*1.6; parts.push({x:r.left-rr.left,y:r.top-rr.top,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.6,life:0,max:12+Math.random()*10,r:0.6+Math.random()*0.9,c:'165,243,252'}); }
}
var lastT=0, hudT=0;
function loop(t){
  raf=requestAnimationFrame(loop);
  var dt=Math.min(50,t-(lastT||t)); lastT=t;
  // 그림 진행(부드럽게 따라감)
  items.forEach(function(it){ var f=it.fig; if(Math.abs(f.tp-f.dp)>0.001){ f.dp+=(f.tp-f.dp)*Math.min(1,dt*0.014); setFigProgress(f,f.dp); } else if(f.dp!==f.tp){ f.dp=f.tp; setFigProgress(f,f.dp); } });
  if(showFig && phase==='title'){ var f=showFig; f.dp=Math.min(1,f.dp+dt/1500); setFigProgress(f,f.dp<1?f.dp*f.dp*(3-2*f.dp):1); }
  // 타이머
  if(phase==='play' && mode==='challenge'){
    var left=GAME_MS-(t-tStart);
    ui.barI.style.transform='scaleX('+Math.max(0,left/GAME_MS).toFixed(4)+')';
    if(left<10000) ui.bar.classList.add('low');
    if(left<=0){ finish(); }
  }
  if(phase==='play' && t-hudT>400){ hudT=t; hudPaint(); }
  // 입자
  var g=fxc; g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,vw,vh);
  for(var i=0;i<amb.length;i++){
    var p=amb[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.ph+=dt*0.0015;
    if(p.y<-0.02){ p.y=1.02; p.x=Math.random(); } if(p.x<-0.02) p.x=1.02; if(p.x>1.02) p.x=-0.02;
    g.globalAlpha=p.a*(0.6+0.4*Math.sin(p.ph)); g.fillStyle='#cbd5e1';
    g.beginPath(); g.arc(p.x*vw,p.y*vh,p.r,0,6.283); g.fill();
  }
  var k=dt/16.7;
  for(var j=parts.length-1;j>=0;j--){
    var q=parts[j]; q.life+=k; q.x+=q.vx*k; q.y+=q.vy*k; q.vx*=Math.pow(0.94,k); q.vy=q.vy*Math.pow(0.94,k)+0.03*k;
    if(q.life>=q.max){ parts.splice(j,1); continue; }
    g.globalAlpha=Math.max(0,1-q.life/q.max); g.fillStyle='rgb('+q.c+')';
    g.beginPath(); g.arc(q.x,q.y,q.r,0,6.283); g.fill();
  }
  g.globalAlpha=1;
}

window.MathTermGame={ open:open, close:close, terms:TERMS, chapters:CH,
  _render:function(i){ var f=renderFig(TERMS[i]); setFigProgress(f,1); return f.el; },
  // 점검용: 지금 용어를 키 하나씩 입력했을 때 화면에 보일 글자들
  _typingSteps:function(){ if(!cur) return []; var tg=cur.target, out=[];
    for(var k=1;k<=tg.keys.length;k++){ var s=''; tg.syls.forEach(function(y){ if(y.space) return; var kk=Math.max(0,Math.min(y.keys.length,k-y.start)); s+=kk===y.keys.length?y.ch:partialChar(y,kk); }); out.push(s); }
    return out; } };
})();
