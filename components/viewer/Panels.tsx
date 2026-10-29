"use client";

import { useMemo, useState } from "react";
import type { Lang } from "@/lib/i18n/config";
import type { Clock } from "@/lib/replay/clock";
import { buildLog, compSeries, fmtTime, pickUsage, type Model, type Owner } from "@/lib/replay/timeline";
import { battleReport, type SideReport } from "@/lib/replay/battleReport";
import type { CompEntry } from "@/lib/replay/squads";
import { unitCost, unitInfo } from "@/lib/replay/units";
import { CompChart, FormChart, LineChart, OWNER_COLOR } from "./charts";
import { swings, type Evaluation } from "@/lib/replay/evaluation";
import { useClockTime } from "./useClock";
import { typeName } from "./names";

type Tab = "summary" | "units" | "economy" | "build" | "battles";
const OWNERS: Owner[] = [1, 2];

export function Panels({ model, clock, lang, evaluation = null, evaluationPending = false }: { model: Model; clock: Clock; lang: Lang; evaluation?: Evaluation | null; evaluationPending?: boolean }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [tab, setTab] = useState<Tab>("summary");
  const tabs: [Tab, string][] = [["summary", t("요약", "Summary")], ["units", t("유닛", "Units")], ["economy", t("경제", "Economy")], ["build", t("빌드", "Build")], ["battles", t("교전", "Battles")]];
  return (
    <div className="vw-panels">
      <div className="vw-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="vw-tabpanel" role="tabpanel">
        {tab === "summary" && <Summary model={model} clock={clock} lang={lang} evaluation={evaluation} evaluationPending={evaluationPending} />}
        {tab === "units" && <Units model={model} clock={clock} lang={lang} />}
        {tab === "economy" && <Economy model={model} clock={clock} lang={lang} />}
        {tab === "build" && <Build model={model} clock={clock} lang={lang} />}
        {tab === "battles" && <Battles model={model} clock={clock} lang={lang} />}
      </div>
    </div>
  );
}

interface P { model: Model; clock: Clock; lang: Lang }
const who = (o: Owner, lang: Lang) => (lang === "ko" ? `플레이어 ${o}` : `Player ${o}`);

