import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { DeviceLink } from "@/components/device/DeviceLink";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/device">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "런처 연결" : "Link launcher", robots: { index: false } };
}

export default async function DevicePage({ params, searchParams }: PageProps<"/[lang]/device">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code.toUpperCase().slice(0, 9) : "";
  const user = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  const devLogin = process.env.NODE_ENV !== "production" && process.env.BPM_DEV_LOGIN === "1";
  if (user && !user.onboarded) redirect(`/${lang}/onboarding?next=${encodeURIComponent(`/${lang}/device${code ? `?code=${code}` : ""}`)}`);

  return (
    <div className="wrap">
      <header className="pg-h">
        <h1 className="h1">{lang === "ko" ? "런처 연결" : "Link launcher"}</h1>
        <p className="lede">
          {lang === "ko"
            ? "BPM 리플레이 업로더에 표시된 코드를 입력하고, 올릴 데이터에 대한 동의를 선택합니다."
            : "Enter the code shown in the BPM replay uploader and choose what you agree to share."}
        </p>
      </header>
      <DeviceLink lang={lang} initialCode={code} signedInAs={user?.displayName ?? null} ageConfirmed={user?.ageConfirmed ?? false} devLogin={devLogin} />
    </div>
  );
}
