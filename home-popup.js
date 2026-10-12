// 홈페이지 팝업 (2026-10-12) — index.html(방문자)과 mypage.html(로그인 학생) 공용.
// 관리 페이지 "🏠 홈페이지 팝업"에서 쓴 내용을 카드로 띄움. 카드를 누르면 사라짐.
// "학생 글쓰기 받기"가 켜진 팝업은 글쓰기 칸이 붙고, 보낸 글은 home_popup_replies에 쌓여 선생님 관리 화면에서 봄.
// 사용: mkShowHomePopups({ url: 'Apps Script 주소', session: mkmath_session 객체 또는 null })
(function(){
  var COLORS = { blue:'#2563eb', red:'#dc2626', green:'#059669', orange:'#ea580c', purple:'#7c3aed', dark:'#1e293b' };
  var HIDE_KEY = 'mkmath_homepopup_hide';
  var SENT_KEY = 'mkmath_homepopup_sent';   // {팝업id: true} — 이 기기에서 이미 글을 보낸 팝업
  function esc(t){ return String(t||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function today(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function getMap(k){ try{ return JSON.parse(localStorage.getItem(k)||'{}'); }catch(e){ return {}; } }
  function setMap(k,m){ try{ localStorage.setItem(k, JSON.stringify(m)); }catch(e){} }

  window.mkShowHomePopups = function(opt){
    opt = opt || {};
    var url = opt.url, sess = opt.session || null;
    fetch(url + '?action=getHomePopups').then(function(r){ return r.json(); }).then(function(r){
      var t = today(), hide = getMap(HIDE_KEY);
      var list = ((r && r.popups) || []).filter(function(p){
        if (!p.active) return false;
        if (p.startDate && t < p.startDate) return false;
        if (p.endDate && t > p.endDate) return false;
        return hide[p.id] !== t;
      });
      if (!list.length) return;
      var old = document.getElementById('home-popup-bg'); if (old) old.remove();
      var bg = document.createElement('div');
      bg.id = 'home-popup-bg';
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;';
      var stack = document.createElement('div');
      stack.style.cssText = 'position:relative;width:100%;max-width:420px;';

      function removeCard(card){
        card.remove();
        var left = stack.children;
        if (!left.length) { bg.remove(); return; }
        var top = left[left.length - 1];
        top.style.position = 'relative'; top.style.transform = '';
      }

      list.slice().reverse().forEach(function(p, i){
        var card = document.createElement('div');
        var c = COLORS[p.color] || COLORS.blue;
        var depth = list.length - 1 - i; // 0 = 맨 위
        var canReply = !!p.allowReply;
        card.style.cssText = 'background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);cursor:pointer;max-height:78vh;overflow-y:auto;'
          + (depth === 0 ? 'position:relative;' : 'position:absolute;left:0;right:0;top:0;transform:translateY(' + (-8*depth) + 'px) scale(' + (1-0.03*depth) + ');');
        var html = '<div style="background:' + c + ';color:#fff;padding:18px 20px;font-size:19px;font-weight:800;line-height:1.4;">' + esc(p.title || '안내') + '</div>'
          + (p.content ? '<div style="padding:18px 20px 6px;font-size:15px;color:#334155;line-height:1.7;white-space:pre-wrap;word-break:keep-all;">' + esc(p.content) + '</div>' : '');
        if (canReply) {
          var sent = getMap(SENT_KEY)[p.id];
          html += '<div class="hp-reply" style="padding:10px 20px 4px;cursor:default;">'
            + (sent ? '<div style="font-size:13px;color:#059669;font-weight:700;margin-bottom:8px;">✅ 이미 글을 보냈어요. 더 보내도 돼요.</div>' : '')
            + (sess && sess.name ? '' : '<input class="hp-name" type="text" maxlength="20" placeholder="이름" style="width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:16px;font-family:inherit;margin-bottom:8px;">')
            + '<textarea class="hp-text" rows="3" maxlength="1000" placeholder="' + esc(p.replyPrompt || '여기에 글을 써주세요') + '" style="width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:16px;font-family:inherit;resize:vertical;"></textarea>'
            + '<div class="hp-msg" style="font-size:13px;min-height:18px;margin:6px 0;"></div>'
            + '<div style="display:flex;gap:8px;">'
            +   '<button class="hp-close" type="button" style="flex:1;min-height:46px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">닫기</button>'
            +   '<button class="hp-send" type="button" style="flex:2;min-height:46px;border:none;background:' + c + ';color:#fff;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;">보내기</button>'
            + '</div></div>'
            + '<div style="padding:8px 20px 14px;font-size:12px;color:#94a3b8;text-align:center;">' + (list.length > 1 ? (depth + 1) + '/' + list.length : '') + '</div>';
        } else {
          html += '<div style="padding:8px 20px 16px;font-size:12px;color:#94a3b8;text-align:center;">눌러서 닫기' + (list.length > 1 ? ' (' + (depth + 1) + '/' + list.length + ')' : '') + '</div>';
        }
        card.innerHTML = html;
        card.onclick = function(e){
          e.stopPropagation();
          if (canReply) return; // 글쓰기 카드는 실수로 닫히지 않게 "닫기" 버튼으로만 닫음
          removeCard(card);
        };
        if (canReply) {
          card.querySelector('.hp-close').onclick = function(e){ e.stopPropagation(); removeCard(card); };
          card.querySelector('.hp-send').onclick = function(e){
            e.stopPropagation();
            var btn = this, msg = card.querySelector('.hp-msg');
            var text = card.querySelector('.hp-text').value.trim();
            var nameEl = card.querySelector('.hp-name');
            var name = sess && sess.name ? (sess.name + (sess.authId && sess.authId !== sess.id ? ' 학부모' : '')) : (nameEl ? nameEl.value.trim() : '');
            if (!name) { msg.style.color = '#dc2626'; msg.textContent = '이름을 써주세요.'; return; }
            if (!text) { msg.style.color = '#dc2626'; msg.textContent = '내용을 써주세요.'; return; }
            btn.disabled = true; btn.textContent = '보내는 중...';
            fetch(url, { method:'POST', body: JSON.stringify({
              action:'submitHomePopupReply', popupId:p.id, popupTitle:p.title || '', name:name, text:text,
              studentId: sess ? String(sess.authId || sess.id || '') : ''
            }) }).then(function(x){ return x.json(); }).then(function(res){
              if (!res || !res.success) throw new Error((res && res.error) || '');
              var m = getMap(SENT_KEY); m[p.id] = true; setMap(SENT_KEY, m);
              msg.style.color = '#059669'; msg.textContent = '✅ 보냈어요! 고마워요.';
              setTimeout(function(){ removeCard(card); }, 1200);
            }).catch(function(){
              btn.disabled = false; btn.textContent = '보내기';
              msg.style.color = '#dc2626'; msg.textContent = '보내지 못했어요. 잠시 후 다시 시도해주세요.';
            });
          };
        }
        stack.appendChild(card);
      });

      var noToday = document.createElement('button');
      noToday.textContent = '오늘 하루 보지 않기';
      noToday.style.cssText = 'margin-top:14px;min-height:44px;padding:10px 18px;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:22px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;';
      noToday.onclick = function(e){
        e.stopPropagation();
        var m = getMap(HIDE_KEY); list.forEach(function(p){ m[p.id] = t; }); setMap(HIDE_KEY, m);
        bg.remove();
      };
      // 바깥을 누르면 닫힘. 단 글쓰기 카드가 남아 있으면 쓰던 글이 날아가지 않게 안 닫음.
      bg.onclick = function(){
        var typing = [].some.call(stack.querySelectorAll('.hp-text'), function(el){ return el.value.trim(); });
        if (!typing) bg.remove();
      };
      bg.appendChild(stack); bg.appendChild(noToday);
      document.body.appendChild(bg);
    }).catch(function(){});
  };
})();
