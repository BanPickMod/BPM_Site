"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Trophy,
  ShieldCheck,
  Tv,
  ArrowRight,
  Swords,
  Radio,
  UploadCloud,
  FileCode,
  CheckCircle2,
  Clock,
  BarChart3,
  FileSearch,
} from "lucide-react";

type TournamentTab = "ruleset" | "replay" | "spectator";
type RulesetType = "standard" | "norepeat" | "snake";

export default function TournamentsPage() {
  const [activeTab, setActiveTab] = useState<TournamentTab>("ruleset");
  const [selectedRuleset, setSelectedRuleset] = useState<RulesetType>("norepeat");

  // Mock state for Replay Upload simulation
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    "BPM_Official_Bo3_Match_Washout.SC2Replay"
  );

  const handleSimulateUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setUploadedFileName("BPM_Custom_Match_User_Replay.SC2Replay");
      setIsUploading(false);
    }, 1000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 mb-2 font-mono">
            <Trophy className="w-3.5 h-3.5" />
            BPM MATCH & COMPETITIVE PLATFORM
          </div>
          <h1 className="text-3xl font-black text-slate-100">
            대회 시스템 & 리플레이 센터
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            각 룰셋별 밴픽 시뮬레이션, 내 SC2 리플레이 분석기, 실시간 방송 매치 관전을 한곳에서 선택해 이용하세요.
          </p>
        </div>

        {/* Quick Spectator Pill */}
        <div className="flex items-center gap-2">
          <Link
            href="/matches/demo/live"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition"
          >
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            실시간 방송 관전 바로가기
          </Link>
        </div>
      </div>

      {/* 3 Distinct Functional Tabs */}
      <div className="my-8 flex p-1.5 rounded-xl bg-slate-900 border border-slate-800 w-full sm:w-auto self-start overflow-x-auto">
        <button
          onClick={() => setActiveTab("ruleset")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition shrink-0 ${
            activeTab === "ruleset"
              ? "bg-slate-800 text-sky-400 shadow border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Swords className="w-4 h-4 text-sky-400" />
          <span>1. 룰셋별 밴픽 체험</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">
            3 프리셋
          </span>
        </button>

        <button
          onClick={() => setActiveTab("replay")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition shrink-0 ${
            activeTab === "replay"
              ? "bg-slate-800 text-emerald-400 shadow border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileSearch className="w-4 h-4 text-emerald-400" />
          <span>2. 내 리플레이 분석기</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
            .SC2Replay
          </span>
        </button>

        <button
          onClick={() => setActiveTab("spectator")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition shrink-0 ${
            activeTab === "spectator"
              ? "bg-slate-800 text-rose-400 shadow border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Tv className="w-4 h-4 text-rose-400" />
          <span>3. 실시간 매치 관전</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
            LIVE ON-AIR
          </span>
        </button>
      </div>

      {/* TAB 1: 룰셋별 밴픽 체험 (Ruleset Sandbox) */}
      {activeTab === "ruleset" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
              대회 룰셋별 밴픽 시뮬레이션 체험
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              단판 스탠다드, 다전제 누적 픽 금지, 공정 지그재그 교차 밴 중 원하는 룰셋을 선택하여 밴픽 로직을 직접 조작해 보세요.
            </p>
          </div>

          {/* 3 Ruleset Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Standard */}
            <div
              onClick={() => setSelectedRuleset("standard")}
              className={`p-6 rounded-2xl cursor-pointer transition border flex flex-col justify-between ${
                selectedRuleset === "standard"
                  ? "bg-slate-800/90 border-emerald-500/80 shadow-lg shadow-emerald-500/10"
                  : "bpm-glass border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    PRESET 1
                  </span>
                  <span className="text-xs text-slate-400 font-mono">단판 / 친선</span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2">스탠다드 (Standard)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  매 세트마다 밴/픽 이력이 초기화되는 가장 기본적이고 빠른 룰입니다.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>누적 제한 없음</span>
                <span className="text-emerald-400 font-bold">선택 중</span>
              </div>
            </div>

            {/* No Repeat Pick */}
            <div
              onClick={() => setSelectedRuleset("norepeat")}
              className={`p-6 rounded-2xl cursor-pointer transition border flex flex-col justify-between ${
                selectedRuleset === "norepeat"
                  ? "bg-slate-800/90 border-sky-500/80 shadow-lg shadow-sky-500/10"
                  : "bpm-glass border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
                    PRESET 2 (공식 표준)
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Bo3 / Bo5</span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2">노 리피트 픽 (No Repeat)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  다전제에서 자신이 이전 세트에 선택했던 유닛을 다음 세트에 다시 기용할 수 없는 누적 락 룰입니다.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>넓은 유닛 풀 요구</span>
                <span className="text-sky-400 font-bold">선택 중</span>
              </div>
            </div>

            {/* Snake Ban */}
            <div
              onClick={() => setSelectedRuleset("snake")}
              className={`p-6 rounded-2xl cursor-pointer transition border flex flex-col justify-between ${
                selectedRuleset === "snake"
                  ? "bg-slate-800/90 border-amber-500/80 shadow-lg shadow-amber-500/10"
                  : "bpm-glass border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                    PRESET 3 (신규)
                  </span>
                  <span className="text-xs text-slate-400 font-mono">공정 밴 순서</span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2">스네이크 밴 (Snake Ban)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  선턴/후턴 간 밴 유불리를 상쇄하기 위해 A ➔ B ➔ B ➔ A 지그재그 교차 순서로 밴을 진행합니다.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>A-B-B-A 교차 순서</span>
                <span className="text-amber-400 font-bold">선택 중</span>
              </div>
            </div>
          </div>

          {/* Selected Ruleset Detailed Sandbox Card */}
          <div className="bpm-glass rounded-2xl p-6 sm:p-8 border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-mono text-sky-400 mb-1 font-bold uppercase">
                  ACTIVE RULESET SPECIFICATION
                </div>
                <h3 className="text-2xl font-black text-slate-100">
                  {selectedRuleset === "standard" && "스탠다드 룰 (Standard Match)"}
                  {selectedRuleset === "norepeat" && "노 리피트 픽 룰 (No Repeat Cumulative Pick)"}
                  {selectedRuleset === "snake" && "스네이크 밴 룰 (Snake Ban Fair Sequence)"}
                </h3>
              </div>

              <Link
                href={`/tournaments/draft-demo?rule=${selectedRuleset}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-xs shadow-lg transition"
              >
                <Swords className="w-4 h-4 fill-current" />
                <span>선택한 룰셋으로 시뮬레이터 실행</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Turn Sequence & Ruleset Detail Flowchart */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 font-bold">PHASE 1</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">
                  {selectedRuleset === "snake" ? "선수 A 1차 밴" : "선수 A 밴 (30s)"}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedRuleset === "snake"
                    ? "선수 A가 1차 밴 유닛을 지정합니다."
                    : "선수 A가 상대의 전략 축을 밴합니다."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 font-bold">PHASE 2</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">
                  {selectedRuleset === "snake" ? "선수 B 연속 2밴" : "선수 B 밴 (30s)"}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedRuleset === "snake"
                    ? "선수 B가 2연속 밴을 행사하여 선턴 우위를 상쇄합니다."
                    : "선수 B가 상대 핵심 유닛을 밴합니다."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 font-bold">PHASE 3</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">
                  {selectedRuleset === "snake" ? "선수 A 마무리 밴" : "히든 픽 (Hidden Pick)"}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedRuleset === "snake"
                    ? "선수 A의 최종 밴으로 밴 단계가 종료됩니다."
                    : selectedRuleset === "norepeat"
                    ? "이전 세트 기용 유닛은 비활성화(Lock) 처리됩니다."
                    : "밴을 통과한 그룹에서 자유롭게 유닛을 선택합니다."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 font-bold">PHASE 4</span>
                <h4 className="text-sm font-bold text-slate-200 mt-1">전장 공개 및 섬멸전</h4>
                <p className="text-xs text-slate-400 mt-1">
                  양 선수의 픽이 공개되며 게임이 시작됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 내 리플레이 분석기 (My Uploaded Replay Analyzer) */}
      {activeTab === "replay" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-emerald-400" />
              내 리플레이 분석기 (SC2 Replay Analyzer)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              스타크래프트 II에서 생성된 <span className="font-mono text-emerald-400 font-semibold">.SC2Replay</span> 파일을 업로드하면 밴픽 이력, 확장 유닛 빌드 타이밍, 전투 기여도를 자동 분석합니다.
            </p>
          </div>

          {/* Upload Dropzone */}
          <div className="bpm-glass rounded-2xl p-8 border-dashed border-2 border-emerald-500/30 hover:border-emerald-500/60 transition text-center flex flex-col items-center justify-center">
            <UploadCloud className="w-12 h-12 text-emerald-400 mb-3" />
            <h3 className="text-base font-bold text-slate-100 mb-1">
              내 SC2 리플레이 파일 드래그 &amp; 드롭
            </h3>
            <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
              문서 &gt; StarCraft II &gt; Accounts &gt; Replays 폴더의 .SC2Replay 파일을 업로드하세요.
            </p>
            <button
              onClick={handleSimulateUpload}
              disabled={isUploading}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition disabled:opacity-50"
            >
              {isUploading ? "리플레이 파싱 중..." : "샘플 리플레이 업로드 및 분석 실행"}
            </button>
          </div>

          {/* Parsed Replay Result Card */}
          {uploadedFileName && (
            <div className="bpm-glass rounded-2xl p-6 sm:p-8 border-slate-800 shadow-2xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <FileCode className="w-6 h-6 text-emerald-400" />
                  <div>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">
                      PARSED REPLAY COMPLETED
                    </span>
                    <h3 className="text-base font-bold text-slate-100">
                      {uploadedFileName}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    경기 시간: 14분 35초
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    전장: BPM_Washout
                  </span>
                </div>
              </div>

              {/* Match Head-to-Head Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Player 1 (Winner) */}
                <div className="p-5 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Player 1 (Protoss) - 승리
                    </span>
                    <span className="text-xs font-mono text-slate-400">245 APM</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div>
                      <strong className="text-slate-400">밴 (BAN):</strong> 불곰 (Marauder) 밴
                    </div>
                    <div>
                      <strong className="text-slate-400">히든 픽 (PICK):</strong>{" "}
                      <span className="text-sky-300 font-semibold">용기병 (Dragoon)</span>
                    </div>
                    <div>
                      <strong className="text-slate-400">전략 핵심:</strong> 특이점 장전(사거리 +2) 연구 후 메카닉 전선 원거리 화력 우위 점유
                    </div>
                  </div>
                </div>

                {/* Player 2 */}
                <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-300">
                      Player 2 (Terran) - 패배
                    </span>
                    <span className="text-xs font-mono text-slate-400">218 APM</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div>
                      <strong className="text-slate-400">밴 (BAN):</strong> 추적자 (Stalker) 밴
                    </div>
                    <div>
                      <strong className="text-slate-400">히든 픽 (PICK):</strong>{" "}
                      <span className="text-amber-300 font-semibold">골리앗 (Goliath)</span>
                    </div>
                    <div>
                      <strong className="text-slate-400">전략 핵심:</strong> 카론 부스터 공대공 방어망 구축 시도, 용기병 지상 돌파에 밀림
                    </div>
                  </div>
                </div>
              </div>

              {/* Analytics Insights */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <div className="font-bold text-slate-200 flex items-center gap-1.5 mb-1">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  AI 분석 요약 및 확장 유닛 기여도
                </div>
                <p className="leading-relaxed">
                  • P1의 용기병 채택은 P2의 불곰 봉쇄와 결합되어 중앙 대치 구도에서 일방적인 사거리 이점을 창출했습니다.
                </p>
                <p className="leading-relaxed">
                  • P2는 골리앗을 통해 공중 위협을 사전에 차단했으나 지상 중장갑 화력 공백으로 앞마당 수비선이 돌파당했습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 실시간 매치 관전 (Live Match Spectator) */}
      {activeTab === "spectator" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Tv className="w-5 h-5 text-rose-400" />
              실시간 대회 및 스크림 방송 관전 (Live Broadcast)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              OBS 인게임 오버레이 없이 웹 브라우저에서 바로 실시간 밴픽 슬롯, 세트 스코어, 맵 시야를 관전할 수 있습니다.
            </p>
          </div>

          {/* Live Matches List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Match 1 */}
            <div className="bpm-glass rounded-2xl p-6 border-rose-500/30 hover:border-rose-500/60 transition flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
                LIVE
              </div>

              <div>
                <span className="text-[10px] font-mono text-rose-400 font-bold">
                  OFFICIAL PREMIER LEAGUE · 8강 A조
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1 mb-3">
                  Solar (저그) vs Maru (테란)
                </h3>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">세트 스코어</span>
                    <span className="font-mono font-bold text-sky-400">1 : 0 (Bo3)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">현재 전장</span>
                    <span className="font-mono text-slate-200">2세트: BPM_Fear and Faith</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">밴픽 상태</span>
                    <span className="text-emerald-400 font-semibold">인게임 섬멸전 교전 중 (09:12)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <Link
                  href="/matches/demo/live"
                  className="inline-flex items-center justify-between w-full p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition"
                >
                  <span>라이브 관전자 피드 입장</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Match 2 */}
            <div className="bpm-glass rounded-2xl p-6 border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  COMMUNITY SCRIMMATCH · 세트 1
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1 mb-3">
                  Classic (프로토스) vs Cure (테란)
                </h3>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">세트 스코어</span>
                    <span className="font-mono font-bold text-slate-400">0 : 0 (Bo3)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">현재 전장</span>
                    <span className="font-mono text-slate-200">1세트: BPM_Washout</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">밴픽 상태</span>
                    <span className="text-amber-400 font-semibold">30초 히든 픽 페이즈 진행 중</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <Link
                  href="/matches/demo/live"
                  className="inline-flex items-center justify-between w-full p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition"
                >
                  <span>라이브 관전자 피드 입장</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
