"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n/config";

/** Anyone can report a public replay; the opponent in it never agreed to be shown. Opponent and privacy reports hide it at once. */
export function ReportReplay({ id, lang }: { id: number; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [reason, setReason] = useState("opponent");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [hidden, setHidden] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch(`/api/shared/${id}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason, note }) });
      if (!res.ok) return setState("error");
      setHidden(((await res.json()) as { hidden: boolean }).hidden);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="dim" role="status">
        {hidden ? t("신고를 받았고, 검토하는 동안 이 경기는 공개 페이지에서 내려갑니다.", "Report received. This replay is taken off the public pages while it is reviewed.") : t("신고를 받았습니다. 운영자가 검토합니다.", "Report received. An operator will review it.")}
      </p>
    );
  }
  return (
    <details className="report">
      <summary>{t("이 경기 신고 / 삭제 요청", "Report this replay / request removal")}</summary>
      <form onSubmit={submit}>
        <p className="dim">{t("이 경기에 나온 플레이어(상대 포함)라면 삭제를 요청할 수 있습니다. 상대 닉네임은 저장·표시하지 않습니다.", "If you played in this game (including as the opponent) you can ask for it to be removed. Player names are never stored or shown.")}</p>
        <label>
          {t("사유", "Reason")}
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="opponent">{t("내가 상대 플레이어입니다 (삭제 요청)", "I was the opponent (remove it)")}</option>
            <option value="privacy">{t("개인정보가 보입니다", "It shows personal information")}</option>
            <option value="other">{t("기타", "Other")}</option>
          </select>
        </label>
        <label>
          {t("내용 (선택, 500자까지)", "Details (optional, up to 500 characters)")}
          <textarea value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="btn btn-danger" type="submit" disabled={state === "busy"}>{t("신고 보내기", "Send report")}</button>
        {state === "error" && <p role="alert" className="dim">{t("보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Could not send. Please try again later.")}</p>}
      </form>
    </details>
  );
}
