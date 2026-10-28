import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { listPublic } from "@/lib/server/publicReplays";
import { duration, mapLabel } from "@/lib/replay/analysis";
import { Unit } from "@/components/replay/Draft";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/replay-analysis/shared">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "공개 리플레이" : "Shared replays", robots: { index: false } };
}

const MATCHUPS = ["TvT", "TvZ", "TvP", "ZvZ", "PvZ", "PvP"];

export default async function SharedReplaysPage({ params, searchParams }: PageProps<"/[lang]/replay-analysis/shared">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const mu = one(sp.m) && MATCHUPS.includes(one(sp.m)!) ? one(sp.m)! : undefined;
  const page = Math.max(0, Number(one(sp.p)) || 0);
  const { items: shown, more } = await listPublic({ matchup: mu }, page);
  const href = (q: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "" && v !== 0) u.set(k, String(v));
    const s = u.toString();
    return `/${lang}/replay-analysis/shared${s ? `?${s}` : ""}`;
  };

  return (
    <div className="wrap">
      <header className="pg-h">
        <Link href={`/${lang}/replay-analysis`}>← {t("리플레이 분석", "Replay Analysis")}</Link>
        <h1 className="h1">{t("공개 리플레이", "Shared replays")}</h1>
        <p className="lede">
          {t("업로더가 공개를 허용한 BPM 경기입니다. 플레이어 이름은 저장하지도 보여주지도 않으며, 원본 파일은 내려받을 수 없습니다.", "BPM games whose uploaders allowed public viewing. Player names are neither stored nor shown, and the original files cannot be downloaded.")}
        </p>
        <p><Link href={`/${lang}/replay-analysis/stats`}>{t("커뮤니티 밴픽 통계 →", "Community draft statistics →")}</Link></p>
      </header>

      <div className="info">
        <nav className="chips" aria-label={t("매치업", "Matchup")}>
          <Link className={`chip${!mu ? " on" : ""}`} href={href({})}>{t("전체", "All")}</Link>
          {MATCHUPS.map((m) => <Link key={m} className={`chip${mu === m ? " on" : ""}`} href={href({ m })}>{m}</Link>)}
        </nav>

        {shown.length === 0 ? (
          <section><p className="dim">{t("아직 공개된 경기가 없습니다.", "No shared games yet.")}</p></section>
        ) : (
          <ul className="shared-list">
            {shown.map((r) => (
              <li key={r.id}>
                <Link className="shared-card" href={`/${lang}/replay-analysis/shared/${r.id}`}>
                  <strong>{mapLabel(r.map)}</strong>
                  <span className="mono">{r.matchup ?? "—"} · {duration(r.durationSec)} · {r.uploadedDay}</span>
                  <span className="shared-picks">
                    {r.analysis.players.flatMap((p, i) => p.picks.map((pk) => <Unit key={`${i}${pk.unit}`} id={pk.unit} lang={lang} kind="pick" plain />))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(more || page > 0) && (
          <p className="dim">
            {page > 0 && <Link href={href({ m: mu, p: page - 1 })}>← {t("이전", "Prev")}</Link>} {more && <Link href={href({ m: mu, p: page + 1 })}>{t("다음", "Next")} →</Link>}
          </p>
        )}
      </div>
    </div>
  );
}
