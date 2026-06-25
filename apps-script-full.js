function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === 'uploadFile') {
      var folderName = 'MKMath 자료실';
      var folders = DriveApp.getFoldersByName(folderName);
      var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
      var decoded = Utilities.base64Decode(data.fileData);
      var blob = Utilities.newBlob(decoded, data.mimeType || 'application/octet-stream', data.fileName);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var url = 'https://drive.google.com/file/d/' + file.getId() + '/view';
      return ContentService.createTextOutput(JSON.stringify({ success: true, url: url }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ error: 'unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var action = e.parameter.action || '';
  switch(action) {
    case 'login':              return login(e.parameter);
    case 'addStudent':         return addStudent(e.parameter);
    case 'getStudents':        return getStudents(e.parameter);
    case 'changePassword':     return changePassword(e.parameter);
    case 'getReviews':         return getReviews(e.parameter);
    case 'addReview':          return addReview(e.parameter);
    case 'hideReview':         return hideReview(e.parameter);
    case 'initReviews':        return initReviews(e.parameter);
    case 'submitQuestion':     return submitQuestion(e.parameter);
    case 'getQuestions':       return getQuestions(e.parameter);
    case 'getQuestion':        return getQuestion(e.parameter);
    case 'deleteQuestion':     return deleteQuestion(e.parameter);
    case 'submitAnswer':       return submitAnswer(e.parameter);
    case 'updateAnswer':       return updateAnswer(e.parameter);
    case 'deleteAnswer':       return deleteAnswer(e.parameter);
    case 'getStudentInfo':     return getStudentInfo(e.parameter);
    case 'getClasses':         return getClasses(e.parameter);
    case 'addClass':           return addClass(e.parameter);
    case 'deleteClass':        return deleteClass(e.parameter);
    case 'toggleClassStatus':  return toggleClassStatus(e.parameter);
    case 'assignStudentClass': return assignStudentClass(e.parameter);
    case 'getClassStudents':   return getClassStudents(e.parameter);
    case 'getSessions':        return getSessions(e.parameter);
    case 'addSession':         return addSession(e.parameter);
    case 'deleteSession':      return deleteSession(e.parameter);
    case 'getSession':         return getSession(e.parameter);
    case 'setAttendance':      return setAttendance(e.parameter);
    case 'getAttendance':      return getAttendance(e.parameter);
    case 'getAttendanceHistory': return getAttendanceHistory(e.parameter);
    case 'setScore':           return setScore(e.parameter);
    case 'getScores':          return getScores(e.parameter);
    case 'addExam':            return addExam(e.parameter);
    case 'getExams':           return getExams(e.parameter);
    case 'deleteExam':         return deleteExam(e.parameter);
    case 'getMaterials':       return getMaterials(e.parameter);
    case 'addMaterial':        return addMaterial(e.parameter);
    case 'deleteMaterial':     return deleteMaterial(e.parameter);
    case 'incDownload':        return incDownload(e.parameter);
    default: return json({ error: 'unknown action' });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 로그인 ──
function login(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students') || ss.getSheets()[0];
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id) && String(rows[i][1]) === String(params.password)) {
      var role = rows[i][2] || 'student';
      var name = rows[i][3] || rows[i][0];
      var classId = ''; var className = '';
      if (role === 'student') {
        classId = String(rows[i][6] || '');
        if (classId) {
          var clsSh = ss.getSheetByName('classes');
          if (clsSh && clsSh.getLastRow() >= 2) {
            var clsRows = clsSh.getDataRange().getValues();
            for (var k = 1; k < clsRows.length; k++) {
              if (String(clsRows[k][0]) === classId) { className = clsRows[k][1]; break; }
            }
          }
        }
      }
      return json({ success: true, role: role, name: name, classId: classId, className: className });
    }
  }
  return json({ success: false });
}

// ── 학생 추가 ──
function addStudent(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students') || ss.getSheets()[0];
  var rows = sheet.getDataRange().getValues();
  var sid = params.sid || params.studentPhone || '';
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(sid)) return json({ success: false, msg: '이미 존재하는 아이디입니다.' });
  }
  var pw = params.spw || '1234';
  var name = params.sname || '';
  var parentPhone = params.parentPhone || '';
  sheet.appendRow([sid, pw, 'student', name, parentPhone, '', '']);
  return json({ success: true });
}

