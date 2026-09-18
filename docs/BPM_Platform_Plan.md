# BPM 통합 플랫폼 최종 기획서

**Website v2 · BPM Companion · Tournament Engine · Replay Analyzer · AI**

**StarCraft II: BanPickMod**

- **문서 버전**: v1.0
- **작성 기준**: 2026-09-18
- **대상**: BPM 플랫폼 리뉴얼 및 대회/리플레이/AI 통합
- **개발 원칙**: Codex 협업 가능 · SC2/Galaxy 제약 반영 · 단계적 배포

> **핵심 정의**: BPM은 단순한 웹사이트가 아니라 “플레이 → 밴픽 → 경기 → 리플레이 → 분석 → AI 학습”을 하나의 상태와 데이터 모델로 연결하는 플랫폼으로 확장한다.

---

## 0. Executive Summary

이번 리뉴얼의 목적은 기존 GitHub Pages 기반 정적 소개 사이트를 현대적인 서비스 구조로 전환하고, BPM의 핵심 자산인 밴픽 데이터·대회 상태·리플레이·AI 실험 데이터를 하나의 파이프라인으로 연결하는 것이다.

최종 플랫폼은 다섯 개의 사용자 기능과 네 개의 기술 컴포넌트로 구성한다.

### 사용자 기능
| 사용자 기능 | 주요 역할 |
| :--- | :--- |
| **Landing** | BPM 소개, 실행 방법, 시스템 요약 |
| **Patch Notes** | 버전별 변경 내역과 Wiki 연계 |
| **Wiki** | 유닛/무기/능력/업그레이드의 전체 데이터와 비교 |
| **Tournament / Replays** | 대회 상태, Match/Game 진행, 자동 리플레이 업로드와 분석 |
| **AI** | Draft AI, Gameplay AI, Replay Analyst 및 통계 소개 |

### 기술 컴포넌트
| 기술 컴포넌트 | 책임 |
| :--- | :--- |
| **Website v2** | 사용자 UI, Wiki, 대회/리플레이 조회, 관전자 화면 |
| **BPM Companion** | SC2 리플레이 감지, 자동 업로드, 현재 Match/Game 상태 동기화 |
| **Tournament Engine** | Match/Game 상태 머신, 룰 엔진, 밴/픽 유효성, 결과 확정 |
| **Replay Analyzer** | SC2Replay 파싱, 결과/빌드/병력/전투 분석, AI 데이터 생성 |

> **아키텍처 원칙**: 게임 내부 Galaxy Trigger를 웹 서비스와 직접 연결하지 않는다. 서버가 대회 상태의 authoritative source가 되고, Companion이 Windows/SC2와 서버 사이의 브리지 역할을 한다.

### 0.1 문서 구성
1. 제품 목표와 범위
2. 서비스/정보 구조
3. Website v2 상세
4. Wiki 및 게임 데이터 모델
5. 대회 시스템과 누적 밴/픽 룰
6. BPM Companion
7. Replay 자동 업로드 및 분석
8. AI 시스템 연계
9. 기술 아키텍처 및 데이터 모델
10. SC2/Galaxy 제약과 설계 원칙
11. 보안·운영·예외 처리
12. 단계별 개발 로드맵
13. 완료 기준 및 장기 확장
14. Codex/Git 협업 원칙
15. 최종 제품 비전
- 부록: 권장 초기 Repository 구성

---

## 1. 제품 목표와 범위

### 1.1 최종 제품 목표
- 처음 방문한 사용자가 30초 안에 BPM이 무엇인지, 어떻게 실행하는지, 일반 SC2와 무엇이 다른지 이해하도록 한다.
- 게임 데이터는 Wiki에서 Galaxy Editor를 열지 않고도 충분히 확인할 수 있을 정도로 상세하게 제공한다.
- Match 내부 Game 1, Game 2, Game 3… 진행에 따라 과거 밴/픽 이력을 자동 누적하고 다음 Game의 합법적인 선택지만 계산한다.
- 게임 종료 후 `.SC2Replay`를 Companion이 자동 감지·업로드하여 경기 결과와 분석 데이터를 대회 상태에 즉시 반영한다.
- 인간 대회와 AI-vs-AI 실험에서 축적된 Draft/Gameplay/Replay 데이터를 향후 밴픽 AI 및 전략 AI 학습에 재사용한다.

