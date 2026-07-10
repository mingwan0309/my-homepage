# 김민관 수학 홈페이지 프로젝트

## 프로젝트 목적
수학 학원(김민관 수학) 운영용 웹사이트. 선생님 1명(사용자 본인)과 학생들이 사용한다.
- 프론트엔드: 이 폴더의 HTML 파일들 → GitHub Pages로 배포 (https://mingwan0309.github.io/my-homepage/)
- 백엔드: Google Apps Script + Google 스프레드시트 (Code.gs가 사본)

## 사용자에 대해
- 비개발자. 코드를 직접 수정할 수 없다.
- 설명은 코드 용어 최소화, 클릭 순서까지 단계별로 안내한다.
- Apps Script 수정이 필요하면 반드시 Code.gs **전체 파일**을 갱신해서 "전체 복사 → 붙여넣기" 가능하게 제공한다. 스니펫만 주지 않는다.
- 반말/짧은 요청이 많다. 스크린샷으로 문제를 보여주는 경우가 많으니 스크린샷을 꼼꼼히 확인한다.

## 배포 절차 (하드 룰)
1. HTML/JS 수정 → 확인 요청 없이 바로 `git add` → `git commit` → `git push` 한다.
2. push 후 사용자에게 "1~2분 후 Ctrl+Shift+R(강력 새로고침)로 확인하세요"를 안내한다.
3. Code.gs를 수정한 경우 **반드시** 아래를 안내한다 (이걸 빼먹어서 반영 안 된 사고가 2번 있었다):
   - Apps Script에 전체 붙여넣기 → 저장
   - 배포 → 배포 관리 → 연필(✏️) → 버전을 **"새 버전"으로 선택** → 배포
   - "새 버전" 선택 없이는 코드가 반영되지 않는다.
4. 커밋 메시지는 한국어로 "기능 - 변경 요약" 형식.

## 파일 지도
| 파일 | 역할 |
|---|---|
| index.html | 메인 홈 |
| admin.html | 선생님 관리 페이지 (반/학생/데일리퀴즈/클리닉/공지/질의응답/영상 라이브러리/관리자) |
| class.html | 반 상세 (차시, 수강생 목록, 강의 자료실) |
| session.html | 차시별 출석/성적 관리 — **학생 접근 차단됨** (student면 homework.html로 리다이렉트) |
| homework.html | 데일리 퀴즈 (학생용) |
| clinic.html | 클리닉 신청 |
| qna.html | 질의응답 |
| Code.gs | Apps Script 백엔드 전체 사본. 수정 시 항상 이 파일을 갱신하고 전체를 제공 |

## 백엔드 구조 (Google 스프레드시트 시트별 컬럼)
- `students`: id, password, role(teacher/student), name, parentPhone, school, classId
- `classes`: id, name, time, startDate, endDate, status
- `sessions`: id, classId, sessionNum, date
- `attendance`: id, sessionId, studentId, status, memo
- `scores`: id, sessionId, studentId, examId, score, pass, feedback
- `exams`: id, sessionId, name, createdAt
- `materials`: id, classId, category, name, url, size, uploadDate, downloadCount, memo
- `video_library`: id, name, url, memo, createdAt, subject, type
- `qna` / `qna_answers` / `reviews`: 질의응답, 후기

## 역할별 접근 규칙 (하드 룰)
- 로그인 세션은 localStorage `mkmath_session`에 저장 (role, name, classId 포함).
- **학생(student)은:**
  - session.html 접근 불가 (자동 리다이렉트)
  - class.html에서 자기 자신의 행만, 출결 결과만 읽기 전용으로 봄
  - homework/clinic/qna/class 페이지 상단에 학생 네비바 표시 (🏠 홈 / 📝 데일리 퀴즈 / 🏥 클리닉 신청 / 💬 질의응답 / 📚 내 반) — 드롭다운 아님, 평면 나열
- **선생님(teacher)은:** 학생 네비바 대신 "관리 페이지" 버튼 표시.

## 영상 시스템 (하드 룰)
- 영상 등록 흐름: 관리 페이지 > 🎬 영상(라이브러리)에 등록 → 각 반 자료실에서 "기존 영상에서 가져오기"로 선택.
- 라이브러리 분류: 과목(공통수학1/공통수학2/대수/미적분1/미적분2/기하/확률과통계) + 유형(개념강의/문제풀이강의).
- YouTube 재생은 유튜브로 이동하지 않고 **자체 모달**에서 iframe으로 재생:
  - `modestbranding=1&rel=0` 파라미터 사용
  - 하단 오버레이 div로 YouTube 로고 가림 (pointer-events:none)
  - iframe의 allowfullscreen 제거, 커스텀 ⛶ 버튼으로 wrapper div를 requestFullscreen (로고 가림 유지 목적)
  - 이 구조는 class.html의 openVideo/closeYtModal/toggleYtFullscreen 함수. 다른 페이지에 영상 재생 추가 시 동일 구조 재사용.

## 하지 말 것
- Code.gs 스니펫만 제공하기 (항상 전체 파일)
- Apps Script 재배포 시 "새 버전" 안내 빼먹기
- 학생 화면에 다른 학생 정보 노출하기
- 영상을 유튜브 새 탭으로 열게 만들기
- 사용자에게 코드 직접 수정 요구하기

## 완료 판정 기준
1. git push 완료
2. Code.gs 변경 시 재배포("새 버전") 안내 완료
3. 사용자에게 확인 방법(어느 페이지, 어떤 버튼) 안내 완료
4. 사용자가 실제 화면에서 확인해줘야 최종 완료 — 스크린샷으로 문제 오면 그게 우선순위 1번