// ── 학생 목록 ──
function getStudents(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students') || ss.getSheets()[0];
  if (sheet.getLastRow() < 2) return json({ students: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var students = rows.filter(function(r){ return r[0] && r[2] === 'student'; }).map(function(r){
    return { id: String(r[0]), studentPhone: String(r[0]), parentPhone: r[4]||'', name: r[3]||'', school: r[5]||'', classId: String(r[6]||'') };
  });
  return json({ students: students });
}

// ── 비밀번호 변경 ──
function changePassword(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students') || ss.getSheets()[0];
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) {
      if (String(rows[i][1]) !== String(params.oldPw)) return json({ success: false, msg: '현재 비밀번호가 틀렸습니다.' });
      sheet.getRange(i+1,2).setValue(params.newPw);
      return json({ success: true });
    }
  }
  return json({ success: false, msg: '사용자를 찾을 수 없습니다.' });
}

// ── 학생 정보 ──
function getStudentInfo(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students') || ss.getSheets()[0];
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) {
      return json({ success: true, name: rows[i][3]||'', school: rows[i][5]||'', cls: rows[i][6]||'' });
    }
  }
  return json({ success: false });
}

// ── 후기 ──
function getReviews(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('reviews');
  if (!sheet || sheet.getLastRow() < 2) return json({ reviews: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var reviews = rows.filter(function(r){ return r[0] && r[3] !== 'true' && String(r[3]) !== 'TRUE'; })
    .map(function(r){ return { id: r[0], text: r[1], studentId: r[2]||'' }; });
  return json({ reviews: reviews });
}
function addReview(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('reviews');
  if (!sheet) { sheet = ss.insertSheet('reviews'); sheet.appendRow(['id','text','studentId','hidden']); }
  sheet.appendRow(['rv_'+Date.now(), params.text||'', params.studentId||'', false]);
  return json({ success: true });
}
function hideReview(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('reviews');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) { sheet.getRange(i+1,4).setValue('true'); return json({ success: true }); }
  }
  return json({ success: false });
}
function initReviews(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('reviews');
  if (!sheet) { sheet = ss.insertSheet('reviews'); }
  if (sheet.getLastRow() > 1) return json({ msg: '이미 데이터가 있습니다.' });
  if (sheet.getLastRow() === 0) sheet.appendRow(['id','text','studentId','hidden']);
  var hardcoded = [
    '선생님 덕분에 이번에 또 100점을 받게 되었습니다. 수강 전에는 고난도 문제를 풀지 못했는데, 다양한 문제를 접하고 새로운 풀이를 배우면서 실력을 길렀습니다. 중하위권 학생들에게 성적을 크게 끌어올릴 수 있는 수업이라고 추천하고 싶습니다!',
    '개념설명을 하나씩 자세히 설명해주셔서 굳이 여러바퀴 안돌리고 1바퀴만 돌리고 시험봐도 충분히 2등급은 나올정도로 설명을 깔끔히 잘 해주시고 학생 개개인마다 난이도에 맞는 문제를 주셔서 숙제도 부담없이 할 수 있어요.',
    '수업에서는 학생들이 생각할 수 있는 시간을 충분히 주면서 수업했고 이해하지 못하는 학생이 있으면 선생님께서 그 학생에 맞춰 설명을 해주셔서 더욱 깊게 개념을 이해할 수 있었습니다!!',
    '처음에 수학을 포기하려 했는데 선생님 수업 듣고 나서 수학이 재미있어졌어요. 설명이 정말 친절하고 이해하기 쉬워요.',
    '자체 워크북이 정말 유용해요. 시험 전에 워크북만 풀어도 충분히 커버가 됩니다.',
    '클리닉 시스템이 너무 좋아요. 모르는 거 생기면 바로바로 해결할 수 있어서 개념이 쌓이지 않아요.',
    '선생님이 각 학생 수준에 맞게 문제를 골라주셔서 부담 없이 공부할 수 있었습니다.',
    '수업 방식이 단순 암기가 아니라 이해 중심이라 나중에 응용문제도 잘 풀 수 있게 됐어요.',
    '처음엔 수포자였는데 지금은 수학이 제일 자신있는 과목이 됐습니다. 감사합니다!',
    '과제 피드백을 꼼꼼하게 해주셔서 어디서 틀렸는지 정확히 알 수 있어요.'
  ];
  hardcoded.forEach(function(t, i) { sheet.appendRow(['rv_init_'+i, t, '', false]); });
  return json({ success: true });
}

