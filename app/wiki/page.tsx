"use client";

import { useState } from "react";
import Link from "next/link";
import {
  bpmUnits,
  allLiveUnits,
  ptrDiffs,
} from "@/lib/bpmData";
import { UnitCard } from "@/components/wiki/UnitCard";
import { LinearWikiView } from "@/components/wiki/LinearWikiView";
import { LinearPTRView } from "@/components/wiki/LinearPTRView";
import {
  BookOpen,
  Search,
  Scale,
  Sparkles,
  FlaskConical,
  Layers,
} from "lucide-react";

type WikiTab = "live_all" | "ptr" | "expansion";

export default function WikiPage() {
  const [activeTab, setActiveTab] = useState<WikiTab>("live_all");
  const [selectedRace, setSelectedRace] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredExpansionUnits = bpmUnits.filter((unit) => {
    const matchesRace = selectedRace === "all" || unit.race === selectedRace;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      unit.name.toLowerCase().includes(q) ||
      (unit.pairUnit && unit.pairUnit.toLowerCase().includes(q)) ||
      unit.building.toLowerCase().includes(q) ||
      unit.stats.damageType.toLowerCase().includes(q);
    return matchesRace && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-400 mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            COMPREHENSIVE SC2 & BPM ENCYCLOPEDIA
          </div>
          <h1 className="text-3xl font-black text-slate-100">BPM 게임 위키 및 패치 예정 사항</h1>
          <p className="text-sm text-slate-400 mt-1">
            공식 버전 전체 위키와 PTR 예정 사항을 줄글 형태로 위에서 아래로 정독하세요.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/wiki/compare"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold transition"
          >
            <Scale className="w-4 h-4" />
            1:1 2열 페어링 비교기
          </Link>
        </div>
      </div>

      {/* Main 3 View Mode Tabs */}
      <div className="my-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex p-1.5 rounded-xl bg-slate-900 border border-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("live_all")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "live_all"
                ? "bg-slate-800 text-sky-400 shadow border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>현재 공식 버전 전체 위키</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">
              {allLiveUnits.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ptr")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "ptr"
                ? "bg-slate-800 text-amber-400 shadow border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FlaskConical className="w-4 h-4 text-amber-400" />
            <span>PTR 예정 사항</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
              {ptrDiffs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("expansion")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "expansion"
                ? "bg-slate-800 text-purple-400 shadow border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>확장 유닛 도감 (17종 카드)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
              {bpmUnits.length}
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="유닛명, 건물, 무기 검색..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
        </div>
      </div>

      {/* Race Filter Tabs (for Live and Expansion views) */}
      {activeTab !== "ptr" && (
        <div className="flex items-center gap-1.5 mb-8">
          {[
            { id: "all", label: "전체 종족" },
            { id: "terran", label: "Terran (테란)" },
            { id: "protoss", label: "Protoss (프로토스)" },
            { id: "zerg", label: "Zerg (저그)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedRace(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                selectedRace === tab.id
                  ? "bg-slate-800 text-sky-400 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 1. Official Live Full Wiki Tab (Linear Document View) */}
      {activeTab === "live_all" && (
        <div className="bpm-glass rounded-2xl p-6 sm:p-10 border-slate-800 shadow-2xl">
          <LinearWikiView
            selectedRace={selectedRace}
            searchQuery={searchQuery}
          />
        </div>
      )}

      {/* 2. PTR Upcoming Changes Tab (Linear Document Style matching user image) */}
      {activeTab === "ptr" && (
        <div className="bpm-glass rounded-2xl p-6 sm:p-10 border-amber-500/20 shadow-2xl bg-slate-950/80">
          <div className="mb-6 pb-4 border-b border-slate-800">
            <span className="text-xs font-mono text-amber-400 uppercase font-bold tracking-wider">
              BPM PUBLIC TEST REALM (PTR) BALANCE UPDATE
            </span>
            <p className="text-xs text-slate-400 mt-1">
              차기 빌드에 적용 예정인 시스템 및 유닛 밸런스 변경 사항입니다.
            </p>
          </div>

          <LinearPTRView />
        </div>
      )}

      {/* 3. Expansion Units Tab (Grid View) */}
      {activeTab === "expansion" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              BPM 17종 고유 확장 유닛 ({filteredExpansionUnits.length})
            </h2>
            <span className="text-xs text-slate-500">
              카드 클릭 시 개별 상세 스펙 페이지로 이동
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExpansionUnits.map((unit) => (
              <UnitCard key={unit.id} unit={unit} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
