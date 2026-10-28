"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n/config";
import { ConsentToggles, type ConsentValue } from "./ConsentToggles";
import { AgeGate, BasicProcessingNotice } from "./PolicyNotice";

/**
 * The first-sign-in page: the basic processing notice, then the three optional consents, nothing pre-selected. Finishing with every
 * switch off is a normal outcome and the button says so. The choices are saved only when the button is pressed.
 */
export function OnboardingForm({ lang, next, ageConfirmed }: { lang: Lang; next: string; ageConfirmed: boolean }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const router = useRouter();
  const [consent, setConsent] = useState<ConsentValue>({ c1: false, c2: false, c3: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allOff = !consent.c1 && !consent.c2 && !consent.c3;

  async function finish() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(consent) });
    if (res.ok) {
      router.push(next);
      router.refresh();
      return;
    }
    setBusy(false);
    setError(t("저장하지 못했습니다. 다시 시도하세요.", "Could not save. Try again."));
  }

  if (!ageConfirmed) return <AgeGate lang={lang} />;
  return (
    <section>
      <p className="dim">{t("만 14세 이상 확인: 완료", "Age (14 or older) confirmation: done")}</p>
      <BasicProcessingNotice lang={lang} />
      <h2 className="h2">{t("선택 동의", "Optional consents")}</h2>
      <p className="dim">{t("각 항목은 서로 독립적이고, 켜지 않아도 사이트의 정보와 가이드를 이용할 수 있습니다. 나중에 계정 설정에서 언제든 바꿀 수 있고, 끄면 바로 적용됩니다.", "Each item is independent and the site's information and guides work without any of them. You can change them any time in account settings; turning one off takes effect at once.")}</p>
      <ConsentToggles lang={lang} value={consent} onChange={setConsent} disabled={busy} />
      <p>
        <button className="btn btn-pri" disabled={busy} onClick={finish}>
          {allOff ? t("선택 동의 없이 시작하기", "Start without optional consents") : t("선택한 대로 시작하기", "Start with these choices")}
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
