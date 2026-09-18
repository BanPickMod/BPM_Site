/**
 * Client for interacting with the external BPM AI Engine (`bpm-ai-engine`).
 */

import {
  RecommendRequest,
  DraftRecommendationResponse,
  BuildPlanResponse,
  ManifestEncodeRequest,
  ManifestEncodeResponse,
} from "@/types/ai";

const AI_ENGINE_BASE_URL =
  process.env.NEXT_PUBLIC_AI_ENGINE_URL || "http://localhost:8000";

/**
 * Fetch draft recommendations from the external AI engine.
 * Falls back to local baseline if the external engine is not running.
 */
export async function getDraftRecommendations(
  req: RecommendRequest
): Promise<DraftRecommendationResponse> {
  try {
    const res = await fetch(`${AI_ENGINE_BASE_URL}/api/ai/draft/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(3000), // 3s timeout
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Engine not reachable, continue to fallback
  }

  // Fallback baseline
  return {
    matchup: req.matchup,
    map_name: req.map_name,
    recommended_bans: [
      {
        unit_id: "Reaver",
        unit_name: "파괴자 (Reaver)",
        race: "protoss",
        score: 78.4,
        reason: "초반 셔틀 드랍 견제 차단 (Fallback)",
      },
      {
        unit_id: "Colossus",
        unit_name: "거신 (Colossus)",
        race: "protoss",
        score: 64.2,
        reason: "바이오닉 원거리 범위 화력 억제 (Fallback)",
      },
    ],
    recommended_picks: [
      {
        unit_id: "Goliath",
        unit_name: "골리앗 (Goliath)",
        race: "terran",
        score: 58.6,
        reason: "공중 견제 및 사이오닉 유닛 카운터 (Fallback)",
      },
      {
        unit_id: "Marauder",
        unit_name: "불곰 (Marauder)",
        race: "terran",
        score: 54.3,
        reason: "충격탄으로 돌진 광전사 제압 (Fallback)",
      },
    ],
  };
}

/**
 * Encode confirmed draft into in-game BPM_AI Manifest format.
 */
export async function encodeDraftManifest(
  req: ManifestEncodeRequest
): Promise<ManifestEncodeResponse> {
  try {
    const res = await fetch(`${AI_ENGINE_BASE_URL}/api/ai/manifest/encode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(2000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback local encoding
  }

  return {
    chat_command: `/bpm B:${req.bans.join(",")}|P:${req.picks.join(",")}`,
    bank_dict: {
      Bans: req.bans.join(","),
      Picks: req.picks.join(","),
    },
  };
}
