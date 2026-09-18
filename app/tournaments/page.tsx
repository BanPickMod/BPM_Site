import Link from "next/link";
import {
  Trophy,
  ShieldCheck,
  PlayCircle,
  Tv,
  ArrowRight,
  Swords,
  Radio,
} from "lucide-react";

export default function TournamentsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 mb-2">
            <Trophy className="w-3.5 h-3.5" />
            MATCH & REPLAY CENTER
          </div>
          <h1 className="text-3xl font-black text-slate-100">Tournament Engine</h1>
          <p className="text-sm text-slate-400 mt-1">
            다전제 시리즈(Bo3/Bo5), 누적 밴픽 룰 엔진, 대화형 드래프트 룸 및 실시간 관전자 뷰를 체험하세요.
          </p>
        </div>

        {/* Quick Launch Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/tournaments/draft-demo"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold shadow transition"
          >
            <Swords className="w-4 h-4 fill-current" />
            드래프트 룸 체험하기
          </Link>
          <Link
            href="/matches/demo/live"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-bold transition"
          >
            <Radio className="w-4 h-4 text-rose-400" />
            실시간 관전자 뷰 보기
          </Link>
        </div>
      </div>

      {/* Featured Interactive Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
        <div className="bpm-glass rounded-2xl p-6 border-amber-500/20 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-400 mb-2">
              <Swords className="w-4 h-4" />
              Interactive Simulator
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">
              실시간 밴픽 드래프트 룸 시뮬레이터
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              실제 대회와 동일한 30초 턴 타이머, Bo3 점수판, 세트별 누적 픽 금지 룰이 적용된
              드래프트 룸을 직접 조작해 보세요.
            </p>
          </div>
          <Link
            href="/tournaments/draft-demo"
            className="inline-flex items-center justify-between w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition"
          >
            <span>드래프트 룸 시뮬레이터 실행</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bpm-glass rounded-2xl p-6 border-sky-500/20 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-sky-400 mb-2">
              <Tv className="w-4 h-4" />
              Live Spectator
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">
              웹 기반 실시간 매치 관전자 화면
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              eSports 방송 및 시청자를 위한 전용 웹 관전자 뷰. 양 선수 밴픽 슬롯, 세트 스코어,
              현재 진행 맵 및 시리즈 히스토리를 한눈에 제공합니다.
            </p>
          </div>
          <Link
            href="/matches/demo/live"
            className="inline-flex items-center justify-between w-full p-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-bold transition"
          >
            <span>라이브 관전자 피드 열기</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Rulesets Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bpm-glass rounded-xl p-6 border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-slate-100">
              지원 룰셋 프리셋 (Rule Engine)
            </h3>
          </div>
          <ul className="space-y-3 text-xs text-slate-300">
            <li className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-200">Standard</span>
                <p className="text-slate-400 text-[11px] mt-0.5">매 Game마다 밴/픽 이력 초기화</p>
              </div>
              <span className="text-emerald-400 font-mono text-[11px]">기본 룰</span>
            </li>
            <li className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-200">No Repeat Pick</span>
                <p className="text-slate-400 text-[11px] mt-0.5">Match 내 자신의 이전 Pick 재사용 금지</p>
              </div>
              <span className="text-sky-400 font-mono text-[11px]">공식 대회용</span>
            </li>
            <li className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-200">Global Draft</span>
                <p className="text-slate-400 text-[11px] mt-0.5">누구든 한 번 사용한 Pick은 양측 모두 재사용 불가</p>
              </div>
              <span className="text-purple-400 font-mono text-[11px]">하드코어 룰</span>
            </li>
          </ul>
        </div>

        <div className="bpm-glass rounded-xl p-6 border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <PlayCircle className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-bold text-slate-100">
                Companion & 자동 리플레이 파이프라인
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              BPM Companion이 윈도우 환경에서 SC2 리플레이 생성 시점을 감지하여
              FastAPI 기반 Replay Analyzer를 통해 승패와 빌드 오더를 자동 파싱합니다.
            </p>
            <div className="p-3 rounded-lg bg-slate-900/80 border border-sky-500/20 text-[11px] font-mono text-sky-300">
              Pipeline: SC2 → Companion → Supabase/S3 → Analyzer → Engine
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-6">Phase 2-4 모듈 연동 대기 중</div>
        </div>
      </div>
    </div>
  );
}
