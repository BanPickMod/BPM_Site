"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n/config";

interface Notice { version: string; kind: "notice" | "consent"; affects: ("c1" | "c2" | "c3")[]; ko: string; en: string }
interface Me {
  onboarded: boolean;
  notices: Notice[];
  consent: { c1: boolean; c2: boolean; c3: boolean; reconsentPending: ("c1" | "c2" | "c3")[] };
}

const NAME = { c1: ["분석용 업로드 (C1)", "Analysis upload (C1)"], c2: ["공개·통계 (C2)", "Public viewing and statistics (C2)"], c3: ["AI 학습 (C3)", "AI training (C3)"] } as const;

/**
 * Tells a signed-in user what changed in the privacy policy since they last looked (docs/Privacy_Compliance_Additional_Plan.md,
 * section 3.6). It never blocks anything. A consent that a change switched off is listed with "turn on again" and "keep off".
 */
export function PolicyBanner({ lang }: { lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    fetch("/api/me", { signal: c.signal, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .then(setMe)
      .catch(() => undefined);
    return () => c.abort();
  }, []);

  if (!me || !me.onboarded) return null;
  const pending = me.consent.reconsentPending;
  if (!me.notices.length && !pending.length) return null;

  async function dismiss() {
    setBusy(true);
    await fetch("/api/me/policy", { method: "POST" });
    setMe(null);
  }
  async function turnOn(key: "c1" | "c2" | "c3") {
    setBusy(true);
    const next = { c1: me!.consent.c1, c2: me!.consent.c2, c3: me!.consent.c3, [key]: true };
    await fetch("/api/me/consent", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    const r = await fetch("/api/me", { cache: "no-store" });
    setMe(r.ok ? ((await r.json()) as Me) : null);
    setBusy(false);
  }

  return (
    <aside className="note" role="region" aria-label={t("개인정보 처리방침 변경 안내", "Privacy policy changes")} style={{ margin: "0 auto", maxWidth: 1100, padding: "12px 16px" }}>
      <b>{t("개인정보 처리방침이 바뀌었습니다", "The privacy policy has changed")}</b>
      <ul>
        {me.notices.map((n) => (
          <li key={n.version}>{t(n.ko, n.en)}</li>
        ))}
      </ul>
      {pending.length > 0 && (
        <>
          <p>{t("바뀐 내용이 아래 동의의 범위에 영향을 주어, 다시 확인하기 전까지 꺼 두었습니다.", "The change affects the consents below, so they are off until you confirm them again.")}</p>
          <ul>
            {pending.map((k) => (
              <li key={k}>
                {t(NAME[k][0], NAME[k][1])}{" "}
                <button className="btn btn-sec" disabled={busy} onClick={() => turnOn(k)}>{t("다시 켜기", "Turn on again")}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="dim">
        <Link href={`/${lang}/privacy`}>{t("개인정보 처리방침 보기", "Read the Privacy Policy")}</Link>{" · "}
        <button className="btn btn-sec" disabled={busy} onClick={dismiss}>{pending.length ? t("확인하고 꺼 둔 채로 두기", "I have read it; keep them off") : t("확인했습니다", "I have read it")}</button>
      </p>
    </aside>
  );
}
