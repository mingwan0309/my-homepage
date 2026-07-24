/* ============================================================
   chat-widget.js — 학생용 실시간 채팅 버블 (선생님과 1:1)
   homework/clinic/qna/class/textbook.html 에 공통으로 삽입.
   firebase-api.js 의 window.mkdbReady/mkGenId/mkNowStr 를 사용.
   ============================================================ */
(function(){
'use strict';

function init(){
  var session = JSON.parse(localStorage.getItem('mkmath_session')||'null');
  if(!session || session.role!=='student') return;
  var studentId = String(session.id);
  var panelOpen = false;
  var msgsUnsub = null, threadUnsub = null;

  injectStyles();
  injectWidget();

  function injectStyles(){
    var css =
      '#mk-chat-bubble{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;cursor:pointer;box-shadow:0 4px 16px rgba(37,99,235,0.4);z-index:9998;border:none;}'
      +'#mk-chat-badge{position:absolute;top:-2px;right:-2px;background:#ef4444;color:#fff;font-size:11px;font-weight:800;min-width:18px;height:18px;border-radius:9px;display:none;align-items:center;justify-content:center;padding:0 4px;}'
      +'#mk-chat-panel{position:fixed;bottom:88px;right:20px;width:320px;max-width:90vw;height:420px;max-height:70vh;background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;z-index:9999;font-family:"Pretendard","맑은 고딕",sans-serif;}'
      +'#mk-chat-panel.open{display:flex;}'
      +'#mk-chat-head{background:#1e293b;color:#fff;padding:12px 16px;font-size:14px;font-weight:700;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}'
      +'#mk-chat-body{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px;}'
      +'.mk-msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;}'
      +'.mk-msg.me{align-self:flex-end;background:#2563eb;color:#fff;border-bottom-right-radius:4px;}'
      +'.mk-msg.other{align-self:flex-start;background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-bottom-left-radius:4px;}'
      +'#mk-chat-input-row{display:flex;border-top:1px solid #f1f5f9;padding:8px;gap:6px;flex-shrink:0;}'
      +'#mk-chat-input{flex:1;border:1.5px solid #e2e8f0;border-radius:20px;padding:8px 14px;font-size:13px;outline:none;font-family:inherit;}'
      +'#mk-chat-send{background:#2563eb;color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:16px;cursor:pointer;flex-shrink:0;}'
      +'@media (max-width:768px){#mk-chat-panel{right:10px;bottom:80px;width:90vw;}#mk-chat-bubble{right:14px;bottom:14px;}}';
    var style=document.createElement('style');
    style.textContent=css;
    document.head.appendChild(style);
  }

  function injectWidget(){
    var bubble=document.createElement('button');
    bubble.id='mk-chat-bubble';
    bubble.innerHTML='💬<span id="mk-chat-badge"></span>';
    bubble.onclick=togglePanel;
    document.body.appendChild(bubble);

    var panel=document.createElement('div');
    panel.id='mk-chat-panel';
    panel.innerHTML=
      '<div id="mk-chat-head"><span>💬 김민관 선생님과 대화</span><span id="mk-chat-close" style="cursor:pointer;">✕</span></div>'
      +'<div id="mk-chat-body"></div>'
      +'<div id="mk-chat-input-row"><input id="mk-chat-input" placeholder="메시지 입력..."><button id="mk-chat-send">➤</button></div>';
    document.body.appendChild(panel);
    document.getElementById('mk-chat-close').onclick=togglePanel;
    document.getElementById('mk-chat-send').onclick=sendMsg;
    document.getElementById('mk-chat-input').addEventListener('keydown', function(e){
      if(e.key==='Enter'){ e.preventDefault(); sendMsg(); }
    });
  }

  function togglePanel(){
    panelOpen=!panelOpen;
    document.getElementById('mk-chat-panel').classList.toggle('open', panelOpen);
    if(panelOpen) markRead();
  }
  function markRead(){
    window.mkdbReady.then(function(db){
      db.collection('chat_threads').doc(studentId).set({unreadForStudent:0},{merge:true}).catch(function(){});
    });
  }
  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function sendMsg(){
    var input=document.getElementById('mk-chat-input');
    var text=input.value.trim();
    if(!text) return;
    input.value='';
    var db=await window.mkdbReady;
    var id=window.mkGenId('msg');
    await db.collection('chat_messages').doc(id).set({
      id:id, studentId:studentId, sender:'student', text:text, createdAt:window.mkNowStr()
    });
    await db.collection('chat_threads').doc(studentId).set({
      studentId:studentId, studentName:session.name||studentId,
      lastMessage:text, lastAt:window.mkNowStr(),
      unreadForTeacher: firebase.firestore.FieldValue.increment(1)
    },{merge:true});
  }

  window.mkdbReady.then(function(db){
    msgsUnsub=db.collection('chat_messages').where('studentId','==',studentId).onSnapshot(function(snap){
      var msgs=[];
      snap.forEach(function(doc){ msgs.push(doc.data()); });
      msgs.sort(function(a,b){ return (a.createdAt||'') < (b.createdAt||'') ? -1 : 1; });
      var body=document.getElementById('mk-chat-body');
      body.innerHTML=msgs.map(function(m){
        return '<div class="mk-msg '+(m.sender==='student'?'me':'other')+'">'+escapeHtml(m.text)+'</div>';
      }).join('');
      body.scrollTop=body.scrollHeight;
    });
    threadUnsub=db.collection('chat_threads').doc(studentId).onSnapshot(function(doc){
      var badge=document.getElementById('mk-chat-badge');
      var n=doc.exists?(doc.data().unreadForStudent||0):0;
      if(!panelOpen && n>0){ badge.textContent = n>9?'9+':n; badge.style.display='flex'; }
      else { badge.style.display='none'; }
    });
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
