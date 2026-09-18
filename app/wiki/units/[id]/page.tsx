import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getUnitById } from "@/lib/bpmData";
import {
  Shield,
  Target,
  Scale,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

interface UnitDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UnitDetailPage({ params }: UnitDetailPageProps) {
  const { id } = await params;
  const unit = getUnitById(id);

  if (!unit) {
    notFound();
  }

  const raceColor =
    unit.race === "terran"
      ? "text-sky-400 border-sky-500/30 bg-sky-500/10"
      : unit.race === "protoss"
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-purple-400 border-purple-500/30 bg-purple-500/10";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Breadcrumbs */}
      <div className="mb-6">
        <Link
          href="/wiki"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-sky-400 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Wiki 목록으로 돌아가기
        </Link>
      </div>

      {/* Top Header Card */}
      <div className="bpm-glass rounded-2xl p-6 sm:p-8 border-slate-800 mb-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700/80 p-2 flex items-center justify-center shrink-0">
              <Image
                src={`/${unit.icon}`}
                alt={unit.name}
                width={70}
                height={70}
                className="object-contain"
                unoptimized
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${raceColor}`}
                >
                  {unit.race}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                  {unit.building}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-100">
                {unit.name}
              </h1>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <span>선행 테크:</span>
                <span className="text-slate-300 font-semibold">{unit.techReq}</span>
              </div>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800 self-start md:self-auto">
            <div className="text-center px-2">
              <div className="text-[10px] text-slate-400 mb-0.5">광물</div>
              <div className="text-sm font-bold text-sky-400 font-mono">
                {unit.cost.minerals}
              </div>
            </div>
            <div className="w-[1px] h-8 bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-[10px] text-slate-400 mb-0.5">가스</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {unit.cost.gas}
              </div>
            </div>
            <div className="w-[1px] h-8 bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-[10px] text-slate-400 mb-0.5">인구수</div>
              <div className="text-sm font-bold text-amber-400 font-mono">
                {unit.cost.supply}
              </div>
            </div>
            <div className="w-[1px] h-8 bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-[10px] text-slate-400 mb-0.5">생산시간</div>
              <div className="text-sm font-bold text-slate-300 font-mono">
                {unit.cost.time}s
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Defense & Movement */}
        <div className="space-y-6">
          <div className="bpm-glass rounded-xl p-6 border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-400" />
              기본 방어 및 기동 스펙
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">생명력 (HP)</span>
                <span className="font-bold text-slate-100 font-mono">
                  {unit.stats.hp}
                </span>
              </div>
              {unit.stats.shields ? (
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">보호막 (Shields)</span>
                  <span className="font-bold text-amber-300 font-mono">
                    {unit.stats.shields}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">기본 방어력 (Armor)</span>
                <span className="font-bold text-slate-100 font-mono">
                  {unit.stats.armor}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">이동 속도 (Speed)</span>
                <span className="font-bold text-slate-100 font-mono">
                  {unit.stats.speed}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">사거리 (Range)</span>
                <span className="font-bold text-slate-100 font-mono">
                  {unit.stats.range}
                </span>
              </div>
            </div>
          </div>

          {/* Pair Unit Direct Compare Widget */}
          {unit.pairUnit && (
            <div className="bpm-glass rounded-xl p-6 border-sky-500/20 bg-sky-950/20">
              <div className="flex items-center gap-2 mb-2 text-sky-400 text-xs font-bold uppercase">
                <Scale className="w-4 h-4" />
                대체 페어링 유닛
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-1">
                {unit.pairUnit}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                BPM에서 이 유닛은 <span className="text-amber-300 font-bold">{unit.pairUnit}</span>와(과)
                같은 전술 그룹에 속합니다. 밴픽 단계에서 상대를 봉쇄하거나 히든 픽으로 채택할 수 있습니다.
              </p>
              <Link
                href={`/wiki/compare?unit=${unit.id}`}
                className="inline-flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs shadow hover:bg-sky-400 transition"
              >
                <Scale className="w-4 h-4" />
                페어 유닛과 1:1 차이점 비교
              </Link>
            </div>
          )}
        </div>

        {/* Right Column: Weapons, Upgrades & Diff From Pair */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weapons & Damage Type */}
          <div className="bpm-glass rounded-xl p-6 border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-400" />
              무장 및 피해 속성
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-4">
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[10px]">지상 공격력</div>
                <div className="font-bold text-slate-100 font-mono mt-0.5">
                  {unit.stats.groundDmg}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[10px]">대공 공격력</div>
                <div className="font-bold text-slate-100 font-mono mt-0.5">
                  {unit.stats.airDmg}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[10px]">피해 유형</div>
                <div className="font-bold text-amber-300 font-mono mt-0.5">
                  {unit.stats.damageType}
                </div>
              </div>
            </div>
          </div>

          {/* Differences From Pair (핵심 전술 차이) */}
          {unit.diffFromPair && unit.diffFromPair.length > 0 && (
            <div className="bpm-glass rounded-xl p-6 border-slate-800">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                대체 페어 유닛({unit.pairUnit}) 대비 차이점
              </h2>
              <div className="space-y-3">
                {unit.diffFromPair.map((diff, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800"
                  >
                    <div className="text-xs font-bold text-sky-400 mb-2 font-mono">
                      [{diff.item}]
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                        <div className="text-[10px] text-slate-400 mb-1">
                          기존 {unit.pairUnit}
                        </div>
                        <div className="text-slate-300 leading-relaxed">{diff.pair}</div>
                      </div>
                      <div className="p-2.5 rounded bg-sky-950/30 border border-sky-500/30">
                        <div className="text-[10px] text-sky-400 font-bold mb-1">
                          BPM {unit.name}
                        </div>
                        <div className="text-slate-100 font-semibold leading-relaxed">
                          {diff.unit}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upgrades */}
          {unit.upgrades && unit.upgrades.length > 0 && (
            <div className="bpm-glass rounded-xl p-6 border-slate-800">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                전용 업그레이드 (Upgrades)
              </h2>
              <div className="space-y-3">
                {unit.upgrades.map((upg, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-slate-100">
                        {upg.name}
                      </h3>
                      <span className="text-xs text-sky-400 font-mono">
                        {upg.cost}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mb-2">
                      연구 건물: {upg.building} ({upg.requirement})
                    </div>
                    <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-xs text-slate-200">
                      {upg.statDiff}
                    </div>
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
