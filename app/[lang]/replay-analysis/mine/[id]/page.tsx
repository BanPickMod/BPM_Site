import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { getConsent } from "@/lib/server/consent";
import { getUploadDetail } from "@/lib/server/userUploads";
import { describeStatus, duration, mapLabel, matchup, parseAnalysis } from "@/lib/replay/analysis";
import { parseEvaluation } from "@/lib/replay/evaluation";
import { SignInCard } from "@/components/auth/SignInCard";
import { Draft } from "@/components/replay/Draft";
import { Viewer } from "@/components/viewer/Viewer";
import { AutoRefresh, DeleteReplay, LocalTime, ReplaySharing } from "@/components/replay/clients";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/replay-analysis/mine/[id]">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "리플레이 분석" : "Replay analysis", robots: { index: false } };
}

export default async function ReplayDetailPage({ params }: PageProps<"/[lang]/replay-analysis/mine/[id]">) {
  const { lang, id } = await params;
  if (!isLang(lang) || !/^\d+$/.test(id)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const back = (
    <Link href={`/${lang}/replay-analysis/mine`}>← {t("내 리플레이", "My replays")}</Link>
  );

  const user = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (user && !user.onboarded) redirect(`/${lang}/onboarding?next=${encodeURIComponent(`/${lang}/replay-analysis/mine/${id}`)}`);
  if (!user) {
    const devLogin = process.env.NODE_ENV !== "production" && process.env.BPM_DEV_LOGIN === "1";
    return (
      <div className="wrap">
        <header className="pg-h">
          {back}
          <h1 className="h1">{t("리플레이 분석", "Replay analysis")}</h1>
        </header>
        <div className="info">
          <SignInCard lang={lang} devLogin={devLogin} />
        </div>
      </div>
    );
  }

  const row = await getUploadDetail(user.id, Number(id));
  if (!row) notFound(); // also what another user's replay looks like: it does not exist for you

  const status = describeStatus(row.status, row.reject_code, lang);
  const a = row.status === "READY" ? parseAnalysis(row.analysis) : null;
  const consent = await getConsent(user.id);
  const isPublic = row.c2_at_upload && row.visibility_override !== "private";
  const trainingOn = row.c3_at_upload && !row.training_excluded;
  const waiting = row.status === "QUEUED" || row.status === "ANALYZING";
  const uploadedIso = new Date(row.uploaded_at).toISOString();

  const viewerShown = !!(a && row.timeline_size && row.timeline_schema === 1);
  const head = (
    <div className={viewerShown ? "wrap-wide" : "wrap"}>
      <header className="pg-h pg-h-slim">
        {back}
        <h1 className="h1">{a ? mapLabel(a.map) : t("리플레이 분석", "Replay analysis")}</h1>
        <p className="lede mono">
          {a && (
            <>
              {matchup(a) ?? "—"} · {duration(a.durationSec)} ·{" "}
            </>
          )}
          <LocalTime iso={uploadedIso} lang={lang} />
        </p>
      </header>
      <AutoRefresh active={waiting} />
    </div>
  );
  const viewer = a && row.timeline_size && row.timeline_schema === 1 && (
    <div className="vw-wide">
      <h2 className="vh">{t("경기 다시 보기", "Replay")}</h2>
      <Viewer timelineUrl={`/api/me/uploads/${row.id}/timeline`} lang={lang} evaluation={parseEvaluation(row.evaluation)} evaluationPending={row.eval_status === "PENDING" || row.eval_status === "LEASED"} />
    </div>
  );
  const body = (
    <div className="wrap">
      <div className="info">
        {!a && (
          <section>
            <div className="ev">
              <span className={`status${waiting ? " on" : ""}`}>{status.label}</span>
              <p>{status.text || t("분석 결과를 표시할 수 없습니다.", "The analysis cannot be shown.")}</p>
              {waiting && <p className="dim">{t("이 화면은 자동으로 새로 고쳐집니다.", "This page refreshes by itself.")}</p>}
            </div>
          </section>
        )}

        {a && (
          <>
            <section>
              <h2 className="h2">{t("밴픽 결과", "Draft result")}</h2>
              <Draft players={a.players} lang={lang} />
              <p className="dim">
                {t(
                  "리플레이에는 최종 결과만 남습니다. 밴 순서와 기본 유닛을 그대로 고른 선택은 표시되지 않습니다. 어느 쪽이 나인지는 Battle.net 계정을 연결하면 표시됩니다.",
                  "A replay keeps only the final result, so ban order and choices that kept the default unit are not shown. Which side is you will be shown once your Battle.net account is linked.",
                )}
              </p>
            </section>
          </>
        )}

        <section>
          <h2 className="h2">{t("공유 상태", "Sharing")}</h2>
          <ul className="share">
            <li className="on">{t("나만 볼 수 있음 (분석용 업로드)", "Visible to you only (analysis upload)")}</li>
            <li className={isPublic ? "on" : "off"}>{isPublic ? t("공개: 다른 사람도 분석을 볼 수 있고 통계에 포함됨", "Public: others can see the analysis; counted in statistics") : t("공개 안 함", "Not public")}</li>
            <li className={trainingOn ? "on" : "off"}>{trainingOn ? t("AI 학습 허용", "AI training allowed") : t("AI 학습에 사용하지 않음", "Not used for AI training")}</li>
          </ul>
          <ReplaySharing lang={lang} id={row.id} accountC2={consent.c2} accountC3={row.c3_at_upload} isPublic={isPublic} trainingExcluded={row.training_excluded} />
          {row.status === "READY" && isPublic && (
            row.hidden_at ? (
              <p className="dim">{t("신고가 접수되어 공개 페이지에서 내려간 상태입니다. 운영자가 검토합니다.", "This replay was taken off the public pages after a report and is waiting for review.")}</p>
            ) : (
              <p className="dim">
                <Link href={`/${lang}/replay-analysis/shared/${row.id}`}>{t("공개 페이지 보기", "See the public page")}</Link>
              </p>
            )
          )}
          <p className="dim">
            <Link href={`/${lang}/replay-analysis/mine#sharing`}>{t("공유 설정 바꾸기", "Change sharing")}</Link>
          </p>
        </section>

        <section>
          <h2 className="h2">{t("원본 파일", "Original file")}</h2>
          <p className="dim">
            {row.source_deleted_at
              ? t("서버에서 삭제되었습니다. 분석 결과와 재생 기록만 남아 있습니다.", "Deleted from the server. Only the analysis and the playback record remain.")
              : row.status === "READY" || row.status === "QUEUED" || row.status === "ANALYZING"
                ? t("분석과 평가가 끝나면 서버에서 삭제됩니다. 끝나지 않아도 정해진 기간(최장 7일) 뒤에 삭제됩니다.", "It is deleted from the server once analysis and evaluation finish, and in any case after a fixed time (7 days at most).")
                : t("보관하지 않습니다.", "Not kept.")}
          </p>
        </section>

        <section>
          <h2 className="h2">{t("삭제", "Delete")}</h2>
          <DeleteReplay lang={lang} id={row.id} />
        </section>
      </div>
    </div>
  );
  return (
    <>
      {head}
      {viewer}
      {body}
    </>
  );
}