// ── 질의응답 ──
function submitQuestion(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('qna');
  if (!sheet) { sheet = ss.insertSheet('qna'); sheet.appendRow(['id','제목','내용','학생id','학생이름','작성일시','상태','비밀글']); }
  var id = 'q_'+Date.now();
  var now = Utilities.formatDate(new Date(),'Asia/Seoul','yyyy.MM.dd HH:mm');
  sheet.appendRow([id, params.title||'', params.content||'', params.studentId||'', params.studentName||'', now, 'open', params.secret||'false']);
  return json({ success: true, id: id });
}
function getQuestions(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('qna');
  if (!sheet || sheet.getLastRow() < 2) return json({ questions: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var isTeacher = params.role === 'teacher';
  var myId = params.studentId || '';
  var questions = rows.filter(function(r){ return r[0] && r[6] !== 'deleted'; }).map(function(r){
    var isSecret = String(r[7]) === 'true';
    var isOwner = String(r[3]) === myId;
    var canSee = isTeacher || isOwner || !isSecret;
    return { id: r[0], title: canSee ? r[1] : '비밀글입니다.', studentId: r[3], studentName: canSee ? (r[4]||'') : '비밀', date: r[5], status: r[6], secret: isSecret, canSee: canSee };
  }).reverse();
  return json({ questions: questions });
}
function getQuestion(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('qna');
  var ansSheet = ss.getSheetByName('qna_answers');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  var q = null; var qRow = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) { q = rows[i]; qRow = i; break; }
  }
  if (!q) return json({ success: false });
  var isTeacher = params.role === 'teacher';
  var myId = params.studentId || '';
  var isSecret = String(q[7]) === 'true';
  var isOwner = String(q[3]) === myId;
  if (isSecret && !isTeacher && !isOwner) return json({ success: false, msg: '비밀글입니다.' });
  var answer = null;
  if (ansSheet && ansSheet.getLastRow() >= 2) {
    var aRows = ansSheet.getDataRange().getValues().slice(1);
    for (var j = 0; j < aRows.length; j++) {
      if (String(aRows[j][1]) === String(params.id)) { answer = { id: aRows[j][0], questionId: aRows[j][1], content: aRows[j][2], date: aRows[j][3] }; break; }
    }
  }
  var otherQs = [];
  for (var k = 1; k < rows.length; k++) {
    if (k !== qRow && String(rows[k][3]) === String(q[3]) && rows[k][6] !== 'deleted') {
      otherQs.push({ id: rows[k][0], title: rows[k][1], date: rows[k][5], status: rows[k][6] });
      if (otherQs.length >= 5) break;
    }
  }
  var stuSheet = ss.getSheetByName('students') || ss.getSheets()[0];
  var stuRows = stuSheet.getDataRange().getValues();
  var school = ''; var cls = '';
  for (var m = 1; m < stuRows.length; m++) {
    if (String(stuRows[m][0]) === String(q[3])) { school = stuRows[m][5]||''; cls = stuRows[m][6]||''; break; }
  }
  return json({ success: true, question: { id: q[0], title: q[1], content: q[2], studentId: q[3], studentName: q[4], date: q[5], status: q[6], secret: isSecret }, answer: answer, otherQuestions: otherQs, studentInfo: { school: school, cls: cls } });
}
function deleteQuestion(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('qna');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) { sheet.getRange(i+1,7).setValue('deleted'); return json({ success: true }); }
  }
  return json({ success: false });
}
function submitAnswer(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('qna_answers');
  if (!sheet) { sheet = ss.insertSheet('qna_answers'); sheet.appendRow(['id','질문id','내용','작성일시']); }
  var now = Utilities.formatDate(new Date(),'Asia/Seoul','yyyy.MM.dd HH:mm');
  sheet.appendRow(['a_'+Date.now(), params.questionId||'', params.content||'', now]);
  var qSheet = ss.getSheetByName('qna');
  if (qSheet) { var rows = qSheet.getDataRange().getValues(); for (var i = 1; i < rows.length; i++) { if (String(rows[i][0]) === String(params.questionId)) { qSheet.getRange(i+1,7).setValue('answered'); break; } } }
  return json({ success: true });
}
function updateAnswer(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('qna_answers');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) {
      sheet.getRange(i+1,3).setValue(params.content||'');
      sheet.getRange(i+1,4).setValue(Utilities.formatDate(new Date(),'Asia/Seoul','yyyy.MM.dd HH:mm'));
      return json({ success: true });
    }
  }
  return json({ success: false });
}
function deleteAnswer(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('qna_answers');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) {
      var qId = rows[i][1]; sheet.deleteRow(i+1);
      var qSheet = ss.getSheetByName('qna');
      if (qSheet) { var qRows = qSheet.getDataRange().getValues(); for (var j = 1; j < qRows.length; j++) { if (String(qRows[j][0]) === String(qId)) { qSheet.getRange(j+1,7).setValue('open'); break; } } }
      return json({ success: true });
    }
  }
  return json({ success: false });
}

