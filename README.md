# Wine Cellar Scan

와인 병 사진 1장을 업로드하면 라벨 텍스트를 OCR로 읽고, 가장 가까운 와인을 후보로 매칭한 뒤 개인 셀러 기록으로 저장하는 웹 앱입니다.

이 저장소는 `v1 종료 상태` 기준으로 정리되어 있으며, 장기 확장 아이디어와 사업 전략은 별도 문서로 분리해 두었습니다.

## 주요 기능

- 와인 라벨 사진 업로드
- OpenAI 기반 OCR 및 메타데이터 추출
- `producer`, `wine name`, `vintage`, `region`, `grape variety` 기반 후보 매칭
- 저장 전 수동 확인
- 개인 시음 노트와 0.5점 단위 평점 기록
- 당도 / 드라이 성향 입력
- `또 먹을 와인`, `다시 안 먹을 와인` 분류
- 와인별 셀러 카드 집계
- `ABC`, `latest`, `oldest`, `most consumed` 정렬
- 5개 단위 페이지네이션
- Taste map / 국가 선호도 인사이트
- 일부 와인에 대해 업로드 사진 대신 실제 라벨 이미지 고정 표시

## 기술 스택

- Vanilla HTML / CSS / JavaScript
- Node.js HTTP 서버
- OpenAI Responses API
- 로컬 JSON 기반 데이터 저장

## 빠른 시작

1. 저장소를 클론합니다.
2. 의존성을 설치합니다.
3. `.env.example`을 복사해 `.env`를 만듭니다.
4. 본인 OpenAI API 키를 직접 넣습니다.
5. 서버를 실행합니다.

```bash
git clone git@github.com:Dohwon/wine-cellar-scan.git
cd wine-cellar-scan
npm install
cp .env.example .env
npm start
```

브라우저에서 `http://127.0.0.1:4321`을 열면 됩니다.

## API 키 설정

이 프로젝트는 저장소에 실제 API 키를 포함하지 않습니다.

반드시 본인 키로만 설정하세요.

1. 루트에 `.env` 파일을 만듭니다.
2. 아래처럼 `OPENAI_API_KEY` 값을 직접 넣습니다.

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

권장 방식은 `.env.example`을 복사한 뒤 수정하는 것입니다.

```bash
cp .env.example .env
```

중요:

- `.env`는 이미 `.gitignore`에 포함되어 있어 Git에 올라가지 않습니다.
- 본인 키가 들어간 `.env`를 절대 커밋하지 마세요.
- 다른 사람이 이 저장소를 클론해도 자동으로 OCR이 동작하지 않습니다. 각자 자신의 키를 넣어야만 live OCR이 동작합니다.
- `OPENAI_API_KEY`가 없으면 앱은 simulation 모드로 동작합니다.

## 환경 변수

필수:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

선택:

```bash
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
PORT=4321
GOOGLE_SEARCH_API_KEY=your_google_custom_search_api_key
GOOGLE_SEARCH_CX=your_google_custom_search_engine_id
```

## 데이터 저장 방식

- 로컬 개발에서는 `data/` 아래 JSON 파일을 사용합니다.
- 런타임에서 `/data` 디렉터리가 있으면 그 경로를 우선 사용합니다.
- 최초 실행 시 기본 샘플 기록은 `data/default-cellar-records.json`에서 복제됩니다.
- 기본 고정 라벨 이미지는 `data/default-wine-labels.json`으로 관리합니다.

## 주요 데이터 파일

- `data/wine-catalog.json`: 로컬 시드 카탈로그
- `data/default-cellar-records.json`: 기본 샘플 시음 기록
- `data/default-wine-labels.json`: 기본 라벨 이미지 매핑
- `data/cellar-records.json`: 런타임 시음 기록
- `data/wine-labels.json`: 런타임 라벨 이미지 저장
- `data/external-catalog-cache.json`: 외부 검색 기반 캐시

## 배포 메모

- 지금 구조는 MVP 수준의 JSON 저장 방식입니다.
- Railway 같은 환경에서는 `/data` 볼륨을 마운트해서 런타임 데이터를 분리하는 편이 안전합니다.
- 장기적으로는 사용자 계정, 병 단위 재고, OCR 비용 관리까지 고려하면 DB 전환이 맞습니다.

## 문서

- `v1 종료 메모`: [docs/v1-closeout-ko.md](docs/v1-closeout-ko.md)
- `장기 아이디어 / 사업 전략`: [docs/long-term-plan-ko.md](docs/long-term-plan-ko.md)

## 참고

- Wine-Searcher 같은 상용 와인 데이터 제공자는 별도 상업용 API 계약이 필요할 수 있습니다.
- 공개 저장소에서는 API 키, 개인 시음 원본 이미지, 비공개 운영 키를 절대 포함하지 않는 운영을 전제로 합니다.
