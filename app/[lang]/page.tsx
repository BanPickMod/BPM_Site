import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { isLang } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { currentVersion, races, wiki } from "@/lib/data";
import { getPatch, listPatchVersions } from "@/lib/patches";
import { MediaRow } from "@/components/MediaSlot";
import { hasMedia } from "@/lib/media";

const HOME_MEDIA = ["home-draft", "home-observer", "home-hud"];

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const d = getDictionary(lang);
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const name = (u: { ko: string; en: string }) => u[lang];

  const versions = listPatchVersions();
  const latest = getPatch(versions[0], lang)!;
  const news = versions.map((v) => getPatch(v, lang)!);
  const marquee = wiki.units.map((u) => (
    <span key={u.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={u.icon} alt="" width={28} height={28} />
      {name(u)}
    </span>
  ));

  return (
    <>
      <section className="l3-hero l4-hero">
        <div className="wrap l3-hero-in">
          <div className="l3-copy">
            <p className="l4-ver mono">
              <span className="pill">{currentVersion}</span> {t("현재 빌드", "Current build")}
            </p>
            <h1 className="l3-h1">
              {lang === "ko" ? (
                <>
                  밴으로 흔들고,
                  <br />
                  히든 픽으로 완성하는 전장.
                </>
              ) : (
                <>
                  Ban to shake it up.
                  <br />
                  Hidden-pick to finish it.
                </>
              )}
            </h1>
            <p className="lede">
              {t(
                "0·1·3·5밴 규칙과 비공개 선택으로 스타크래프트 II 1대1에 전략 한 층을 더하는 커스텀 모드입니다. 방만 만들면 코어, 옵저버, AI가 모두 준비됩니다.",
                "A StarCraft II 1v1 custom mod that adds a ban phase and secret picks. Create a room and the core, observer, and AI are all included.",
              )}
            </p>
            <div className="l3-cta">
              <Link className="btn btn-pri" href={`/${lang}/guide`}>
                {t("가이드 시작", "Start the guide")}
              </Link>
              <Link className="btn btn-sec" href={`/${lang}/patches`}>
                {t("패치 노트", "Patch notes")}
              </Link>
            </div>
          </div>

          <div className="l4-board bracket" aria-label={t(`확장 유닛 ${wiki.units.length}종`, `${wiki.units.length} extension units`)}>
            <div className="l4-bhead">
              <span className="mono">ROSTER {wiki.units.length}</span>
              <Link className="lnk" href={`/${lang}/wiki`}>
                {t("전체 수치", "All stats")}
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
            {races.map((r) => (
              <div key={r} className={`l4-row ${r}`}>
                <span className="l4-race">{d.races[r]}</span>
                <div className="l4-icons">
                  {wiki.units
                    .filter((u) => u.race === r)
                    .map((u) => (
                      <Link key={u.id} className="l4-u" href={`/${lang}/wiki#${u.id}`} title={name(u)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.icon} alt="" width={44} height={44} />
                        <span>{name(u)}</span>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="l3-phases wrap">
        <h2 className="vh">{t("드래프트 3단계", "Draft in three phases")}</h2>
        <div className="l3-ph ban">
          <h3>BAN</h3>
          <p>{t("상대의 선택지를 지웁니다. 0·1·3·5밴, 스네이크 순서 지원.", "Strike options from your opponent. 0·1·3·5 bans, snake order supported.")}</p>
        </div>
        <div className="l3-ph pick">
          <h3>HIDDEN PICK</h3>
          <p>
            {t(
              "살아남은 그룹에서 기본 유닛과 확장 유닛 중 하나를 숨긴 채 선택합니다.",
              "From each surviving group, secretly choose the base or the extension unit.",
            )}
          </p>
        </div>
        <div className="l3-ph go">
          <h3>DEPLOY</h3>
          <p>{t("결과가 양측 테크트리에 적용되고, 카운트다운 뒤 경기가 시작됩니다.", "Results apply to both tech trees, then a countdown starts the match.")}</p>
        </div>
        <Link className="lnk l4-try" href={`/${lang}/guide#draft`}>
          {t("직접 밴과 픽을 해 보기", "Try a ban and pick yourself")}
          <ArrowRight size={16} aria-hidden />
        </Link>
      </section>

      {hasMedia(HOME_MEDIA, lang) || process.env.NODE_ENV !== "production" ? (
        <section className="wrap home-media" aria-label={t("게임 화면", "In the game")}>
          <MediaRow ids={HOME_MEDIA} lang={lang} />
        </section>
      ) : null}

      <div className="l3-marquee" aria-hidden="true">
        <div className="l3-track">
          {marquee}
          {marquee}
        </div>
      </div>

      <section className="l4-patch wrap" id="updates">
        <div className="l4-pcard bracket">
          <div className="l4-phead">
            <span className="mono l4-pver">{latest.version}</span>
            <Link className="lnk" href={`/${lang}/patches/${latest.version}`}>
              {t("전체 변경 보기", "See every change")}
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <h2>{latest.title}</h2>
          <p className="lede">{latest.summary}</p>
        </div>
        <div className="l4-wiki">
          <h2 className="h2">{t("위키로 바로가기", "Jump into the wiki")}</h2>
          {races.map((r) => (
            <Link key={r} className={`l4-rl ${r}`} href={`/${lang}/wiki#${r}`}>
              <b>{d.races[r]}</b>
              <span className="mono">
                {wiki.units.filter((u) => u.race === r).length} {t("유닛", "units")}
              </span>
              <ArrowRight size={18} aria-hidden />
            </Link>
          ))}
          <p className="mute">{t("모든 수치를 한 화면에서 보고, 이전 버전과 비교할 수 있습니다.", "See every number at once and compare with earlier versions.")}</p>
        </div>
      </section>

      <section className="l3-news wrap" id="news">
        <h2 className="h2">{t("뉴스", "News")}</h2>
        {news.map((p) => (
          <Link key={p.version} className="l3-nrow" href={`/${lang}/patches/${p.version}`}>
            <span className="mono">{p.version}</span>
            <span>{p.title}</span>
            <span className="mono mute">{p.date ?? d.patches.dateTbd}</span>
            <ArrowRight size={18} aria-hidden />
          </Link>
        ))}
      </section>
    </>
  );
}