### 1.2 비목표(초기 단계)
- Galaxy Trigger가 인터넷 API를 직접 호출하는 구조는 만들지 않는다.
- Phase 1에서 완전한 사용자 계정/커뮤니티/SNS 기능을 구현하지 않는다.
- 초기 Replay Analyzer에서 모든 전투를 고급 AI로 의미론적으로 해석하려 하지 않는다. 먼저 검증 가능한 heuristic과 명시적 이벤트를 사용한다.
- 초기 Wiki에서 SC2 전체 데이터 파일을 무차별적으로 노출하지 않는다. 플레이에 의미가 있는 실제 최종값을 정규화해 제공한다.

---

## 2. 전체 서비스 구조

```text
GitHub
 │
 ├─ Website Source ───────→ Vercel ───────→ BPM Website v2
 │                                           │
 │                                           ├─ Wiki / Patch / AI
 │                                           ├─ Tournament / Match Room
 │                                           └─ Replay / Observer View
 │
 └─ Companion Source ─────→ BPM Companion (Windows)
                             │
                     SC2 Replay Folder Watch
                             │
                             ▼
                      Tournament API
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
 Tournament Engine       Supabase          Replay Analyzer
  (State / Rules)       DB/Storage            (Python)
       │                     │                     │
       └─────────────────── Data ──────────────────┘
                             │
                             ▼
                     AI Training / Stats
```

### 2.1 권장 기술 스택
| 영역 | 권장 기술 | 선정 이유 |
| :--- | :--- | :--- |
| **Frontend** | Next.js + TypeScript + Tailwind CSS | 정적/서버 렌더링 혼합, Vercel 배포, 타입 안정성 |
| **Backend/DB** | Supabase (PostgreSQL + Storage + Auth) | 대회/리플레이 데이터와 파일 저장을 한 서비스에서 관리 |
| **Replay Analyzer** | Python + FastAPI | SC2Replay 파싱/분석 및 AI 코드와의 재사용성 |
| **Companion** | C# / .NET 8 | Windows tray, FileSystemWatcher, HTTP/WebSocket, 배포/업데이트 용이 |
| **Video** | YouTube Embed | 대용량 영상 전송과 인코딩을 웹 서버에서 분리 |
| **Source/CI** | GitHub + PR + Actions | Codex 협업, 변경 추적, 자동 build/validation |

---

## 3. Website v2 상세 기획

### 3.1 Global Navigation
`BPM` | `Home` | `Patch Notes` | `Wiki` | `AI` | `Replays/Tournament` | `[Play BPM]`

- 기존처럼 한 페이지 내부 섹션을 이동하는 구조를 폐기하고, 각 기능을 독립 라우트로 분리한다. 모바일은 hamburger menu로 전환한다.

### 3.2 Landing Page
| 섹션 | 내용 | 설계 원칙 |
| :--- | :--- | :--- |
| **Hero** | BPM 한 줄 정의 + 플레이 방법/Wiki CTA | 긴 설명보다 실제 게임/BanPick UI 비주얼 우선 |
| **How to Play** | Battle.net → BPM 맵 → 밴/픽 → 경기 | 3단계로 단축 |
| **System Overview** | BAN → PICK → PLAY | 상대 제한/자기 선택/적용 결과를 직관적으로 |
| **Game Modes** | Standard / Expanded / AI | 미지원 기능은 Coming Soon 허용 |
| **Tutorial Video** | 소개/방 생성/밴픽/옵저버 영상 | YouTube embed |
| **Latest Patch** | 최신 버전 핵심 변경 3~5개 | 전체 패치 페이지로 이동 |

