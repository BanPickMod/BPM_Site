import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/config";

export function Footer({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  return (
    <footer className="foot">
      <div className="foot-in">
        <div>
          <b>StarCraft II: BanPickMod</b> · 
          <Link href={`/${lang}/feedback`}>{lang === "ko" ? "문의·버그 신고" : "Feedback & bug reports"}</Link> ·{" "}
          <Link href={`/${lang}/privacy`}>{lang === "ko" ? "개인정보 처리방침" : "Privacy Policy"}</Link> ·{" "}
          <Link href={`/${lang}/terms`}>{lang === "ko" ? "이용약관" : "Terms of Service"}</Link>
        </div>
        <span>{dict.footer.trademark}</span>
      </div>
    </footer>
  );
}
