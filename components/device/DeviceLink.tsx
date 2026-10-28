"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n/config";
import { SignInCard } from "@/components/auth/SignInCard";
import { ConsentToggles, type ConsentValue } from "@/components/consent/ConsentToggles";
import { AgeGate, BasicProcessingNotice } from "@/components/consent/PolicyNotice";

interface Props {
  lang: Lang;
  initialCode: string;
  signedInAs: string | null;
  ageConfirmed: boolean;
  devLogin: boolean;
}

/** Links a launcher to the signed-in account and records consent in the same step. Nothing is pre-checked. */
export function DeviceLink({ lang, initialCode, signedInAs, ageConfirmed: initialAgeConfirmed, devLogin }: Props) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [user, setUser] = useState(signedInAs);
  const [ageConfirmed, setAgeConfirmed] = useState(initialAgeConfirmed);
  const [code, setCode] = useState(initialCode);
  const [consent, setConsent] = useState<ConsentValue>({ c1: false, c2: false, c3: false });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/auth/device-approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_code: code, ...consent }),
    });
    const json = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    setBusy(false);
    if (res.ok) setMsg({ ok: true, text: t("연결되었습니다. 런처로 돌아가세요.", "Linked. You can return to the launcher.") });
    else if (json.code === "BAD_CODE") setMsg({ ok: false, text: t("코드가 없거나 만료되었습니다. 런처에서 새 코드를 받으세요.", "Code not found or expired. Get a new one in the launcher.") });
    else setMsg({ ok: false, text: String(json.error ?? res.status) });
  }

  if (!user) {
    return (
      <div className="info">
        <SignInCard lang={lang} devLogin={devLogin} onSignedIn={(name) => { setUser(name); setAgeConfirmed(true); }} />
      </div>
    );
  }

  return (
    <div className="info">
      <section>
        <p>
          {t("로그인:", "Signed in as")} <b>{user}</b>
        </p>
        <div className="field">
          <label htmlFor="link-code">{t("런처에 표시된 코드", "Code shown in the launcher")}</label>
          <input id="link-code" className="inp mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD-EFGH" maxLength={9} />
        </div>
      </section>
      {!ageConfirmed && <section><AgeGate lang={lang} onConfirmed={() => setAgeConfirmed(true)} /></section>}
      <section>
        <h2 className="h2">{t("선택 동의", "Optional consent")}</h2>
        <BasicProcessingNotice lang={lang} />
        <p className="note">{t("각 항목은 독립적이며 언제든 철회할 수 있습니다. 기본값은 모두 꺼짐입니다.", "Each item is independent and can be withdrawn any time. All are off by default.")}</p>
        <ConsentToggles lang={lang} value={consent} onChange={setConsent} />
        <p>
          <button className="btn btn-pri" onClick={approve} disabled={busy || !ageConfirmed || !consent.c1 || code.length < 9}>
            {t("런처 연결", "Link launcher")}
          </button>
        </p>
        {msg && (
          <p role="alert" className={msg.ok ? "note" : undefined}>
            {msg.text}
          </p>
        )}
      </section>
    </div>
  );
}