### 3.3 Patch Notes
- **Route**: `/patches`, `/patches/[version]`
- **태그**: `Balance`, `Unit`, `System`, `UI`, `AI`, `Replay`, `Bug Fix`
- 유닛/능력/업그레이드명은 자동으로 Wiki entity에 링크한다.
- Phase 1은 MDX + Git 기반 관리로 시작하며 별도 CMS는 도입하지 않는다.

### 3.4 AI 소개 페이지
```text
Opponent → Draft AI → Roster → Strategy Selection → Gameplay AI → Replay Analyst → Training Data
```
일반 사용자에게는 기술 논문 수준의 내부 구현보다 “경기 전 선택부터 경기 후 분석까지 학습하는 AI”라는 시스템 흐름을 먼저 보여준다. 세부 항목은 `Draft AI`, `Gameplay AI`, `Replay Analyst`로 분리한다.

---

## 4. BPM Wiki 및 게임 데이터

### 4.1 Wiki 목표
> **Wiki 기준**: 현재처럼 핵심 능력치 일부만 보여주는 수준을 넘어서, 실제 플레이에 영향을 주는 유닛·무기·능력·업그레이드·생산·요구 조건을 빠짐없이 제공한다.

### 4.2 정보 구조
```text
/wiki
├─ units
│   └─ [unit]
├─ abilities
│   └─ [ability]
├─ upgrades
│   └─ [upgrade]
└─ compare?a=...&b=...
```

### 4.3 Unit 상세 항목
| 영역 | 필수 필드 |
| :--- | :--- |
| **Identity** | 한글/영문명, 종족, 속성, 아이콘, 역할 |
| **Cost/Production** | 광물, 가스, 인구수, 생산시간, 생산 건물, 큐/변형 방식 |
| **Requirements** | Tech requirement, 선행 건물/업그레이드 |
| **Defense** | HP, Shield, Energy, Armor, 속성 |
| **Movement/Vision** | 이동속도, 가속/회전(의미 있는 경우), 시야, 반경, Cargo |
| **Weapons** | 대상, 피해량, 보너스, 타격 횟수, 주기, DPS, 사거리, 최소사거리, 방사/투사체 |
| **Abilities** | 비용, 지속시간, 쿨다운, 대상, 효과 |
| **Upgrades** | 비용, 연구시간, 연구시설, 요구 조건, 효과 |
| **Pick Group** | 대체/선택 관계, Compare 바로가기 |
| **History** | BPM 추가 버전, 패치 변경 이력 |

### 4.4 Pick Group Compare
비교 화면은 단순 수치 차이뿐 아니라 전투 역할과 운용 차이를 보여준다. 예: Firebat ↔ Marauder, Goliath ↔ Thor. 모바일에서는 세로 비교 레이아웃을 허용한다.

### 4.5 검색
- **검색 대상**: 한/영 유닛명, 별칭, 능력, 업그레이드, 생산 건물, Tech requirement, Pick Group
- 초기 규모에서는 Fuse.js 또는 MiniSearch 기반 빌드 타임 인덱스로 충분하며 외부 검색 서비스는 도입하지 않는다.

### 4.6 SC2 Data Exporter
```text
SC2 Unit/Weapon/Effect/Abil/Upgrade Data → Resolve inheritance/reference/effect chain → Canonical JSON → Website
```
Galaxy Editor 데이터는 상속과 Effect chain이 많기 때문에 단순 XML dump를 Wiki 데이터로 사용하지 않는다. 별도의 BPM Wiki Exporter가 최종값을 정규화하도록 설계한다.

---

## 5. Tournament Engine 과 Match 단위 밴/픽 누적

