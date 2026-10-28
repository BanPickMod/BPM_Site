# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
BanPickMod(BPM) 사용자 전반: StarCraft II 1v1 플레이어, 대회 운영자(심판·옵저버 포함), 밸런스 패치를 확인하려는 모드 커뮤니티. 기본 사용법을 익히고, 버전별 패치노트와 전체 밸런스 내역을 확인하는 것이 핵심 작업이다. 한국어와 영어 모두 제공해야 한다(영어 지원 필수).

## Product Purpose
BPM 모드의 공식 정보·리플레이 서비스. 사용자가 (1) 기본 사용법, (2) 버전별 패치노트, (3) 수치 정보를 빠짐없이 담은 전체 밸런스 내역을 확인하고, (4) 동의한 리플레이를 자동 업로드해 밴픽·경기 흐름을 분석·재생할 수 있게 한다. 성공은 사용자와 대회 운영자가 게임을 열지 않고도 정확한 규칙·수치·변경 이력을 확인하고, 한 경기를 밴픽부터 결과까지 되짚을 수 있는 것이다. 현재 구현 상태의 기준은 [`docs/Implementation_Status.md`](docs/Implementation_Status.md)다.

## Positioning
BPM의 차별점은 SC2 맵 내부에서 진행되는 밴픽이다. 사이트는 이 모드의 규칙과 밸런스에 대한 단일 참조 출처가 된다.

## Operating Context
BPM_Site는 Next.js(App Router) 기반 사이트이며 `/ko`, `/en` 라우팅을 쓴다. 홈, guide, wiki, patches, ai, replay-analysis, events, ladder와 계정·기기 연결·개인정보·문의 화면이 있다. Replay Analysis에는 내 리플레이, 공개 리플레이, 커뮤니티 통계, 2D/3D 타임라인 뷰어가 구현되어 있으나 랜딩과 배포 경로는 아직 공개 준비 상태다. 래더는 보류 상태다. 패치노트는 `content/patches/<버전>/{ko,en}.md`, 위키 데이터는 `scripts/wiki/build-wiki-data.js`가 만드는 `data/generated/`, 미디어는 `public/media/`와 `content/media/slots.json`에서 온다. v2.0의 수치는 실제 게임에서 읽은 값(`scripts/wiki/live/`)이 기준이다. 자세한 개발 방법은 `README.md`.

## Capabilities and Constraints
- 현재 정보 사이트 범위: 가이드(로비 설정기·드래프트 체험), 패치노트, 전체 밸런스·유닛 위키, AI 소개, 이벤트 안내.
- 현재 리플레이 서비스 범위: Battle.net OAuth 코드, 기기 연결, C1~C3 동의, 자동 업로더, 비동기 분석 워커, 내·공개 리플레이, 2D/3D 재생, 커뮤니티 밴픽 통계, 신고·계정 관리.
- 부분 구현 또는 운영 검증 필요: Battle.net 운영 로그인, Railway·Postgres·R2 종단 배포, 업로더 설치·HTTPS 업데이트, 정식 개인정보 안내.
- 아직 없음: AI의 밴픽·플레이 평가, AI 실전 통계 연결, 내 플레이어 식별, Challenge 자동 판정, BPM 래더.
- **업로더는 v2.0 Replay Analysis 서비스용으로 소개한다.** 설치·업데이트의 운영 검증과 실제 다운로드 경로가 준비되기 전에는 다운로드 링크를 열지 않는다.
- 한국어/영어 이중 언어 필수. 수치·용어는 두 언어에서 동일한 정확도를 유지한다.
- 밸런스 수치는 누락 없이 표시되어야 하며, 요약 때문에 값이 사라지면 안 된다.
- 미정: 래더·대회의 데이터 소스와 제공 시점, 도메인/배포 대상, 라이선스.

## Evidence on Hand
`BPM_Site/content/patches/`, `BPM_Site/scripts/wiki/`(수동 정리 값과 게임 덤프), `BPM_Site/docs/`(BPM_Platform_Plan, AI_System_Improvement_Plan), 저장소 `docs/patch notes/`와 v1.4.3·v1.5 문서. 실제 래더 순위, 대회 결과, 사용자 후기, 사용자 수 등은 없으므로 만들어 내지 않는다.

## Product Principles
1. 정확성 우선: 수치와 변경 이력은 완전하고 출처와 일치해야 한다.
2. 찾기 쉬움: 운영자와 플레이어가 버전·유닛·수치를 빠르게 찾을 수 있어야 한다.
3. 처음부터 이중 언어: 영어는 번역 후속 작업이 아니라 기본 요구사항이다.
4. 확장 가능한 구조: 래더·대회가 추가되어도 기존 위키·패치 구조가 깨지지 않는다.
5. 코드 구현과 운영 공개를 구분한다: 구현된 기능도 외부 서비스·배포 검증 전에는 공개 완료로 표현하지 않고, 아직 없는 AI 평가·Challenge·래더의 날짜를 단정하지 않는다.

## Accessibility & Inclusion
한국어·영어 사용자 모두를 위한 이중 언어 지원. 그 외 별도 표준은 확정되지 않음.
