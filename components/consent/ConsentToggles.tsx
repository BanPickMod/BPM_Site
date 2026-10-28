"use client";

import type { Lang } from "@/lib/i18n/config";

export interface ConsentValue {
  c1: boolean;
  c2: boolean;
  c3: boolean;
}

/** The three independent consent switches (docs/BPM_Backend_Plan.md section 2). Nothing is on by default anywhere. */
export function ConsentToggles({
  lang,
  value,
  onChange,
  disabled,
}: {
  lang: Lang;
  value: ConsentValue;
  onChange: (next: ConsentValue) => void;
  disabled?: boolean;
}) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const rows: { key: keyof ConsentValue; title: string; text: string; off: string }[] = [
    {
      key: "c1",
      title: t("[선택] 분석용 업로드 (C1)", "[Optional] Analysis upload (C1)"),
      text: t("리플레이 파일과 지도·종족·승패·밴픽·유닛 기록을 처리해 나만 볼 수 있는 분석 화면을 만듭니다. 참가자 프로필 핸들은 되돌릴 수 없는 해시로만 저장합니다. 원본 파일은 분석·평가가 끝나면 삭제되고(최장 7일), 분석 결과는 직접 삭제하거나 회원 탈퇴할 때까지 보관합니다. 동의하지 않으면 런처 업로드·분석은 이용할 수 없습니다.", "Processes the replay file, map, race, result, draft and unit records to create an analysis visible only to you. Participant profile handles are stored only as an irreversible hash. The original file is deleted once analysis and evaluation finish (7 days at most); the analysis is kept until you delete it or close your account. Without C1, launcher upload and analysis are unavailable."),
      off: t("끄면: 새 업로드와 분석이 바로 멈춥니다. 이미 올린 리플레이는 남아 있으니, 지우려면 아래 '리플레이 모두 삭제'를 쓰세요.", "Turning it off: new uploads and analysis stop at once. Replays you already uploaded stay; use 'Delete all replays' below to remove them."),
    },
    {
      key: "c2",
      title: t("[선택] 공개 열람 및 익명 통계 (C2)", "[Optional] Public viewing and anonymous statistics (C2)"),
      text: t("닉네임·프로필 핸들·채팅·업로더 정보를 제외한 분석·재생 화면을 플레이어 1/2로 공개하고 익명 통계에 반영합니다. C2 철회, 삭제 요청 처리 또는 회원 탈퇴 시 공개와 집계가 중단됩니다. 원본 파일은 공개하지 않습니다.", "Publishes analysis and playback as Player 1/2 without names, profile handles, chat or uploader details, and includes it in anonymous statistics. Publication and counting stop when C2 is withdrawn, a removal request is accepted, or the account is deleted. The original file is never shared."),
      off: t("끄면: 이미 공개한 모든 리플레이가 공개 목록·공유 링크·통계에서 바로 사라집니다. 다시 켜도 이미 올린 리플레이는 자동으로 공개되지 않습니다.", "Turning it off: every replay you made public leaves the public list, share links and statistics at once. Turning it on again does not publish replays you already uploaded."),
    },
    {
      key: "c3",
      title: t("[선택] AI 학습 활용 (C3)", "[Optional] AI training use (C3)"),
      text: t("향후 닉네임·프로필 핸들·채팅을 제거한 게임 플레이 기록을 AI 학습 후보로 사용할 수 있습니다. 현재 학습 파이프라인은 운영하지 않습니다. 철회하면 사용 전 후보에서 즉시 제외되며, 철회 전에 학습이 끝난 모델 가중치에는 영향을 주지 않습니다.", "Allows future use of gameplay records with names, profile handles and chat removed as AI-training candidates. No training pipeline is currently operating. Withdrawal removes unused candidates immediately but does not alter model weights trained before withdrawal."),
      off: t("끄면: 아직 학습에 쓰이지 않은 모든 리플레이가 후보에서 바로 빠집니다.", "Turning it off: every replay not yet used for training leaves the candidates at once."),
    },
  ];
  return (
    <div className="consent">
      {rows.map((r) => (
        <label key={r.key} className="tgl consent-row">
          <input type="checkbox" checked={value[r.key]} disabled={disabled} onChange={(e) => onChange({ ...value, [r.key]: e.target.checked })} />
          <span className="sw" />
          <span className="consent-text">
            <b>{r.title}</b>
            <span>{r.text}</span>
            <span className="dim">{r.off}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
