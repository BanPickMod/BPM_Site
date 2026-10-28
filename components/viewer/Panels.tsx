"use client";

import { useMemo, useState } from "react";
import type { Lang } from "@/lib/i18n/config";
import type { Clock } from "@/lib/replay/clock";
import { buildLog, compSeries, fmtTime, pickUsage, type Model, type Owner } from "@/lib/replay/timeline";
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

function Battles({ model, clock, lang }: P) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const now = useClockTime(clock, 1);
  if (!model.battles.length) return <p className="dim">{t("뚜렷한 교전이 감지되지 않았습니다.", "No clear battles were detected.")}</p>;
  return (
    <>
      <ul className="vw-battles">
        {model.battles.map((b) => {
          const active = now >= b.t0 - 3 && now <= b.t1 + 6;
          const top = Object.entries(b.units).sort((x, y) => y[1] - x[1]).slice(0, 4);
          return (
            <li key={b.id} className={active ? "on" : ""}>
              <span className="vw-bl">{b.label}</span>
              <div>
                <strong>{fmtTime(b.t0)}–{fmtTime(b.t1)}</strong>
                <span className="dim"> · {t("손실", "lost")} <b style={{ color: OWNER_COLOR[1] }}>{b.lost[0]}</b> : <b style={{ color: OWNER_COLOR[2] }}>{b.lost[1]}</b>
                  {b.winner !== 0 && <> · {t("우세", "ahead")} {who(b.winner, lang)}</>}
                  {b.picksLost > 0 && <> · <span className="pk">{t(`고른 유닛 ${b.picksLost}기 손실`, `${b.picksLost} picked lost`)}</span></>}</span>
                <div className="vw-chips">{top.map(([ty, n]) => <span key={ty}>{typeName(ty, lang)} ×{n}</span>)}</div>
              </div>
              <button className="btn" onClick={() => clock.range(Math.max(0, b.t0 - 5), b.t1 + 5, 2)}>{t("보기", "Watch")}</button>
            </li>
          );
        })}
      </ul>
      <p className="dim">{t("교전은 사망 이벤트를 시간·거리로 묶어 자동 감지한 것이라 실제와 다를 수 있습니다.", "Battles are detected automatically by clustering deaths in time and space, so they can differ from what you would call a fight.")}</p>
    </>
  );
}
