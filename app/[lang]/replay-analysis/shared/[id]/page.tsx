import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { getPublic } from "@/lib/server/publicReplays";
import { duration, mapLabel } from "@/lib/replay/analysis";
import { Draft } from "@/components/replay/Draft";
import { ReportReplay } from "@/components/replay/ReportReplay";
import { Viewer } from "@/components/viewer/Viewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/replay-analysis/shared/[id]">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "공개 리플레이" : "Shared replay", robots: { index: false } };
}

export default async function SharedReplayPage({ params }: PageProps<"/[lang]/replay-analysis/shared/[id]">) {
  const { lang, id } = await params;
  if (!isLang(lang) || !/^\d+$/.test(id)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const r = await getPublic(Number(id));
  if (!r) notFound(); // private, withdrawn, taken down and nonexistent all look the same

  return (
    <>
      <div className="wrap-wide">
        <header className="pg-h pg-h-slim">
          <Link href={`/${lang}/replay-analysis/shared`}>← {t("공개 리플레이", "Shared replays")}</Link>
          <h1 className="h1">{mapLabel(r.map)}</h1>
          <p className="lede mono">{r.matchup ?? "—"} · {duration(r.durationSec)} · {r.uploadedDay}</p>
        </header>
      </div>
      <div className="vw-wide">
        <Viewer timelineUrl={`/api/shared/${r.id}/timeline`} lang={lang} shareable evaluation={r.evaluation} />
      </div>
      <div className="wrap">
        <div className="info">
          <section>
            <h2 className="h2">{t("밴픽 결과", "Draft result")}</h2>
            <Draft players={r.analysis.players} lang={lang} />
            <p className="dim">
              {t("플레이어 이름은 저장하지도 표시하지도 않아 \"플레이어 1/2\"로만 보입니다. 리플레이에는 최종 결과만 남으므로 밴 순서는 알 수 없습니다.", "Player names are neither stored nor shown, so players appear as \"Player 1/2\". A replay keeps only the final result, so ban order is not known.")}
            </p>
          </section>
          <section>
            <ReportReplay id={r.id} lang={lang} />
          </section>
        </div>
      </div>
    </>
  );
}
