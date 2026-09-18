"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { siteMeta, bpmUnits, bpmMaps, bpmSystemDiffs } from "@/lib/bpmData";
import {
  BookOpen,
  Swords,
  ArrowRight,
  ShieldCheck,
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

      {/* 2. Draft & Match Flow (Ban -> Hidden Pick -> Deploy: 3 Steps) */}
      <section className="py-16 bg-slate-950/60 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-2 font-mono">
              Match Workflow
            </h2>
            <p className="text-3xl font-black text-slate-100">
              밴과 히든 픽 3단계 진행 방식
            </p>
            <p className="text-sm text-slate-400 mt-2">
              0·1·3·5 밴 규칙과 비공개 선택으로 완성하는 3단계 실시간 전략 심리전
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/40 transition relative flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black font-mono px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    STEP 01
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                    BAN PHASE
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-sky-300 transition">
                  상대 핵심 유닛 밴
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  방 설정(0·1·3·5밴)에 따라 상대 종족의 핵심 페어링 유닛을 밴합니다. 밴된 유닛은 해당 세트에서 양 선수 모두 생산이 원천 차단됩니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>상호 배타적 페어링 제한</span>
                <span className="text-sky-400 font-mono">공개 / 셀프 / 쉐도우</span>
              </div>
            </div>

            <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition relative flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    STEP 02
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                    HIDDEN PICK
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-amber-300 transition">
                  그룹별 비공개 히든 픽
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  밴을 통과한 전술 그룹에서 자신이 실전에 기용할 기본 유닛 또는 17종 확장 유닛을 상대에게 숨긴 채 비밀리에 확정합니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>심리전 및 빌드 암수</span>
                <span className="text-amber-400 font-mono">비공개 확정</span>
              </div>
            </div>

            <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition relative flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    STEP 03
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                    DEPLOY & BATTLE
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-emerald-300 transition">
                  전장 공개 및 섬멸전 돌입
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  카운트다운 종료와 함께 양측의 픽이 전장에 공개되고 테크트리 및 생산 건물에 즉각 적용되며, 선택형 HUD와 함께 1:1 섬멸전이 시작됩니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>테크트리 자동 세팅</span>
                <span className="text-emerald-400 font-mono">실시간 섬멸전</span>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/tournaments?tab=ruleset"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-sky-400 hover:text-sky-300 transition"
            >
              룰셋별 밴픽 체험실 바로가기 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Supported Tournament Rulesets (Home View) */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 mb-2 font-mono">
            <ShieldCheck className="w-4 h-4" />
            RULE ENGINE PRESETS
          </div>
          <h2 className="text-3xl font-black text-slate-100">
            지원 룰셋 프리셋
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            단판 친선전부터 공식 eSports 다전제(Bo3/Bo5)까지 다양한 경기 규칙을 지원합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Standard */}
          <div className="bpm-glass rounded-2xl p-6 sm:p-7 border-slate-800 hover:border-emerald-500/40 transition flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  기본 룰 (Standard)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  단판 / 친선전
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-100 mb-2 group-hover:text-emerald-300 transition">
                스탠다드
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                매 세트마다 밴과 픽 이력이 초기화되는 가장 직관적인 모드입니다. 단판 승부나 빠른 매치메이킹에 최적화되어 있습니다.
              </p>
              <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400">•</span>
                  <span>매 세트 밴/픽 데이터 리셋</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400">•</span>
                  <span>자유로운 빌드 선택 보장</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link
                href="/tournaments?tab=ruleset&preset=standard"
                className="inline-flex items-center justify-between w-full p-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold transition border border-emerald-500/20"
              >
                <span>스탠다드 룰 체험</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* No Repeat Pick */}
          <div className="bpm-glass rounded-2xl p-6 sm:p-7 border-slate-800 hover:border-sky-500/40 transition flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  공식 대회 룰 (Official)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Bo3 / Bo5 다전제
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-100 mb-2 group-hover:text-sky-300 transition">
                노 리피트 픽 (No Repeat)
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                다전제 시리즈 내에서 자신이 이전 세트에 기용한 유닛은 다음 세트에 재기용할 수 없는 누적 락 룰입니다. 선수들의 넓은 유닛 풀 활용을 유도합니다.
              </p>
              <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <span className="text-sky-400">•</span>
                  <span>이전 세트 본인 픽 재사용 불가</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sky-400">•</span>
                  <span>상대 선수는 해당 유닛 픽 가능</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link
                href="/tournaments?tab=ruleset&preset=norepeat"
                className="inline-flex items-center justify-between w-full p-2.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-bold transition border border-sky-500/20"
              >
                <span>노 리피트 픽 룰 체험</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Snake Ban */}
          <div className="bpm-glass rounded-2xl p-6 sm:p-7 border-slate-800 hover:border-amber-500/40 transition flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  교차 밴 룰 (Fair Ban)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  공정 밴 순서
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-100 mb-2 group-hover:text-amber-300 transition">
                스네이크 밴 (Snake Ban)
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                선턴/후턴 간의 밴 유불리를 상쇄하기 위해 A ➔ B ➔ B ➔ A 지그재그(Snake) 순서로 밴을 교차 진행하여 보다 균형 잡힌 전략 대결을 보장합니다.
              </p>
              <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400">•</span>
                  <span>A선수 ➔ B선수 ➔ B선수 ➔ A선수</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400">•</span>
                  <span>선턴 어드밴티지 균형 보정</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link
                href="/tournaments?tab=ruleset&preset=snake"
                className="inline-flex items-center justify-between w-full p-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition border border-amber-500/20"
              >
                <span>스네이크 밴 룰 체험</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Official Maps & Convenience HUD System Diffs */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-1 font-mono">
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
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      검색어: {map.searchKeyword}
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

      {/* 4. Detailed How to Play Section */}
      <section id="how-to-play" className="py-20 bg-slate-950/80 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold mb-3 font-mono">
              GAME ACCESS GUIDE
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100">
              게임 참가 및 실행 방법
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-2">
              배틀넷(Battle.net) 스타크래프트 II에서 별도 설치 없이 바로 검색하고 플레이할 수 있습니다.
            </p>
          </div>

          {/* 4-Step Detailed Walkthrough */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-sky-400 font-mono">01</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    BATTLE.NET
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">
                  스타크래프트 II 실행
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  배틀넷 클라이언트에서 <strong>스타크래프트 II</strong>를 무료로 실행합니다. 상단 메인 메뉴에서 <strong>[사용자 지정 (Custom)]</strong>으로 진입합니다.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                [근접 (Melee)] 또는 [아케이드] 탭 선택
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-sky-400 font-mono">02</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                    SEARCH MAP
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">
                  BPM 공식 전장 검색
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  우측 상단 검색창에 <span className="text-sky-300 font-mono font-bold">BPM</span>을 입력하고 공식 지원 전장을 선택한 뒤 <strong>[로비 만들기]</strong>를 클릭합니다.
                </p>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-sky-400 space-y-0.5">
                  <div>• BPM_Washout</div>
                  <div>• BPM_Fear and Faith</div>
                  <div>• BPM_Rorschach</div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                일반 맵은 [모드로 생성] ➔ &apos;BPM&apos; 검색
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-sky-400 font-mono">03</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    LOBBY SETUP
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">
                  선수 및 옵저버 슬롯 세팅
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  상대 선수를 1대1 대전 슬롯에 초대하고, 중계진/관전자는 <strong>[관전자(옵저버) 슬롯]</strong>에 배치합니다. 로비 게임 속성에서 <strong>0/1/3/5 밴 카운트</strong>를 확인합니다.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                옵저버 전용 브로드캐스트 HUD 자동 연동
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-emerald-400 font-mono">04</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    BATTLE START
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">
                  인게임 밴픽 및 섬멸전 시작
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  게임 로딩 후 화면에 자동 출력되는 <strong>BPM 밴픽 다이얼로그</strong>에서 30초 내에 상대 유닛 밴과 자신의 히든 픽을 완료합니다. 픽 확정 즉시 섬멸전이 전개됩니다.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                생산·연구 편의성 HUD 실시간 활성화
              </div>
            </div>
          </div>

          {/* Quick Support Banner */}
          <div className="p-6 rounded-2xl bpm-glass border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-bold text-slate-100">
                게임을 시작하기 전 드래프트 룰과 유닛 상성을 미리 테스트해보세요
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                웹 시뮬레이터에서 30초 타이머, 밴/픽 턴 전환, 17종 확장 유닛 스펙을 웹 브라우저에서 바로 조작할 수 있습니다.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/tournaments/draft-demo"
                className="px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition"
              >
                밴픽 시뮬레이터 바로가기
              </Link>
              <Link
                href="/wiki"
                className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-xs transition"
              >
                유닛 도감 열기
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
