// 홈페이지(firebase-api.js)만 아는 토큰. 이 값이 없거나 틀리면 전부 거부한다.
// (완벽한 보안은 아니지만, 이 주소를 직접 알아낸 외부인이 아무 확인 없이 알림톡을 보내거나
//  파일을 올리는 걸 막는 최소한의 방어선 — firebase-api.js의 APP_SHARED_TOKEN과 반드시 같아야 함)
var APP_SHARED_TOKEN = 'mkmath-2026-app-a91f3c';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.appToken !== APP_SHARED_TOKEN) {
      return json({ success: false, error: 'forbidden' });
    }
    if (data.action === 'sendAlimtalk') return sendAlimtalk(data);
    if (data.action === 'aiDraftAnswer') return json(aiDraftAnswer(data));
    if (data.action === 'aiNoteImage') return json(aiNoteImage(data));
    if (data.action === 'getFileBase64') {
      // 큰 파일(수 MB)을 한 번에 통째로 응답하면 Apps Script가 내부적으로
      // script.googleusercontent.com 으로 리다이렉트시키는데, 이 리다이렉트가
      // 종종 404로 실패한다(특히 파일이 클수록). 그래서 start/length가 오면
      // 그 구간만 잘라서 작게 응답하고, 클라이언트가 여러 번 나눠 받아 이어붙인다.
      var gid = data.fileId;
      var gfile = DriveApp.getFileById(gid);
      var gblob = gfile.getBlob();
      var allBytes = gblob.getBytes();
      var totalSize = allBytes.length;
      var mimeType = gblob.getContentType() || 'application/octet-stream';
      var fname = gfile.getName();
      if (data.start !== undefined && data.length !== undefined) {
        var start = Number(data.start);
        var length = Number(data.length);
        var slice = allBytes.slice(start, Math.min(start + length, totalSize));
        return json({ success: true, base64: Utilities.base64Encode(slice), totalSize: totalSize, mimeType: mimeType, name: fname });
      }
      return json({ success: true, base64: Utilities.base64Encode(allBytes), totalSize: totalSize, mimeType: mimeType, name: fname });
    }
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
    Logger.log('[doPost] 예외: ' + err + ' / ' + (err && err.stack));
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'doPost 예외: ' + err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function authDrive() {
  var folder = DriveApp.getRootFolder();
  Logger.log('Drive 권한 OK: ' + folder.getName());
}

