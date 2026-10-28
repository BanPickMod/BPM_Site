"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n/config";

export function BasicProcessingNotice({ lang }: { lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  return (
    <div className="note">
      <b>{t("기본 서비스 제공을 위한 처리 안내", "Processing required to provide the basic service")}</b>
      <p>{t(
        "로그인 시 Battle.net 계정 식별자·표시 이름과 동의 변경 이력을 처리하며 회원 탈퇴 시까지 보관합니다. 이는 계정 로그인, 보안, 설정 저장 등 계약의 체결·이행에 필요한 처리로 별도 동의 대상이 아닙니다.",
        "When you sign in, we process your Battle.net account identifier, display name and consent history until account deletion. This is necessary to provide login, security and saved settings and is not presented as optional consent.",
      )}</p>
      <p className="dim">
        <Link href={`/${lang}/privacy`}>{t("개인정보 처리방침", "Privacy Policy")}</Link>{" · "}
        <Link href={`/${lang}/terms`}>{t("이용약관", "Terms of Service")}</Link>
      </p>
    </div>
  );
}

/** One-time self-declaration for accounts created before the login age gate was introduced. */
export function AgeGate({ lang, onConfirmed }: { lang: Lang; onConfirmed?: () => void }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/age", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ age14: true }) });
    setBusy(false);
    if (!res.ok) return setError(t("확인 내용을 저장하지 못했습니다.", "Could not save the confirmation."));
    onConfirmed?.();
    router.refresh();
  }

  return (
    <div className="danger">
      <b>{t("연령 확인이 필요합니다", "Age confirmation required")}</b>
      <label className="consent-row">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />{" "}
        <span><b>{t("[필수] 본인은 만 14세 이상입니다.", "[Required] I am at least 14 years old.")}</b></span>
      </label>
      <p className="dim">{t("본 서비스는 만 14세 미만 아동의 가입과 이용을 제한합니다. 생년월일은 수집하지 않습니다.", "This service does not allow registration or use by children under 14. We do not collect your date of birth.")}</p>
      <button className="btn btn-pri" disabled={!checked || busy} onClick={confirm}>{t("확인", "Confirm")}</button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
