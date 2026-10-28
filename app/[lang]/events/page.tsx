import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { EventBanner, EventLogo } from "@/components/events/EventArt";
import { eventOpenGraph } from "@/lib/events";

export async function generateMetadata({ params }: PageProps<"/[lang]/events">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: lang === "ko" ? "이벤트" : "Events", openGraph: eventOpenGraph("colosseum-1", lang) };
}

export default async function EventsPage({ params }: PageProps<"/[lang]/events">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);

  return (
    <div className="wrap">
      <header className="pg-h">
        <h1 className="h1">BPM Events</h1>
        <p className="lede">
          {t(
            "제대로 된 모드로 출시하면서, 밸런스에 쓸 자료를 모으기 위해 기획 중인 이벤트입니다. 일정과 내용은 바뀔 수 있습니다.",
            "Events we are planning alongside the release to gather data for balance. Dates and details may change.",
          )}
        </p>
      </header>

      <div className="info">
        <article className="ev">
          <EventBanner slug="colosseum-1" lang={lang} priority />
          <div className="ev-h">
            <EventLogo slug="colosseum-1" />
            <div>
              <span className="status on">{t("예정", "Planned")}</span>
              <h2 className="ev-t">{t("BPM AI 콜로세움 1", "BPM AI Colosseum 1")}</h2>
            </div>
          </div>
          <p className="mono">{t("11/1 ~ 11/2 (KST)", "Nov 1 – Nov 2 (KST)")}</p>
          <p>
            {t(
              "AI가 플레이하는 모습을 선보이는 쇼케이스입니다. 페르소나 방식으로 추가 학습된 AI끼리 붙습니다.",
              "A showcase of the AI playing. AIs further trained with a persona approach face each other.",
            )}
          </p>
          <p>
            <Link className="btn btn-sec" href={`/${lang}/events/colosseum-1`}>
              {t("경기·리플레이 보기", "Games and replays")}
            </Link>
          </p>
          <ul className="bul">
            <li>{t("TvT, TvZ, TvP, PvZ, PvP, ZvZ 여섯 매치업 모두 Bo3 풀리그", "All six matchups (TvT, TvZ, TvP, PvZ, PvP, ZvZ), Bo3 round robin")}</li>
            <li>{t("스네이크 밴, 3밴으로 진행", "Snake ban order, 3 bans")}</li>
            <li>{t("모든 리플레이는 이 사이트에서 공개", "Every replay is published on this site")}</li>
            <li>
              {t(
                "어떤 크리에이터든 리플레이 중계 콘텐츠를 만들 수 있습니다. 사이트가 리플레이마다 AI 분석 정보를 간단히 보여주므로 재미있어 보이는 경기만 골라 볼 수도 있습니다.",
                "Any creator can cast the replays. The site shows brief AI analysis for each replay, so you can pick only the games that look fun.",
              )}
            </li>
            <li>{t("라운드가 많아 이틀로 나누어 업로드합니다.", "There are many rounds, so uploads are split over two days.")}</li>
          </ul>
        </article>

        <article className="ev">
          <EventBanner slug="challenge-s1" lang={lang} />
          <div className="ev-h">
            <EventLogo slug="challenge-s1" />
            <div>
              <span className="status">{t("일정 미정", "Date TBD")}</span>
              <h2 className="ev-t">BPM AI Challenge S1</h2>
            </div>
          </div>
          <p>
            {t(
              "이틀간 진행되는 챌린지입니다. 사람 대 AI로 어려움부터 프로까지 클리어하고, 최고 난이도인 챌린지 난이도를 클리어하면 됩니다.",
              "A two-day challenge. Play humans vs AI, clear Hard through Pro, then clear the top Challenge difficulty.",
            )}
          </p>
          <ul className="bul">
            <li>{t("리플레이 제공에 동의한 경우에만 집계되며, 시스템이 자동으로 집계합니다.", "Counted only if you agreed to share replays; the system tallies automatically.")}</li>
            <li>{t("어려움~프로는 어느 종족으로 클리어해도 됩니다.", "Hard to Pro can be cleared with any race.")}</li>
            <li>{t("챌린지 난이도는 테란, 프로토스, 저그를 모두 클리어해야 합니다.", "Challenge must be cleared with Terran, Protoss and Zerg.")}</li>
            <li>{t("1:1 래더 맵이면 무엇이든 가능하며, 스네이크 밴, 3밴(기본 설정)으로 진행합니다.", "Any 1v1 ladder map; Snake, 3 bans (the default setup).")}</li>
          </ul>
          <p className="note">
            {t(
              "상금은 추후 공지합니다.",
              "Prizes will be announced later.",
            )}
          </p>
        </article>
      </div>
    </div>
  );
}
