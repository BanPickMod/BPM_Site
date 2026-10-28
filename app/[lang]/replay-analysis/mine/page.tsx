import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { getConsent } from "@/lib/server/consent";
import { listUploadsWithAnalysis } from "@/lib/server/userUploads";
import { describeStatus, duration, mapLabel, matchup, parseAnalysis } from "@/lib/replay/analysis";
import { SignInCard } from "@/components/auth/SignInCard";
import { ConsentPanel } from "@/components/consent/ConsentPanel";
import { AutoRefresh, LocalTime, PublishStored } from "@/components/replay/clients";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/replay-analysis/mine">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "내 리플레이" : "My replays", robots: { index: false } };
}

export default async function MyReplaysPage({ params }: PageProps<"/[lang]/replay-analysis/mine">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const user = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  const devLogin = process.env.NODE_ENV !== "production" && process.env.BPM_DEV_LOGIN === "1";
  if (user && !user.onboarded) redirect(`/${lang}/onboarding?next=${encodeURIComponent(`/${lang}/replay-analysis/mine`)}`);

  const head = (
    <header className="pg-h">
      <Link href={`/${lang}/replay-analysis`}>← {t("리플레이 분석", "Replay Analysis")}</Link>
      <h1 className="h1">{t("내 리플레이", "My replays")}</h1>
      <p className="lede">
        {t("런처가 올린 BPM 경기와 AI의 분석 결과입니다. 이 화면은 나만 볼 수 있습니다.", "BPM games uploaded by the launcher, with the AI analysis. Only you can see this page.")}
      </p>
    </header>
  );

  if (!user) {
    return (
      <div className="wrap">
        {head}
        <div className="info">
          <SignInCard lang={lang} devLogin={devLogin} />
        </div>
      </div>
    );
  }

  const [consent, uploads] = await Promise.all([getConsent(user.id), listUploadsWithAnalysis(user.id)]);
  const pending = uploads.filter((u) => u.status === "QUEUED" || u.status === "ANALYZING").length;
  const done = uploads.filter((u) => u.status === "READY").length;
  const closedCount = consent.c2 ? uploads.filter((u) => !u.c2_at_upload && u.visibility_override === "default").length : 0;

  return (
    <div className="wrap">
      {head}
      <AutoRefresh active={pending > 0} />
      <div className="info">
        <section aria-label={t("요약", "Summary")}>
          <div className="facts">
            <div className="fact">
              <b>{uploads.length}</b>
              <span>{t("올린 리플레이", "Uploaded")}</span>
            </div>
            <div className="fact">
              <b>{done}</b>
              <span>{t("분석 완료", "Analyzed")}</span>
            </div>
            <div className="fact">
              <b>{pending}</b>
              <span>{t("분석 대기", "Waiting")}</span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="h2">{t("리플레이", "Replays")}</h2>
          {uploads.length === 0 ? (
            <p className="note">
              {t(
                "아직 올라온 리플레이가 없습니다. 런처를 켜 두고 BPM 게임을 하면 경기가 끝나는 대로 이곳에 나타납니다.",
                "Nothing uploaded yet. With the launcher running, a BPM game shows up here as soon as it ends.",
              )}
            </p>
          ) : (
            <div className="tscroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t("올린 시각", "Uploaded")}</th>
                    <th>{t("맵", "Map")}</th>
                    <th>{t("매치업", "Matchup")}</th>
                    <th className="n">{t("시간", "Length")}</th>
                    <th>{t("상태", "Status")}</th>
                    <th>{t("공개", "Public")}</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => {
                    const s = describeStatus(u.status, u.reject_code, lang);
                    const a = u.status === "READY" ? parseAnalysis(u.analysis) : null;
                    const href = `/${lang}/replay-analysis/mine/${u.id}`;
                    return (
                      <tr key={u.id}>
                        <td>
                          <Link href={href}>
                            <LocalTime iso={new Date(u.uploaded_at).toISOString()} lang={lang} />
                          </Link>
                        </td>
                        <td>{a ? mapLabel(a.map) : "—"}</td>
                        <td className="mono">{a ? (matchup(a) ?? "—") : "—"}</td>
                        <td className="n">{a ? duration(a.durationSec) : "—"}</td>
                        <td>
                          <Link href={href} className={`state ${s.tone}`}>
                            {s.label}
                          </Link>
                        </td>
                        <td>{u.c2_at_upload && u.visibility_override !== "private" ? t("공개", "Public") : u.visibility_override === "private" ? t("비공개로 지정", "Private") : t("공개 안 함", "Not public")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {closedCount > 0 && (
          <section>
            <p className="dim">{t(`공개 허용이 꺼져 있던 동안 올린 리플레이 ${closedCount}개는 아직 공개되지 않습니다. 켠 뒤에도 자동으로 공개하지 않으며, 리플레이마다 켜거나 한 번에 공개할 수 있습니다.`, `${closedCount} replays uploaded while public sharing was off are not public yet. Turning it on does not publish them by itself; open them one by one or all at once.`)}</p>
            <PublishStored lang={lang} count={closedCount} />
          </section>
        )}

        <section id="sharing">
          <h2 className="h2">{t("공유 설정", "Sharing")}</h2>
          <p>
            {t("계정: ", "Account: ")}
            <b>{user.displayName}</b>
          </p>
          <ConsentPanel lang={lang} initial={{ c1: consent.c1, c2: consent.c2, c3: consent.c3 }} />
          <p className="dim"><Link href={`/${lang}/account`}>{t("계정 설정 (연결된 런처, 데이터, 탈퇴)", "Account settings (launchers, data, deletion)")}</Link></p>
        </section>
      </div>
    </div>
  );
}
