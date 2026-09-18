"use client";

import { useState, useEffect } from "react";
import { MOCK_UNITS } from "@/lib/mockData";
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react";

type TurnPhase = "A_BAN" | "B_BAN" | "A_PICK" | "B_PICK" | "COMPLETE";

export default function DraftDemoPage() {
  const [currentGame, setCurrentGame] = useState<number>(1);
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(1);
  const [timer, setTimer] = useState<number>(30);
  const [phase, setPhase] = useState<TurnPhase>("A_BAN");

  // Current Game Draft State
  const [banA, setBanA] = useState<string | null>(null);
  const [banB, setBanB] = useState<string | null>(null);
  const [pickA, setPickA] = useState<string | null>(null);
  const [pickB, setPickB] = useState<string | null>(null);

  // Cumulative picked units (for No Repeat Pick rule demo)
  const [lockedUnitsA, setLockedUnitsA] = useState<string[]>([]);
  const [lockedUnitsB, setLockedUnitsB] = useState<string[]>([]);

  // Timer countdown
  useEffect(() => {
    if (phase === "COMPLETE") return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Turn management
  const handleSelectUnit = (unitId: string) => {
    if (phase === "A_BAN") {
      setBanA(unitId);
      setPhase("B_BAN");
      setTimer(30);
    } else if (phase === "B_BAN") {
      setBanB(unitId);
      setPhase("A_PICK");
      setTimer(30);
    } else if (phase === "A_PICK") {
      setPickA(unitId);
      setPhase("B_PICK");
      setTimer(30);
    } else if (phase === "B_PICK") {
      setPickB(unitId);
      setPhase("COMPLETE");
    }
  };

  const finishGameAndAdvance = (winner: "A" | "B") => {
    if (winner === "A") setScoreA((prev) => prev + 1);
    else setScoreB((prev) => prev + 1);

    if (pickA) setLockedUnitsA((prev) => [...prev, pickA]);
    if (pickB) setLockedUnitsB((prev) => [...prev, pickB]);

    // Advance to next game
    setCurrentGame((prev) => prev + 1);
    setBanA(null);
    setBanB(null);
    setPickA(null);
    setPickB(null);
    setPhase("A_BAN");
    setTimer(30);
  };

  const resetSeries = () => {
    setCurrentGame(1);
    setScoreA(0);
    setScoreB(0);
    setBanA(null);
    setBanB(null);
    setPickA(null);
    setPickB(null);
    setLockedUnitsA([]);
    setLockedUnitsB([]);
    setPhase("A_BAN");
    setTimer(30);
  };

  const getPhaseInstruction = () => {
    switch (phase) {
      case "A_BAN":
        return {
          player: "Player A (테란)",
          action: "상대 유닛을 BAN할 차례입니다",
          isBan: true,
          color: "text-rose-400",
        };
      case "B_BAN":
        return {
          player: "Player B (프로토스)",
          action: "상대 유닛을 BAN할 차례입니다",
          isBan: true,
          color: "text-rose-400",
        };
      case "A_PICK":
        return {
          player: "Player A (테란)",
          action: "자신의 핵심 유닛을 PICK할 차례입니다",
          isBan: false,
          color: "text-sky-400",
        };
      case "B_PICK":
        return {
          player: "Player B (프로토스)",
          action: "자신의 핵심 유닛을 PICK할 차례입니다",
          isBan: false,
          color: "text-amber-400",
        };
      case "COMPLETE":
        return {
          player: "드래프트 완료",
          action: "경기 준비가 완료되었습니다",
          isBan: false,
          color: "text-emerald-400",
        };
    }
  };

  const instruction = getPhaseInstruction();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Top Header & Match Info */}
      <div className="bpm-glass rounded-2xl p-6 border-slate-800 mb-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-sky-400 mb-1">
              <span>SERIES: BO3</span>
              <span>·</span>
              <span className="text-emerald-400">RULE: No Repeat Pick (누적 픽 금지)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100">
              BPM Live Draft Room Simulator
            </h1>
          </div>

          {/* Series Scoreboard */}
          <div className="flex items-center gap-6 self-center">
            <div className="text-right">
              <div className="text-sm font-bold text-sky-400">Player A</div>
              <div className="text-[11px] text-slate-400">Terran</div>
            </div>
            <div className="px-5 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-2xl font-black text-slate-100 flex items-center gap-3 shadow-inner">
              <span className="text-sky-400">{scoreA}</span>
              <span className="text-slate-600">:</span>
              <span className="text-amber-400">{scoreB}</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-amber-400">Player B</div>
              <div className="text-[11px] text-slate-400">Protoss</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetSeries}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              시리즈 리셋
            </button>
          </div>
        </div>

        {/* Turn Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-bold text-slate-100">
              G{currentGame}
            </div>
            <div>
              <div className="text-xs text-slate-400">현재 턴 진행 상황</div>
              <div className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span className={instruction.color}>{instruction.player}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300 text-sm font-medium">{instruction.action}</span>
              </div>
            </div>
          </div>

          {/* Turn Timer */}
          {phase !== "COMPLETE" ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 font-mono">
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-xs text-slate-400">남은 시간:</span>
              <span
                className={`text-lg font-bold ${
                  timer <= 10 ? "text-rose-400 animate-pulse" : "text-amber-400"
                }`}
              >
                {timer}s
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => finishGameAndAdvance("A")}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md transition"
              >
                A 승리 처리 후 다음 세트
              </button>
              <button
                onClick={() => finishGameAndAdvance("B")}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition"
              >
                B 승리 처리 후 다음 세트
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Draft Slots: Player A & Player B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Player A Slots */}
        <div className="bpm-glass rounded-xl p-5 border-sky-500/30">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              Player A (Terran) Draft
            </span>
            {lockedUnitsA.length > 0 && (
              <span className="text-[11px] text-slate-400 font-mono">
                이전 픽 잠금: {lockedUnitsA.join(", ")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* BAN Slot */}
            <div
              className={`p-4 rounded-xl border flex flex-col items-center justify-center min-h-[110px] text-center transition ${
                banA
                  ? "bg-rose-950/30 border-rose-500/40"
                  : phase === "A_BAN"
                  ? "bg-slate-900/90 border-rose-500/60 ring-2 ring-rose-500/30 animate-pulse"
                  : "bg-slate-950/60 border-slate-800"
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-rose-400 mb-1 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                BAN SLOT
              </div>
              {banA ? (
                <div className="font-bold text-sm text-rose-300">
                  {MOCK_UNITS.find((u) => u.id === banA)?.nameKo || banA}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  {phase === "A_BAN" ? "유닛을 클릭하여 밴" : "대기 중"}
                </div>
              )}
            </div>

            {/* PICK Slot */}
            <div
              className={`p-4 rounded-xl border flex flex-col items-center justify-center min-h-[110px] text-center transition ${
                pickA
                  ? "bg-sky-950/30 border-sky-500/40"
                  : phase === "A_PICK"
                  ? "bg-slate-900/90 border-sky-500/60 ring-2 ring-sky-500/30 animate-pulse"
                  : "bg-slate-950/60 border-slate-800"
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-sky-400 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                PICK SLOT
              </div>
              {pickA ? (
                <div className="font-bold text-sm text-sky-300">
                  {MOCK_UNITS.find((u) => u.id === pickA)?.nameKo || pickA}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  {phase === "A_PICK" ? "유닛을 클릭하여 픽" : "대기 중"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Player B Slots */}
        <div className="bpm-glass rounded-xl p-5 border-amber-500/30">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Player B (Protoss) Draft
            </span>
            {lockedUnitsB.length > 0 && (
              <span className="text-[11px] text-slate-400 font-mono">
                이전 픽 잠금: {lockedUnitsB.join(", ")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* BAN Slot */}
            <div
              className={`p-4 rounded-xl border flex flex-col items-center justify-center min-h-[110px] text-center transition ${
                banB
                  ? "bg-rose-950/30 border-rose-500/40"
                  : phase === "B_BAN"
                  ? "bg-slate-900/90 border-rose-500/60 ring-2 ring-rose-500/30 animate-pulse"
                  : "bg-slate-950/60 border-slate-800"
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-rose-400 mb-1 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                BAN SLOT
              </div>
              {banB ? (
                <div className="font-bold text-sm text-rose-300">
                  {MOCK_UNITS.find((u) => u.id === banB)?.nameKo || banB}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  {phase === "B_BAN" ? "유닛을 클릭하여 밴" : "대기 중"}
                </div>
              )}
            </div>

            {/* PICK Slot */}
            <div
              className={`p-4 rounded-xl border flex flex-col items-center justify-center min-h-[110px] text-center transition ${
                pickB
                  ? "bg-amber-950/30 border-amber-500/40"
                  : phase === "B_PICK"
                  ? "bg-slate-900/90 border-amber-500/60 ring-2 ring-amber-500/30 animate-pulse"
                  : "bg-slate-950/60 border-slate-800"
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-amber-400 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                PICK SLOT
              </div>
              {pickB ? (
                <div className="font-bold text-sm text-amber-300">
                  {MOCK_UNITS.find((u) => u.id === pickB)?.nameKo || pickB}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  {phase === "B_PICK" ? "유닛을 클릭하여 픽" : "대기 중"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Available Units Pool */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            드래프트 선택 유닛 풀 (Click to Select)
          </h2>
          <span className="text-xs text-slate-500">
            *누적 픽 금지 룰에 의해 이전 세트에서 픽된 유닛은 비활성화됩니다.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {MOCK_UNITS.map((unit) => {
            const isBanned = banA === unit.id || banB === unit.id;
            const isPicked = pickA === unit.id || pickB === unit.id;
            const isLockedInHistory =
              lockedUnitsA.includes(unit.id) || lockedUnitsB.includes(unit.id);
            const isDisabled =
              phase === "COMPLETE" || isBanned || isPicked || isLockedInHistory;

            return (
              <button
                key={unit.id}
                disabled={isDisabled}
                onClick={() => handleSelectUnit(unit.id)}
                className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between min-h-[90px] ${
                  isDisabled
                    ? "opacity-35 bg-slate-950 border-slate-800/60 cursor-not-allowed"
                    : "bpm-glass border-slate-800 hover:border-sky-400 hover:scale-105 active:scale-95"
                }`}
              >
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-mono">
                    {unit.race}
                  </div>
                  <div className="font-bold text-xs text-slate-100">{unit.nameKo}</div>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                  <span>{unit.cost.minerals}M</span>
                  <span>/</span>
                  <span>{unit.cost.vespene}V</span>
                </div>

                {isLockedInHistory && (
                  <span className="absolute top-2 right-2 text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                    LOCKED
                  </span>
                )}
                {isBanned && (
                  <span className="absolute top-2 right-2 text-[9px] px-1 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    BANNED
                  </span>
                )}
                {isPicked && (
                  <span className="absolute top-2 right-2 text-[9px] px-1 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    PICKED
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
