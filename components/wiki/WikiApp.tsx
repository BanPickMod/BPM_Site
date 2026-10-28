"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, LayoutGrid, Plus, Search, Table2, X } from "lucide-react";
import type { Lang } from "@/lib/i18n/config";
import { races, type Race } from "@/lib/data";
import { RaceMark, type RaceKey } from "@/components/RaceMark";
import {
  abilityName,
  attrName,
  buildRow,
  delta,
  fmt,
  groupName,
  targetName,
  weaponText,
  type BaseUnit,
  type ExtUnit,
  type Row,
  type WikiData,
  type Weapon,
} from "@/lib/wiki";
import { TextWeapons, UnitNotesView, UpgradeList, WikiDetail, abilityMeta, type WikiCtx } from "./WikiDetail";

type View = "all" | "ext" | "base";
type Mode = "table" | "cards";
type ColGroup = "cost" | "body" | "combat" | "abil";

/* The open unit lives in the URL hash (#firebat), so links and the back button work and no effect has to sync state. */
const HASH_EVENT = "bpm-hash";
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  window.addEventListener(HASH_EVENT, cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener(HASH_EVENT, cb);
  };
};
const readHash = () => decodeURIComponent(window.location.hash.slice(1));
function setHash(value: string) {
  const url = window.location.pathname + window.location.search + (value ? `#${value}` : "");
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(HASH_EVENT));
}

