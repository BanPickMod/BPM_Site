import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { communityStats, statsRules, WINDOW_DAYS } from "@/lib/server/stats";
import { Unit } from "@/components/replay/Draft";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/replay-analysis/stats">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "커뮤니티 밴픽 통계" : "Community draft statistics", robots: { index: false } };
}

const MATCHUPS = ["TvT", "TvZ", "TvP", "ZvZ", "PvZ", "PvP"];
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

export default async function StatsPage({ params, searchParams }: PageProps<"/[lang]/replay-analysis/stats">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const mu = MATCHUPS.includes(one(sp.m) ?? "") ? one(sp.m)! : undefined;
  const days = WINDOW_DAYS.find((d) => String(d) === one(sp.d)) ?? 90;
  const rules = statsRules();
  const res = await communityStats(days, mu);
  const href = (m: string | undefined, d: number) => `/${lang}/replay-analysis/stats?${new URLSearchParams({ ...(m ? { m } : {}), d: String(d) })}`;

  return (
    <div className="wrap">
      <header className="pg-h">
        <Link href={`/${lang}/replay-analysis`}>← {t("리플레이 분석", "Replay Analysis")}</Link>
        <h1 className="h1">{t("커뮤니티 밴픽 통계", "Community draft statistics")}</h1>
        <p className="lede">
          {t("공개를 허용한 사람들의 사람 대 사람 경기만 집계합니다. AI 경기는 섞지 않습니다.", "Only human-vs-human games from players who allowed sharing. AI games are not mixed in.")}
        </p>
      </header>
      <div className="info">
        <nav className="chips" aria-label={t("매치업", "Matchup")}>
          <Link className={`chip${!mu ? " on" : ""}`} href={href(undefined, days)}>{t("전체", "All")}</Link>
          {MATCHUPS.map((m) => <Link key={m} className={`chip${mu === m ? " on" : ""}`} href={href(m, days)}>{m}</Link>)}
        </nav>
        <nav className="chips" aria-label={t("기간", "Period")}>
          {WINDOW_DAYS.map((d) => <Link key={d} className={`chip${days === d ? " on" : ""}`} href={href(mu, d)}>{t(`최근 ${d}일`, `Last ${d} days`)}</Link>)}
        </nav>

        <section>
          <p className="mono">{t(`집계된 경기 ${res.games}판 · 서로 다른 업로더 ${res.users}명`, `${res.games} games counted · ${res.users} different uploaders`)}</p>
          {res.units.length === 0 ? (
            <p className="dim">{t("아직 집계할 경기가 없습니다.", "No games to count yet.")}</p>
          ) : (
            <div className="tbl-wrap">
              <table className="vw-table">
                <thead>
                  <tr>
                    <th>{t("유닛", "Unit")}</th><th>{t("선택률", "Pick rate")}</th><th>{t("밴률", "Ban rate")}</th><th>{t("승률 (95% 구간)", "Win rate (95% interval)")}</th><th>{t("표본", "Sample")}</th>
                  </tr>
                </thead>
                <tbody>
                  {res.units.map((u) => (
                    <tr key={u.unit} className={u.shown ? "" : "unused"}>
                      <td><Unit id={u.unit} lang={lang} /></td>
                      {u.shown ? (
                        <>
                          <td>{pct(u.pickRate)} <span className="dim">({u.picked})</span></td>
                          <td>{pct(u.banRate)} <span className="dim">({u.banned})</span></td>
                          <td>{u.winRate === null ? "—" : <>{pct(u.winRate)} <span className="dim">({pct(u.winLow)}–{pct(u.winHigh)}, n={u.decided})</span></>}</td>
                          <td className="mono">{u.slots}</td>
                        </>
                      ) : (
                        <td colSpan={4} className="dim">{t("표본 부족", "Not enough games")}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="h2">{t("읽는 법", "How to read this")}</h2>
          <ul className="l2-steps">
            <li>{t("선택률·밴률은 그 유닛의 종족 플레이어 수 대비 비율입니다. 괄호 안은 횟수입니다.", "Pick and ban rates are per player of the unit's race; the number in brackets is the count.")}</li>
            <li>{t(`한 칸이 ${rules.minGames}판 미만이거나 업로더가 ${rules.minUsers}명 미만이면 숫자를 보이지 않습니다.`, `A row with fewer than ${rules.minGames} games or ${rules.minUsers} different uploaders shows no numbers.`)}</li>
            <li>{t(`같은 경기를 두 사람이 올려도 한 번만 세고, 한 사람이 최대 ${rules.perUserCap}판까지만 반영됩니다.`, `A game both players uploaded is counted once, and one player contributes at most ${rules.perUserCap} games.`)}</li>
            <li>{t("리플레이에는 밴 방식(Snake 등)과 모드 밸런스 버전이 남지 않아, 이 통계는 방식·밸런스 버전별로 나누지 못합니다. 기간으로만 나눕니다. 밸런스 패치 직후에는 최근 30일 기준으로 보세요.", "A replay does not record the ban format (Snake etc.) or the mod's balance version, so this cannot be split by them, only by period. Right after a balance patch use the last 30 days.")}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
