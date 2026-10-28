# 개인정보 데이터 목록

**기준일:** 2026-10-28
**용도:** 저장하는 모든 항목의 분류·목적·보유기간·삭제 경로를 한 곳에 둔다. 처리방침의 수집 항목·보유기간 표, §3.3 보관기간 배치의 설정, 삭제·내보내기 범위의 단일 출처다.

**이 문서는 자동 검사 대상이다.** `npm run test:privacy`가 마이그레이션이 만드는 모든 열을 읽어, 아래 표에 없는 열이나 표에만 있는 열이 있으면 실패한다. 새 열을 추가하는 변경은 이 표를 같이 고쳐야 통과한다. 분류 값과 빈 칸도 검사한다.

보유기간의 "(제안)"은 운영자 확정 전 값이다. 확정되면 "(제안)"을 지우고 처리방침과 같은 변경에서 갱신한다. 법률 자문이 아니다.

## 분류

| 코드 | 이름 | 뜻 |
|---|---|---|
| `ID` | 직접식별 | 사람을 직접 알아볼 수 있는 값 |
| `PSEUDO` | 가명·파생 | 단독으로는 알아보기 어렵지만 키·다른 정보와 합치면 연결될 수 있는 값 |
| `CONTENT` | 이용자 작성 내용 | 이용자가 직접 쓴 자유 텍스트나 파일(개인정보가 들어갈 수 있음) |
| `LOG` | 이용·처리 기록 | 시각·버전·접속 환경 같은 이용 기록 |
| `CONSENT` | 동의·설정 | 동의 상태와 개인 설정 |
| `SECRET` | 인증 비밀(해시) | 원문이 아닌 해시로만 저장하는 인증 값 |
| `OPS` | 운영 상태 | 처리 흐름을 위한 번호·상태 |
| `NONPERSONAL` | 개인정보 아님 | 운영자가 올리는 AI 경기 등 개인과 무관한 값 |

## 열별 목록

각 표의 `표.열` 칸 값이 검사 키다.

### app_user — 계정

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `app_user.id` | OPS | 계정 내부 번호 | 계정과 같음 | 계정 삭제(탈퇴) |
| `app_user.provider` | OPS | 로그인 제공자(battlenet) | 계정과 같음 | 계정 삭제(탈퇴) |
| `app_user.subject` | ID | Battle.net 계정 식별자. 로그인 시 같은 계정을 알아보는 기본 서비스 제공(고지) | 계정과 같음, 미접속 2년 뒤 안내 후 파기(제안) | 계정 삭제(탈퇴) |
| `app_user.display_name` | ID | 표시 이름(Battle.net 표시명). 본인 화면 표시 | 계정과 같음 | 계정 삭제(탈퇴) |
| `app_user.created_at` | LOG | 가입 시각 | 계정과 같음 | 계정 삭제(탈퇴) |
| `app_user.deleted_at` | OPS | 삭제 표시(현재 계정 삭제는 행 삭제라 쓰지 않음) | 계정과 같음 | 계정 삭제(탈퇴) |
| `app_user.session_version` | OPS | 올리면 계정의 모든 브라우저 로그인이 끝남("모든 브라우저에서 로그아웃", A6) | 계정과 같음 | 계정 삭제 |
| `app_user.onboarding_completed_at` | CONSENT | 첫 로그인 안내·선택 동의 화면을 마친 시각(§3.5). 끝나기 전에는 런처 연결·업로드 불가 | 계정과 같음 | 계정 삭제 |
| `app_user.onboarding_policy_version` | CONSENT | 그때 보여 준 처리방침 버전 | 계정과 같음 | 계정 삭제 |
| `app_user.policy_seen_version` | CONSENT | 사용자가 마지막으로 확인한 처리방침 버전(변경 안내 배너 기준, §3.6) | 계정과 같음 | 계정 삭제 |
| `app_user.age_confirmed_at` | CONSENT | 만 14세 이상 자기확인 시각 | 계정과 같음 | 계정 삭제(탈퇴) |

