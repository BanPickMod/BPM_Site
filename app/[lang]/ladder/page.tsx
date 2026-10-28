import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/ladder">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: lang === "ko" ? "래더" : "Ladder" };
}

export default async function LadderPage({ params }: PageProps<"/[lang]/ladder">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);

  return (
    <div className="wrap">
      <header className="pg-h">
        <span className="status">{t("준비 중", "Coming soon")}</span>
        <h1 className="h1">{t("BPM 래더", "BPM Ladder")}</h1>
        <p className="lede">
          {t(
            "리플레이 분석과 밴픽 비율 기능을 바탕으로 한 래더를 계획하고 있습니다. 세부 내용은 정해지는 대로 알려드립니다.",
            "We plan a ladder built on replay analysis and ban-pick rates. Details will follow once decided.",
          )}
        </p>
      </header>
    </div>
  );
}
