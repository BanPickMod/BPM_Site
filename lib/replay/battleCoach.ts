import { battleReport, type BattleReport } from "./battleReport.ts";
import type { CostOf } from "./squads.ts";
import { statAt, type Battle, type Model, type Owner } from "./timeline.ts";

/**
 * Plain-language notes on one fight, from what the replay shows and nothing else: the trade, the size of the forces, what the player
 * was holding in the bank, what fell. It is not the AI form read; every note names a thing that can be checked in the report beside
 * it. The thresholds are constants so they can be tuned as more games are seen.
 */
export type Tone = "good" | "bad" | "info";

export interface Note {
  owner: Owner;
  id: string;
  tone: Tone;
  ko: string;
  en: string;
  /** Larger is shown first when only a few notes fit. */
  weight: number;
}

export interface BattleNotes {
  id: number;
  /** The fight as a whole: nothing much, a clear win for `owner`, or an even price paid. */
  verdict: { kind: "small" | "win" | "even"; owner: Owner | null };
  notes: Note[];
}

export const BIG_TRADE = 2;          // one side lost at most half of what it dealt
export const BANK_MINERALS = 1500;    // unspent minerals just before a fight
export const SMALL_SHARE = 0.5;      // share of the army that took part
export const WORKER_RAID = 4;        // workers killed in the fight
export const SPENT_ARMY = 0.35;      // army value left after the fight, against before
export const KEPT_ARMY = 0.8;
export const MAXED_SUPPLY = 190;
const HALL = /commandcenter|orbital|planetary|nexus|hatchery|lair|hive/i;
const ZONE = 24;

const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
const times = (v: number) => (Math.round(v * 10) / 10).toString();

function workersKilled(model: Model, b: Battle, owner: Owner): number {
  let n = 0;
  for (const u of model.units) {
    if (u.owner !== owner || u.kind !== "worker" || !u.death || u.died < b.t0 - 0.1 || u.died > b.t1 + 0.1) continue;
    if (Math.hypot(u.death[0] - b.cx, u.death[1] - b.cy) <= ZONE) n++;
  }
  return n;
}

