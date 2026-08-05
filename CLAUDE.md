# 김민관 수학 홈페이지 프로젝트

## 프로젝트 목적
수학 학원(김민관 수학) 운영용 웹사이트. 선생님 1명(사용자 본인, id: mingwan0309)과 학생들이 사용한다.
- 프론트엔드: 이 폴더의 HTML 파일들 → GitHub Pages로 배포 (https://mingwan0309.github.io/my-homepage/)
- 백엔드: **Firebase (Firestore + Authentication)**. Firebase 프로젝트명: `mkmath` (project id: `mkmath-54f5d`)
- Google Apps Script(Code.gs)는 **파일 업로드(구글 드라이브 저장)**와 **카카오 알림톡 실제 발송(sendAlimtalk, 솔라피 연동)** 용도로 남아있음. 그 외 모든 기능은 Firebase로 완전히 이전 완료 (2026-07-10).

## 사용자에 대해
- 비개발자. 코드를 직접 수정할 수 없다.
- 설명은 코드 용어 최소화, 클릭 순서까지 단계별로 안내한다.
- Code.gs 수정이 필요하면(파일 업로드 관련뿐) 반드시 **전체 파일**을 갱신해서 제공한다. 스니펫만 주지 않는다.
- 반말/짧은 요청이 많다. 스크린샷으로 문제를 보여주는 경우가 많으니 스크린샷을 꼼꼼히 확인한다.
- **작업이 끝나면 CLAUDE.md도 최신 상태로 갱신하고 커밋한다.** (예전에 Firebase 전환 후 이 파일을 안 고쳐서 사용자가 "왜 기억을 못 하냐"고 지적한 적 있음 — 아키텍처가 바뀔 때마다 즉시 이 파일도 갱신할 것.)

## 배포 절차 (하드 룰)
1. HTML/JS 수정 → 확인 요청 없이 바로 `git add` → `git commit` → `git push` 한다.
2. push 후 사용자에게 "1~2분 후 Ctrl+Shift+R(강력 새로고침)로 확인하세요"를 안내한다.
3. Firestore 보안 규칙을 바꿔야 하는 경우, Firebase 콘솔 → Firestore Database → 규칙 탭에 전체 규칙을 복사-붙여넣기 하도록 안내한다 (Apps Script 재배포 같은 절차 아님, 별개).
4. Code.gs(파일 업로드 전용)를 수정한 경우: Apps Script에 전체 붙여넣기 → 저장 → 배포 → 배포 관리 → 연필(✏️) → 버전을 **"새 버전"으로 선택** → 배포. ("새 버전" 선택 없이는 반영 안 됨 — 예전에 이걸 빼먹어서 사고 2번 있었음.)
5. 커밋 메시지는 한국어로 "기능 - 변경 요약" 형식.
6. **새 페이지나 새 기능을 만들 때는 반응형(@media max-width:768px) 대응을 처음부터 포함한다.** (사후에 매번 따로 고치다가 반 자료실 사이드바, 부교재 카드, 클리닉 시간표, 팝업, 학생 네비바 등에서 여러 번 모바일 레이아웃이 깨진 적 있음 — "나중에 고치기"가 아니라 "처음부터 포함"이 규칙.)
7. 새 페이지의 폰트는 기존 페이지들과 통일해서 Pretendard 계열을 사용한다.

## 파일 지도
| 파일 | 역할 |
|---|---|
| index.html | 메인 홈 |
| admin.html | 선생님(+조교 일부) 관리 페이지 (반/학생/데일리퀴즈/클리닉/의무클리닉/숙제관리/공지/설문조사/질의응답/채팅/영상 라이브러리/부교재 강의/조교/관리자) |
| class.html | 반 상세 (차시, 수강생 목록, 강의 자료실) |
| session.html | 차시별 출석/성적 관리 — **학생 접근 차단됨** (student면 homework.html로 리다이렉트) |
| homework.html | 데일리 퀴즈 (학생용, AI 채점 포함) |
| clinic.html | 클리닉 신청 |
| qna.html | 질의응답 |
| textbook.html | 부교재 해설 강의 (학년→과목→교재 3단계 영상 라이브러리) |
| firebase-api.js | **핵심 백엔드 파일.** 기존 Apps Script(`script.google.com`) 요청을 가로채서 Firestore로 처리하는 fetch 오버라이드. 모든 HTML에 `<script src="firebase-api.js"></script>`로 포함됨. 파일 업로드(`uploadFile`)만 진짜 Apps Script로 통과시킴. |
| Code.gs | Apps Script 사본. **파일 업로드(Google Drive 저장)에만 사용.** 다른 기능은 여기 없음 — firebase-api.js를 봐야 함. |

## 백엔드 구조 (Firestore 컬렉션)
- `students`: id(=문서ID, 로그인 아이디), password(평문, 레거시 표시용), role(teacher/student), name, parentPhone, school, grade, gender, classId, active(계정 활성화 여부), createdAt
- `classes`: id, name, time, startDate, endDate, status
- `sessions`: id, classId, sessionNum, date
- `attendance`: id, sessionId, studentId, status, memo
- `scores`: id, sessionId, studentId, examId, score, pass, feedback (차시별 시험 성적, 교사 전용)
- `quiz_scores`: 데일리 퀴즈 AI 채점 결과 (id, name, title, score, total, date)
- `exams`: id, sessionId, name, createdAt
- `materials`: id, classId, category(PDF 자료/손필기 자료/영상 자료), name, url, size, uploadDate, downloadCount, memo
- `material_views`: 자료 확인/영상 시청 진도 기록 (materialId__studentId 키, progress %)
- `video_library`: id, name, url, memo, createdAt, subject, type (반 자료실용 영상 라이브러리)
- `textbook_videos`: id, grade, subject, book, name, url, memo, createdAt (부교재 해설 강의용)
- `problems`: 데일리 퀴즈 문제 (title, category(유형 태그, 선생님이 직접 입력), content, image, solution, solutionImage, total). 학생이 틀리면(만점 미만) 같은 category의 다른 문제를 결과 화면에서 "🔁 같은 유형 문제 이어서 풀기" 버튼으로 바로 이어서 풀 수 있음(homework.html `findNextCategoryProblem`/`startNextCategoryProblem`). AI 채점은 Gemini Flash 무료 API(`GEMINI_KEY`, homework.html에 하드코딩)로 손글씨 캔버스 이미지 + 정답/해설을 비교해서 채점 — 100% 정확하진 않음(글씨 지저분하거나 다단계 풀이는 오채점 가능), 무료 한도는 소규모 학원 사용량에는 충분함.
- `clinics` / `clinic_bookings`: 클리닉 정보 및 예약
- `mandatory_clinic`: 의무클리닉(수업 전 1시간, 정규 시간이 아닌 다른 요일/시간에 오는 학생 명단). id, studentId, name, type('regular'=매주 반복되는 정규 시간 변경 / 'temp'=이번 주만 특정 날짜 하루만 임시 변경), date(type이 temp일 때만 사용, 특정 날짜), day(실제로 오는 요일 — temp면 date에서 자동 계산됨), targetDay(이 클리닉이 어느 요일 몫인지 — 등록할 때 선생님이 매번 직접 선택, 예: 월/금반인데 수요일에 왔으면 "월요일 보충"인지 "금요일 선행"인지), time, memo, attendance(날짜별 출석/결석 맵, 예: `attendance["2026-08-02"]="결석"`), attendanceBy(같은 날짜 키로 누가 체크했는지 이름 기록 — 교사/조교 구분용, 학생 화면에는 노출 안 함), createdAt. 목록 필터링 시 type='temp'면 date가 오늘과 일치할 때만, type='regular'(또는 미지정 — 구버전 데이터 하위호환)면 day가 오늘 요일과 일치할 때만 노출됨. admin.html "의무클리닉" 탭에서 등록/출결체크(교사+조교 접근 가능). **삭제 버튼은 교사만 보임**(조교는 출석/결석 체크만 가능, 등록 자체를 지울 수 없음 — `cu.role==='teacher'` 가드). 결석 체크 시 확인창 후 **실제 카카오 알림톡이 학생·학부모 번호로 자동 발송됨**(아래 솔라피 연동 재사용, 둘 다 전화번호 없으면 발송 대신 경고 알림). 또한 session.html의 "수업 결과 발송" 메시지 작성창에서, 발송 대상 중 의무클리닉 등록된 학생이 있으면 **{의무클리닉} 데이터 삽입 토큰이 추가로 나타나** 해당 학생의 오늘 출결 상태를 문구에 자동으로 넣을 수 있음(`mcListSession` 전역변수, `computeMsgTokens`/`renderMsgTokenBar`). **학생 본인은 mypage.html에서 자기 의무클리닉 등록 현황을 볼 수 있음**(`getMyMandatoryClinic` API, "⏰ 의무클리닉" 카드 — 해당 없으면 카드 자체가 안 뜸).
- `qna` / `qna_answers` / `reviews`: 질의응답(공개 게시판), 후기. qna.html과 chat-widget.js(1:1 비공개 채팅)는 서로 목적이 달라 화면에 안내 문구로 구분해둠(qna는 "다른 학생도 볼 수 있으니 공개 질문용", 채팅은 "개인 문의용, 첫 메시지 전 안내 문구 표시").
- `chat_messages` / `chat_threads`: 학생↔선생님 1:1 실시간 채팅. `chat_messages`(id, studentId, sender(student/teacher), text, createdAt), `chat_threads`(문서ID=studentId, studentName, lastMessage, lastAt, unreadForTeacher, unreadForStudent). 학생용 플로팅 버블은 `chat-widget.js`(mypage/homework/clinic/qna/class/textbook/index에 삽입), 선생님은 admin.html 채팅 탭. **보안 규칙에 반드시 채팅 조항이 있어야 학생이 전송 가능** — 기본 규칙이 "쓰기는 교사만"이라 조항 없으면 학생 메시지가 permission-denied로 막힌다. `chat_messages`는 학생 본인(studentId==loginId)만 create/read, `chat_threads`는 isOwner(id)만 read/write, 선생님은 둘 다 전부 허용. **규칙 새로 배포할 때 이 채팅 조항을 절대 빼지 말 것.**
- `surveys` / `survey_responses` (2026-08-04 추가): 설문조사. `surveys`(id, title, color, targetClassIds(배열, 빈 배열=전체 학생 대상), startAt/endAt(datetime-local 문자열, 비우면 기간제한 없음), allowEdit(제출 후 재응답 허용 여부), buttonType('submit'=제출하기/'apply'=신청하기), maxResponses(현재 UI엔 입력칸 없음, 필드만 존재), questions(배열, 각 {id,text,type('single'=단일선택/'multi'=복수선택/'text'=자유형),required,options}), createdAt). `survey_responses`(문서ID = surveyId__studentId, surveyId, studentId, studentName, answers(문항id→답 맵, single/text는 문자열 multi는 배열), submittedAt). admin.html "설문조사" 탭(교사만, `mcAllowedPages`에 없어서 조교는 접근 불가)에서 목록/생성/수정/삭제 + 문항 편집 + 결과 보기(응답자별 답 나열). 학생은 mypage.html **최상단**에 "📋 설문조사" 카드로 응답 대상이고(반이 지정 안 됐거나 자기 반이 대상에 포함) 기간 내이며 아직 응답 안 했거나(또는 allowEdit=true인) 설문만 노출됨(`getMySurveys` API, `loadMySurveys`). 응답은 모달(`sv-answer-modal`)에서 입력 후 `submitSurveyResponse`로 저장.
  - Firestore 규칙에 `surveys`(로그인 시 읽기, 쓰기는 교사만) / `survey_responses`(본인 문서만 create·update, 읽기는 교사 또는 본인) 조항 배포 완료(2026-08-04).
- **학생 상세 슬라이드 패널 + 학생 화면 미리보기 (2026-08-04 추가).** admin.html "학생" 탭 목록에서 학생 이름 클릭 → 오른쪽에서 `.sd-panel` 슬라이드 패널이 열리며 기본정보 + 4개 탭(수강 이력/클리닉·상담 이력/질문 이력/성적 이력)을 보여줌(`openStuDetail`, API `getStudentFullHistory` — attendance/clinic_bookings/mandatory_clinic/qna/scores를 한 번에 조인해서 반환). "학교 성적"(내신 등)은 이 시스템에 그런 데이터가 없어서 구현 안 함. **이 미리보기는 교사 전용**(조교에게는 확장하지 않음 — 한 번 시도했다가 사용자가 "조교가 볼 수 있게 하는 게 아니라, 내가(교사가) 조교 이름 눌렀을 때 조교 화면이 보이게 해달라는 것"이라고 정정함).
- **조교 화면 미리보기 (2026-08-05 추가).** admin.html "조교 관리" 목록에서 조교 이름 클릭 → 새 탭으로 `admin.html?previewAssistantId={id}` 열림(`previewAssistant`). **교사 본인의 실제 로그인 세션 그대로** 그 조교가 로그인했을 때 보는 화면(의무클리닉 팝업 + 근무 현황 카드)을 렌더링함(`renderAssistantPreview`) — 학생 미리보기와 달리 별도 Firestore 권한 확장이 전혀 필요 없음(교사 계정 자체가 모든 컬렉션에 `isTeacher()` 전권을 이미 가지고 있으므로). 팝업 안에서 출석/결석·휴식 버튼을 누르면 실제로 그 조교의 근무 기록에 반영됨(학생 화면 미리보기와 동일한 설계 원칙 — "미리보기"이지만 조작은 진짜로 반영).
  - 패널 안 "📱 학생 화면 보기" 버튼 → `mypage.html?previewStudentId={id}`를 새 탭으로 염(`openStuPreview`). mypage.html은 이 쿼리파라미터가 있고 **실제 로그인된 사람이 교사일 때만** 그 학생인 것처럼 화면을 보여줌(`isPreviewMode` 전역변수) — 실제 `mkmath_session`은 건드리지 않고(교사 세션 유지), 화면 상단에 안내 배너를 띄움. **읽기 전용이 아니라 실제로 조작 가능** — 숙제 사진 업로드/삭제, 설문 제출을 누르면 진짜 그 학생 데이터에 반영됨(선생님이 배포 확인용으로 대신 처리해줄 수 있게). 이걸 위해 `survey_responses`/`material_views` Firestore 규칙의 create/update 조건에 `isTeacher()`를 추가해둠(원래는 본인 로그인(loginId==studentId)만 허용이라 선생님 계정으로 쓰면 막혔음). `hw_status`는 원래도 교사 write가 무조건 허용이라 규칙 변경 불필요했음. **비밀번호 변경만은 막아둠** — 미리보기라서가 아니라 선생님 계정으로는 학생의 현재 비밀번호를 알 수 없어 기술적으로 불가능하기 때문(`openPwModal`에서 안내 후 차단). 채팅 위젯은 실제 localStorage 세션이 교사라서 자동으로 안 뜸(별도 처리 불필요).

## 로그인 / 인증 (하드 룰 — 중요)
- **Firebase Authentication(이메일/비밀번호)** 사용. 실제 로그인 아이디는 전화번호 등 임의 문자열이라, `{아이디}@mkmath.local`이라는 가짜 이메일로 변환해서 Firebase Auth 계정을 만든다 (`toAuthEmail()`).
- Firebase는 비밀번호 6자 이상을 요구 → 6자 미만이면 `toAuthPassword()`가 뒤에 0을 붙여서 6자를 맞춘다. 로그인 시에도 같은 함수로 변환하므로 사용자는 원래 짧은 비번을 그대로 입력하면 된다.
- 학생 추가(`addStudent`) 시 Firestore 문서 저장 + **보조 Firebase 앱(`mk-secondary`)으로 Auth 계정도 자동 생성**한다 (선생님 세션이 끊기지 않도록 별도 앱 인스턴스 사용). 따라서 학생 추가는 관리 페이지에서 평소처럼만 하면 로그인 계정도 자동으로 생김 — 콘솔 작업 불필요.
- 교사(mingwan0309) 계정은 Firebase 콘솔 Authentication에서 **수동으로 생성**되어 있음 (최초 부트스트랩 시 자동 생성 로직은 제거됨 — 보안 규칙이 로그인 전 Firestore 읽기를 막아서 자동 부트스트랩이 불가능해졌기 때문).
- 학부모 전화번호도 학생 번호와 동일하게 별도 로그인 계정으로 자동 생성됨(`api.createParentAccount`, 기본 비번 123456). admin.html 학생 목록의 학부모 전화번호 옆 "계정 재발급" 버튼으로 개별 재시도 가능.
  - **"학부모 계정 전체 점검/일괄 재발급" 기능은 만들었다가 제거함(2026-07-26).** 이유: Firebase가 이메일 열거 공격 방지를 위해 `fetchSignInMethodsForEmail`을 항상 빈 배열로 반환하도록 바꿔서, 이미 있는 계정도 전부 "없음"으로 오탐지됨 → 불필요한 일괄 재생성 시도가 `auth/too-many-requests` 속도 제한만 유발했음. **다시 이런 "Auth 계정 존재 여부 사전 점검" 기능은 만들지 말 것** — Admin SDK 없이는 신뢰성 있게 확인할 방법이 없음. 특정 학부모가 로그인 안 된다고 할 때만 개별 재발급 버튼 사용 (결과가 "이미 사용 중"이면 계정은 있는 것 — 비밀번호(기본 123456) 문제로 봐야 함).
- 계정 비활성화(`active:false`)는 로그인 자체를 막는다 (`fetchProfileAfterAuth`에서 체크). 완전 삭제 대신 이 방법으로 임시 잠금 가능.
- **학생 비밀번호를 선생님이 강제로 재설정하는 기능은 기술적으로 불가능** (Admin SDK/Cloud Functions 없이는 타인 비밀번호 변경 불가, 유료 Blaze 요금제 필요). 학생이 비번을 잊으면 계정 삭제 후 재등록이 유일한 방법. 학생 본인은 homework.html 설정 탭에서 직접 변경 가능.
- 학생 개별/엑셀 일괄 추가 시 **초기 비밀번호 기본값은 `123456`** (admin.html 개별 추가 입력창 기본값, 엑셀 양식 예시값, 엑셀 업로드 시 3번째 칸 비었을 때의 기본값 전부 동일하게 맞춰져 있음).
- Firestore 보안 규칙 요약: `students`는 본인 또는 교사만 읽기/쓰기, 나머지 대부분은 로그인한 사람이면 읽기 가능하고 쓰기는 교사만 가능. `qna`의 "비밀글"은 클라이언트 단에서만 가려짐 (서버 강제 아님 — 알려진 한계).
- **보안 점검 결과 반영 (2026-08-05).** `students` 문서 **생성(create)은 교사만** 가능하도록 강화(예전엔 로그인만 하면 아무나 자기 이름으로 새 학생 문서를 만들 수 있었음 — Firebase는 앱 화면 없이도 공개 API 키만으로 새 계정을 만들 수 있어서 실제 위협이었음). `qna` 글도 **본인 글만 수정/삭제 가능**하도록 강화(예전엔 로그인만 하면 아무나 남의 질문을 지우거나 바꿀 수 있었음 — 화면(UI)의 "본인 글만" 체크는 클라이언트단이라 우회 가능했음). `reviews` 작성은 **로그인한 사람만** 가능하도록 강화(예전엔 비로그인도 무제한 작성 가능해서 스팸 위험). **다시 규칙을 느슨하게(로그인만 하면 전체 쓰기 허용 등) 되돌리지 말 것** — 반드시 본인 것만 건드릴 수 있게 `request.resource.data.studentId == loginId()` 또는 `isOwner()` 조건을 넣을 것.
- **Gemini API 키가 homework.html에 하드코딩되어 클라이언트에 노출됨 (알려진 한계, 사용자가 "지금 퀴즈 기능 안 쓰고 있어서 괜찮다"고 확인함 — 우선순위 낮춤).** 코드로는 못 가리고, 대신 Google Cloud Console에서 그 API 키를 "HTTP 리퍼러(mingwan0309.github.io만 허용)"로 제한하는 것을 권장 — 사용자가 직접 콘솔에서 설정해야 함(무료, 코드 변경 불필요).
- **Code.gs 보안 강화 (2026-08-05).** 예전 구글시트 기반 백엔드(로그인, 학생추가, 성적입력, 질문삭제 등 전체)가 Firebase 이전 후에도 Code.gs 안에 그대로 남아있었고 **로그인 확인이 전혀 없어서, 이 Apps Script 주소만 알면 누구나 직접 호출해 데이터를 조작할 수 있는 상태**였음 → `doGet` 전체를 비활성화(`{error:'disabled'}` 고정 반환)하고 완전히 제거하지는 않되(만약을 대비해 코드는 남겨둠) 다시 켜지 않도록 주석으로 강하게 표시해둠. 또한 `doPost`(uploadFile/sendAlimtalk)에는 `APP_SHARED_TOKEN`이라는 앱 전용 토큰 검증을 추가해서, 이 토큰이 없는 요청(= 홈페이지를 거치지 않은 직접 호출)은 다 거부됨. 이 토큰은 `firebase-api.js`의 `APP_SHARED_TOKEN` 상수와 **반드시 똑같아야 함** — 하나만 바꾸면 알림톡/파일업로드가 전부 깨짐. 추가로 `sendAlimtalk`에 **하루 최대 300건 발송 상한**(PropertiesService로 날짜별 카운트)을 걸어서, 혹시 토큰이 뚫리거나 코드에 버그가 생겨도 피해가 무한정 커지지 않게 안전장치를 둠. **이 토큰 검증/발송 상한 로직을 다시 빼지 말 것.**
- **학부모 로그인은 보안 규칙에 학부모 조항이 있어야 작동한다 (2026-07-27 추가).** 학부모 계정은 auth 이메일이 `{parentPhone}@mkmath.local`인데, 로그인 직후 `students`에서 `where('parentPhone','==', 번호)`로 자녀를 찾는다. 규칙에 `isParentOf(sid)` 헬퍼(= 그 학생 문서의 parentPhone == 로그인 번호)를 두고 `students`/`attendance`/`hw_status`/`material_views`의 read에 이 조항을 추가해야 학부모가 자녀 정보를 읽을 수 있다. 이 조항이 없으면 인증은 되지만 자녀 조회에서 `permission-denied`가 나서 "아이디/비번 틀림"으로 보인다. **규칙을 새로 배포할 때 이 학부모 조항을 절대 빼지 말 것.** 또한 firebase-api `api.login`은 입력 번호를 하이픈 유무 여러 형식으로 auth·조회 시도한다(저장된 parentPhone 형식과 안 맞아도 찾도록).

- **조교(assistant) 로그인 (2026-08-02 추가, 2026-08-04 담당학생 필드 추가).** `assistants` 컬렉션 문서 ID를 **전화번호 그 자체**로 통일(학생과 동일한 방식) — 로그인 조회가 `doc(전화번호).get()`으로 단순 조회되게 하기 위함(보안 규칙의 `isAssistant()`도 같은 방식으로 존재 확인). admin.html "조교 관리"에서 조교 추가 시 전화번호+초기 비밀번호를 입력하면 `mk-secondary` 앱으로 Auth 계정이 자동 생성됨. 로그인하면 role='assistant'로 세션 저장되고, admin.html은 사이드바 다른 메뉴를 모두 숨기고 **"의무클리닉" + "숙제관리" 화면만**(`mcAllowedPages`) 강제로 띄움(다른 페이지 접근 차단). Firestore 규칙상 조교는 `students`(읽기만) + `mandatory_clinic`(읽기/쓰기) + `hw_status`(읽기/쓰기)만 접근 가능.
  - `assistants` 문서에 `studentIds`(배열, 담당 학생 id 목록) 필드 추가. 조교 관리 모달에서 담당 학생을 체크박스로 지정하면, 로그인 세션(`mkmath_session.studentIds`)에 실려서 의무클리닉/숙제관리 화면에 "내 담당 학생만 보기" 토글(기본 켜짐)로 필터링됨. 지정 안 하면(빈 배열) 토글 자체가 안 보이고 전체가 보임.
  - **조교 자동 출퇴근 (2026-08-05 추가).** 조교가 로그인하면 자동으로 `work_logs`에 출근 기록 생성(`window.mkClockIn`, index.html 로그인 성공 직후 호출), 로그아웃하면 자동으로 퇴근 시간·근무시간·시급(근무 유형의 hourlyRate 기준) 계산해서 기록 완료(`window.mkClockOut`, index.html/admin.html의 로그아웃 버튼에서 호출). 이미 출근 중(퇴근 안 한 기록 있음)이면 중복 출근 처리 안 함. **브라우저 탭을 그냥 닫거나 인터넷이 끊기면 자동 퇴근 처리가 안 됨** — 로그아웃 버튼을 눌러야만 정상 기록됨(알려진 한계, 필요시 교사가 "근태 기록" 탭에서 수동으로 고칠 수 있음). 조교 로그인 화면(의무클리닉 팝업)에 "⏱ 내 근무 현황" 카드로 본인의 출근 상태·최근 근무 기록·수당을 볼 수 있음(`getMyWorkLogs`, 본인 것만 조회 가능 — Firestore 규칙에서 `assistantId==loginId()`로 제한). 교사 화면에는 화면 좌하단에 **지금 근무 중인 조교들의 동그란 아바타**가 실시간으로 뜨고(`initActiveAstWidget`, `work_logs`를 `clockOut==''`로 실시간 구독), 마우스를 올리면 이름과 출근 시각이 툴팁으로 보임.
  - **조교 휴식 버튼 (2026-08-05 추가).** 근무 중인 조교는 "⏱ 내 근무 현황" 카드에서 "☕ 휴식 시작"/"▶ 휴식 종료" 토글 가능(`toggleMyBreak`, `api.startBreak`/`api.endBreak`). 휴식 중인 시간은 `breakMin`(누적 분)에 더해져서 **퇴근 시 급여 계산(시급×근무시간)에서 자동으로 빠짐**. 언제 휴식을 눌렀는지는 `breakLogs` 배열("HH:MM~HH:MM" 문자열)에 기록되고, 교사의 "근태 기록" 상세 표에서 휴식 시간 칸에 마우스를 올리면(title 툴팁) 전체 이력이 보임. 휴식 종료를 안 누르고 퇴근하면 그 시점까지 자동으로 휴식 마감 처리됨. 근태 기록 화면의 급여는 **저장된 cost 필드가 아니라 clockIn/clockOut/breakMin으로 매번 다시 계산**해서 보여주므로(`workMin=outM-inM-l.breakMin`), 이 계산 로직을 건드릴 때는 반드시 breakMin 반영을 유지할 것.
  - **조교 화면 미리보기 (2026-08-05 추가).** admin.html "조교 관리" 목록에서 조교 이름 클릭 → 새 탭으로 `admin.html?previewAssistantId={id}` 열림(`previewAssistant`). **교사 본인의 실제 로그인 세션 그대로** 그 조교가 로그인했을 때 보는 화면(사이드바 메뉴 제한 + 의무클리닉 팝업 + 근무 현황 카드)을 렌더링함(`renderAssistantPreview` → `setupAssistantSession(sessObj, true)` — 실제 조교 로그인 코드와 동일한 함수를 공유해서 화면이 어긋나지 않게 함) — 학생 미리보기와 달리 별도 Firestore 권한 확장이 전혀 필요 없음(교사 계정 자체가 모든 컬렉션에 `isTeacher()` 전권을 이미 가지고 있으므로). 사이드바로 의무클리닉↔숙제관리를 실제로 오갈 수 있고, 팝업 안에서 출석/결석·휴식 버튼을 누르면 실제로 그 조교의 근무 기록에 반영됨(학생 화면 미리보기와 동일한 설계 원칙 — "미리보기"이지만 조작은 진짜로 반영).

## 역할별 접근 규칙 (하드 룰)
- 로그인 세션은 localStorage `mkmath_session`에 저장 (role, name, classId 포함). Firebase Auth 세션은 별도로 브라우저에 유지됨.
- **학생(student)은:**
  - session.html 접근 불가 (자동 리다이렉트)
  - class.html에서 자기 자신의 행만, 출결 결과만 읽기 전용으로 봄
  - homework/clinic/qna/class/textbook 페이지 상단에 학생 네비바 표시 (🏠 홈 / 📝 데일리 퀴즈 / 🏥 클리닉 신청 / 💬 질의응답 / 📖 부교재 해설 강의 / 📚 내 반) — 드롭다운 아님, 평면 나열. 모바일 화면에서는 좌우 스크롤 가능, 줄바꿈 없음(white-space:nowrap).
- **선생님(teacher)은:** 학생 네비바 대신 "관리 페이지" 버튼 표시.

## 학생 관리 (admin.html)
- 표 형태 목록: 이름/학생전화/학부모전화/고등학교/학년/성별/반배정/등록일자/계정상태(토글) 컬럼. 이름/전화번호 검색창 있음.
- 체크박스로 선택 시 상단에 도구모음 등장: ✏️ 정보 수정(1명 선택 시만) / 📥 엑셀 다운로드(선택 또는 전체) / 🗑 삭제.
- 계정상태 토글(활성화/비활성화)은 `active` 필드를 바꿔서 **로그인 자체를 막는 방식**(완전 삭제 아님). 삭제는 Firestore 문서 자체를 지움 (남은 Firebase Auth 계정은 orphan으로 남지만 앱상 로그인 불가하므로 무해함).
- "비밀번호 변경(선생님이 대신)"은 의도적으로 안 만듦 — 위 로그인 항목의 기술적 한계 때문.

## 성적/시험 관리 (session.html, 하드 룰)
- 학생 접근 완전 차단(교사 전용). 시험은 반의 각 차시(session) 아래에 등록.
- 채점 방식은 시험마다 **점수형/개수형(scoreType: score/count)** 중 선택. 개수형은 표에 "N/M개"로 표시.
- 결과 상태는 "제출/미제출"이 아니라 **"통과/미통과"** 용어 사용 (`pass` 필드 값: submit/nosub).
- 등급은 **백분위 자동 계산** (1등급 상위 10% ~ 4등급 90%까지, 등급컷 직접 입력 방식 아님), 소수 인원일 때도 각 등급 최소 1명은 보장되도록 보정.
- 시험별로 **통과 커트라인(passCutoff)** 설정 가능(선택). 설정 시 점수 입력하는 즉시 커트라인 이상이면 통과, 미만이면 미통과로 자동 표시(수동으로 다시 덮어쓰기 가능).
- 성적 탭에서 학생 이름을 클릭하면 슬라이드 패널이 열려 그 학생의 **성적 이력 + 수강 이력**을 같이 보여줌.
- 출석 칸은 이름 칸과 함께 표 왼쪽에 고정 너비로 붙여서 항상 보이게 함.
- session.html에서 키보드 `/` 누르면 빠른 강의 이동 모달(강의 검색, 초성검색 지원 → 차시 선택 2단계, ↑↓/ENTER/ESC 지원) 뜸. 첫 방문 시 우측 하단에 안내 힌트 표시(로컬스토리지로 1회만).
- 출석 탭 학생 선택 바에 "💬 수업 결과 발송" 버튼 있음. 클릭하면 메시지 작성 모달(카카오톡 미리보기 포함): 강의/차시 자동 표시, {이름}/{출결}/{반}/{차시} 등 데이터 삽입 토큰 버튼으로 전달사항 문구 작성 → **"N건 알림톡 발송" 버튼으로 실제 카카오 알림톡이 발송됨** (`doSendAlimtalk()` → Code.gs `sendAlimtalk` → 솔라피(SOLAPI) API로 실제 전송, 학생·학부모 전화번호로 각각 발송). "전체 한번에 복사"/"학생별 복사 목록" 버튼도 남아있어 수동 복사도 가능.
  - **솔라피 연동 정보**: Code.gs에 API 키·시크릿·발신번호(01062519244)·카카오 비즈니스채널 PF ID·템플릿 ID가 하드코딩되어 있음. 템플릿 변수는 `#{강의}`/`#{차시}`/`#{이름}`/`#{전달사항}` 4개 고정 — **템플릿을 카카오 채널 관리자센터에서 바꾸지 않는 한 이 4개 변수명은 그대로 유지해야 함** (다른 변수 추가하려면 솔라피에서 새 템플릿 심사부터 받아야 함).
  - 발송은 유료(솔라피 크레딧 차감)이므로, 이 발송 로직을 건드릴 땐 실수로 대량 발송되지 않도록 특히 조심할 것.
- 과제 탭은 시험 탭과 완전히 동일한 목록/상세 구조(목록 카드 + "+ 과제 추가" + 클릭 시 상세에서 이름/날짜 수정·삭제). `homeworks`/`hw_status` 컬렉션 별도 사용.
- 과제의 실제 결과는 **과제 탭이 아니라 성적 탭 표**에 시험 칼럼 오른쪽으로 붙어서 표시됨. 셀 클릭 시 시험과 별개의 패널(hw-panel)에서 **완료/일부미이행/미이행/미제출 4단계**(점수 입력 없음) + 코멘트 입력. 상태 선택 시 코멘트가 비어있으면 상태별 안내 문구가 자동으로 채워짐(교사가 수정 가능). 시험 성적(pass 필드)은 통과/미통과 2단계 그대로 유지 — 용어를 혼동하지 말 것.
- **숙제 재촉·제출 시스템 (2026-08-04 추가).** `hw_status` 문서에 필드 3개 추가: `submissionUrl`(학생이 올린 증빙 파일 링크), `submittedAt`, `lastReminderAt`/`lastReminderBy`(재촉 알림 발송 이력). 세 곳에서 이 데이터를 씀:
  - **mypage.html "내 숙제" 카드**(학생, 기록이 있을 때만 노출): 완료가 아닌 항목마다 "📷 사진/파일 올리기" 버튼 → `class.html`과 동일한 base64 업로드 방식으로 Code.gs `uploadFile`을 통해 드라이브에 저장 후 `submitHwProof`로 `hw_status`에 링크만 기록. 선생님이 확인해서 직접 "완료"로 바꿔야 최종 확정됨(학생이 스스로 완료 처리 불가 — 거짓 클릭 방지).
  - **admin.html "숙제관리" 탭**(교사 + **조교** 접근 가능, `mcAllowedPages`에 포함): `hw_status`에서 pass가 일부미이행/미이행인 것만 전체 반 기준으로 모아 보여줌(`getIncompleteHomeworks`). 학생별로 **"🔔 재촉 알림 보내기"**(카카오 알림톡 실제 발송, 클릭 시 확인창 + 발송 후 `lastReminderAt` 기록 — 위 알림톡 하드 룰과 동일하게 비용 발생하니 조심) / **"✓ 완료 처리"**(무료, `setHwStatus` 재사용) 버튼 제공. 제출된 사진은 링크로 바로 열어서 확인 가능.
  - firebase-api.js의 `setHwStatus`는 `.set(...,{merge:true})`로 바뀜 — 학생이 올린 `submissionUrl`을 교사가 상태만 바꿀 때 덮어써서 날리지 않기 위함. 이 함수를 다시 고칠 때 merge를 빼면 안 됨.
  - **Firestore 규칙 의존성**: `hw_status` 읽기(학생 본인 조회 포함)는 기존 규칙(`isOwner`)으로 이미 작동함(2026-08-04 실제 데이터로 확인 완료). 하지만 **① 조교의 hw_status 읽기/쓰기, ② 학생이 자기 `submissionUrl`/`submittedAt` 필드만 직접 쓰는 것**은 아직 규칙에 없어서 막혀 있음 — 조교용 숙제관리 화면과 학생 사진 업로드가 실제로 동작하려면 규칙에 `isAssistant()` 허용 + 학생 필드 제한 업데이트 추가가 필요함(현재 사용자에게 규칙 텍스트 요청 대기 중일 수 있음, 진행 상황 확인 필요).

## 영상 시스템 (하드 룰)
- 두 갈래: (1) 반 자료실용 `video_library` (과목+유형 분류), (2) 부교재 해설 강의용 `textbook_videos` (학년→과목→교재 3단계).
- 등록/삭제는 admin.html "영상"(video_library) / "부교재 강의"(textbook_videos, 2026-08-05 추가) 두 탭에서 각각 관리. textbook.html 안에도 교사 로그인 시 보이는 자체 등록/삭제 버튼이 남아있음(학생 화면에서 바로 등록하던 예전 방식) — 둘 다 같은 `textbook_videos` 컬렉션을 직접 건드리므로 어느 쪽에서 등록해도 결과는 같음.
- YouTube 재생은 유튜브로 이동하지 않고 **자체 모달**에서 iframe으로 재생하며, **유튜브 네이티브 컨트롤을 전부 제거하고 자체 UI로 완전히 대체**했다 (`controls=0` + 전체 화면을 덮는 클릭 차단막):
  - iframe embed url에 `controls=0&modestbranding=1&rel=0&enablejsapi=1` 사용
  - `#yt-click-shield`: iframe 전체를 덮는 투명 div (pointer-events:auto), 클릭 시 재생/일시정지 토글만 하고 유튜브 UI로는 클릭이 전혀 전달되지 않음
  - `#yt-seek-bar`/`#yt-seek-fill`: 자체 제작 재생바 (클릭으로 구간 이동, `ytPlayer.seekTo()`)
  - 배속 버튼(`#yt-speed-btn`): 0.8x~2.0x, 0.1 단위로 순환 (단, 유튜브는 실제로 0.25/0.5/0.75/1/1.25/1.5/1.75/2만 지원해서 중간값은 가장 가까운 값으로 자동 보정될 수 있음 — 알려진 한계)
  - 하단 좌우 검은 박스로 유튜브 로고/공유/나중에보기 아이콘 시각적으로도 가림 (pointer-events:none, 클릭 차단은 위 shield가 전담)
  - ⛶ 커스텀 전체화면 버튼으로 wrapper div를 requestFullscreen
  - 이 구조는 class.html과 textbook.html에 동일하게 구현된 openVideo/closeYtModal/toggleYtFullscreen/toggleYtPlay/seekYt/cycleYtSpeed 함수. **다른 페이지에 영상 재생 추가 시 반드시 이 구조를 그대로 복사해서 재사용할 것** (부분적으로만 막으면 클릭 차단에 구멍이 생김 — 여러 번 시행착오 끝에 "전체를 덮는 방식"이 유일하게 확실한 해결책임이 확인됨).
  - 영상 카드에 뜨는 배지는 "YouTube"가 아니라 **"강의 영상"**이라고 표시 (브랜딩 노출 최소화).
- 자료실 카테고리: PDF 자료 / 손필기 자료 / 영상 자료 (예전 "자습용 자료"·"암기자료"는 통합 삭제됨, 기존 데이터는 자동으로 "PDF 자료"로 매핑).
- 자료/영상 확인 현황: 교사는 각 자료 옆 "확인 N/M" 버튼으로 학생별 확인 여부, 영상은 시청 진도(%)까지 볼 수 있음 (`material_views` 컬렉션).

## 모바일 반응형 (하드 룰)
- 학생이 실제로 폰으로 쓰는 페이지(class.html, homework.html, clinic.html, qna.html, textbook.html, index.html)는 **처음 만들 때부터 @media (max-width:768px) 대응을 포함**한다. admin.html/session.html/review-admin.html 등 교사 전용 관리 페이지는 PC 사용이 전제라 우선순위 낮음.
- 자주 깨졌던 패턴과 대응: 좌우 나열(flex/grid)은 모바일에서 세로로 쌓기, 고정폭 사이드바는 폭 100%로, 표는 `overflow-x:auto`로 감싸기, 팝업/모달은 `width:90~94%`+내부 스크롤, 네비게이션 텍스트는 `white-space:nowrap`+가로스크롤(줄바꿈으로 글자 잘리는 것 방지).
- 작업 후 반드시 "이 화면, 폰에서도 확인했는가"를 스스로 체크하고, 안 했으면 사용자에게 확인을 요청한다.
- **전 페이지 모바일 정밀 최적화 완료 (2026-07-27).** 이때 정한 기준을 새 화면에도 그대로 적용할 것:
  - **터치 타깃 최소 44px 높이** (버튼·탭·네비 항목·달력 날짜칸·목록 행). 표 안 작은 버튼은 최소 38px.
  - **입력창(input/select/textarea)은 모바일에서 font-size:16px** — 그보다 작으면 iOS가 화면을 자동 확대해 레이아웃이 튄다.
  - **본문 글씨 13px 이상, 배지 등 보조 텍스트도 11px 이상.**
  - 모든 페이지 `html,body{overflow-x:hidden}` + 넓은 표는 `overflow-x:auto` 컨테이너로 감싸기(시간표처럼 원래 넓은 표는 "← 좌우로 밀어서 보세요 →" 안내 문구 표시).
  - 어두운 상단바 위의 보조 버튼(로그아웃 등) 글자색은 `#cbd5e1` 이상으로 — `#64748b`는 대비가 낮아 안 보인다.
  - 여러 단 그리드(예: session.html 알림톡 발송 모달의 3단)는 모바일에서 **1열로 쌓기**. 인라인 style로 grid를 준 경우 클래스를 붙이고 미디어쿼리에서 `!important`로 덮어쓴다(`.msg-body-grid`가 그 예).
  - admin.html 등 교사 페이지도 폰에서 쓰므로 동일 기준 적용(햄버거 드로어 폭 270px, 메뉴 항목 52px).
  - 점검 방법: 브라우저를 390px로 놓고 ①가로 넘침(scrollWidth > clientWidth) ②높이 40px 미만 버튼 ③12px 미만 글씨 를 스크립트로 훑으면 문제를 빠르게 찾을 수 있다.
  - **단, 스크립트 검사만 믿지 말고 반드시 스크린샷으로 눈으로 확인할 것.** 2026-07-27에 admin.html 상단바가 본문 옆에 세로로 찌그러져 있었는데(원인: `body{display:flex}` + JS가 `#dashboard`를 `display:flex`로 켜서 모바일 상단바가 본문과 가로로 나란히 배치됨), 넘침·터치크기 스크립트는 전부 통과해서 못 잡았다. 사용자가 스크린샷으로 지적해서 발견. → 모바일에서 `#dashboard{flex-direction:column}` + `body{display:block}`으로 해결.
  - 같은 이유로 놓쳤던 것 2건 더: qna.html 검색 버튼과 '내 글만 보기' 토글이 서로 **겹쳐 있었고**(모바일에서 `.filter-bar{flex-direction:column}`으로 해결), homework.html은 바깥 `.container`와 `#page-student > .container` **양쪽에 상단 여백이 이중 적용**돼 콘텐츠가 고정 네비바에 가리거나 과하게 떨어졌다(바깥 20px + 안쪽 98px = 118px로 정리, 고정바 높이 110px).

## 하지 말 것
- Code.gs(파일 업로드용) 스니펫만 제공하기 (항상 전체 파일)
- Apps Script 재배포 시 "새 버전" 안내 빼먹기
- 학생 화면에 다른 학생 정보 노출하기
- 영상을 유튜브 새 탭으로 열게 만들거나, 유튜브 UI 요소를 부분적으로만 가리기 (반드시 전체 차단 구조 사용)
- 사용자에게 코드 직접 수정 요구하기
- **아키텍처를 바꾸고 이 CLAUDE.md 파일을 업데이트하지 않기** (Firebase 전환 후 한동안 이 실수를 했음)
- 새 학생용 페이지/구역을 PC 화면만 고려해서 만들고 모바일 대응을 나중으로 미루기

## 완료 판정 기준
1. git push 완료
2. Firestore 규칙 변경 시 콘솔에 붙여넣기+게시 안내 완료 / Code.gs(파일업로드) 변경 시 재배포("새 버전") 안내 완료
3. 학생용 페이지를 건드렸다면 모바일 화면 기준으로도 레이아웃이 깨지지 않는지 확인
4. 사용자에게 확인 방법(어느 페이지, 어떤 버튼) 안내 완료
5. 사용자가 실제 화면에서 확인해줘야 최종 완료 — 스크린샷으로 문제 오면 그게 우선순위 1번
6. 아키텍처(백엔드 구조, 인증 방식 등)가 바뀌면 이 문서도 같이 갱신
