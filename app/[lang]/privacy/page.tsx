import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { POLICY_VERSION } from "@/lib/server/auth";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ko" ? "개인정보 처리방침" : "Privacy Policy" };
}

/**
 * This page must describe the system as it actually operates. Values that depend on the final operator and deployment
 * are supplied through environment variables; visible placeholders deliberately keep this policy in draft status.
 */
export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const operator = (lang === "ko" ? process.env.PRIVACY_OPERATOR_NAME : process.env.PRIVACY_OPERATOR_NAME_EN || process.env.PRIVACY_OPERATOR_NAME)?.trim() || t("[운영자 이름 미정]", "[Operator name pending]");
  const contact = process.env.PRIVACY_CONTACT?.trim() || t("[개인정보 문의 이메일 미정]", "[Privacy contact pending]");
  const railwayRegion = process.env.PRIVACY_RAILWAY_REGION?.trim() || t("[Railway 배포 리전 확인 필요]", "[Confirm the Railway deployment region]");
  const r2Location = process.env.PRIVACY_R2_LOCATION?.trim() || t("[R2 버킷 위치·관할 확인 필요]", "[Confirm the R2 bucket location/jurisdiction]");
  const replayRetention = process.env.PRIVACY_REPLAY_RETENTION?.trim() || t("[최대 보관기간 미정]", "[Maximum retention pending]");
  const feedbackRetention = process.env.PRIVACY_FEEDBACK_RETENTION?.trim() || t("[민원 종료 후 보관기간 미정]", "[Post-resolution retention pending]");
  // Cloudflare R2 is listed only when object storage is actually configured (S3_*) or the location is stated.
  const usesR2 = Boolean(process.env.S3_ENDPOINT || process.env.PRIVACY_R2_LOCATION?.trim());
  const draft = [operator, contact, railwayRegion, usesR2 ? r2Location : "", replayRetention, feedbackRetention].some((v) => v.startsWith("["));

  return (
    <div className="wrap">
      <header className="pg-h">
        {draft && <span className="status">{t("초안", "Draft")}</span>}
        <h1 className="h1">{t("개인정보 처리방침", "Privacy Policy")}</h1>
        <p className="lede mono">{t("버전", "Version")} {POLICY_VERSION} · {draft ? t("시행 예정일", "Proposed effective date") : t("시행일", "Effective date")} 2026-10-28</p>
      </header>

      <div className="info">
        {draft && (
          <section className="danger">
            <p><b>{t("공개 전 검토용 초안입니다.", "Draft for pre-launch review.")}</b> {t("대괄호 항목은 운영 배포 전에 실제 정보로 교체하고 전문가 검토를 받아야 합니다.", "Bracketed items must be replaced with actual deployment information and reviewed by a qualified professional before launch.")}</p>
          </section>
        )}

        <section>
          <p>{t(`${operator}(이하 “운영자”)는 개인정보 보호법 제30조에 따라 정보주체의 개인정보를 보호하고 관련 고충을 처리하기 위하여 다음과 같이 개인정보 처리방침을 공개합니다.`, `${operator} (the “Operator”) publishes this Privacy Policy to explain how personal data is handled and how privacy requests are addressed.`)}</p>
        </section>

        <section>
          <h2 className="h2">{t("1. 처리 목적·항목·보유기간", "1. Purposes, data and retention")}</h2>
          <div className="tbl-wrap">
            <table className="vw-table">
              <thead><tr><th>{t("처리 근거·목적", "Basis and purpose")}</th><th>{t("처리 항목", "Data")}</th><th>{t("보유기간", "Retention")}</th></tr></thead>
              <tbody>
                <tr>
                  <td>{t("계약의 체결·이행: 로그인, 계정 보안, 설정 저장", "Contract performance: login, account security and saved settings")}</td>
                  <td>{t("Battle.net 계정 식별자와 표시 이름, 연령 확인 일시, 동의 변경 이력", "Battle.net account identifier and display name, age-confirmation time, consent history")}</td>
                  <td>{t("회원 탈퇴 시까지", "Until account deletion")}</td>
                </tr>
                <tr>
                  <td>{t("C1 선택 동의: 리플레이 업로드·분석·재생", "Optional C1 consent: replay upload, analysis and playback")}</td>
                  <td>{t("원본 SC2Replay 파일, 해시·크기·업로드 시각·클라이언트 버전, 지도·시간·종족·승패·밴픽·유닛 이동·생산·경제·교전 기록. 분석 기록에는 참가자 Battle.net 프로필 핸들 대신, 같은 경기를 두 선수가 올렸는지 알아보는 데만 쓰는 되돌릴 수 없는 해시값을 저장하며 핸들 원문은 저장하지 않음(원본 파일 안에는 들어 있음)", "Original SC2Replay file; hash, size, upload time and client version; map, duration, race, result, draft, unit movement/production, economy and battle records. Analysis records keep, instead of participants' Battle.net profile handles, an irreversible hash used only to recognise one game uploaded by both players, and never the handle itself (the original file does contain them)")}</td>
                  <td>{t(`이용자가 리플레이를 삭제하거나 회원 탈퇴할 때까지. 자동 최대 보관기간: ${replayRetention}`, `Until the user deletes the replay or account. Automatic maximum retention: ${replayRetention}`)}</td>
                </tr>
                <tr>
                  <td>{t("C2 선택 동의: 공개 열람·익명 통계", "Optional C2 consent: public viewing and anonymous statistics")}</td>
                  <td>{t("식별자를 제거한 분석·타임라인, 기간·매치업별 집계값", "Analysis and timeline with identifiers removed; aggregate values by period and matchup")}</td>
                  <td>{t("C2 철회, 리플레이 삭제, 삭제 요청 처리 또는 회원 탈퇴 시까지", "Until C2 withdrawal, replay deletion, accepted removal request or account deletion")}</td>
                </tr>
                <tr>
                  <td>{t("C3 선택 동의: 향후 AI 학습 후보", "Optional C3 consent: future AI-training candidate")}</td>
                  <td>{t("닉네임·프로필 핸들·채팅을 제외한 게임 플레이 파생 기록. 현재 학습 파이프라인은 운영하지 않음", "Derived gameplay records excluding names, profile handles and chat. No training pipeline is currently operating")}</td>
                  <td>{t("C3 철회 또는 원본·후보 데이터 삭제 시까지. 이미 완료된 모델 학습에는 소급 적용되지 않음", "Until C3 withdrawal or deletion of source/candidate data. Withdrawal does not retroactively alter completed model training")}</td>
                </tr>
                <tr>
                  <td>{t("문의·버그·공개 리플레이 신고 처리", "Feedback, bug reports and public-replay reports")}</td>
                  <td>{t("제목·본문·페이지 주소·브라우저 정보·첨부 이미지, 로그인한 경우 계정 ID, 남용 방지용 IP HMAC", "Title, message, page URL, browser information, attached images, account ID when signed in, and an IP HMAC for abuse prevention")}</td>
                  <td>{t(`삭제 요청 또는 운영상 보관 종료 시까지. 목표 보관 기준: ${feedbackRetention}`, `Until deletion is requested or operational retention ends. Target retention: ${feedbackRetention}`)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note">{t("리플레이 원본에는 참가자 닉네임·프로필 ID·채팅이 포함될 수 있습니다. 현재 원본은 재분석을 위해 비공개 저장되므로 이러한 정보가 분석 직후 원본에서 선택적으로 제거되지는 않습니다. 공개 응답에는 닉네임·프로필 핸들·채팅·업로더 정보를 내보내지 않습니다.", "An original replay may contain participant names, profile IDs and chat. The original is currently kept privately for re-analysis, so those fields are not selectively removed from the original immediately after analysis. Public responses never include names, profile handles, chat or uploader information.")}</p>
          <p>{t("BPM 경기가 아니거나 손상된 파일은 분석 후 삭제합니다. 지원하지 않는 새 버전은 재분석 가능성을 위해 보관할 수 있습니다.", "Files that are not BPM games or are corrupt are deleted after analysis. An unsupported new version may be retained so it can be analysed later.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("2. 선택 동의와 거부권", "2. Optional consent and refusal")}</h2>
          <ul className="l2-steps">
            <li>{t("C1·C2·C3는 서로 독립적이며 기본값은 모두 꺼짐입니다.", "C1, C2 and C3 are independent and all are off by default.")}</li>
            <li>{t("C1을 거부해도 정보 사이트는 이용할 수 있지만 런처 업로드와 개인 분석은 제공할 수 없습니다.", "Refusing C1 does not block the information site, but launcher upload and personal analysis cannot be provided.")}</li>
            <li>{t("C2 또는 C3를 거부해도 개인 분석은 이용할 수 있습니다.", "Refusing C2 or C3 does not prevent personal analysis.")}</li>
            <li>{t("계정 로그인·보안·설정 저장에 꼭 필요한 계정 식별자 처리는 계약 이행 근거로 처리하며 선택 동의를 요구하지 않습니다.", "Account identifiers strictly needed for login, security and saved settings are processed to perform the service contract and are not presented as optional consent.")}</li>
          </ul>
        </section>

        <section>
          <h2 className="h2">{t("3. 공개와 제3자 제공", "3. Public disclosure and third-party provision")}</h2>
          <p>{t("운영자는 개인정보를 광고·판매 목적으로 제3자에게 제공하지 않습니다. C2를 켜면 다음 범위가 인터넷에 공개됩니다.", "The Operator does not provide personal data to third parties for advertising or sale. When C2 is enabled, the following is made public on the Internet.")}</p>
          <ul className="l2-steps">
            <li>{t("플레이어는 ‘플레이어 1/2’로만 표시하고 닉네임·프로필 핸들·채팅·업로더 정보는 제외합니다.", "Players are shown only as Player 1/2; names, profile handles, chat and uploader information are excluded.")}</li>
            <li>{t("원본 리플레이 파일은 공개하거나 내려받게 하지 않습니다.", "The original replay file is not published or downloadable.")}</li>
            <li>{t("상대방의 익명화된 경기 내용은 재생될 수 있습니다. 상대방 또는 정보주체가 신고하면 개인정보·상대방 사유의 신고는 우선 공개를 중단하고 검토합니다.", "An opponent's anonymised gameplay may be replayed. If an opponent or data subject reports it, privacy/opponent reports are taken down first and then reviewed.")}</li>
          </ul>
        </section>

        <section>
          <h2 className="h2">{t("4. 처리위탁과 국외 이전", "4. Processors and overseas transfers")}</h2>
          <p>{t("서비스 제공에 필요한 클라우드 보관은 계약 이행을 위한 처리위탁·보관 근거로 수행하며, 이용자는 아래 연락처로 국외 이전을 거부할 수 있습니다. 다만 거부 시 로그인·리플레이 저장 서비스를 제공할 수 없습니다.", "Cloud hosting necessary to provide the service is performed as processing/storage required to perform the service contract. You may object to an overseas transfer through the contact below, but login and replay storage cannot then be provided.")}</p>
          <div className="tbl-wrap">
            <table className="vw-table">
              <thead><tr><th>{t("수탁자·연락처", "Processor and contact")}</th><th>{t("국가", "Country")}</th><th>{t("항목·방법", "Data and method")}</th><th>{t("업무·기간", "Purpose and period")}</th></tr></thead>
              <tbody>
                <tr>
                  <td>Railway Corporation<br />privacy@railway.com</td>
                  <td>{railwayRegion}</td>
                  <td>{t("계정·동의·분석 DB, 서버 로그·세션 정보 / 서비스 이용 시 TLS 네트워크 전송", "Account, consent and analysis database; server logs and session data / transferred over TLS while using the service")}</td>
                  <td>{t("웹·API·Postgres·worker 호스팅 / 회원 탈퇴·처리 목적 달성 또는 위탁계약 종료 시까지", "Web, API, Postgres and worker hosting / until account deletion, purpose completion or end of the processing contract")}</td>
                </tr>
                {usesR2 && (
                <tr>
                  <td>Cloudflare, Inc.<br />dpo@cloudflare.com</td>
                  <td>{r2Location}</td>
                  <td>{t("원본 리플레이, 타임라인, 문의 첨부 이미지 / 서비스 이용 시 TLS 네트워크 전송", "Original replays, timelines and feedback attachments / transferred over TLS while using the service")}</td>
                  <td>{t("R2 비공개 객체 저장 / 삭제·처리 목적 달성 또는 위탁계약 종료 시까지", "Private R2 object storage / until deletion, purpose completion or end of the processing contract")}</td>
                </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="h2">{t("5. 만 14세 미만 아동", "5. Children under 14")}</h2>
          <p>{t("본 서비스는 만 14세 미만 아동의 가입과 이용을 제한하며 생년월일은 수집하지 않습니다. 최초 로그인 전에 이용자가 만 14세 이상임을 직접 확인합니다. 만 14세 미만 아동이 법정대리인 동의 없이 정보를 제공한 사실이 확인되면 해당 계정과 정보를 지체 없이 삭제합니다.", "This service does not allow registration or use by children under 14 and does not collect dates of birth. Users self-confirm that they are at least 14 before first sign-in. If we learn that a child under 14 supplied data without a legal representative's consent, we will delete the account and data without undue delay.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("6. 정보주체의 권리와 행사방법", "6. Your rights and how to exercise them")}</h2>
          <ul className="l2-steps">
            <li>{t("계정 설정에서 동의 철회, 데이터 JSON 내려받기, 리플레이 삭제, 기기 연결 해제와 회원 탈퇴를 직접 할 수 있습니다.", "Account settings provide consent withdrawal, JSON export, replay deletion, device revocation and account deletion.")}</li>
            <li>{t(`열람·정정·삭제·처리정지 또는 국외 이전 거부 요청은 ${contact}로 보낼 수 있습니다.`, `Requests for access, correction, deletion, restriction or objection to overseas transfer may be sent to ${contact}.`)}</li>
            <li>{t("C2를 끄면 공개 화면·공유 링크·통계에서 즉시 제외됩니다.", "Turning off C2 immediately removes the replay from public pages, shared links and statistics.")}</li>
            <li>{t("C3를 끄면 학습 전 후보에서 즉시 제외합니다. 철회 전에 이미 완료된 모델 학습의 가중치는 특정 개인 기록으로 분리해 되돌릴 수 없습니다.", "Turning off C3 immediately removes unused training candidates. Model weights from completed training cannot be separated back into a specific individual's record.")}</li>
          </ul>
          <p><Link href={`/${lang}/account`}>{t("계정 설정 열기 →", "Open account settings →")}</Link></p>
        </section>

        <section>
          <h2 className="h2">{t("7. 파기 절차와 방법", "7. Deletion procedure and method")}</h2>
          <p>{t("보유기간이 끝나거나 처리 목적이 달성되면 지체 없이 삭제합니다. 전자 파일과 데이터베이스 행은 애플리케이션과 저장소의 삭제 기능으로 접근할 수 없도록 제거합니다. 백업이 운영되는 경우에는 백업 보존주기가 끝날 때까지 격리한 뒤 삭제하며 서비스 처리에 다시 사용하지 않습니다.", "When retention expires or the purpose is complete, data is deleted without undue delay. Electronic files and database rows are removed through application and storage deletion so they are no longer accessible. If backups are used, deleted data is isolated until the backup cycle expires and is not returned to service processing.")}</p>
          <p className="dim">{t("저장장치의 물리 섹터를 직접 덮어쓴다고 보장하지 않으며, 이용 중인 관리형 클라우드의 안전한 삭제 절차를 따릅니다.", "We do not claim direct physical-sector overwriting; deletion follows the secure deletion procedures of the managed cloud services in use.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("8. 안전성 확보조치", "8. Security measures")}</h2>
          <ul className="l2-steps">
            <li>{t("운영 환경의 HTTPS/TLS 암호화 전송과 HttpOnly·Secure·SameSite 세션 쿠키", "HTTPS/TLS in production and HttpOnly, Secure, SameSite session cookies")}</li>
            <li>{t("런처 토큰·신고자 IP를 원문 대신 SHA-256/HMAC 값으로 저장", "Launcher tokens and reporter IPs stored as SHA-256/HMAC values rather than raw values")}</li>
            <li>{t("원본 리플레이와 첨부 이미지는 비공개 객체로 저장하고 소유자·워커·운영자 API에서만 접근", "Original replays and attachments stored as private objects accessible only through owner, worker or operator APIs")}</li>
            <li>{t("공개 응답은 허용 필드만 새로 구성하고 프로필 핸들을 제거", "Public responses are rebuilt from an allow-list and profile handles are removed")}</li>
            <li>{t("운영자 접근은 이름이 붙은 토큰과 인증 앱의 일회용 코드(2단계 인증)로 제한하고 접근 기록을 남김", "Operator access requires a named token plus an authenticator one-time code (two-factor) and is logged")}</li>
            <li>{t("로그인 쓰기 요청의 동일 출처 검사, API별 인증·횟수 제한과 분석 파서 격리", "Same-origin checks on signed-in writes, per-API authentication/rate limits and isolated replay parsing")}</li>
          </ul>
        </section>

        <section>
          <h2 className="h2">{t("9. 쿠키와 자동 수집 장치", "9. Cookies and automatic collection")}</h2>
          <p>{t("Battle.net OAuth 위·변조 방지용 단기 쿠키와 로그인 유지용 필수 세션 쿠키를 사용합니다. 광고·행태 추적 쿠키는 사용하지 않습니다. 언어는 URL의 /ko 또는 /en 경로로 선택하며 언어 쿠키를 저장하지 않습니다. 쿠키를 거부하면 로그인과 계정 기능이 동작하지 않을 수 있습니다.", "We use a short-lived cookie to protect Battle.net OAuth and an essential session cookie to keep you signed in. We do not use advertising or behavioural tracking cookies. Language is selected by the /ko or /en URL path and no language cookie is stored. Refusing cookies may prevent login and account features from working.")}</p>
        </section>

        <section>
          <h2 className="h2">{t("10. 개인정보 보호책임자와 권익침해 구제", "10. Privacy contact and remedies")}</h2>
          <p><b>{t("운영자·개인정보 보호책임자", "Operator and privacy contact")}</b><br />{operator}<br />{contact}</p>
          <p><Link href={`/${lang}/privacy-request`}>{t("열람·정정·삭제·처리정지·국외 이전 거부 요청하기 →", "Make a request to see, correct, delete or restrict your data, or to object to transfer abroad →")}</Link></p>
          <ul className="l2-steps">
            <li><span><a href="https://www.kopico.go.kr" rel="noreferrer">{t("개인정보분쟁조정위원회", "Personal Information Dispute Mediation Committee")}</a> · 1833-6972</span></li>
            <li><span><a href="https://privacy.kisa.or.kr" rel="noreferrer">{t("개인정보침해신고센터", "Privacy Infringement Report Center")}</a> · 118</span></li>
            <li><span><a href="https://www.spo.go.kr" rel="noreferrer">{t("대검찰청", "Supreme Prosecutors’ Office")}</a> · 1301</span></li>
            <li><span><a href="https://ecrm.police.go.kr" rel="noreferrer">{t("경찰청 사이버범죄 신고시스템", "Korean National Police cybercrime reporting")}</a> · 182</span></li>
          </ul>
        </section>

        <section>
          <h2 className="h2">{t("11. 처리방침 변경", "11. Changes to this policy")}</h2>
          <p>{t("처리 항목, 목적, 위탁업체 등 중요한 내용이 바뀌면 시행 전에 사이트에서 알립니다. 동의가 필요한 목적 변경은 새 버전으로 다시 동의를 받습니다.", "Material changes to data, purposes or processors will be announced on the site before taking effect. A change that requires consent will be presented as a new consent version.")}</p>
        </section>

        <section>
          <p><Link href={`/${lang}/terms`}>{t("이용약관 보기 →", "Read the Terms of Service →")}</Link></p>
        </section>
      </div>
    </div>
  );
}
