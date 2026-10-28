# worker

리플레이 분석 워커(Python). 사이트에 올라온 리플레이를 **가져와서(pull)** 분석하고 결과를 돌려줍니다(`docs/BPM_Backend_Plan.md` §3, §5). 서버가 워커에 접속하지 않으므로 워커는 Railway의 Python 서비스든, 집의 GPU 머신이든 어디서나 돌릴 수 있고, 여러 대를 동시에 띄워도 됩니다.

## 실행

```powershell
pip install -r worker/requirements.txt
$env:BPM_SERVER_URL = "https://<사이트>"; $env:WORKER_TOKEN = "<서버와 같은 값, 32자 이상>"
python worker/run_worker.py            # 계속 돌면서 대기열을 처리 (Ctrl+C로 정상 종료)
python worker/run_worker.py --once     # 지금 쌓인 것만 처리하고 종료
```

**`BPM_HANDLE_KEY`**(32자 이상 비밀 문자열)가 필요합니다. 워커가 플레이어의 Battle.net 핸들을 이 키로 해시해 `handleKey`로만 서버에 보냅니다(같은 경기를 두 선수가 올렸는지 알아보는 용도). 없거나 짧으면 워커가 시작하지 않습니다. **한 번 정하면 바꾸지 마세요**: 바꾸면 새 분석이 옛 분석과 같은 경기로 묶이지 않습니다. 서버 쪽에는 같은 `WORKER_TOKEN`(32자 이상 임의 문자열)이 필요합니다. 없거나 짧으면 워커 API는 503입니다. 플레이어의 런처 토큰으로는 워커 API를 쓸 수 없습니다(별개 인증).

## 작업 흐름

```text
QUEUED ─ claim ─▶ ANALYZING ─┬─ READY      분석 결과(JSON) 저장
 ▲  (오래된 것부터)  (임대 10분) ├─ REJECTED   NOT_BPM · CORRUPT → 파일 삭제 / UNSUPPORTED → 파일 보존
 │                           └─ FAILED     워커 오류 → 2분·4분 뒤 재시도, 3번째 실패에서 FAILED로 확정
 └─────── 임대 만료(워커가 죽음) 시 다시 배정, 3번 넘으면 FAILED
```

- **한 작업은 한 워커에게만** 배정됩니다(`FOR UPDATE SKIP LOCKED`). 임대가 끝난 작업의 늦은 결과는 409로 거부되어 새 시도를 덮어쓰지 못합니다.
- 워커는 **임대한 파일만** 내려받을 수 있습니다.
- 리플레이는 신뢰할 수 없는 입력이라 **별도 프로세스에서** 120초 제한(POSIX에서는 메모리 1GB 제한)으로 파싱합니다. 파서가 멈추거나 죽어도 그 작업 하나만 `CORRUPT`가 됩니다. 임시 파일은 작업이 끝나면 항상 지웁니다.
- 분석 결과(`analysis`, 스키마 1)에는 맵, 빌드, 시간(`durationSec`), 시작 시각(`startedAt`)과 총 프레임(`gameLoops`), 편의성 모드, 플레이어별 종족·승패·밴·픽·대체된 유닛, Battle.net 핸들이 들어갑니다. **닉네임은 저장하지 않습니다.**
- READY 전에 뷰어용 `timeline.json.gz`(스키마 1)를 별도 업로드합니다. 유닛 생애·델타 인코딩 위치 표본·10초 PlayerStats·빌드·업그레이드·초기 교전 묶음을 담고, 서버는 `analysis/{userId}/{replayId}.timeline.json.gz`에 비공개 저장합니다. 소유자 전용 API로만 읽고 리플레이 삭제 때 함께 지웁니다.
- 대기열이 비면 3초에서 30초까지 늘려 가며 쉬고, 사이트가 내려가 있으면 기다렸다 다시 시도합니다.

### Railway에 올릴 때

별도 서비스로 만들고 시작 명령을 `python worker/run_worker.py`, 환경 변수를 `BPM_SERVER_URL`(같은 프로젝트의 내부 주소 권장)과 `WORKER_TOKEN`으로 둡니다. `requirements.txt`는 `s2protocol`, `mpyq` 두 개뿐입니다. Windows 개발 PC에서는 메모리 제한이 걸리지 않습니다.

### 아직 없는 것

- **밴픽 평가**(밴픽이 승패에 미친 영향): 가치 모델이 없어 만들지 않았습니다. 경기 형세 평가는 아래 "AI 평가 작업"에 있습니다.
- 업로더 신원 확인: 어느 쪽 플레이어가 올린 사람인지는 Battle.net 계정을 연결한 뒤 `handle`로 판단합니다.

## 밴픽 복원 (`bpm_replay/draft_decode.py`)

```powershell
pip install -r worker/requirements.txt
python -X utf8 -m bpm_replay.draft_decode "경기.SC2Replay"      # worker 폴더에서
python -X utf8 -m unittest discover -s worker/tests              # BPM_Site 폴더에서
```

### 원리

모드가 드래프트 적용 때 플레이어에게 숨은 업그레이드를 부여합니다. 업그레이드는 리플레이 트래커 스트림에 남으므로 **모드를 고치지 않고** 읽을 수 있습니다.

| 업그레이드 | 뜻 |
|---|---|
| `BPM_Ban_<유닛>` | 이 플레이어는 그 유닛을 쓸 수 없음 |
| `BPM_Pick_<유닛>` | 이 플레이어가 확장 유닛을 골랐음 |
| `BPM_Upgrade_ConvenienceMode` | 편의성 모드 켜짐 |

