import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { RaceMark, type RaceKey } from "@/components/RaceMark";
import { EventBanner, EventLogo } from "@/components/events/EventArt";
import { eventOpenGraph } from "@/lib/events";
import { computeStandings, getEvent, listGames, type GameRow } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

const MATCHUPS = ["TvT", "TvZ", "TvP", "PvZ", "PvP", "ZvZ"];
const RACE: Record<string, string> = { T: "terran", P: "protoss", Z: "zerg" };

const fmtTime = (s: number | null) => (s == null ? "-" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

export async function generateMetadata({ params }: PageProps<"/[lang]/events/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const ev = await getEvent(slug);
  return ev ? { title: lang === "ko" ? ev.name_ko : ev.name_en, openGraph: eventOpenGraph(slug, lang) } : {};
}

function RaceTag({ letter }: { letter: string }) {
  return <RaceMark race={RACE[letter] as RaceKey} label={letter} />;
}

export default async function EventPage({ params, searchParams }: PageProps<"/[lang]/events/[slug]">) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const ev = await getEvent(slug);
  if (!ev) notFound();
  const sp = await searchParams;
  const matchup = typeof sp.matchup === "string" && MATCHUPS.includes(sp.matchup) ? sp.matchup : undefined;
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);

  const all = await listGames(ev.id);
  const games = matchup ? all.filter((g) => g.matchup === matchup) : all;
  const standings = computeStandings(all);
  const base = `/${lang}/events/${slug}`;

  const bySeries = new Map<string, GameRow[]>();
  for (const g of games) bySeries.set(`${g.matchup}|${g.series_key}`, [...(bySeries.get(`${g.matchup}|${g.series_key}`) ?? []), g]);

  return (
    <div className="wrap">
      <header className="pg-h">
        <div className="ev-h">
          <EventLogo slug={slug} size={88} />
          <h1 className="h1">{lang === "ko" ? ev.name_ko : ev.name_en}</h1>
        </div>
        <p className="lede">
          {t(
            "AI끼리 겨룬 경기의 리플레이입니다. 누구나 내려받아 중계 콘텐츠를 만들 수 있습니다.",
            "Replays of AI-versus-AI games. Anyone can download them to make casting content.",
          )}
        </p>
      </header>

      <div className="ev-hero">
        <EventBanner slug={slug} lang={lang} priority />
      </div>

      <div className="seg-row" role="group" aria-label={t("매치업 필터", "Matchup filter")}>
        <Link className="chip" href={base} aria-pressed={!matchup}>
          {t("전체", "All")} · {all.length}
        </Link>
        {MATCHUPS.map((m) => (
          <Link key={m} className="chip" href={`${base}?matchup=${m}`} aria-pressed={matchup === m}>
            {m} · {all.filter((g) => g.matchup === m).length}
          </Link>
        ))}
      </div>

      {all.length === 0 && (
        <p className="note" style={{ marginTop: 24 }}>
          {t("아직 공개된 경기가 없습니다. 경기가 공개되면 이곳에 올라옵니다.", "No games are public yet. They appear here once released.")}
        </p>
      )}

      {games.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="h2">{t("경기", "Games")}</h2>
          <div className="tscroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("라운드", "Round")}</th>
                  <th>{t("매치업", "Matchup")}</th>
                  <th>{t("선수", "Players")}</th>
                  <th>{t("게임", "Game")}</th>
                  <th>{t("맵", "Map")}</th>
                  <th className="n">{t("시간", "Time")}</th>
                  <th>{t("승자", "Winner")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {games.map((g) => {
                  const winner = g.players.find((p) => p.slot === g.winner_slot);
                  return (
                    <tr key={g.id}>
                      <td className="mono">R{g.round}</td>
                      <td className="mono">{g.matchup}</td>
                      <td>{g.players.map((p) => `${p.name}`).join(" vs ")}</td>
                      <td className="mono">G{g.game_no}</td>
                      <td>{g.map}</td>
                      <td className="n mono">{fmtTime(g.duration_sec)}</td>
                      <td>{winner?.name ?? "-"}</td>
                      <td>
                        <Link href={`${base}/games/${g.id}`}>{t("상세", "Details")}</Link>
                        {" · "}
                        <a href={`/api/games/${g.id}/replay`}>{t("리플레이", "Replay")}</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {Object.keys(standings).length > 0 && (
        <section style={{ marginTop: 40, paddingBottom: 64 }}>
          <h2 className="h2">{t("순위", "Standings")}</h2>
          <p className="lede">{t("Bo3 시리즈에서 2승을 먼저 한 쪽이 시리즈 승자입니다. 진행 중인 시리즈는 게임 승패에만 반영됩니다.", "The first to two wins takes a Bo3 series. Unfinished series count only toward game totals.")}</p>
          {MATCHUPS.filter((m) => (!matchup || m === matchup) && standings[m]).map((m) => (
            <div key={m} style={{ marginTop: 20 }}>
              <h3 className="mono">
                <RaceTag letter={m[0]} /> {m} <RaceTag letter={m[2]} />
              </h3>
              <div className="tscroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("선수", "Player")}</th>
                      <th className="n">{t("시리즈", "Series")}</th>
                      <th className="n">{t("게임", "Games")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings[m].map((s, i) => (
                      <tr key={s.name}>
                        <td className="mono">{i + 1}</td>
                        <td>
                          {s.name}
                          {s.persona ? <span className="mono"> · {s.persona}</span> : null}
                        </td>
                        <td className="n mono">
                          {s.seriesWon}-{s.seriesLost}
                        </td>
                        <td className="n mono">
                          {s.gamesWon}-{s.gamesLost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
