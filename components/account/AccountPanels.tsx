"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n/config";
import { LocalTime } from "@/components/replay/clients";
import { ConsentPanel } from "@/components/consent/ConsentPanel";
import type { ConsentValue } from "@/components/consent/ConsentToggles";

export interface DeviceItem {
  id: number;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

const json = { "content-type": "application/json" };

/** One switch for the three consents. Saved immediately, like the individual toggles. */
export function ConsentAll({ lang, initial }: { lang: Lang; initial: ConsentValue }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function set(v: boolean) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/me/consent", { method: "PUT", headers: json, body: JSON.stringify({ c1: v, c2: v, c3: v }) });
    setBusy(false);
    if (!res.ok) return setMsg(t("저장하지 못했습니다.", "Could not save."));
    setMsg(v ? t("전체 동의로 저장했습니다.", "Saved: everything on.") : t("전체 철회로 저장했습니다. 런처가 업로드를 멈춥니다.", "Saved: everything off. The launcher stops uploading."));
    router.refresh();
  }

  const allOn = initial.c1 && initial.c2 && initial.c3;
  const allOff = !initial.c1 && !initial.c2 && !initial.c3;
  return (
    <div className="danger-actions">
      <button className="btn btn-sec" disabled={busy || allOn} onClick={() => set(true)}>{t("모두 동의", "Allow all")}</button>
      <button className="btn btn-sec" disabled={busy || allOff} onClick={() => set(false)}>{t("모두 철회", "Withdraw all")}</button>
      <span className="dim" role="status" aria-live="polite">{msg}</span>
    </div>
  );
}

export { ConsentPanel };

