# BPM Uploader

게임이 끝나면 BPM 리플레이를 자동으로 서버에 올리는 Windows 트레이 프로그램입니다 (`docs/BPM_Backend_Plan.md` §4, §6). .NET 10.

## 동작

```text
SC2 종료 → .SC2Replay 저장 ─▶ 감시(FileSystemWatcher + 45초 재검색)
   ─▶ 파일이 다 써질 때까지 대기(크기·시각이 3초간 변하지 않고 열 수 있을 때)
   ─▶ 로컬에서 BPM 게임인지 판별 ─ 아니면 여기서 끝(서버로 전송하지 않음)
   ─▶ SHA-256 계산 ─▶ POST /api/uploads (Bearer 기기 토큰) ─▶ 결과를 원장에 기록
```

- **일반 래더 게임은 PC를 떠나지 않습니다.** 판별은 리플레이 안의 트래커 스트림에서 모드가 부여한 숨은 업그레이드(`BPM_Ban_*`, `BPM_Pick_*`, `BPM_Upgrade_ConvenienceMode`)를 찾는 방식이고(`Replay/MpqArchive.cs`, `ReplayInspector.cs`), 게임 빌드의 프로토콜에 의존하지 않습니다. 사용자 PC 리플레이 1,220개에서 서버 쪽 Python 디코더와 같은 110개를 BPM으로 판정했습니다. 서버도 다시 검사합니다(클라이언트는 신뢰하지 않음).
- **연결 전·후**: 연결(`WatchSinceUtc`) 이전에 저장된 리플레이는 건드리지 않습니다. 첫 실행은 연결 창으로 바로 가고, 이후 새 경기부터 올립니다.
- **재시도**: 네트워크·서버 오류는 30초부터 2배씩(최대 1시간) 늘려 다시 시도하며 재시작 후에도 이어집니다(`ledger.json`). 예상 밖의 응답은 8번까지만 시도합니다. 서버가 영구 거부(413/422)한 파일은 다시 보내지 않습니다.
- **토큰이 폐기되면**(401) 토큰을 지우고 "다시 연결" 상태가 되며, 대기 중인 경기는 보존됩니다. **동의가 꺼져 있으면**(403 NO_CONSENT) 올리지 않고 대기합니다. 사이트에서 동의를 켠 뒤 트레이의 "지금 다시 시도"를 누르거나 10분 안에 자동 재시도됩니다.
- 서버로 보내는 것: 리플레이 파일, SHA-256, 클라이언트 버전, 기기 이름(연결 때 한 번). **로컬 파일 이름은 보내지 않습니다.** 로그에는 파일 이름과 결과만 남기고 토큰·리플레이 내용은 남기지 않습니다.

## 구성

| 프로젝트 | 내용 |
|---|---|
| `src/Bpm.Uploader.Core` | 엔진 전체: MPQ 읽기·판별, 감시, 업로드 서비스, API 클라이언트, 기기 연결, 토큰(DPAPI)·원장·설정 |
| `src/Bpm.Uploader.Tray` | 트레이 앱 `BPMUploader.exe` (메뉴: 상태, 연결/해제, 설정, 일시 중지, 지금 다시 시도, 로그, 사이트, 자동 시작, 종료). 한국어/영어 |
| `src/Bpm.Uploader.Cli` | 개발·시험용 `inspect`, `link`, `run`, `status`, `unlink` |
| `tests/Bpm.Uploader.Tests` | 단위 테스트 42개 (판별, 업로드 서비스 시나리오, 서버 응답 분류, 멀티파트 형식) |

데이터 위치: `%LOCALAPPDATA%\BPMUploader\` (`settings.json`, `token.dat`(DPAPI 암호화), `ledger.json`, `uploader.log`).

## 빌드·시험

```powershell
dotnet test tests/Bpm.Uploader.Tests -c Release
dotnet build src/Bpm.Uploader.Tray -c Release -p:ServerUrl=https://<사이트>   # 배포 빌드에 서버 주소를 박는다
```

서버 주소 우선순위: 환경 변수 `BPM_SERVER_URL` → `settings.json`의 `ServerUrl` → 빌드에 박은 `ServerUrl`. 도메인이 아직 정해지지 않아 기본값은 비어 있고, 비어 있으면 연결 창이 안내 문구를 보여 줍니다.

종단 시험(서버 + 런처): 서버를 `BPM_DEV_LOGIN=1 npm run dev`로 띄우고 `node scripts/dev/upload-flow-test.mjs http://localhost:3000`(API 27개 점검). 런처 쪽은 `BPM_SERVER_URL`, `BPM_UPLOADER_HOME`(임시 상태 폴더), `BPM_DOCUMENTS`(실제 SC2 폴더 대신 감시할 가짜 문서 폴더)를 지정해 `Bpm.Uploader.Cli link` → `run`.

## 설치 프로그램과 자동 업데이트 (Velopack)