### 5.1 용어 정의
| 용어 | 정의 |
| :--- | :--- |
| **Tournament Round** | 8강, 4강, 결승 등 브래킷 상의 라운드 |
| **Match** | 두 선수 사이의 Bo3/Bo5 등 하나의 시리즈 |
| **Game** | Match 내부의 1세트, 2세트, 3세트… |
| **Draft** | 각 Game 시작 전의 Ban/Pick 과정 |
| **Series State** | 현재 Match에서 누적된 밴/픽/스코어/현재 Game 상태 |

### 5.2 핵심 규칙
대회 규칙에 따라 한 Match 안에서 이전 Game에 자신이 밴했던 유닛을 다시 밴하지 못하거나, 이전 Game에 픽했던 유닛을 다시 픽하지 못하도록 한다. Match 종료 시 해당 이력은 기본적으로 초기화한다.

```text
Game 1
A: BAN Firebat / PICK Goliath
B: BAN Reaver / PICK Arbiter
  ↓ Replay verified, Game 1 complete
Game 2 legal pool
A: Firebat BAN disabled, Goliath PICK disabled
B: Reaver BAN disabled, Arbiter PICK disabled
```

### 5.3 Rule Engine
룰은 하드코딩하지 않고 Tournament preset으로 정의한다. `ban_history`와 `pick_history`는 반드시 분리한다. “과거에 밴했던 유닛을 이후 픽할 수 있는가”와 같은 교차 규칙이 존재하기 때문이다.

| 규칙 항목 | 예시 값 |
| :--- | :--- |
| **History scope** | game / match / tournament |
| **Repeat own ban** | allowed / forbidden |
| **Repeat opponent ban** | allowed / forbidden |
| **Repeat own pick** | allowed / forbidden |
| **Repeat opponent pick** | allowed / forbidden |
| **Ban previously picked** | allowed / forbidden |
| **Pick previously banned** | allowed / forbidden |
| **Reuse scope** | player-only / both-players |

### 5.4 Preset 예시
| Preset | 설명 |
| :--- | :--- |
| **Standard** | 매 Game 밴/픽 이력 초기화 |
| **No Repeat Pick** | Match 내 자신의 이전 Pick 재사용 금지 |
| **No Repeat Draft** | Match 내 자신의 이전 Ban/Pick 각각 재사용 금지 |
| **Global Draft** | 누구든 사용한 Pick을 양측 모두 재사용 금지 |
| **Tournament Lockout** | 대회 전체에서 사용 이력 누적 |

### 5.5 Match State Machine
```text
WAITING → DRAFTING → DRAFT_LOCKED → READY → PLAYING → REPLAY_UPLOADED → VERIFYING → GAME_COMPLETE → (NEXT GAME or MATCH_COMPLETE)
```
Game이 완료되면 승점 도달 여부를 확인하고, Match가 계속되면 이전 Draft history를 기준으로 다음 Game의 legal pool을 계산한 뒤 DRAFTING으로 전환한다.

---

## 6. BPM Companion

### 6.1 역할
- Windows system tray 상주
- Battle.net/SC2 실행 보조(선택)
- 현재 Tournament/Match/Game 정보 표시
- 서버 Draft state 동기화
- SC2 replay directory 감시
- 새 replay 파일의 쓰기 완료 감지
- 자동 업로드 및 업로드 상태 표시
- WebSocket/SSE 기반 상태 갱신
- 자동 업데이트

### 6.2 권장 기술
Companion은 C#/.NET 8을 권장한다. 역할의 중심이 Windows tray, FileSystemWatcher, HTTP/WebSocket, 프로세스 감지, 업데이트이므로 Python 데스크톱 앱보다 패키징과 운영이 단순하다.

### 6.3 Replay 감지 절차
1. 사용자 SC2 replay 경로를 최초 설정 또는 자동 탐색한다.
2. FileSystemWatcher로 신규 `.SC2Replay`를 감지한다.
3. 파일 크기/mtime이 일정 시간 안정될 때까지 대기해 쓰기 완료를 판단한다.
4. 현재 사용자의 active Match/Game context와 함께 업로드 요청을 생성한다.
5. 서버의 upload URL 또는 storage 정책에 따라 파일을 전송한다.
6. 검증 결과와 다음 Game state를 Companion에 표시한다.

