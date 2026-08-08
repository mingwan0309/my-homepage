/* ============================================================
   firebase-api.js — 김민관 수학 홈페이지 백엔드 (Firebase Firestore)
   기존 Apps Script(script.google.com) 요청을 가로채서 Firestore로 처리.
   파일 업로드(uploadFile)만 기존 Apps Script로 통과시킴 (Google Drive 저장).
   ============================================================ */
(function(){
'use strict';

// Code.gs(파일 업로드/알림톡 발송)를 외부에서 직접 호출 못 하도록 확인하는 앱 전용 토큰.
// 완벽한 비밀은 아니지만(소스 보면 보임), 아무나 URL만 알아내서 막 호출하는 걸 막는 최소 방어선.
var APP_SHARED_TOKEN = 'mkmath-2026-app-a91f3c';

var firebaseConfig = {
  apiKey: "AIzaSyCJR-nKFY9qNxMma-dj_7x3FB1BwEDzkRY",
  authDomain: "mkmath-54f5d.firebaseapp.com",
  projectId: "mkmath-54f5d",
  storageBucket: "mkmath-54f5d.firebasestorage.app",
  messagingSenderId: "238083527582",
  appId: "1:238083527582:web:bdcc88f52ccaae85563c8f"
};

/* ---------- Firebase SDK 동적 로드 ---------- */
var _dbReady = new Promise(function(resolve, reject){
  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      (document.head || document.documentElement).appendChild(s);
    });
  }
  loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
    .then(function(){ return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'); })
    .then(function(){ return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'); })
    .then(function(){
      firebase.initializeApp(firebaseConfig);
      // 브라우저에 저장된 로그인 정보(구글 인증 세션)가 완전히 확인될 때까지 대기.
      // 이걸 안 기다리면 페이지 이동 직후 요청이 "로그인 안 된 상태"로 나가서 권한 오류가 남.
      var unsub = firebase.auth().onAuthStateChanged(function(){
        unsub();
        resolve(firebase.firestore());
      });
    })
    .catch(reject);
});

var AUTH_DOMAIN_SUFFIX = '@mkmath.local';
function toAuthEmail(loginId){ return loginId + AUTH_DOMAIN_SUFFIX; }
// 하이픈 없는 번호 → 하이픈 있는 번호 변환 (010-XXXX-XXXX)
function addPhoneDashes(id){
  var d = id.replace(/[-\s]/g,'');
  if(/^\d{11}$/.test(d)) return d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7);
  if(/^\d{10}$/.test(d)) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6);
  return id;
}
// Firebase 로그인은 비밀번호 6자 이상이 필요함. 짧은 비번(예: 1234)은 뒤에 0을 채워서 맞춤.
function toAuthPassword(pw){
  pw = String(pw);
  while (pw.length < 6) pw += '0';
  return pw;
}

/* ---------- 유틸 ---------- */
function nowStr(){
  var d = new Date();
  function p(n){ return (n<10?'0':'')+n; }
  return d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
}
function genId(prefix){ return prefix + '_' + Date.now() + '_' + Math.floor(Math.random()*1000); }
function docsToArr(snap){
  var arr = [];
  snap.forEach(function(doc){ var d = doc.data(); d._docId = doc.id; arr.push(d); });
  return arr;
}

/* ---------- API 구현 ---------- */
var api = {};

/* === 로그인 / 학생 === */
function fetchProfileAfterAuth(db, loginId){
  return db.collection('students').doc(loginId).get().then(function(doc){
    if (!doc.exists) return { success:false };
    var u = doc.data();
    if (u.active === false) return { success:false, msg:'비활성화된 계정입니다. 선생님께 문의해주세요.' };
    var role = u.role || 'student';
    var result = { success:true, role:role, name:u.name || u.id, classId:'', className:'', studentId:loginId };
    if (role === 'student' && u.classId) {
      result.classId = String(u.classId);
      return db.collection('classes').doc(String(u.classId)).get().then(function(c){
        if (c.exists) result.className = c.data().name || '';
        return result;
      });
    }
    return result;
  });
}

api.login = function(db, p){
  var loginId = String(p.id);
  var password = String(p.password);
  var auth = firebase.auth();

  // 하이픈 제거 버전, 하이픈 추가 버전 미리 계산
  var stripped = loginId.replace(/[-\s]/g,'');
  var dashed = addPhoneDashes(stripped);

  // Auth 시도 후보: 입력값, 하이픈 추가, 하이픈 제거 (중복 제거)
  var authIds = [loginId];
  if (dashed !== loginId) authIds.push(dashed);
  if (stripped !== loginId) authIds.push(stripped);

  // Firestore 조회 후보: 같은 목록
  var fsIds = authIds.slice();

  // 성공한 authId를 기준으로 Firestore 조회 (보안규칙: 본인 ID 문서만 읽기 가능)
  var afterSignIn = function(authId){
    var docIds = [authId];
    var altDashed = addPhoneDashes(authId.replace(/[-\s]/g,''));
    if (altDashed !== authId) docIds.push(altDashed);
    var altStripped = authId.replace(/[-\s]/g,'');
    if (altStripped !== authId) docIds.push(altStripped);

    // 학부모 번호로 로그인한 경우: 저장된 학부모번호 형식(하이픈 유무)이 달라도 찾도록 여러 형식으로 조회
    var parentCands = [];
    [authId, addPhoneDashes(authId.replace(/[-\s]/g,'')), authId.replace(/[-\s]/g,'')].forEach(function(c){
      if (c && parentCands.indexOf(c) < 0) parentCands.push(c);
    });
    var tryParent = function(j){
      if (j >= parentCands.length) return { success:false };
      return db.collection('students').where('parentPhone','==',parentCands[j]).limit(1).get().then(function(snap){
        if (snap.empty) return tryParent(j+1);
        var u = snap.docs[0].data(); var sid = snap.docs[0].id;
        if (u.active === false) return { success:false, msg:'비활성화된 계정입니다. 선생님께 문의해주세요.' };
        var res = { success:true, role:'student', name:u.name||sid, classId:'', className:'', studentId:sid };
        if (!u.classId) return res;
        res.classId = String(u.classId);
        return db.collection('classes').doc(res.classId).get().then(function(c){
          if (c.exists) res.className = c.data().name||'';
          return res;
        });
      }, function(){ return tryParent(j+1); });  // 권한거부 등도 다음 형식 시도
    };
    var tryStudentDoc = function(i){
      if (i >= docIds.length) return tryParent(0);
      return db.collection('students').doc(docIds[i]).get().then(function(doc){
        if (doc.exists) return fetchProfileAfterAuth(db, docIds[i]);
        return tryStudentDoc(i+1);
      }, function(){ return tryStudentDoc(i+1); });
    };
    // 조교 계정을 학생 계정보다 먼저 확인 — 같은 전화번호가 (예전) 학생 문서와 조교 문서 양쪽에
    // 다 있는 경우(예: 학생이었다가 조교로 채용된 경우) 조교로 로그인되어야 하는데 학생으로 잘못 뜨는 걸 방지.
    var tryAssistantDoc = function(j){
      if (j >= docIds.length) return tryStudentDoc(0);
      return db.collection('assistants').doc(docIds[j]).get().then(function(doc){
        if (!doc.exists) return tryAssistantDoc(j+1);
        var a = doc.data();
        if (a.active === false) return { success:false, msg:'비활성화된 계정입니다. 선생님께 문의해주세요.' };
        return { success:true, role:'assistant', name:a.name||a.id, classId:'', className:'', studentId:a.id, studentIds:a.studentIds||[] };
      }, function(){ return tryAssistantDoc(j+1); });
    };
    return tryAssistantDoc(0);
  };

  var tryAuth = function(i){
    if (i >= authIds.length) return Promise.resolve({ success:false });
    return auth.signInWithEmailAndPassword(toAuthEmail(authIds[i]), toAuthPassword(password))
      .then(function(){ return afterSignIn(authIds[i]); }, function(){ return tryAuth(i+1); });
  };
  return tryAuth(0);
};

api.addStudent = function(db, p){
  var sid = String(p.sid || p.studentPhone || '');
  if (!sid) return Promise.resolve({ success:false, msg:'아이디가 없습니다.' });
  var ref = db.collection('students').doc(sid);
  var pw = String(p.spw || '1234');
  return ref.get().then(function(doc){
    if (doc.exists) return { success:false, msg:'이미 존재하는 아이디입니다.' };
    return ref.set({
      id: sid, password: pw, role:'student',
      name: p.sname || '', parentPhone: p.parentPhone || '',
      school: p.school || '', grade: p.grade || '', gender: p.gender || '',
      classId: p.classId || '', active:true, createdAt: nowStr()
    }).then(function(){
      // 별도의 보조 앱으로 로그인 계정을 생성해서 현재(선생님) 로그인 세션이 끊기지 않게 함
      var secondary;
      try { secondary = firebase.app('mk-secondary'); }
      catch(e) { secondary = firebase.initializeApp(firebase.app().options, 'mk-secondary'); }
      var parentPhone = String(p.parentPhone || '');
      return secondary.auth().createUserWithEmailAndPassword(toAuthEmail(sid), toAuthPassword(pw))
        .then(function(){ return secondary.auth().signOut(); })
        .catch(function(){})
        .then(function(){
          // 학부모 전화번호가 있으면 별도 로그인 계정 생성 (초기 비번 123456)
          if (!parentPhone) return { success:true };
          return secondary.auth().createUserWithEmailAndPassword(toAuthEmail(parentPhone), toAuthPassword('123456'))
            .then(function(){ return secondary.auth().signOut(); })
            .catch(function(){})
            .then(function(){ return { success:true }; });
        });
    });
  });
};

api.getStudents = function(db){
  return db.collection('students').where('role','==','student').get().then(function(snap){
    var students = docsToArr(snap).map(function(r){
      return { id:String(r.id), studentPhone:String(r.id), parentPhone:r.parentPhone||'', name:r.name||'',
        school:r.school||'', grade:r.grade||'', gender:r.gender||'', classId:String(r.classId||''),
        active: r.active !== false, createdAt: r.createdAt||'' };
    });
    return { students: students };
  });
};

api.updateStudentInfo = function(db, p){
  var ref = db.collection('students').doc(String(p.id));
  var data = {};
  ['name','parentPhone','school','grade','gender'].forEach(function(k){ if (p[k] !== undefined) data[k] = p[k]; });
  return ref.update(data).then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.setStudentActive = function(db, p){
  var active = (p.active === 'true' || p.active === true);
  return db.collection('students').doc(String(p.id)).update({ active: active })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.deleteStudentAccount = function(db, p){
  return db.collection('students').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

// 학부모 로그인 계정이 (고아 계정 충돌 등으로) 안 만들어졌을 때 다시 시도.
// status: 'created'(새로 생성됨) / 'ok'(이미 있고 123456으로 정상 로그인 확인됨) /
//         'wrong_password'(계정은 있는데 123456으로 로그인 안 됨 → 콘솔에서 삭제 후 재시도 필요) / 'error'
api.createParentAccount = function(db, p){
  return db.collection('students').doc(String(p.id)).get().then(function(doc){
    if (!doc.exists) return { success:false, status:'error', msg:'학생을 찾을 수 없습니다.' };
    var u = doc.data();
    var parentPhone = String(u.parentPhone || '');
    if (!parentPhone) return { success:false, status:'error', msg:'학부모 전화번호가 등록되어 있지 않습니다.' };
    var secondary;
    try { secondary = firebase.app('mk-secondary'); }
    catch(e) { secondary = firebase.initializeApp(firebase.app().options, 'mk-secondary'); }
    var email = toAuthEmail(parentPhone);
    return secondary.auth().createUserWithEmailAndPassword(email, toAuthPassword('123456'))
      .then(function(){
        return secondary.auth().signOut().then(function(){ return { success:true, status:'created', parentPhone:parentPhone }; });
      })
      .catch(function(err){
        if (err.code === 'auth/too-many-requests') {
          return { success:false, status:'error', code:err.code, msg:'요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' };
        }
        if (err.code !== 'auth/email-already-in-use') {
          return { success:false, status:'error', code:err.code||'', msg:(err.code||'')+' '+(err.message||'생성 실패') };
        }
        // 이미 계정이 있음 → 실제로 123456 비밀번호로 로그인이 되는지 검증
        return secondary.auth().signInWithEmailAndPassword(email, toAuthPassword('123456'))
          .then(function(){
            return secondary.auth().signOut().then(function(){ return { success:true, status:'ok', parentPhone:parentPhone }; });
          })
          .catch(function(){
            return secondary.auth().signOut().catch(function(){}).then(function(){
              return { success:false, status:'wrong_password', parentPhone:parentPhone, msg:'계정은 있는데 123456으로 로그인이 안 돼요. Firebase 콘솔에서 '+email+' 계정을 삭제 후 다시 시도해주세요.' };
            });
          });
      });
  });
};

api.changePassword = function(db, p){
  var studentId = String(p.id);
  var authId = String(p.authId || p.id); // 로그인에 쓴 번호 (학생 또는 학부모 번호)
  var isParent = (authId !== studentId);
  var oldPw = String(p.oldPassword || p.oldPw || ''), newPw = String(p.newPassword || p.newPw || '');
  var user = firebase.auth().currentUser;
  if (!user) return Promise.resolve({ success:false, msg:'로그인이 필요합니다.' });
  // Firebase Auth 재인증 + 비밀번호 변경
  var cred = firebase.auth.EmailAuthProvider.credential(toAuthEmail(authId), toAuthPassword(oldPw));
  return user.reauthenticateWithCredential(cred)
    .then(function(){ return user.updatePassword(toAuthPassword(newPw)); })
    .then(function(){
      // 학생 본인 비번 변경일 때만 Firestore에도 기록
      if (!isParent) {
        return db.collection('students').doc(studentId).update({ password: newPw });
      }
    })
    .then(function(){ return { success:true }; })
    .catch(function(e){
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        return { success:false, msg:'현재 비밀번호가 틀렸습니다.' };
      }
      return { success:false, msg:'비밀번호 변경 실패' };
    });
};

api.getStudentInfo = function(db, p){
  return db.collection('students').doc(String(p.id)).get().then(function(doc){
    if (!doc.exists) return { success:false };
    var d = doc.data();
    return { success:true, name:d.name||'', school:d.school||'', cls:d.classId||'' };
  });
};

/* === 후기 === */
api.getReviews = function(db){
  return db.collection('reviews').get().then(function(snap){
    var reviews = docsToArr(snap)
      .filter(function(r){ return String(r.hidden) !== 'true'; })
      .sort(function(a,b){ return (a.createdAt||'') < (b.createdAt||'') ? -1 : 1; })
      .map(function(r){ return { id:r.id, text:r.text||'', studentId:r.studentId||'', name:r.name||'', date:r.date||'' }; });
    return { reviews: reviews };
  });
};
api.getAllReviews = api.getReviews;

api.submitReview = function(db, p){
  var id = genId('rv');
  return db.collection('reviews').doc(id).set({
    id:id, text:p.text||'', studentId:p.id||'', name:p.name||'', date:nowStr(), hidden:'false', createdAt:nowStr()
  }).then(function(){ return { success:true }; });
};

api.addReview = function(db, p){
  var id = genId('rv');
  return db.collection('reviews').doc(id).set({
    id:id, text:p.text||'', studentId:p.studentId||'', name:'', date:nowStr(), hidden:'false', createdAt:nowStr()
  }).then(function(){ return { success:true }; });
};

api.hideReview = function(db, p){
  return db.collection('reviews').doc(String(p.id)).update({ hidden:'true' })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.deleteReview = function(db, p){
  if (p.id) {
    return db.collection('reviews').doc(String(p.id)).delete()
      .then(function(){ return { success:true }; }, function(){ return { success:false }; });
  }
  // index 기반 삭제 (homework.html 관리 탭)
  var idx = parseInt(p.index);
  return api.getReviews(db).then(function(r){
    var target = r.reviews[idx];
    if (!target) return { success:false };
    return db.collection('reviews').doc(String(target.id)).delete().then(function(){ return { success:true }; });
  });
};

api.updateReview = function(db, p){
  return db.collection('reviews').doc(String(p.id)).update({ text:p.text||'' })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.initReviews = function(){ return Promise.resolve({ success:true, msg:'Firestore에서는 초기화가 필요 없습니다.' }); };

/* === 질의응답 === */
api.submitQuestion = function(db, p){
  var id = genId('q');
  return db.collection('qna').doc(id).set({
    id:id, title:p.title||'', content:p.content||'', studentId:p.studentId||'',
    studentName:p.studentName||'', date:nowStr(), status:'open', secret:String(p.secret||'false')
  }).then(function(){ return { success:true, id:id }; });
};

api.getQuestions = function(db, p){
  return db.collection('qna').get().then(function(snap){
    var isTeacher = p.role === 'teacher';
    var myId = p.studentId || '';
    var questions = docsToArr(snap)
      .filter(function(r){ return r.status !== 'deleted'; })
      .sort(function(a,b){ return (a.date||'') < (b.date||'') ? 1 : -1; })
      .map(function(r){
        var isSecret = String(r.secret) === 'true';
        var isOwner = String(r.studentId) === myId;
        var canSee = isTeacher || isOwner || !isSecret;
        return { id:r.id, title:canSee ? r.title : '비밀글입니다.', studentId:r.studentId,
                 studentName:canSee ? (r.studentName||'') : '비밀', date:r.date, status:r.status, secret:isSecret, canSee:canSee };
      });
    return { questions: questions };
  });
};

api.getQuestion = function(db, p){
  return db.collection('qna').doc(String(p.id)).get().then(function(doc){
    if (!doc.exists) return { success:false };
    var q = doc.data();
    var isTeacher = p.role === 'teacher';
    var myId = p.studentId || '';
    var isSecret = String(q.secret) === 'true';
    var isOwner = String(q.studentId) === myId;
    if (isSecret && !isTeacher && !isOwner) return { success:false, msg:'비밀글입니다.' };
    var tasks = [
      db.collection('qna_answers').where('questionId','==',String(p.id)).get(),
      db.collection('qna').where('studentId','==',String(q.studentId)).get(),
      db.collection('students').doc(String(q.studentId)).get()
    ];
    return Promise.all(tasks).then(function(res){
      var answer = null;
      if (!res[0].empty) {
        var a = res[0].docs[0].data();
        answer = { id:a.id, questionId:a.questionId, content:a.content, date:a.date };
      }
      var otherQs = docsToArr(res[1])
        .filter(function(r){ return r.id !== q.id && r.status !== 'deleted'; })
        .sort(function(a,b){ return (a.date||'') < (b.date||'') ? 1 : -1; })
        .slice(0,5)
        .map(function(r){ return { id:r.id, title:r.title, date:r.date, status:r.status }; });
      var school = '', cls = '';
      if (res[2].exists) { school = res[2].data().school||''; cls = res[2].data().classId||''; }
      return { success:true,
        question:{ id:q.id, title:q.title, content:q.content, studentId:q.studentId, studentName:q.studentName, date:q.date, status:q.status, secret:isSecret },
        answer:answer, otherQuestions:otherQs, studentInfo:{ school:school, cls:cls } };
    });
  });
};

api.updateQuestion = function(db, p){
  var ref = db.collection('qna').doc(String(p.id));
  return ref.update({ title:p.title||'', content:p.content||'', secret:String(p.secret||'false') })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.deleteQuestion = function(db, p){
  return db.collection('qna').doc(String(p.id)).update({ status:'deleted' })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.submitAnswer = function(db, p){
  var id = genId('a');
  return db.collection('qna_answers').doc(id).set({
    id:id, questionId:String(p.questionId||''), content:p.content||'', date:nowStr()
  }).then(function(){
    return db.collection('qna').doc(String(p.questionId)).update({ status:'answered' }).catch(function(){});
  }).then(function(){ return { success:true }; });
};

api.updateAnswer = function(db, p){
  return db.collection('qna_answers').doc(String(p.id)).update({ content:p.content||'', date:nowStr() })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.deleteAnswer = function(db, p){
  var ref = db.collection('qna_answers').doc(String(p.id));
  return ref.get().then(function(doc){
    if (!doc.exists) return { success:false };
    var qId = doc.data().questionId;
    return ref.delete().then(function(){
      return db.collection('qna').doc(String(qId)).update({ status:'open' }).catch(function(){});
    }).then(function(){ return { success:true }; });
  });
};

/* === 반 === */
api.getClasses = function(db){
  return Promise.all([
    db.collection('classes').get(),
    db.collection('students').where('role','==','student').get()
  ]).then(function(res){
    var countByClass = {};
    res[1].forEach(function(doc){
      var cid = String(doc.data().classId||'');
      if (cid) countByClass[cid] = (countByClass[cid]||0) + 1;
    });
    var classes = docsToArr(res[0]).map(function(r){
      return { id:String(r.id), name:r.name||'', time:r.time||'', start:r.start||'', end:r.end||'', status:r.status||'active', count:countByClass[String(r.id)]||0 };
    });
    return { classes: classes };
  });
};

api.addClass = function(db, p){
  var id = genId('cls');
  return db.collection('classes').doc(id).set({
    id:id, name:p.name||'', time:p.time||'', start:p.start||'', end:p.end||'', status:'active'
  }).then(function(){ return { success:true, id:id }; });
};

api.deleteClass = function(db, p){
  return db.collection('classes').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.toggleClassStatus = function(db, p){
  var ref = db.collection('classes').doc(String(p.id));
  return ref.get().then(function(doc){
    if (!doc.exists) return { success:false };
    var cur = doc.data().status || 'active';
    return ref.update({ status: cur === 'past' ? 'active' : 'past' }).then(function(){ return { success:true }; });
  });
};

api.assignStudentClass = function(db, p){
  return db.collection('students').doc(String(p.studentId)).update({ classId:String(p.classId||'') })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.getClassStudents = function(db, p){
  var authUser = firebase.auth().currentUser;
  var myEmail = authUser ? authUser.email : '';
  var amTeacher = myEmail === toAuthEmail('mingwan0309');
  var studentsQuery = amTeacher
    ? db.collection('students').where('classId','==',String(p.classId)).get()
    : db.collection('students').doc(myEmail.split('@')[0]).get().then(function(doc){
        // 학생 계정: 보안 규칙상 자기 자신의 정보만 조회 가능 (반 목록 전체 조회 불가)
        var fake = { docs: [] };
        if (doc.exists && String(doc.data().classId) === String(p.classId)) fake.docs = [doc];
        fake.forEach = function(fn){ fake.docs.forEach(fn); };
        return fake;
      });
  var tasks = [
    db.collection('classes').doc(String(p.classId)).get(),
    studentsQuery
  ];
  return Promise.all(tasks).then(function(res){
    if (!res[0].exists) return { classInfo:null, students:[] };
    var c = res[0].data();
    var classInfo = { id:String(c.id), name:c.name, time:c.time||'', start:c.start||'', end:c.end||'', status:c.status||'active' };
    var students = docsToArr(res[1]).map(function(r){
      return { id:String(r.id), name:r.name||'', school:r.school||'', studentPhone:String(r.id), parentPhone:r.parentPhone||'' };
    });
    return { classInfo:classInfo, students:students };
  });
};

/* === 차시 === */
api.getSessions = function(db, p){
  return db.collection('sessions').where('classId','==',String(p.classId)).get().then(function(snap){
    var sessions = docsToArr(snap).map(function(r){
      return { id:String(r.id), classId:String(r.classId), sessionNum:Number(r.sessionNum), date:r.date||'' };
    }).sort(function(a,b){ return b.sessionNum - a.sessionNum; });
    return { sessions: sessions };
  });
};

api.addSession = function(db, p){
  return db.collection('sessions').where('classId','==',String(p.classId)).get().then(function(snap){
    var maxNum = 0;
    snap.forEach(function(doc){ var n = Number(doc.data().sessionNum); if (n > maxNum) maxNum = n; });
    var id = genId('ses');
    var sessionNum = maxNum + 1;
    return db.collection('sessions').doc(id).set({
      id:id, classId:String(p.classId), sessionNum:sessionNum, date:p.date||''
    }).then(function(){ return { success:true, id:id, sessionNum:sessionNum }; });
  });
};

api.deleteSession = function(db, p){
  return db.collection('sessions').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.getSession = function(db, p){
  return db.collection('sessions').doc(String(p.id)).get().then(function(doc){
    if (!doc.exists) return { success:false };
    var r = doc.data();
    return { success:true, session:{ id:String(r.id), classId:String(r.classId), sessionNum:Number(r.sessionNum), date:r.date||'' } };
  });
};

/* === 출석 === */
api.setAttendance = function(db, p){
  var key = String(p.sessionId) + '__' + String(p.studentId);
  return db.collection('attendance').doc(key).set({
    id:key, sessionId:String(p.sessionId), studentId:String(p.studentId), status:p.status||'', memo:p.memo||''
  }).then(function(){ return { success:true }; });
};

api.removeAttendance = function(db, p){
  var key = String(p.sessionId) + '__' + String(p.studentId);
  return db.collection('attendance').doc(key).delete().then(function(){ return { success:true }; });
};

api.getAttendance = function(db, p){
  return db.collection('attendance').where('sessionId','==',String(p.sessionId)).get().then(function(snap){
    var att = docsToArr(snap).map(function(r){
      return { sessionId:String(r.sessionId), studentId:String(r.studentId), status:r.status||'', memo:r.memo||'' };
    });
    return { attendance: att };
  });
};

api.getAttendanceHistory = function(db, p){
  var tasks = [
    db.collection('sessions').where('classId','==',String(p.classId)).get(),
    db.collection('attendance').where('studentId','==',String(p.studentId)).get()
  ];
  return Promise.all(tasks).then(function(res){
    var sessions = docsToArr(res[0]).sort(function(a,b){ return Number(b.sessionNum) - Number(a.sessionNum); }).slice(0,20);
    var attMap = {};
    res[1].forEach(function(doc){ var d = doc.data(); attMap[String(d.sessionId)] = d.status || '미정'; });
    var history = sessions.map(function(s){
      return { sessionNum:Number(s.sessionNum), status: attMap[String(s.id)] || '미정' };
    });
    return { history: history };
  });
};

/* === 성적 (차시별) + 데일리 퀴즈 점수 === */
api.setScore = function(db, p){
  var key = String(p.sessionId) + '__' + String(p.studentId) + '__' + String(p.examId);
  return db.collection('scores').doc(key).set({
    id:key, sessionId:String(p.sessionId), studentId:String(p.studentId), examId:String(p.examId),
    score:p.score||'', pass:p.pass||'', feedback:p.feedback||''
  }).then(function(){ return { success:true }; });
};

api.getScores = function(db, p){
  if (p.sessionId) {
    return db.collection('scores').where('sessionId','==',String(p.sessionId)).get().then(function(snap){
      var scores = docsToArr(snap).map(function(r){
        return { sessionId:String(r.sessionId), studentId:String(r.studentId), examId:String(r.examId), score:r.score||'', pass:r.pass||'', feedback:r.feedback||'' };
      });
      return { scores: scores };
    });
  }
  // 데일리 퀴즈 점수 (homework.html)
  return db.collection('quiz_scores').get().then(function(snap){
    var scores = docsToArr(snap).sort(function(a,b){ return (a.createdAt||'') < (b.createdAt||'') ? 1 : -1; })
      .map(function(r){ return { name:r.name||'', id:r.id||'', title:r.title||'', score:r.score||'', total:r.total||'', date:r.date||'' }; });
    return { scores: scores };
  });
};

api.saveScore = function(db, p){
  var id = genId('qs');
  return db.collection('quiz_scores').doc(id).set({
    id:p.id||'', name:p.name||'', title:p.title||'', score:p.score||'', total:p.total||'', date:p.date||nowStr(), createdAt:nowStr()
  }).then(function(){ return { success:true }; });
};

/* === 시험 === */
api.addExam = function(db, p){
  var id = genId('exam');
  return db.collection('exams').doc(id).set({
    id:id, sessionId:String(p.sessionId), name:p.name||'시험', createdAt:nowStr()
  }).then(function(){ return { success:true, id:id }; });
};

api.getExams = function(db, p){
  return db.collection('exams').where('sessionId','==',String(p.sessionId)).get().then(function(snap){
    var exams = docsToArr(snap).sort(function(a,b){ return (a.createdAt||'') < (b.createdAt||'') ? -1 : 1; })
      .map(function(r){ return { id:String(r.id), sessionId:String(r.sessionId), name:r.name||'', range:r.range||'', totalQuestions:r.totalQuestions||'', scoreType:r.scoreType||'score', passCutoff:r.passCutoff||'', grade1:r.grade1||'', grade2:r.grade2||'', grade3:r.grade3||'', grade4:r.grade4||'', answerKey:r.answerKey||null, createdAt:r.createdAt||'' }; });
    return { exams: exams };
  });
};

api.deleteExam = function(db, p){
  return db.collection('exams').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.updateExam = function(db, p){
  var data={};
  if(p.name!==undefined) data.name=p.name;
  if(p.range!==undefined) data.range=p.range;
  if(p.totalQuestions!==undefined) data.totalQuestions=p.totalQuestions;
  if(p.scoreType!==undefined) data.scoreType=p.scoreType;
  if(p.passCutoff!==undefined) data.passCutoff=p.passCutoff;
  return db.collection('exams').doc(String(p.id)).update(data)
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

// OMR 자동채점용 정답/배점 등록 (1~20번 문제, 각 {q, correct(1-5 또는 null=제외), points})
api.setExamAnswerKey = function(db, p){
  var key = Array.isArray(p.answerKey) ? p.answerKey : [];
  return db.collection('exams').doc(String(p.examId)).update({ answerKey: key })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

/* === 과제 (session.html 과제 탭) === */
api.addHwItem = function(db, p){
  var id = genId('hw');
  return db.collection('homeworks').doc(id).set({
    id:id, sessionId:String(p.sessionId), name:p.name||'과제', range:p.range||'', createdAt:nowStr()
  }).then(function(){ return { success:true, id:id }; });
};
api.getHwItems = function(db, p){
  return db.collection('homeworks').where('sessionId','==',String(p.sessionId)).get().then(function(snap){
    var hws = docsToArr(snap).sort(function(a,b){ return (a.createdAt||'') < (b.createdAt||'') ? -1 : 1; })
      .map(function(r){ return { id:String(r.id), sessionId:String(r.sessionId), name:r.name||'', range:r.range||'', createdAt:r.createdAt||'' }; });
    return { homeworks: hws };
  });
};
api.deleteHwItem = function(db, p){
  return db.collection('homeworks').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};
api.updateHwItem = function(db, p){
  var data={};
  if(p.name!==undefined) data.name=p.name;
  if(p.range!==undefined) data.range=p.range;
  return db.collection('homeworks').doc(String(p.id)).update(data)
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};
api.setHwStatus = function(db, p){
  var key = String(p.sessionId)+'__'+String(p.studentId)+'__'+String(p.hwId);
  return db.collection('hw_status').doc(key).set({
    id:key, sessionId:String(p.sessionId), studentId:String(p.studentId), hwId:String(p.hwId),
    pass:p.pass||'', feedback:p.feedback||''
  },{merge:true}).then(function(){ return { success:true }; });
};
api.getHwStatuses = function(db, p){
  return db.collection('hw_status').where('sessionId','==',String(p.sessionId)).get().then(function(snap){
    var list = docsToArr(snap).map(function(r){
      return { studentId:String(r.studentId), hwId:String(r.hwId), pass:r.pass||'', feedback:r.feedback||'',
        submissionUrls:hwUrlsToArray(r.submissionUrl), submittedAt:r.submittedAt||'', lastReminderAt:r.lastReminderAt||'' };
    });
    return { statuses: list };
  });
};

// 학생이 증빙 사진/파일을 올리거나 지우면, 갱신된 전체 목록(최대 6장)을 통째로 저장 (교사가 매긴 pass/feedback은 건드리지 않음)
// Firestore 규칙의 hasOnly(['submissionUrl','submittedAt']) 필드명은 그대로 두고 값만 배열로 씀(규칙 재배포 불필요).
api.submitHwProof = function(db, p){
  var key = String(p.sessionId)+'__'+String(p.studentId)+'__'+String(p.hwId);
  var urls=[];
  try{ urls = JSON.parse(p.urls||'[]'); }catch(e){ urls=[]; }
  if (!Array.isArray(urls)) urls=[];
  urls = urls.filter(function(u){ return u; }).slice(0,6);
  return db.collection('hw_status').doc(key).set({
    id:key, sessionId:String(p.sessionId), studentId:String(p.studentId), hwId:String(p.hwId),
    submissionUrl:urls, submittedAt:nowStr()
  },{merge:true}).then(function(){ return { success:true }; });
};

// 재촉 알림톡 발송 후 마지막 발송 시각 기록 + 이력에 누적 (여러 번 보낸 기록을 다 볼 수 있게)
api.markHwReminderSent = function(db, p){
  var key = String(p.sessionId)+'__'+String(p.studentId)+'__'+String(p.hwId);
  var ref = db.collection('hw_status').doc(key);
  var entry = { at:nowStr(), by:p.by||'', text:p.text||'' };
  return ref.get().then(function(doc){
    var logs = (doc.exists && doc.data().reminderLogs) || [];
    logs = logs.concat([entry]).slice(-30); // 최근 30건까지만 보관
    return ref.set({
      lastReminderAt:entry.at, lastReminderBy:entry.by, lastReminderText:entry.text, reminderLogs:logs
    },{merge:true}).then(function(){ return { success:true }; });
  });
};

// submissionUrl 필드가 예전엔 문자열 하나였고 지금은 배열임 — 둘 다 안전하게 배열로 통일
function hwUrlsToArray(v){
  if (Array.isArray(v)) return v.filter(function(u){ return u; });
  if (v) return [v];
  return [];
}

// 학생 마이페이지: 내 과제 전체 현황 (과제명/반/차시/상태/제출증빙 포함해서 조립)
api.getMyHomeworkStatus = function(db, p){
  var studentId = String(p.studentId);
  return db.collection('hw_status').where('studentId','==',studentId).get().then(function(snap){
    var rows = docsToArr(snap);
    if (!rows.length) return { items: [] };
    var hwIds=[], sessionIds=[];
    rows.forEach(function(r){
      if (hwIds.indexOf(r.hwId) < 0) hwIds.push(r.hwId);
      if (sessionIds.indexOf(r.sessionId) < 0) sessionIds.push(r.sessionId);
    });
    return Promise.all([
      Promise.all(hwIds.map(function(id){ return db.collection('homeworks').doc(id).get(); })),
      Promise.all(sessionIds.map(function(id){ return db.collection('sessions').doc(id).get(); }))
    ]).then(function(res){
      var hwMap={}; res[0].forEach(function(d){ if(d.exists) hwMap[d.id]=d.data(); });
      var sesMap={}; res[1].forEach(function(d){ if(d.exists) sesMap[d.id]=d.data(); });
      var classIds=[];
      Object.keys(sesMap).forEach(function(k){ var cid=String(sesMap[k].classId||''); if(cid && classIds.indexOf(cid)<0) classIds.push(cid); });
      return Promise.all(classIds.map(function(id){ return db.collection('classes').doc(id).get(); })).then(function(classDocs){
        var clsMap={}; classDocs.forEach(function(d){ if(d.exists) clsMap[d.id]=d.data(); });
        var items = rows.map(function(r){
          var hw=hwMap[r.hwId]||{}, ses=sesMap[r.sessionId]||{}, cls=clsMap[String(ses.classId||'')]||{};
          return {
            id:r.id, sessionId:String(r.sessionId), hwId:String(r.hwId),
            hwName:hw.name||'(삭제된 과제)', pass:r.pass||'', feedback:r.feedback||'',
            submissionUrls:hwUrlsToArray(r.submissionUrl), submittedAt:r.submittedAt||'',
            sessionNum:ses.sessionNum||'', sessionDate:ses.date||'',
            classId:String(ses.classId||''), className:cls.name||''
          };
        });
        items.sort(function(a,b){ return (a.sessionDate||'') < (b.sessionDate||'') ? 1 : -1; });
        return { items: items };
      });
    });
  });
};

// 선생님/조교용: 전체 반 기준 '일부미이행/미이행' 과제 목록 (숙제관리 화면)
/* === 신호판 (연속 결석 + 과제 미제출 기준으로 관리가 필요한 학생 자동 감지) === */
api.getSignalBoard = function(db){
  return Promise.all([
    db.collection('students').where('role','==','student').get(),
    db.collection('sessions').get(),
    db.collection('attendance').get(),
    db.collection('hw_status').where('pass','in',['incomplete','partial']).get(),
    db.collection('student_signals').get()
  ]).then(function(res){
    var students = docsToArr(res[0]).filter(function(s){ return s.active!==false; });
    var sessions = docsToArr(res[1]);
    var attendance = docsToArr(res[2]);
    var hwIncomplete = docsToArr(res[3]);
    var signalDocs = docsToArr(res[4]);
    var signalMap = {}; signalDocs.forEach(function(s){ signalMap[s.id]=s; });

    // 반별로 세션을 sessionNum 내림차순 정렬해서 캐시
    var sessionsByClass = {};
    sessions.forEach(function(s){
      var cid = String(s.classId||'');
      if (!sessionsByClass[cid]) sessionsByClass[cid]=[];
      sessionsByClass[cid].push(s);
    });
    Object.keys(sessionsByClass).forEach(function(cid){
      sessionsByClass[cid].sort(function(a,b){ return Number(b.sessionNum||0)-Number(a.sessionNum||0); });
    });
    // 출석: sessionId+studentId -> status
    var attMap = {};
    attendance.forEach(function(a){ attMap[String(a.sessionId)+'__'+String(a.studentId)] = a.status||''; });
    // 과제 미제출 개수: studentId -> count
    var hwCount = {};
    hwIncomplete.forEach(function(h){ var sid=String(h.studentId); hwCount[sid]=(hwCount[sid]||0)+1; });

    var items = students.map(function(stu){
      var sid = String(stu.id);
      var cid = String(stu.classId||'');
      var classSessions = sessionsByClass[cid]||[];
      var consecutiveAbsent = 0;
      for (var i=0;i<classSessions.length;i++){
        var st = attMap[String(classSessions[i].id)+'__'+sid];
        if (st===undefined) break; // 출석 기록 자체가 없으면 중단(아직 진행 안 한 차시로 간주)
        if (st==='결석') consecutiveAbsent++;
        else break;
      }
      var hwMissing = hwCount[sid]||0;
      var level = 'ok';
      if (consecutiveAbsent>=2 || hwMissing>=3) level='danger';
      else if (consecutiveAbsent===1 || hwMissing===2) level='warn';
      else if (hwMissing===1) level='watch';
      var sig = signalMap[sid] || {};
      return {
        studentId: sid, name: stu.name||sid, classId: cid,
        parentPhone: stu.parentPhone||'', studentPhone: stu.id||'',
        consecutiveAbsent: consecutiveAbsent, hwMissing: hwMissing,
        level: level, memo: sig.memo||'', dismissed: !!sig.dismissed
      };
    }).filter(function(it){ return it.level!=='ok'; });

    return { items: items };
  });
};
api.setSignalMemo = function(db, p){
  return db.collection('student_signals').doc(String(p.studentId)).set({
    id:String(p.studentId), memo:p.memo||'', updatedAt:nowStr()
  },{merge:true}).then(function(){ return { success:true }; });
};
api.setSignalDismissed = function(db, p){
  return db.collection('student_signals').doc(String(p.studentId)).set({
    id:String(p.studentId), dismissed: !!(p.dismissed==='true'||p.dismissed===true), updatedAt:nowStr()
  },{merge:true}).then(function(){ return { success:true }; });
};

// ── 공지사항 (Firestore 공유, 전 기기에서 동일하게 보임) ──
api.getNotices = function(db){
  return db.collection('notices').get().then(function(snap){
    var items = docsToArr(snap);
    items.sort(function(a,b){ return (b.createdAt||'') < (a.createdAt||'') ? -1 : 1; });
    return { items: items };
  });
};
api.addNotice = function(db, p){
  var id = window.mkGenId ? window.mkGenId('notice') : ('notice_'+Date.now());
  return db.collection('notices').doc(id).set({
    id: id, title: p.title||'', content: p.content||'', createdAt: nowStr()
  }).then(function(){ return { success:true, id:id }; });
};
api.deleteNotice = function(db, p){
  return db.collection('notices').doc(String(p.id)).delete().then(function(){ return { success:true }; });
};

api.getIncompleteHomeworks = function(db){
  return db.collection('hw_status').where('pass','in',['incomplete','partial']).get().then(function(snap){
    var rows = docsToArr(snap);
    if (!rows.length) return { items: [] };
    var hwIds=[], sessionIds=[], studentIds=[];
    rows.forEach(function(r){
      if (hwIds.indexOf(r.hwId) < 0) hwIds.push(r.hwId);
      if (sessionIds.indexOf(r.sessionId) < 0) sessionIds.push(r.sessionId);
      if (studentIds.indexOf(r.studentId) < 0) studentIds.push(r.studentId);
    });
    return Promise.all([
      Promise.all(hwIds.map(function(id){ return db.collection('homeworks').doc(id).get(); })),
      Promise.all(sessionIds.map(function(id){ return db.collection('sessions').doc(id).get(); })),
      Promise.all(studentIds.map(function(id){ return db.collection('students').doc(id).get(); }))
    ]).then(function(res){
      var hwMap={}; res[0].forEach(function(d){ if(d.exists) hwMap[d.id]=d.data(); });
      var sesMap={}; res[1].forEach(function(d){ if(d.exists) sesMap[d.id]=d.data(); });
      var stuMap={}; res[2].forEach(function(d){ if(d.exists) stuMap[d.id]=d.data(); });
      var classIds=[];
      Object.keys(sesMap).forEach(function(k){ var cid=String(sesMap[k].classId||''); if(cid && classIds.indexOf(cid)<0) classIds.push(cid); });
      return Promise.all(classIds.map(function(id){ return db.collection('classes').doc(id).get(); })).then(function(classDocs){
        var clsMap={}; classDocs.forEach(function(d){ if(d.exists) clsMap[d.id]=d.data(); });
        var items = rows.map(function(r){
          var hw=hwMap[r.hwId]||{}, ses=sesMap[r.sessionId]||{}, cls=clsMap[String(ses.classId||'')]||{}, stu=stuMap[r.studentId]||{};
          return {
            id:r.id, sessionId:String(r.sessionId), hwId:String(r.hwId), studentId:String(r.studentId),
            pass:r.pass||'', feedback:r.feedback||'',
            submissionUrls:hwUrlsToArray(r.submissionUrl), submittedAt:r.submittedAt||'',
            lastReminderAt:r.lastReminderAt||'', lastReminderBy:r.lastReminderBy||'', lastReminderText:r.lastReminderText||'', reminderLogs:r.reminderLogs||[],
            hwName:hw.name||'(삭제된 과제)', sessionNum:ses.sessionNum||'', sessionDate:ses.date||'',
            classId:String(ses.classId||''), className:cls.name||'',
            studentName:stu.name||r.studentId, studentPhone:r.studentId, parentPhone:stu.parentPhone||''
          };
        });
        // 학생이 방금 사진을 올려 확인이 필요한 것부터, 그 다음 오래된 순
        items.sort(function(a,b){
          var aSub=a.submissionUrls.length?1:0, bSub=b.submissionUrls.length?1:0;
          if (aSub!==bSub) return bSub-aSub;
          return (a.sessionDate||'') < (b.sessionDate||'') ? -1 : 1;
        });
        return { items: items };
      });
    });
  });
};

// 지금까지 보낸 재촉 알림 전체 이력 (완료 처리된 학생 것도 포함, 최신순)
api.getAllHwReminders = function(db){
  return db.collection('hw_status').get().then(function(snap){
    var rows = docsToArr(snap).filter(function(r){ return r.reminderLogs && r.reminderLogs.length; });
    if (!rows.length) return { logs: [] };
    var hwIds=[], studentIds=[];
    rows.forEach(function(r){
      if (hwIds.indexOf(r.hwId) < 0) hwIds.push(r.hwId);
      if (studentIds.indexOf(r.studentId) < 0) studentIds.push(r.studentId);
    });
    return Promise.all([
      Promise.all(hwIds.map(function(id){ return db.collection('homeworks').doc(id).get(); })),
      Promise.all(studentIds.map(function(id){ return db.collection('students').doc(id).get(); }))
    ]).then(function(res){
      var hwMap={}; res[0].forEach(function(d){ if(d.exists) hwMap[d.id]=d.data(); });
      var stuMap={}; res[1].forEach(function(d){ if(d.exists) stuMap[d.id]=d.data(); });
      var logs=[];
      rows.forEach(function(r){
        var hw=hwMap[r.hwId]||{}, stu=stuMap[r.studentId]||{};
        (r.reminderLogs||[]).forEach(function(l){
          logs.push({ studentName:stu.name||r.studentId, hwName:hw.name||'(삭제된 과제)', at:l.at||'', by:l.by||'', text:l.text||'' });
        });
      });
      logs.sort(function(a,b){ return (a.at||'') < (b.at||'') ? 1 : -1; });
      return { logs: logs };
    });
  });
};

/* === 자료실 === */
api.getMaterials = function(db, p){
  return db.collection('materials').where('classId','==',String(p.classId)).get().then(function(snap){
    var mats = docsToArr(snap).sort(function(a,b){ return (a.uploadDate||'') < (b.uploadDate||'') ? -1 : 1; })
      .map(function(r){
        return { id:String(r.id), classId:String(r.classId), category:r.category||'', name:r.name||'', url:r.url||'',
                 size:r.size||'', uploadDate:r.uploadDate||'', downloadCount:Number(r.downloadCount||0), memo:r.memo||'', wmLevel:r.wmLevel||'0' };
      });
    return { materials: mats };
  });
};

api.addMaterial = function(db, p){
  var id = genId('mat');
  return db.collection('materials').doc(id).set({
    id:id, classId:String(p.classId), category:p.category||'자습용 자료', name:p.name||'', url:p.url||'',
    size:p.size||'', uploadDate:nowStr(), downloadCount:0, memo:p.memo||'', wmLevel:p.wmLevel||'0'
  }).then(function(){ return { success:true, id:id }; });
};

api.setMaterialWm = function(db, p){
  return db.collection('materials').doc(String(p.id)).update({ wmLevel:String(p.wmLevel||'0') })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.deleteMaterial = function(db, p){
  return db.collection('materials').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.incDownload = function(db, p){
  var ref = db.collection('materials').doc(String(p.id));
  return ref.get().then(function(doc){
    if (!doc.exists) return { success:false };
    return ref.update({ downloadCount: Number(doc.data().downloadCount||0) + 1 }).then(function(){ return { success:true }; });
  });
};

/* === 영상 라이브러리 === */
api.getVideoLibrary = function(db){
  return db.collection('video_library').get().then(function(snap){
    var videos = docsToArr(snap).sort(function(a,b){ return (a.createdAt||'') < (b.createdAt||'') ? -1 : 1; })
      .map(function(r){
        return { id:String(r.id), name:r.name||'', url:r.url||'', memo:r.memo||'', createdAt:r.createdAt||'', subject:r.subject||'', type:r.type||'' };
      });
    return { videos: videos };
  });
};

api.addVideoLibrary = function(db, p){
  var id = genId('vlib');
  return db.collection('video_library').doc(id).set({
    id:id, name:p.name||'', url:p.url||'', memo:p.memo||'', createdAt:nowStr(), subject:p.subject||'', type:p.type||''
  }).then(function(){ return { success:true, id:id }; });
};

api.deleteVideoLibrary = function(db, p){
  return db.collection('video_library').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.updateVideoLibrary = function(db, p){
  var data = {};
  ['name','url','memo','subject','type'].forEach(function(k){ if (p[k] !== undefined) data[k] = p[k]; });
  return db.collection('video_library').doc(String(p.id)).update(data)
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.getTextbookVideos = function(db){
  return db.collection('textbook_videos').get().then(function(snap){
    var videos = docsToArr(snap).sort(function(a,b){ return (a.createdAt||'') < (b.createdAt||'') ? -1 : 1; })
      .map(function(r){
        return { id:String(r.id), grade:r.grade||'', subject:r.subject||'', book:r.book||'', name:r.name||'', url:r.url||'', memo:r.memo||'', createdAt:r.createdAt||'' };
      });
    return { videos: videos };
  });
};
api.addTextbookVideo = function(db, p){
  var id = genId('tbv');
  return db.collection('textbook_videos').doc(id).set({
    id:id, grade:p.grade||'', subject:p.subject||'', book:p.book||'', name:p.name||'', url:p.url||'', memo:p.memo||'', createdAt:nowStr()
  }).then(function(){ return { success:true, id:id }; });
};
api.updateTextbookVideo = function(db, p){
  var data = {};
  ['grade','subject','book','name','url','memo'].forEach(function(k){ if (p[k] !== undefined) data[k] = p[k]; });
  return db.collection('textbook_videos').doc(String(p.id)).update(data)
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};
api.deleteTextbookVideo = function(db, p){
  return db.collection('textbook_videos').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

/* === 의무클리닉 (정규 시간 변경 학생 명단 + 출결) === */
api.getMandatoryClinic = function(db){
  return db.collection('mandatory_clinic').get().then(function(snap){
    var list = docsToArr(snap).sort(function(a,b){ return (a.createdAt||'') < (b.createdAt||'') ? -1 : 1; });
    return { list: list };
  });
};

// 학생/학부모 본인이 자기 의무클리닉 등록 현황만 조회 (마이페이지용)
api.getMyMandatoryClinic = function(db, p){
  return db.collection('mandatory_clinic').where('studentId','==',String(p.id||p.studentId||'')).get().then(function(snap){
    var list = docsToArr(snap);
    return { list: list };
  });
};

api.addMandatoryClinic = function(db, p){
  var id = genId('mclinic');
  return db.collection('mandatory_clinic').doc(id).set({
    id:id, studentId:String(p.studentId||''), name:p.name||'', type:p.type||'regular', date:p.date||'',
    day:p.day||'', targetDay:p.targetDay||'', time:p.time||'', memo:p.memo||'',
    classId:p.classId||'', className:p.className||'',
    attendance:{}, attendanceBy:{}, createdAt:nowStr()
  }).then(function(){ return { success:true, id:id }; });
};

api.deleteMandatoryClinic = function(db, p){
  return db.collection('mandatory_clinic').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.setMandatoryClinicAttendance = function(db, p){
  var field = 'attendance.' + String(p.date);
  var byField = 'attendanceBy.' + String(p.date);
  var data = {};
  data[field] = p.status || '';
  data[byField] = p.by || '';
  return db.collection('mandatory_clinic').doc(String(p.id)).update(data)
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

/* === 클리닉 === */
api.getClinics = function(db){
  return db.collection('clinics').get().then(function(snap){
    var clinics = docsToArr(snap).filter(function(r){ return r.status !== 'deleted'; });
    return { clinics: clinics };
  });
};

api.createClinic = function(db, p){
  var id = genId('clinic');
  var data = { id:id, status:'active', createdAt:nowStr() };
  Object.keys(p).forEach(function(k){ if (k !== 'action') data[k] = p[k]; });
  return db.collection('clinics').doc(id).set(data).then(function(){ return { success:true, id:id }; });
};

api.deleteClinic = function(db, p){
  return db.collection('clinics').doc(String(p.id)).delete().then(function(){
    return db.collection('clinic_bookings').where('clinicId','==',String(p.id)).get();
  }).then(function(snap){
    var deletes = [];
    snap.forEach(function(doc){ deletes.push(doc.ref.delete()); });
    return Promise.all(deletes);
  }).then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.getBookings = function(db, p){
  return db.collection('clinic_bookings').where('studentId','==',String(p.studentId)).get().then(function(snap){
    return { bookings: docsToArr(snap) };
  });
};

api.getAllBookings = function(db){
  return db.collection('clinic_bookings').get().then(function(snap){
    return { bookings: docsToArr(snap) };
  });
};

api.cancelBooking = function(db, p){
  return db.collection('clinic_bookings').doc(String(p.bookId)).update({ status:'취소' })
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

api.bookClinic = function(db, p){
  return Promise.all([
    db.collection('clinics').doc(String(p.clinicId)).get(),
    db.collection('clinic_bookings').where('clinicId','==',String(p.clinicId)).get()
  ]).then(function(res){
    var max = 10;
    if (res[0].exists) max = parseInt(res[0].data().maxPeople) || 10;
    var count = 0;
    res[1].forEach(function(doc){
      var b = doc.data();
      if (b.date === p.date && b.time === p.time && b.status !== '취소' && b.status !== 'cancelled') count++;
    });
    if (count >= max) return { success:false, msg:'해당 시간은 마감되었습니다.' };
    var id = genId('book');
    return db.collection('clinic_bookings').doc(id).set({
      id:id, clinicId:String(p.clinicId), clinicName:p.clinicName||'', studentId:String(p.studentId),
      studentName:p.studentName||'', date:p.date||'', time:p.time||'', status:'예약', createdAt:nowStr()
    }).then(function(){ return { success:true }; });
  });
};

api.getSlotCount = function(db, p){
  return db.collection('clinic_bookings').where('clinicId','==',String(p.clinicId)).get().then(function(snap){
    var counts = {};
    snap.forEach(function(doc){
      var b = doc.data();
      if (b.status === '취소' || b.status === 'cancelled') return;
      var key = b.date + '_' + b.time;
      counts[key] = (counts[key]||0) + 1;
    });
    return { counts: counts };
  });
};

/* === 조교 관리 === */
api.getAssistants = function(db){
  return db.collection('assistants').get().then(function(snap){
    return { assistants: docsToArr(snap).sort(function(a,b){return (a.createdAt||'')>(b.createdAt||'')?1:-1;})
      .map(function(r){ return { id:r.id, name:r.name||'', phone:r.phone||'', isAdmin:!!r.isAdmin,
        salaryType:r.salaryType||'hourly', workTypeIds:r.workTypeIds||[], studentIds:r.studentIds||[], active:r.active!==false, createdAt:r.createdAt||'' }; }) };
  });
};
api.addAssistant = function(db, p){
  var phone = String(p.phone||'');
  var id = phone || genId('ast');
  var pw = String(p.pw||'123456');
  var studentIds=[]; try{ studentIds=JSON.parse(p.studentIds||'[]'); }catch(e){}
  return db.collection('assistants').doc(id).set({
    id:id, name:p.name||'', phone:phone, isAdmin:false,
    salaryType:p.salaryType||'hourly', workTypeIds:[], studentIds:studentIds, active:true, createdAt:nowStr()
  }).then(function(){
    if(!phone) return { success:true, id:id };
    var secondary;
    try { secondary = firebase.app('mk-secondary'); }
    catch(e) { secondary = firebase.initializeApp(firebase.app().options, 'mk-secondary'); }
    return secondary.auth().createUserWithEmailAndPassword(toAuthEmail(phone), toAuthPassword(pw))
      .then(function(){ return secondary.auth().signOut(); })
      .catch(function(){})
      .then(function(){ return { success:true, id:id }; });
  });
};
api.updateAssistant = function(db, p){
  var data={};
  if(p.name!==undefined) data.name=p.name;
  if(p.phone!==undefined) data.phone=p.phone;
  if(p.isAdmin!==undefined) data.isAdmin=p.isAdmin;
  if(p.salaryType!==undefined) data.salaryType=p.salaryType;
  if(p.workTypeIds!==undefined) data.workTypeIds=Array.isArray(p.workTypeIds)?p.workTypeIds:JSON.parse(p.workTypeIds||'[]');
  if(p.studentIds!==undefined){ try{ data.studentIds=Array.isArray(p.studentIds)?p.studentIds:JSON.parse(p.studentIds||'[]'); }catch(e){ data.studentIds=[]; } }
  return db.collection('assistants').doc(String(p.id)).update(data).then(function(){ return { success:true }; });
};
api.setAssistantActive = function(db, p){
  return db.collection('assistants').doc(String(p.id)).update({ active:!!p.active }).then(function(){ return { success:true }; });
};
api.deleteAssistant = function(db, p){
  return db.collection('assistants').doc(String(p.id)).delete().then(function(){ return { success:true }; });
};
api.getWorkTypes = function(db){
  return db.collection('work_types').get().then(function(snap){
    return { workTypes: docsToArr(snap).sort(function(a,b){return (a.createdAt||'')>(b.createdAt||'')?1:-1;})
      .map(function(r){ return { id:r.id, name:r.name||'', color:r.color||'#64748b', hourlyRate:Number(r.hourlyRate||0), createdAt:r.createdAt||'' }; }) };
  });
};
api.addWorkType = function(db, p){
  var id = genId('wt');
  return db.collection('work_types').doc(id).set({
    id:id, name:p.name||'', color:p.color||'#64748b', hourlyRate:Number(p.hourlyRate||0), createdAt:nowStr()
  }).then(function(){ return { success:true, id:id }; });
};
api.updateWorkType = function(db, p){
  var data={};
  if(p.name!==undefined) data.name=p.name;
  if(p.color!==undefined) data.color=p.color;
  if(p.hourlyRate!==undefined) data.hourlyRate=Number(p.hourlyRate);
  return db.collection('work_types').doc(String(p.id)).update(data).then(function(){ return { success:true }; });
};
api.deleteWorkType = function(db, p){
  return db.collection('work_types').doc(String(p.id)).delete().then(function(){ return { success:true }; });
};
api.getWorkLogs = function(db, p){
  var q = db.collection('work_logs').where('yearMonth','==',String(p.yearMonth||''));
  if(p.assistantId) q = q.where('assistantId','==',String(p.assistantId));
  return q.get().then(function(snap){
    return { logs: docsToArr(snap).sort(function(a,b){return (a.date+a.clockIn)<(b.date+b.clockIn)?-1:1;})
      .map(function(r){ return { id:r.id, assistantId:r.assistantId||'', date:r.date||'', clockIn:r.clockIn||'',
        clockOut:r.clockOut||'', workTypeId:r.workTypeId||'', breakMin:Number(r.breakMin||0),
        memo:r.memo||'', cost:Number(r.cost||0), yearMonth:r.yearMonth||'' }; }) };
  });
};
api.addWorkLog = function(db, p){
  var id = genId('wlog');
  return db.collection('work_logs').doc(id).set({
    id:id, assistantId:String(p.assistantId), date:p.date||'', clockIn:p.clockIn||'', clockOut:p.clockOut||'',
    workTypeId:String(p.workTypeId||''), breakMin:Number(p.breakMin||0), memo:p.memo||'', cost:Number(p.cost||0),
    yearMonth:(p.date||'').slice(0,7), createdAt:nowStr()
  }).then(function(){ return { success:true, id:id }; });
};
api.deleteWorkLog = function(db, p){
  return db.collection('work_logs').doc(String(p.id)).delete().then(function(){ return { success:true }; });
};

// 조교 로그인/로그아웃 시 자동 출퇴근 체크
api.clockIn = function(db, p){
  var assistantId = String(p.id);
  return db.collection('work_logs').where('assistantId','==',assistantId).where('clockOut','==','').get().then(function(snap){
    if (!snap.empty) return { success:true, id:snap.docs[0].id }; // 이미 출근 중이면 중복 생성하지 않음
    return db.collection('assistants').doc(assistantId).get().then(function(aDoc){
      var workTypeId = (aDoc.exists && aDoc.data().workTypeIds && aDoc.data().workTypeIds[0]) || '';
      var now = new Date();
      var id = genId('wlog');
      var date = Utilities_formatDateLocal(now);
      return db.collection('work_logs').doc(id).set({
        id:id, assistantId:assistantId, assistantName:p.name||'', date:date,
        clockIn:formatTimeLocal(now), clockOut:'', workTypeId:workTypeId, breakMin:0,
        breakStartedAt:'', breakLogs:[],
        memo:'자동 출근(로그인)', cost:0, yearMonth:date.slice(0,7), createdAt:nowStr()
      }).then(function(){ return { success:true, id:id }; });
    });
  });
};
// 휴식 시작/종료 — 조교 본인의 진행 중인 근무 기록에만 적용됨
api.startBreak = function(db, p){
  var assistantId = String(p.id);
  return db.collection('work_logs').where('assistantId','==',assistantId).where('clockOut','==','').get().then(function(snap){
    if (snap.empty) return { success:false, msg:'출근 중인 기록이 없습니다.' };
    var doc = snap.docs[0];
    if (doc.data().breakStartedAt) return { success:true }; // 이미 휴식 중이면 그대로
    return doc.ref.update({ breakStartedAt: formatTimeLocal(new Date()) }).then(function(){ return { success:true }; });
  });
};
api.endBreak = function(db, p){
  var assistantId = String(p.id);
  return db.collection('work_logs').where('assistantId','==',assistantId).where('clockOut','==','').get().then(function(snap){
    if (snap.empty) return { success:false, msg:'출근 중인 기록이 없습니다.' };
    var doc = snap.docs[0];
    var d = doc.data();
    if (!d.breakStartedAt) return { success:true }; // 휴식 중이 아니면 그대로
    var now = new Date();
    var startDate = parseDateTimeLocal(d.date, d.breakStartedAt);
    var addMin = Math.max(0, Math.round((now - startDate) / 60000));
    var breakLogs = (d.breakLogs || []).concat([d.breakStartedAt + '~' + formatTimeLocal(now)]);
    return doc.ref.update({ breakStartedAt:'', breakMin: Number(d.breakMin||0) + addMin, breakLogs: breakLogs })
      .then(function(){ return { success:true }; });
  });
};
api.getMyBreakStatus = function(db, p){
  var assistantId = String(p.id);
  return db.collection('work_logs').where('assistantId','==',assistantId).where('clockOut','==','').get().then(function(snap){
    if (snap.empty) return { onBreak:false, working:false };
    var d = snap.docs[0].data();
    return { onBreak: !!d.breakStartedAt, working:true, breakStartedAt: d.breakStartedAt||'' };
  });
};
api.clockOut = function(db, p){
  var assistantId = String(p.id);
  return db.collection('work_logs').where('assistantId','==',assistantId).where('clockOut','==','').get().then(function(snap){
    if (snap.empty) return { success:true };
    var doc = snap.docs[0];
    var d = doc.data();
    var now = new Date();
    var clockInDate = parseDateTimeLocal(d.date, d.clockIn);
    var totalMin = Math.max(0, (now - clockInDate) / 60000);
    var breakMin = Number(d.breakMin||0);
    var breakLogs = d.breakLogs || [];
    // 휴식 종료를 안 누르고 퇴근하면 그 시점까지를 휴식으로 자동 마감
    if (d.breakStartedAt) {
      var bs = parseDateTimeLocal(d.date, d.breakStartedAt);
      breakMin += Math.max(0, Math.round((now - bs) / 60000));
      breakLogs = breakLogs.concat([d.breakStartedAt + '~' + formatTimeLocal(now)]);
    }
    var hours = Math.max(0, (totalMin - breakMin) / 60);
    return db.collection('work_types').get().then(function(wtSnap){
      var rate = 0;
      wtSnap.forEach(function(wt){ if (wt.id === d.workTypeId) rate = Number(wt.data().hourlyRate||0); });
      var cost = Math.round(hours * rate);
      return doc.ref.update({ clockOut: formatTimeLocal(now), cost: cost, breakMin: breakMin, breakStartedAt:'', breakLogs: breakLogs })
        .then(function(){ return { success:true, hours:Math.round(hours*10)/10, cost:cost }; });
    });
  });
};
api.getMyWorkLogs = function(db, p){
  return db.collection('work_logs').where('assistantId','==',String(p.id)).get().then(function(snap){
    return { logs: docsToArr(snap).sort(function(a,b){return (a.date+a.clockIn)<(b.date+b.clockIn)?1:-1;}).slice(0,50) };
  });
};
api.getActiveWorkLogs = function(db){
  return db.collection('work_logs').where('clockOut','==','').get().then(function(snap){
    return { logs: docsToArr(snap) };
  });
};
function Utilities_formatDateLocal(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function formatTimeLocal(d){
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function parseDateTimeLocal(dateStr, timeStr){
  var dp = (dateStr||'').split('-'), tp = (timeStr||'0:0').split(':');
  return new Date(Number(dp[0]), Number(dp[1])-1, Number(dp[2]), Number(tp[0]), Number(tp[1]));
}
api.getExpenseLogs = function(db, p){
  var q = db.collection('expense_logs').where('yearMonth','==',String(p.yearMonth||''));
  return q.get().then(function(snap){
    return { logs: docsToArr(snap).map(function(r){
      return { id:r.id, assistantId:r.assistantId||'', date:r.date||'', amount:Number(r.amount||0), description:r.description||'', memo:r.memo||'' };
    }) };
  });
};
api.addExpenseLog = function(db, p){
  var id = genId('exp');
  return db.collection('expense_logs').doc(id).set({
    id:id, assistantId:String(p.assistantId), date:p.date||'', amount:Number(p.amount||0),
    description:p.description||'', memo:p.memo||'', yearMonth:(p.date||'').slice(0,7), createdAt:nowStr()
  }).then(function(){ return { success:true, id:id }; });
};
api.deleteExpenseLog = function(db, p){
  return db.collection('expense_logs').doc(String(p.id)).delete().then(function(){ return { success:true }; });
};

/* ---------- 학생 상세 (수강/클리닉/질문/성적 이력) ---------- */
api.getStudentFullHistory = function(db, p){
  var sid = String(p.studentId);
  return Promise.all([
    db.collection('attendance').where('studentId','==',sid).get(),
    db.collection('clinic_bookings').where('studentId','==',sid).get(),
    db.collection('mandatory_clinic').where('studentId','==',sid).get(),
    db.collection('qna').where('studentId','==',sid).get(),
    db.collection('scores').where('studentId','==',sid).get()
  ]).then(function(res){
    var attRows=docsToArr(res[0]), cbRows=docsToArr(res[1]), mcRows=docsToArr(res[2]), qnaRows=docsToArr(res[3]), scoreRows=docsToArr(res[4]);
    var sessionIds=[];
    attRows.forEach(function(r){ if(r.sessionId && sessionIds.indexOf(r.sessionId)<0) sessionIds.push(r.sessionId); });
    scoreRows.forEach(function(r){ if(r.sessionId && sessionIds.indexOf(r.sessionId)<0) sessionIds.push(r.sessionId); });
    var examIds=[];
    scoreRows.forEach(function(r){ if(r.examId && examIds.indexOf(r.examId)<0) examIds.push(r.examId); });
    return Promise.all([
      Promise.all(sessionIds.map(function(id){ return db.collection('sessions').doc(id).get(); })),
      Promise.all(examIds.map(function(id){ return db.collection('exams').doc(id).get(); }))
    ]).then(function(res2){
      var sesMap={}; res2[0].forEach(function(d){ if(d.exists) sesMap[d.id]=d.data(); });
      var examMap={}; res2[1].forEach(function(d){ if(d.exists) examMap[d.id]=d.data(); });
      var classIds=[];
      Object.keys(sesMap).forEach(function(k){ var cid=String(sesMap[k].classId||''); if(cid && classIds.indexOf(cid)<0) classIds.push(cid); });
      return Promise.all(classIds.map(function(id){ return db.collection('classes').doc(id).get(); })).then(function(classDocs){
        var clsMap={}; classDocs.forEach(function(d){ if(d.exists) clsMap[d.id]=d.data(); });
        var attendance = attRows.map(function(r){
          var ses=sesMap[r.sessionId]||{}, cls=clsMap[String(ses.classId||'')]||{};
          return { sessionNum:ses.sessionNum||'', date:ses.date||'', className:cls.name||'', status:r.status||'', memo:r.memo||'' };
        }).sort(function(a,b){ return (a.date||'')<(b.date||'')?1:-1; });
        var clinicHistory = cbRows.map(function(r){
          return { type:'클리닉 신청', name:r.clinicName||'클리닉', date:(r.date||'')+' '+(r.time||''), status:r.status||'', createdAt:r.createdAt||r.date||'' };
        }).concat(mcRows.map(function(r){
          var when = r.type==='temp' ? r.date : (r.day+'요일마다');
          return { type:'의무클리닉', name:when+' '+(r.time||'')+(r.targetDay?' ('+r.targetDay+'요일 몫)':''), date:'', status:'', createdAt:r.createdAt||'' };
        })).sort(function(a,b){ return (a.createdAt||'')<(b.createdAt||'')?1:-1; });
        var qna = qnaRows.filter(function(r){ return r.status!=='deleted'; }).map(function(r){
          return { title:r.title||'', date:r.date||'', answered: r.status==='answered' };
        }).sort(function(a,b){ return (a.date||'')<(b.date||'')?1:-1; });
        var scores = scoreRows.map(function(r){
          var exam=examMap[r.examId]||{}, ses=sesMap[r.sessionId]||{}, cls=clsMap[String(ses.classId||'')]||{};
          return { examName:exam.name||'(삭제된 시험)', className:cls.name||'', sessionNum:ses.sessionNum||0, score:r.score||'', pass:r.pass||'', feedback:r.feedback||'' };
        }).sort(function(a,b){ return (Number(a.sessionNum)||0)<(Number(b.sessionNum)||0)?1:-1; });
        return { attendance:attendance, clinicHistory:clinicHistory, qna:qna, scores:scores };
      });
    });
  });
};

/* ---------- 설문조사 ---------- */
function svParseArr(v){ if(Array.isArray(v)) return v; try{ var a=JSON.parse(v||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function svNowIso(){
  var d=new Date();
  function p(n){ return (n<10?'0':'')+n; }
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
}
api.getSurveys = function(db){
  return db.collection('surveys').get().then(function(snap){
    var list=docsToArr(snap).map(function(r){
      return { id:r.id, title:r.title||'', color:r.color||'#3b82f6', targetClassIds:r.targetClassIds||[],
        startAt:r.startAt||'', endAt:r.endAt||'', allowEdit:r.allowEdit!==false, buttonType:r.buttonType||'submit',
        maxResponses:Number(r.maxResponses||0), questions:r.questions||[], createdAt:r.createdAt||'' };
    });
    list.sort(function(a,b){ return (a.createdAt||'')<(b.createdAt||'')?1:-1; });
    return Promise.all(list.map(function(s){
      return db.collection('survey_responses').where('surveyId','==',s.id).get().then(function(rs){ s.responseCount=rs.size; });
    })).then(function(){ return { surveys:list }; });
  });
};
api.addSurvey = function(db, p){
  var id = genId('sv');
  var data = {
    id:id, title:p.title||'', color:p.color||'#3b82f6',
    targetClassIds: svParseArr(p.targetClassIds),
    startAt:p.startAt||'', endAt:p.endAt||'',
    allowEdit: p.allowEdit!=='0',
    buttonType: p.buttonType||'submit',
    maxResponses: Number(p.maxResponses||0),
    questions: svParseArr(p.questions),
    createdAt: nowStr()
  };
  return db.collection('surveys').doc(id).set(data).then(function(){ return { success:true, id:id }; });
};
api.updateSurvey = function(db, p){
  var data={};
  ['title','color','startAt','endAt','buttonType'].forEach(function(k){ if(p[k]!==undefined) data[k]=p[k]; });
  if(p.targetClassIds!==undefined) data.targetClassIds=svParseArr(p.targetClassIds);
  if(p.allowEdit!==undefined) data.allowEdit = p.allowEdit!=='0';
  if(p.maxResponses!==undefined) data.maxResponses=Number(p.maxResponses||0);
  if(p.questions!==undefined) data.questions=svParseArr(p.questions);
  return db.collection('surveys').doc(String(p.id)).update(data).then(function(){ return { success:true }; });
};
api.deleteSurvey = function(db, p){
  return db.collection('surveys').doc(String(p.id)).delete().then(function(){
    return db.collection('survey_responses').where('surveyId','==',String(p.id)).get();
  }).then(function(snap){
    return Promise.all(snap.docs.map(function(d){ return d.ref.delete(); }));
  }).then(function(){ return { success:true }; });
};
api.getSurveyResponses = function(db, p){
  return db.collection('survey_responses').where('surveyId','==',String(p.surveyId)).get().then(function(snap){
    var list=docsToArr(snap).sort(function(a,b){ return (a.submittedAt||'')<(b.submittedAt||'')?1:-1; });
    return { responses:list };
  });
};
api.getMySurveys = function(db, p){
  var studentId = String(p.studentId||'');
  return db.collection('students').doc(studentId).get().then(function(sdoc){
    var classId = sdoc.exists ? String(sdoc.data().classId||'') : '';
    return db.collection('surveys').get().then(function(snap){
      var now = svNowIso();
      var list = docsToArr(snap).filter(function(s){
        var tc = s.targetClassIds||[];
        if(tc.length && tc.indexOf(classId)<0) return false;
        if(s.startAt && now < s.startAt) return false;
        if(s.endAt && now > s.endAt) return false;
        return true;
      });
      return db.collection('survey_responses').where('studentId','==',studentId).get().then(function(rsnap){
        var respMap={}; rsnap.forEach(function(d){ var r=d.data(); respMap[r.surveyId]=r; });
        var items = list.map(function(s){
          var resp = respMap[s.id];
          return { id:s.id, title:s.title||'', color:s.color||'#3b82f6', buttonType:s.buttonType||'submit',
            allowEdit:s.allowEdit!==false, endAt:s.endAt||'', questions:s.questions||[],
            responded: !!resp, myAnswers: resp?(resp.answers||{}):{} };
        });
        items.sort(function(a,b){ return a.responded===b.responded ? 0 : (a.responded?1:-1); });
        return { items:items };
      });
    });
  });
};
api.submitSurveyResponse = function(db, p){
  var id = String(p.surveyId)+'__'+String(p.studentId);
  var answers={}; try{ answers=JSON.parse(p.answers||'{}'); }catch(e){}
  return db.collection('survey_responses').doc(id).set({
    id:id, surveyId:String(p.surveyId), studentId:String(p.studentId), studentName:p.studentName||'',
    answers:answers, submittedAt: nowStr()
  },{merge:true}).then(function(){ return { success:true }; });
};

/* ---------- 외부 노출 (페이지에서 직접 Firestore 사용) ---------- */
window.mkdbReady = _dbReady;
window.mkGenId = genId;
window.mkNowStr = nowStr;
// 조교 출퇴근 시 선생님에게 카카오 알림톡 발송 (Apps Script sendAlimtalk 재사용)
var TEACHER_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxuC16lPtzh8jcU1dUC2TKUjF7AW33PizaOHEwpTk8Bl5W92B1MQwXHTzBBgBMDRQZS/exec';
var TEACHER_NOTIFY_PHONE = '01062519244';
function notifyTeacherAssistantEvent(type, assistantName){
  try{
    var now = new Date();
    function p(n){ return (n<10?'0':'')+n; }
    var dateStr = now.getFullYear()+'-'+p(now.getMonth()+1)+'-'+p(now.getDate());
    var timeStr = p(now.getHours())+':'+p(now.getMinutes());
    var title = type==='in' ? '조교 출근 알림' : '조교 퇴근 알림';
    var verb = type==='in' ? '출근' : '퇴근';
    var body = {
      action:'sendAlimtalk',
      appToken: APP_SHARED_TOKEN,
      messages:[{ phone:TEACHER_NOTIFY_PHONE, name:assistantName||'', className:title, sessionNum:dateStr+' '+timeStr, message:(assistantName||'')+' 조교님이 '+verb+'했습니다.' }]
    };
    return (typeof _origFetch==='function'?_origFetch:window.fetch)(TEACHER_APPS_SCRIPT_URL, { method:'POST', body: JSON.stringify(body) }).catch(function(){});
  }catch(e){}
}
// 조교 로그인/로그아웃 시 자동 출퇴근 체크(각 페이지의 로그인/로그아웃 처리에서 호출)
window.mkClockIn = function(session){
  return _dbReady.then(function(db){ return api.clockIn(db, { id:session.id, name:session.name }); })
    .then(function(r){ notifyTeacherAssistantEvent('in', session.name); return r; })
    .catch(function(err){ console.error('[mkClockIn] 자동 출근 기록 실패:', err); });
};
window.mkClockOut = function(session){
  if (!session || session.role !== 'assistant') return Promise.resolve();
  return _dbReady.then(function(db){ return api.clockOut(db, { id:session.id }); })
    .then(function(r){ notifyTeacherAssistantEvent('out', session.name); return r; })
    .catch(function(){});
};
// 모바일(폰/태블릿) 기기 판별 — 학생 자동 로그아웃을 폰에서만 끄기 위해 사용
window.mkIsMobile = function(){
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|BlackBerry|Windows Phone/i.test(navigator.userAgent || '');
};

/* ---------- fetch 가로채기 ---------- */
var _origFetch = window.fetch.bind(window);

function parseParams(url){
  var q = url.split('?')[1] || '';
  var params = {};
  q.split('&').forEach(function(pair){
    if (!pair) return;
    var i = pair.indexOf('=');
    var k = i < 0 ? pair : pair.slice(0,i);
    var v = i < 0 ? '' : pair.slice(i+1);
    try { params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g,' ')); }
    catch(e) { params[k] = v; }
  });
  return params;
}

function fakeResponse(obj){
  return {
    ok: true, status: 200,
    json: function(){ return Promise.resolve(obj); },
    text: function(){ return Promise.resolve(JSON.stringify(obj)); }
  };
}

window.fetch = function(url, opts){
  if (typeof url === 'string' && url.indexOf('script.google.com') !== -1) {
    if (opts && opts.method && opts.method.toUpperCase() === 'POST') {
      // POST body에서 action 파싱
      var bodyStr = opts.body || '';
      var bodyObj = {};
      try { bodyObj = JSON.parse(bodyStr); } catch(e) {}
      var postAction = bodyObj.action || '';
      // 파일 업로드(uploadFile)와 알림톡 발송(sendAlimtalk)만 진짜 Apps Script로 통과
      // (외부에서 이 주소를 직접 호출해 알림톡을 무단 발송/파일을 무단 업로드하지 못하도록 앱 전용 토큰을 자동으로 붙여서 보냄)
      if (postAction === 'uploadFile' || postAction === 'sendAlimtalk' || postAction === 'getFileBase64' || !postAction) {
        if (postAction) {
          bodyObj.appToken = APP_SHARED_TOKEN;
          opts = Object.assign({}, opts, { body: JSON.stringify(bodyObj) });
        }
        return _origFetch(url, opts);
      }
      // 나머지 POST(submitQuestion, submitAnswer 등)는 Firestore로 처리
      if (api[postAction]) {
        return _dbReady.then(function(db){
          return api[postAction](db, bodyObj);
        }).then(function(result){
          return fakeResponse(result);
        }).catch(function(err){
          console.error('[firebase-api] POST ' + postAction + ' 오류:', err);
          return fakeResponse({ success:false, error:String(err) });
        });
      }
      return _origFetch(url, opts);
    }
    var params = parseParams(url);
    var action = params.action || '';
    if (api[action]) {
      return _dbReady.then(function(db){
        return api[action](db, params);
      }).then(function(result){
        return fakeResponse(result);
      }).catch(function(err){
        console.error('[firebase-api] ' + action + ' 오류:', err);
        return fakeResponse({ success:false, error:String(err) });
      });
    }
    console.warn('[firebase-api] 미구현 액션: ' + action + ' → Apps Script로 전달');
    return _origFetch(url, opts);
  }
  return _origFetch(url, opts);
};

})();