export function Devices({ lang, initial }: { lang: Lang; initial: DeviceItem[] }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revoke(id?: number) {
    setBusy(true);
    await fetch(id ? `/api/me/devices/${id}` : "/api/me/devices", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (initial.length === 0)
    return <p className="note">{t("연결된 런처가 없습니다. 런처를 설치하고 \"계정 연결\"을 누르면 여기에 나타납니다.", "No launcher is linked. Install the launcher and choose “Link account” to see it here.")}</p>;
  return (
    <>
      <div className="tscroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("기기", "Device")}</th>
              <th>{t("연결한 시각", "Linked")}</th>
              <th>{t("마지막 사용", "Last used")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {initial.map((d) => (
              <tr key={d.id}>
                <td>{d.label ?? t("이름 없음", "Unnamed")}</td>
                <td><LocalTime iso={new Date(d.created_at).toISOString()} lang={lang} /></td>
                <td>{d.last_used_at ? <LocalTime iso={new Date(d.last_used_at).toISOString()} lang={lang} /> : "—"}</td>
                <td><button className="btn btn-sec" disabled={busy} onClick={() => revoke(d.id)}>{t("연결 해제", "Unlink")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {initial.length > 1 && <button className="btn btn-sec" disabled={busy} onClick={() => revoke()}>{t("모든 기기 연결 해제", "Unlink all devices")}</button>}
      <p className="dim">{t("해제한 런처는 다음 업로드 때 \"다시 연결\" 상태가 되며, 보내지 못한 경기는 PC에 남아 다시 연결하면 올라갑니다.", "An unlinked launcher asks to link again on its next upload; games it could not send stay on the PC and upload after you link again.")}</p>
    </>
  );
}

/** Type-to-confirm: the button stays disabled until the exact phrase is entered. */
function Confirm({ lang, phrase, label, onConfirm, busy }: { lang: Lang; phrase: string; label: string; onConfirm: () => void; busy: boolean }) {
  const [v, setV] = useState("");
  const id = `confirm-${phrase}`;
  return (
    <div className="field">
      <label htmlFor={id} className="dim">
        {lang === "ko" ? <>계속하려면 <b>{phrase}</b>를 입력하세요.</> : <>Type <b>{phrase}</b> to continue.</>}
      </label>
      <input id={id} className="inp" value={v} onChange={(e) => setV(e.target.value)} autoComplete="off" spellCheck={false} placeholder={phrase} />
      <div className="danger-actions">
        <button className="btn btn-danger" disabled={busy || v.trim() !== phrase} onClick={onConfirm}>
          {busy ? "…" : label}
        </button>
      </div>
    </div>
  );
}

export function DataActions({ lang, replayCount }: { lang: Lang; replayCount: number }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const phrase = t("모두 삭제", "delete all");

  async function wipe() {
    setBusy(true);
    const res = await fetch("/api/me/uploads", { method: "DELETE" });
    setBusy(false);
    setMsg(res.ok ? t("리플레이를 모두 삭제했습니다.", "All replays deleted.") : t("삭제하지 못했습니다.", "Could not delete."));
    router.refresh();
  }

  return (
    <>
      <p><a className="btn btn-sec" href="/api/me/export" download>{t("내 데이터 내려받기 (JSON)", "Download my data (JSON)")}</a></p>
      <p className="dim">{t("계정 정보, 동의 이력, 연결된 기기, 리플레이 분석·평가 결과, 보낸 문의가 들어 있습니다. 포함하지 않은 것(원본 파일, 재생 타임라인, 첨부 스크린샷 등)과 그 이유는 파일 안의 notIncluded에 적혀 있습니다.", "Includes account info, consent history, linked devices, replay analyses and evaluations, and your messages. What is left out (original files, playback timelines, attached screenshots, …) and why is listed under notIncluded in the file.")}</p>
      {replayCount > 0 && (
        <div className="danger">
          <b>{t(`리플레이 ${replayCount}개 모두 삭제`, `Delete all ${replayCount} replays`)}</b>
          <p>{t("서버의 파일, 분석, 재생 데이터를 영구 삭제합니다. 공개 중이던 경기도 함께 사라지고 통계에서 빠집니다. 계정은 남습니다.", "Permanently removes files, analyses and playback data. Public games disappear and leave the statistics. Your account stays.")}</p>
          <Confirm lang={lang} phrase={phrase} label={t("리플레이 모두 삭제", "Delete all replays")} onConfirm={wipe} busy={busy} />
          <span className="dim" role="status">{msg}</span>
        </div>
      )}
    </>
  );
}

export function DeleteAccount({ lang }: { lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const phrase = t("회원 탈퇴", "delete account");

  async function go() {
    setBusy(true);
    const res = await fetch("/api/me", { method: "DELETE", headers: json, body: JSON.stringify({ confirm: "DELETE" }) });
    if (!res.ok) {
      setBusy(false);
      return setErr(t("탈퇴하지 못했습니다. 잠시 뒤 다시 시도하세요.", "Could not delete the account. Try again later."));
    }
    window.location.assign(new URL(`/${lang}`, window.location.origin).href);  // full reload so the header forgets the account
  }

  return (
    <div className="danger">
      <b>{t("회원 탈퇴", "Delete account")}</b>
      <p>{t(
        "계정, 올린 리플레이와 분석, 재생 데이터, 동의 기록, 연결된 런처, 내가 보낸 버그 신고와 스크린샷을 모두 삭제합니다. 되돌릴 수 없습니다. 이미 학습에 쓰인 데이터는 모델에서 제거할 수 없습니다.",
        "Deletes your account, uploaded replays, analyses, playback data, consent records, linked launchers, and the bug reports and screenshots you sent. This cannot be undone. Data already used to train a model cannot be removed from it.",
      )}</p>
      <Confirm lang={lang} phrase={phrase} label={t("회원 탈퇴", "Delete account")} onConfirm={go} busy={busy} />
      <span className="dim" role="alert">{err}</span>
    </div>
  );
}

export function SignOut({ lang }: { lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [busy, setBusy] = useState(false);
  async function out(everywhere: boolean) {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", headers: json, body: JSON.stringify({ everywhere }) });
    window.location.assign(new URL(`/${lang}`, window.location.origin).href);  // full reload so the header forgets the account
  }
  return (
    <div className="danger-actions">
      <button className="btn btn-sec" disabled={busy} onClick={() => out(false)}>
        {t("로그아웃", "Sign out")}
      </button>
      <button className="btn btn-sec" disabled={busy} onClick={() => out(true)} title={t("공용·분실한 컴퓨터에 로그인했을 때 사용합니다. 런처 연결은 그대로입니다.", "For a shared or lost computer. Linked launchers stay connected.")}>
        {t("모든 브라우저에서 로그아웃", "Sign out everywhere")}
      </button>
    </div>
  );
}