export function battleNotes(model: Model, b: Battle, costOf: CostOf, report: BattleReport = battleReport(model, b, costOf)): BattleNotes {
  const notes: Note[] = [];
  const add = (n: Note) => notes.push(n);
  const [sa, sb] = report.sides;
  const sideOf = (o: Owner) => report.sides[o - 1];
  const other = (o: Owner): Owner => (o === 1 ? 2 : 1);

  for (const o of [1, 2] as Owner[]) {
    const me = sideOf(o), foe = sideOf(other(o));
    const dealt = foe.lostValue.total, lost = me.lostValue.total;
    const ratio = o === 1 ? report.forceRatio : report.forceRatio ? Math.round((1 / report.forceRatio) * 100) / 100 : null;

    if (dealt >= 300 && (lost === 0 || dealt / lost >= BIG_TRADE)) {
      add({ owner: o, id: "trade-win", tone: "good", weight: 9,
        ko: lost === 0 ? `잃은 병력 없이 ${n0(dealt)} 가치를 파괴했습니다.` : `${n0(lost)} 가치를 잃고 ${n0(dealt)} 가치를 파괴했습니다. 교환 ${times(dealt / lost)} 대 1.`,
        en: lost === 0 ? `Destroyed ${n0(dealt)} of value without losing any army.` : `Lost ${n0(lost)} and destroyed ${n0(dealt)}: a ${times(dealt / lost)} to 1 trade.` });
    } else if (lost >= 300 && (dealt === 0 || lost / dealt >= BIG_TRADE)) {
      add({ owner: o, id: "trade-loss", tone: "bad", weight: 9,
        ko: dealt === 0 ? `${n0(lost)} 가치를 잃는 동안 하나도 잡지 못했습니다.` : `${n0(lost)} 가치를 잃고 ${n0(dealt)} 가치밖에 파괴하지 못했습니다.`,
        en: dealt === 0 ? `Lost ${n0(lost)} of value and killed nothing.` : `Lost ${n0(lost)} but destroyed only ${n0(dealt)}.` });
    }

    if (ratio !== null && ratio >= 1.5 && lost > dealt * 1.2 && lost >= 300) {
      add({ owner: o, id: "wasted-edge", tone: "bad", weight: 8,
        ko: `병력이 ${times(ratio)}배 더 많았는데 오히려 더 잃었습니다. 진형이나 유닛 상성을 확인해 볼 만합니다.`,
        en: `Brought ${times(ratio)}x the force yet lost more. Worth checking formation and unit matchups.` });
    } else if (ratio !== null && ratio <= 1 / 1.5 && dealt > lost * 1.2 && dealt >= 300) {
      add({ owner: o, id: "outnumbered-win", tone: "good", weight: 8,
        ko: `병력이 ${times(1 / ratio)}배 적었는데도 더 많이 파괴했습니다.`,
        en: `Outnumbered ${times(1 / ratio)} to 1 and still destroyed more.` });
    }

    if (me.share !== null && me.armyBefore !== null && me.armyBefore >= 1000 && me.share < SMALL_SHARE && me.engagedValue.total > 0) {
      add({ owner: o, id: "small-share", tone: "info", weight: 5,
        ko: `병력의 ${Math.round(me.share * 100)}%만 교전에 참여했습니다. 나머지는 다른 곳에 있었거나 기록되지 않았습니다.`,
        en: `Only ${Math.round(me.share * 100)}% of the army took part. The rest was elsewhere or not recorded.` });
    }

    const before = statAt(model, o, Math.max(0, b.t0 - 1)), after = statAt(model, o, b.t1 + 8);
    if (before && before.minerals >= BANK_MINERALS) {
      add({ owner: o, id: "bank", tone: "bad", weight: 6,
        ko: `교전 직전 쓰지 못한 광물이 ${n0(before.minerals)}만큼 쌓여 있었습니다.`,
        en: `Held ${n0(before.minerals)} unspent minerals going into the fight.` });
    }
    if (before && before.supply[0] >= MAXED_SUPPLY) {
      add({ owner: o, id: "maxed", tone: "info", weight: 4,
        ko: `인구 ${before.supply[0]}로 최대 인구 가까이에서 싸웠습니다. 잃어도 빠르게 다시 채울 수 있는 상태입니다.`,
        en: `Fought at ${before.supply[0]} supply, near the cap, so losses can be replaced fast.` });
    }
    if (before && after && before.armyValue >= 1500) {
      const left = after.armyValue / before.armyValue;
      if (left <= SPENT_ARMY) {
        add({ owner: o, id: "army-spent", tone: "bad", weight: 7,
          ko: `교전 뒤 병력 가치가 ${Math.round(left * 100)}%만 남았습니다. 이 틈에 상대 반격을 받을 수 있습니다.`,
          en: `Only ${Math.round(left * 100)}% of the army's value was left afterwards, which leaves room for a counter.` });
      } else if (left >= KEPT_ARMY && dealt >= 500) {
        add({ owner: o, id: "army-kept", tone: "good", weight: 6,
          ko: `병력 가치를 ${Math.min(100, Math.round(left * 100))}% 지킨 채 싸움을 끝냈습니다. 바로 밀어붙일 수 있는 상황입니다.`,
          en: `Came out with ${Math.min(100, Math.round(left * 100))}% of the army intact, ready to push on.` });
      }
    }

    const killedWorkers = workersKilled(model, b, o);
    if (killedWorkers >= WORKER_RAID) {
      add({ owner: o, id: "worker-raid", tone: "bad", weight: 8,
        ko: `일꾼 ${killedWorkers}기를 잃었습니다. 견제가 들어왔거나 일꾼이 교전에 휘말렸습니다.`,
        en: `Lost ${killedWorkers} workers: a raid or workers caught in the fight.` });
    }

    const halls = me.buildingsLost.filter((c) => HALL.test(c.type)).reduce((s, c) => s + c.count, 0);
    if (halls > 0) {
      add({ owner: o, id: "hall-lost", tone: "bad", weight: 10,
        ko: `주요 건물(본진·확장) ${halls}개를 잃었습니다.`,
        en: `Lost ${halls} town hall${halls > 1 ? "s" : ""}.` });
    } else if (me.buildingsLost.length) {
      const k = me.buildingsLost.reduce((s, c) => s + c.count, 0);
      add({ owner: o, id: "buildings-lost", tone: "info", weight: 3, ko: `건물 ${k}개가 파괴됐습니다.`, en: `${k} building${k > 1 ? "s" : ""} fell.` });
    }
  }

  const ta = sa.lostValue.total, tb = sb.lostValue.total;
  const verdict: BattleNotes["verdict"] =
    ta + tb < 200 ? { kind: "small", owner: null }
    : tb >= ta * BIG_TRADE ? { kind: "win", owner: 1 }
    : ta >= tb * BIG_TRADE ? { kind: "win", owner: 2 }
    : { kind: "even", owner: null };

  // one line per event: the winner's trade already says what the loser's would
  for (const o of [1, 2] as Owner[]) {
    const drop = (id: string, byId: string) => { if (notes.some((n) => n.owner === other(o) && n.id === byId)) { const i = notes.findIndex((n) => n.owner === o && n.id === id); if (i >= 0) notes.splice(i, 1); } };
    drop("trade-loss", "trade-win");
  }

  notes.sort((x, y) => y.weight - x.weight || x.owner - y.owner);
  return { id: b.id, verdict, notes };
}
