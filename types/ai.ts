/**
 * Types for communicating with the external BPM AI Engine (`bpm-ai-engine`).
 */

export type RulePreset = "standard" | "no_repeat_pick" | "no_repeat_draft";

export interface DraftRecommendationItem {
  unit_id: string;
  unit_name: string;
  race: string;
  score: number;
  reason: string;
}

export interface DraftRecommendationResponse {
  matchup: string;
  map_name: string;
  recommended_bans: DraftRecommendationItem[];
  recommended_picks: DraftRecommendationItem[];
}

export interface RecommendRequest {
  matchup: string;
  map_name: string;
  preset?: RulePreset;
  past_bans?: string[];
  past_picks?: string[];
  top_k?: number;
}

export interface ArmyCompositionTarget {
  unit_id: string;
  target_ratio: number;
  tactical_role: string;
}

export interface BuildPlanResponse {
  strategy_name: string;
  recommended_tech_route: string[];
  army_compositions: ArmyCompositionTarget[];
  timing_attack_window: string;
}

export interface ManifestEncodeRequest {
  player_id: number;
  bans: string[];
  picks: string[];
}

export interface ManifestEncodeResponse {
  chat_command: string;
  bank_dict: Record<string, string>;
}
