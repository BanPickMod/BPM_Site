"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { bpmUnits, getStandardPairForUnit } from "@/lib/bpmData";
import { UnitDetailTable } from "@/components/wiki/UnitDetailTable";
import { CombatClipPlayer } from "@/components/wiki/CombatClipPlayer";
import { Scale, ArrowLeft } from "lucide-react";

function CompareContent() {
  const searchParams = useSearchParams();
  const initialUnitId = searchParams.get("unit") || "firebat";

  const [selectedBpmId, setSelectedBpmId] = useState<string>(initialUnitId);

  // Right column: BPM Expansion Unit
  const bpmUnit = bpmUnits.find((u) => u.id === selectedBpmId) || bpmUnits[0];

  // Left column: Standard SC2 Melee Unit that is paired with bpmUnit
  const standardPair = getStandardPairForUnit(bpmUnit);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/wiki"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-sky-400 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Wiki 목록으로 돌아가기
          </Link>
          <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2">
            <Scale className="w-7 h-7 text-sky-400" />
            1:1 유닛 페어링 상세 비교
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            왼쪽(기존 밀리 유닛)과 오른쪽(BPM 확장 유닛)의 완전한 상세 스펙과 실전 활용 영상을 2열로 비교합니다.
          </p>
        </div>

        {/* Pair Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-400 uppercase">
            비교할 유닛 페어 선택 (17종)
          </label>
          <select
            value={selectedBpmId}
            onChange={(e) => setSelectedBpmId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:border-sky-500"
          >
            {bpmUnits.map((u) => (
              <option key={u.id} value={u.id}>
                [{u.race.toUpperCase()}] {u.pairUnit} ↔ {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Strict 2-Column Comparison Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch mb-10">
        {/* Left Column: Standard SC2 Melee Unit */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              [LEFT] 기존 유닛 (Standard SC2 Melee)
            </span>
            <span className="text-[11px] font-mono text-slate-400">기존 래더 표준</span>
          </div>

          {standardPair ? (
            <UnitDetailTable
              unit={standardPair}
              badgeLabel="기존 밀리 유닛"
              badgeTone="neutral"
            />
          ) : (
            <div className="bpm-glass rounded-2xl p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
              <span className="text-sm font-bold text-slate-200 mb-1">
                {bpmUnit.pairUnit}
              </span>
              <p className="text-xs">기존 래더 표준 포지션 유닛입니다.</p>
            </div>
          )}
        </div>

        {/* Right Column: BPM Expansion Unit */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-sky-500/20">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
              [RIGHT] 확장 유닛 (BPM Custom Unit)
            </span>
            <span className="text-[11px] font-mono text-sky-400">BPM 확장 픽</span>
          </div>

          <UnitDetailTable
            unit={bpmUnit}
            badgeLabel="BPM 확장 유닛"
            badgeTone="selected"
          />
        </div>
      </div>

      {/* Unit Gameplay Demonstration Video / Simulation */}
      <div className="mb-10">
        <CombatClipPlayer
          unitName={bpmUnit.name}
          clipTitle={bpmUnit.clip?.title || `${bpmUnit.name} 인게임 실전 전투 활용 시연`}
          src={bpmUnit.clip?.src}
          poster={bpmUnit.clip?.poster}
        />
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-400">비교 모듈 로딩 중...</div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