### consent — 현재 동의

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `consent.user_id` | OPS | 계정 연결 | 계정과 같음 | 계정 삭제(탈퇴) |
| `consent.c1` | CONSENT | 분석용 업로드 동의(C1) | 계정과 같음 | 계정 삭제(탈퇴) |
| `consent.c2` | CONSENT | 공개·통계 동의(C2) | 계정과 같음 | 계정 삭제(탈퇴) |
| `consent.c3` | CONSENT | AI 학습 동의(C3) | 계정과 같음 | 계정 삭제(탈퇴) |
| `consent.policy_version` | CONSENT | 동의 당시 정책 버전 | 계정과 같음 | 계정 삭제(탈퇴) |
| `consent.consent_version` | CONSENT | 이 동의가 어느 동의 문구 버전에서 주어졌는지(문구가 바뀌면 영향받는 동의를 다시 확인) | 계정과 같음 | 계정 삭제 |
| `consent.reconsent_pending` | CONSENT | 문구 변경 때문에 꺼졌고 아직 답하지 않은 동의(예: c2,c3) | 계정과 같음 | 계정 삭제 |
| `consent.updated_at` | LOG | 동의 변경 시각 | 계정과 같음 | 계정 삭제(탈퇴) |

### consent_log — 동의 변경 이력

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `consent_log.id` | OPS | 이력 번호 | 탈퇴 후 1년 또는 법정 기간(제안) | 계정 삭제(탈퇴) |
| `consent_log.user_id` | OPS | 계정 연결 | 탈퇴 후 1년 또는 법정 기간(제안) | 계정 삭제(탈퇴) |
| `consent_log.c1` | CONSENT | 변경 후 C1 | 탈퇴 후 1년 또는 법정 기간(제안) | 계정 삭제(탈퇴) |
| `consent_log.c2` | CONSENT | 변경 후 C2 | 탈퇴 후 1년 또는 법정 기간(제안) | 계정 삭제(탈퇴) |
| `consent_log.c3` | CONSENT | 변경 후 C3 | 탈퇴 후 1년 또는 법정 기간(제안) | 계정 삭제(탈퇴) |
| `consent_log.policy_version` | CONSENT | 정책 버전 | 탈퇴 후 1년 또는 법정 기간(제안) | 계정 삭제(탈퇴) |
| `consent_log.consent_version` | CONSENT | 변경 당시 동의 문구 버전 | 탈퇴 후 1년 또는 법정 기간(제안) | 계정 삭제 |
| `consent_log.source` | CONSENT | 변경 경로(웹/런처) | 탈퇴 후 1년 또는 법정 기간(제안) | 계정 삭제(탈퇴) |
| `consent_log.at` | LOG | 변경 시각. 동의·처리정지 처리 기록(A10) | 탈퇴 후 1년 또는 법정 기간(제안) | 계정 삭제(탈퇴) |

### policy_ack — 정책 변경 확인 기록(§3.6)

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `policy_ack.id` | OPS | 기록 번호 | 계정과 같음 | 계정 삭제 |
| `policy_ack.user_id` | OPS | 계정 연결 | 계정과 같음 | 계정 삭제 |
| `policy_ack.from_version` | CONSENT | 확인 전에 사용자가 본 버전 | 계정과 같음 | 계정 삭제 |
| `policy_ack.to_version` | CONSENT | 확인한 버전 | 계정과 같음 | 계정 삭제 |
| `policy_ack.kind` | OPS | 확인 종류(seen) | 계정과 같음 | 계정 삭제 |
| `policy_ack.at` | LOG | 확인 시각 | 계정과 같음 | 계정 삭제 |

### device_auth — 런처 연결 요청(단기)

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `device_auth.id` | OPS | 기기 연결 요청 번호 | 만료 즉시(요청 만료 시각 이후 배치로 정리) | 만료 정리 배치(§3.3), 계정 삭제 |
| `device_auth.device_code_hash` | SECRET | 기기 코드 해시(RFC 8628) | 만료 즉시 | 만료 정리 배치(§3.3), 계정 삭제 |
| `device_auth.user_code` | SECRET | 사용자에게 보이는 승인 코드 | 만료 즉시 | 만료 정리 배치(§3.3), 계정 삭제 |
| `device_auth.user_id` | OPS | 승인한 계정 | 만료 즉시 | 만료 정리 배치(§3.3), 계정 삭제 |
| `device_auth.status` | OPS | 승인 상태 | 만료 즉시 | 만료 정리 배치(§3.3), 계정 삭제 |
| `device_auth.expires_at` | OPS | 만료 시각 | 만료 즉시 | 만료 정리 배치(§3.3), 계정 삭제 |
| `device_auth.last_poll` | LOG | 폴링 제한용 마지막 시각 | 만료 즉시 | 만료 정리 배치(§3.3), 계정 삭제 |
| `device_auth.created_at` | LOG | 요청 시각 | 만료 즉시 | 만료 정리 배치(§3.3), 계정 삭제 |