> **중요**: “가장 최근 리플레이”를 무조건 현재 Game의 결과로 채택해서는 안 된다. 서버 검증을 통과해야 Game Complete로 전환한다.

---

## 7. Replay 업로드·검증·분석

### 7.1 업로드 파이프라인
```text
SC2 종료 → .SC2Replay 생성 → Companion 감지 → Storage 업로드 → Analyzer → Match 검증 → DB 저장 → Tournament 상태 갱신 → Website/Companion 실시간 반영
```

### 7.2 최소 검증 항목
| 검증 | 목적 |
| :--- | :--- |
| **Participants** | 현재 Match의 두 참가자와 일치하는지 |
| **Map** | 허용/선택된 맵과 일치하는지 |
| **Time** | 현재 Game 시작 이후 생성된 유효한 경기인지 |
| **Duplicate** | 동일 Replay가 이미 처리되지 않았는지 |
| **Duration** | 비정상적으로 짧은 로딩/취소 경기 필터링 |
| **Result** | 승자/패자 추출 가능 여부 |
| **Version** | 필요 시 BPM/게임 버전 정책 검증 |

### 7.3 Replay Analysis 화면
- Match Overview
- Draft
- Build Order
- Economy
- Army Composition
- Timeline
- Battles
- Tech Transition
- AI Analysis

### 7.4 Battle Detection 초기 방식
초기 버전은 복잡한 ML 기반 전투 분할보다 일정 시간 window 내 다수 unit death와 양 플레이어 army proximity를 함께 사용하는 heuristic으로 시작한다. 안정적인 ground truth가 쌓이면 이후 학습 기반 segmentation으로 확장한다.

### 7.5 BPM Draft 와 Replay 의 관계
> **설계 변경**: Tournament 모드에서는 Ban/Pick을 Replay에서 다시 추론하지 않는다. Draft의 authoritative source는 Tournament Server이며 Replay는 실제 경기 진행과 결과를 검증하는 증거 역할을 한다.

---

## 8. AI 시스템 연계

### 8.1 AI 데이터 흐름
```text
Human Tournament / python-sc2 AI Matches → Draft History + Replay → Analyzer → Matchup/Strategy Statistics → Draft AI / Gameplay AI Training
```

### 8.2 Draft AI 입력
- Race matchup
- 현재 Game에서 사용 가능한 Ban/Pick pool
- 자신/상대의 이전 Game history
- Historical win/pick/ban rates
- 현재 전략/모델 버전

### 8.3 Gameplay AI
밴픽 결과가 결정된 이후 Build Order, Army Composition, Tech Transition, 상대 조합 대응을 학습한다. 밴픽 모델과 실제 플레이 모델은 분리 가능하되 동일 Match/Replay ID를 통해 데이터를 연결한다.

### 8.4 Website AI Statistics
- Games played
- Race matchup
- Win rate
- Ban rate
- Pick rate
- Pick group 별 성과
- Common strategy
- AI model/version 별 성과

*실제 데이터가 없는 항목은 임의 수치로 채우지 않고 Coming Soon 또는 Not enough data로 표시한다.*

---

## 9. 데이터 모델 및 API

### 9.1 핵심 Entity
| Entity | 핵심 필드 |
| :--- | :--- |
| **Tournament** | id, name, ruleset_id, status |
| **Match** | tournament_id, round, best_of, player_a/b, score, current_game, status |
| **Game** | match_id, game_number, map, winner, replay_id, status |
| **DraftEvent** | game_id, match_id, player_id, sequence, action(BAN/PICK), unit_id |
| **Replay** | file_path, hash, map, version, duration, played_at, verification_status |
| **ReplayPlayer** | replay_id, player_id, race, result, is_ai |
| **Analysis** | build_events, army_snapshots, battles, timeline |
| **WikiEntity** | unit/ability/upgrade/pick-group normalized data |

