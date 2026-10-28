import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { getConsent } from "@/lib/server/consent";
import { consentHistory, listDevices } from "@/lib/server/account";
import { listUploads } from "@/lib/server/userUploads";
import { SignInCard } from "@/components/auth/SignInCard";
import { ConsentPanel } from "@/components/consent/ConsentPanel";
import { AgeGate } from "@/components/consent/PolicyNotice";
import { LocalTime } from "@/components/replay/clients";
import { DataActions, DeleteAccount, Devices, SignOut } from "@/components/account/AccountPanels";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/account">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "계정 설정" : "Account settings", robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const user = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  const devLogin = process.env.NODE_ENV !== "production" && process.env.BPM_DEV_LOGIN === "1";
  if (user && !user.onboarded) redirect(`/${lang}/onboarding?next=${encodeURIComponent(`/${lang}/account`)}`);

  const head = (
    <header className="pg-h">
      <h1 className="h1">{t("계정 설정", "Account settings")}</h1>
      <p className="lede">{t("공유 범위, 연결된 런처, 내 데이터, 회원 탈퇴를 이곳에서 관리합니다.", "Manage sharing, linked launchers, your data and account deletion here.")}</p>
    </header>
  );

  if (!user)
    return (
      <div className="wrap">
        {head}
        <div className="info"><SignInCard lang={lang} devLogin={devLogin} /></div>
      </div>
    );

  const [consent, devices, history, uploads] = await Promise.all([getConsent(user.id), listDevices(user.id), consentHistory(user.id, 10), listUploads(user.id, 1000)]);
  const value = { c1: consent.c1, c2: consent.c2, c3: consent.c3 };
  const flag = (b: boolean) => (b ? "●" : "○");
  const sourceLabel = (s: string) =>
    s === "launcher" ? t("런처", "Launcher") : s === "web" ? t("웹", "Web") : s === "device-approve" ? t("런처 연결 때", "While linking a launcher") : s;

  return (
    <div className="wrap">
      {head}
      <div className="info">
        <section>
          <h2 className="h2">{t("계정", "Account")}</h2>
          <p>{t("이름: ", "Name: ")}<b>{user.displayName}</b></p>
          <p className="dim">{t("연령 확인: ", "Age confirmation: ")}{user.ageConfirmed ? t("만 14세 이상 확인 완료", "confirmed age 14+") : t("확인 필요", "required")}</p>
          <p className="danger-actions">
            <Link className="btn btn-sec" href={`/${lang}/replay-analysis/mine`}>{t("내 리플레이", "My replays")}</Link>
            <SignOut lang={lang} />
          </p>
        </section>

        {!user.ageConfirmed && <section><AgeGate lang={lang} /></section>}

        <section id="sharing">
          <h2 className="h2">{t("선택 동의 및 공유 설정", "Optional consent and sharing")}</h2>
          <p className="dim">{t("각 항목은 독립적이며 바로 저장됩니다. 철회는 이미 올린 리플레이에도 즉시 적용됩니다. 다시 켜도 이미 올린 리플레이는 자동으로 공개되지 않고, 리플레이마다 직접 공개를 켭니다.", "Each switch is independent and saved at once. Withdrawing applies to replays you already uploaded immediately. Turning it on again does not publish replays you already uploaded; you choose that per replay.")}</p>
          {user.ageConfirmed ? <ConsentPanel lang={lang} initial={value} /> : <p className="note">{t("연령 확인 후 선택 동의를 변경할 수 있습니다.", "Confirm your age before changing optional consent.")}</p>}
          {history.length > 0 && (
            <details>
              <summary>{t("변경 기록", "Change history")}</summary>
              <div className="tscroll">
                <table className="tbl">
                  <thead><tr><th>{t("시각", "When")}</th><th>C1</th><th>C2</th><th>C3</th><th>{t("변경한 곳", "From")}</th></tr></thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i}>
                        <td><LocalTime iso={new Date(h.at).toISOString()} lang={lang} /></td>
                        <td>{flag(h.c1)}</td><td>{flag(h.c2)}</td><td>{flag(h.c3)}</td>
                        <td>{sourceLabel(h.source)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>

        <section id="launchers">
          <h2 className="h2">{t("연결된 런처", "Linked launchers")}</h2>
          <Devices lang={lang} initial={devices} />
        </section>

        <section id="data">
          <h2 className="h2">{t("내 데이터", "Your data")}</h2>
          <DataActions lang={lang} replayCount={uploads.length} />
        </section>

        <section id="delete">
          <h2 className="h2">{t("회원 탈퇴", "Delete account")}</h2>
          <DeleteAccount lang={lang} />
        </section>
        <p className="dim"><Link href={`/${lang}/privacy`}>{t("개인정보 처리방침", "Privacy Policy")}</Link>{" · "}<Link href={`/${lang}/terms`}>{t("이용약관", "Terms of Service")}</Link></p>
      </div>
    </div>
  );
}