export function WikiApp({ lang, data, raceNames }: { lang: Lang; data: WikiData; raceNames: Record<Race, string> }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const ctx: WikiCtx = { lang, raceNames, upgrades: data.upgrades };

  const versions = data.versions;
  const [ver, setVer] = useState(versions.find((v) => v.status === "current")!.id);
  const prevVer = versions[versions.findIndex((v) => v.id === ver) + 1]?.id ?? null;

  const [view, setView] = useState<View>("all");
  const [race, setRace] = useState<Race | "all">("all");
  const [q, setQ] = useState("");
  const [changed, setChanged] = useState(false);
  const [mode, setMode] = useState<Mode>("table");
  const [grp, setGrp] = useState<Record<ColGroup, boolean>>({ cost: true, body: true, combat: true, abil: false });

  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const openId = [...data.base, ...data.units].some((u) => u.id === hash) ? hash : null;

  const allRows = useMemo(
    () => ({
      base: data.base.map((u) => buildRow(u, "base", ver, data.changes)),
      ext: data.units.map((u) => buildRow(u, "ext", ver, data.changes)),
    }),
    [data, ver],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const order: Record<Race, number> = { terran: 0, protoss: 1, zerg: 2 };
    let r: Row[] = [];
    if (view !== "ext") r = r.concat(allRows.base);
    if (view !== "base") r = r.concat(allRows.ext);
    r = r.filter(
      (x) =>
        (race === "all" || x.race === race) &&
        (!needle || (x.ko + x.en).toLowerCase().includes(needle)) &&
        (!changed || Object.keys(x.ch).length > 0),
    );
    return r.sort((a, b) => order[a.race] - order[b.race] || (a.kind === b.kind ? 0 : a.kind === "ext" ? -1 : 1));
  }, [allRows, view, race, q, changed]);

  const open = (id: string) => setHash(id);
  const close = () => setHash("");
  const openRow = openId ? [...allRows.base, ...allRows.ext].find((r) => r.id === openId) : null;

  const changeCount = (r: Row) => Object.keys(r.ch).length;
  const was = (r: Row, k: keyof Row["ch"]) => (r.ch[k] !== undefined ? <span className="was">{String(r.ch[k])}</span> : null);

  const weaponLine = (w: Weapon, key: string) => {
    const tg = targetName(lang, w.targets);
    return (
      <div className="wl" key={key}>
        <b>{weaponText(lang, w)}</b>
        <span className="mono">
          {" "}
          DPS {fmt(w.dps)}
          {w.dpsBonus && w.dpsBonus !== w.dps ? ` (${w.dpsBonus})` : ""}
        </span>
        <span>
          {" "}
          {t("사거리", "range")} {fmt(w.range)}
          {tg ? ` · ${tg}` : ""}
        </span>
      </div>
    );
  };

  const combatCell = (r: Row) =>
    r.weapons && r.weapons.length ? (
      <>
        {r.weapons.map((w) => weaponLine(w, w.id))}
      </>
    ) : r.weapons ? (
      <span className="mute">{t("공격 없음", "No attack")}</span>
    ) : (
      <TextWeapons row={r} ctx={ctx} />
    );

  const abilCell = (r: Row) =>
    r.kind === "base" ? (
      r.abilities && r.abilities.length ? (
        r.abilities.map((a) => (
          <div className="wl" key={a.id}>
            <b>{abilityName(lang, a)}</b>
            <span className="mono"> {abilityMeta(lang, a)}</span>
          </div>
        ))
      ) : (
        <span className="mute">-</span>
      )
    ) : (
      <span className="mute">{t("전용 연구와 능력은 상세에서", "Upgrades and abilities in details")}</span>
    );

  interface Col {
    k: string;
    g: ColGroup | "id";
    n?: boolean;
    wrap?: boolean;
    wide?: boolean;
    sticky?: boolean;
    label: string;
    cell: (r: Row) => React.ReactNode;
  }

  const num = (r: Row, k: "hp" | "shields" | "armor" | "speed", text = false) => (
    <>
      <span>{text ? fmt(r[k]) : r[k] ?? "-"}</span>
      {was(r, k)}
    </>
  );

  const COLS: Col[] = [
    {
      k: "name", g: "id", sticky: true, label: t("유닛", "Unit"),
      cell: (r) => (
        <span className="uc">
          {r.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="uico" src={r.icon} alt="" width={28} height={28} />
          ) : (
            <RaceMark race={r.race as RaceKey} label={raceNames[r.race]} />
          )}
          <b>{r[lang]}</b>
        </span>
      ),
    },
    {
      k: "src", g: "id", label: t("구분", "Type"),
      cell: (r) => (
        <>
          <span className={`src ${r.kind}`}>{r.kind === "ext" ? "BPM" : t("기본", "Base")}</span>
          {r.kind === "base" && <span className="mute"> {groupName(lang, r.group)}</span>}
        </>
      ),
    },
    { k: "minerals", g: "cost", n: true, label: t("광물", "Minerals"), cell: (r) => <>{fmt(r.cost.minerals)}{was(r, "minerals")}</> },
    { k: "gas", g: "cost", n: true, label: t("가스", "Gas"), cell: (r) => <>{fmt(r.cost.gas)}{was(r, "gas")}</> },
    { k: "supply", g: "cost", n: true, label: t("인구", "Supply"), cell: (r) => <>{fmt(r.cost.supply)}{was(r, "supply")}</> },
    { k: "time", g: "cost", n: true, label: t("생산(초)", "Build (s)"), cell: (r) => <>{fmt(r.cost.time)}{was(r, "time")}</> },
    { k: "hp", g: "body", n: true, label: t("생명력", "Health"), cell: (r) => num(r, "hp") },
    { k: "shields", g: "body", n: true, label: t("보호막", "Shields"), cell: (r) => num(r, "shields", true) },
    { k: "armor", g: "body", n: true, label: t("방어력", "Armor"), cell: (r) => num(r, "armor", true) },
    { k: "speed", g: "body", n: true, label: t("이동 속도", "Speed"), cell: (r) => num(r, "speed", true) },
    { k: "sight", g: "body", n: true, label: t("시야", "Sight"), cell: (r) => <>{fmt(r.sight)}{was(r, "sight")}</> },
    {
      k: "attrs", g: "body", wrap: true, label: t("속성", "Attributes"),
      cell: (r) =>
        r.attrs ? (
          <>
            {r.attrs.map((a) => attrName(lang, a)).join(" · ")}
            {r.ch.attrs && <span className="was">{r.ch.attrs.map((a) => attrName(lang, a)).join(" · ")}</span>}
          </>
        ) : (
          "-"
        ),
    },
    { k: "combat", g: "combat", wrap: true, wide: true, label: t("공격", "Attacks"), cell: combatCell },
    { k: "abil", g: "abil", wrap: true, wide: true, label: t("능력 (XML에 수치가 있는 것만)", "Abilities (only those with XML numbers)"), cell: abilCell },
  ];
  const cols = COLS.filter((c) => c.g === "id" || grp[c.g]);

  const seg = <T extends string>(label: string, items: [T, React.ReactNode][], value: T, onPick: (v: T) => void) => (
    <div className="seg" role="group" aria-label={label}>
      {items.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)}>
          {l}
        </button>
      ))}
    </div>
  );

  const nBase = data.base.length;
  const nExt = data.units.length;
  const verLabel = (id: string, status: string) =>
    status === "current" ? t(`${id} 현재`, `${id} current`) : status === "previous" ? t(`${id} 직전`, `${id} previous`) : id;

  /* ---------- BPM added units: pair view ---------- */
  const PAIRSTAT: [string, string, (r: Row) => unknown][] = [
    ["hp", t("생명력", "Health"), (r) => r.hp],
    ["shields", t("보호막", "Shields"), (r) => r.shields],
    ["armor", t("방어력", "Armor"), (r) => r.armor],
    ["speed", t("이동 속도", "Speed"), (r) => r.speed],
    ["rng", t("사거리", "Range"), (r) => r.rng],
    ["minerals", t("광물", "Minerals"), (r) => r.cost.minerals],
    ["gas", t("가스", "Gas"), (r) => r.cost.gas],
    ["supply", t("인구", "Supply"), (r) => r.cost.supply],
    ["time", t("생산(초)", "Build (s)"), (r) => r.cost.time],
  ];

  const pair = (x: Row) => {
    const e = x.raw as ExtUnit;
    const b = allRows.base.find((r) => r.id === e.pairId);
    if (!b) return null;
    return (
      <article className={`pair ${e.race}`} id={e.id} key={e.id}>
        <header>
          <button type="button" className="pu" onClick={() => open(b.id)}>
            {b.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.icon} alt="" width={56} height={56} />
            )}
            <span>
              <b>{b[lang]}</b>
              <small>{t("기본 유닛", "Base unit")}</small>
            </span>
          </button>
          <span className="pvs">VS</span>
          <button type="button" className="pu ext" onClick={() => open(e.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.icon} alt="" width={56} height={56} />
            <span>
              <b>{x[lang]}</b>
              <small>
                {t("BPM 추가", "BPM added")}
                {changeCount(x) > 0 && ` · ${t("변경", "changed")} ${changeCount(x)}`}
              </small>
            </span>
          </button>
        </header>
        <div className="prs">
          {PAIRSTAT.map(([k, label, f]) => {
            const bv = f(b);
            const xv = f(x);
            const d = delta(bv, xv);
            const chg = (x.ch as Record<string, unknown>)[k] !== undefined;
            return (
              <div className={`pr${chg ? " chg" : ""}`} key={k}>
                <span className="pb mono">{fmt(bv)}</span>
                <span className="pl">
                  {label}
                  {chg && <em> {t(`${ver} 변경`, `changed in ${ver}`)}</em>}
                </span>
                <span className="px mono">
                  {fmt(xv)}
                  {chg && <span className="was">{String((x.ch as Record<string, unknown>)[k])}</span>}
                </span>
                <span className="pd">{bv === xv ? "" : <span className={`diff ${d.dir}`}>{d.label}</span>}</span>
              </div>
            );
          })}
        </div>
        <details>
          <summary>{t("역할 차이와 업그레이드", "Role differences and upgrades")}</summary>
          <UnitNotesView notes={e.notes} lang={lang} pairName={b[lang]} unitName={x[lang]} />
          <UpgradeList upgrades={data.upgrades.filter((u) => u.units.includes(e.id))} lang={lang} />
        </details>
      </article>
    );
  };

  /* ---------- views ---------- */
  const raceSections = (render: (rs: Row[]) => React.ReactNode, list: Row[]) =>
    races
      .filter((r) => list.some((x) => x.race === r))
      .map((r) => (
        <section className={`w3-race ${r}`} id={r} key={r}>
          <h2>{raceNames[r]}</h2>
          {render(list.filter((x) => x.race === r))}
        </section>
      ));

  const card = (r: Row) => {
    const best = r.weapons && r.weapons.length ? Math.max(0, ...r.weapons.map((w) => w.dpsBonus || w.dps || 0)) || null : null;
    const nch = changeCount(r);
    return (
      <article className={`w3-card ${r.race}`} key={r.id}>
        <button type="button" className="w3-open" onClick={() => open(r.id)} aria-label={`${t("자세히", "Details")}: ${r[lang]}`} />
        {nch > 0 && <span className="w3-chg">{t("변경", "Changed")} {nch}</span>}
        {r.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.icon} alt="" width={72} height={72} />
        ) : (
          <RaceMark race={r.race as RaceKey} label={raceNames[r.race]} big />
        )}
        <h3>{r[lang]}</h3>
        <p className="mute">
          <span className={`src ${r.kind}`}>{r.kind === "ext" ? "BPM" : t("기본", "Base")}</span> {r.kind === "base" ? groupName(lang, r.group) : ""}
        </p>
        <dl>
          <div><dt>HP{r.shields ? "+S" : ""}</dt><dd className="mono">{r.hp}{r.shields ? `+${r.shields}` : ""}{was(r, "hp")}</dd></div>
          <div><dt>{t("방어", "ARM")}</dt><dd className="mono">{fmt(r.armor)}</dd></div>
          <div><dt>{t("속도", "SPD")}</dt><dd className="mono">{fmt(r.speed)}</dd></div>
          <div><dt>{t("비용", "COST")}</dt><dd className="mono">{r.cost.minerals == null ? "-" : `${r.cost.minerals}/${r.cost.gas}`}</dd></div>
        </dl>
        {best ? <p className="mono w4dps">DPS {best}</p> : null}
      </article>
    );
  };

  const table = () => {
    let last: Race | null = null;
    return (
      <div className="tscroll w4t">
        <table className="tbl wk w4">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.k} className={`${c.n ? "n" : ""}${c.sticky ? " sticky" : ""}`} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="empty">{t("조건에 맞는 유닛이 없습니다.", "No units match.")}</td>
              </tr>
            )}
            {rows.flatMap((r) => {
              const out: React.ReactNode[] = [];
              if (r.race !== last) {
                out.push(
                  <tr className={`grp ${r.race}`} key={`g-${r.race}`} id={r.race}>
                    <th colSpan={cols.length} scope="colgroup">
                      <RaceMark race={r.race as RaceKey} decorative /> {raceNames[r.race]}
                    </th>
                  </tr>,
                );
                last = r.race;
              }
              out.push(
                <tr
                  key={r.id}
                  id={r.id}
                  tabIndex={0}
                  className={r.id === openId ? "is-sel" : undefined}
                  onClick={() => open(r.id)}
                  onKeyDown={(ev) => ev.key === "Enter" && open(r.id)}
                >
                  {cols.map((c) => (
                    <td key={c.k} className={`${c.n ? "n" : ""}${c.wrap ? " wrapc" : ""}${c.wide ? " wide" : ""}${c.sticky ? " sticky" : ""}`}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>,
              );
              return out;
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const list = () => {
    if (view === "ext") {
      const es = rows.filter((r) => r.kind === "ext");
      return (
        <>
          <p className="vnote">
            {t(
              "왼쪽이 대체되는 기본 유닛, 오른쪽이 BPM 추가 유닛입니다. 칩은 기본 유닛 대비 변화량입니다.",
              "Left is the base unit it replaces, right is the BPM unit. Chips show the change versus the base unit.",
            )}
          </p>
          {es.length === 0 ? (
            <p className="empty">{t("조건에 맞는 유닛이 없습니다.", "No units match.")}</p>
          ) : (
            raceSections((rs) => <div className="pairs">{rs.map(pair)}</div>, es)
          )}
        </>
      );
    }
    if (mode === "cards") return <>{raceSections((rs) => <div className="w3-cards">{rs.map(card)}</div>, rows)}</>;
    return table();
  };


  return (
    <>
      <div className="wtool">
        {seg(
          t("보기", "View"),
          [
            ["all", <>{t("전체", "All")} <span className="mono">{nBase + nExt}</span></>],
            ["ext", <>{t("BPM 추가 유닛", "BPM added")} <span className="mono">{nExt}</span></>],
            ["base", <>{t("기본 유닛", "Base")} <span className="mono">{nBase}</span></>],
          ],
          view,
          setView,
        )}
        {seg(
          t("종족", "Race"),
          [["all", t("전체", "All")], ...races.map((r) => [r, raceNames[r]] as [Race, string])],
          race,
          setRace,
        )}
        {seg(t("버전", "Version"), versions.map((v) => [v.id, verLabel(v.id, v.status)] as [string, string]), ver, setVer)}
        <button className="chip" type="button" aria-pressed={changed} onClick={() => setChanged((c) => !c)}>
          {changed ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
          {prevVer ? t(`${ver} 변경만`, `Changed in ${ver}`) : t("변경만", "Changed only")}
        </button>
        {view !== "ext" &&
          seg(
            t("표시", "Display"),
            [
              ["table", <><Table2 size={16} aria-hidden /> {t("표", "Table")}</>],
              ["cards", <><LayoutGrid size={16} aria-hidden /> {t("카드", "Cards")}</>],
            ],
            mode,
            setMode,
          )}
        {view !== "ext" && mode === "table" && (
          <div className="grpchips">
            {(
              [
                ["cost", t("비용·건물", "Cost")],
                ["body", t("몸체", "Body")],
                ["combat", t("공격", "Attacks")],
                ["abil", t("능력", "Abilities")],
              ] as [ColGroup, string][]
            ).map(([g, label]) => (
              <button key={g} className="chip" type="button" aria-pressed={grp[g]} onClick={() => setGrp((s) => ({ ...s, [g]: !s[g] }))}>
                {grp[g] ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="wsearch">
          <Search size={16} aria-hidden />
          <input className="inp" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("유닛 이름 검색", "Search units")} aria-label={t("유닛 검색", "Search units")} />
        </div>
      </div>

      {prevVer === null ? (
        <p className="vnote">{t("가장 오래된 버전이라 비교할 이전 값이 없습니다.", "This is the oldest version, so there are no earlier values to compare.")}</p>
      ) : (
        <p className="vnote">
          {t(
            `취소선 값은 ${prevVer}의 값입니다.${rows.some((r) => changeCount(r) > 0) ? "" : ` ${ver}과 ${prevVer}의 수치는 같습니다.`}`,
            `Struck-through values are from ${prevVer}.${rows.some((r) => changeCount(r) > 0) ? "" : ` ${ver} has the same numbers as ${prevVer}.`}`,
          )}
        </p>
      )}
      <p className="vnote">
        {rows.length} {t("개 유닛", "units")}
        {view !== "ext" && mode === "table" && ` · ${t("행을 누르면 모든 무기·능력이 있는 상세가 열립니다.", "Click a row for full weapons and abilities.")}`}
      </p>

      {list()}

      <Drawer open={!!openRow} onClose={close} label={t("닫기", "Close")}>
        {openRow && <WikiDetail row={openRow} ctx={ctx} />}
      </Drawer>
    </>
  );
}

function Drawer({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside className={`w3-drawer${open ? " open" : ""}`} role="dialog" aria-modal="false" aria-labelledby="wiki-drawer-title" aria-hidden={!open}>
      <button className="w3-x" type="button" onClick={onClose} aria-label={label} ref={btn} tabIndex={open ? 0 : -1}>
        <X size={20} aria-hidden />
      </button>
      {children}
    </aside>
  );
}

export type { BaseUnit };
