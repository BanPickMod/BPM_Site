"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n/config";
import { BasicProcessingNotice } from "@/components/consent/PolicyNotice";

/** Battle.net sign-in prompt. Development builds can additionally expose the name-only test login. */
export function SignInCard({ lang, devLogin, onSignedIn }: { lang: Lang; devLogin: boolean; onSignedIn?: (name: string) => void }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [age14, setAge14] = useState(false);

  async function login() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/dev/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, age14 }) });
    const json = (await res.json().catch(() => ({}))) as { displayName?: string; error?: string };
    setBusy(false);
    if (!res.ok) return setError(json.error ?? String(res.status));
    onSignedIn?.(json.displayName ?? name);
    router.refresh();
  }

  return (
    <div className="ev">
      <h2 className="ev-t">{t("로그인이 필요합니다", "Sign in to continue")}</h2>
      <BasicProcessingNotice lang={lang} />
      <label className="consent-row">
        <input type="checkbox" checked={age14} onChange={(e) => setAge14(e.target.checked)} />{" "}
        <span>
          <b>{t("[필수] 본인은 만 14세 이상입니다.", "[Required] I am at least 14 years old.")}</b>
          <small>{t(" 본 서비스는 만 14세 미만 아동의 가입과 이용을 제한합니다.", " Registration and use by children under 14 is not allowed.")}</small>
        </span>
      </label>
      <p>
        <a className={`btn btn-pri${age14 ? "" : " disabled"}`} href={age14 ? `/api/auth/battlenet?lang=${lang}&age=14` : undefined} aria-disabled={!age14} onClick={(e) => !age14 && e.preventDefault()}>
          {t("Battle.net으로 로그인", "Sign in with Battle.net")}
        </a>
      </p>
      {devLogin ? (
        <>
          <p className="note">{t("아래는 Battle.net 없이 사용하는 개발용 로그인입니다(운영에는 없음).", "The form below is a development-only sign-in without Battle.net (not available in production).")}</p>
          <div className="field">
            <label htmlFor="dev-name">{t("이름", "Name")}</label>
            <input id="dev-name" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} onKeyDown={(e) => e.key === "Enter" && name.trim() && login()} />
          </div>
          <button className="btn btn-pri" onClick={login} disabled={busy || !age14 || !name.trim()}>
            {t("로그인", "Sign in")}
          </button>
          {error && <p role="alert">{error}</p>}
        </>
      ) : (
        <p>
          {t(
            "Battle.net 계정으로 로그인하면 올린 리플레이와 분석 결과를 볼 수 있습니다.",
            "Sign in with your Battle.net account to see your uploaded replays and their analysis.",
          )}
        </p>
      )}
    </div>
  );
}