### 9.2 API 초안
```http
GET /api/tournaments/{id}
GET /api/matches/{id}
GET /api/matches/{id}/state
POST /api/matches/{id}/draft-events
POST /api/replays
GET /api/replays/{id}
GET /api/replays/{id}/analysis
POST /api/replays/{id}/verify
POST /api/admin/games/{id}/override
```

### 9.3 Website Repository 구조
```text
app/
├─ page.tsx
├─ patches/[version]/
├─ wiki/units/[id]/
├─ wiki/abilities/[id]/
├─ wiki/upgrades/[id]/
├─ wiki/compare/
├─ ai/
├─ tournaments/
├─ matches/[id]/
└─ replays/[id]/
components/{layout,landing,wiki,tournament,replay,ai}
data/{units,abilities,upgrades,pick-groups}
content/patches
scripts/migrate-v1-data.ts
tools/wiki-exporter/
```

---

## 10. SC2 엔진·Galaxy Editor 제약과 설계 원칙

### 10.1 웹 API 직접 호출 금지 전제
Galaxy Trigger가 임의의 HTTP API와 직접 통신하는 구조를 플랫폼의 전제로 삼지 않는다. 따라서 서버 상태는 게임 밖에서 Website/Companion이 관리하고, 게임 내부에는 필요한 최소 상태만 전달한다.

### 10.2 Draft Manifest 전달 방식
초기 Tournament MVP에서는 웹에서 Draft를 확정하고 플레이어가 게임 내 선택을 동일하게 맞춘 뒤 Replay로 사후 검증한다. 이후 자동 적용이 필요하면 SC2 Bank, Lobby attribute, 또는 compact match code를 채팅/입력으로 전달하는 방식을 prototype으로 검증한다.

```text
/bpm A7K2-P91C → Match/Game/Draft Manifest를 가리키는 compact code 예시
```

### 10.3 Replay 이벤트 가시성
Galaxy 내부 임의 변수나 Trigger state가 Replay parser에 항상 노출된다고 가정하지 않는다. 리플레이에서 반드시 필요할 이벤트가 있다면 실제 SC2Replay 이벤트 스트림에 관측 가능한 형태인지 prototype으로 확인한 뒤 규격화한다.

### 10.4 Authoritative Source
| 데이터 | Authoritative Source |
| :--- | :--- |
| **대회 상태/스코어** | Tournament Server |
| **밴/픽 이력** | Tournament Server DraftEvent |
| **게임 결과** | Replay 검증 결과(필요 시 Admin override) |
| **Wiki 데이터** | SC2/BPM data exporter + reviewed overrides |
| **AI 통계** | Replay/Match DB |
| **인게임 표시** | 서버 상태의 파생 표현 |

---

## 11. 운영·보안·예외 처리

### 11.1 관리자 Override
- Correct Winner
- Replace Replay
- Void Game
- Reset Draft
- Override Ban/Pick
- Advance Game
- Rollback Game
- Walkover/Forfeit

SC2 disconnect, rematch, 잘못 업로드된 Replay 등 실제 대회 운영 예외를 위해 자동 상태 머신은 항상 관리자 override와 감사 로그를 제공해야 한다.

### 11.2 Replay 보안/무결성
- 파일 hash 저장으로 중복/변조 추적
- 업로드 크기/확장자/콘텐츠 타입 제한
- Storage는 public write 금지
- 업로드 권한은 Match 참가자/Companion token 기준
- Replay 처리 worker는 업로드 파일을 신뢰하지 않고 parser error를 격리

### 11.3 관전자 화면 (Live Spectator View)
Match state가 서버에 있기 때문에 `/matches/[id]/live` 형태의 웹 실시간 관전자 화면을 제공할 수 있다. 현재 스코어, Game 번호, Ban/Pick, 사용 불가 유닛을 실시간 표시한다.

---

## 12. 단계별 개발 로드맵

