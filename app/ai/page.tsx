"use client";

import { useState } from "react";
import {
  Sparkles,
  Brain,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

export default function AIPage() {
  const [matchup, setMatchup] = useState("TvP");
  const [mapName, setMapName] = useState("Solaris LE");

  // Mock recommendation response based on selection
  const recommendations: Record<
    string,
    {
      bans: { name: string; race: string; rate: number; reason: string }[];
      picks: { name: string; race: string; winRate: number; synergy: string }[];
    }
  > = {
    TvP: {
      bans: [
        { name: "파괴자 (Reaver)", race: "protoss", rate: 78.4, reason: "초반 셔틀 드랍 견제 차단" },
        { name: "거신 (Colossus)", race: "protoss", rate: 64.2, reason: "바이오닉 원거리 범위 화력 억제" },
        { name: "중재자 (Arbiter)", race: "protoss", rate: 52.1, reason: "후반 리콜/스테이시스 변수 제거" },
      ],
      picks: [
        { name: "골리앗 (Goliath)", race: "terran", winRate: 58.6, synergy: "공중 견제 및 사이오닉 유닛 카운터" },
        { name: "불곰 (Marauder)", race: "terran", winRate: 54.3, synergy: "충격탄으로 돌진 광전사 제압" },
        { name: "토르 (Thor)", race: "terran", winRate: 51.9, synergy: "고충격 탄두로 거대 유닛 저격" },
      ],
    },
    TvZ: {
      bans: [
        { name: "파멸충 (Defiler)", race: "zerg", rate: 82.1, reason: "다크 스웜 탄환 무효화 원천 봉쇄" },
        { name: "살모사 (Viper)", race: "zerg", rate: 69.5, reason: "시즈탱크 납치 및 흑구름 방지" },
        { name: "무리 군주 (Brood Lord)", race: "zerg", rate: 48.3, reason: "지상 라인 붕괴 방지" },
      ],
      picks: [
        { name: "화염방사병 (Firebat)", race: "terran", winRate: 61.2, synergy: "저글링/맹독충 쇄도 초살" },
        { name: "골리앗 (Goliath)", race: "terran", winRate: 56.4, synergy: "뮤탈리스크 원거리 요격" },
        { name: "토르 (Thor)", race: "terran", winRate: 53.0, synergy: "대공 방사 피해로 군단 섬멸" },
      ],
    },
    PvZ: {
      bans: [
        { name: "살모사 (Viper)", race: "zerg", rate: 74.0, reason: "고위 기사/거신 강제 납치 방지" },
        { name: "파멸충 (Defiler)", race: "zerg", rate: 68.2, reason: "플레이그로 실드/체력 소진 방지" },
        { name: "가디언 (Guardian)", race: "zerg", rate: 45.1, reason: "사거리 밖 공성 견제 제거" },
      ],
      picks: [
        { name: "거신 (Colossus)", race: "protoss", winRate: 59.8, synergy: "히드라/저글링 라인 일소" },
        { name: "파괴자 (Reaver)", race: "protoss", winRate: 55.2, synergy: "스카라브로 지상 전면전 파쇄" },
        { name: "중재자 (Arbiter)", race: "protoss", winRate: 52.4, synergy: "스테이시스로 바드라 분할 격파" },
      ],
    },
  };

  const currentRec = recommendations[matchup] || recommendations["TvP"];

  const steps = [
    { title: "Opponent Analysis", desc: "상대 플레이어 종족 및 이전 세트 선호 빌드 데이터 수집" },
    { title: "Draft AI", desc: "맵/상성/누적 밴픽 룰 기반 최적의 BAN & PICK 확률 계산" },
    { title: "Roster Formulation", desc: "선택된 유닛 군을 바탕으로 최적의 병력 조합 설계" },
    { title: "Strategy Selection", desc: "타이밍 러시, 운영, 테크 트리 전략 동적 결정" },
    { title: "Gameplay AI", desc: "실제 인게임 전투 및 마이크로/매크로 컨트롤 실행" },
    { title: "Replay Analyst", desc: "경기 종료 후 타임라인, 자원 손실, 교전 분할 자동 분석" },
    { title: "Training Data", desc: "다음 매치를 위한 전략 데이터셋 누적 및 모델 파인튜닝" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Header */}
      <div className="pb-8 border-b border-slate-800">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          MACHINE LEARNING & PIPELINE
        </div>
        <h1 className="text-3xl font-black text-slate-100">BPM AI Intelligence Platform</h1>
        <p className="text-sm text-slate-400 mt-1">
          경기 전 최적 밴픽 추천부터 경기 후 리플레이 분석, 전략 통계 학습까지 이어지는 순환 파이프라인.
        </p>
      </div>

      {/* Interactive Draft AI Widget */}
      <div className="my-8 bpm-glass rounded-2xl p-6 sm:p-8 border-purple-500/20 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-purple-400 mb-1">
              <Brain className="w-4 h-4" />
              Real-time Draft Recommendation Engine (Demo)
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              실시간 AI 밴픽 추천 시뮬레이터
            </h2>
          </div>

          {/* Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                종족 매치업
              </label>
              <select
                value={matchup}
                onChange={(e) => setMatchup(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
              >
                <option value="TvP">테란 vs 프로토스 (TvP)</option>
                <option value="TvZ">테란 vs 저그 (TvZ)</option>
                <option value="PvZ">프로토스 vs 저그 (PvZ)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                전장 (Map)
              </label>
              <select
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
              >
                <option value="Solaris LE">Solaris LE (솔라리스)</option>
                <option value="Alcyone LE">Alcyone LE (알키오네)</option>
                <option value="Amphion LE">Amphion LE (암피온)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results: Recommended BANs & PICKs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* BAN Recommendations */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-rose-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase">
                <ShieldAlert className="w-4 h-4" />
                AI 추천 상대 금지 유닛 (TOP 3 BAN)
              </div>
              <span className="text-[10px] text-slate-400">예측 위협도 기준</span>
            </div>

            <div className="space-y-3">
              {currentRec.bans.map((item, idx) => (
                <div
                  key={item.name}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-100 flex items-center gap-2">
                      <span className="text-[10px] font-mono text-rose-400 font-bold">
                        #{idx + 1}
                      </span>
                      {item.name}
                    </span>
                    <span className="font-mono font-bold text-rose-400">
                      밴 권장률 {item.rate}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{item.reason}</div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      className="bg-rose-500 h-1.5 rounded-full"
                      style={{ width: `${item.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PICK Recommendations */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-sky-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase">
                <CheckCircle2 className="w-4 h-4" />
                AI 추천 자신 선택 유닛 (TOP 3 PICK)
              </div>
              <span className="text-[10px] text-slate-400">예측 승률 기준</span>
            </div>

            <div className="space-y-3">
              {currentRec.picks.map((item, idx) => (
                <div
                  key={item.name}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-100 flex items-center gap-2">
                      <span className="text-[10px] font-mono text-sky-400 font-bold">
                        #{idx + 1}
                      </span>
                      {item.name}
                    </span>
                    <span className="font-mono font-bold text-sky-400">
                      예상 승률 {item.winRate}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{item.synergy}</div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      className="bg-sky-500 h-1.5 rounded-full"
                      style={{ width: `${item.winRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* End-to-End AI Loop (7 Steps) */}
      <div className="mb-12">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
          BPM 지능형 7단계 피드백 루프 (AI Data Loop)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, idx) => (
            <div key={step.title} className="bpm-glass rounded-xl p-5 border-slate-800 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono text-purple-400 font-bold">
                  STEP 0{idx + 1}
                </span>
                <Brain className="w-4 h-4 text-purple-400 opacity-60" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 mb-1">{step.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
