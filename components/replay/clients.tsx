"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n/config";

/** Re-reads the page while any replay is still waiting for the worker. Stops when nothing is pending or the tab is hidden. */
export function AutoRefresh({ active, everyMs = 5000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [active, everyMs, router]);
  return null;
}

const noSubscribe = () => () => {};

/** Shows an instant in the reader's own time zone. The server renders the UTC date so the first paint matches. */
export function LocalTime({ iso, lang }: { iso: string; lang: Lang }) {
  // useSyncExternalStore gives the server snapshot (UTC date) during hydration and the local-time text afterwards.
  const text = useSyncExternalStore(
    noSubscribe,
    () => new Date(iso).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "short" }),
    () => iso.slice(0, 10),
  );
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}

/** Two-step delete: nothing is removed until the second, explicit click. */
export function DeleteReplay({ lang, id }: { lang: Lang; id: number }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function remove() {
    setBusy(true);
    setError(false);
    const res = await fetch(`/api/me/uploads/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push(`/${lang}/replay-analysis/mine`);
      router.refresh();
    } else {
      setBusy(false);
      setError(true);
    }
  }

  if (!confirming)
    return (
      <button className="btn btn-sec" onClick={() => setConfirming(true)}>
        {t("이 리플레이 삭제", "Delete this replay")}
      </button>
    );
  return (
    <div className="danger">
      <p>{t("서버에서 리플레이 파일과 분석 결과를 영구 삭제합니다. 되돌릴 수 없습니다.", "This permanently deletes the replay file and its analysis from the server. It cannot be undone.")}</p>
      <div className="danger-actions">
        <button className="btn btn-danger" onClick={remove} disabled={busy}>
          {t("삭제합니다", "Delete")}
        </button>
        <button className="btn btn-sec" onClick={() => setConfirming(false)} disabled={busy}>
          {t("취소", "Cancel")}
        </button>
      </div>
      {error && <p role="alert">{t("삭제하지 못했습니다. 다시 시도하세요.", "Could not delete. Try again.")}</p>}
    </div>
  );
}

/** Per-replay sharing switches (PATCH /api/me/uploads/:id). The stricter choice always wins over the account consent. */
export function ReplaySharing({ lang, id, accountC2, accountC3, isPublic, trainingExcluded }: {
  lang: Lang; id: number; accountC2: boolean; accountC3: boolean; isPublic: boolean; trainingExcluded: boolean;
}) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const router = useRouter();
  const [pub, setPub] = useState(isPublic);
  const [excluded, setExcluded] = useState(trainingExcluded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: { public?: boolean; trainingExcluded?: boolean }, undo: () => void) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/me/uploads/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      undo();
      setError(res.status === 409 ? t("계정에서 공개 허용(C2)이 꺼져 있습니다. 계정 설정에서 먼저 켜세요.", "Public sharing (C2) is off for your account. Turn it on in account settings first.") : t("저장하지 못했습니다. 다시 시도하세요.", "Could not save. Try again."));
    }
  }

  return (
    <div className="share-controls">
      <label>
        <input type="checkbox" checked={pub} disabled={busy || (!pub && !accountC2)} onChange={(e) => { const v = e.target.checked; setPub(v); void patch({ public: v }, () => setPub(!v)); }} />{" "}
        {t("이 리플레이를 공개 (다른 사람도 분석을 보고 통계에 포함)", "Make this replay public (others can see the analysis; counted in statistics)")}
      </label>
      {!pub && <p className="dim">{t("끄면 공개 목록·공유 링크·통계에서 바로 빠집니다. 연습 경기처럼 노출되면 안 되는 경기에 쓰세요.", "Turning it off removes it from the public list, share links and statistics at once. Use it for games that must not be exposed, such as practice matches.")}</p>}
      {accountC3 && (
        <label>
          <input type="checkbox" checked={excluded} disabled={busy} onChange={(e) => { const v = e.target.checked; setExcluded(v); void patch({ trainingExcluded: v }, () => setExcluded(!v)); }} />{" "}
          {t("이 리플레이는 AI 학습에서 제외", "Exclude this replay from AI training")}
        </label>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

/** Opens the earlier replays that a withdrawn-and-granted C2 left closed. Replays marked private are not touched. */
export function PublishStored({ lang, count }: { lang: Lang; count: number }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function publish() {
    setBusy(true);
    setError(false);
    const res = await fetch("/api/me/uploads", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ public: true }) });
    setBusy(false);
    if (res.ok) {
      setConfirming(false);
      router.refresh();
    } else setError(true);
  }

  if (!confirming)
    return (
      <button className="btn btn-sec" onClick={() => setConfirming(true)}>
        {t(`이전에 올린 리플레이 ${count}개 공개하기`, `Make ${count} earlier replays public`)}
      </button>
    );
  return (
    <div className="danger">
      <p>{t(`공개 허용을 껐던 동안 올린 리플레이 ${count}개를 공개 목록과 통계에 포함합니다. "공개하지 않음"으로 지정한 리플레이는 바뀌지 않습니다. 공개한 뒤에도 리플레이마다 다시 끌 수 있습니다.`, `This adds ${count} replays uploaded while public sharing was off to the public list and statistics. Replays you marked private do not change, and you can turn any of them off again later.`)}</p>
      <div className="danger-actions">
        <button className="btn btn-danger" onClick={publish} disabled={busy}>{t("공개합니다", "Make public")}</button>
        <button className="btn btn-sec" onClick={() => setConfirming(false)} disabled={busy}>{t("취소", "Cancel")}</button>
      </div>
      {error && <p role="alert">{t("처리하지 못했습니다. 다시 시도하세요.", "Could not do that. Try again.")}</p>}
    </div>
  );
}
