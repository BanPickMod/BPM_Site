"use client";

import { useState } from "react";
import { bpmPatches, BPMPatch } from "@/lib/bpmData";
import {
  FileText,
  Calendar,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Tag,
  Clock,
  Layers,
} from "lucide-react";

export default function PatchesPage() {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    bpmPatches[0]?.version || "v1.4.1"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const currentPatch: BPMPatch =
    bpmPatches.find((p) => p.version === selectedVersionId) || bpmPatches[0];

  // Extract all categories present in the currently selected patch
  const patchCategories = [
    "all",
    ...Array.from(new Set(currentPatch.changes.map((c) => c.category))),
  ];

  const filteredChanges = currentPatch.changes.filter(
    (c) => selectedCategory === "all" || c.category === selectedCategory
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Header */}
      <div className="pb-8 border-b border-slate-800">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 mb-2">
          <FileText className="w-3.5 h-3.5" />
          OFFICIAL CHANGELOG & RELEASES
        </div>
        <h1 className="text-3xl font-black text-slate-100">BPM 패치 노트</h1>
        <p className="text-sm text-slate-400 mt-1">
          버전을 클릭하면 해당 빌드의 세부 시스템 업데이트, 밸런스 조정, 편의성 내역을 바로 확인할 수 있습니다.
        </p>
      </div>

      {/* Main Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        {/* Left Column: Version Selector (Master List) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              릴리즈 버전 목록
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {bpmPatches.length} Releases
            </span>
          </div>

          <div className="space-y-2.5">
            {bpmPatches.map((patch, idx) => {
              const isSelected = patch.version === selectedVersionId;
              const isLatest = idx === 0;

              return (
                <button
                  key={patch.version}
                  id={`patch-version-${patch.version.replace('.', '-')}`}
                  type="button"
                  onClick={() => {
                    setSelectedVersionId(patch.version);
                    setSelectedCategory("all");
                  }}
                  className={`w-full text-left p-4 rounded-xl transition border relative group cursor-pointer ${
                    isSelected
                      ? "bg-slate-800/90 border-sky-500/80 shadow-lg shadow-sky-500/10"
                      : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700"
                  }`}
                >
                  {/* Left accent bar for active item */}
                  {isSelected && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-sky-400 rounded-r-full" />
                  )}

                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-base font-black font-mono tracking-tight ${
                          isSelected ? "text-sky-300" : "text-slate-200"
                        }`}
                      >
                        {patch.version}
                      </span>
                      {isLatest && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          최신 공식 빌드
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {patch.date}
                    </span>
                  </div>

                  <h3
                    className={`text-xs font-semibold line-clamp-1 mb-2 ${
                      isSelected ? "text-slate-100" : "text-slate-400 group-hover:text-slate-300"
                    }`}
                  >
                    {patch.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      {patch.changes.length}개 변경 사항
                    </span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        isSelected
                          ? "text-sky-400 translate-x-0.5"
                          : "text-slate-600 group-hover:text-slate-400"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Version Detail View */}
        <div className="lg:col-span-8">
          <div className="bpm-glass rounded-2xl p-6 sm:p-8 border-slate-800 shadow-2xl space-y-6">
            {/* Version Detail Banner Header */}
            <div className="border-b border-slate-800 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl sm:text-3xl font-black text-sky-400 font-mono">
                    {currentPatch.version}
                  </span>
                  {currentPatch.version === bpmPatches[0].version && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      LIVE ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  릴리즈 일자: {currentPatch.date}
                </div>
              </div>

              <h2 className="text-xl font-bold text-slate-100 mt-2">
                {currentPatch.title}
              </h2>

              <p className="text-sm text-slate-300 mt-3 leading-relaxed bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/80">
                {currentPatch.summary}
              </p>
            </div>

            {/* Category Filter Pills for Current Patch */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                분류 필터:
              </span>
              {patchCategories.map((cat) => {
                const count =
                  cat === "all"
                    ? currentPatch.changes.length
                    : currentPatch.changes.filter((c) => c.category === cat).length;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      selectedCategory === cat
                        ? "bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20"
                        : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <span>{cat === "all" ? "전체 보기" : cat}</span>
                    <span
                      className={`text-[10px] font-mono px-1 rounded ${
                        selectedCategory === cat
                          ? "bg-slate-950/20 text-slate-950 font-bold"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Detailed Changes List */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                상세 변경 내역 ({filteredChanges.length}건)
              </div>

              {filteredChanges.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  해당 카테고리에 포함된 변경점이 없습니다.
                </div>
              ) : (
                filteredChanges.map((change, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono text-[10px] font-bold shrink-0 mt-0.5 border border-sky-500/20">
                        {change.tag}
                      </span>
                      <span className="text-slate-200 leading-relaxed font-sans text-sm">
                        {change.text}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 font-mono px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 self-start sm:self-auto">
                      {change.category}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
