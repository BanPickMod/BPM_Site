import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { privacyRequestDays } from "@/lib/server/feedback";
import { PrivacyRequestForm } from "@/components/feedback/PrivacyRequestForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy-request">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "개인정보 요청" : "Privacy request", robots: { index: false } };
}

export default async function PrivacyRequestPage({ params }: PageProps<"/[lang]/privacy-request">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const user = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <div className="wrap">
      <header className="pg-h">
        <h1 className="h1">{t("개인정보 요청", "Privacy request")}</h1>
        <p className="lede">{t("내 데이터의 열람, 정정, 삭제, 처리정지, 국외 이전 거부를 요청할 수 있습니다.", "Ask to see, correct or delete your data, to stop its processing, or to object to its transfer abroad.")}</p>
      </header>
      <div className="info">
        <section>
          <PrivacyRequestForm lang={lang} signedIn={!!user} days={privacyRequestDays()} />
        </section>
        <section>
          <h2 className="h2">{t("먼저 직접 할 수 있는 것", "What you can do yourself first")}</h2>
          <p>
            {t(
              "동의를 끄면 해당 처리가 바로 멈춥니다. 내 데이터 내려받기, 리플레이 삭제, 회원 탈퇴도 계정 설정에서 바로 할 수 있습니다.",
              "Turning a consent off stops that processing at once. Downloading your data, deleting replays and closing your account are also immediate in account settings.",
            )}
          </p>
          <p><Link href={`/${lang}/account`}>{t("계정 설정 →", "Account settings →")}</Link></p>
          <p>
            {t("다른 사람이 올린 공개 리플레이에 내가 나온 경우에는 해당 리플레이 페이지의 \"신고 / 삭제 요청\"을 쓰세요.", "If you appear in someone else's public replay, use \"Report / request removal\" on that replay page.")}
          </p>
        </section>
      </div>
    </div>
  );
}
