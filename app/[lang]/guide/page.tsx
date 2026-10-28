import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { site, wiki } from "@/lib/data";
import { buildSteps, convenienceEn, optionRows } from "@/lib/content/guide";
import { LobbySetup } from "@/components/guide/LobbySetup";
import { DraftRehearsal } from "@/components/guide/DraftRehearsal";
import { MediaRow, MediaSlot } from "@/components/MediaSlot";

export async function generateMetadata({ params }: PageProps<"/[lang]/guide">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: lang === "ko" ? "가이드" : "Guide" };
}

export default async function GuidePage({ params }: PageProps<"/[lang]/guide">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const d = getDictionary(lang);

  const toc: [string, string][] = [
    ["setup", t("로비 세팅", "Lobby setup")],
    ["draft", t("드래프트 체험", "Draft rehearsal")],
    ["rooms", t("방 만들기", "Create a room")],
    ["bans", t("밴 개수 설정", "Set the ban count")],
    ["observer", t("옵저버", "Observers")],
    ["convenience", t("편의성 모드", "Convenience Mode")],
    ["params", t("옵션 요약표", "Option summary")],
  ];

  const roomSteps = buildSteps({ bans: 3, snake: false, conv: true, obs: false }).slice(0, 4);
  const convenience = site.convenience.map((c, i) => (lang === "ko" ? `${c.title}: ${c.description}` : convenienceEn[i]));

  return (
    <div className="wrap g2 g4">
      <aside className="g2-toc" aria-label={t("목차", "Contents")}>
        <b>{t("이 문서", "On this page")}</b>
        {toc.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </aside>

      <article className="g2-doc">
        <header className="pg-h">
          <h1 className="h1">{t("가이드", "Guide")}</h1>
          <p className="lede">
            {t(
              "옵션을 고르면 방 만드는 순서가 만들어지고, 아래에서 밴과 히든 픽을 미리 연습할 수 있습니다.",
              "Pick your options to get the room steps, then rehearse the ban and hidden pick below.",
            )}
          </p>
        </header>

        <section id="setup">
          <h2 className="h2">{t("로비 세팅", "Lobby setup")}</h2>
          <LobbySetup lang={lang} />
        </section>

        <section id="draft">
          <h2 className="h2">{t("드래프트 체험", "Draft rehearsal")}</h2>
          <p>
            {t(
              "밴 개수를 고르고 유닛을 눌러 밴해 보세요. 재생 버튼은 무작위 밴을 자동으로 보여줍니다. 밴이 끝나면 히든 픽 연습이 열립니다.",
              "Choose a ban count and click units to ban them. Replay shows random bans automatically. When bans end, the hidden pick rehearsal opens.",
            )}
          </p>
          <DraftRehearsal lang={lang} units={wiki.units} raceNames={d.races} />
        </section>

        <section id="rooms">
          <h2 className="h2">{t("방 만들기", "Create a room")}</h2>
          <p>
            {t(
              "v2.0부터 모드 구조가 하나로 합쳐져, 모드를 선택해 방을 만들기만 하면 코어, 옵저버, AI가 모두 준비됩니다.",
              "Since v2.0 the mod is a single package. Create a room with the mod and the core, observer, and AI are all ready.",
            )}
          </p>
          <ol className="l2-steps">
            {roomSteps.map((s) => (
              <li key={s.en}>{s[lang]}</li>
            ))}
          </ol>
          <p className="note">
            {t("섬멸전 맵이라면 어떤 맵에서든 플레이할 수 있습니다.", "You can play on any melee map.")}
          </p>
          <MediaSlot id="guide-mod-search" lang={lang} />
        </section>

        <section id="bans">
          <h2 className="h2">{t("밴 개수 설정", "Set the ban count")}</h2>
          <p>
            {t(
              "방장은 대기실에서 밴 개수를 0, 1, 3, 5 중 하나로 고릅니다. 각 밴은 30초 제한 시간 안에 진행하고, 밴이 끝나면 비공개 히든 픽이 열립니다.",
              "The host picks 0, 1, 3 or 5 bans in the lobby. Each ban has a 30-second limit; the hidden pick opens when bans end.",
            )}
          </p>
          <p className="note">
            <b>v1.4.3</b>{" "}
            {t(
              "3밴에서 스네이크 밴 옵션을 켜면 1→2→2→1→1→2 순서로 진행합니다. 관측선, 의료선, 차원 분광기는 밴 풀에서 제외됩니다.",
              "With 3 bans the snake option runs 1→2→2→1→1→2. Observer, Medivac and Warp Prism are not in the ban pool.",
            )}
          </p>
          <MediaSlot id="guide-lobby-options" lang={lang} />
        </section>

        <section id="observer">
          <h2 className="h2">{t("옵저버", "Observers")}</h2>
          <p>
            {t(
              "중계진과 심판은 [관전자] 슬롯으로 입장하면 됩니다. 옵저버 UI는 자동으로 켜지며, 전용 밴픽 오버레이와 경기 중계 HUD가 표시됩니다.",
              "Casters and referees join through the Observer slots. The observer UI turns on automatically with the broadcast draft overlay and match HUD.",
            )}
          </p>
          <ul className="bul">
            <li>
              <span className="mono">Shift + B</span> {t("인게임 요약 바 표시/숨김", "Show or hide the in-game summary bar")}
            </li>
            <li>
              <span className="mono">Shift + D</span> {t("상세 밴픽 결과 표시/숨김", "Show or hide the detailed ban-pick result")}
            </li>
            <li>
              {t(
                "밴픽이 끝난 뒤에도 인게임에서 밴픽 결과 전체 확인 창을 열어, 각 유닛이 무엇을 대신해 선택되었는지 볼 수 있습니다.",
                "After the draft you can still open the full ban-pick review window in game to see which unit each pick replaced.",
              )}
            </li>
          </ul>
          <MediaRow ids={["guide-observer-slot", "guide-observer-shortcuts"]} lang={lang} />
        </section>

        <section id="convenience">
          <h2 className="h2">{t("편의성 모드", "Convenience Mode")}</h2>
          <p>
            {t(
              "방장이 대기실에서 켜고 끌 수 있으며 기본값은 켜짐입니다. 켜진 경기에서는 다음 기능을 사용할 수 있습니다.",
              "The host toggles it in the lobby; it is on by default. When on, these features are available.",
            )}
          </p>
          <ul className="bul">
            {convenience.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <MediaSlot id="guide-convenience-hud" lang={lang} />
        </section>

        <section id="params">
          <h2 className="h2">{t("옵션 요약표", "Option summary")}</h2>
          <div className="tscroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("옵션", "Option")}</th>
                  <th>{t("값", "Values")}</th>
                  <th>{t("효과", "Effect")}</th>
                  <th>{t("추가", "Since")}</th>
                </tr>
              </thead>
              <tbody>
                {optionRows.map((r) => (
                  <tr key={r.name.en}>
                    <td>
                      <b>{r.name[lang]}</b>
                    </td>
                    <td className="mono">{r.values}</td>
                    <td className="wrapc">{r.effect[lang]}</td>
                    <td className="mono">{r.since}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </div>
  );
}
