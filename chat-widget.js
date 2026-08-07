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
      +'@media (max-width:768px){#mk-chat-panel{right:10px;bottom:80px;width:90vw;}#mk-chat-bubble{right:14px;bottom:14px;}}'
      +'#mk-notice-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10000;align-items:center;justify-content:center;padding:20px;}'
      +'#mk-notice-overlay.open{display:flex;}'
      +'#mk-notice-modal{background:#fff;border-radius:16px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;padding:22px;position:relative;font-family:"Pretendard","맑은 고딕",sans-serif;}'
      +'#mk-notice-modal h2{font-size:18px;font-weight:900;color:#1e293b;margin-bottom:14px;}'
      +'#mk-notice-close{position:absolute;top:16px;right:18px;font-size:22px;cursor:pointer;color:#94a3b8;background:none;border:none;}'
      +'.mk-notice-item{padding:14px 0;border-bottom:1px solid #f1f5f9;}'
      +'.mk-notice-item:last-child{border-bottom:none;}'
      +'.mk-notice-title{font-size:14.5px;font-weight:800;color:#1e293b;margin-bottom:4px;}'
      +'.mk-notice-date{font-size:11.5px;color:#94a3b8;margin-bottom:8px;}'
      +'.mk-notice-content{font-size:13.5px;color:#475569;line-height:1.7;white-space:pre-line;}'
      +'.mk-notice-empty{text-align:center;color:#94a3b8;font-size:13.5px;padding:40px 0;}';
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

    var noticeOverlay=document.createElement('div');
    noticeOverlay.id='mk-notice-overlay';
    noticeOverlay.innerHTML=
      '<div id="mk-notice-modal">'
        +'<button id="mk-notice-close">✕</button>'
        +'<h2>📢 공지사항</h2>'
        +'<div id="mk-notice-body"></div>'
      +'</div>';
    document.body.appendChild(noticeOverlay);
    document.getElementById('mk-notice-close').onclick=closeNoticeModal;
    noticeOverlay.addEventListener('click', function(e){ if(e.target===noticeOverlay) closeNoticeModal(); });
  }

  function closeNoticeModal(){
    document.getElementById('mk-notice-overlay').classList.remove('open');
  }
  function openNoticeModal(){
    document.getElementById('mk-notice-overlay').classList.add('open');
    if(noticeItems.length){
      localStorage.setItem('mkmath_notice_seen', JSON.stringify(noticeItems.map(function(n){return n.id;})));
    }
    ['notice-nav-badge','notice-nav-badge-m'].forEach(function(id){
      var b=document.getElementById(id);
      if(b) b.style.display='none';
    });
  }
  function renderNoticeBody(){
    var body=document.getElementById('mk-notice-body');
    if(!body) return;
    if(!noticeItems.length){ body.innerHTML='<div class="mk-notice-empty">등록된 공지사항이 없습니다.</div>'; return; }
    body.innerHTML=noticeItems.map(function(n){
      var dateLabel=(n.createdAt||'').slice(0,10).replace(/-/g,'.');
      return '<div class="mk-notice-item"><div class="mk-notice-title">'+escapeHtml(n.title)+'</div><div class="mk-notice-date">'+dateLabel+'</div><div class="mk-notice-content">'+escapeHtml(n.content)+'</div></div>';
    }).join('');
  }
  var noticeItems=[];
  window.mkOpenNoticeModal=openNoticeModal;

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
      var hint=msgs.length?'':'<div style="text-align:center;font-size:12px;color:#94a3b8;padding:10px 6px;">여기는 선생님과 1:1로만 보이는 대화예요.<br>다른 학생도 궁금해할 문제 질문은 <a href="qna.html" style="color:#2563eb;font-weight:700;">질의응답</a>에 남겨주세요.</div>';
      body.innerHTML=hint+msgs.map(function(m){
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

    // 내 질문 중 답변이 달렸는데 아직 안 본 것 — 질의응답 네비 배지
    var navBadge=document.getElementById('qna-nav-badge');
    if(navBadge){
      db.collection('qna').where('studentId','==',studentId).where('status','==','answered').get().then(function(snap){
        var seen=JSON.parse(localStorage.getItem('mkmath_qna_seen')||'[]');
        var unseenCount=0;
        snap.forEach(function(doc){ if(seen.indexOf(doc.id)<0) unseenCount++; });
        if(unseenCount>0){ navBadge.textContent=unseenCount>9?'9+':unseenCount; navBadge.style.display='flex'; }
      }).catch(function(){});
    }

    // 공지사항 — 새 공지 배지 + 팝업
    db.collection('notices').get().then(function(snap){
      noticeItems=[];
      snap.forEach(function(doc){ noticeItems.push(doc.data()); });
      noticeItems.sort(function(a,b){ return (b.createdAt||'') < (a.createdAt||'') ? -1 : 1; });
      renderNoticeBody();
      var seen=JSON.parse(localStorage.getItem('mkmath_notice_seen')||'[]');
      var unseenCount=noticeItems.filter(function(n){ return seen.indexOf(n.id)<0; }).length;
      ['notice-nav-badge','notice-nav-badge-m'].forEach(function(id){
        var b=document.getElementById(id);
        if(b && unseenCount>0){ b.textContent=unseenCount>9?'9+':unseenCount; b.style.display='flex'; }
      });
    }).catch(function(){});
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
