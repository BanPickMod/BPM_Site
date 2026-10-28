"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n/config";
import { ConsentToggles, type ConsentValue } from "./ConsentToggles";
import { BasicProcessingNotice } from "./PolicyNotice";

/** Saves each change right away (PUT /api/me/consent), so a switch always shows what the server holds. */
export function ConsentPanel({ lang, initial }: { lang: Lang; initial: ConsentValue }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const seq = useRef(0);

  async function change(next: ConsentValue) {
    const prev = value;
    const mine = ++seq.current;
    setValue(next);
    setState("saving");
    try {
      const res = await fetch("/api/me/consent", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      if (mine !== seq.current) return; // a newer click is in flight; let it decide the final state
      if (!res.ok) throw new Error(String(res.status));
      setState("saved");
    } catch {
      if (mine !== seq.current) return;
      setValue(prev);
      setState("error");
    }
  }

  return (
    <div className="consent-panel">
      <BasicProcessingNotice lang={lang} />
      <ConsentToggles lang={lang} value={value} onChange={change} />
      <p className="consent-status mono" role="status" aria-live="polite">
        {state === "saving" && t("저장 중…", "Saving…")}
        {state === "saved" && t("저장되었습니다. 끄면 이미 올린 리플레이에도 바로 적용됩니다. 켜도 이미 올린 리플레이는 공개되지 않으며, 리플레이마다 직접 켭니다.", "Saved. Turning an option off applies to replays you already uploaded at once. Turning it on does not open them: you choose that per replay.")}
        {state === "error" && t("저장하지 못했습니다. 다시 시도하세요.", "Could not save. Try again.")}
      </p>
      <p className="dim"><Link href={`/${lang}/privacy`}>{t("개인정보 처리방침 보기", "Read the Privacy Policy")}</Link></p>
      {!value.c1 && <p className="note">{t("분석용 업로드가 꺼져 있어 새 리플레이는 올라가지 않습니다.", "Analysis upload is off, so new replays are not uploaded.")}</p>}
    </div>
  );
}
