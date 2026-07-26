/* ============================================================
   firebase-api.js — 김민관 수학 홈페이지 백엔드 (Firebase Firestore)
   기존 Apps Script(script.google.com) 요청을 가로채서 Firestore로 처리.
   파일 업로드(uploadFile)만 기존 Apps Script로 통과시킴 (Google Drive 저장).
   ============================================================ */
(function(){
'use strict';

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

    var tryDoc = function(i){
      if (i >= docIds.length) {
        return db.collection('students').where('parentPhone','==',authId).limit(1).get().then(function(snap){
          if (snap.empty) return { success:false };
          var u = snap.docs[0].data(); var sid = snap.docs[0].id;
          if (u.active === false) return { success:false, msg:'비활성화된 계정입니다. 선생님께 문의해주세요.' };
          var res = { success:true, role:'student', name:u.name||sid, classId:'', className:'', studentId:sid };
          if (!u.classId) return res;
          res.classId = String(u.classId);
          return db.collection('classes').doc(res.classId).get().then(function(c){
            if (c.exists) res.className = c.data().name||'';
            return res;
          });
        });
      }
      return db.collection('students').doc(docIds[i]).get().then(function(doc){
        if (doc.exists) return fetchProfileAfterAuth(db, docIds[i]);
        return tryDoc(i+1);
      });
    };
    return tryDoc(0);
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

// 학부모 로그인 계정이 (고아 계정 충돌 등으로) 안 만들어졌을 때 다시 시도
api.createParentAccount = function(db, p){
  return db.collection('students').doc(String(p.id)).get().then(function(doc){
    if (!doc.exists) return { success:false, msg:'학생을 찾을 수 없습니다.' };
    var u = doc.data();
    var parentPhone = String(u.parentPhone || '');
    if (!parentPhone) return { success:false, msg:'학부모 전화번호가 등록되어 있지 않습니다.' };
    var secondary;
    try { secondary = firebase.app('mk-secondary'); }
    catch(e) { secondary = firebase.initializeApp(firebase.app().options, 'mk-secondary'); }
    return secondary.auth().createUserWithEmailAndPassword(toAuthEmail(parentPhone), toAuthPassword('123456'))
      .then(function(){
        return secondary.auth().signOut().then(function(){ return { success:true }; });
      })
      .catch(function(err){
        return secondary.auth().signOut().catch(function(){}).then(function(){
          if (err.code === 'auth/email-already-in-use') {
            return { success:false, code:err.code, msg:'이 학부모 번호는 이미 로그인 계정이 있어요(정상). 그래도 로그인이 안 되면 비밀번호(기본 123456) 문제일 수 있어요. 정말 안 되면 Firebase 콘솔 Authentication에서 '+parentPhone+'@mkmath.local 계정을 삭제 후 다시 시도해보세요.' };
          }
          if (err.code === 'auth/too-many-requests') {
            return { success:false, code:err.code, msg:'요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' };
          }
          return { success:false, code:err.code||'', msg:(err.code||'')+' '+(err.message||'생성 실패') };
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
  return db.collection('classes').get().then(function(snap){
    var classes = docsToArr(snap).map(function(r){
      return { id:String(r.id), name:r.name||'', time:r.time||'', start:r.start||'', end:r.end||'', status:r.status||'active' };
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
      .map(function(r){ return { id:String(r.id), sessionId:String(r.sessionId), name:r.name||'', range:r.range||'', totalQuestions:r.totalQuestions||'', scoreType:r.scoreType||'score', passCutoff:r.passCutoff||'', grade1:r.grade1||'', grade2:r.grade2||'', grade3:r.grade3||'', grade4:r.grade4||'', createdAt:r.createdAt||'' }; });
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
  }).then(function(){ return { success:true }; });
};
api.getHwStatuses = function(db, p){
  return db.collection('hw_status').where('sessionId','==',String(p.sessionId)).get().then(function(snap){
    var list = docsToArr(snap).map(function(r){ return { studentId:String(r.studentId), hwId:String(r.hwId), pass:r.pass||'', feedback:r.feedback||'' }; });
    return { statuses: list };
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
        salaryType:r.salaryType||'hourly', workTypeIds:r.workTypeIds||[], active:r.active!==false, createdAt:r.createdAt||'' }; }) };
  });
};
api.addAssistant = function(db, p){
  var id = genId('ast');
  return db.collection('assistants').doc(id).set({
    id:id, name:p.name||'', phone:p.phone||'', isAdmin:false,
    salaryType:p.salaryType||'hourly', workTypeIds:[], active:true, createdAt:nowStr()
  }).then(function(){ return { success:true, id:id }; });
};
api.updateAssistant = function(db, p){
  var data={};
  if(p.name!==undefined) data.name=p.name;
  if(p.phone!==undefined) data.phone=p.phone;
  if(p.isAdmin!==undefined) data.isAdmin=p.isAdmin;
  if(p.salaryType!==undefined) data.salaryType=p.salaryType;
  if(p.workTypeIds!==undefined) data.workTypeIds=Array.isArray(p.workTypeIds)?p.workTypeIds:JSON.parse(p.workTypeIds||'[]');
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

/* ---------- 외부 노출 (페이지에서 직접 Firestore 사용) ---------- */
window.mkdbReady = _dbReady;
window.mkGenId = genId;
window.mkNowStr = nowStr;

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
      if (postAction === 'uploadFile' || postAction === 'sendAlimtalk' || postAction === 'getFileBase64' || !postAction) {
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