픽 그룹은 (기본 유닛, 확장 유닛) 한 쌍입니다(`bpm_replay/groups.json`, 모드 유닛 레지스트리에서 생성. 그룹이 바뀌면 다시 생성). 확장 유닛을 고르면 같은 그룹의 기본 유닛에도 `Ban_`이 붙으므로, **같은 그룹에 `Pick_ext`가 있으면 그 `Ban_base`는 "대체된 것"(`displaced`)**, 나머지가 진짜 밴(`bans`)입니다. 진짜 밴은 상대가 건 것입니다.

### 한계 (그대로 믿으면 안 되는 것)

- **최종 상태만** 있습니다. 밴 순서, 패스한 라운드, 선택 시각은 알 수 없습니다.
- 기본 유닛을 그대로 고른 것은 흔적이 없습니다(추론만 가능).
- 같은 그룹에서 "상대가 기본 유닛을 밴 + 내가 확장 유닛을 픽"한 경우와 "내가 픽으로 대체"한 경우는 구분되지 않습니다. 기본 설정(그룹 유닛 밴 보호)에서는 생기지 않습니다. 보호를 끈 구버전·실험 설정의 리플레이에서는 밴을 과소 집계할 수 있습니다.
- **로비 설정(밴 수, Snake/Standard)은 리플레이에서 읽을 수 없습니다.** 사람이 둔 BPM 리플레이의 모드 경로 필드도 비어 있어 모드 버전도 모릅니다. BPM 여부는 위 업그레이드의 존재로만 판정합니다.
- 승패는 헤더의 결과 값이며, 한쪽이 게임을 나가서 끝난 경기(봇 항복 등)는 비어 있을 수 있습니다.
- 종족 이름은 클라이언트 언어로 저장되므로(`테란`) 쓰지 않고, 시작 일꾼(SCV/Probe/Drone)으로 판정합니다.
- 설치된 `s2protocol`에 해당 게임 빌드(98310)의 프로토콜이 없어 가장 최신 프로토콜로 디코드합니다. 헤더·세부·트래커는 정상 디코드되었지만, 새 빌드가 나오면 `s2protocol`을 올리고 테스트를 다시 돌려야 합니다.

### 검증

- 봇 경기 1건(`tests/fixtures/bot_tvt_3picks.SC2Replay`)을 하네스의 자체 드래프트 기록과 대조: 선택·대체 모두 일치.
- 사용자 PC 리플레이 1,223개 중 BPM 게임 110개를 오류 없이 복원(사람이 직접 둔 게임 포함). 그중 88개에 진짜 밴이 1개 이상.
- 이 110개 중 23개는 플레이어가 1명뿐인 실험 리플레이로, 존재하지 않는 2번 플레이어에 업그레이드가 붙어 경고가 납니다(데이터 오류가 아닌 실험 설정의 부산물).

## AI 평가 작업 (형세 곡선)

분석 큐가 비면 같은 워커가 평가 큐(`/api/worker/eval/*`)에서 분석이 끝난 리플레이를 가져와 M1 평가자로 10초마다 형세를 매깁니다(`bpm_eval/pipeline.py`의 `form_curve`). 결과는 `DONE`(곡선), `SKIPPED`(1대1 세 종족 경기가 아님 등 설계상 평가 불가), `FAILED`(2분·4분 뒤 재시도, 3번째에서 확정)로 보고합니다. 곡선은 모델 점수이며 BPM 경기로 보정되지 않았습니다(`docs/BPM_Backend_Plan.md` §5.1).

- 끄기: `BPM_EVAL=0`. numpy가 없으면 스스로 꺼지고 분석은 그대로 돕니다.
- `bpm_eval/`의 `state.py`, `replay_data.py`, `featurize.py`, `infer_np.py`, `role_map.json`, `research_times.json`, `models/`는 **엔진 파일의 복사본**이라 직접 고치지 않습니다. 엔진을 바꾸면 `python scripts/sync-eval-from-engine.py`(BPM_Site에서)로 다시 복사하고, `--check`로 어긋남을, 엔진 쪽 `tests/test_vendored_eval.py`로 결과가 같은지 확인합니다. `pipeline.py`만 이 저장소의 코드입니다.

### Railway에 올릴 때 (분석과 평가가 한 서비스)

서비스 루트를 `worker`, 시작 명령을 `python run_worker.py`, 환경 변수를 `BPM_SERVER_URL`(같은 프로젝트의 내부 주소 권장)과 `WORKER_TOKEN`으로 둡니다. Python 3.11 이상(3.13에서 확인; 3.12 이상은 `bpm_replay/compat.py`가 `s2protocol`의 `imp` 문제를 처리), 의존성은 `requirements.txt`(s2protocol, mpyq, numpy)뿐이고 GPU는 필요 없습니다. 평가 번들(M1 4 MB)은 저장소에 들어 있어 따로 받을 것이 없습니다. 평가 한 건은 가장 긴 경기(약 30분)에서도 1.5~2초, 최대 메모리 약 77 MB(번들을 올린 뒤 약 50 MB 위에 약 25 MB, Windows 작업 집합 기준)였습니다. **Linux에서는 실행해 보지 않았습니다**(Windows에서 3.11과 3.13으로만 확인). 분석 단계(`decode_isolated`)는 POSIX에서 별도 프로세스 메모리 1 GB 제한을 거는데 이 환경에서는 동작을 확인하지 못했습니다.