### device_token — 런처 토큰

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `device_token.id` | OPS | 연결 기기 번호 | 연결 해제까지 | 기기 연결 해제, 계정 삭제 |
| `device_token.user_id` | OPS | 계정 연결 | 연결 해제까지 | 기기 연결 해제, 계정 삭제 |
| `device_token.token_hash` | SECRET | 런처 토큰 해시(토큰 자체는 저장하지 않음) | 연결 해제까지 | 기기 연결 해제, 계정 삭제 |
| `device_token.label` | LOG | 사용자가 보는 기기 이름 | 연결 해제까지 | 기기 연결 해제, 계정 삭제 |
| `device_token.created_at` | LOG | 연결 시각 | 연결 해제까지 | 기기 연결 해제, 계정 삭제 |
| `device_token.last_used_at` | LOG | 마지막 사용 시각 | 연결 해제까지 | 기기 연결 해제, 계정 삭제 |
| `device_token.revoked_at` | LOG | 해제 시각 | 연결 해제까지 | 기기 연결 해제, 계정 삭제 |

### user_replay — 사용자 업로드 리플레이

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `user_replay.id` | OPS | 리플레이 내부 번호(공개 주소에 쓰임) | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.user_id` | OPS | 소유 계정 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.sha256` | PSEUDO | 원본 파일 해시. 같은 파일 중복 업로드 방지 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.storage_key` | OPS | 원본 객체 위치. 원본 파일에는 참가자 닉네임·프로필 핸들·채팅이 있을 수 있음 | **분석·평가가 끝나면 즉시 삭제, 끝나지 않으면 분석 후 7일**(실패 7일, 미지원 빌드 30일, 대기·진행 중 14일). 이벤트 보류는 hold_until(A15, 구현 전) | 자동 삭제(`retention`), 리플레이 삭제, 계정 삭제 |
| `user_replay.source_deleted_at` | LOG | 원본 파일 삭제를 저장소가 확인한 시각 | 리플레이와 같음 | 리플레이 삭제, 계정 삭제 |
| `user_replay.source_delete_attempts` | OPS | 원본 삭제 실패 횟수(재시도 간격 증가, 10회에서 멈추고 운영 지표에 표시) | 리플레이와 같음 | 리플레이 삭제, 계정 삭제 |
| `user_replay.source_delete_next` | OPS | 다음 삭제 재시도 시각 | 리플레이와 같음 | 리플레이 삭제, 계정 삭제 |
| `user_replay.source_delete_error` | OPS | 마지막 삭제 실패 요약(스크럽됨) | 리플레이와 같음 | 리플레이 삭제, 계정 삭제 |
| `user_replay.size` | OPS | 원본 크기 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.status` | OPS | 분석 단계 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.reject_code` | OPS | 거절 사유 코드 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.client_version` | LOG | 업로더 버전 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.c2_at_upload` | CONSENT | 이 리플레이의 공개 허용 상태. 업로드 때 계정 동의로 정해지고 철회는 전체에 적용, 재허용은 소급 안 함(A13) | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.c3_at_upload` | CONSENT | 이 리플레이의 AI 학습 허용 상태(C2와 같은 규칙) | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.uploaded_at` | LOG | 업로드 시각 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.analyzed_at` | LOG | 분석 완료 시각 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.analysis` | PSEUDO | 분석 결과(지도·종족·승패·밴픽·해시 처리된 선수 키 handleKey). 핸들·닉네임 원문 없음(A3) | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.attempts` | OPS | 분석 재시도 횟수 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.available_at` | OPS | 다음 시도 가능 시각 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.claimed_at` | OPS | 워커 임대 시각 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.analyzer_version` | OPS | 분석기 버전 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.last_error` | OPS | 분석 오류 요약(파일 내용 없음) | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.timeline_key` | OPS | 타임라인 객체 위치. 타임라인에는 유닛 생애·통계, 해시 처리된 선수 키가 있음 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.timeline_size` | OPS | 타임라인 크기 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.timeline_schema` | OPS | 타임라인 스키마 버전 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.timeline_attempt` | OPS | 타임라인을 저장한 시도 번호 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.hidden_at` | OPS | 신고로 공개에서 내린 시각 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.hidden_reason` | OPS | 내린 사유 코드 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.eval_status` | OPS | AI 평가 단계 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.eval_attempts` | OPS | 평가 재시도 횟수 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.eval_available_at` | OPS | 평가 다음 시도 시각 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.eval_claimed_at` | OPS | 평가 임대 시각 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.eval_version` | OPS | 평가 버전 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.eval_error` | OPS | 평가 오류 요약 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.evaluation` | PSEUDO | AI 평가 결과(경기 곡선) | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.visibility_override` | CONSENT | 리플레이별 비공개 지정(A13). 계정 동의보다 우선 | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |
| `user_replay.training_excluded` | CONSENT | 리플레이별 AI 학습 제외(A13) | 리플레이 삭제·계정 삭제 | 리플레이 삭제·계정 삭제 |

