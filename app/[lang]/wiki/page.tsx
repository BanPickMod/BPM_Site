import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { wiki } from "@/lib/data";
import type { WikiData } from "@/lib/wiki";
import { WikiApp } from "@/components/wiki/WikiApp";

export async function generateMetadata({ params }: PageProps<"/[lang]/wiki">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: lang === "ko" ? "유닛 위키" : "Unit wiki" };
}

export default async function WikiPage({ params }: PageProps<"/[lang]/wiki">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const data = wiki as unknown as WikiData;

  return (
    <section className="wrap w3 w4p">
      <header className="pg-h">
        <h1 className="h1">{t("유닛 위키", "Unit wiki")}</h1>
        <p className="lede">
          {t(
            `기본 게임 유닛 전체와 BPM 추가 유닛 ${data.units.length}종의 수치를 한곳에서 봅니다. 행을 누르면 무기, 능력, 업그레이드를 포함한 전체 상세가 열립니다.`,
            `Every base-game unit and the ${data.units.length} BPM added units in one place. Click a row for the full detail: weapons, abilities and upgrades.`,
          )}
        </p>
      </header>
      <WikiApp lang={lang} data={data} raceNames={getDictionary(lang).races} />
    </section>
  );
}
