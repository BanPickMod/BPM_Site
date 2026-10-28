import Link from "next/link";
import type { Lang } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { AnalysisPlayer } from "@/lib/replay/analysis";
import { unitInfo } from "@/lib/replay/units";
import { RaceMark } from "@/components/RaceMark";

/** One unit with its wiki icon and name, linking to its wiki entry. Falls back to the raw id when the wiki lacks it. */
export function Unit({ id, lang, kind, plain }: { id: string; lang: Lang; kind?: "pick" | "ban"; plain?: boolean }) {
  const u = unitInfo(id, lang);
  const body = (
    <>
      {u.icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-optimised static icon, same as the wiki
        <img className="uico" src={u.icon} alt="" width={28} height={28} />
      ) : (
        <span className="uico uico-none" aria-hidden />
      )}
      <span>{u.name}</span>
    </>
  );
  const cls = `unit${kind ? ` ${kind}` : ""}`;
  return u.wikiId && !plain ? (
    <Link className={cls} href={`/${lang}/wiki#${u.wikiId}`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

/** Both players' draft results side by side. Bans are red, picks lime, as everywhere on the site. */
export function Draft({ players, lang }: { players: AnalysisPlayer[]; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const races = getDictionary(lang).races;
  return (
    <div className="dr">
      {players.map((p, i) => {
        const result = p.result === "win" ? t("승", "Win") : p.result === "loss" ? t("패", "Loss") : t("결과 없음", "No result");
        return (
          <article key={p.playerId} className="dr-card" aria-labelledby={`pl-${i}`}>
            <header className="dr-head">
              <h3 id={`pl-${i}`}>{t(`플레이어 ${i + 1}`, `Player ${i + 1}`)}</h3>
              {p.race && <RaceMark race={p.race} label={races[p.race]} />}
              <span className={`res ${p.result ?? "none"}`}>{result}</span>
              {p.isAi && <span className="status">AI</span>}
            </header>

            <section className="dr-sec">
              <h4>{t("고른 유닛", "Picked")}</h4>
              {p.picks.length === 0 ? (
                <p className="dim">{t("기본 유닛을 그대로 사용했습니다.", "Kept the default units.")}</p>
              ) : (
                <ul className="dr-list">
                  {p.picks.map((pk) => (
                    <li key={pk.unit} className="dr-pick">
                      <Unit id={pk.unit} lang={lang} kind="pick" />
                      {pk.replaces && (
                        <span className="dr-repl">
                          <span aria-hidden>←</span> <span className="vh">{t("대체:", "replaces")}</span>
                          <Unit id={pk.replaces} lang={lang} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dr-sec">
              <h4>{t("받은 밴", "Banned against them")}</h4>
              {p.bans.length === 0 ? (
                <p className="dim">{t("없음", "None")}</p>
              ) : (
                <ul className="dr-list wrapl">
                  {p.bans.map((b) => (
                    <li key={b}>
                      <Unit id={b} lang={lang} kind="ban" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </article>
        );
      })}
    </div>
  );
}
