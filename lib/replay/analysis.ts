import type { Lang } from "@/lib/i18n/config";

/** Shape written by worker/bpm_replay/analyze.py (schema 1). Parsed defensively: stored JSON outlives code changes. */
export type RaceId = "terran" | "protoss" | "zerg";

export interface AnalysisPlayer {
  playerId: number;
  race: RaceId | null;
  result: "win" | "loss" | null;
  isAi: boolean;
  bans: string[];
  picks: { unit: string; replaces: string | null }[];
  displaced: string[];
}

export interface Analysis {
  map: string;
  durationSec: number;
  convenienceMode: boolean;
  players: AnalysisPlayer[];
}

const RACES: RaceId[] = ["terran", "protoss", "zerg"];
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function parseAnalysis(raw: unknown): Analysis | null {
  const a = raw as Record<string, unknown> | null;
  if (!a || typeof a !== "object" || a.schema !== 1 || typeof a.map !== "string" || !Array.isArray(a.players)) return null;
  const players: AnalysisPlayer[] = (a.players as Record<string, unknown>[]).map((p, i) => ({
    playerId: typeof p.playerId === "number" ? p.playerId : i + 1,
    race: RACES.includes(p.race as RaceId) ? (p.race as RaceId) : null,
    result: p.result === "win" || p.result === "loss" ? p.result : null,
    isAi: p.isAi === true,
    bans: strings(p.bans),
    picks: Array.isArray(p.picks)
      ? (p.picks as Record<string, unknown>[])
          .filter((x) => typeof x.unit === "string")
          .map((x) => ({ unit: x.unit as string, replaces: typeof x.replaces === "string" ? x.replaces : null }))
      : [],
    displaced: strings(p.displaced),
  }));
  return { map: a.map, durationSec: typeof a.durationSec === "number" ? a.durationSec : 0, convenienceMode: a.convenienceMode === true, players };
}

const LETTER: Record<RaceId, string> = { terran: "T", protoss: "P", zerg: "Z" };

/** "TvZ" in player order, or null when a race is unknown. */
export function matchup(a: Analysis): string | null {
  const [p1, p2] = a.players;
  return p1?.race && p2?.race ? `${LETTER[p1.race]}v${LETTER[p2.race]}` : null;
}

/** In-game map names carry a BPM_ prefix for the mod's own copies ("BPM_Rorschach"). */
export const mapLabel = (m: string) => m.replace(/^BPM_/, "").replace(/_/g, " ");

export function duration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export type StatusTone = "wait" | "ok" | "no" | "bad";

/** What a status means for the player, in plain words. Rejected replays were deleted, which the text says. */
export function describeStatus(status: string, rejectCode: string | null, lang: Lang): { label: string; text: string; tone: StatusTone } {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  switch (status) {
    case "QUEUED":
      return { label: t("대기 중", "Queued"), tone: "wait", text: t("분석을 기다리고 있습니다. 보통 몇 분 안에 끝납니다.", "Waiting to be analyzed. This usually takes a few minutes.") };
    case "ANALYZING":
      return { label: t("분석 중", "Analyzing"), tone: "wait", text: t("지금 분석하고 있습니다.", "Being analyzed now.") };
    case "READY":
      return { label: t("완료", "Done"), tone: "ok", text: "" };
    case "REJECTED":
      if (rejectCode === "NOT_BPM")
        return { label: t("BPM 게임 아님", "Not a BPM game"), tone: "no", text: t("BPM 밴픽이 없는 게임이라 분석하지 않았고, 파일은 서버에서 삭제했습니다.", "This game has no BPM draft, so it was not analyzed and the file was deleted from the server.") };
      if (rejectCode === "UNSUPPORTED")
        return { label: t("지원 전 버전", "Unsupported version"), tone: "no", text: t("아직 지원하지 않는 게임 버전입니다. 파일은 보관되어 있습니다.", "This game version is not supported yet. The file is kept.") };
      return { label: t("읽을 수 없음", "Unreadable"), tone: "bad", text: t("리플레이를 읽을 수 없어 분석하지 못했고, 파일은 삭제했습니다.", "The replay could not be read, so it was not analyzed and the file was deleted.") };
    default:
      return { label: t("실패", "Failed"), tone: "bad", text: t("분석하지 못했습니다. 문제가 계속되면 알려 주세요.", "The analysis failed. Let us know if this keeps happening.") };
  }
}
