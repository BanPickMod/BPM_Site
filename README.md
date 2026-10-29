# BPM_Site

StarCraft II: BanPickMod(BPM)의 공식 정보·리플레이 사이트입니다. Next.js(App Router) + TypeScript이고 한국어(`/ko`)와 영어(`/en`)를 함께 제공합니다. 앞으로의 계획과 남은 일은 저장소 바깥 `BanPickMod2/docs/BPM_Site_앞으로의_계획.md`에 모아 두었습니다.

> 이 프로젝트는 일반적인 Next.js와 다른 점이 있습니다. 코드를 쓰기 전에 `node_modules/next/dist/docs/`를 먼저 읽으세요([AGENTS.md](AGENTS.md)). 예: 미들웨어 대신 `proxy.ts`를 씁니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 정적 페이지 생성
```

검증 (변경 후 모두 통과해야 합니다):

```bash
npm run typecheck      # next typegen 후 tsc
npm run lint
npm run validate:data  # 생성 데이터, 패치노트 ko/en 구조, 미디어 슬롯 검사
```

## 구조

| 경로 | 내용 |
|---|---|
| `app/[lang]/` | 페이지: 홈, guide, wiki, patches, ai, replay-analysis, events, ladder, account, device, privacy, feedback, admin |
| `app/site.css` | 디자인 시스템(토큰, 다크/라이트, 공용 클래스) |
| `components/` | `shell`, `wiki`, `guide`, `patches`, 인증·리플레이·2D/3D 뷰어, `MediaSlot` |
| `lib/i18n/` | 언어 설정과 공용 문구 사전 |
| `lib/wiki.ts`, `lib/data.ts` | 위키 데이터 타입과 표시 보조 함수 |
| `content/patches/<버전>/{ko,en}.md` | 패치노트(Markdown) |
| `content/media/slots.json` | 미디어 슬롯 목록(촬영 안내 포함) |
| `data/generated/` | 위키·사이트 데이터(`build:data`가 생성, 직접 수정 금지) |
| `scripts/wiki/` | 위키 데이터 파이프라인 |
| `lib/server/`, `app/api/` | 인증·동의·업로드·워커·공개·통계·계정·문의 API |
| `worker/` | Python 리플레이 분석 워커 |
| `uploader/` | Windows 트레이 업로더와 개발용 CLI |

## 개인정보 처리방침 운영값

`/[lang]/privacy`와 `/[lang]/terms`는 코드의 실제 처리 방식에 맞춘 초안입니다. 아래 환경 변수가 비어 있으면 페이지에 대괄호 자리표시가 보여 초안임을 명확히 표시합니다. 공개 전에 실제 값으로 설정하고 전문가 검토를 받아야 합니다.

| 환경 변수 | 내용 |
|---|---|
| `SESSION_SECRET` | 32자 이상 비밀. 세션 서명 키와 신고 횟수 제한 키가 여기서 용도별로 파생된다. **바꾸면** 모든 사용자가 다시 로그인하고 신고 횟수 제한이 초기화된다(다른 데이터는 영향 없음). 유출이 의심되면 바꾼다 |
| `PRIVACY_OPERATOR_NAME` | 운영자·개인정보 보호책임자 이름 또는 명칭(한국어 페이지) |
| `PRIVACY_OPERATOR_NAME_EN` | 같은 명칭의 영어 표기. 비어 있으면 영어 페이지도 위 값을 쓴다 |
| `PRIVACY_CONTACT` | 개인정보·서비스 문의 연락처 |
| `PRIVACY_RAILWAY_REGION` | 실제 Railway 서비스·DB 처리 국가/리전 |
| `PRIVACY_R2_LOCATION` | 실제 R2 버킷 위치·관할 |
| `PRIVACY_REPLAY_RETENTION` | 리플레이 자동 최대 보관기간 |
| `PRIVACY_FEEDBACK_RETENTION` | 민원·버그 신고 처리 후 보관기간(처리방침에 표시) |
| `ADMIN_TOKENS` | 운영자별 이름 붙은 토큰: `이름:역할:토큰,이름:역할:토큰`. 역할은 `readonly`(목록만), `moderator`(스크린샷·결정), `owner`(전부, 보관 배치, 감사 기록). 이름은 소문자·숫자·`_`·`-`, 토큰은 16자 이상. 사람이 그만두면 그 항목을 지우고 배포한다 |
| `ADMIN_TOKEN` | 예전 단일 토큰. 있으면 이름 `admin`, 역할 `owner`인 운영자 하나로 취급한다(`ADMIN_TOKENS`와 함께 둘 수 있다) |
| `TRUSTED_PROXY_HOPS` | 사이트 앞에 있는 프록시 수(Railway 단독이면 1, 앞에 Cloudflare 등이 하나 더 있으면 2). 신고·문의의 횟수 제한이 `X-Forwarded-For`의 오른쪽에서 이 개수만큼 떨어진 값(신뢰할 수 있는 위치)을 보낸 사람의 주소로 쓴다. 왼쪽 값은 보내는 사람이 정하므로 쓰지 않는다. 0이면 헤더를 믿지 않고 모두 한 칸을 공유한다. **배포 전에 실제 프록시 수와 맞는지 확인**(틀리면 모든 사용자가 한 칸을 공유하거나 제한이 약해진다) |
| `LEDGER_RETENTION_DAYS` | 삭제 원장 파일(DB 복원 뒤 삭제·철회를 다시 적용하는 기록) 보관 일수(기본 90). **DB 백업 보관일보다 길어야 한다.** |
| `PRIVACY_REQUEST_DAYS` | 개인정보 요청(열람·정정·삭제 등)에 답해야 하는 기한 일수(기본 10). 수신함에 답변 기한과 기한 초과가 표시된다. 법정 기한은 운영자가 확인해 이 값을 정한다 |
| `AUDIT_RETENTION_DAYS` | 운영자 작업 기록(`admin_audit`) 보관 일수(기본 365) |
| `SOURCE_READY_MAX_DAYS` | 분석·평가가 끝나지 않은 원본 리플레이를 분석 후 최대 며칠 보관할지(기본 7). 끝난 원본은 즉시 삭제된다. 이 외에 `SOURCE_FAILED_MAX_DAYS`(7), `SOURCE_UNSUPPORTED_MAX_DAYS`(30), `SOURCE_STUCK_MAX_DAYS`(14), `LINK_RETENTION_DAYS`(30)가 있다 |
| `FEEDBACK_RETENTION_DAYS` | 종결된 문의를 실제로 삭제하는 기준 일수(기본 365). 위 표시값과 같게 둔다. `POST /api/admin/maintenance/retention`(원본 리플레이·종결 문의·만료 연결 요청을 함께 정리)을 하루 한 번 호출해야 적용된다. 예약 실행용 스크립트는 `scripts/ops/run-retention.mjs`(`--delete`를 주면 삭제, 없으면 dry-run). 실패·포기한 삭제가 있으면 종료 코드 1 |

최초 로그인은 만 14세 이상 자기확인을 요구하고 확인 시각만 저장합니다. C1~C3는 별도의 선택 동의이며 기본 서비스용 Battle.net 식별자·표시 이름 처리는 체크박스가 아닌 고지로 표시합니다.

## 패치노트 쓰기

`content/patches/<버전>/ko.md`와 `en.md`를 만듭니다. 맨 위에 `version`, `date`, `title`, `summary`를 적고(날짜 미정이면 `null`), 두 언어의 `##` 제목 수와 이미지 수를 같게 맞춥니다(`validate:data`가 검사). 이미지나 영상 자리는 `![설명](media:슬롯id)`로 씁니다. 이미지가 하나라도 있는 패치노트는 미디어를 글 옆에 놓는 배치, 없으면 목차 + 넓은 본문 배치로 자동 선택됩니다.

