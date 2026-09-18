"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { siteMeta, bpmUnits, bpmMaps, bpmSystemDiffs } from "@/lib/bpmData";
import {
  BookOpen,
  Swords,
  ArrowRight,
} from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"draft" | "qol" | "maps">("draft");

  return (
    <div className="flex flex-col w-full">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-sky-500/10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-gradient-to-tr from-sky-600/20 via-cyan-500/10 to-indigo-600/15 blur-[130px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Hero Left Content */}
            <div className="lg:col-span-7 flex flex-col items-start gap-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                {siteMeta.eyebrow} · {siteMeta.releaseVersion}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-slate-100 whitespace-pre-line">
                {siteMeta.headline}
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                {siteMeta.summary}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/tournaments/draft-demo"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-sm shadow-lg shadow-sky-500/25 hover:shadow-sky-400/40 transition transform active:scale-95"
                >
                  <Swords className="w-4 h-4 fill-current" />
                  밴픽 시뮬레이터 실행
                </Link>
                <Link
                  href="/wiki"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bpm-glass bpm-glass-hover text-slate-200 font-semibold text-sm transition"
                >
                  <BookOpen className="w-4 h-4 text-sky-400" />
                  17종 확장 유닛 도감
                </Link>
              </div>

              {/* Stat summary pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full sm:w-auto pt-4 border-t border-slate-800/80 text-xs">
                {siteMeta.stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-slate-400">{stat.label}</div>
                    <div className="font-bold text-sky-400 text-base font-mono">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Right Visual: 17 Units Quick Glance */}
            <div className="lg:col-span-5">
              <div className="bpm-glass rounded-2xl p-6 shadow-2xl border-sky-500/20 relative">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-slate-200 tracking-wider">
                      OFFICIAL 17 EXTENSION ROSTER
                    </span>
                  </div>
                  <Link
                    href="/wiki"
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                  >
                    전체 보기 <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* Icons Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 py-2">
                  {bpmUnits.slice(0, 12).map((unit) => (
                    <Link
                      key={unit.id}
                      href={`/wiki/units/${unit.id}`}
                      className="group p-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-400 transition flex flex-col items-center justify-center text-center"
                      title={`${unit.name} (vs ${unit.pairUnit})`}
                    >
                      <div className="w-8 h-8 relative mb-1">
                        <Image
                          src={`/${unit.icon}`}
                          alt={unit.name}
                          width={32}
                          height={32}
                          className="object-contain group-hover:scale-110 transition"
                          unoptimized
                        />
                      </div>
                      <span className="text-[9px] text-slate-300 truncate w-full group-hover:text-sky-300">
                        {unit.name.split(" ")[0]}
                      </span>
                    </Link>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>캠페인·클래식 기반 정규화 유닛</span>
                  <span className="text-amber-400 font-mono font-medium">
                    17종 완전 탑재
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Four Pillars of BPM */}
      <section className="py-16 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-2">
            Core Pillars
          </h2>
          <p className="text-3xl sm:text-4xl font-black text-slate-100">
            BPM을 정의하는 4대 핵심 가치
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {siteMeta.pillars.map((pillar) => (
            <div
              key={pillar.number}
              className="bpm-glass rounded-2xl p-6 border-slate-800 flex flex-col justify-between hover:border-sky-500/40 transition group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-black text-sky-400">
                    {pillar.number}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 uppercase">
                    {pillar.tag}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-sky-300 transition">
                  {pillar.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Draft & Match Flow (Lobby -> Ban -> Hidden Pick -> Deploy) */}
      <section className="py-16 bg-slate-950/60 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-2">
              Match Workflow
            </h2>
            <p className="text-3xl font-black text-slate-100">
              밴과 히든 픽 4단계 진행 방식
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {siteMeta.draftFlow.map((flow) => (
              <div
                key={flow.step}
                className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black font-mono text-sky-400">
                      STEP {flow.step}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {flow.phase}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-100 mb-2">
                    {flow.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {flow.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/tournaments/draft-demo"
              className="inline-flex items-center gap-2 text-xs font-bold text-sky-400 hover:text-sky-300"
            >
              드래프트 룸 시뮬레이터에서 직접 체험하기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Official Maps & Convenience HUD System Diffs */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-1">
              Features & Arenas
            </h2>
            <p className="text-2xl sm:text-3xl font-black text-slate-100">
              지원 전장 및 선택형 편의성 HUD
            </p>
          </div>

          <div className="flex gap-2 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab("maps")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "maps"
                  ? "bg-slate-800 text-sky-400 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              지원 전장 (3개 맵)
            </button>
            <button
              onClick={() => setActiveTab("qol")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "qol"
                  ? "bg-slate-800 text-sky-400 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              편의성 HUD & 시스템 차이점
            </button>
          </div>
        </div>

        {activeTab === "maps" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {bpmMaps.map((map) => (
              <div
                key={map.id}
                className="bpm-glass rounded-2xl p-6 border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-sky-400 font-bold">
                      {map.version}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      키워드: {map.searchKeyword}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-100 mb-2">
                    {map.name}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {map.terrain}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
                  {map.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className="text-sky-400">•</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bpmSystemDiffs.map((diff) => (
              <div
                key={diff.id}
                className="bpm-glass rounded-2xl p-6 border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase font-bold">
                      {diff.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mb-2">
                    {diff.target}
                  </h3>
                  <div className="space-y-2 text-xs mb-4">
                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400">
                      <strong className="text-slate-300 block mb-0.5">기존 밀리:</strong>
                      {diff.before}
                    </div>
                    <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-500/30 text-slate-200">
                      <strong className="text-sky-400 block mb-0.5">BPM 적용:</strong>
                      {diff.after}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-800/80">
                  {diff.purpose}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. How to Play Quick Steps */}
      <section id="how-to-play" className="py-16 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-2">
              Join The Battle
            </h2>
            <p className="text-3xl font-black text-slate-100">게임 참가 및 실행 방법</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="text-2xl font-black text-sky-400 mb-2 font-mono">01</div>
              <h4 className="text-base font-bold text-slate-200 mb-2">스타크래프트 II 실행</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                배틀넷에서 스타크래프트 II를 실행하고 [사용자 지정] &gt; [아케이드] 또는 [근접] 탭으로 이동합니다.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="text-2xl font-black text-sky-400 mb-2 font-mono">02</div>
              <h4 className="text-base font-bold text-slate-200 mb-2">BPM 전장 검색</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                검색창에 <span className="text-sky-300 font-bold">BPM_Washout</span>, <span className="text-sky-300 font-bold">BPM_Fear and Faith</span>, 또는 <span className="text-sky-300 font-bold">BPM_Rorschach</span>를 검색하고 방을 생성합니다.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="text-2xl font-black text-sky-400 mb-2 font-mono">03</div>
              <h4 className="text-base font-bold text-slate-200 mb-2">밴픽 및 경기 시작</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                로비에서 밴 카운트(0/1/3/5)를 정하고, 게임 시작 시 열리는 다이얼로그에서 밴과 히든 픽을 진행합니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