// ── 반 관리 ──
function getClasses() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('classes');
  if (!sheet || sheet.getLastRow() < 2) return json({ classes: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var classes = rows.filter(function(r){ return r[0]; }).map(function(r){
    return { id: String(r[0]), name: r[1]||'', time: r[2]||'', start: r[3]||'', end: r[4]||'', status: r[5]||'active' };
  });
  return json({ classes: classes });
}
function addClass(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('classes');
  if (!sheet) { sheet = ss.insertSheet('classes'); sheet.appendRow(['id','name','time','startDate','endDate','status']); }
  var id = 'cls_'+Date.now();
  sheet.appendRow([id, params.name||'', params.time||'', params.start||'', params.end||'', 'active']);
  return json({ success: true, id: id });
}
function deleteClass(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('classes');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) { sheet.deleteRow(i+1); return json({ success: true }); }
  }
  return json({ success: false });
}
function toggleClassStatus(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('classes');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) {
      sheet.getRange(i+1,6).setValue((rows[i][5]||'active') === 'past' ? 'active' : 'past');
      return json({ success: true });
    }
  }
  return json({ success: false });
}
function assignStudentClass(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students') || ss.getSheets()[0];
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.studentId)) { sheet.getRange(i+1,7).setValue(params.classId||''); return json({ success: true }); }
  }
  return json({ success: false });
}
function getClassStudents(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var clsSheet = ss.getSheetByName('classes');
  var stuSheet = ss.getSheetByName('students') || ss.getSheets()[0];
  var classInfo = null;
  if (clsSheet && clsSheet.getLastRow() >= 2) {
    var clsRows = clsSheet.getDataRange().getValues().slice(1);
    for (var i = 0; i < clsRows.length; i++) {
      if (String(clsRows[i][0]) === String(params.classId)) {
        classInfo = { id: String(clsRows[i][0]), name: clsRows[i][1], time: clsRows[i][2]||'', start: clsRows[i][3]||'', end: clsRows[i][4]||'', status: clsRows[i][5]||'active' };
        break;
      }
    }
  }
  if (!classInfo) return json({ classInfo: null, students: [] });
  var students = [];
  if (stuSheet.getLastRow() >= 2) {
    var stuRows = stuSheet.getDataRange().getValues().slice(1);
    students = stuRows.filter(function(r){ return r[0] && String(r[6]) === String(params.classId); })
      .map(function(r){ return { id: String(r[0]), name: r[3]||'', school: r[5]||'', studentPhone: String(r[0]), parentPhone: r[4]||'' }; });
  }
  return json({ classInfo: classInfo, students: students });
}