// 예전 구글시트 기반 백엔드는 Firebase로 완전히 이전 완료(2026-07-10)되어 더 이상 쓰지 않음.
// 로그인 확인 없이 학생추가/성적입력/질문삭제 등을 그대로 실행하는 코드였어서 보안 위험이 컸음
// (2026-08-05 점검 후 전부 비활성화). 절대 다시 살리지 말 것 — 필요하면 firebase-api.js의
// api 객체에 Firestore 기반으로 새로 만들 것.
function doGet(e) {
  return json({ error: 'disabled' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

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

// ── 영상 라이브러리 ──
function getVideoLibrary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('video_library');
  if (!sheet || sheet.getLastRow() < 2) return json({ videos: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var videos = rows.filter(function(r){ return r[0]; }).map(function(r){
    return { id: String(r[0]), name: r[1]||'', url: r[2]||'', memo: r[3]||'', createdAt: r[4]||'', subject: r[5]||'', type: r[6]||'' };
  });
  return json({ videos: videos });
}
function addVideoLibrary(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('video_library');
  if (!sheet) { sheet = ss.insertSheet('video_library'); sheet.appendRow(['id','name','url','memo','createdAt','subject','type']); }
  var now = Utilities.formatDate(new Date(),'Asia/Seoul','yyyy.MM.dd HH:mm');
  var id = 'vlib_'+Date.now();
  sheet.appendRow([id, params.name||'', params.url||'', params.memo||'', now, params.subject||'', params.type||'']);
  return json({ success: true, id: id });
}
function deleteVideoLibrary(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('video_library');
  if (!sheet) return json({ success: false });
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(params.id)) { sheet.deleteRow(i+1); return json({ success: true }); }
  }
  return json({ success: false });
}

// ── 솔라피 카카오 알림톡 발송 ──
// doPost(웹사이트에서 호출)와 sendMcHourReminders(예약 실행, 아래)가 둘 다 이 핵심 로직을 쓰도록
// sendAlimtalkMessages()로 분리해둠. doPost용 sendAlimtalk(data)는 이걸 감싸서 JSON 응답만 만들어줌.
function sendAlimtalk(data) {
  var result = sendAlimtalkMessages(data.messages || []);
  return json(result);
}
function sendAlimtalkMessages(rawMessages) {
  var SOLAPI_API_KEY    = 'NCSEJXE3QUXKS9BN';
  var SOLAPI_API_SECRET = 'BSRANAXM4UFOYGSD1OX9VOTE5FORTCOL';
  var FROM        = '01062519244';
  var PF_ID       = 'KA01PF2607190425102129N0TXUNtwry';
  var TEMPLATE_ID = 'KA01TP2607190503373353cDTp0aqGdv';

  // 하루 발송 개수 상한 (혹시 모를 오남용/사고 시 피해를 제한하기 위한 안전장치)
  var DAILY_LIMIT = 300;
  var props = PropertiesService.getScriptProperties();
  var todayKey = 'alimtalk_' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var sentToday = Number(props.getProperty(todayKey) || 0);
  var requestCount = (rawMessages || []).length;
  if (sentToday + requestCount > DAILY_LIMIT) {
    return { success: false, msg: '하루 발송 한도(' + DAILY_LIMIT + '건)를 초과했습니다. 내일 다시 시도해주세요.' };
  }

  var messages = (rawMessages || []).filter(function(m){ return m.phone; }).map(function(m){
    return {
      to:   String(m.phone).replace(/[^0-9]/g, ''),
      from: FROM,
      kakaoOptions: {
        pfId:       PF_ID,
        templateId: TEMPLATE_ID,
        variables: {
          '#{강의}':    String(m.className  || ''),
          '#{차시}':    String(m.sessionNum || ''),
          '#{이름}':    String(m.name       || ''),
          '#{전달사항}': String(m.message    || '')
        }
      }
    };
  });

  if (!messages.length) return { success: false, msg: '유효한 발송 대상이 없습니다.' };

  var date  = new Date().toISOString();
  var salt  = Utilities.getUuid();
  var sigBytes = Utilities.computeHmacSha256Signature(date + salt, SOLAPI_API_SECRET);
  var signature = sigBytes.map(function(b){ return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  var authHeader = 'HMAC-SHA256 apiKey=' + SOLAPI_API_KEY + ', date=' + date + ', salt=' + salt + ', signature=' + signature;

  var response = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send-many/detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    payload: JSON.stringify({ messages: messages }),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var result = {};
  try { result = JSON.parse(response.getContentText()); } catch(e) {}
  if (code === 200) {
    props.setProperty(todayKey, String(sentToday + messages.length));
    return { success: true, count: messages.length };
  }
  return { success: false, msg: result.errorMessage || result.message || ('HTTP ' + code) };
}

// ══════════════════════════════════════════════════════════════════
// 의무클리닉 "오기 1시간 전" 자동 알림 (예약 실행 전용, 2026-09-04 추가)
//
// 웹사이트 화면을 아무도 안 켜놔도 자동으로 보내지도록, Apps Script의 "트리거"
// (시계 아이콘)에서 5분마다 sendMcHourReminders 함수가 저절로 실행되게 등록해두는 방식.
// Firestore를 Apps Script가 직접 읽고 써야 해서, 아래 firestore* 함수들로 REST API를 호출함
// (Firebase JS SDK가 아니라 Google Cloud의 OAuth 토큰으로 직접 호출 — ScriptApp.getOAuthToken()).
//
// ⚠️ 이 기능이 작동하려면 반드시:
//  1) 프로젝트 설정에서 "appsscript.json 매니페스트 파일을 편집기에서 표시" 체크
//  2) appsscript.json의 oauthScopes에 Firestore 접근 권한(datastore) 추가
//  3) 트리거(시계 아이콘) → 이 함수(sendMcHourReminders)를 몇 분마다 실행하도록 등록
//  (챗봇이 채팅으로 설정 방법을 안내함 — 이 파일 저장만으로는 자동 실행 안 됨)
// ══════════════════════════════════════════════════════════════════

var FIRESTORE_PROJECT_ID = 'mkmath-54f5d';
var KOR_DAY_NAMES = ['일','월','화','수','목','금','토'];
// 의무클리닉/클리닉 1시간 전 알림을 선생님 본인 번호로도 같이 보내기 위함 (2026-09-10 추가)
var TEACHER_NOTIFY_PHONE = '01062519244';

function firestoreBaseUrl() {
  return 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT_ID + '/databases/(default)/documents';
}
function firestoreValueToJs(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.mapValue !== undefined) {
    var m = {}; var f = v.mapValue.fields || {};
    Object.keys(f).forEach(function(k){ m[k] = firestoreValueToJs(f[k]); });
    return m;
  }
  if (v.arrayValue !== undefined) {
    return (v.arrayValue.values || []).map(firestoreValueToJs);
  }
  return null;
}
function firestoreDocToObj(doc) {
  var obj = { id: doc.name.split('/').pop() };
  var fields = doc.fields || {};
  Object.keys(fields).forEach(function(k){ obj[k] = firestoreValueToJs(fields[k]); });
  return obj;
}
// 컬렉션 전체를 읽어옴 (이 프로젝트 컬렉션들은 크지 않아서 한 페이지로 충분)
function firestoreListAll(collection) {
  var token = ScriptApp.getOAuthToken();
  var res = UrlFetchApp.fetch(firestoreBaseUrl() + '/' + collection + '?pageSize=1000', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('[firestoreListAll] ' + collection + ' 조회 실패: ' + res.getContentText());
    return [];
  }
  var data = JSON.parse(res.getContentText());
  return (data.documents || []).map(firestoreDocToObj);
}
// 최상위(중첩 아닌) 문자열 필드 하나만 갱신 — 중첩 맵 필드는 REST 경로 이스케이프가 까다로워서
// 일부러 단순한 최상위 필드만 씀(하루 1번 표시하는 용도라 날짜 문자열 하나면 충분)
function firestorePatchStringField(collection, docId, fieldName, value) {
  var token = ScriptApp.getOAuthToken();
  var url = firestoreBaseUrl() + '/' + collection + '/' + docId + '?updateMask.fieldPaths=' + fieldName;
  var body = { fields: {} };
  body.fields[fieldName] = { stringValue: String(value) };
  var res = UrlFetchApp.fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('[firestorePatchStringField] ' + collection + '/' + docId + ' 갱신 실패: ' + res.getContentText());
  }
}
// 조건에 맞는 문서만 골라서 읽어옴(필드 하나 = 값 비교). firestoreListAll은 컬렉션을 통째로
// 읽어서 문서 수만큼 읽기 비용이 발생하는데, 5분마다 도는 검사에서 hw_status/scores 같은 큰
// 컬렉션을 매번 통째로 읽으면 Firestore 무료 한도를 금방 넘김 — 자주 도는 기능에서는 반드시 이걸 쓸 것.
function firestoreQueryEq(collection, field, value) {
  var token = ScriptApp.getOAuthToken();
  var body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: 'EQUAL',
          value: { stringValue: String(value) }
        }
      },
      limit: 1000
    }
  };
  var res = UrlFetchApp.fetch(firestoreBaseUrl() + ':runQuery', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('[firestoreQueryEq] ' + collection + '.' + field + ' 조회 실패: ' + res.getContentText());
    return [];
  }
  var out = [];
  var rows = JSON.parse(res.getContentText()) || [];
  rows.forEach(function(r){ if (r.document) out.push(firestoreDocToObj(r.document)); });
  return out;
}
// 문서 1개만 읽기
function firestoreGetDoc(collection, docId) {
  var token = ScriptApp.getOAuthToken();
  var res = UrlFetchApp.fetch(firestoreBaseUrl() + '/' + collection + '/' + encodeURIComponent(String(docId)), {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return null;
  return firestoreDocToObj(JSON.parse(res.getContentText()));
}
// 최상위 필드 여러 개를 한 번에 갱신(문자열/불리언 지원) — firestorePatchStringField와 같은 이유로
// 여전히 최상위(중첩 아닌) 필드만 지원함
function firestorePatchFields(collection, docId, fieldsObj) {
  var token = ScriptApp.getOAuthToken();
  var keys = Object.keys(fieldsObj);
  var maskParams = keys.map(function(k){ return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  var url = firestoreBaseUrl() + '/' + collection + '/' + docId + '?' + maskParams;
  var body = { fields: {} };
  keys.forEach(function(k){
    var v = fieldsObj[k];
    if (typeof v === 'boolean') body.fields[k] = { booleanValue: v };
    else body.fields[k] = { stringValue: String(v) };
  });
  var res = UrlFetchApp.fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('[firestorePatchFields] ' + collection + '/' + docId + ' 갱신 실패: ' + res.getContentText());
  }
}
// "YYYY.MM.DD HH:MM" 형식(nowStr(), 학생 기기 시각 기준)을 Date로 변환 — 못 읽으면 null
function parseKstTimestamp(s) {
  var m = String(s || '').match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  // 학생 기기가 대부분 한국 시간이라고 가정하고, UTC 값 그대로 "그 시각"으로 취급해서
  // mcTodayInfoSeoul()과 같은 방식(UTC+9를 더한 값)으로 지금 시각과 비교할 수 있게 함
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
}
// "17:00", "17시" 처럼 자유롭게 입력된 시간 문자열에서 시:분(하루 중 몇 분째)을 최대한 느슨하게 뽑아냄
function mcParseTimeToMinutes(t) {
  var m = String(t || '').match(/(\d{1,2})\s*[:시]\s*(\d{0,2})/);
  if (!m) return null;
  var h = parseInt(m[1], 10);
  var mi = m[2] ? parseInt(m[2], 10) : 0;
  if (isNaN(h) || h < 0 || h > 23) return null;
  return h * 60 + (isNaN(mi) ? 0 : mi);
}
// 오늘로부터 n일 전/후의 한국 날짜 문자열("YYYY-MM-DD") — mcTodayInfoSeoul과 같은 방식(UTC+9)
function kstDateStrOffset(days) {
  var d = new Date(Date.now() + 9 * 60 * 60 * 1000 + (days || 0) * 24 * 60 * 60 * 1000);
  var pad = function(n){ return (n < 10 ? '0' : '') + n; };
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}
// 서버(Apps Script)가 어느 시간대에서 돌든 흔들리지 않게, UTC 시각에 9시간을 더해 "한국 시각처럼 읽는" 방식
function mcTodayInfoSeoul() {
  var now = new Date();
  var kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  var pad = function(n){ return (n < 10 ? '0' : '') + n; };
  return {
    dateStr: kst.getUTCFullYear() + '-' + pad(kst.getUTCMonth() + 1) + '-' + pad(kst.getUTCDate()),
    dayName: KOR_DAY_NAMES[kst.getUTCDay()],
    nowMins: kst.getUTCHours() * 60 + kst.getUTCMinutes()
  };
}

// 트리거에 등록해서 5~10분마다 실행시키는 함수. 오늘 실제로 오는(시간대가 바뀐) 학생 중
// 도착 50~60분 전인 학생에게 자동으로 알림톡을 보내고, 같은 날 중복 발송을 막기 위해 표시해둠.
function sendMcHourReminders() {
  try {
    var today = mcTodayInfoSeoul();
    var list = firestoreListAll('mandatory_clinic');
    var todays = list.filter(function(m){
      return m.type === 'temp' ? m.date === today.dateStr : m.day === today.dayName;
    });
    if (!todays.length) return;

    var candidates = todays.filter(function(m){
      if (m.lastHourReminderDate === today.dateStr) return false;
      var mins = mcParseTimeToMinutes(m.time);
      if (mins === null) return false;
      var diff = mins - today.nowMins;
      return diff <= 60 && diff >= 50;
    });
    if (!candidates.length) return;

    var studentsById = {};
    firestoreListAll('students').forEach(function(s){ studentsById[s.id] = s; });

    candidates.forEach(function(m){
      var student = studentsById[m.studentId];
      if (!student) return;
      var changeLabel = (m.targetDay && m.day) ? (m.targetDay + '요일→' + m.day + '요일로 변경된 ') : '';
      var text = m.name + ' 학생, ' + changeLabel + '의무클리닉 1시간 전(' + m.time + ')입니다. 잊지 말고 와주세요!';
      var msgs = [];
      // ⚠️ 학생 번호는 students 문서의 studentPhone이 아니라 문서 ID(=m.studentId) 자체임.
      // studentPhone은 화면용 API가 문서 ID로 만들어서 내려주는 값일 뿐 Firestore에 저장돼 있지 않아서,
      // 예전엔 여기서 항상 빈 값이 나와 학생 본인에게만 알림이 안 갔음(2026-09-16 수정).
      // 이 줄을 다시 student.studentPhone으로 되돌리지 말 것.
      if (m.studentId)          msgs.push({ phone: m.studentId,          name: m.name, className: '의무클리닉', sessionNum: today.dateStr, message: text });
      if (student.parentPhone)  msgs.push({ phone: student.parentPhone,  name: m.name, className: '의무클리닉', sessionNum: today.dateStr, message: text });
      msgs.push({ phone: TEACHER_NOTIFY_PHONE, name: m.name, className: '의무클리닉', sessionNum: today.dateStr, message: text });
      if (!msgs.length) return;

      var result = sendAlimtalkMessages(msgs);
      if (result.success) {
        firestorePatchStringField('mandatory_clinic', m.id, 'lastHourReminderDate', today.dateStr);
      } else {
        Logger.log('[sendMcHourReminders] ' + m.name + ' 발송 실패: ' + result.msg);
      }
    });
  } catch (err) {
    Logger.log('[sendMcHourReminders] 오류: ' + err);
  }

  // 클리닉(추가클리닉 등) "오기 1시간 전" 자동 알림도 같은 트리거(5분마다)에 얹어서 같이 실행 —
  // 별도 트리거를 새로 등록할 필요 없이 여기 이 함수 안에서 이어서 돈다.
  try {
    sendClinicHourReminders();
  } catch (err) {
    Logger.log('[sendClinicHourReminders 호출] 오류: ' + err);
  }

  // 조교 출근 1시간 후 "아직 체크 안 된 것" 알림도 같은 트리거에 얹어서 실행(별도 트리거 불필요).
  try {
    sendAssistantCheckNudges();
  } catch (err) {
    Logger.log('[sendAssistantCheckNudges 호출] 오류: ' + err);
  }

  // 결석자 "영상으로 대체 공부하세요" 안내(밤 10시 30분)도 같은 트리거에 얹어서 실행.
  try {
    sendAbsentVideoNotices();
  } catch (err) {
    Logger.log('[sendAbsentVideoNotices 호출] 오류: ' + err);
  }

  // 증빙 사진 제출 기한(수업 후 2일) 초과자 안내(밤 9시)도 같은 트리거에 얹어서 실행.
  try {
    sendProofOverdueNotices();
  } catch (err) {
    Logger.log('[sendProofOverdueNotices 호출] 오류: ' + err);
  }
}

// 클리닉(추가클리닉 등, clinic_bookings) "오기 1시간 전" 자동 알림 — 의무클리닉과 동일한 패턴.
// sendMcHourReminders() 안에서 같이 호출되므로 별도 트리거 등록이 필요 없음.
function sendClinicHourReminders() {
  try {
    var today = mcTodayInfoSeoul();
    var all = firestoreListAll('clinic_bookings');
    var todays = all.filter(function(b){
      return b.date === today.dateStr && b.status !== '취소' && b.status !== 'cancelled';
    });
    if (!todays.length) return;

    var candidates = todays.filter(function(b){
      if (b.lastHourReminderDate === today.dateStr) return false;
      var mins = mcParseTimeToMinutes(b.time);
      if (mins === null) return false;
      var diff = mins - today.nowMins;
      return diff <= 60 && diff >= 50;
    });
    if (!candidates.length) return;

    var studentsById = {};
    firestoreListAll('students').forEach(function(s){ studentsById[s.id] = s; });

    candidates.forEach(function(b){
      var student = studentsById[b.studentId];
      var name = b.studentName || (student && student.name) || b.studentId;
      var text = name + ' 학생, 클리닉(' + (b.clinicName || '') + ') 1시간 전(' + b.time + ')입니다. 잊지 말고 와주세요!';
      var msgs = [];
      msgs.push({ phone: b.studentId, name: name, className: '클리닉', sessionNum: today.dateStr, message: text });
      if (student && student.parentPhone) msgs.push({ phone: student.parentPhone, name: name, className: '클리닉', sessionNum: today.dateStr, message: text });
      msgs.push({ phone: TEACHER_NOTIFY_PHONE, name: name, className: '클리닉', sessionNum: today.dateStr, message: text });

      var result = sendAlimtalkMessages(msgs);
      if (result.success) {
        firestorePatchStringField('clinic_bookings', b.id, 'lastHourReminderDate', today.dateStr);
      } else {
        Logger.log('[sendClinicHourReminders] ' + name + ' 발송 실패: ' + result.msg);
      }
    });
  } catch (err) {
    Logger.log('[sendClinicHourReminders] 오류: ' + err);
  }
}

// ── 숙제/재시험 증빙 사진 6시간 자동 완료 처리 (2026-09-14 추가, 자동완료 후 12시간까지는
// 목록에 "자동완료" 배지를 달고 계속 보이도록 2026-09-14 수정) ──
// 학생이 숙제 증빙(hw_status) 또는 재시험 증빙(scores) 사진을 올렸는데 선생님/조교가
// 6시간 안에 확인해서 완료 처리를 안 하면, 자동으로 완료 처리해줌 — 트리거에 등록해서
// 1시간마다 실행시키는 함수(의무클리닉 1시간 전 알림 트리거와는 별개로 새로 등록 필요).
var HW_AUTO_COMPLETE_HOURS = 6;
function autoCompleteOldSubmissions() {
  try { autoCompleteOldHwProofs(); } catch (err) { Logger.log('[autoCompleteOldHwProofs] 오류: ' + err); }
  try { autoCompleteOldExamProofs(); } catch (err) { Logger.log('[autoCompleteOldExamProofs] 오류: ' + err); }
}
function autoCompleteOldHwProofs() {
  var kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var list = firestoreListAll('hw_status');
  var targets = list.filter(function(r){
    if (!r.submittedAt) return false;
    if (r.pass === 'complete' || r.pass === 'na') return false;
    var subDate = parseKstTimestamp(r.submittedAt);
    if (!subDate) return false;
    return (kstNow.getTime() - subDate.getTime()) >= HW_AUTO_COMPLETE_HOURS * 60 * 60 * 1000;
  });
  targets.forEach(function(r){
    // autoCompleted(불리언)는 화면에서 "6시간 지나 자동완료됐지만 아직 12시간(제출 후) 안 지난 것"을
    // 수동완료와 구분해서 계속 보여주는 용도 — pass는 그대로 'complete'로 둬서 급여/리더보드 등
    // 기존 로직에는 영향 없게 함.
    var fields = { pass: 'complete', autoCompleted: true, autoCompletedAt: mcTodayInfoSeoul().dateStr };
    if (!r.feedback) fields.feedback = '제출하신 증빙이 ' + HW_AUTO_COMPLETE_HOURS + '시간 동안 확인되지 않아 자동으로 완료 처리되었습니다.';
    firestorePatchFields('hw_status', r.id, fields);
  });
}
function autoCompleteOldExamProofs() {
  var kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var list = firestoreListAll('scores');
  var targets = list.filter(function(r){
    if (!r.examSubmittedAt) return false;
    if (r.alertResolved) return false;
    var subDate = parseKstTimestamp(r.examSubmittedAt);
    if (!subDate) return false;
    return (kstNow.getTime() - subDate.getTime()) >= HW_AUTO_COMPLETE_HOURS * 60 * 60 * 1000;
  });
  targets.forEach(function(r){
    var fields = { alertResolved: true, autoCompleted: true, autoCompletedAt: mcTodayInfoSeoul().dateStr };
    if (!r.feedback) fields.feedback = '제출하신 증빙이 ' + HW_AUTO_COMPLETE_HOURS + '시간 동안 확인되지 않아 자동으로 완료 처리되었습니다.';
    firestorePatchFields('scores', r.id, fields);
  });
}

// ── 주간 요약 알림톡 (2026-09-16 추가) ──
// 화요일 낮에 주 1회 트리거로 실행 — 선생님 번호로만 요약 1통을 보냄.
// 학생 기록은 전혀 건드리지 않고 숫자만 세서 보내는 구조라, 계산이 틀려도 사고가 안 나는 안전한 자동화.
// ⚠️ 발송 대상은 반드시 선생님 본인(TEACHER_NOTIFY_PHONE) 1명뿐 — 학생/학부모에게는 절대 보내지 말 것.
function sendWeeklySummary() {
  try {
    var todayStr = mcTodayInfoSeoul().dateStr;
    var startStr = kstDateStrOffset(-7);
    var inRange = function(d){ var s = String(d || ''); return s && s >= startStr && s <= todayStr; };

    // 학생 이름 표
    var nameById = {};
    firestoreListAll('students').forEach(function(s){ nameById[s.id] = s.name || s.id; });

    // 1) 지난 7일 결석 — attendance에는 날짜가 없고 sessionId만 있어서 sessions의 date로 기간을 판단함
    var sesInRange = {};
    firestoreListAll('sessions').forEach(function(s){ if (inRange(s.date)) sesInRange[s.id] = true; });
    var absentNames = [];
    firestoreListAll('attendance').forEach(function(a){
      if (!sesInRange[a.sessionId]) return;
      if (a.status !== '결석') return;
      absentNames.push(nameById[a.studentId] || a.studentId);
    });

    // 2) 지난 7일 클리닉 신청(취소된 건 제외)
    var clinicCount = firestoreListAll('clinic_bookings').filter(function(b){
      return inRange(b.date) && b.status !== '취소';
    }).length;

    // 3) 숙제: 지금 밀려있는 건수 + 지난 7일 자동완료 건수 (같은 컬렉션이라 한 번만 읽어서 재사용)
    var hwAll = firestoreListAll('hw_status');
    var hwPending = hwAll.filter(function(r){
      return r.pass === 'incomplete' || r.pass === 'partial' || r.pass === 'notsub';
    }).length;
    var autoCount = hwAll.filter(function(r){ return inRange(r.autoCompletedAt); }).length;

    // 4) 재시험: 아직 해결 처리 안 된 것 + 지난 7일 자동완료 건수
    var scoresAll = firestoreListAll('scores');
    var retestPending = scoresAll.filter(function(r){
      return (r.pass === 'nosub' || r.pass === 'absent') && !r.alertResolved;
    }).length;
    autoCount += scoresAll.filter(function(r){ return inRange(r.autoCompletedAt); }).length;

    // 5) 아직 답변 안 한 질문
    var qnaOpen = firestoreListAll('qna').filter(function(q){ return q.status === 'open'; }).length;

    var absentText = absentNames.length
      ? absentNames.length + '건 (' + absentNames.slice(0, 5).join(', ')
        + (absentNames.length > 5 ? ' 외 ' + (absentNames.length - 5) + '명' : '') + ')'
      : '0건';

    var lines = [];
    lines.push('[지난 7일] ' + startStr + ' ~ ' + todayStr);
    lines.push('· 결석 ' + absentText);
    lines.push('· 클리닉 신청 ' + clinicCount + '건');
    lines.push('· 증빙 자동완료 ' + autoCount + '건');
    lines.push('');
    lines.push('[지금 밀려있는 것]');
    lines.push('· 숙제 미이행·미제출 ' + hwPending + '건');
    lines.push('· 재시험 안 끝난 학생 ' + retestPending + '명');
    lines.push('· 답변 안 한 질문 ' + qnaOpen + '개');
    if (!hwPending && !retestPending && !qnaOpen) {
      lines.push('');
      lines.push('밀린 것 없이 다 처리됐어요!');
    }

    var result = sendAlimtalkMessages([{
      phone: TEACHER_NOTIFY_PHONE,
      name: '김민관 선생님',
      className: '주간 요약',
      sessionNum: todayStr,
      message: lines.join('\n')
    }]);
    if (!result.success) Logger.log('[sendWeeklySummary] 발송 실패: ' + result.msg);
  } catch (err) {
    Logger.log('[sendWeeklySummary] 오류: ' + err);
  }
}

// ── 조교 출근 1시간 후 "아직 체크 안 된 것" 알림 (2026-09-16 추가) ──
// 조교가 출근 버튼을 누르고 1시간이 지났는데 오늘 수업의 출석·시험·숙제가 아직 처리 안 됐으면,
// 선생님 + 그 조교에게 명단과 함께 "쉬는시간에 교실 가서 체크하라"는 안내를 보냄.
// 별도 트리거 필요 없음 — sendMcHourReminders(5분마다) 안에서 같이 호출됨.
// ⚠️ 발송 비용: 한 번 보낼 때 (선생님 1통 + 출근한 조교 수만큼). 하루에 조교 1명당 최대 1번만 발송됨
//    (work_logs 문서에 checkNudgeSent 표시를 남겨서 같은 근무에 다시 안 보냄).
var ASSISTANT_CHECK_AFTER_MIN = 60;
function sendAssistantCheckNudges() {
  var today = mcTodayInfoSeoul();

  // 1) 오늘 출근했고, 출근 1시간이 지났고, 아직 알림을 안 보낸 근무 기록만 추림
  //    (대부분의 실행은 여기서 끝나서 요청 1번으로 끝남 — 5분마다 돌아도 부담 없게 하려는 구조)
  var logs = firestoreQueryEq('work_logs', 'date', today.dateStr).filter(function(w){
    if (w.checkNudgeSent === true) return false;
    if (w.clockOut) return false; // 이미 퇴근했으면 보낼 이유 없음
    var inMins = mcParseTimeToMinutes(w.clockIn);
    if (inMins === null) return false;
    return (today.nowMins - inMins) >= ASSISTANT_CHECK_AFTER_MIN;
  });
  if (!logs.length) return;

  // 2) 오늘 차시 중 아직 처리 안 된 학생 명단 만들기
  var blocks = buildTodayUncheckedBlocks(today);

  // 처리할 게 하나도 없으면 알림을 아예 안 보냄(조용함 = 정상). 단, 같은 근무에 계속 다시 확인하지
  // 않도록 표시는 남겨둠.
  if (!blocks.length) {
    logs.forEach(function(w){ firestorePatchFields('work_logs', w.id, { checkNudgeSent: true }); });
    return;
  }

  var text = '아직 처리 안 된 학생이 있어요.\n\n'
    + blocks.join('\n\n')
    + '\n\n쉬는시간에 교실로 가서 출석과 과제를 다시 체크해주세요.';

  var msgs = [{ phone: TEACHER_NOTIFY_PHONE, name: '김민관 선생님', className: '출결·과제 점검', sessionNum: today.dateStr, message: text }];
  logs.forEach(function(w){
    if (!w.assistantId) return;
    msgs.push({ phone: w.assistantId, name: (w.assistantName || '조교') + '님', className: '출결·과제 점검', sessionNum: today.dateStr, message: text });
  });

  var result = sendAlimtalkMessages(msgs);
  if (result.success) {
    logs.forEach(function(w){ firestorePatchFields('work_logs', w.id, { checkNudgeSent: true }); });
  } else {
    // 발송 실패 시에는 표시를 남기지 않아서 다음 실행(5분 뒤)에 다시 시도됨
    Logger.log('[sendAssistantCheckNudges] 발송 실패: ' + result.msg);
  }
}

// 오늘 날짜 차시들을 훑어서 "아직 처리 안 된 학생"을 반별 문단으로 만들어 돌려줌.
// 처리할 게 없는 차시는 아예 문단을 안 만듦.
function buildTodayUncheckedBlocks(today) {
  var blocks = [];
  var sessions = firestoreQueryEq('sessions', 'date', today.dateStr);

  sessions.forEach(function(ses){
    var cls = firestoreGetDoc('classes', ses.classId);
    // 아직 수업 시작 전인 반은 건너뜀 — 조교가 수업 훨씬 전에 출근한 경우
    // "아무도 출석 체크가 안 됐다"고 잘못 알리는 걸 막기 위함(시간 형식을 못 읽으면 그냥 포함).
    var startMins = cls ? mcParseTimeToMinutes(cls.time) : null;
    if (startMins !== null && today.nowMins < startMins) return;

    var roster = firestoreQueryEq('students', 'classId', String(ses.classId)).filter(function(s){
      return s.active !== false && (s.role || 'student') === 'student';
    });
    if (!roster.length) return;
    var nameOf = function(s){ return s.name || s.id; };

    // 출석: 기록이 없거나 '미정'이면 아직 체크 안 된 것
    var attBy = {};
    firestoreQueryEq('attendance', 'sessionId', ses.id).forEach(function(a){ attBy[a.studentId] = a.status || ''; });
    var noAtt = roster.filter(function(s){
      var v = attBy[s.id];
      return !v || v === '미정';
    }).map(nameOf);

    // 시험 미응시: 오늘 차시에 등록된 시험 중, 점수 기록이 아예 없거나 '미응시'로 찍힌 게 있으면
    var noExam = [];
    var exams = firestoreQueryEq('exams', 'sessionId', ses.id);
    if (exams.length) {
      var scoreBy = {};
      firestoreQueryEq('scores', 'sessionId', ses.id).forEach(function(sc){ scoreBy[sc.examId + '__' + sc.studentId] = sc; });
      roster.forEach(function(s){
        var missing = exams.some(function(ex){
          var sc = scoreBy[ex.id + '__' + s.id];
          return !sc || sc.pass === 'absent';
        });
        if (missing) noExam.push(nameOf(s));
      });
    }

    // 숙제 미제출: 기록이 없거나, 상태가 비어있거나, '미제출'인 경우
    // (이행함/일부미이행/미이행/해당없음은 이미 확인이 끝난 것이므로 제외)
    var noHw = [];
    var hws = firestoreQueryEq('homeworks', 'sessionId', ses.id);
    if (hws.length) {
      var hwBy = {};
      firestoreQueryEq('hw_status', 'sessionId', ses.id).forEach(function(h){ hwBy[h.hwId + '__' + h.studentId] = h; });
      roster.forEach(function(s){
        var missing = hws.some(function(hw){
          var h = hwBy[hw.id + '__' + s.id];
          return !h || !h.pass || h.pass === 'notsub';
        });
        if (missing) noHw.push(nameOf(s));
      });
    }

    if (!noAtt.length && !noExam.length && !noHw.length) return;

    var title = ((cls && cls.name) ? cls.name : '반 미배정') + ' ' + (ses.label || (ses.sessionNum ? ses.sessionNum + '차시' : ''));
    var lines = ['[' + title.trim() + ']'];
    if (noAtt.length)  lines.push('· 출석 미체크: ' + joinNames(noAtt));
    if (noExam.length) lines.push('· 시험 미응시: ' + joinNames(noExam));
    if (noHw.length)   lines.push('· 숙제 미제출: ' + joinNames(noHw));
    blocks.push(lines.join('\n'));
  });

  return blocks;
}

// 알림톡 전달사항 길이 제한(900자)이 있어서 이름이 너무 많으면 잘라서 "외 N명"으로 줄임
function joinNames(names) {
  if (names.length <= 10) return names.join(', ');
  return names.slice(0, 10).join(', ') + ' 외 ' + (names.length - 10) + '명';
}

// ── 결석자 "영상으로 대체 공부하세요" 안내 알림톡 (2026-09-16 추가) ──
// 그날 밤 10시 30분에, 오늘 수업에서 '결석'으로 체크된 학생의 학생·학부모 번호로 발송.
// 수업이 끝나고 영상·과제를 올린 뒤에 나가도록 늦은 시간으로 잡았음(선생님 요청).
// ⚠️ '지각'·'조퇴'·'출석'은 발송 대상이 아님 — 오직 '결석'만.
// 별도 트리거 필요 없음 — sendMcHourReminders(5분마다) 안에서 같이 호출되며,
// 앱스 스크립트 트리거가 분 단위 지정을 못 해서 "지금이 10:30~11:00 사이인가"를 직접 확인하는 방식.
var ABSENT_NOTICE_START_MIN = 22 * 60 + 30; // 밤 10시 30분
var ABSENT_NOTICE_WINDOW_MIN = 30;          // 11시까지 사이에 한 번 발송(실행이 한 번 건너뛰어도 따라잡게)
function sendAbsentVideoNotices() {
  var today = mcTodayInfoSeoul();
  if (today.nowMins < ABSENT_NOTICE_START_MIN) return;
  if (today.nowMins >= ABSENT_NOTICE_START_MIN + ABSENT_NOTICE_WINDOW_MIN) return;

  // 오늘 차시 중 아직 안 보낸 것만 (차시 문서에 보낸 날짜를 남겨서 중복 발송 방지)
  var sessions = firestoreQueryEq('sessions', 'date', today.dateStr).filter(function(s){
    return s.absentNoticeSent !== today.dateStr;
  });
  if (!sessions.length) return;

  var todayDots = today.dateStr.replace(/-/g, '.'); // 자료 업로드 시각이 "2026.09.16 21:30" 형식이라

  sessions.forEach(function(ses){
    var absentIds = firestoreQueryEq('attendance', 'sessionId', ses.id)
      .filter(function(a){ return a.status === '결석'; })
      .map(function(a){ return String(a.studentId); });

    // 결석자가 없으면 발송할 게 없으니 표시만 남기고 끝(5분마다 다시 확인하지 않게)
    if (!absentIds.length) {
      firestorePatchStringField('sessions', ses.id, 'absentNoticeSent', today.dateStr);
      return;
    }

    var cls = firestoreGetDoc('classes', ses.classId);
    var className = (cls && cls.name) || '';
    var sessLabel = ses.label || (ses.sessionNum ? ses.sessionNum + '차시' : '');

    // 오늘 올라온 영상 자료 이름 + 이 차시에 등록된 과제 이름 (없으면 이름 없이 일반 안내만 나감)
    var videoNames = firestoreQueryEq('materials', 'classId', String(ses.classId))
      .filter(function(m){ return m.category === '영상 자료' && String(m.uploadDate || '').indexOf(todayDots) === 0; })
      .map(function(m){ return m.name || ''; })
      .filter(function(n){ return n; });
    var hwNames = firestoreQueryEq('homeworks', 'sessionId', ses.id)
      .map(function(h){ return h.name || ''; })
      .filter(function(n){ return n; });

    var body = '오늘 수업에 결석했어요.\n자료실에 올라온 수업 영상과 과제를 꼭 확인해서 공부해주세요.';
    if (videoNames.length) body += '\n\n[영상] ' + videoNames.join(', ');
    if (hwNames.length)    body += '\n[과제] ' + hwNames.join(', ');
    body += '\n\n마이페이지 → 내 반 → 자료실에서 볼 수 있어요.';

    var msgs = [];
    absentIds.forEach(function(sid){
      var stu = firestoreGetDoc('students', sid);
      var nm = (stu && stu.name) || sid;
      // 학생 로그인 아이디(=문서ID)가 곧 학생 전화번호임.
      // ⚠️ students 문서에는 studentPhone이라는 필드가 없음(화면용 API가 문서ID로 만들어서 내려주는 값일 뿐) —
      //    Firestore에서 직접 읽을 때 stu.studentPhone을 쓰면 항상 undefined라서 학생에게 발송이 안 됨.
      msgs.push({ phone: sid, name: nm, className: className, sessionNum: sessLabel, message: body });
      if (stu && stu.parentPhone) {
        msgs.push({ phone: stu.parentPhone, name: nm, className: className, sessionNum: sessLabel, message: body });
      }
    });
    if (!msgs.length) return;

    var result = sendAlimtalkMessages(msgs);
    if (result.success) {
      firestorePatchStringField('sessions', ses.id, 'absentNoticeSent', today.dateStr);
    } else {
      // 표시를 안 남기므로 5분 뒤(발송 시간대 안이면) 다시 시도됨
      Logger.log('[sendAbsentVideoNotices] ' + className + ' 발송 실패: ' + result.msg);
    }
  });
}

// ── 증빙 사진 제출 기한(수업 후 2일) 초과자 안내 (2026-09-16 추가) ──
// 마이페이지 D-2 팝업에 적혀있던 "기한 안에 제출하지 않으면 선생님과 부모님께 알림이 발송됩니다"를
// 실제로 구현한 기능. 밤 9시에 하루 한 번, 사진을 한 장도 안 올린 채 기한(수업일+2일)이 지난
// 숙제·재시험 증빙을 찾아서 학생별로 묶어 학부모+선생님께 발송함.
// ⚠️ PROOF_DUE_DAYS는 mypage.html의 같은 이름 상수와 반드시 같아야 함 — 마이페이지 팝업에
//    "D-2"라고 뜬 게 실제로는 기한이 지나지 않은 걸로 처리되는 일이 없도록 값을 맞춰서 고칠 것.
var PROOF_DUE_DAYS = 2;
var PROOF_OVERDUE_NOTICE_START_MIN = 21 * 60; // 밤 9시
var PROOF_OVERDUE_NOTICE_WINDOW_MIN = 30;
// 수업일(YYYY-MM-DD) + PROOF_DUE_DAYS가 오늘보다 전이면(=오늘이 더 나중이면) 기한이 지난 것
// (mypage.html의 proofDueInfo와 동일한 기준: daysLeft<0 ⇔ dueDate<today)
function isProofOverdue(sessionDateStr, todayStr) {
  var m = String(sessionDateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + PROOF_DUE_DAYS);
  var pad = function(n){ return (n < 10 ? '0' : '') + n; };
  var dueStr = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  return todayStr > dueStr;
}
function sendProofOverdueNotices() {
  var today = mcTodayInfoSeoul();
  if (today.nowMins < PROOF_OVERDUE_NOTICE_START_MIN) return;
  if (today.nowMins >= PROOF_OVERDUE_NOTICE_START_MIN + PROOF_OVERDUE_NOTICE_WINDOW_MIN) return;

  // hw_status/scores 전체를 훑는 무거운 조회라, 발송 시간대(30분) 안에서도 하루에 딱 한 번만
  // 실제로 돌게 ScriptProperties에 실행한 날짜를 남겨둠(5분마다 도는 트리거에 얹혀 있으므로).
  var props = PropertiesService.getScriptProperties();
  var doneKey = 'proofOverdueNoticeDate';
  if (props.getProperty(doneKey) === today.dateStr) return;

  try {
    var sessById = {};
    firestoreListAll('sessions').forEach(function(s){ sessById[s.id] = s; });
    var classNameById = {};
    firestoreListAll('classes').forEach(function(c){ classNameById[c.id] = c.name || ''; });
    var nameById = {}, parentById = {};
    firestoreListAll('students').forEach(function(s){ nameById[s.id] = s.name || s.id; parentById[s.id] = s.parentPhone || ''; });
    var hwById = {};
    firestoreListAll('homeworks').forEach(function(h){ hwById[h.id] = h; });
    var examById = {};
    firestoreListAll('exams').forEach(function(e){ examById[e.id] = e; });

    var sessLabelOf = function(ses){
      return (classNameById[ses.classId] || '') + ' ' + (ses.label || (ses.sessionNum ? ses.sessionNum + '차시' : ''));
    };

    // 학생별로 밀린 항목 문구를 모음
    var byStudent = {};
    function addItem(studentId, label) {
      if (!byStudent[studentId]) byStudent[studentId] = [];
      byStudent[studentId].push(label);
    }

    // 숙제 증빙 — mypage.html의 collectPendingProofs()와 같은 기준(완료/해당없음 제외, 사진 없음, 기한 지남)
    var hwAll = firestoreListAll('hw_status');
    var hwOverdue = hwAll.filter(function(r){
      if (r.overdueNotifySent) return false;
      if (r.pass === 'complete' || r.pass === 'na') return false;
      if (r.submissionUrl && r.submissionUrl.length) return false;
      var ses = sessById[r.sessionId];
      if (!ses || !ses.date) return false;
      return isProofOverdue(ses.date, today.dateStr);
    });
    hwOverdue.forEach(function(r){
      var ses = sessById[r.sessionId] || {};
      var hw = hwById[r.hwId] || {};
      addItem(r.studentId, sessLabelOf(ses).trim() + ' 숙제(' + (hw.name || '과제') + ')');
    });

    // 재시험 증빙 — getMyExamAlerts와 같은 기준(미통과/미응시, 해결 안 됨, 사진 없음, 기한 지남)
    var scoresAll = firestoreListAll('scores');
    var scOverdue = scoresAll.filter(function(r){
      if (r.examOverdueNotifySent) return false;
      if (r.pass !== 'nosub' && r.pass !== 'absent') return false;
      if (r.alertResolved) return false;
      if (r.examSubmissionUrl && r.examSubmissionUrl.length) return false;
      var ses = sessById[r.sessionId];
      if (!ses || !ses.date) return false;
      return isProofOverdue(ses.date, today.dateStr);
    });
    scOverdue.forEach(function(r){
      var ses = sessById[r.sessionId] || {};
      var ex = examById[r.examId] || {};
      addItem(r.studentId, sessLabelOf(ses).trim() + ' 재시험(' + (ex.name || '시험') + ')');
    });

    var studentIds = Object.keys(byStudent);
    if (!studentIds.length) { props.setProperty(doneKey, today.dateStr); return; }

    var msgs = [];
    studentIds.forEach(function(sid){
      var nm = nameById[sid] || sid;
      var itemsText = byStudent[sid].map(function(x){ return '- ' + x; }).join('\n');
      var text = nm + ' 학생이 증빙 사진 제출 기한(수업 후 ' + PROOF_DUE_DAYS + '일)을 넘겼어요.\n\n'
        + itemsText + '\n\n추가 클리닉 신청 부탁드립니다.';
      if (parentById[sid]) msgs.push({ phone: parentById[sid], name: nm, className: '증빙 기한 초과', sessionNum: today.dateStr, message: text });
      msgs.push({ phone: TEACHER_NOTIFY_PHONE, name: nm, className: '증빙 기한 초과', sessionNum: today.dateStr, message: text });
    });

    var result = sendAlimtalkMessages(msgs);
    if (result.success) {
      hwOverdue.forEach(function(r){ firestorePatchFields('hw_status', r.id, { overdueNotifySent: true }); });
      scOverdue.forEach(function(r){ firestorePatchFields('scores', r.id, { examOverdueNotifySent: true }); });
      props.setProperty(doneKey, today.dateStr);
    } else {
      // ScriptProperties 표시를 안 남기므로 발송 시간대(30분) 안이면 5분 뒤 다시 시도됨
      Logger.log('[sendProofOverdueNotices] 발송 실패: ' + result.msg);
    }
  } catch (err) {
    Logger.log('[sendProofOverdueNotices] 오류: ' + err);
  }
}

// ── 질의응답 AI 풀이 초안 (2026-09-17 추가, 2026-09-18 Gemini Pro 우선으로 전환) ──
// 학생이 질문을 올리면 firebase-api.js가 이 액션을 호출 → AI로 풀이 초안을 만들어
// Firestore qna_ai_drafts/{questionId}에 저장. 학생에게는 절대 직접 안 보여주고(규칙: 교사/조교만 읽기),
// 선생님이 qna.html에서 질문을 열 때 "🤖 AI 초안"으로 보고 확인 후 답변에 쓰는 구조.
// ⚠️ API 키는 코드에 안 박음 — Apps Script 편집기 → 프로젝트 설정(⚙) → 스크립트 속성에 저장해야 작동함.
//    - GEMINI_API_KEY 가 있으면 Gemini Pro 로 먼저 시도(사용자가 Gemini Pro 를 원함).
//    - Gemini 가 실패(키 없음/오류)하면 ANTHROPIC_API_KEY 가 있을 때 Claude 로 한 번 더 시도(예비).
//    - 둘 다 없으면 초안에 안내 문구만 남기고 조용히 끝남.
//    - 스크립트 속성 GEMINI_DRAFT_MODEL 로 모델 이름을 바꿀 수 있음(없으면 아래 후보를 순서대로 시도, 404면 다음 후보).
var AI_DRAFT_MODEL = 'claude-sonnet-5';               // Claude 예비용 모델
var AI_DRAFT_GEMINI_MODELS = ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-2.5-pro']; // 앞에서부터 시도
var AI_DRAFT_MAX_IMAGES = 4;
var AI_DRAFT_SYSTEM = '당신은 한국 고등학교 수학 학원의 보조 선생님입니다. 학생이 올린 수학 질문(글과 사진)을 읽고 풀이 초안을 작성하세요.\n'
  + '규칙:\n'
  + '- 한국어로, 학생이 그대로 읽을 수 있는 친절한 말투로 씁니다.\n'
  + '- 풀이는 단계별로 번호를 붙여 차근차근 씁니다. 왜 그렇게 하는지 한 줄씩 이유를 붙입니다.\n'
  + '- 마크다운·LaTeX를 쓰지 마세요. 수식은 일반 텍스트로 쓰되 √, ², ³, ×, ÷, ≤, ≥, π 같은 유니코드 기호와 분수는 a/b 형태를 씁니다.\n'
  + '- 마지막 줄에 "답: ..." 형태로 최종 답을 씁니다.\n'
  + '- 사진이 흐리거나 문제를 확실히 읽을 수 없으면 추측하지 말고 "문제를 정확히 읽기 어려워요. (어느 부분)" 이라고 먼저 밝히고, 읽을 수 있는 범위에서만 풀이합니다.\n'
  + '- 이 초안은 선생님이 검토한 뒤 학생에게 전달됩니다. 불필요한 인사말 없이 풀이만 씁니다.';

function aiHtmlToText(html) {
  var s = String(html || '');
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n').replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}
// 질문 본문에 들어있는 구글 드라이브 이미지 id들 (file/d/ID 또는 thumbnail?id=ID 두 형식 모두)
function aiExtractDriveIds(html) {
  var ids = [], re = /(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/thumbnail\?id=|[?&]id=)([A-Za-z0-9_-]{20,})/g, m;
  while ((m = re.exec(String(html || ''))) !== null) { if (ids.indexOf(m[1]) < 0) ids.push(m[1]); }
  return ids.slice(0, AI_DRAFT_MAX_IMAGES);
}
// ===== AI 풀이 초안 → "노트 사진" 이미지 생성 (Gemini 이미지 모델, 2026-09-17) =====
// 선생님이 질의응답에서 "📷 AI 노트 사진으로 넣기"를 누르면, 문제 사진 + 풀이 초안 글을 Gemini에 보내
// "스프링 노트에 검은 펜으로 손글씨로 쓴 사진"을 생성해서 드라이브에 저장하고 주소를 돌려줌.
// API 키는 코드에 없음 — Apps Script 프로젝트 설정 → 스크립트 속성에 GEMINI_API_KEY 로 저장해야 작동.
// (homework.html에 하드코딩돼 있던 옛 GEMINI_KEY는 2026-09-17 확인 결과 이미 죽은 키라 여기선 안 씀)
// 모델은 스크립트 속성 GEMINI_IMAGE_MODEL 로 바꿀 수 있음(없으면 아래 기본값). 글씨 정확도가 중요해서 기본은 Pro.
// ⚠️ 이미지 생성 AI는 한글·수식·숫자를 틀리게 그릴 수 있음 — 선생님이 반드시 눈으로 확인 후 답변 등록할 것.
var AI_NOTE_IMAGE_MODEL_DEFAULT = 'gemini-3-pro-image';
var AI_NOTE_IMAGE_PROMPT = 'A realistic top-down photo of a math solution handwritten on a spiral-bound notebook lying on a wooden desk. '
  + 'Cream-white lined paper with light blue-gray horizontal rules and a thin red vertical margin line on the left; large silver spiral coils on the left edge. '
  + 'The attached image is a clipping of the math problem: it is taped to the top-left area of the page with four strips of translucent masking tape. '
  + 'Reproduce that clipping EXACTLY as it is (it is a printed capture — do not retype, redraw or alter it). '
  + 'To the right of the clipping, starting with "풀이)", and continuing below it across the full width, the solution is handwritten in neat, tidy, rounded Korean handwriting with a black gel pen (not a font look, real pen strokes, consistent size). '
  + 'Numbered step titles like "1.", "2." with the lines under each step slightly indented. Fractions are written stacked (numerator over denominator with a bar), exponents as small raised digits. '
  + 'The final answer line starts with a check mark and is double-underlined. Natural soft daylight, slight paper texture, no watermark, no hands, no other objects. 16:9 landscape.\n\n'
  + 'IMPORTANT: The handwritten solution on the page must be EXACTLY the following Korean text, in this order, with every number, symbol, variable and formula copied precisely. Do not add, omit, translate or paraphrase anything:\n\n';

function aiNoteImage(data) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('GEMINI_API_KEY');
  if (!apiKey) return { success: false, msg: 'GEMINI_API_KEY가 Apps Script 스크립트 속성에 없어요. 프로젝트 설정(⚙) → 스크립트 속성에 추가해주세요.' };
  var model = props.getProperty('GEMINI_IMAGE_MODEL') || AI_NOTE_IMAGE_MODEL_DEFAULT;
  var draft = String(data.draftText || '').trim();
  if (!draft) return { success: false, msg: '풀이 초안 글이 비어있어요.' };
  try {
    // 질문에 첨부된 첫 번째 사진을 "문제 조각"으로 같이 보냄
    var problem = null;
    var ids = aiExtractDriveIds(data.content);
    for (var i = 0; i < ids.length && !problem; i++) {
      try {
        var blob = DriveApp.getFileById(ids[i]).getBlob();
        var mime = blob.getContentType() || '';
        if (mime.indexOf('image/') !== 0) continue;
        var bytes = blob.getBytes();
        if (bytes.length > 6 * 1024 * 1024) continue;
        problem = { mime: mime === 'image/jpg' ? 'image/jpeg' : mime, b64: Utilities.base64Encode(bytes) };
      } catch (e) { Logger.log('[aiNoteImage] 이미지 읽기 실패 ' + ids[i] + ': ' + e); }
    }
    var prompt = AI_NOTE_IMAGE_PROMPT + draft;
    if (!problem) prompt = prompt.replace(/The attached image is a clipping[^\n]*?alter it\)\. /, 'There is no problem clipping; the handwriting starts at the top of the page. ');

    // 모델·호출방식을 차례로 시도: (설정 모델 → flash 계열) × (새 Interactions API → 예전 generateContent)
    // 어느 조합이 되는지는 계정/지역/결제 상태에 따라 달라서, 전부 실패하면 각 시도의 실제 오류를 모아서 돌려줌(진단용)
    var models = [model];
    ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'].forEach(function(m){ if (models.indexOf(m) < 0) models.push(m); });
    var errors = [], body = null, code = 0, res = null;
    outer:
    for (var mi = 0; mi < models.length; mi++) {
      var mdl = models[mi];
      var attempts = [
        { name: 'interactions', url: 'https://generativelanguage.googleapis.com/v1beta/interactions',
          payload: (function(){ var input = [{ type: 'text', text: prompt }]; if (problem) input.push({ type: 'image', mime_type: problem.mime, data: problem.b64 });
            return { model: mdl, input: input, response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '16:9', image_size: '1K' } }; })() },
        { name: 'generateContent', url: 'https://generativelanguage.googleapis.com/v1beta/models/' + mdl + ':generateContent',
          payload: (function(){ var parts = []; if (problem) parts.push({ inline_data: { mime_type: problem.mime, data: problem.b64 } }); parts.push({ text: prompt });
            return { contents: [{ parts: parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }; })() }
      ];
      for (var ai = 0; ai < attempts.length; ai++) {
        var at = attempts[ai];
        try {
          res = UrlFetchApp.fetch(at.url, { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, payload: JSON.stringify(at.payload), muteHttpExceptions: true });
        } catch (fe) { errors.push(mdl + '/' + at.name + ': ' + fe); continue; }
        code = res.getResponseCode(); body = null;
        var raw = res.getContentText() || '';
        try { body = JSON.parse(raw); } catch (e) {}
        if (code === 200 && body) { model = mdl; break outer; }
        var em = (body && body.error && (body.error.message || body.error.status)) || raw.replace(/\s+/g, ' ').slice(0, 160) || ('HTTP ' + code);
        errors.push(mdl + '/' + at.name + ' → ' + code + ': ' + em);
        Logger.log('[aiNoteImage] ' + errors[errors.length - 1]);
      }
    }
    if (code !== 200 || !body) {
      return { success: false, msg: '이미지 생성 API가 전부 실패했어요.\n' + errors.join('\n') };
    }
    // 응답 어디에 있든 base64 이미지 블록을 찾음(Interactions: outputs/steps 안 {type:'image',data}, 구형: parts[].inlineData)
    var img = aiFindImageBlock(body);
    if (!img) {
      Logger.log('[aiNoteImage] 이미지 없음: ' + res.getContentText().slice(0, 600));
      return { success: false, msg: '이미지가 안 만들어졌어요 (응답에 이미지 없음). 프롬프트가 차단됐거나 모델이 글만 돌려줬을 수 있어요.' };
    }
    var outMime = img.mime || 'image/jpeg';
    var ext = outMime.indexOf('png') >= 0 ? 'png' : 'jpg';
    var folderName = 'MKMath 자료실';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(img.data), outMime, 'ai_note_' + Date.now() + '.' + ext));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: 'https://drive.google.com/file/d/' + file.getId() + '/view', fileId: file.getId(), model: model };
  } catch (err) {
    Logger.log('[aiNoteImage] 예외: ' + err);
    return { success: false, msg: String(err) };
  }
}
function aiFindImageBlock(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) { var r = aiFindImageBlock(node[i]); if (r) return r; } return null; }
  if (node.type === 'image' && typeof node.data === 'string' && node.data.length > 100) return { mime: node.mime_type || node.mimeType, data: node.data };
  var inl = node.inlineData || node.inline_data;
  if (inl && typeof inl.data === 'string' && inl.data.length > 100) return { mime: inl.mimeType || inl.mime_type, data: inl.data };
  for (var k in node) { if (node.hasOwnProperty(k)) { var r2 = aiFindImageBlock(node[k]); if (r2) return r2; } }
  return null;
}

