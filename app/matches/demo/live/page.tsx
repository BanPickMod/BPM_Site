"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";

export default function LiveSpectatorPage() {

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Header Bar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-sky-400 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            대회 센터로 돌아가기
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
              LIVE BROADCAST FEED
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-100 mt-1">
            BPM Live Match Spectator View
          </h1>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2">
          <Badge tone="demo">DEMO DATA</Badge>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono">GAME 2 / IN PROGRESS (07:42)</span>
          </div>
        </div>
      </div>

      {/* Main Broadcast Scoreboard */}
      <div className="bpm-glass rounded-2xl p-6 sm:p-8 border-sky-500/20 mb-8 shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Player A Card */}
          <div className="lg:col-span-4 flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold mb-2">
              TERRAN
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100">Maru (조성주)</h2>
            <div className="text-xs text-slate-400 font-mono mt-0.5">Team Vitality</div>

            {/* Current Game Draft for Player A */}
            <div className="mt-5 w-full space-y-2">
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-rose-500/30 flex items-center justify-between text-xs">
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> BAN
                </span>
                <span className="font-semibold text-rose-300">화염방사병 (Firebat)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-sky-500/30 flex items-center justify-between text-xs">
                <span className="text-sky-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> PICK
                </span>
                <span className="font-semibold text-sky-300">골리앗 (Goliath)</span>
              </div>
            </div>
          </div>

          {/* Center Match Banner / Score */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center text-center py-4 border-y lg:border-y-0 lg:border-x border-slate-800">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
              BO3 SERIES · SET 2
            </div>
            <div className="flex items-center gap-4 text-4xl sm:text-5xl font-black font-mono tracking-wider text-slate-100">
              <span className="text-sky-400">1</span>
              <span className="text-slate-600">:</span>
              <span className="text-amber-400">0</span>
            </div>
            <div className="mt-3 px-3 py-1 rounded bg-slate-900 text-[11px] text-slate-300 border border-slate-800 font-mono">
              MAP: Solaris LE (솔라리스)
            </div>
          </div>

          {/* Player B Card */}
          <div className="lg:col-span-4 flex flex-col items-center sm:items-end text-center sm:text-right">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-2">
              PROTOSS
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100">herO (김준호)</h2>
            <div className="text-xs text-slate-400 font-mono mt-0.5">DKZ Gaming</div>

            {/* Current Game Draft for Player B */}
            <div className="mt-5 w-full space-y-2">
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-rose-500/30 flex items-center justify-between text-xs">
                <span className="font-semibold text-rose-300">파괴자 (Reaver)</span>
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  BAN <ShieldAlert className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30 flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300">중재자 (Arbiter)</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  PICK <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Series Cumulative Lockout Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bpm-glass rounded-xl p-5 border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Player A 누적 히스토리 및 다음 세트 가용 풀
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-lg bg-slate-900/60 flex justify-between items-center">
              <span className="text-slate-400">Game 1 픽 유닛</span>
              <span className="font-semibold text-slate-300">토르 (Thor)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 flex justify-between items-center">
              <span className="text-slate-400">Game 2 픽 유닛</span>
              <span className="font-semibold text-sky-400">골리앗 (Goliath)</span>
            </div>
            <div className="p-2 rounded bg-rose-950/20 text-rose-400 text-[11px] border border-rose-500/20">
              *다음 Game 3 진행 시: 토르, 골리앗 모두 PICK 불가 (No Repeat Rule)
            </div>
          </div>
        </div>

        <div className="bpm-glass rounded-xl p-5 border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Player B 누적 히스토리 및 다음 세트 가용 풀
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-lg bg-slate-900/60 flex justify-between items-center">
              <span className="text-slate-400">Game 1 픽 유닛</span>
              <span className="font-semibold text-slate-300">거신 (Colossus)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 flex justify-between items-center">
              <span className="text-slate-400">Game 2 픽 유닛</span>
              <span className="font-semibold text-amber-400">중재자 (Arbiter)</span>
            </div>
            <div className="p-2 rounded bg-rose-950/20 text-rose-400 text-[11px] border border-rose-500/20">
              *다음 Game 3 진행 시: 거신, 중재자 모두 PICK 불가 (No Repeat Rule)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
