import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { RaceMark, type RaceKey } from "@/components/RaceMark";
import { getGame } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

const fmtTime = (s: number | null) => (s == null ? "-" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

interface Battle {
  atSec?: number;
  label?: string;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/events/[slug]/games/[id]">): Promise<Metadata> {
  const { id } = await params;
  const g = Number.isInteger(Number(id)) ? await getGame(Number(id)) : null;
  return g ? { title: `${g.players.map((p) => p.name).join(" vs ")} · R${g.round} G${g.game_no}` } : {};
}

export default async function GamePage({ params }: PageProps<"/[lang]/events/[slug]/games/[id]">) {
  const { lang, slug, id } = await params;
  if (!isLang(lang) || !Number.isInteger(Number(id))) notFound();
  const g = await getGame(Number(id));
  if (!g || g.event_slug !== slug) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const name = (slot: number) => g.players.find((p) => p.slot === slot)?.name ?? `P${slot}`;
  const battles = Array.isArray(g.summary.battles) ? (g.summary.battles as Battle[]) : [];
  const actionLabel: Record<string, string> = { BAN: t("밴", "Ban"), PICK: t("픽", "Pick"), REPLACE: t("대체", "Replace") };

  return (
    <div className="wrap">
      <header className="pg-h">
        <Link href={`/${lang}/events/${slug}`}>← {t("경기 목록", "All games")}</Link>
        <h1 className="h1">{g.players.map((p) => p.name).join(" vs ")}</h1>
        <p className="lede mono">
          {g.matchup} · R{g.round} G{g.game_no} · {g.map} · {fmtTime(g.duration_sec)} · {g.ban_mode}, {g.ban_count} {t("밴", "bans")}
        </p>
        <p>
          <a className="btn btn-pri" href={`/api/games/${g.id}/replay`}>
            {t("리플레이 내려받기", "Download replay")}
          </a>
        </p>
      </header>

      <div className="info">
        <section>
          <h2 className="h2">{t("선수", "Players")}</h2>
          <div className="tscroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("선수", "Player")}</th>
                  <th>{t("종족", "Race")}</th>
                  <th>{t("페르소나", "Persona")}</th>
                  <th>{t("결과", "Result")}</th>
                </tr>
              </thead>
              <tbody>
                {g.players.map((p) => (
                  <tr key={p.slot}>
                    <td>{p.name}</td>
                    <td>
                      <RaceMark race={p.race as RaceKey} label={p.race[0].toUpperCase()} />
                    </td>
                    <td>{p.persona ?? "-"}</td>
                    <td>{p.result === "win" ? t("승", "Win") : t("패", "Loss")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="h2">{t("밴픽", "Draft")}</h2>
          {g.draft.length === 0 ? (
            <p className="note">{t("기록된 밴픽이 없습니다.", "No draft recorded.")}</p>
          ) : (
            <div className="tscroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="n">#</th>
                    <th>{t("선수", "Player")}</th>
                    <th>{t("행동", "Action")}</th>
                    <th>{t("유닛", "Unit")}</th>
                    <th>{t("대체 대상", "Replaces")}</th>
                  </tr>
                </thead>
                <tbody>
                  {g.draft.map((d) => (
                    <tr key={d.seq}>
                      <td className="n mono">{d.seq + 1}</td>
                      <td>{name(d.slot)}</td>
                      <td>{actionLabel[d.action]}</td>
                      <td className="mono">{d.unit_id}</td>
                      <td className="mono">{d.replaces_unit_id ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {battles.length > 0 && (
          <section>
            <h2 className="h2">{t("주요 교전", "Key moments")}</h2>
            <ul className="bul">
              {battles.map((b, i) => (
                <li key={i}>
                  <span className="mono">{fmtTime(typeof b.atSec === "number" ? b.atSec : null)}</span> {typeof b.label === "string" ? b.label : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <p className="note mono">
            mod {g.mod_version ?? "-"} · balance {g.balance_version ?? "-"}
          </p>
        </section>
      </div>
    </div>
  );
}