// Gemini(generateContent) 호출 — 성공하면 {ok:true, text, model}, 실패하면 {ok:false, err}
function aiDraftCallGemini(apiKey, images, text) {
  var override = PropertiesService.getScriptProperties().getProperty('GEMINI_DRAFT_MODEL');
  var models = override ? [override].concat(AI_DRAFT_GEMINI_MODELS) : AI_DRAFT_GEMINI_MODELS;
  var parts = images.map(function(im){ return { inline_data: { mime_type: im.mime, data: im.data } }; });
  parts.push({ text: text });
  var lastErr = '';
  for (var i = 0; i < models.length; i++) {
    var model = models[i];
    try {
      var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          system_instruction: { parts: [{ text: AI_DRAFT_SYSTEM }] },
          contents: [{ role: 'user', parts: parts }],
          // 생각(thinking) 토큰이 출력 한도를 다 먹고 정작 답이 빈 채로 오는 일이 없게 넉넉히
          generationConfig: { maxOutputTokens: 16000, temperature: 0.3 }
        }),
        muteHttpExceptions: true
      });
      var code = res.getResponseCode();
      var body = {};
      try { body = JSON.parse(res.getContentText()); } catch (e) {}
      if (code === 404) { lastErr = model + ': 모델 없음(404)'; continue; } // 모델 이름이 바뀐 경우 다음 후보로
      if (code !== 200) { lastErr = model + ': ' + ((body.error && body.error.message) || ('HTTP ' + code)); continue; }
      var cand = (body.candidates || [])[0] || {};
      var out = ((cand.content || {}).parts || [])
        .filter(function(pt){ return pt.text && !pt.thought; }) // thought:true 는 생각 과정이라 제외
        .map(function(pt){ return pt.text; }).join('\n').trim();
      if (!out) { lastErr = model + ': 응답에 글이 없음 (finishReason: ' + (cand.finishReason || '?') + ')'; continue; }
      return { ok: true, text: out, model: model };
    } catch (e) { lastErr = model + ': ' + e; }
  }
  return { ok: false, err: 'Gemini 실패 — ' + lastErr };
}
// Claude(messages) 호출 — 예비용
function aiDraftCallClaude(apiKey, images, text) {
  var content = images.map(function(im){ return { type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } }; });
  content.push({ type: 'text', text: text });
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    // thinking disabled: 이 모델은 답하기 전 "생각" 단계가 기본으로 켜져 있어서, 그게 max_tokens를 다 먹고
    // 정작 답이 빈 채로 오는 문제가 있었음(stop_reason: max_tokens, content에 thinking 블록만). 풀이 초안엔 불필요.
    payload: JSON.stringify({ model: AI_DRAFT_MODEL, max_tokens: 6000, thinking: { type: 'disabled' }, system: AI_DRAFT_SYSTEM, messages: [{ role: 'user', content: content }] }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) {}
  if (code !== 200) return { ok: false, err: 'Claude 실패 — ' + ((body.error && body.error.message) || ('HTTP ' + code)) };
  var out = (body.content || []).filter(function(c){ return c.type === 'text'; }).map(function(c){ return c.text; }).join('\n').trim();
  if (!out) return { ok: false, err: 'Claude 실패 — 응답에 글이 없음 (stop_reason: ' + (body.stop_reason || '?') + ')' };
  return { ok: true, text: out, model: AI_DRAFT_MODEL };
}

