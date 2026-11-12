# 손글씨 폰트용 글자 목록 만들기: 숫자·영문·기호 + 자주 쓰는 한글(빈도순)
import glob, collections, json
c = collections.Counter()
for f in glob.glob('*.html')+glob.glob('*.js')+glob.glob('*.gs')+['CLAUDE.md']:
    try: t = open(f, encoding='utf-8').read()
    except Exception: continue
    c.update(ch for ch in t if '가' <= ch <= '힣')
math_words = """따라서 그러므로 이므로 이다 입니다 대입 정리하면 구하면 양변 계수 근 판별식 최댓값 최솟값 꼭짓점 넓이 부피 길이
삼각형 사각형 직각 이등변 정삼각형 원 반지름 지름 중심 접선 접점 기울기 함수 그래프 교점 좌표 평면 평행이동 대칭이동 원점 축
집합 원소 부분집합 교집합 합집합 여집합 차집합 명제 조건 참 거짓 역 대우 필요 충분 부등식 방정식 해 실수 정수 자연수 유리수 무리수
양수 음수 분수 소수 곱 합 차 몫 나머지 인수분해 전개 다항식 항등식 복소수 허수 켤레 경우의 수 순열 조합 행렬 수열 등차 등비 공차 공비
극한 미분 적분 도함수 접선 증가 감소 극대 극소 확률 통계 평균 분산 지수 로그 밑 진수 삼각함수 사인 코사인 탄젠트 주기 범위 정의역 치역 공역
역함수 합성함수 일대일 대응 유리함수 무리함수 점근선 꼴 식 값 답 풀이 문제 예제 유형 개념 공식 확인 검산 그림 같다 같으므로 아니다 없다 있다
만족 성립 모든 어떤 적어도 하나 둘 셋 넷 다섯 번째 이상 이하 초과 미만 사이 최대 최소 크다 작다 같거나 서로 다른 두 세 각각 처음 마지막
선분 직선 반직선 거리 중점 수직 이등분선 외심 내심 무게중심 넓이 비 비율 닮음 피타고라스 정리 단계 먼저 다음 그러면 즉 또한 그리고 하지만 왜냐하면""" 
for ch in math_words:
    if '가' <= ch <= '힣': c[ch] += 1000  # 수학 풀이 단어는 앞쪽으로
hangul = [ch for ch, _ in c.most_common(720)]
digits = list('0123456789')
lower = list('abcdefghijklmnopqrstuvwxyz')
upper = list('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
syms = list('+-×÷=≠<>≤≥()[]{}/.,?!√π²³^\':;~%∴∵θαβ∠△□○✓→⇒±∞|·_') + ['-']
seen=set(); allc=[]
for ch in digits+lower+upper+syms+hangul:
    if ch not in seen: seen.add(ch); allc.append(ch)
json.dump(allc, open('손글씨폰트/charset.json','w',encoding='utf-8'), ensure_ascii=False)
print(len(allc), 'chars; hangul', len(hangul))
