"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n/config";
import { REQUEST_LABEL, REQUEST_TYPES, type RequestType } from "@/lib/privacyRequest";

/** A request about one's own data. Signed in: the answer is tied to the account. Not signed in: say so, and leave a contact address. */
export function PrivacyRequestForm({ lang, signedIn, days }: { lang: Lang; signedIn: boolean; days: number }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [type, setType] = useState<RequestType>("access");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [due, setDue] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const res = await fetch("/api/privacy-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, details, contact }) });
    const j = (await res.json().catch(() => ({}))) as { code?: string; dueAt?: string };
    if (!res.ok) {
      setError(
        j.code === "RATE_LIMIT" ? t("잠시 뒤 다시 보내 주세요(시간당 횟수 제한).", "Please wait a bit (hourly limit).")
        : j.code === "TOO_SHORT" ? t("내용을 5자 이상 적어 주세요.", "Please write at least 5 characters.")
        : j.code === "BAD_CONTACT" ? t("이메일 주소 형식이 맞지 않습니다.", "That does not look like an email address.")
        : t("보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Could not send. Please try again later."),
      );
      return setState("idle");
    }
    setDue(j.dueAt ? new Date(j.dueAt).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US") : "");
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="ev" role="status">
        <h2 className="ev-t">{t("요청을 받았습니다", "We have your request")}</h2>
        <p className="dim">
          {t(`접수 시각이 기록되었고, ${due}까지 답변드리는 것을 목표로 합니다.`, `The time of receipt is recorded. We aim to answer by ${due}.`)}{" "}
          {contact ? t("답변은 입력하신 이메일로 보냅니다. 처리가 끝나면 이메일 주소는 삭제됩니다.", "The answer goes to the address you gave; it is deleted when the request is closed.") : t("이메일을 남기지 않으셨으므로 답변을 직접 보내 드릴 수 없습니다. 필요하면 sc2.bpm@gmail.com으로 접수 시각과 함께 문의해 주세요.", "You gave no email, so we cannot send the answer to you. Write to sc2.bpm@gmail.com with the time of your request if you need one.")}
        </p>
      </div>
    );
  }

  return (
    <form className="fb-form" onSubmit={submit}>
      <fieldset className="fb-kind">
        <legend className="vh">{t("요청 종류", "Kind of request")}</legend>
        {REQUEST_TYPES.map((r) => (
          <label key={r}><input type="radio" name="type" checked={type === r} onChange={() => setType(r)} /> {t(REQUEST_LABEL[r][0], REQUEST_LABEL[r][1])}</label>
        ))}
      </fieldset>
      <label>
        {t("요청 내용", "What you are asking for")}
        <textarea value={details} maxLength={4000} required minLength={5} rows={7} onChange={(e) => setDetails(e.target.value)} />
      </label>
      <label>
        {t("답변받을 이메일 (선택)", "Email for the answer (optional)")}
        <input type="email" value={contact} maxLength={120} onChange={(e) => setContact(e.target.value)} autoComplete="email" />
      </label>
      <p className="dim">
        {signedIn
          ? t("로그인한 계정으로 접수되어 본인 확인에 사용됩니다.", "It is filed under your signed-in account, which is how we confirm it is you.")
          : t("로그인하지 않으면 계정 데이터에 대한 요청의 본인 확인이 어렵습니다. 계정에 대한 요청이면 먼저 로그인해 주세요.", "Without signing in we cannot confirm a request about an account. If it is about your account, sign in first.")}{" "}
        {t(`처리 기한은 접수 후 ${days}일을 기준으로 삼습니다. 신분증이나 개인 서류는 보내지 마세요.`, `We count ${days} days from receipt. Do not send identity documents or personal papers.`)}
      </p>
      {error && <p role="alert" className="fb-err">{error}</p>}
      <button className="btn btn-pri" type="submit" disabled={state === "busy"}>{state === "busy" ? t("보내는 중…", "Sending…") : t("요청 보내기", "Send request")}</button>
    </form>
  );
}
