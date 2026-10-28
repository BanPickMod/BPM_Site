import type { Lang } from "@/lib/i18n/config";
import type { Race } from "@/lib/data";
import {
  attrName,
  buildingName,
  fmt,
  groupName,
  targetName,
  weaponName,
  abilityName,
  type Ability,
  type ExtUnit,
  type UnitNotes,
  type Upgrade,
  type Row,
  type Weapon,
} from "@/lib/wiki";

/** Wraps every number in a description in <b> so values stand out from the prose. */
export function emphasizeNumbers(text: string): React.ReactNode {
  return text.split(/(\d+(?:\.\d+)?%?)/).map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part));
}

export interface WikiCtx {
  lang: Lang;
  upgrades: Upgrade[];
  raceNames: Record<Race, string>;
}

function Kv({ label, value, was }: { label: string; value: React.ReactNode; was?: string | number }) {
  return (
    <div className={`kv${was !== undefined ? " chg" : ""}`}>
      <dt>{label}</dt>
      <dd>
        {value}
        {was !== undefined && <span className="was">{was}</span>}
      </dd>
    </div>
  );
}

export function abilityMeta(lang: Lang, a: Ability): string {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  return [
    a.energy != null ? `${t("에너지", "Energy")} ${a.energy}` : "",
    a.minerals ? `${a.minerals}M` : "",
    a.gas ? `${a.gas}G` : "",
    a.cd != null ? `${t("재사용", "CD")} ${a.cd}s` : "",
    a.range ? `${t("사거리", "range")} ${a.range}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Weapon summary for added units whose weapons are not in the XML: only the authored role line, never numbers. */
export function TextWeapons({ row, ctx }: { row: Row; ctx: WikiCtx }) {
  const notes = row.kind === "ext" ? (row.raw as ExtUnit).notes : null;
  if (!notes) return null;
  return (
    <div className="wl">
      <span>{notes.role[ctx.lang]}</span>
    </div>
  );
}

/** Role differences of an added unit against the base unit it replaces, from the authored notes. */
export function UnitNotesView({ notes, lang, pairName, unitName }: { notes: UnitNotes; lang: Lang; pairName: string; unitName: string }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  return (
    <>
      {notes.diff.length > 0 && (
        <table className="tbl det-t">
          <thead>
            <tr>
              <th>{t("항목", "Item")}</th>
              <th>{pairName}</th>
              <th>{unitName}</th>
            </tr>
          </thead>
          <tbody>
            {notes.diff.map((d) => (
              <tr key={d.item.en}>
                <td>{d.item[lang]}</td>
                <td className="wrapc">{d.pair[lang]}</td>
                <td className="wrapc">
                  <b>{d.unit[lang]}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function WeaponsTable({ row, ctx }: { row: Row; ctx: WikiCtx }) {
  const { lang } = ctx;
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const ws = row.weapons as Weapon[];
  return (
    <div className="tscroll">
      <table className="tbl det-t">
        <thead>
          <tr>
            <th>{t("무기", "Weapon")}</th>
            <th className="n">{t("피해", "Dmg")}</th>
            <th>{t("보너스", "Bonus")}</th>
            <th className="n">{t("횟수", "Hits")}</th>
            <th className="n">{t("쿨다운", "CD")}</th>
            <th className="n">DPS</th>
            <th className="n">{t("사거리", "Range")}</th>
            <th>{t("대상", "Targets")}</th>
          </tr>
        </thead>
        <tbody>
          {ws.map((x) => (
            <tr key={x.id}>
              <td>{weaponName(lang, x, ws)}</td>
              <td className="n mono">{fmt(x.dmg)}</td>
              <td>{x.bonus.map((y) => `+${y.dmg} ${attrName(lang, y.type)}`).join(", ") || "-"}</td>
              <td className="n mono">{x.count}</td>
              <td className="n mono">{x.cd === null ? "-" : `${x.cd}s`}</td>
              <td className="n mono">
                {fmt(x.dps)}
                {x.dpsBonus && x.dpsBonus !== x.dps ? ` (${x.dpsBonus})` : ""}
              </td>
              <td className="n mono">{fmt(x.range)}</td>
              <td>{fmt(targetName(lang, x.targets))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Research upgrades of a unit: icon, name, cost and research time (from the mod), building and in-game effect text. */
export function UpgradeList({ upgrades, lang }: { upgrades: Upgrade[]; lang: Lang }) {
  if (!upgrades.length) return null;
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  return (
    <>
      <h4>{t("업그레이드", "Upgrades")}</h4>
      <ul className="det-u det-up">
        {upgrades.map((g) => (
          <li key={g.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.icon} alt="" width={32} height={32} />
            <div>
              <b>{g.name[lang]}</b>
              <span className="mute">
                {g.building ? g.building[lang] : ""}
                {g.minerals !== null ? ` · ${g.minerals}/${g.gas} · ${g.time}${t("초", "s")}` : ""}
              </span>
              <p>{emphasizeNumbers(g.effect[lang])}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function WikiDetail({ row, ctx }: { row: Row; ctx: WikiCtx }) {
  const { lang, raceNames } = ctx;
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const name = row[lang];
  const ext = row.kind === "ext" ? (row.raw as ExtUnit) : null;
  const shownCost = row.cost;

  return (
    <div className="det">
      <div className="det-h">
        {row.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.icon} alt="" width={56} height={56} />
        )}
        <div>
          <h3 id="wiki-drawer-title">{name}</h3>
          <p className="mute">
            {raceNames[row.race]} ·{" "}
            {row.kind === "ext"
              ? t("BPM 추가 유닛", "BPM added unit")
              : `${t("기본 게임 유닛", "Base-game unit")} · ${groupName(lang, row.group)}`}
          </p>
        </div>
      </div>

      <dl className="det-g">
        <Kv label={t("광물", "Minerals")} value={fmt(shownCost.minerals)} was={row.ch.minerals} />
        <Kv label={t("가스", "Gas")} value={fmt(shownCost.gas)} was={row.ch.gas} />
        <Kv label={t("인구", "Supply")} value={fmt(shownCost.supply)} was={row.ch.supply} />
        <Kv label={row.timeKind === "morph" ? t("변태(초)", "Morph (s)") : t("생산(초)", "Build (s)")} value={fmt(shownCost.time)} was={row.ch.time} />
        <Kv label={t("생명력", "Health")} value={fmt(row.hp)} was={row.ch.hp} />
        <Kv label={t("보호막", "Shields")} value={fmt(row.shields)} was={row.ch.shields} />
        <Kv label={t("방어력", "Armor")} value={fmt(row.armor)} was={row.ch.armor} />
        <Kv label={t("보호막 방어", "Shield armor")} value={fmt(row.shieldArmor)} />
        <Kv label={t("이동 속도", "Speed")} value={fmt(row.speed)} was={row.ch.speed} />
        <Kv label={t("시야", "Sight")} value={fmt(row.sight)} was={row.ch.sight} />
        <Kv label={t("반경", "Radius")} value={fmt(row.radius)} />
        <Kv label={t("수송 칸", "Cargo")} value={fmt(row.cargo)} />
        {row.energy && <Kv label={t("에너지", "Energy")} value={`${row.energy.start ?? "-"}/${row.energy.max}`} />}
      </dl>

      <dl className="det-l">
        <Kv
          label={t("속성", "Attributes")}
          value={row.attrs ? row.attrs.map((a) => attrName(lang, a)).join(" · ") : "-"}
          was={row.ch.attrs?.map((a) => attrName(lang, a)).join(" · ")}
        />
        <Kv label={t("이동 방식", "Movement")} value={buildingName(lang, row.move ?? "-")} />
        <Kv label={t("생산 건물", "Built at")} value={ext ? ext.notes.producer[lang] : row.producer ? buildingName(lang, row.producer) : "-"} />
        <Kv label={t("선행 조건", "Requires")} value={ext ? ext.notes.requires[lang] : fmt(row.requires?.map((x) => buildingName(lang, x)).join(", ") || null)} />
      </dl>

      <h4>{t("무기", "Weapons")}</h4>
      {row.weapons && row.weapons.length ? (
        <>
          <WeaponsTable row={row} ctx={ctx} />
        </>
      ) : row.weapons ? (
        <p className="mute">{t("공격 없음", "No attack")}</p>
      ) : (
        <TextWeapons row={row} ctx={ctx} />
      )}

      {row.abilities && row.abilities.length > 0 && (
        <>
          <h4>{t("능력", "Abilities")}</h4>
          <ul className="det-u">
            {row.abilities.map((a) => (
              <li key={a.id}>
                <b>{abilityName(lang, a)}</b>
                <span className="mono">{abilityMeta(lang, a)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {ext && ext.notes.diff.length > 0 && (
        <>
          <h4>{t("기본 유닛과의 차이", "Versus the base unit")}</h4>
          <UnitNotesView notes={ext.notes} lang={lang} pairName={lang === "ko" ? ext.pairKo : ext.pairEn} unitName={name} />
        </>
      )}

      <UpgradeList upgrades={ctx.upgrades.filter((u) => u.units.includes(row.id))} lang={lang} />
    </div>
  );
}

