# 김민관 수학 홈페이지 프로젝트

## 프로젝트 목적
수학 학원(김민관 수학) 운영용 웹사이트. 선생님 1명(사용자 본인, id: mingwan0309)과 학생들이 사용한다.
- 프론트엔드: 이 폴더의 HTML 파일들 → GitHub Pages로 배포 (https://mingwan0309.github.io/my-homepage/)
- 백엔드: **Firebase (Firestore + Authentication)**. Firebase 프로젝트명: `mkmath` (project id: `mkmath-54f5d`)
- Google Apps Script(Code.gs)는 **파일 업로드(구글 드라이브 저장) 용도로만** 남아있음. 그 외 모든 기능은 Firebase로 완전히 이전 완료 (2026-07-10).

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
| admin.html | 선생님 관리 페이지 (반/학생/데일리퀴즈/클리닉/공지/질의응답/영상 라이브러리/관리자) |
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
- `problems`: 데일리 퀴즈 문제 (title, content, image, solution, solutionImage, total)
- `clinics` / `clinic_bookings`: 클리닉 정보 및 예약
- `qna` / `qna_answers` / `reviews`: 질의응답, 후기

## 로그인 / 인증 (하드 룰 — 중요)
- **Firebase Authentication(이메일/비밀번호)** 사용. 실제 로그인 아이디는 전화번호 등 임의 문자열이라, `{아이디}@mkmath.local`이라는 가짜 이메일로 변환해서 Firebase Auth 계정을 만든다 (`toAuthEmail()`).
- Firebase는 비밀번호 6자 이상을 요구 → 6자 미만이면 `toAuthPassword()`가 뒤에 0을 붙여서 6자를 맞춘다. 로그인 시에도 같은 함수로 변환하므로 사용자는 원래 짧은 비번을 그대로 입력하면 된다.
- 학생 추가(`addStudent`) 시 Firestore 문서 저장 + **보조 Firebase 앱(`mk-secondary`)으로 Auth 계정도 자동 생성**한다 (선생님 세션이 끊기지 않도록 별도 앱 인스턴스 사용). 따라서 학생 추가는 관리 페이지에서 평소처럼만 하면 로그인 계정도 자동으로 생김 — 콘솔 작업 불필요.
- 교사(mingwan0309) 계정은 Firebase 콘솔 Authentication에서 **수동으로 생성**되어 있음 (최초 부트스트랩 시 자동 생성 로직은 제거됨 — 보안 규칙이 로그인 전 Firestore 읽기를 막아서 자동 부트스트랩이 불가능해졌기 때문).
- 계정 비활성화(`active:false`)는 로그인 자체를 막는다 (`fetchProfileAfterAuth`에서 체크). 완전 삭제 대신 이 방법으로 임시 잠금 가능.
- **학생 비밀번호를 선생님이 강제로 재설정하는 기능은 기술적으로 불가능** (Admin SDK/Cloud Functions 없이는 타인 비밀번호 변경 불가, 유료 Blaze 요금제 필요). 학생이 비번을 잊으면 계정 삭제 후 재등록이 유일한 방법. 학생 본인은 homework.html 설정 탭에서 직접 변경 가능.
- 학생 개별/엑셀 일괄 추가 시 **초기 비밀번호 기본값은 `123456`** (admin.html 개별 추가 입력창 기본값, 엑셀 양식 예시값, 엑셀 업로드 시 3번째 칸 비었을 때의 기본값 전부 동일하게 맞춰져 있음).
- Firestore 보안 규칙 요약: `students`는 본인 또는 교사만 읽기/쓰기, 나머지 대부분은 로그인한 사람이면 읽기 가능하고 쓰기는 교사만 가능. `qna`의 "비밀글"은 클라이언트 단에서만 가려짐 (서버 강제 아님 — 알려진 한계).

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
- 성적 탭에 학생 체크박스 선택 + "💬 메시지 발송" 버튼 있음. 클릭하면 메시지 작성 모달(카카오톡 문구 작성): 시험/과제 중 데이터 기준 선택 → {이름}/{출결}/{점수}/{등급}/{등수}/{평균}/{최고점}/{통과여부}/{피드백}/{상태}/{코멘트} 같은 토큰 버튼으로 문구 삽입 → 학생별로 토큰이 실제 데이터로 치환된 미리보기 + "복사" 버튼 제공.
  - **중요: 실제 카카오톡/문자 자동 발송 기능은 아직 연결 안 됨** (유료 카카오 알림톡 API 필요, 비용 발생하므로 사용자 승인 없이 구현 금지). 지금은 학생별 문구를 만들어 복사해서 수동으로 보내는 용도까지만 완성.
- 과제 탭은 시험 탭과 완전히 동일한 목록/상세 구조(목록 카드 + "+ 과제 추가" + 클릭 시 상세에서 이름/날짜 수정·삭제). `homeworks`/`hw_status` 컬렉션 별도 사용.
- 과제의 실제 결과는 **과제 탭이 아니라 성적 탭 표**에 시험 칼럼 오른쪽으로 붙어서 표시됨. 셀 클릭 시 시험과 별개의 패널(hw-panel)에서 **완료/일부미이행/미이행/미제출 4단계**(점수 입력 없음) + 코멘트 입력. 상태 선택 시 코멘트가 비어있으면 상태별 안내 문구가 자동으로 채워짐(교사가 수정 가능). 시험 성적(pass 필드)은 통과/미통과 2단계 그대로 유지 — 용어를 혼동하지 말 것.

## 영상 시스템 (하드 룰)
- 두 갈래: (1) 반 자료실용 `video_library` (과목+유형 분류), (2) 부교재 해설 강의용 `textbook_videos` (학년→과목→교재 3단계).
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
