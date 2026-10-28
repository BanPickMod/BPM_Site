import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { MediaSlot } from "@/components/MediaSlot";

export async function generateMetadata({ params }: PageProps<"/[lang]/replay-analysis">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: lang === "ko" ? "리플레이 분석" : "Replay Analysis" };
}

export default async function ReplayAnalysisPage({ params }: PageProps<"/[lang]/replay-analysis">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);

  const tiers: [string, string][] = [
    [
      t("분석", "Analysis"),
      t(
        "로그인하고 리플레이 제공에 동의하면, 올린 리플레이를 AI가 분석해 밴픽과 플레이를 평가합니다. 분석 결과를 다른 사람이 볼 수 있게 할지는 직접 고릅니다.",
        "Sign in and agree to share replays and the AI analyses what you upload: the draft and the play. You choose whether others can see the result.",
      ),
    ],
    [
      t("공개", "Sharing"),
      t(
        "분석 결과를 다른 플레이어에게 보여줄지 따로 선택합니다. 선택하지 않으면 나만 볼 수 있습니다.",
        "Choose separately whether other players can see your results. If you do not, only you can.",
      ),
    ],
    [
      t("학습", "Training"),
      t(
        "AI 학습에 쓰는 것에 동의한 리플레이만 학습에 사용합니다. 그 외에는 학습이나 제3자에게 제공하는 콘텐츠에 절대 쓰지 않습니다.",
        "Only replays you agreed to use for AI training are used for training. Anything else is never used for training or third-party content.",
      ),
    ],
  ];

  return (
    <div className="wrap">
      <header className="pg-h">
        <span className="status">{t("준비 중", "Coming soon")}</span>
        <h1 className="h1">SC2 BPM Replay Analysis</h1>
        <p className="lede">
          {t(
            "리플레이를 자동으로 올리면 AI가 밴픽과 플레이를 분석해 주는 서비스입니다.",
            "A service where replays are uploaded automatically and the AI analyses your draft and play.",
          )}
        </p>
      </header>

      <div className="info">
        <section>
          <p>
            <Link className="btn btn-pri" href={`/${lang}/replay-analysis/mine`}>
              {t("내 리플레이 보기", "See my replays")}
            </Link>
            {" "}
            <Link className="btn" href={`/${lang}/replay-analysis/shared`}>
              {t("공개 리플레이", "Shared replays")}
            </Link>
            {" "}
            <Link className="btn" href={`/${lang}/replay-analysis/stats`}>
              {t("밴픽 통계", "Draft statistics")}
            </Link>
          </p>
        </section>

        <section>
          <h2 className="h2">{t("작동 방식", "How it works")}</h2>
          <ol className="l2-steps">
            <li>{t("로그인하고 리플레이 제공에 동의합니다.", "Sign in and agree to share replays.")}</li>
            <li>
              {t(
                "PatchesSC처럼 리플레이를 자동으로 올려 주는 런처를 설치합니다.",
                "Install the launcher that uploads replays automatically, like PatchesSC.",
              )}
            </li>
            <li>{t("경기가 끝나면 리플레이가 올라가고, AI가 실시간으로 분석합니다.", "When a game ends the replay is uploaded and the AI analyses it live.")}</li>
            <li>{t("이 사이트에서 분석 결과를 확인합니다.", "See the result on this site.")}</li>
          </ol>
          <MediaSlot id="replay-analysis-preview" lang={lang} />
        </section>

        <section>
          <h2 className="h2">{t("내 데이터는 어떻게 쓰이나", "How your data is used")}</h2>
          <div className="tscroll">
            <table className="tbl">
              <tbody>
                {tiers.map(([name, text]) => (
                  <tr key={name}>
                    <td>
                      <b>{name}</b>
                    </td>
                    <td className="wrapc">{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="h2">{t("다음 계획", "What comes next")}</h2>
          <p>
            {t(
              "이 기능들은 이후 BPM 래더로 확장될 예정입니다. 런처 배포와 서비스 시작 일정은 정해지는 대로 알려드립니다.",
              "These features are planned to grow into a BPM ladder. The launcher release and service start dates will be announced once set.",
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