// ── 차시 ──
// sessions sheet: id | classId | sessionNum | date
function getSessions(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('sessions');
  if (!sheet || sheet.getLastRow() < 2) return json({ sessions: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var sessions = rows.filter(function(r){ return r[0] && String(r[1]) === String(params.classId); })
    .map(function(r){ return { id: String(r[0]), classId: String(r[1]), sessionNum: Number(r[2]), date: r[3]||'' }; })
    .sort(function(a,b){ return b.sessionNum - a.sessionNum; });
  return json({ sessions: sessions });
}
function addSession(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('sessions');
  if (!sheet) { sheet = ss.insertSheet('sessions'); sheet.appendRow(['id','classId','sessionNum','date']); }
  var maxNum = 0;
  if (sheet.getLastRow() >= 2) {
    sheet.getDataRange().getValues().slice(1).filter(function(r){ return String(r[1]) === String(params.classId); })
      .forEach(function(r){ if (Number(r[2]) > maxNum) maxNum = Number(r[2]); });
  }
  var id = 'ses_'+Date.now();
  var sessionNum = maxNum + 1;
  sheet.appendRow([id, params.classId, sessionNum, params.date||'']);
  return json({ success: true, id: id, sessionNum: sessionNum });
}
function deleteSession(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('sessions');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) { sheet.deleteRow(i+1); return json({ success: true }); }
  }
  return json({ success: false });
}
function getSession(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('sessions');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) {
      return json({ success: true, session: { id: String(rows[i][0]), classId: String(rows[i][1]), sessionNum: Number(rows[i][2]), date: rows[i][3]||'' } });
    }
  }
  return json({ success: false });
}

