import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/feedback">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "문의·버그 신고" : "Feedback & bug reports", robots: { index: false } };
}

export default async function FeedbackPage({ params, searchParams }: PageProps<"/[lang]/feedback">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const from = one(sp.from)?.startsWith("/") ? one(sp.from)!.slice(0, 300) : "";
  const kind = one(sp.kind) === "idea" ? "idea" : "bug";
  const user = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <div className="wrap">
      <header className="pg-h">
        <h1 className="h1">{t("문의·버그 신고", "Feedback & bug reports")}</h1>
        <p className="lede">
          {t("버그나 개선 의견을 보내 주세요. 스크린샷을 붙이면 원인을 찾기 쉽습니다.", "Send us a bug or an idea. A screenshot makes it much easier to find the cause.")}
        </p>
      </header>
      <div className="info">
        <section>
          <FeedbackForm lang={lang} signedIn={!!user} from={from} initialKind={kind} />
        </section>
        <section>
          <h2 className="h2">{t("다른 사람의 리플레이를 신고하려면", "To report someone's replay")}</h2>
          <p>
            {t(
              "공개 리플레이 페이지 맨 아래의 \"신고 / 삭제 요청\"을 쓰세요. 이 경기에 나온 플레이어라면 삭제를 요청할 수 있고, 접수 즉시 공개에서 내려가 운영자가 검토합니다.",
              "Use \"Report / request removal\" at the bottom of the shared replay page. If you played in that game you can ask for it to be removed; it comes off the public pages at once while an operator reviews it.",
            )}
          </p>
          <p>
            <Link href={`/${lang}/replay-analysis/shared`}>{t("공개 리플레이 →", "Shared replays →")}</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