function aiDraftAnswer(data) {
  var qid = String(data.questionId || '');
  if (!qid) return { success: false, msg: 'questionId 없음' };
  var props = PropertiesService.getScriptProperties();
  var geminiKey = props.getProperty('GEMINI_API_KEY');
  var claudeKey = props.getProperty('ANTHROPIC_API_KEY');
  var nowKst = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy.MM.dd HH:mm');
  if (!geminiKey && !claudeKey) {
    firestorePatchFields('qna_ai_drafts', qid, { questionId: qid, text: '', error: 'GEMINI_API_KEY(또는 ANTHROPIC_API_KEY)가 Apps Script 스크립트 속성에 없어서 초안을 만들지 못했어요.', createdAt: nowKst, model: '' });
    return { success: false, msg: 'no api key' };
  }
  try {
    // 질문에 첨부된 사진들(드라이브)을 base64로 — Gemini/Claude 공통
    var images = [];
    aiExtractDriveIds(data.content).forEach(function(id){
      try {
        var blob = DriveApp.getFileById(id).getBlob();
        var mime = blob.getContentType() || '';
        if (mime.indexOf('image/') !== 0) return;
        var bytes = blob.getBytes();
        if (bytes.length > 4.5 * 1024 * 1024) return; // 이미지 크기 한도 근처는 건너뜀
        images.push({ mime: mime === 'image/jpg' ? 'image/jpeg' : mime, data: Utilities.base64Encode(bytes) });
      } catch (e) { Logger.log('[aiDraftAnswer] 이미지 읽기 실패 ' + id + ': ' + e); }
    });
    var text = '학생 이름: ' + (data.studentName || '') + '\n제목: ' + (data.title || '') + '\n\n질문 내용:\n' + aiHtmlToText(data.content);
    if (images.length) text += '\n\n(위에 첨부된 사진 ' + images.length + '장이 문제 사진입니다.)';

    // Gemini Pro 먼저 → 실패하면 Claude 예비
    var r = null, errs = [];
    if (geminiKey) { r = aiDraftCallGemini(geminiKey, images, text); if (!r.ok) { errs.push(r.err); r = null; } }
    if (!r && claudeKey) { r = aiDraftCallClaude(claudeKey, images, text); if (!r.ok) { errs.push(r.err); r = null; } }
    if (!r) {
      var msg = errs.join(' / ');
      firestorePatchFields('qna_ai_drafts', qid, { questionId: qid, text: '', error: msg, createdAt: nowKst, model: '' });
      return { success: false, msg: msg };
    }
    firestorePatchFields('qna_ai_drafts', qid, { questionId: qid, text: r.text, error: '', createdAt: nowKst, model: r.model });
    // 초안이 준비되면 선생님 폰으로 알림톡 — 질문 올라왔을 때 가는 알림과 별개로 "이제 확인하고 답변 달면 된다"는 신호
    if (!data.silent) {
      try {
        sendAlimtalkMessages([{ phone: TEACHER_NOTIFY_PHONE, name: String(data.studentName || ''), className: 'AI 풀이 초안 준비됨', sessionNum: nowKst,
          message: (data.studentName || '학생') + '님 질문 "' + String(data.title || '').slice(0, 30) + '"의 AI 풀이 초안이 준비됐어요. 질의응답에서 열어 확인 후 답변을 달아주세요.' }]);
      } catch (e) { Logger.log('[aiDraftAnswer] 알림톡 실패: ' + e); }
    }
    return { success: true };
  } catch (err) {
    Logger.log('[aiDraftAnswer] 오류: ' + err);
    try { firestorePatchFields('qna_ai_drafts', qid, { questionId: qid, text: '', error: String(err), createdAt: nowKst, model: '' }); } catch (e) {}
    return { success: false, msg: String(err) };
  }
}