// ── 출석 ──
// attendance sheet: id | sessionId | studentId | status | memo
function setAttendance(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('attendance');
  if (!sheet) { sheet = ss.insertSheet('attendance'); sheet.appendRow(['id','sessionId','studentId','status','memo']); }
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(params.sessionId) && String(rows[i][2]) === String(params.studentId)) {
      sheet.getRange(i+1,4).setValue(params.status||'');
      sheet.getRange(i+1,5).setValue(params.memo||'');
      return json({ success: true });
    }
  }
  sheet.appendRow(['att_'+Date.now(), params.sessionId, params.studentId, params.status||'', params.memo||'']);
  return json({ success: true });
}
function getAttendance(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('attendance');
  if (!sheet || sheet.getLastRow() < 2) return json({ attendance: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var att = rows.filter(function(r){ return r[0] && String(r[1]) === String(params.sessionId); })
    .map(function(r){ return { sessionId: String(r[1]), studentId: String(r[2]), status: r[3]||'', memo: r[4]||'' }; });
  return json({ attendance: att });
}
function getAttendanceHistory(params) {
  // params.classId, params.studentId - 최근 N차시 출석 반환
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sesSheet = ss.getSheetByName('sessions');
  var attSheet = ss.getSheetByName('attendance');
  if (!sesSheet || !attSheet) return json({ history: [] });
  var sesRows = sesSheet.getDataRange().getValues().slice(1);
  var sessionIds = sesRows.filter(function(r){ return String(r[1]) === String(params.classId); })
    .sort(function(a,b){ return Number(b[2]) - Number(a[2]); }).slice(0,20)
    .map(function(r){ return { id: String(r[0]), sessionNum: Number(r[2]) }; });
  var attRows = attSheet.getDataRange().getValues().slice(1);
  var history = sessionIds.map(function(s){
    var found = attRows.find(function(r){ return String(r[1]) === s.id && String(r[2]) === String(params.studentId); });
    return { sessionNum: s.sessionNum, status: found ? (found[3]||'미정') : '미정' };
  });
  return json({ history: history });
}

// ── 성적 ──
// scores sheet: id | sessionId | studentId | examId | score | pass | feedback
function setScore(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('scores');
  if (!sheet) { sheet = ss.insertSheet('scores'); sheet.appendRow(['id','sessionId','studentId','examId','score','pass','feedback']); }
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(params.sessionId) && String(rows[i][2]) === String(params.studentId) && String(rows[i][3]) === String(params.examId)) {
      sheet.getRange(i+1,5).setValue(params.score||'');
      sheet.getRange(i+1,6).setValue(params.pass||'');
      sheet.getRange(i+1,7).setValue(params.feedback||'');
      return json({ success: true });
    }
  }
  sheet.appendRow(['sc_'+Date.now(), params.sessionId, params.studentId, params.examId, params.score||'', params.pass||'', params.feedback||'']);
  return json({ success: true });
}
function getScores(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('scores');
  if (!sheet || sheet.getLastRow() < 2) return json({ scores: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var scores = rows.filter(function(r){ return r[0] && String(r[1]) === String(params.sessionId); })
    .map(function(r){ return { sessionId: String(r[1]), studentId: String(r[2]), examId: String(r[3]), score: r[4]||'', pass: r[5]||'', feedback: r[6]||'' }; });
  return json({ scores: scores });
}

// ── 시험 관리 ──
// exams sheet: id | sessionId | name | createdAt
function addExam(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('exams');
  if (!sheet) { sheet = ss.insertSheet('exams'); sheet.appendRow(['id','sessionId','name','createdAt']); }
  var id = 'exam_'+Date.now();
  var now = Utilities.formatDate(new Date(),'Asia/Seoul','yyyy.MM.dd HH:mm');
  sheet.appendRow([id, params.sessionId, params.name||'시험', now]);
  return json({ success: true, id: id });
}
function getExams(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('exams');
  if (!sheet || sheet.getLastRow() < 2) return json({ exams: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var exams = rows.filter(function(r){ return r[0] && String(r[1]) === String(params.sessionId); })
    .map(function(r){ return { id: String(r[0]), sessionId: String(r[1]), name: r[2]||'', createdAt: r[3]||'' }; });
  return json({ exams: exams });
}
function deleteExam(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('exams');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) { sheet.deleteRow(i+1); return json({ success: true }); }
  }
  return json({ success: false });
}

// ── 강의 자료실 ──
// materials sheet: id | classId | category | name | url | size | uploadDate | downloadCount | memo
function getMaterials(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('materials');
  if (!sheet || sheet.getLastRow() < 2) return json({ materials: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var mats = rows.filter(function(r){ return r[0] && String(r[1]) === String(params.classId); })
    .map(function(r){ return { id:String(r[0]), classId:String(r[1]), category:r[2]||'', name:r[3]||'', url:r[4]||'', size:r[5]||'', uploadDate:r[6]||'', downloadCount:Number(r[7]||0), memo:r[8]||'' }; });
  return json({ materials: mats });
}
function addMaterial(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('materials');
  if (!sheet) { sheet = ss.insertSheet('materials'); sheet.appendRow(['id','classId','category','name','url','size','uploadDate','downloadCount','memo']); }
  var now = Utilities.formatDate(new Date(),'Asia/Seoul','yyyy.MM.dd HH:mm');
  var id = 'mat_'+Date.now();
  sheet.appendRow([id, params.classId, params.category||'자습용 자료', params.name||'', params.url||'', params.size||'', now, 0, params.memo||'']);
  return json({ success: true, id: id });
}
function deleteMaterial(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('materials');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) { sheet.deleteRow(i+1); return json({ success: true }); }
  }
  return json({ success: false });
}
function incDownload(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('materials');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) {
      sheet.getRange(i+1,8).setValue(Number(rows[i][7]||0)+1);
      return json({ success: true });
    }
  }
  return json({ success: false });
}