```powershell
scripts/Build-UploaderRelease.ps1 -Version 0.2.0 -ServerUrl https://<사이트> -UpdateUrl https://<파일 올릴 주소>/uploader
```

- 테스트를 돌리고 self-contained(win-x64)로 게시한 뒤 `vpk pack`으로 `uploader/releases/`에 `BanPickModUploader-win-Setup.exe`(새 사용자용), `*-full.nupkg`·`*-delta.nupkg`·`RELEASES`(업데이트용), Portable zip을 만듭니다. .NET을 따로 설치할 필요가 없습니다(약 60 MB).
- **배포**: `releases/` 안의 파일을 전부 `-UpdateUrl` 주소의 폴더에 올립니다(정적 호스팅이면 됩니다). 이전 버전 파일도 같은 폴더에 두어야 변경분(delta)만 받습니다. 사용자에게는 Setup.exe 링크만 주면 됩니다.
- **설치 위치**: 앱은 `%LOCALAPPDATA%\BanPickModUploader\current\`(관리자 권한 불필요, 시작 메뉴 바로가기). 설정·토큰·원장은 그대로 `%LOCALAPPDATA%\BPMUploader\`에 있어 업데이트·제거로 지워지지 않습니다. 설치 직후 자동 시작이 켜지고(트레이 메뉴에서 끌 수 있음), 제거할 때 자동 시작 항목을 지웁니다.
- **업데이트 동작**: 설치된 복사본이 시작 30초 뒤와 6시간마다 `UpdateUrl`을 확인해 새 버전을 백그라운드로 받습니다. 받은 뒤 트레이 메뉴에 "x.y.z 업데이트 설치 후 다시 시작"이 나타나고, 누르지 않아도 프로그램을 종료할 때 설치됩니다. 개발 빌드(설치본이 아님)나 `UpdateUrl`이 비어 있으면 아무것도 하지 않습니다. 주소 우선순위: `BPM_UPDATE_URL` 환경 변수 → `settings.json`의 `UpdateUrl` → 빌드에 박은 값.
- **서명(선택)**: 환경 변수 `BPM_AZURE_SIGN_FILE`(Azure 서명 서비스 metadata.json) 또는 `BPM_SIGN_PARAMS`(signtool 인수)가 있으면 스크립트가 모든 파일과 Setup.exe에 서명합니다. 없으면 서명 없이 만들고 경고를 출력합니다. 비밀 값은 저장소에 넣지 않습니다.
- **확인한 것**: 0.1.0 포터블 복사본이 로컬 폴더의 0.1.1을 감지·델타로 받고, `Update.exe apply`로 0.1.1이 적용되는 것까지. **Setup.exe로 실제 설치, 설치·제거 훅(자동 시작 등록/해제), 바로가기, http(s) 주소로의 업데이트, 서명은 아직 확인하지 않았습니다.**

## 아직 없는 것

- 코드 서명은 **규모가 커진 뒤 적용하기로 보류**했습니다(2026-10-28). 인증서가 생기면 환경 변수만 설정하면 켜집니다. 그때까지 서명 없는 exe는 SmartScreen 경고가 뜨므로 테스터에게 "추가 정보 → 실행"을 안내하고, 백신 오탐 신고가 반복되거나 사용자가 수십 명을 넘으면 서명을 붙입니다.
- 설정 창은 캡처로 확인했지만 트레이 메뉴와 연결 창은 실제 화면으로 확인하지 않았습니다(시작, 단일 인스턴스, 업로드 동작만 자동 확인).
- **설정 창**(트레이 메뉴 "설정…", 탭 3개, 바꾸는 즉시 저장):
  - **공유**: C1~C3(사이트와 동일). 업로드 전에 서버의 동의를 조회하므로 사이트에서 철회하면 파일이 PC를 떠나지 않습니다.
  - **폴더**: 자동으로 찾은 `문서\StarCraft II` 폴더(읽기 전용)와 직접 추가한 폴더. 폴더 추가는 리플레이 폴더 자체나 그 상위 폴더(`StarCraft II`, `Accounts` 등)를 고르면 안에서 `Replays\Multiplayer`를 찾아 줍니다. 리플레이가 없는 폴더는 거절합니다. 추가·제거 즉시 감시에 반영됩니다. 연결하기 전에 저장된 옛 경기는 올리지 않습니다(연결 시각 이후만).
  - **프로그램**: Windows 시작 시 실행, 업로드 일시 중지, 버전·자동 업데이트 상태, 로그/설정 폴더/사이트 열기.
- 화면 점검: 환경 변수 `BPM_UI_SNAPSHOT=<폴더>`로 실행하면 설정 창 탭별 PNG를 저장하고 종료합니다(임시 상태 폴더 사용, 실제 설정·토큰을 건드리지 않음).
- Battle.net OAuth 시작·콜백·세션 생성 코드는 사이트에 구현되어 있습니다. 다만 운영 Client ID·콜백 URL을 사용한 실제 로그인 → `/device` 승인 → 업로더 토큰 발급 종단 시험은 아직 확인하지 않았습니다.
