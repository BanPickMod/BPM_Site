import Image from "next/image";
import Link from "next/link";
import { allLiveUnits } from "@/lib/bpmData";
import { ExternalLink } from "lucide-react";

interface LinearWikiViewProps {
  selectedRace: string;
  searchQuery: string;
}

export function LinearWikiView({ selectedRace, searchQuery }: LinearWikiViewProps) {
  const races: ("terran" | "protoss" | "zerg")[] =
    selectedRace === "all"
      ? ["terran", "protoss", "zerg"]
      : [selectedRace as "terran" | "protoss" | "zerg"];

  const raceTitles: Record<string, string> = {
    terran: "Terran (테란)",
    protoss: "Protoss (프로토스)",
    zerg: "Zerg (저그)",
  };

  const getFilteredUnitsForRace = (race: string) => {
    return allLiveUnits.filter((u) => {
      const matchRace = u.race === race;
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        (u.pairUnit && u.pairUnit.toLowerCase().includes(q)) ||
        u.building.toLowerCase().includes(q) ||
        u.stats.damageType.toLowerCase().includes(q);
      return matchRace && matchQuery;
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-14 text-slate-200 font-sans">
      {races.map((race) => {
        const units = getFilteredUnitsForRace(race);
        if (units.length === 0) return null;

        return (
          <section key={race} className="space-y-10">
            {/* Race Division Header */}
            <div className="border-b border-slate-700/60 pb-3 pt-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">
                {raceTitles[race]}
              </h2>
              <span className="text-xs font-mono text-slate-400">
                총 {units.length}개 유닛 수록
              </span>
            </div>

            <div className="space-y-10">
              {units.map((unit) => (
                <article key={unit.id} className="space-y-2">
                  {/* Icon placed directly above title */}
                  <div className="pt-2 pb-1">
                    {unit.icon ? (
                      <div className="w-12 h-12 relative flex items-center">
                        <Image
                          src={`/${unit.icon}`}
                          alt={unit.name}
                          width={46}
                          height={46}
                          className="object-contain drop-shadow"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-300">
                        SC2
                      </div>
                    )}
                  </div>

                  {/* Unit Name Header with Colon */}
                  <h3 className="text-[17px] font-bold text-white tracking-tight flex items-center gap-2">
                    <span>{unit.name}:</span>
                    {unit.category === "bpm_expansion" && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        BPM 확장 픽
                      </span>
                    )}
                  </h3>

                  {/* Bulleted list of specs */}
                  <ul className="space-y-1.5 pl-6 text-[15px] text-slate-200">
                    <li className="list-disc leading-relaxed">
                      <strong>생산 및 비용:</strong> {unit.building} · {unit.cost.minerals}M / {unit.cost.gas}G / {unit.cost.supply}S ({unit.cost.time}초)
                    </li>

                    <li className="list-disc leading-relaxed">
                      <strong>생존력:</strong> 체력 {unit.stats.hp}
                      {unit.stats.shields ? ` (+보호막 ${unit.stats.shields})` : ""} · 방어력 {unit.stats.armor} · 이동 속도 {unit.stats.speed}
                    </li>

                    <li className="list-disc leading-relaxed">
                      <strong>무장 화력:</strong> 지상 {unit.stats.groundDmg} · 대공 {unit.stats.airDmg} · 사거리 {unit.stats.range} ({unit.stats.damageType})
                    </li>

                    {unit.pairUnit && (
                      <li className="list-disc leading-relaxed text-amber-300">
                        <strong>대체 페어링:</strong> {unit.pairUnit} (밴픽 시 상호 배타적 대체 관계)
                      </li>
                    )}

                    {unit.abilities && unit.abilities.length > 0 && (
                      <li className="list-disc leading-relaxed">
                        <strong>특수 능력:</strong>{" "}
                        {unit.abilities.map((a) => `${a.name}${a.cost ? ` (${a.cost})` : ""}`).join(", ")}
                      </li>
                    )}

                    {unit.upgrades && unit.upgrades.length > 0 && (
                      <li className="list-disc leading-relaxed">
                        <strong>전용 연구:</strong>{" "}
                        {unit.upgrades.map((u) => `${u.name} [${u.statDiff}]`).join(", ")}
                      </li>
                    )}
                  </ul>

                  {/* Optional Video / Showcase link */}
                  {(unit.clipUrl || unit.clip?.src) && (
                    <div className="pl-12 text-sm text-sky-400 flex items-center gap-2 pt-0.5">
                      <span className="text-slate-300">◦ Showcase:</span>
                      <a
                        href={unit.clipUrl || unit.clip?.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-sky-300 inline-flex items-center gap-1"
                      >
                        {unit.clip?.title || unit.clipUrl || unit.clip?.src}
                        <ExternalLink className="w-3.5 h-3.5 inline" />
                      </a>
                    </div>
                  )}

                  {/* Tactical Reasoning / Role in italics */}
                  {(unit.tactics || unit.description || (unit.diffFromPair && unit.diffFromPair.length > 0)) && (
                    <p className="text-[14px] italic text-slate-400 leading-relaxed pt-1 pl-0">
                      Reasoning / Tactics:{" "}
                      {unit.tactics ||
                        unit.description ||
                        unit.diffFromPair?.map((d) => `${d.item} [${d.unit} vs ${d.pair}]`).join(" · ")}
                    </p>
                  )}

                  {/* Interactive Quick Links */}
                  <div className="pl-6 text-xs text-slate-400 flex items-center gap-4 pt-1">
                    <Link
                      href={`/wiki/units/${unit.id}`}
                      className="text-sky-400 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      상세 스펙 카드 <ExternalLink className="w-3 h-3" />
                    </Link>
                    {unit.pairUnit && (
                      <Link
                        href={`/wiki/compare?unit=${unit.id}`}
                        className="text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        {unit.pairUnit}와 1:1 비교기 <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