| Phase | 핵심 결과물 | 비고 |
| :--- | :--- | :--- |
| **0. Foundation** | Next.js/TS/Tailwind, 디자인 토큰, CI, 데이터 validation | 새 repo 또는 web package |
| **1. Website Core** | Landing, Patch, Wiki, Search, Compare, AI 소개 | DB 없이 배포 가능 |
| **2. Tournament Core** | Tournament/Match/Game schema, DraftEvent, Rule Engine, Match Room | 수동 결과 입력으로 먼저 검증 |
| **3. Companion MVP** | Tray, 로그인/토큰, Match state, replay watcher/upload | Windows 우선 |
| **4. Replay Analyzer** | 결과/맵/참가자 검증, Build/Army/Timeline | 자동 Game complete |
| **5. Live Tournament** | 다음 Game legal pool, 웹 실시간 관전자 뷰, admin override | 대회 실운영 |
| **6. AI Integration** | 인간/AI 경기 데이터 통합, Draft/Strategy statistics | python-sc2 반복 학습 |
| **7. Advanced** | Wiki exporter 자동화, 고급 battle analysis, player profile/leaderboard | 장기 확장 |

### 12.1 권장 구현 순서
1. Canonical Wiki schema와 기존 JSON migration을 먼저 확정한다.
2. Website foundation과 Landing/Wiki를 구축해 새 배포 파이프라인을 안정화한다.
3. Tournament Engine의 Match/Game/DraftEvent/Rule Engine을 구현하고 웹에서 수동 진행 테스트를 한다.
4. Companion의 replay watcher와 upload를 붙인다.
5. Replay Analyzer로 참가자/맵/결과 검증을 자동화한다.
6. Game 완료 → 다음 Game legal pool 계산을 자동 연결한다.
7. 실시간 웹 관전자 뷰와 Replay 분석 UI를 추가한다.
8. 축적된 데이터를 AI training/statistics 파이프라인에 연결한다.

---

## 13. 완료 기준과 검증 항목

### 13.1 Website v2
- Landing에서 BPM/실행 방법/밴픽 흐름을 이해할 수 있다.
- Patch 버전별 페이지가 있으며 Wiki entity와 연결된다.
- 모든 BPM 유닛의 상세 데이터가 노출된다.
- 검색과 Pick Group compare가 동작한다.
- 모바일/데스크톱에서 핵심 UI가 깨지지 않는다.
- Vercel preview와 production build가 자동화된다.

### 13.2 Tournament
- Bo3/Bo5 Match와 내부 Game 상태를 관리할 수 있다.
- 규칙 preset에 따라 이전 Game의 Ban/Pick 재사용 금지를 정확히 계산한다.
- `ban_history`와 `pick_history`가 분리돼 교차 규칙을 적용할 수 있다.
- Match 종료 시 기본 scope에서는 history가 초기화된다.
- Admin override 및 rollback이 가능하다.

### 13.3 Companion / Replay
- 새 `.SC2Replay`를 자동 감지한다.
- 현재 Match/Game context와 함께 업로드한다.
- 중복/참가자/맵/시간/결과 검증을 통과한 경우에만 Game이 완료된다.
- 검증 실패는 Game 상태를 변경하지 않고 사용자/관리자에게 원인을 표시한다.
- Replay 상세 페이지에서 최소 Build Order, Army, Timeline을 확인할 수 있다.

### 13.4 반드시 Prototype 으로 검증할 기술 항목
| 항목 | 검증 질문 |
| :--- | :--- |
| **Replay parser** | 현재 대상 SC2 버전의 Replay에서 참가자/맵/결과/명령 데이터를 안정적으로 얻을 수 있는가? |
| **Galaxy↔Draft** | 서버 Draft를 게임 내부에 전달할 최소 마찰 방식은 Bank/Lobby/Code 중 무엇인가? |
| **BPM Version** | Replay만으로 BPM 버전을 검증할 수 있는가? 불가능하면 어떤 marker를 남길 것인가? |
| **File watcher** | SC2가 Replay 쓰기를 끝내기 전에 watcher가 업로드하지 않도록 안정화 기준은 무엇인가? |
| **Identity** | Battle.net 표시명 변경/동명이인을 Match participant와 어떻게 매핑할 것인가? |

