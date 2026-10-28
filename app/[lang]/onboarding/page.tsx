import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { SignInCard } from "@/components/auth/SignInCard";
import { OnboardingForm } from "@/components/consent/OnboardingForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/onboarding">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "처음 시작하기" : "Getting started", robots: { index: false } };
}

/** Only a path on this site: anything else (another host, a protocol-relative address) goes to the account page. */
function safeNext(next: unknown, lang: string): string {
  return typeof next === "string" && /^\/[a-z]{2}\/[A-Za-z0-9/_?=&.-]*$/.test(next) && !next.startsWith("//") ? next : `/${lang}/account`;
}

export default async function OnboardingPage({ params, searchParams }: PageProps<"/[lang]/onboarding">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const sp = await searchParams;
  const next = safeNext(sp.next, lang);
  const user = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  const devLogin = process.env.NODE_ENV !== "production" && process.env.BPM_DEV_LOGIN === "1";
  if (user?.onboarded) redirect(next);

  return (
    <div className="wrap">
      <header className="pg-h">
        <h1 className="h1">{t("처음 시작하기", "Getting started")}</h1>
        <p className="lede">{t("처리 안내를 읽고 선택 동의를 정하면 시작할 수 있습니다. 모두 꺼 두어도 됩니다.", "Read how your data is processed and choose the optional consents. Leaving them all off is fine.")}</p>
      </header>
      <div className="info">
        {user ? <OnboardingForm lang={lang} next={next} ageConfirmed={user.ageConfirmed} /> : <SignInCard lang={lang} devLogin={devLogin} />}
      </div>
    </div>
  );
}
