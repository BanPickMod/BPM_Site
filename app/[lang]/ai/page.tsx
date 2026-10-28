import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { MediaRow } from "@/components/MediaSlot";

export async function generateMetadata({ params }: PageProps<"/[lang]/ai">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: lang === "ko" ? "BPM AI" : "BPM AI" };
}

export default async function AiPage({ params }: PageProps<"/[lang]/ai">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);

  const levels = [t("쉬움", "Easy"), t("중간", "Medium"), t("어려움", "Hard"), t("프로", "Pro"), t("챌린지", "Challenge")];

  return (
    <div className="wrap">
      <header className="pg-h">
        <div className="ev-h">
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised static file */}
          <img className="ai-emblem" src="/brand/site/ai-emblem.webp" width={223} height={192} alt="" decoding="async" />
          <h1 className="h1">BPM AI</h1>
        </div>
        <p className="lede">
          {t(
            "싱글 플레이로도 모드를 즐기고 시험해 볼 수 있도록 직접 학습한 AI입니다. 테란, 저그, 프로토스를 모두 플레이합니다.",
            "An AI we trained ourselves so you can try and enjoy the mod in single player. It plays Terran, Zerg and Protoss.",
          )}
        </p>
      </header>

      <div className="info">
        <section>
          <h2 className="h2">{t("어떻게 학습했나", "How it was trained")}</h2>
          <div className="facts">
            <div className="fact">
              <b>2,000+</b>
              <span>{t("프로 리플레이 (제공되는 데이터셋)", "pro replays (the provided dataset)")}</span>
            </div>
            <div className="fact">
              <b>3,000+</b>
              <span>{t("자가 대전 (AI끼리 경기)", "self-play games (AI vs AI)")}</span>
            </div>
            <div className="fact">
              <b>3</b>
              <span>{t("플레이 가능 종족", "playable races")}</span>
            </div>
            <div className="fact">
              <b>5</b>
              <span>{t("난이도", "difficulties")}</span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="h2">{t("난이도", "Difficulties")}</h2>
          <p>
            {t(
              "난이도에 따라 APM, EAPM, 시야 정보, 반응 지연이 조절됩니다.",
              "APM, EAPM, vision and reaction delay scale with the difficulty.",
            )}
          </p>
          <div className="seg-row">
            {levels.map((name) => (
              <span key={name} className="chip">
                {name}
              </span>
            ))}
          </div>
          <p className="note">
            {t(
              "프로는 AI 학습의 기준 난이도이고, 챌린지는 가장 높은 난이도입니다. 챌린지는 사람 대 AI 이벤트의 최종 관문으로 쓰입니다.",
              "Pro is the difficulty the AI was trained at; Challenge is the highest, used as the final gate of the human-vs-AI event.",
            )}
          </p>
          <MediaRow ids={["ai-difficulty", "ai-match"]} lang={lang} />
        </section>

        <section>
          <h2 className="h2">{t("프로 난이도의 제한", "Pro difficulty limits")}</h2>
          <p>
            {t(
              "아래 수치는 프로 리플레이 2,000여 판을 분석해 얻은 값입니다. 시야는 정찰로 알아낸 정보만을 바탕으로, 사전 학습 자료와 시뮬레이션을 더해 판단합니다.",
              "These numbers come from analysing about 2,000 pro replays. Vision is based only on what scouting reveals, supplemented by pre-trained knowledge and simulation.",
            )}
          </p>
          <div className="facts">
            <div className="fact">
              <b>650</b>
              <span>Peak APM</span>
            </div>
            <div className="fact">
              <b>450</b>
              <span>{t("평균 APM", "Average APM")}</span>
            </div>
            <div className="fact">
              <b>250</b>
              <span>EAPM</span>
            </div>
            <div className="fact">
              <b>5-8ms</b>
              <span>{t("반응 지연", "Reaction delay")}</span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="h2">{t("AI 통계", "AI statistics")}</h2>
          <p>
            <span className="status">{t("집계 준비 중", "Collecting")}</span>
          </p>
          <p>
            {t(
              "AI의 밴픽 비율과 승률은 집계가 시작되면 이 페이지와 플레이어 밴픽 비율 옆에 공개됩니다. 플레이어 쪽은 리플레이 제공에 동의한 분의 데이터만 사용합니다.",
              "The AI's ban-pick rates and win rates will appear here once collection starts. The player side only uses data from people who agreed to share replays.",
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