### feedback — 문의·신고

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `feedback.id` | OPS | 문의·신고 번호 | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`), 본인 문의는 계정 삭제 |
| `feedback.kind` | OPS | 종류(bug/idea/replay) | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`), 본인 문의는 계정 삭제 |
| `feedback.replay_id` | OPS | 신고 대상 리플레이 | 처리 종결 후 1년(제안) | 리플레이 삭제 시 연결 해제, 만료 배치(`purge-feedback`) |
| `feedback.reason` | OPS | 신고 사유 코드 | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`) |
| `feedback.title` | CONTENT | 이용자가 쓴 제목 | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`), 본인 문의는 계정 삭제 |
| `feedback.body` | CONTENT | 이용자가 쓴 내용(개인정보가 들어갈 수 있음) | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`), 본인 문의는 계정 삭제 |
| `feedback.page` | LOG | 문의를 보낸 페이지의 경로만(주소·쿼리·조각 제거, 120자). 버그 재현용 | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`), 계정 삭제 시 비움 |
| `feedback.user_agent` | LOG | 브라우저 계열·주 버전·시스템 계열만(예: Chrome 130 · Windows). 원문은 저장하지 않음 | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`), 계정 삭제 시 비움 |
| `feedback.user_id` | OPS | 로그인 사용자 문의의 소유 계정(익명이면 비어 있음) | 처리 종결 후 1년(제안) | 계정 삭제 시 연결 해제, 본인 문의는 삭제 |
| `feedback.status` | OPS | 처리 상태 | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`) |
| `feedback.admin_note` | CONTENT | 운영자 메모 | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`) |
| `feedback.channel` | OPS | 문의가 사이트에서 왔는지 이메일로 왔는지(`web`/`email`). 개인정보 요청의 접수 경로 기록 | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`) |
| `feedback.contact` | CONTENT | 개인정보 요청자가 답변용으로 적은 이메일(선택). **요청이 종결되면 즉시 지움** | 종결까지(열린 동안만) | 종결 처리 때 비움, 만료 배치, 본인 문의는 계정 삭제 |
| `feedback.created_at` | LOG | 접수 시각 | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`) |
| `feedback.resolved_at` | LOG | 처리 종결 시각(보관기간 기준일) | 처리 종결 후 1년(제안) | 만료 배치(`purge-feedback`) |

### report_rate — 신고 횟수 제한(단기)

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `report_rate.key` | PSEUDO | 보낸 사람(IP 또는 계정)의 **시간별로 바뀌는** 키 해시. 다음 시간의 값과 연결되지 않고 문의 본문과도 저장되지 않음(§3.4) | 해당 시간이 끝난 뒤 최대 1시간 | 다음 문의 접수 때와 `purge-feedback` 호출 때 만료 행 삭제 |
| `report_rate.kind` | OPS | 문의 종류별 한도 | 위와 같음 | 위와 같음 |
| `report_rate.n` | OPS | 그 시간의 접수 횟수 | 위와 같음 | 위와 같음 |
| `report_rate.expires_at` | OPS | 삭제 가능 시각(키 시간의 다음 시간 끝) | 위와 같음 | 위와 같음 |

### storage_delete_queue — 삭제할 파일 대기열

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `storage_delete_queue.storage_key` | OPS | 행을 지운 뒤 아직 저장소에서 지우지 못한 파일 이름(§3.7). 행 삭제와 같은 문장에서 기록 | 저장소가 삭제를 확인할 때까지(재시도, 10회 후 포기하고 운영 지표에 표시) | 삭제 확인 즉시 이 행 삭제(`retention` 배치와 삭제 직후) |
| `storage_delete_queue.attempts` | OPS | 삭제 시도 횟수 | 위와 같음 | 위와 같음 |
| `storage_delete_queue.next_try` | OPS | 다음 시도 시각(간격 증가) | 위와 같음 | 위와 같음 |
| `storage_delete_queue.error` | OPS | 마지막 실패 요약(스크럽됨) | 위와 같음 | 위와 같음 |
| `storage_delete_queue.created_at` | LOG | 대기열에 들어간 시각(지연 감시용) | 위와 같음 | 위와 같음 |

### admin_audit — 운영자 작업 기록

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `admin_audit.id` | OPS | 기록 번호 | 1년(제안) | 만료 배치(`retention`) |
| `admin_audit.at` | LOG | 작업 시각 | 1년(제안) | 만료 배치(`retention`) |
| `admin_audit.actor` | LOG | 운영자 토큰 이름(사람이 아니라 토큰의 이름) | 1년(제안) | 만료 배치(`retention`) |
| `admin_audit.role` | OPS | 당시 역할 | 1년(제안) | 만료 배치(`retention`) |
| `admin_audit.action` | LOG | 한 일(스크린샷 열람, 신고 결정, 보관 배치 실행, 거부됨) | 1년(제안) | 만료 배치(`retention`) |
| `admin_audit.target` | LOG | 대상(예: feedback:12). 내용은 기록하지 않음 | 1년(제안) | 만료 배치(`retention`) |
| `admin_audit.detail` | LOG | 짧은 부가 정보(파일 번호, 처리 건수). 내용 없음 | 1년(제안) | 만료 배치(`retention`) |

### feedback_file — 문의 첨부

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `feedback_file.feedback_id` | OPS | 문의 연결 | 문의와 같음 | 문의 삭제, 만료 배치(`purge-feedback`) |
| `feedback_file.n` | OPS | 첨부 순번 | 문의와 같음 | 문의 삭제, 만료 배치(`purge-feedback`) |
| `feedback_file.storage_key` | OPS | 스크린샷 객체 위치(EXIF 등 메타데이터는 서버에서 제거 후 저장) | 문의와 같음 | 문의 삭제, 만료 배치(`purge-feedback`) |
| `feedback_file.mime` | OPS | 이미지 형식 | 문의와 같음 | 문의 삭제, 만료 배치(`purge-feedback`) |
| `feedback_file.size` | OPS | 크기 | 문의와 같음 | 문의 삭제, 만료 배치(`purge-feedback`) |

### event — 이벤트(운영자)

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `event.id` | OPS | 이벤트 번호 | 운영 데이터(영구) | 운영자 |
| `event.slug` | NONPERSONAL | 이벤트 주소 이름 | 운영 데이터(영구) | 운영자 |
| `event.kind` | NONPERSONAL | 이벤트 종류 | 운영 데이터(영구) | 운영자 |
| `event.name_ko` | NONPERSONAL | 이벤트 이름(한) | 운영 데이터(영구) | 운영자 |
| `event.name_en` | NONPERSONAL | 이벤트 이름(영) | 운영 데이터(영구) | 운영자 |
| `event.starts_at` | NONPERSONAL | 시작 시각 | 운영 데이터(영구) | 운영자 |
| `event.ends_at` | NONPERSONAL | 종료 시각 | 운영 데이터(영구) | 운영자 |

### game — 이벤트 경기(운영자, AI 대 AI)

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `game.id` | OPS | 이벤트 경기 번호 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.event_id` | OPS | 이벤트 연결 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.source` | OPS | 경기 출처(AI_EVENT 등) | 운영 데이터(영구) | 운영자(관리 API) |
| `game.matchup` | NONPERSONAL | 매치업 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.round` | NONPERSONAL | 라운드 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.series_key` | NONPERSONAL | 시리즈 묶음 키 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.game_no` | NONPERSONAL | 시리즈 내 경기 번호 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.map` | NONPERSONAL | 지도 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.ban_mode` | NONPERSONAL | 밴 방식 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.ban_count` | NONPERSONAL | 밴 수 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.mod_version` | NONPERSONAL | 모드 버전 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.balance_version` | NONPERSONAL | 밸런스 버전 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.played_at` | NONPERSONAL | 경기 시각 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.duration_sec` | NONPERSONAL | 경기 길이 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.winner_slot` | NONPERSONAL | 승자 자리 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.publish_at` | OPS | 공개 예약 시각(공개 결정 보류 수단) | 운영 데이터(영구) | 운영자(관리 API) |
| `game.summary` | NONPERSONAL | 주요 교전 요약 | 운영 데이터(영구) | 운영자(관리 API) |
| `game.created_at` | LOG | 등록 시각 | 운영 데이터(영구) | 운영자(관리 API) |

### game_player — 이벤트 경기 참가 AI

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `game_player.game_id` | OPS | 경기 연결 | 운영 데이터(영구) | 운영자(관리 API) |
| `game_player.slot` | OPS | 자리 | 운영 데이터(영구) | 운영자(관리 API) |
| `game_player.name` | NONPERSONAL | AI 페르소나 이름. 사람 참가자를 넣는 이벤트가 생기면 표기 동의(A15-10)가 먼저 필요 | 운영 데이터(영구) | 운영자(관리 API) |
| `game_player.race` | NONPERSONAL | 종족 | 운영 데이터(영구) | 운영자(관리 API) |
| `game_player.persona` | NONPERSONAL | AI 성향 | 운영 데이터(영구) | 운영자(관리 API) |
| `game_player.model_version` | NONPERSONAL | AI 모델 버전 | 운영 데이터(영구) | 운영자(관리 API) |
| `game_player.result` | NONPERSONAL | 결과 | 운영 데이터(영구) | 운영자(관리 API) |

### replay — 이벤트 경기 원본(운영자)

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `replay.id` | OPS | 이벤트 리플레이 번호 | 운영 데이터(영구) | 운영자(관리 API) |
| `replay.game_id` | OPS | 경기 연결 | 운영 데이터(영구) | 운영자(관리 API) |
| `replay.sha256` | NONPERSONAL | AI 경기 파일 해시 | 운영 데이터(영구) | 운영자(관리 API) |
| `replay.storage_key` | OPS | AI 경기 원본 객체 위치(공개 시각 이후 내려받기 허용) | 운영 데이터(영구) | 운영자(관리 API) |
| `replay.size` | OPS | 크기 | 운영 데이터(영구) | 운영자(관리 API) |
| `replay.uploaded_at` | LOG | 등록 시각 | 운영 데이터(영구) | 운영자(관리 API) |

### draft_event — 이벤트 경기 밴픽

| 열 | 분류 | 목적·근거 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `draft_event.game_id` | OPS | 경기 연결 | 운영 데이터(영구) | 운영자(관리 API) |
| `draft_event.seq` | OPS | 밴픽 순서 | 운영 데이터(영구) | 운영자(관리 API) |
| `draft_event.slot` | OPS | 자리 | 운영 데이터(영구) | 운영자(관리 API) |
| `draft_event.action` | NONPERSONAL | 밴/픽/교체 | 운영 데이터(영구) | 운영자(관리 API) |
| `draft_event.unit_id` | NONPERSONAL | 유닛 | 운영 데이터(영구) | 운영자(관리 API) |
| `draft_event.replaces_unit_id` | NONPERSONAL | 교체된 유닛 | 운영 데이터(영구) | 운영자(관리 API) |

## 객체 저장소(R2·로컬) 항목

| 접두사 | 내용 | 분류 | 보유기간 | 삭제 경로 |
|---|---|---|---|---|
| `users/<계정>/<해시>.SC2Replay` | 사용자 원본 리플레이(닉네임·핸들·채팅 포함 가능) | 이용자 작성 내용 | 분석·평가가 끝나면 삭제(§3.1), 아니면 최장 7일(실패 7일, 미지원 30일, 대기 14일). 이벤트 보류는 hold_until(A15, 구현 전) | 리플레이 삭제, 계정 삭제, 보관기간 배치 |
| `analysis/<계정>/<번호>.timeline.json.gz` | 분석 타임라인(핸들 원문 없음, 해시 키만) | 가명·파생 | 리플레이와 같음 | 리플레이 삭제, 계정 삭제 |
| `feedback/<번호>/<순번>.<확장자>` | 문의 스크린샷(메타데이터 제거본) | 이용자 작성 내용 | 문의와 같음 | 문의 삭제, 계정 삭제(본인 문의) |
| `events/<이벤트>/<해시>.SC2Replay` | 운영자가 올린 AI 경기 원본 | 개인정보 아님 | 운영 데이터 | 운영자 |

## JSON 필드 안의 개인 관련 값

| 위치 | 값 | 처리 |
|---|---|---|
| `user_replay.analysis.players[].handleKey` | Battle.net 핸들의 키 해시(`BPM_HANDLE_KEY`) | 같은 경기를 두 선수가 올렸는지 알아보는 용도에만 사용. 공개 응답·공개 타임라인에서 제거 |
| `user_replay.analysis.players[].handle` | 핸들 원문 | **저장하지 않는다.** 서버가 도착 시 제거하고 읽을 때도 제거(A3) |
| 타임라인 `players[].handleKey / handle` | 위와 같음 | 위와 같음 |
| 분석·타임라인의 닉네임 | — | 워커가 처음부터 버린다 |

## 서버·플랫폼 로그

| 로그 | 내용 | 보유기간 | 확인할 것 |
|---|---|---|---|
| 앱 로그(`lib/server/log.ts`) | 실패의 종류·상태 코드·발생 위치·짧은 요청 번호. IP, 쿠키, 토큰, 이메일, 핸들, 닉네임, 쿼리 문자열, 사용자가 쓴 글은 기록 전에 제거(`lib/logScrub.ts`). 린트 규칙 `no-console`이 다른 곳의 직접 출력을 막음 | 호스팅 로그 보관기간을 따름 | 개발자가 새 로그를 `logError`/`logWarn`으로만 남기는지 |
| 호스팅(Railway) 요청·배포 로그 | 플랫폼이 남기는 요청 기록(IP 포함 가능) | 플랜에 따라 다름. 30~90일(제안)로 맞추고 설정을 확인 | Railway 화면에서 보관일, 접근 권한, IP 기록 여부(A14) |
| 워커 출력 | 작업 번호와 단계. 리플레이 내용·핸들은 출력하지 않음 | 호스팅 로그와 같음 | 오류 문자열이 서버 응답을 그대로 담을 수 있어 정기 점검 |

## 외부 전송·위탁

| 대상 | 보내는 값 | 용도 | 확인할 것 |
|---|---|---|---|
| Railway(앱·DB·워커) | 위 모든 DB 열, 로컬 볼륨 객체 | 서비스 운영 | 리전, 백업 보관일, 로그 보관일, 국외 이전 고지(A14) |
| Cloudflare R2 | 위 객체 저장소 항목 | 객체 보관 | 버킷 위치·관할 |
| Battle.net(Blizzard) OAuth | 로그인 요청(계정 식별자·표시명을 받음) | 로그인 | 처리방침 위탁·제공 고지 |
| 운영자 채팅 웹훅(선택) | 문의 종류·번호와 운영자 수신함 주소(사용자가 쓴 내용은 보내지 않음) | 운영 알림 | 사용 여부와 위탁 고지 |