/** The AI form curve with the moments it moved most. Honest about what it is: a model score, faded early, not calibrated on BPM games. */
function FormCard({ ev, model, clock, lang }: { ev: Evaluation; model: Model; clock: Clock; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const moves = useMemo(() => swings(ev), [ev]);
  return (
    <section className="vw-card vw-formcard">
      <h3>{t("AI 형세 평가", "AI form read")}</h3>
      <p className="vw-sub">{t("선이 위면 플레이어 1이, 아래면 플레이어 2가 앞섭니다. 클릭하면 그 시점으로 이동합니다.", "Above the middle line player 1 is ahead, below it player 2. Click to jump there.")}</p>
      <FormChart ev={ev} duration={model.duration} clock={clock} labels={{ p1: who(1, lang), p2: who(2, lang), hold: t("4분 전은 판단 보류", "No read before 4:00") }} />
      {moves.length > 0 && (
        <div className="vw-swings">
          <span className="vw-sub">{t("형세가 크게 바뀐 곳", "Biggest swings")}</span>
          {moves.map((m) => (
            <button key={m.t} onClick={() => clock.set(m.t)} style={{ borderColor: OWNER_COLOR[m.toward] }}>
              {fmtTime(m.t)} → {t(`플레이어 ${m.toward} 쪽`, `toward player ${m.toward}`)}
            </button>
          ))}
        </div>
      )}
      <p className="vw-fine">
        {t("프로 경기로 학습한 모델의 점수이며 BPM 경기로 아직 보정되지 않았습니다. 승리 확률이 아닙니다. 4분 전은 맞히지 못해 숨기고, 4–8분은 흐리게 표시합니다.",
          "A score from a model trained on professional games, not yet calibrated on BPM games. It is not a win probability. It is hidden before 4:00 where it is unreliable and shown faded until 8:00.")}
      </p>
    </section>
  );
}

function Summary({ model, clock, lang, evaluation, evaluationPending }: P & { evaluation: Evaluation | null; evaluationPending: boolean }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const comps = useMemo(() => ({ 1: compSeries(model, 1), 2: compSeries(model, 2) }), [model]);
  return (
    <>
    {evaluation && <FormCard ev={evaluation} model={model} clock={clock} lang={lang} />}
    {!evaluation && evaluationPending && <p className="vw-fine">{t("AI 형세 평가를 계산하는 중입니다. 잠시 뒤 새로 고침하면 나타납니다.", "The AI form read is being computed. Refresh in a moment.")}</p>}
    <div className="vw-grid2">
      {OWNERS.map((o) => {
        const last = model.series[o].at(-1), peak = Math.max(0, ...model.series[o].map((s) => s.armyValue)), peakWorkers = Math.max(0, ...model.series[o].map((s) => s.workers));
        const usage = pickUsage(model, o, model.duration), made = usage.reduce((a, u) => a + u.made, 0);
        return (
          <section key={o} className="vw-card">
            <h3 style={{ color: OWNER_COLOR[o] }}>{who(o, lang)}</h3>
            <p className="vw-sub">{t("군대 규모 (노랑·연두 = 고른 유닛)", "Army size (lime = picked units)")}</p>
            <CompChart data={comps[o]} color={OWNER_COLOR[o]} duration={model.duration} clock={clock} pickLabel={t("고른 유닛", "Picked")} otherLabel={t("그 외", "Other")} />
            <dl className="vw-kv">
              <div><dt>{t("최대 군대 가치", "Peak army value")}</dt><dd>{Math.round(peak).toLocaleString()}</dd></div>
              <div><dt>{t("최대 일꾼", "Peak workers")}</dt><dd>{peakWorkers}</dd></div>
              <div><dt>{t("고른 유닛 생산", "Picked units made")}</dt><dd>{made}</dd></div>
              <div><dt>{t("잃은 자원", "Resources lost")}</dt><dd>{Math.round(last?.lost ?? 0).toLocaleString()}</dd></div>
              <div><dt>{t("파괴한 자원", "Resources killed")}</dt><dd>{Math.round(last?.killed ?? 0).toLocaleString()}</dd></div>
            </dl>
          </section>
        );
      })}
    </div>
    </>
  );
}

function Units({ model, clock, lang }: P) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const now = useClockTime(clock, 1);
  return (
    <div className="vw-grid2">
      {OWNERS.map((o) => {
        const rows = pickUsage(model, o, now);
        return (
          <section key={o} className="vw-card">
            <h3 style={{ color: OWNER_COLOR[o] }}>{who(o, lang)}</h3>
            {rows.length === 0 ? <p className="dim">{t("기본 유닛을 그대로 사용했습니다.", "Kept the default units.")}</p> : (
              <table className="vw-table">
                <thead><tr><th>{t("고른 유닛", "Pick")}</th><th>{t("생산", "Made")}</th><th>{t("생존", "Alive")}</th><th>{t("손실", "Lost")}</th><th>{t("첫 등장", "First")}</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.unit} className={r.unused ? "unused" : ""}>
                      <td>{typeName(r.unit, lang)}</td><td>{r.made}</td><td>{r.alive}</td><td>{r.lost}</td>
                      <td>{r.first !== null ? <button className="vw-link" onClick={() => clock.set(r.first!)}>{fmtTime(r.first)}</button> : <span className="dim">{t("한 번도 안 씀", "never used")}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Economy({ model, clock, lang }: P) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const line = (pick: (s: Model["series"][1][number]) => number, o: Owner): [number, number][] => model.series[o].map((s) => [s.t, pick(s)]);
  const both = (pick: (s: Model["series"][1][number]) => number, unit?: string) => (
    <LineChart duration={model.duration} clock={clock} unit={unit} lines={OWNERS.map((o) => ({ color: OWNER_COLOR[o], label: who(o, lang), pts: line(pick, o) }))} />
  );
  return (
    <div className="vw-grid2">
      <section className="vw-card"><h3>{t("군대 가치", "Army value")}</h3>{both((s) => s.armyValue)}</section>
      <section className="vw-card"><h3>{t("일꾼 수", "Workers")}</h3>{both((s) => s.workers)}</section>
      <section className="vw-card"><h3>{t("수입 (광물+가스 / 분)", "Income (minerals+gas / min)")}</h3>{both((s) => s.incomeMin + s.incomeGas)}</section>
      <section className="vw-card"><h3>{t("누적 지출", "Resources spent")}</h3>{both((s) => s.spent)}</section>
    </div>
  );
}

function Build({ model, clock, lang }: P) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const logs = useMemo(() => ({ 1: buildLog(model, 1), 2: buildLog(model, 2) }), [model]);
  return (
    <div className="vw-grid2">
      {OWNERS.map((o) => (
        <section key={o} className="vw-card">
          <h3 style={{ color: OWNER_COLOR[o] }}>{who(o, lang)}</h3>
          <p className="vw-sub">{t("처음 등장한 유닛·건물 순서 (눌러서 이동)", "First appearance of each unit and building (click to jump)")}</p>
          <ol className="vw-log">
            {logs[o].map((e) => (
              <li key={e.type} className={e.pick ? "pick" : ""}>
                <button className="vw-link" onClick={() => clock.set(e.t)}>{fmtTime(e.t)}</button>
                <span>{typeName(e.type, lang)}</span>
                {e.building && <em>{t("건물", "bldg")}</em>}
                {e.pick && <em className="pk">{t("고른 유닛", "pick")}</em>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function UnitChip({ entry, lang, tone }: { entry: CompEntry; lang: Lang; tone?: "lost" }) {
  const info = unitInfo(entry.type, lang), name = typeName(entry.type, lang);
  return (
    <span className={`vw-uc${tone === "lost" ? " lost" : ""}${entry.pick ? " pick" : ""}`} title={`${name} ×${entry.count}`}>
      {info.icon ? <img src={info.icon} alt="" width={26} height={26} loading="lazy" /> : <b>{name.slice(0, 2)}</b>}
      <em>×{entry.count}</em>
    </span>
  );
}

const RESOURCE_ICON = { mineral: "/images/icons/resource-mineral.png", gas: "/images/icons/resource-gas.png", supply: "/images/icons/resource-supply.png" } as const;

function ResourceFigure({ kind, value, label }: { kind: keyof typeof RESOURCE_ICON; value: string; label: string }) {
  return (
    <span className="vw-rf" title={label}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small static icon */}
      <img src={RESOURCE_ICON[kind]} alt={label} width={16} height={16} />{value}
    </span>
  );
}

const n0 = (n: number) => Math.round(n).toLocaleString();
const supplyText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function SideBlock({ side, lang }: { side: SideReport; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const color = OWNER_COLOR[side.owner], lv = side.lostValue;
  return (
    <div className="vw-bs" style={{ borderTopColor: color }}>
      <div className="vw-bs-h"><strong style={{ color }}>{who(side.owner, lang)}</strong>
        {side.share !== null && <span className="dim">{t(`병력의 ${Math.round(side.share * 100)}% 참전`, `${Math.round(side.share * 100)}% of army`)}</span>}
      </div>
      <div className="vw-bs-row"><span className="vw-bs-k">{t("참전", "In the fight")}</span>
        <span className="vw-ucs">{side.engaged.length ? side.engaged.slice(0, 9).map((c) => <UnitChip key={c.type} entry={c} lang={lang} />) : <span className="dim">{t("관측된 병력 없음", "none seen")}</span>}</span></div>
      <div className="vw-bs-row"><span className="vw-bs-k">{t("손실", "Lost")}</span>
        <span className="vw-ucs">{side.lost.length ? side.lost.slice(0, 9).map((c) => <UnitChip key={c.type} entry={c} lang={lang} tone="lost" />) : <span className="dim">{t("없음", "none")}</span>}</span></div>
      <div className="vw-val">
        <ResourceFigure kind="mineral" value={n0(lv.minerals)} label={t("광물", "Minerals")} />
        <ResourceFigure kind="gas" value={n0(lv.gas)} label={t("가스", "Gas")} />
        <ResourceFigure kind="supply" value={supplyText(lv.supply)} label={t("인구", "Supply")} />
        <b>{t("손실 가치", "lost")} {n0(lv.total)}</b>
      </div>
      {side.buildingsLost.length > 0 && (
        <div className="vw-bs-row"><span className="vw-bs-k">{t("건물", "Buildings")}</span>
          <span className="vw-ucs">{side.buildingsLost.slice(0, 9).map((c) => <UnitChip key={c.type} entry={c} lang={lang} tone="lost" />)}</span></div>
      )}
    </div>
  );
}

function Battles({ model, clock, lang }: P) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const now = useClockTime(clock, 1);
  const reports = useMemo(() => model.battles.map((b) => battleReport(model, b, unitCost)), [model]);
  if (!model.battles.length) return <p className="dim">{t("뚜렷한 교전이 감지되지 않았습니다.", "No clear battles were detected.")}</p>;
  return (
    <>
      <ul className="vw-brep">
        {reports.map((r) => {
          const b = model.battles.find((x) => x.id === r.id)!, active = now >= r.t0 - 3 && now <= r.t1 + 6;
          const x = r.exchange;
          return (
            <li key={r.id} className={active ? "on" : ""}>
              <div className="vw-bh">
                <span className="vw-bl">{r.label}</span>
                <strong>{fmtTime(r.t0)}–{fmtTime(r.t1)}</strong>
                {r.forceRatio !== null && <span className="vw-pill" title={t("참전한 병력의 자원 가치 비율", "Ratio of the resource value that took part")}>{t("병력비", "Force")} {r.forceRatio >= 1 ? `${r.forceRatio} : 1` : `1 : ${Math.round((1 / r.forceRatio) * 100) / 100}`}</span>}
                {x.aKilledPerLoss !== null && x.bKilledPerLoss !== null && (
                  <span className="vw-pill" title={t("상대에게 입힌 손실 ÷ 내 손실(자원 가치)", "Value dealt ÷ value lost")}>
                    {t("교환", "Trade")} <b style={{ color: OWNER_COLOR[1] }}>{x.aKilledPerLoss}</b> : <b style={{ color: OWNER_COLOR[2] }}>{x.bKilledPerLoss}</b>
                  </span>
                )}
                {b.picksLost > 0 && <span className="pk">{t(`고른 유닛 ${b.picksLost}기 손실`, `${b.picksLost} picked lost`)}</span>}
                <button className="btn" onClick={() => clock.range(Math.max(0, r.t0 - 5), r.t1 + 5, 2)}>{t("보기", "Watch")}</button>
              </div>
              <div className="vw-bsides">{r.sides.map((side) => <SideBlock key={side.owner} side={side} lang={lang} />)}</div>
            </li>
          );
        })}
      </ul>
      <p className="dim">{t("교전은 사망 이벤트를 시간·거리로 묶어 자동 감지한 것이라 실제와 다를 수 있습니다. 참전 병력은 위치가 기록된 유닛과 교전 중 사망한 유닛만 센 값이라 실제보다 적을 수 있고, 손실 가치는 유닛 비용(광물+가스)과 인구를 더한 것입니다.", "Battles are detected by clustering deaths in time and space, so they can differ from what you would call a fight. Units in the fight are counted from recorded positions and deaths only, so the real number may be higher. Lost value is the units' cost (minerals + gas) and supply.")}</p>
    </>
  );
}
