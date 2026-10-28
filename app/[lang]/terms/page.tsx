import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POLICY_VERSION } from "@/lib/server/auth";
import { isLang } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "이용약관" : "Terms of Service" };
}

export default async function TermsPage({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const operator = (lang === "ko" ? process.env.PRIVACY_OPERATOR_NAME : process.env.PRIVACY_OPERATOR_NAME_EN || process.env.PRIVACY_OPERATOR_NAME)?.trim() || t("[운영자 이름 미정]", "[Operator name pending]");
  const contact = process.env.PRIVACY_CONTACT?.trim() || t("[서비스 문의 이메일 미정]", "[Service contact pending]");
  const draft = operator.startsWith("[") || contact.startsWith("[");

  return (
    <div className="wrap">
      <header className="pg-h">
        {draft && <span className="status">{t("초안", "Draft")}</span>}
        <h1 className="h1">{t("이용약관", "Terms of Service")}</h1>
        <p className="lede mono">{t("버전", "Version")} {POLICY_VERSION} · {draft ? t("시행 예정일", "Proposed effective date") : t("시행일", "Effective date")} 2026-10-28</p>
      </header>
      <div className="info">
        {draft && <section className="danger"><p><b>{t("공개 전 검토용 초안입니다.", "Draft for pre-launch review.")}</b> {t("운영자 정보와 연락처를 확정하고 전문가 검토를 받아야 합니다.", "Operator details and contact information must be finalised and professionally reviewed.")}</p></section>}

        <section>
          <h2 className="h2">{t("제1조 목적과 운영자", "1. Purpose and operator")}</h2>
          <p>{t(`이 약관은 ${operator}(이하 “운영자”)가 제공하는 BanPickMod 정보 사이트, 리플레이 업로더, 분석·재생·통계와 관련 기능(이하 “서비스”)의 이용조건을 정합니다.`, `These Terms govern the BanPickMod information site, replay uploader, analysis, playback, statistics and related features (the “Service”) provided by ${operator} (the “Operator”).`)}</p>
        </section>

        <section>
          <h2 className="h2">{t("제2조 이용 자격과 계정", "2. Eligibility and accounts")}</h2>
          <ul className="l2-steps">
            <li>{t("서비스 계정과 리플레이 기능은 만 14세 이상만 이용할 수 있습니다.", "Account and replay features are available only to users aged 14 or older.")}</li>
            <li>{t("Battle.net 로그인을 통해 계정을 만들며, 이용자는 자신의 계정과 연결된 런처 토큰을 안전하게 관리해야 합니다.", "Accounts are created through Battle.net sign-in. You are responsible for securing your account and linked launcher tokens.")}</li>
            <li>{t("타인의 계정을 사용하거나 로그인·기기 연결 절차를 우회해서는 안 됩니다.", "You must not use another person's account or bypass sign-in or device-linking controls.")}</li>
          </ul>
        </section>

        <section>
          <h2 className="h2">{t("제3조 서비스와 선택 기능", "3. Service and optional features")}</h2>
          <p>{t("정보 사이트는 로그인 없이 이용할 수 있습니다. 리플레이 분석은 C1, 공개·익명 통계는 C2, 향후 AI 학습 후보 제공은 C3 선택 동의를 각각 켠 경우에만 작동합니다. C2와 C3를 거부해도 비공개 개인 분석에는 불이익이 없습니다.", "The information site is available without signing in. Replay analysis requires C1, public viewing and anonymous statistics require C2, and future AI-training candidacy requires C3. Refusing C2 or C3 does not reduce private personal analysis.")}</p>
          <p>{t("현재 분석은 경기 사실 추출과 시각화를 제공하며 AI의 밴픽·플레이 평가는 아직 제공하지 않습니다.", "Current analysis provides factual extraction and visualisation; AI evaluation of draft and play is not yet provided.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("제4조 리플레이와 공개", "4. Replays and publication")}</h2>
          <ul className="l2-steps">
            <li>{t("이용자는 자신이 적법하게 보유한 BPM 리플레이만 업로드해야 합니다.", "You may upload only BPM replays you lawfully possess.")}</li>
            <li>{t("C2를 켜면 식별자를 제거한 경기 내용이 누구나 볼 수 있는 페이지와 통계에 나타날 수 있습니다. 원본 리플레이는 공개하지 않습니다.", "When C2 is enabled, gameplay with identifiers removed may appear on public pages and in statistics. The original replay is not published.")}</li>
            <li>{t("경기 상대방은 공개에 동의하지 않았을 수 있습니다. 상대방·개인정보 사유의 삭제 요청이 접수되면 운영자는 우선 공개를 중단하고 검토할 수 있습니다.", "An opponent may not have agreed to publication. On an opponent/privacy removal request, the Operator may take the replay down first and review it afterward.")}</li>
            <li>{t("허위·반복 신고, 타인 사칭 또는 공개 기능의 악용은 제한될 수 있습니다.", "False or repeated reports, impersonation or abuse of publication features may be restricted.")}</li>
          </ul>
        </section>

        <section>
          <h2 className="h2">{t("제5조 금지행위", "5. Prohibited conduct")}</h2>
          <ul className="l2-steps">
            <li>{t("악성 파일, BPM이 아닌 대량 파일 또는 조작된 요청을 전송하는 행위", "Sending malicious files, bulk non-BPM files or manipulated requests")}</li>
            <li>{t("서비스·계정·관리자 기능에 무단 접근하거나 보안·횟수 제한을 우회하는 행위", "Unauthorised access to the Service, accounts or operator features, or bypassing security/rate limits")}</li>
            <li>{t("다른 이용자나 제3자의 개인정보·저작권·기타 권리를 침해하는 행위", "Infringing another user’s or third party’s privacy, copyright or other rights")}</li>
            <li>{t("이벤트 순위·통계·분석을 조작하거나 서비스 운영을 방해하는 행위", "Manipulating event rankings, statistics or analysis, or disrupting operation")}</li>
          </ul>
        </section>

        <section>
          <h2 className="h2">{t("제6조 변경·중단과 계정 제한", "6. Changes, interruption and restrictions")}</h2>
          <p>{t("운영자는 보안, 유지보수, 외부 플랫폼 장애 또는 불가피한 운영 사유로 서비스 일부를 변경하거나 일시 중단할 수 있습니다. 중요한 변경은 가능한 범위에서 미리 알립니다. 금지행위, 보안 위험 또는 법령 위반이 확인되면 업로드·공개·계정 이용을 제한할 수 있으며, 긴급한 경우 사후 통지할 수 있습니다.", "The Operator may change or temporarily suspend parts of the Service for security, maintenance, third-party outages or unavoidable operational reasons. Material changes will be announced in advance where practicable. Upload, publication or account use may be restricted for prohibited conduct, security risks or legal violations; urgent restrictions may be notified afterward.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("제7조 데이터 삭제와 탈퇴", "7. Data deletion and account closure")}</h2>
          <p>{t("이용자는 계정 설정에서 개별·전체 리플레이 삭제와 회원 탈퇴를 할 수 있습니다. 삭제된 데이터는 복구할 수 없습니다. 삭제 범위와 백업 처리는 개인정보 처리방침을 따릅니다.", "You can delete individual/all replays and close your account in account settings. Deleted data cannot be recovered. The Privacy Policy governs deletion scope and backups.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("제8조 지식재산권과 비제휴 고지", "8. Intellectual property and non-affiliation")}</h2>
          <p>{t("이용자가 보유한 원본 리플레이에 대한 권리는 해당 권리자에게 남습니다. 사이트 코드·문서·BPM 고유 콘텐츠의 권리는 운영자 또는 각 권리자에게 있습니다. StarCraft, Battle.net과 관련 상표는 Blizzard Entertainment의 자산이며, 본 서비스는 Blizzard Entertainment와 공식 제휴·승인 관계가 아닙니다.", "Rights in an uploaded original replay remain with the relevant rights holders. Rights in site code, documents and BPM-original content belong to the Operator or their respective owners. StarCraft, Battle.net and related marks belong to Blizzard Entertainment; this Service is not officially affiliated with or endorsed by Blizzard Entertainment.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("제9조 책임과 보증의 한계", "9. Limits of warranty and liability")}</h2>
          <p>{t("분석·통계·교전 감지는 리플레이 표본과 자동 규칙에 따른 참고 정보이며 완전한 정확성을 보증하지 않습니다. 운영자는 고의 또는 중대한 과실이 없는 한 무료 서비스의 일시적 장애, 외부 플랫폼 장애 또는 이용자의 규칙 위반으로 발생한 손해에 대해 관련 법령이 허용하는 범위에서 책임을 제한합니다. 이 조항은 법령상 배제할 수 없는 소비자 권리를 제한하지 않습니다.", "Analysis, statistics and battle detection are reference information based on replay samples and automated rules and are not guaranteed to be complete or exact. To the extent permitted by law, and absent wilful misconduct or gross negligence, liability is limited for temporary free-service outages, third-party platform failures or harm caused by a user's rule violation. Nothing here limits consumer rights that cannot lawfully be excluded.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("제10조 약관 변경과 준거", "10. Changes and governing rules")}</h2>
          <p>{t("약관을 바꾸면 시행일과 주요 변경사항을 사이트에 알립니다. 이용자에게 불리한 중요한 변경은 합리적인 사전 고지기간을 둡니다. 이 약관은 대한민국 법령을 따르며 분쟁은 우선 상호 협의해 해결합니다. 강행법규가 정한 관할과 권리는 그대로 적용됩니다.", "Changes will be announced with their effective date and main terms. Material adverse changes will receive reasonable advance notice. These Terms follow the laws of the Republic of Korea, and disputes should first be addressed through good-faith discussion. Mandatory jurisdiction and statutory rights remain unaffected.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("제11조 문의", "11. Contact")}</h2>
          <p>{operator}<br />{contact}</p>
          <p><Link href={`/${lang}/privacy`}>{t("개인정보 처리방침 보기 →", "Read the Privacy Policy →")}</Link></p>
        </section>
      </div>
    </div>
  );
}
