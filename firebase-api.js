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
    .then(function(){
      firebase.initializeApp(firebaseConfig);
      resolve(firebase.firestore());
    })
    .catch(reject);
});

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
api.login = function(db, p){
  return db.collection('students').where('id','==',String(p.id)).get().then(function(snap){
    if (snap.empty) {
      // 부트스트랩: 학생 컬렉션이 완전히 비어있으면 첫 로그인 계정을 선생님으로 생성
      return db.collection('students').limit(1).get().then(function(all){
        if (all.empty) {
          var teacher = { id:String(p.id), password:String(p.password), role:'teacher', name:'김민관', parentPhone:'', school:'', classId:'' };
          return db.collection('students').doc(String(p.id)).set(teacher).then(function(){
            return { success:true, role:'teacher', name:'김민관', classId:'', className:'' };
          });
        }
        return { success:false };
      });
    }
    var u = snap.docs[0].data();
    if (String(u.password) !== String(p.password)) return { success:false };
    var role = u.role || 'student';
    var result = { success:true, role:role, name:u.name || u.id, classId:'', className:'' };
    if (role === 'student' && u.classId) {
      result.classId = String(u.classId);
      return db.collection('classes').doc(String(u.classId)).get().then(function(c){
        if (c.exists) result.className = c.data().name || '';
        return result;
      });
    }
    return result;
  });
};

api.addStudent = function(db, p){
  var sid = String(p.sid || p.studentPhone || '');
  if (!sid) return Promise.resolve({ success:false, msg:'아이디가 없습니다.' });
  var ref = db.collection('students').doc(sid);
  return ref.get().then(function(doc){
    if (doc.exists) return { success:false, msg:'이미 존재하는 아이디입니다.' };
    return ref.set({
      id: sid, password: String(p.spw || '1234'), role:'student',
      name: p.sname || '', parentPhone: p.parentPhone || '', school:'', classId:''
    }).then(function(){ return { success:true }; });
  });
};

api.getStudents = function(db){
  return db.collection('students').where('role','==','student').get().then(function(snap){
    var students = docsToArr(snap).map(function(r){
      return { id:String(r.id), studentPhone:String(r.id), parentPhone:r.parentPhone||'', name:r.name||'', school:r.school||'', classId:String(r.classId||'') };
    });
    return { students: students };
  });
};

api.changePassword = function(db, p){
  var ref = db.collection('students').doc(String(p.id));
  return ref.get().then(function(doc){
    if (!doc.exists) return { success:false, msg:'사용자를 찾을 수 없습니다.' };
    if (String(doc.data().password) !== String(p.oldPw)) return { success:false, msg:'현재 비밀번호가 틀렸습니다.' };
    return ref.update({ password: String(p.newPw) }).then(function(){ return { success:true }; });
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
  var tasks = [
    db.collection('classes').doc(String(p.classId)).get(),
    db.collection('students').where('classId','==',String(p.classId)).get()
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
      .map(function(r){ return { id:String(r.id), sessionId:String(r.sessionId), name:r.name||'', createdAt:r.createdAt||'' }; });
    return { exams: exams };
  });
};

api.deleteExam = function(db, p){
  return db.collection('exams').doc(String(p.id)).delete()
    .then(function(){ return { success:true }; }, function(){ return { success:false }; });
};

/* === 자료실 === */
api.getMaterials = function(db, p){
  return db.collection('materials').where('classId','==',String(p.classId)).get().then(function(snap){
    var mats = docsToArr(snap).sort(function(a,b){ return (a.uploadDate||'') < (b.uploadDate||'') ? -1 : 1; })
      .map(function(r){
        return { id:String(r.id), classId:String(r.classId), category:r.category||'', name:r.name||'', url:r.url||'',
                 size:r.size||'', uploadDate:r.uploadDate||'', downloadCount:Number(r.downloadCount||0), memo:r.memo||'' };
      });
    return { materials: mats };
  });
};

api.addMaterial = function(db, p){
  var id = genId('mat');
  return db.collection('materials').doc(id).set({
    id:id, classId:String(p.classId), category:p.category||'자습용 자료', name:p.name||'', url:p.url||'',
    size:p.size||'', uploadDate:nowStr(), downloadCount:0, memo:p.memo||''
  }).then(function(){ return { success:true, id:id }; });
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
    // 파일 업로드(POST uploadFile)는 기존 Apps Script로 통과 (Google Drive 저장)
    if (opts && opts.method && opts.method.toUpperCase() === 'POST') {
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