## 미디어 넣기

1. `content/media/slots.json`에 슬롯을 등록합니다(없는 슬롯 id를 쓰면 검증이 실패합니다).
2. 파일을 `public/media/<슬롯id>.png|jpg|webp|gif|mp4|webm`로 넣습니다. 영어 화면용은 `.en.`, 영상 포스터는 `.poster.`를 붙이고, 같은 이름의 `.json`으로 설명 문구나 `{"youtube": "영상ID"}`를 지정합니다.
3. `npm run media:report`가 `docs/media-slots.md`에 채움 현황을 만듭니다(파일은 이 명령이 만들며 저장소에는 두지 않습니다).

파일이 없는 슬롯은 공개 빌드에서 아무것도 그리지 않고, 개발 서버에서만 점선 자리표시가 보입니다. 패치마다 `<버전>-cover` 슬롯을 등록하면 제목 오른쪽에 대표 이미지가 붙습니다.

## 위키 데이터

모드 수치를 바꾸거나 새 버전을 낼 때의 순서입니다.

1. 모드 XML 스냅샷: `node scripts/wiki/extract-release.js v2.0` (`release/bpm-modules`에서 추출).
2. 실제 게임 값 덤프(현재 버전의 기준): `bpm-ai-engine`에서 `scripts/wiki_live_dump.py --names scripts/wiki/live/names.json --out scripts/wiki/live/live-v2.0.json`(SC2를 한 판 띄웁니다).
3. `npm run build:data`로 `data/generated/`를 다시 만듭니다.
4. `node scripts/wiki/audit-live.js`로 위키와 게임 값이 일치하는지, `node scripts/wiki/audit-curated.js`로 수동 정리 값과 비교합니다.

