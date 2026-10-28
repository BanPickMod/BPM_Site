# timeline.json.gz 스키마 v1

워커가 BPM 리플레이를 분석할 때 요약 `analysis`와 별도로 생성하는 비공개 재생 묶음이다. JSON을 UTF-8 최소 형식으로 직렬화하고 gzip 레벨 9, `mtime=0`으로 압축하므로 동일 입력의 결과는 바이트 단위로 같다.

## 최상위 필드

- `schema`: `1`
- `meta`: 맵, 지도 에셋의 월드 좌표 경계(`mapTransform`), 게임 빌드, 길이, 분석기 버전, 위치 인코딩과 G2 표시 정책
- `players[]`: `owner`, 종족, 결과, AI 여부, Battle.net handle. 닉네임은 없다.
- `draft.players[]`: 최종 픽·밴·대체 유닛
- `series[]`: PlayerStats 표본. `t`, `owner`, 자원, 일꾼, `[사용, 상한]` 보급, 병력 가치, 수입, 누적 투입·손실·처치 값
- `units[]`: 유닛 생애와 위치
- `buildOrder[]`: 건설·생산·변신·업그레이드 사건과 직전 보급
- `battles[]`: 15초·20타일 창으로 묶은 양측 사망 군집. V1의 초기 검출값이며 G4에서 검수한다.
- `tech[]`: BPM 내부 업그레이드를 제외한 업그레이드 완료 사건

## 유닛 위치

`units[].track`은 크기를 줄이기 위해 0.1초·0.1타일 정수로 저장한다. 첫 항목은 절대 `[t,x,y]`, 이후 항목은 직전 값과의 `[dt,dx,dy]`다. `meta.timeScale`과 `meta.coordinateScale`은 모두 `10`이다.

`positionMode`는 다음 중 하나다.

- `tracked`: 실제 UnitPositions 표본 사이만 선형 보간
- `static`: 건물, 출생 좌표에 고정
- `event-endpoints`: 위치 표본은 없지만 사망 좌표가 있음. 출생·사망 3초 창만 반투명 표시
- `birth-only`: 위치·사망 표본이 없음. 출생 3초 창만 반투명 표시

`event-endpoints`를 출생→사망 직선으로 보간하면 관측하지 않은 이동 경로를 만들어 내므로 금지한다. 지도에 표시되지 않는 시간에도 해당 유닛은 운영·병력 집계에서 제외하지 않는다.

## 저장과 접근

- 저장 키: `analysis/{userId}/{replayId}.timeline.json.gz`
- 워커 업로드: `PUT /api/worker/replays/{id}/timeline` (현재 임대 + `WORKER_TOKEN` 필요)
- 소유자 읽기: `GET /api/me/uploads/{id}/timeline`
- 최대 허용 압축 크기: 2MB. 제품 목표는 경기당 300KB 이하다.
- 리플레이가 READY가 되려면 타임라인 업로드가 먼저 성공해야 한다.
- 리플레이 삭제 또는 영구 거절 시 타임라인도 함께 삭제한다.
