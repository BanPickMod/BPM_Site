# 콜로세움 리플레이 수집·공개 (Phase 0)

`BPM_Backend_Plan.md` Phase 0의 구현 설명서입니다. 로그인 없이, 운영자가 AI 대 AI 리플레이를 올려 공개하는 최소 경로입니다.

## 동작 요약

```text
AI 경기 하네스 ── <이름>.SC2Replay + <이름>.json ──▶ upload.mjs ──▶ POST /api/admin/games (ADMIN_TOKEN)
                                                                       │ 검증·해시·저장
                                                  Postgres(메타) + 스토리지(원본, 비공개) ◀┘
공개: /{ko|en}/events/colosseum-1            목록·매치업 필터·순위
      /{ko|en}/events/colosseum-1/games/{id} 선수·밴픽·주요 교전
      /api/games/{id}/replay                 원본 다운로드 (공개 시각이 지난 AI_EVENT 경기만)
```

- 같은 경기(`event + seriesKey + gameNo`)를 다시 올리면 메타데이터와 리플레이 파일이 **교체**됩니다(실수 정정용). 응답은 처음이면 201, 교체면 200.
- 같은 리플레이 파일이 **다른 경기**로 올라오면 409로 거부합니다.
- `publishAt`이 미래인 경기는 목록·상세·다운로드 어디에서도 보이지 않습니다(404). 시각이 지나면 자동으로 공개됩니다. 이틀치를 미리 올려두고 예약 공개할 수 있습니다.
- 사용자 업로드(Phase 1)는 `source = 'AI_EVENT'`가 아니므로 이 다운로드 경로로는 절대 내려가지 않습니다.

## 매니페스트 (`<이름>.json`)

리플레이와 같은 폴더에 같은 이름으로 둡니다. 서버는 리플레이를 파싱하지 않고 이 JSON을 신뢰합니다(관리자 전용 엔드포인트이므로). **AI 경기 하네스가 이 파일을 경기마다 써야 합니다.**

```json
{
  "event": "colosseum-1",
  "round": 1,
  "seriesKey": "tvz-r1-personaA-personaB",
  "gameNo": 1,
  "map": "맵 이름",
  "banMode": "snake",
  "banCount": 3,
  "modVersion": "2.0",
  "balanceVersion": "2.0",
  "playedAt": "2026-10-31T15:10:00Z",
  "durationSec": 812,
  "publishAt": "2026-10-31T15:00:00Z",
  "players": [
    { "slot": 1, "name": "Persona-A", "race": "terran", "persona": "Macro", "modelVersion": "r16", "result": "win" },
    { "slot": 2, "name": "Persona-B", "race": "zerg",   "persona": "Rush",  "modelVersion": "r16", "result": "loss" }
  ],
  "draft": [
    { "seq": 0, "slot": 1, "action": "BAN",  "unitId": "Thor" },
    { "seq": 1, "slot": 2, "action": "BAN",  "unitId": "Ultralisk" },
    { "seq": 2, "slot": 1, "action": "PICK", "unitId": "Cyclone" },
    { "seq": 3, "slot": 2, "action": "REPLACE", "unitId": "Roach", "replacesUnitId": "Zergling" }
  ],
  "summary": { "battles": [{ "atSec": 312, "label": "3멀티 앞 교전" }] }
}
```

| 필드 | 규칙 |
|---|---|
| `event` | 서버에 등록된 이벤트 슬러그. `colosseum-1`은 자동으로 만들어져 있음 |
| `seriesKey` | Bo3 한 시리즈의 모든 경기가 **같은 값**. 순위 계산이 이 값으로 묶음 |
| `gameNo` | 시리즈 내 1~9 |
| `players` | 정확히 2명, `slot` 1과 2, 승자는 정확히 1명. **매치업은 slot 1, 2의 종족 순서로 자동 결정** (`TvZ`, `PvP` 등) |
| `name` | 순위 집계 키. 같은 AI는 모든 경기에서 같은 이름을 써야 함 |
| `draft[].action` | `BAN` / `PICK` / `REPLACE` (`REPLACE`는 `replacesUnitId` 필수) |
| `publishAt` | 생략하면 즉시 공개. KST 자정 = `...T15:00:00Z` (전날) |
| `summary.battles` | 선택. 주어지면 상세 페이지의 "주요 교전"에 표시 |

순위: 매치업별로 시리즈 승(먼저 2승) → 게임 득실 순으로 정렬합니다. 진행 중인 시리즈는 게임 승패에만 반영됩니다.

## 업로드

```powershell
$env:ADMIN_TOKEN = "<서버와 같은 토큰>"
node scripts/colosseum/upload.mjs D:\replays\colosseum-1 --url https://<사이트> --dry-run   # 먼저 확인
node scripts/colosseum/upload.mjs D:\replays\colosseum-1 --url https://<사이트>
```

폴더를 재귀로 훑어 `.SC2Replay`마다 같은 이름의 `.json`을 찾습니다. 매니페스트가 없거나 검증에 실패한 파일은 사유를 출력하고 건너뛰며(종료 코드 1), 나머지는 계속 올립니다. 몇 번 실행해도 안전합니다.

잘못 올린 경기는 `DELETE /api/admin/games/{id}`(같은 Bearer 토큰)로 지웁니다.

## 하네스 연결 (`bpm-ai-engine`)

자가대전 결과를 매니페스트로 바꾸는 스크립트는 `bpm-ai-engine/scripts/colosseum_export.py`입니다.

