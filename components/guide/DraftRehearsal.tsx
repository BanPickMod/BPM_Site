"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import type { Lang } from "@/lib/i18n/config";
import type { ExtensionUnit, Race } from "@/lib/data";

const BAN_COUNTS = [0, 1, 3, 5] as const;
const RACES: Race[] = ["terran", "protoss", "zerg"];

type Pick = "base" | "ext";

export function DraftRehearsal({
  lang,
  units,
  raceNames,
}: {
  lang: Lang;
  units: ExtensionUnit[];
  raceNames: Record<Race, string>;
}) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const name = (u: ExtensionUnit) => u[lang];
  const pairName = (u: ExtensionUnit) => (lang === "ko" ? u.pairKo : u.pairEn);

  const [n, setN] = useState<number>(3);
  const [banned, setBanned] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const locked = banned.length >= n;
  // One group per race: the first extension unit of that race that was not banned.
  const groups = RACES.map((r) => units.find((u) => u.race === r && !banned.includes(u.id))).filter(
    (u): u is ExtensionUnit => !!u,
  );
  const allPicked = groups.every((u) => picks[u.id]);

  const reset = (count = n) => {
    clearTimers();
    setN(count);
    setBanned([]);
    setPicks({});
  };

  const toggleBan = (id: string) => {
    setPicks({});
    setBanned((b) => (b.includes(id) ? b.filter((x) => x !== id) : b.length < n ? [...b, id] : b));
  };

  const replay = () => {
    reset();
    const pool = [...units].sort(() => Math.random() - 0.5).slice(0, n).map((u) => u.id);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setBanned(pool);
    pool.forEach((id, i) => {
      timers.current.push(setTimeout(() => setBanned((b) => [...b, id]), 420 * (i + 1)));
    });
  };

  const left = n - banned.length;
  const status =
    n === 0
      ? t("0밴: 밴 없이 곧바로 히든 픽으로 넘어갑니다.", "0 bans: skip straight to the hidden pick.")
      : left > 0
        ? t(`상대 선택지를 ${left}개 더 밴하세요. 유닛을 누르면 밴됩니다.`, `Ban ${left} more option${left > 1 ? "s" : ""}. Click a unit to ban it.`)
        : t("밴 종료. 이제 그룹별로 비공개 히든 픽을 합니다.", "Bans locked. Now make your hidden pick for each group.");

  return (
    <div className="dk">
      <div className="dk-head">
        <div className="seg" role="group" aria-label={t("밴 개수", "Ban count")}>
          {BAN_COUNTS.map((c) => (
            <button key={c} type="button" aria-pressed={n === c} onClick={() => reset(c)}>
              {c}
              {t("밴", " ban")}
            </button>
          ))}
        </div>
        <div className="dk-acts">
          <button className="btn btn-pri" type="button" onClick={replay}>
            <Play size={18} aria-hidden />
            {t("드래프트 재생", "Replay draft")}
          </button>
          <button className="btn btn-sec" type="button" onClick={() => reset()}>
            <RotateCcw size={18} aria-hidden />
            {t("처음부터", "Reset")}
          </button>
        </div>
      </div>

      <div className="l3-grid">
        {units.map((u) => {
          const isBan = banned.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              className={`l3-tile${isBan ? " is-ban" : ""}`}
              aria-pressed={isBan}
              disabled={n === 0}
              onClick={() => toggleBan(u.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.icon} alt="" width={44} height={44} />
              <span className="tn">{name(u)}</span>
              <span className="stamp">BAN</span>
            </button>
          );
        })}
      </div>
      <p className="l3-status" role="status">
        {status}
      </p>

      {locked && (
        <div className="dk-pick">
          <h3>{t("히든 픽", "Hidden pick")}</h3>
          <p className="mute">
            {t(
              "각 그룹에서 기본 유닛과 확장 유닛 중 하나를 고르세요. 상대에게는 선택 결과가 보이지 않습니다.",
              "In each group choose the base or the extension unit. Your opponent cannot see the choice.",
            )}
          </p>
          <div className="dk-groups">
            {groups.map((u) => (
              <div key={u.id} className="dk-g">
                <div className="dk-gh">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.icon} alt="" width={40} height={40} />
                  <b>{raceNames[u.race]}</b>
                </div>
                <div className="dk-opts">
                  {(["base", "ext"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={`opt${picks[u.id] === kind ? " on" : ""}`}
                      aria-pressed={picks[u.id] === kind}
                      onClick={() => setPicks((p) => ({ ...p, [u.id]: kind }))}
                    >
                      {kind === "base" ? pairName(u) : name(u)}
                      <small>{kind === "base" ? t("기본", "Base") : t("확장", "Extension")}</small>
                    </button>
                  ))}
                </div>
                <p className="dk-opp mono">
                  {t("상대 화면", "Opponent sees")}: {picks[u.id] ? "?" : "..."}
                </p>
              </div>
            ))}
          </div>
          <p className="dk-done" role="status">
            {allPicked
              ? t(
                  "모든 픽 완료. 결과가 양측 테크트리에 적용되고 3, 2, 1 카운트다운 뒤 경기가 시작됩니다.",
                  "All picks locked. Results apply to both tech trees and a 3, 2, 1 countdown starts the match.",
                )
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}
