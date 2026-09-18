import Image from "next/image";
import { BPMUnit } from "@/lib/bpmData";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Shield, Zap, Target, Sparkles, Building } from "lucide-react";

interface UnitDetailTableProps {
  unit: BPMUnit;
  badgeLabel?: string;
  /** Distinguishes which side of a comparison this card is — NOT a race
   *  color, so it must come from the neutral/selected tone pair rather
   *  than sky/amber/purple (those are reserved for race identity). */
  badgeTone?: BadgeTone;
}

export function UnitDetailTable({
  unit,
  badgeLabel,
  badgeTone = "selected",
}: UnitDetailTableProps) {
  return (
    <div className="bpm-glass rounded-2xl p-6 border-slate-800 shadow-xl flex flex-col justify-between h-full">
      <div>
        {/* Header with Icon and Name */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center shrink-0">
              {unit.icon ? (
                <Image
                  src={`/${unit.icon}`}
                  alt={unit.name}
                  width={48}
                  height={48}
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <span className="text-xs font-bold text-slate-400">SC2</span>
              )}
            </div>
            <div>
              {badgeLabel && (
                <Badge tone={badgeTone} uppercase className="mb-1">
                  {badgeLabel}
                </Badge>
              )}
              <h3 className="text-xl font-black text-slate-100">{unit.name}</h3>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Building className="w-3 h-3 text-slate-500" />
                <span>{unit.building}</span>
              </div>
            </div>
          </div>

          {/* Quick Cost Grid */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono">
            <span className="text-blue-300 font-bold">{unit.cost.minerals}M</span>
            <span>/</span>
            <span className="text-emerald-300 font-bold">{unit.cost.gas}G</span>
            <span>/</span>
            <span className="text-amber-300 font-bold">{unit.cost.supply}S</span>
            <span>/</span>
            <span className="text-slate-400">{unit.cost.time}s</span>
          </div>
        </div>

        {/* Core Specs Grid */}
        <div className="space-y-4 mb-6">
          {/* Defense Specs */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              생존력 및 방어 스펙
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">체력 (HP)</div>
                <div className="font-bold font-mono text-slate-100 mt-0.5">
                  {unit.stats.hp}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">보호막 (Shield)</div>
                <div className="font-bold font-mono text-amber-300 mt-0.5">
                  {unit.stats.shields !== undefined ? unit.stats.shields : "-"}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">방어력 (Armor)</div>
                <div className="font-bold font-mono text-slate-100 mt-0.5">
                  {unit.stats.armor}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">이동 속도</div>
                <div className="font-bold font-mono text-slate-100 mt-0.5">
                  {unit.stats.speed}
                </div>
              </div>
            </div>
          </div>

          {/* Weapons & Damage */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-rose-400" />
              무장 및 화력 스펙
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">지상 공격력</div>
                <div className="font-bold font-mono text-slate-100 mt-0.5">
                  {unit.stats.groundDmg}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">대공 공격력</div>
                <div className="font-bold font-mono text-slate-100 mt-0.5">
                  {unit.stats.airDmg}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">사거리 / 속성</div>
                <div className="font-bold font-mono text-amber-300 mt-0.5 truncate">
                  사거리 {unit.stats.range} ({unit.stats.damageType})
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Weapons Table if available */}
          {unit.weapons && unit.weapons.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
              {unit.weapons.map((w, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">{w.name}</span>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-slate-400">주기: {w.period}s</span>
                    <span className="text-rose-400 font-bold">DPS: {w.dps}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Special Abilities */}
          {unit.abilities && unit.abilities.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                특수 능력 및 전술 스킬
              </h4>
              <div className="space-y-2">
                {unit.abilities.map((ab, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-purple-300">{ab.name}</span>
                      {ab.cost && (
                        <span className="text-[10px] font-mono text-purple-400 px-1.5 py-0.5 rounded bg-purple-950/60">
                          {ab.cost}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {ab.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upgrades */}
          {unit.upgrades && unit.upgrades.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                전용 연구 및 업그레이드
              </h4>
              <div className="space-y-1.5">
                {unit.upgrades.map((upg, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs flex justify-between items-center"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">{upg.name}</span>
                      <p className="text-[11px] text-slate-400">{upg.statDiff}</p>
                    </div>
                    <span className="text-[10px] font-mono text-sky-400 shrink-0">
                      {upg.cost}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