---

## 14. Codex/Git 협업 원칙

### 14.1 작업 단위
한 번에 전체 플랫폼을 구현하지 않는다. 각 기능을 독립 PR로 분리하고, data schema나 API contract 변경은 별도 PR로 먼저 합의한다.

| 예시 Task | 완료 조건 |
| :--- | :--- |
| **web-foundation** | Next.js build/lint/typecheck 성공 |
| **wiki-schema** | Zod schema + fixture validation |
| **legacy-migration** | 현재 units/patches 데이터를 신규 schema로 변환 |
| **wiki-ui** | list/detail/search/compare 완성 |
| **tournament-schema** | Tournament/Match/Game/DraftEvent migration |
| **draft-rule-engine** | preset 테스트 케이스 통과 |
| **companion-watcher** | 샘플 replay 자동 감지/업로드 |
| **replay-verification** | 샘플 Match에서 결과 검증 성공 |

### 14.2 CI 최소 기준
```bash
npm run lint
npm run typecheck
npm run validate:data
npm run test
npm run build
```
Tournament Rule Engine과 Replay verification은 UI 테스트보다 unit/integration test 우선으로 작성한다. 특히 각 대회 규칙 preset마다 Game sequence fixture를 만들어 회귀 검증한다.

---

## 15. 최종 제품 비전

```text
PLAY → DRAFT → MATCH → REPLAY → ANALYSIS → AI → NEXT MATCH
```

BPM 플랫폼의 최종 목표는 홈페이지를 예쁘게 만드는 것이 아니라, 게임 실행·밴픽·대회 진행·리플레이·분석·AI 학습이 하나의 데이터 흐름으로 이어지는 운영 플랫폼을 만드는 것이다.

사용자는 BPM을 처음 접한 뒤 Wiki에서 유닛을 이해하고, 대회 Match Room에서 합법적인 Ban/Pick만 선택하며, 게임 종료 후 아무 작업 없이 Replay가 업로드되고 결과와 다음 Game 상태가 자동 갱신되는 경험을 가져야 한다.

개발 측면에서는 SC2/Galaxy의 네트워크 제약을 우회하려 하지 않고, 서버와 Companion이 외부 상태를 책임지며 게임 모드는 결정된 Draft를 실행하는 역할에 집중한다. 이 분리가 장기 유지보수와 대회 신뢰성, AI 데이터 품질을 동시에 확보한다.

> **최종 우선순위**: 1) Wiki/Website 기반 정비 → 2) Tournament Rule Engine → 3) Companion 자동 Replay → 4) Replay 검증/분석 → 5) AI 학습 연계. 이 순서를 기본 개발 경로로 사용한다.

---

## 부록 A. 권장 초기 Repository 구성

```text
BanPickMod/
├─ web/                # Next.js Website v2
├─ replay-analyzer/    # Python/FastAPI
├─ companion/          # C#/.NET 8
├─ shared/             # schemas/contracts (필요 시)
└─ docs/
    └─ BPM_Platform_Plan.md
```

**별도 repo로 분리할 경우:**
- `BanPickMod/web`
- `BanPickMod/replay-analyzer`
- `BanPickMod/bpm-companion`

### A.1 참고 패턴
Vespene.gg Companion의 “로컬 클라이언트가 SC2 리플레이를 감지하고 대회/서버 워크플로에 연결하는 패턴”을 UX와 시스템 설계 참고 사례로 활용한다. 구현은 BPM 요구사항과 데이터 모델에 맞춰 독립적으로 설계한다.

- **참고 URL**: [https://vespene.gg/download](https://vespene.gg/download)
