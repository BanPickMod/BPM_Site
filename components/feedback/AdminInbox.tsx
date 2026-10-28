"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n/config";

interface Item {
  id: number; kind: "bug" | "idea" | "replay" | "privacy_request"; replay_id: number | null; reason: string | null; title: string | null; body: string | null;
  page: string | null; user_agent: string | null; signed_in: boolean; status: string; admin_note: string | null; created_at: string;
  files: number; replay_hidden: boolean | null;
  channel: string; contact: string | null; due_at: string | null; overdue: boolean;
}

const KEY = "bpm-operator-token";

// The session (or, outside production, the token) lives in this tab's sessionStorage only. A tiny store keeps React in sync with it without an effect.
const listeners = new Set<() => void>();
const readToken = () => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const writeToken = (v: string) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch { /* private mode: not remembered */ } listeners.forEach((f) => f()); };
const subscribeToken = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export function AdminInbox({ lang }: { lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const token = useSyncExternalStore(subscribeToken, readToken, () => "");
  const [entered, setEntered] = useState("");
  const [otp, setOtp] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [status, setStatus] = useState("OPEN");
  const msg = { wrong: t("세션이 끝났거나 맞지 않습니다. 다시 로그인하세요.", "The session ended or is not valid. Sign in again."), load: t("불러오지 못했습니다.", "Could not load.") };
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!token) return;
    const ctl = new AbortController();
    const q = new URLSearchParams({ status, ...(kind ? { kind } : {}) });
    fetch(`/api/admin/feedback?${q}`, { headers: { authorization: `Bearer ${token}` }, signal: ctl.signal })
      .then(async (res) => {
        if (!res.ok) { setItems(null); if (res.status === 401) { writeToken(""); return setError(msg.wrong); } return setError(msg.load); }
        setError(null);
        const j = (await res.json()) as { items: Item[]; open: Record<string, number> };
        setItems(j.items);
        setOpen(j.open);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [token, status, kind, tick, msg.wrong, msg.load]);

  async function act(id: number, action: string, note?: string) {
    const res = await fetch(`/api/admin/feedback/${id}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ action, note }) });
    if (!res.ok) setError(t("처리하지 못했습니다.", "Could not apply."));
    setTick((n) => n + 1);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/admin/login", { method: "POST", headers: { authorization: `Bearer ${entered}`, "content-type": "application/json" }, body: JSON.stringify({ otp }) }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { session?: string; code?: string } | undefined;
    setOtp("");
    if (res?.ok && body?.session) { setEntered(""); setError(null); return writeToken(body.session); }
    if (body?.code === "NO_TOTP") { writeToken(entered); setEntered(""); return; }     // outside production: no code is set up for this operator
    const reasons: Record<string, string> = {
      BAD_CODE: t("코드가 맞지 않거나 이미 사용한 코드입니다. 다음 코드가 나오면 다시 입력하세요.", "The code is wrong or was already used. Enter the next code."),
      LOCKED: t("틀린 횟수가 많아 15분간 잠겼습니다.", "Too many wrong codes. Locked for 15 minutes."),
      TWO_FACTOR_NOT_SET_UP: t("이 운영자에게 인증 앱이 설정되어 있지 않습니다.", "No authenticator is set up for this operator."),
    };
    setLoginError(res && body?.code && reasons[body.code] ? reasons[body.code] : t("토큰이 맞지 않습니다.", "Wrong token."));
  }

  if (!token) {
    return (
      <form className="fb-form" onSubmit={signIn}>
        <label>
          {t("운영자 토큰", "Operator token")}
          <input type="password" autoComplete="off" value={entered} onChange={(e) => setEntered(e.target.value)} />
        </label>
        <label>
          {t("인증 앱의 6자리 코드", "6-digit code from the authenticator app")}
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={otp} onChange={(e) => setOtp(e.target.value)} />
        </label>
        {loginError && <p role="alert" className="fb-err">{loginError}</p>}
        {error && <p role="alert" className="fb-err">{error}</p>}
        <button className="btn btn-pri" type="submit">{t("열기", "Open")}</button>
      </form>
    );
  }

  const n = (k: string) => (k ? open[k] ?? 0 : Object.values(open).reduce((a, b) => a + b, 0));
  const kinds: [string, string][] = [["", t("전체", "All")], ["bug", t("버그", "Bugs")], ["idea", t("의견", "Ideas")], ["replay", t("리플레이 신고", "Replay reports")], ["privacy_request", t("개인정보 요청", "Privacy requests")]];
  const statuses: [string, string][] = [["OPEN", t("처리 전", "Open")], ["RESOLVED", t("처리됨", "Resolved")], ["DISMISSED", t("기각", "Dismissed")]];
  return (
    <div className="ib">
      <div className="ib-bar">
        <nav className="chips" aria-label={t("종류", "Kind")}>{kinds.map(([k, label]) => <button key={k} className={`chip${kind === k ? " on" : ""}`} onClick={() => setKind(k)}>{label}{n(k) > 0 ? ` (${n(k)})` : ""}</button>)}</nav>
        <nav className="chips" aria-label={t("상태", "Status")}>{statuses.map(([s, label]) => <button key={s} className={`chip${status === s ? " on" : ""}`} onClick={() => setStatus(s)}>{label}</button>)}</nav>
        <button className="btn" onClick={() => { writeToken(""); setItems(null); }}>{t("잠그기", "Lock")}</button>
      </div>
      {error && <p role="alert" className="fb-err">{error}</p>}
      {items && items.length === 0 && <p className="dim">{t("비어 있습니다.", "Nothing here.")}</p>}
      <ul className="ib-list">
        {items?.map((it) => <Row key={it.id} it={it} lang={lang} token={token} act={act} />)}
      </ul>
    </div>
  );
}

function Row({ it, lang, token, act }: { it: Item; lang: Lang; token: string; act: (id: number, action: string, note?: string) => Promise<void> }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [note, setNote] = useState(it.admin_note ?? "");
  const [shots, setShots] = useState<string[]>([]);

  useEffect(() => {
    let dead = false;
    const urls: string[] = [];
    (async () => {
      for (let n = 0; n < it.files; n++) {
        const res = await fetch(`/api/admin/feedback/${it.id}/files/${n}`, { headers: { authorization: `Bearer ${token}` } });
        if (!res.ok || dead) continue;
        const u = URL.createObjectURL(await res.blob());
        urls.push(u);
        setShots((s) => [...s, u]);
      }
    })();
    return () => { dead = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [it.id, it.files, token]);

  const kindLabel = it.kind === "bug" ? t("버그", "Bug") : it.kind === "idea" ? t("의견", "Idea") : it.kind === "privacy_request" ? t("개인정보 요청", "Privacy request") : t("리플레이 신고", "Replay report");
  const reasonLabel: Record<string, string> = {
    opponent: t("내가 상대 플레이어(삭제 요청)", "I was the opponent (removal)"), privacy: t("개인정보", "Personal info"), other: t("기타", "Other"),
    access: t("열람 요청", "Access request"), correction: t("정정 요청", "Correction request"), deletion: t("삭제 요청", "Deletion request"),
    restriction: t("처리정지 요청", "Restriction request"), transfer_objection: t("국외 이전 거부", "Objection to transfer abroad"),
  };
  return (
    <li className={`ib-item ${it.kind}`}>
      <header>
        <span className={`ib-kind ${it.kind}`}>{kindLabel}</span>
        <strong>{it.title ?? (it.reason ? reasonLabel[it.reason] ?? it.reason : `#${it.id}`)}</strong>
        <span className="dim mono">#{it.id} · {new Date(it.created_at).toLocaleString(lang === "ko" ? "ko-KR" : "en-US")}{it.signed_in ? ` · ${t("로그인함", "signed in")}` : ""}</span>
      </header>
      {it.body && <p className="ib-body">{it.body}</p>}
      {it.kind === "privacy_request" && (
        <p className="mono">
          {it.signed_in ? t("로그인한 계정으로 접수(본인 확인 가능)", "From a signed-in account (identity can be confirmed)") : t("로그인 없이 접수(본인 확인 불가, 계정 데이터 요청이면 로그인을 안내)", "Anonymous (identity cannot be confirmed; ask for a sign-in if it is about an account)")}
          {" · "}{it.channel === "email" ? t("이메일로 접수", "received by email") : t("사이트에서 접수", "received on the site")}
          {it.contact && <> · {t("답변 주소", "reply to")}: {it.contact}</>}
          {it.due_at && <> · {t("답변 기한", "due")}: {new Date(it.due_at).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US")}</>}
          {it.overdue && <strong className="fb-err"> · {t("기한 초과", "OVERDUE")}</strong>}
        </p>
      )}
      <p className="dim mono">
        {it.page && <>{it.page} </>}
        {it.replay_id && <Link href={`/${lang}/replay-analysis/shared/${it.replay_id}`}>{t(`리플레이 #${it.replay_id}`, `replay #${it.replay_id}`)}</Link>}
        {it.replay_id && it.replay_hidden && <> · {t("공개에서 내려감", "hidden")}</>}
        {it.user_agent && <><br />{it.user_agent}</>}
      </p>
      {shots.length > 0 && (
        <div className="ib-shots">
          {shots.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={u} alt={t("첨부 스크린샷", "attached screenshot")} />
            </a>
          ))}
        </div>
      )}
      {it.status === "OPEN" ? (
        <div className="ib-actions">
          <input value={note} maxLength={1000} placeholder={t("메모(선택)", "Note (optional)")} onChange={(e) => setNote(e.target.value)} />
          {it.kind === "replay" && it.replay_id && (
            <>
              <button className="btn" onClick={() => act(it.id, "restore")}>{t("공개로 복구", "Restore")}</button>
              <button className="btn btn-danger" onClick={() => { if (confirm(t("이 리플레이를 영구 삭제할까요?", "Delete this replay for good?"))) void act(it.id, "remove"); }}>{t("리플레이 삭제", "Remove replay")}</button>
            </>
          )}
          <button className="btn" onClick={() => act(it.id, "resolve", note)}>{t("처리됨", "Resolve")}</button>
          <button className="btn" onClick={() => act(it.id, "dismiss", note)}>{t("기각", "Dismiss")}</button>
        </div>
      ) : (
        <p className="dim">{it.status === "RESOLVED" ? t("처리됨", "Resolved") : t("기각", "Dismissed")}{it.admin_note ? ` · ${it.admin_note}` : ""}
          {" "}<button className="vw-link" onClick={() => { if (confirm(t("기록을 삭제할까요?", "Delete this record?"))) void act(it.id, "delete"); }}>{t("기록 삭제", "Delete record")}</button></p>
      )}
    </li>
  );
}
