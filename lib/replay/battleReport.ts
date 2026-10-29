import { canonType, composition, sampleGap, type Cost, type CompEntry, type CostOf } from "./squads.ts";
import { posAt, statAt, type Battle, type Model, type Owner, type Unit } from "./timeline.ts";

export interface Value {
  minerals: number;
  gas: number;
  supply: number;
  /** Minerals + gas. */
  total: number;
}

const ZERO: Value = { minerals: 0, gas: 0, supply: 0, total: 0 };

export function valueOf(units: { type: string }[], costOf: CostOf): Value {
  const v = { ...ZERO };
  for (const u of units) {
    const c: Cost | null = costOf(canonType(u.type));
    if (!c) continue;
    v.minerals += c.minerals; v.gas += c.gas; v.supply += c.supply;
  }
  v.total = v.minerals + v.gas;
  return v;
}

export interface SideReport {
  owner: Owner;
  /** Units seen taking part: the ones that died in the fight and the survivors recorded near it. */
  engaged: CompEntry[];
  engagedValue: Value;
  lost: CompEntry[];
  lostValue: Value;
  survivors: CompEntry[];
  /** Buildings that fell in the fight (not counted in the values above). */
  buildingsLost: CompEntry[];
  /** The player's army value (the game's own statistic) just before the fight, and the share of it that was seen in the fight. */
  armyBefore: number | null;
  share: number | null;
}

export interface BattleReport {
  id: number;
  label: string;
  t0: number;
  t1: number;
  sides: [SideReport, SideReport];
  /** What side A lost for every 1 that side B lost (value), or null when nobody lost anything. */
  exchange: { aKilledPerLoss: number | null; bKilledPerLoss: number | null };
  /** Engaged value of A against B, 1 = equal, 2 = A brought twice as much. Null when either side was not seen. */
  forceRatio: number | null;
}

const ZONE = 24;       // cells from the centre of the fight within which a death belongs to it
const LOOK_BEFORE = 12;
const LOOK_AFTER = 8;

const inZone = (x: number, y: number, b: Battle) => Math.hypot(x - b.cx, y - b.cy) <= ZONE;

function side(model: Model, b: Battle, owner: Owner, costOf: CostOf): SideReport {
  const died: Unit[] = [], survived: Unit[] = [], buildings: Unit[] = [];
  const times = [b.t0 - LOOK_BEFORE / 2, b.t0, (b.t0 + b.t1) / 2, b.t1, b.t1 + LOOK_AFTER / 2];
  for (const u of model.units) {
    if (u.owner !== owner) continue;
    if (u.died >= b.t0 - 0.1 && u.died <= b.t1 + 0.1 && u.death && inZone(u.death[0], u.death[1], b)) {
      (u.kind === "structure" ? buildings : died).push(u);
      continue;
    }
    if (u.kind === "structure" || u.mode !== "tracked" || u.died <= b.t1 + 0.1 || u.born > b.t1) continue;
    // alive after the fight and recorded near it while it went on
    if (times.some((t) => { const p = posAt(u, t, model.windowSec); return !!p && sampleGap(u, t) <= LOOK_BEFORE && inZone(p.x, p.y, b); })) survived.push(u);
  }
  const armyOnly = (l: Unit[]) => l.filter((u) => u.kind !== "structure");
  const engagedUnits = armyOnly([...died, ...survived]);
  const lost = armyOnly(died);
  const before = statAt(model, owner, Math.max(0, b.t0 - 1));
  const engagedValue = valueOf(engagedUnits, costOf);
  const armyBefore = before ? before.armyValue : null;
  return {
    owner,
    engaged: composition(engagedUnits, costOf), engagedValue,
    lost: composition(lost, costOf), lostValue: valueOf(lost, costOf),
    survivors: composition(survived, costOf),
    buildingsLost: composition(buildings, costOf),
    armyBefore,
    share: armyBefore && armyBefore > 0 ? Math.min(1, engagedValue.total / armyBefore) : null,
  };
}

/** Both sides of one detected fight, from the unit list alone, so it works for replays analysed before this existed. */
export function battleReport(model: Model, b: Battle, costOf: CostOf): BattleReport {
  const a = side(model, b, 1, costOf), c = side(model, b, 2, costOf);
  const ratio = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) / 100 : null);
  return {
    id: b.id, label: b.label, t0: b.t0, t1: b.t1, sides: [a, c],
    exchange: { aKilledPerLoss: ratio(c.lostValue.total, a.lostValue.total), bKilledPerLoss: ratio(a.lostValue.total, c.lostValue.total) },
    forceRatio: a.engagedValue.total > 0 && c.engagedValue.total > 0 ? ratio(a.engagedValue.total, c.engagedValue.total) : null,
  };
}
