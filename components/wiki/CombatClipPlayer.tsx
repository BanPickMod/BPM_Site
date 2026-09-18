import { Film, Swords, Sparkles } from "lucide-react";

interface CombatClipPlayerProps {
  unitName: string;
  clipTitle?: string;
  src?: string;
  poster?: string;
}

export function CombatClipPlayer({
  unitName,
  clipTitle = "실전 전투 및 스킬 활용 시연",
  src,
  poster,
}: CombatClipPlayerProps) {

  return (
    <div className="bpm-glass rounded-2xl p-5 border-slate-800 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-sky-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {clipTitle}
          </h4>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
          COMBAT DEMO
        </span>
      </div>

      {/* Video / Interactive Simulation Container (16:9 Aspect Ratio) */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group">
        {src ? (
          <video
            src={`https://banpickmod.github.io/${src}`}
            poster={poster ? `https://banpickmod.github.io/${poster}` : undefined}
            controls
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          /* Simulated Tactical Visualizer fallback */
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="w-16 h-16 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-3 shadow-lg shadow-sky-500/10 animate-pulse">
              <Swords className="w-8 h-8 text-sky-400" />
            </div>
            <h5 className="text-sm font-bold text-slate-100 mb-1">
              {unitName} 인게임 전술 운용 시연
            </h5>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              인게임 아케이드 및 토너먼트 환경에서 {unitName}의 포지셔닝과 특수 스킬 연계 메커니즘을 확인하세요.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              BPM Game Engine Capture 1080p
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>*실제 게임 내 모드 동작 기준 녹화본</span>
        <span className="text-sky-400 font-medium">BPM Arcade Sandbox</span>
      </div>
    </div>
  );
}
