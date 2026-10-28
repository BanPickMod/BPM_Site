import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { AdminInbox } from "@/components/feedback/AdminInbox";

export const metadata: Metadata = { title: "Inbox", robots: { index: false, follow: false } };

/** Operator page. The page itself holds nothing: the list is fetched with the operator token, which is kept only in this tab. */
export default async function AdminFeedbackPage({ params }: PageProps<"/[lang]/admin/feedback">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <div className="wrap">
      <header className="pg-h">
        <h1 className="h1">{lang === "ko" ? "수신함" : "Inbox"}</h1>
        <p className="lede">{lang === "ko" ? "버그 신고, 의견, 리플레이 신고를 한곳에서 처리합니다. 운영자 토큰이 필요합니다." : "Bug reports, ideas and replay reports in one place. Needs the operator token."}</p>
      </header>
      <AdminInbox lang={lang} />
    </div>
  );
}