```text
run_selfplay.py ──▶ runs/selfplay/<game_id>.json + <replays>/sp_*.SC2Replay
colosseum_export.py --schedule 일정.json --out <폴더> --replays <replays> ──▶ <seriesKey>-g<n>.SC2Replay + .json
upload.mjs <폴더> --url <사이트>
```

일정 파일(어느 경기가 몇 라운드, 어느 시리즈의 몇 번째 게임인지, AI 표시 이름)은 사람이나 리그 스케줄러가 만들어 줍니다. 하네스는 한 경기씩 돌 뿐 리그·시리즈 개념이 없기 때문입니다.

```json
{ "defaults": { "event": "colosseum-1", "modVersion": "2.0", "balanceVersion": "2.0", "publishAt": "2026-10-31T15:00:00Z" },
  "games": [ { "game": "sp-11v12-1791543314", "round": 1, "seriesKey": "tvt-r1-macro-rush", "gameNo": 1, "nameA": "Macro-T", "nameB": "Rush-T" } ] }
```

하네스에 추가한 기록(`run_selfplay.py`, `draft_driver.py`): 결과 JSON의 `A`/`B`에 `draft`(밴 라운드 순서 `my_ban_rounds`, 받은 밴 `bans_against_me`, 선택 `my_picks`, 드래프트 설정)와 `player_id`, 최상위에 `replay` 경로가 들어갑니다. 이전에 만든 결과 JSON에는 이 기록이 없어 내보낼 수 없습니다(리플레이는 파일명 규칙으로 찾습니다).

변환 규칙: 슬롯은 게임 내 플레이어 번호(`--swap`이면 B가 1번), 밴 순서는 규칙의 라운드 표로 복원, 히든 픽은 `REPLACE`(바뀐 그룹 → 고른 유닛)로 밴 뒤에 슬롯 순서대로, 승패가 가려지지 않은 경기(오류·시간 제한)는 건너뜁니다. 선수 이름을 안 주면 `페르소나-종족글자`입니다.

**실제 경기로 검증함**: 테란 미러 1판(A가 60초에 항복)을 직접 돌려 결과 JSON → 매니페스트 + 리플레이를 만들고, 사이트의 매니페스트 검증기와 리플레이 헤더 검사를 통과하는 것까지 확인했습니다.

### ⚠ 콜로세움 3밴을 하려면 아직 막혀 있는 것

실제 경기의 드래프트 설정이 `ban_count: 0`이었습니다. AI용 모드 변형이 밴을 0으로 강제하기 때문입니다(`BPM_Lobby_UI.galaxy`의 `c_bpmAIForceBanCount = 0`, 봇 쪽은 `BPM_BAN_COUNT` 기본 0). 콜로세움이 약속한 **Snake 3 Bans**를 하려면 둘 다 바꿔야 합니다: 모드 상수를 `-1`(원래 동작)로, 봇은 `BPM_BAN_COUNT=3`. 이 경로(AI의 밴 선택 `choose_ban`을 포함한 3밴 자가대전)는 이 기록 기준으로 실경기 검증이 되어 있지 않습니다. 모드 쪽 수정은 Galaxy 컴파일과 인게임 시험이 필요해 여기서는 건드리지 않았습니다.

## 환경 변수 (Railway)

| 변수 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | 운영 필수 | Railway Postgres. 스키마는 첫 요청 때 자동 생성 |
| `ADMIN_TOKEN` | 운영 필수 | 16자 이상 임의 문자열. 없거나 짧으면 업로드 API는 503 |
| `S3_ENDPOINT` `S3_BUCKET` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` | 권장 | Cloudflare R2 등 S3 호환 스토리지. 넷 다 있어야 사용. 없으면 로컬 디스크 |
| `STORAGE_DIR` | 선택 | S3 미사용 시 저장 폴더(기본 `.data/replays`). Railway에서는 **볼륨을 마운트**한 경로여야 재배포 후에도 남음 |
| `PGLITE_DIR` | 개발용 | `DATABASE_URL`이 없을 때 내장 Postgres(PGlite) 저장 위치. 기본 `.data/pglite` |

로컬 개발은 환경 변수 없이 `npm run dev`만으로 PGlite와 `.data/replays`를 씁니다(둘 다 git 제외). 업로드를 시험하려면 `ADMIN_TOKEN`만 주면 됩니다.

## 검증한 것 / 못 한 것

검증함(합성 리플레이 5건으로 프로덕션 빌드에서): 잘못된·없는 토큰 401, 업로드 201, 재업로드 200(교체), 목록·매치업 필터, 순위(2-0, 1-1 미완료 시리즈), 예약 공개 경기가 목록·상세·다운로드에서 모두 404, 다른 이벤트 슬러그로 상세 접근 404, 다운로드 헤더, 이벤트 페이지 링크, 타입체크·린트·`next build`.

검증 못 함: 실제 SC2 리플레이(합성 파일은 MPQ 헤더 4바이트만 검사하는 코드 경로만 통과), 실제 Railway Postgres(`pg` 경로), 실제 R2(`aws4fetch` 경로). 이 셋은 배포 후 첫 업로드로 확인해야 합니다.

## 알려진 한계 (Phase 0)

- 인증은 공유 토큰 하나입니다. 계정 기반 관리자 권한은 Phase 1.
- AI 분석 요약은 하네스가 `summary`에 넣어준 값만 보여줍니다. 리플레이 파싱 기반 분석은 없습니다.
- 유닛은 에디터 ID 그대로 표시합니다(위키 이름·아이콘 연결은 후속).
- 목록은 페이지네이션이 없습니다. 콜로세움 규모(수백 건 이하)를 가정했습니다.
- 업로드 요청당 한 경기이고 리플레이 최대 10MB입니다.
