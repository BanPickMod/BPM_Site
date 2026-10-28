"use client";

import { useState } from "react";
import Link from "next/link";
import { RedactEditor } from "./RedactEditor";
import type { Lang } from "@/lib/i18n/config";

const MAX_FILES = 3;
const MAX_BYTES = 3 * 1024 * 1024;

/** Bug / idea form. Screenshots need a signed-in user (spam); the server re-checks type, size and count. */
export function FeedbackForm({ lang, signedIn, from, initialKind }: { lang: Lang; signedIn: boolean; from: string; initialKind: "bug" | "idea" }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [kind, setKind] = useState(initialKind);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState<File[]>([]);       // picked, waiting to be looked at in the editor
  const [pickKey, setPickKey] = useState(0);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function pick(list: FileList | null) {
    const next = [...(list ?? [])].slice(0, MAX_FILES - files.length);
    setError(null);
    setPickKey((k) => k + 1);                                 // clears the file input so the same file can be picked again
    if (next.some((f) => f.size > 20 * MAX_BYTES / 3)) return setError(t("스크린샷이 너무 큽니다.", "That screenshot is too large."));
    if (next.some((f) => !/^image\/(png|jpeg|webp)$/.test(f.type))) return setError(t("PNG, JPEG, WebP 이미지만 올릴 수 있습니다.", "Only PNG, JPEG or WebP images."));
    setPending(next);                                         // every screenshot goes through the cover editor before it is attached
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const form = new FormData();
    form.set("kind", kind);
    form.set("title", title);
    form.set("body", body);
    form.set("page", from || document.referrer.replace(location.origin, "").slice(0, 300));
    for (const f of files) form.append("screenshot", f);
    try {
      const res = await fetch("/api/feedback", { method: "POST", body: form });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { code?: string };
        setError(
          j.code === "RATE_LIMIT" ? t("잠시 뒤 다시 보내 주세요(시간당 횟수 제한).", "Please wait a bit (hourly limit).")
          : j.code === "TOO_SHORT" ? t("제목은 3자, 내용은 5자 이상 적어 주세요.", "Please write a title (3+ characters) and details (5+).")
          : j.code === "NO_SESSION" ? t("스크린샷은 로그인한 뒤에 붙일 수 있습니다.", "Sign in to attach screenshots.")
          : j.code === "BAD_IMAGE" || j.code === "FILE_TOO_LARGE" ? t("이미지 형식이나 크기가 맞지 않습니다.", "The image type or size is not accepted.")
          : t("보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Could not send. Please try again later."),
        );
        return setState("idle");
      }
      setState("done");
    } catch {
      setError(t("보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Could not send. Please try again later."));
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="ev" role="status">
        <h2 className="ev-t">{t("보냈습니다. 고맙습니다!", "Sent. Thank you!")}</h2>
        <p className="dim">{t("운영자가 확인합니다. 개별 답장은 드리지 않으니 수정 소식은 패치노트로 확인해 주세요.", "An operator will read it. We do not reply individually; watch the patch notes for fixes.")}</p>
        <button className="btn" onClick={() => { setState("idle"); setTitle(""); setBody(""); setFiles([]); }}>{t("하나 더 보내기", "Send another")}</button>
      </div>
    );
  }

  return (
    <form className="fb-form" onSubmit={submit}>
      <fieldset className="fb-kind">
        <legend className="vh">{t("종류", "Kind")}</legend>
        <label><input type="radio" name="kind" checked={kind === "bug"} onChange={() => setKind("bug")} /> {t("버그 신고", "Bug report")}</label>
        <label><input type="radio" name="kind" checked={kind === "idea"} onChange={() => setKind("idea")} /> {t("의견·제안", "Idea")}</label>
      </fieldset>
      <label>
        {t("제목", "Title")}
        <input value={title} maxLength={120} required minLength={3} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        {kind === "bug" ? t("무슨 일이 있었나요? (어디서, 어떻게 하면 생기는지)", "What happened? (where, and what you did)") : t("내용", "Details")}
        <textarea value={body} maxLength={4000} required minLength={5} rows={7} onChange={(e) => setBody(e.target.value)} />
      </label>
      {from && <p className="dim mono">{t("신고 위치", "From")}: {from}</p>}
      <div className="fb-files">
        <span>{t("스크린샷 (선택, 최대 3장)", "Screenshots (optional, up to 3)")}</span>
        {signedIn ? (
          <>
            {files.length < MAX_FILES && pending.length === 0 && <input key={pickKey} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => pick(e.target.files)} />}
            {pending[0] && <RedactEditor key={pending[0].name + pending[0].size} file={pending[0]} lang={lang} onDone={(f) => { setFiles((x) => [...x, f]); setPending((p) => p.slice(1)); }} onCancel={() => setPending((p) => p.slice(1))} />}
            {files.length > 0 && (
              <ul className="rd-files">
                {files.map((f, i) => (
                  <li key={f.name + f.size}>{f.name} · {(f.size / 1024).toFixed(0)} KB <button type="button" className="vw-link" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>{t("빼기", "Remove")}</button></li>
                ))}
              </ul>
            )}
            <small className="dim">{t("올리기 전에 닉네임·이메일 같은 곳을 직접 가릴 수 있고, 사진 속 위치·촬영 정보는 자동으로 지워집니다. 운영자만 볼 수 있습니다.", "You can black out names or emails before sending, and location/camera metadata is removed automatically. Only operators can see attachments.")}</small>
          </>
        ) : (
          <small className="dim">
            {t("스크린샷은 로그인한 사용자만 붙일 수 있습니다.", "Screenshots can be attached when signed in.")} <Link href={`/${lang}/replay-analysis/mine`}>{t("로그인하기", "Sign in")}</Link>
          </small>
        )}
      </div>
      {error && <p role="alert" className="fb-err">{error}</p>}
      <button className="btn btn-pri" type="submit" disabled={state === "busy"}>{state === "busy" ? t("보내는 중…", "Sending…") : t("보내기", "Send")}</button>
    </form>
  );
}
