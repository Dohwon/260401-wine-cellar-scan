# Wine Cellar Scan 장기 플랜

작성일: 2026-04-05

이 문서는 `v1 종료`와 별개로 유지하는 장기 아이디어 및 사업 전략 문서다.

## 한 줄 결론

개인 와인 기록 앱으로는 경쟁이 강하므로, `OCR 기반 개인 셀러 기록 + 한국어 감상 정리 + 재구매/재음용 의사결정`에 좁게 집중하는 방향이 가장 현실적이다.

## 즉시 개선안

- 병 단위 수량 입력과 소비 차감 추가
- 와인 검색 실패 시 수동 등록 UX 개선
- 최근 마신 와인 기준 재구매 후보 섹션 추가
- OCR 실패 케이스 로그 수집과 재현 샘플 정리

## 확장 아이디어

- 보관 위치, 선반, 박스 단위 셀러 맵
- 빈티지별 비교 카드
- 음식 페어링 기록과 추천
- 한국어 시음 노트를 한 줄 요약, 선물 추천, 구매 메모로 변환
- 영수증 인식 기반 자동 입고
- 가격 추적과 마실 시점 알림

## 실험 제안

- `재구매 의사결정 카드`가 기록 저장률을 높이는지 A/B 테스트
- 자유 시음 노트 대신 `향 / 바디 / 산도 / 재구매` 구조 입력이 재방문율을 높이는지 비교
- OCR 직후 후보 3개 노출 vs 1개 추천 + 수정 버튼 방식 비교
- 샘플 셀러 데이터를 기본 제공할 때 첫 실행 완료율이 오르는지 확인

## 우선순위

1. `병 수량 + 소비 흐름`
근거: 셀러 앱으로서 반복 사용 이유를 만드는 핵심 기능이다.

2. `재구매 / 다시 마실지 판단 보조`
근거: 단순 기록보다 사용자 효용이 더 직접적이다.

3. `OCR 정확도와 예외 처리`
근거: 온보딩 첫 경험 품질이 전체 신뢰를 좌우한다.

4. `가격 / 구매처 / 선물 맥락`
근거: 기록 앱을 실제 구매 의사결정 도구로 확장할 수 있다.

## SWOT 요약

| 구분 | 내용 | 근거 또는 검증 계획 |
| --- | --- | --- |
| Strength | OCR로 기록 시작 장벽이 낮다 | v1 핵심 플로우 자체가 차별 포인트 |
| Strength | 개인 취향과 코멘트 중심으로 가볍다 | 전문가 DB보다 개인 회고형 사용에 적합 |
| Strength | 한국어 중심 UX 실험이 가능하다 | 글로벌 앱이 상대적으로 약한 영역 |
| Weakness | 카탈로그와 데이터 규모가 작다 | 공식 DB 연동 전까지 커버리지 한계 |
| Weakness | 병 단위 재고 관리가 없다 | 셀러 관리 앱으로서 반복성 부족 |
| Weakness | OCR 비용과 오인식 리스크가 있다 | 샘플 로그 축적 필요 |
| Opportunity | 한국어 와인 기록/회고 도구는 포지셔닝 여지가 있다 | 로컬 사용자 인터뷰 필요 |
| Opportunity | 재구매, 선물, 페어링 같은 실용 기능 확장 여지 | 실제 사용 빈도 측정 가능 |
| Opportunity | 개인 셀러를 콘텐츠화해 공유 포맷으로 확장 가능 | 공유 니즈 인터뷰 필요 |
| Threat | CellarTracker, Vivino, Delectable, Wine-Searcher가 이미 존재 | 하단 경쟁사 비교 참고 |
| Threat | 외부 데이터/API 의존 시 비용과 계약 리스크가 크다 | 상용 API 검토 필요 |
| Threat | 와인 기록은 사용 빈도가 낮을 수 있다 | 리텐션 실험 필수 |

## 경쟁사 비교