사람이 쓰는 값은 `scripts/wiki/curated/`에 있습니다.

- `unit-notes.json`: BPM 유닛 17종의 역할 설명과 생산 건물(한/영). 숫자를 쓰면 빌드가 실패합니다. 수치는 표에서만 나옵니다.
- `upgrade-meta.json`: 연구 업그레이드가 어느 유닛에 속하는지, 아이콘, 영어 이름과 효과. 비용, 연구 시간, 한국어 이름과 효과는 모드(`extract-upgrades.js`)에서 읽으며, 모드에 새 BPM 업그레이드를 추가하고 이 파일에 빠뜨리면 빌드가 실패합니다.
- `known-changes.json`: 패치노트에 적힌 수치 변경(이전 값). 수치를 바꾸는 패치마다 한 줄씩 추가하고, 빌드가 "이후 값"을 데이터와 대조합니다.
- 그 밖의 `units.json`, `maps.json`, `tutorials.json`, `site_meta.json`.

값의 우선순위는 **실제 게임 값 > 모드 XML > 수동 정리 값**입니다.

이름은 게임에 보이는 것을 씁니다. 기본 유닛, 무기, 능력의 한국어 이름은 `base_balance_data_LOTV/koKR/S2Strings.xml`, BPM 유닛 이름은 모드의 `BPM_Pick_*` 문자열, BPM 무기는 `Weapon/Name/*`에서 읽습니다. 게임에 이름이 없는 무기와 영어 무기는 "지상 공격/Ground attack"처럼 표시합니다(영어 게임 문자열이 없습니다). 이전 버전은 파생값입니다. v2.0은 v1.4.3과 수치 변경이 없어(`docs/reports/v1.4.3_to_v2.0_value_diff.txt`) v1.4.3은 현재 값 그대로이고, v1.4.1은 v1.4.3 패치노트에 적힌 변경(`known-changes.json`)만 되돌려 만듭니다. 새 버전을 내면 그 버전의 `known-changes`를 추가하고 `build-wiki-data.js`의 파생 규칙을 확인하세요.

## 모드 쪽 규칙

게임 모드의 기준본은 저장소의 `release/bpm-modules/`입니다. 이 사이트 작업에서 모드 파일을 수정하지 않습니다([../AGENTS.md](../AGENTS.md)).
