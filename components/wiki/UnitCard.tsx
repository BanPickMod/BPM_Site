import Link from "next/link";
import Image from "next/image";
import { BPMUnit } from "@/lib/bpmData";
import { Shield, Zap, Scale, Target } from "lucide-react";

interface UnitCardProps {
  unit: BPMUnit;
}

export function UnitCard({ unit }: UnitCardProps) {
  const raceBorder =
    unit.race === "terran"
      ? "hover:border-sky-400/60 hover:shadow-sky-500/15"
      : unit.race === "protoss"
      ? "hover:border-amber-400/60 hover:shadow-amber-500/15"
      : "hover:border-purple-400/60 hover:shadow-purple-500/15";

  const raceBadge =
    unit.race === "terran"
      ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
      : unit.race === "protoss"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : "bg-purple-500/10 text-purple-400 border-purple-500/30";

  return (
    <div
      className={`bpm-glass rounded-xl p-5 flex flex-col justify-between transition duration-200 border-slate-800/80 shadow-lg ${raceBorder}`}
    >
      <div>
        {/* Top bar: Race & Cost */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${raceBadge}`}
          >
            {unit.race}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <span className="text-blue-300 font-semibold">{unit.cost.minerals}M</span>
            <span>/</span>
            <span className="text-emerald-300 font-semibold">{unit.cost.gas}G</span>
            <span>/</span>
            <span className="text-amber-300 font-semibold">{unit.cost.supply}S</span>
          </div>
        </div>

        {/* Unit Icon + Name */}
        <div className="flex items-center gap-3.5 mb-3">
          <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700/80 overflow-hidden relative shrink-0 p-1 flex items-center justify-center">
            <Image
              src={`/${unit.icon}`}
              alt={unit.name}
              width={44}
              height={44}
              className="object-contain"
              unoptimized
            />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100 group-hover:text-sky-300 transition leading-tight">
              {unit.name}
            </h3>
            <div className="text-[11px] text-slate-400 mt-0.5">{unit.building}</div>
          </div>
        </div>

        {/* Pair Unit Tag */}
        <div className="mb-3 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-800 text-[11px] flex items-center justify-between">
          <span className="text-slate-400">대체 페어:</span>
          <span className="font-bold text-amber-300">{unit.pairUnit}</span>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-800/60 mb-3 text-slate-300">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>
              HP {unit.stats.hp}
              {unit.stats.shields ? ` + ${unit.stats.shields}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>속도 {unit.stats.speed}</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2 text-[11px] text-slate-400">
            <Target className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{unit.stats.damageType}</span>
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="pt-2 flex items-center gap-2">
        <Link
          href={`/wiki/units/${unit.id}`}
          className="flex-1 py-1.5 px-3 rounded text-center text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >
          스펙 상세보기
        </Link>
        <Link
          href={`/wiki/compare?unit=${unit.id}`}
          className="p-1.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition flex items-center justify-center"
          title={`${unit.pairUnit}와 1:1 비교`}
        >
          <Scale className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