| 플레이어 | 분류 | 핵심 가치 | 가격/모델 | 시사점 |
| --- | --- | --- | --- | --- |
| CellarTracker | 직접 경쟁 | 셀러 관리, 커뮤니티 리뷰, 가치/음용창 추적 | 2025-12-16 기준 연간 USD 40부터, 셀러 규모별 구독 | 고급 셀러 관리에서는 강자라 정면승부보다 경량 개인 기록에 집중해야 함 |
| Vivino Premium | 직접 경쟁 | 라벨 스캔, 추천, 음식 페어링, 프리미엄 인사이트 | 2026-04 기준 미국 iOS/Android 월 USD 4.99, 연 USD 47.9 | 소비자용 발견/추천이 강해 구매 전후 의사결정 보조가 경쟁 포인트 |
| Delectable | 인접 경쟁 | 라벨 스캔, 소셜, 기록 | 무료 + 인앱결제 표기 | 커뮤니티/콘텐츠형 경험 참고 가능 |
| Wine-Searcher | 대체재 | 가격 비교, 구매 연결, 라벨 스캔 | 무료 + PRO 인앱결제, App Store 기준 월/연 플랜 노출 | 거래/가격 축으로 확장할 때 참고할 제품 |

## 수익화 제안

1순위는 `개인 프리미엄 구독`이다.

- 무료: 기록 저장, 기본 OCR, 기본 셀러 카드
- 유료: 재구매 추천, 가격 추적, 마실 시점 알림, 고급 인사이트, 무제한 OCR 히스토리

차선책은 `와인샵 / 수입사용 B2B 경량 SaaS`다.

- 매장 직원 시음 기록
- 입고 와인 내부 메모
- 추천용 셀러 큐레이션 카드

## 90일 실행안

### 1-4주

- 병 수량, 보관 위치, 소비 액션 추가
- OCR 실패 로그 수집
- 10명 내외 인터뷰로 실제 기록 습관 파악

### 5-8주

- 재구매 후보 / 다시 마실지 판단 카드 추가
- 가격, 구매처, 선물 메모 구조화
- 첫 기록 완료율, 2주 리텐션 측정

### 9-12주

- 프리미엄 후보 기능 1개 실험
- 장바구니가 아니라 `다음에 살 와인` 큐레이션 추가
- 소규모 유료 의향 조사

## 의사결정 포인트

- 이 제품을 `전문 셀러 관리`로 갈지 `개인 기록/회고`로 갈지 먼저 고정해야 한다.
- OCR 비용을 감수할 만큼 기록 입력 장벽 절감 효과가 있는지 확인해야 한다.
- B2C 개인 구독과 B2B 기록 툴 중 어느 쪽이 더 빠르게 검증 가능한지 정해야 한다.

## 참고 소스

- CellarTracker Subscription: https://support.cellartracker.com/article/80-cellartracker-subscription
- CellarTracker 공식 사이트: https://www.cellartracker.com/
- CellarTracker 모바일 소개: https://mobileapp.cellartracker.com/
- Vivino Premium: https://www.vivino.com/US/en/premium
- Vivino Pricing Guide: https://www.vivino.com/US/en/articles/premium-pricing-guide-en
- Delectable iOS App Store: https://apps.apple.com/us/app/delectable-scan-rate-wine/id512106648
- Wine-Searcher App Store: https://apps.apple.com/us/app/wine-searcher/id599836194

## HANDOFF_PACKET

[HANDOFF_PACKET]
stage: goal_shaping
status: READY_FOR_NEXT
owner: startup-business-strategist-ko
next_owner: multi-agent-manager-ko
reentry_owner: startup-business-strategist-ko
goal: Wine Cellar Scan v1 종료 후 장기 제품 전략을 문서로 남긴다
mvp: v1 종료와 분리된 장기 아이디어 및 사업 전략 문서 1개
success_metrics:
  - 장기 기능 우선순위가 문서로 고정된다
  - 경쟁사와 수익화 가설이 최소 수준으로 정리된다
stop_condition: v1 범위를 넘는 구현 작업은 시작하지 않는다
deliverables:
  - docs/long-term-plan-ko.md
  - 장기 우선순위와 90일 실험안
blocking_issues:
  - none
qa_focus:
  - v1 종료 범위와 장기 확장 범위를 혼동하지 않았는지 확인
  - 최신성 있는 경쟁사 정보는 출처와 날짜 맥락을 확인
loop_reason: none
next_action: 장기 문서는 유지하되 v1 운영은 종료 상태로 취급한다
next_prompt: |
  <multi-agent-manager-ko>
  현재 stage: goal_shaping
  목표: v1 종료 이후 장기 제품 전략을 별도 문서로 유지한다.
  입력 산출물: docs/long-term-plan-ko.md
  반드시 할 일: v1 종료 범위와 장기 확장 범위를 분리해 관리한다.
  완료 후 HANDOFF_PACKET으로 다음 단계에 넘겨라.
[/HANDOFF_PACKET]
