/**
 * StarCraft II BanPickMod Core Types
 * Based on BPM Platform Final Plan v1.0
 */

export type Race = "terran" | "protoss" | "zerg" | "random";

export type DraftAction = "BAN" | "PICK";

export type MatchStatus =
  | "WAITING"
  | "DRAFTING"
  | "DRAFT_LOCKED"
  | "READY"
  | "PLAYING"
  | "REPLAY_UPLOADED"
  | "VERIFYING"
  | "GAME_COMPLETE"
  | "MATCH_COMPLETE";

export interface Tournament {
  id: string;
  name: string;
  ruleset_id: string;
  status: "upcoming" | "in_progress" | "completed";
}

export interface Match {
  id: string;
  tournament_id?: string;
  round?: string;
  best_of: number;
  player_a: string;
  player_b: string;
  score_a: number;
  score_b: number;
  current_game: number;
  status: MatchStatus;
}

export interface Game {
  id: string;
  match_id: string;
  game_number: number;
  map: string;
  winner?: string;
  replay_id?: string;
  status: MatchStatus;
}

export interface DraftEvent {
  game_id: string;
  match_id: string;
  player_id: string;
  sequence: number;
  action: DraftAction;
  unit_id: string;
  timestamp: string;
}

export interface WikiUnit {
  id: string;
  nameKo: string;
  nameEn: string;
  race: Race;
  role: string;
  cost: {
    minerals: number;
    vespene: number;
    supply: number;
    buildTime: number;
  };
  defense: {
    hp: number;
    shield?: number;
    energy?: number;
    armor: number;
    attributes: string[];
  };
  movement: {
    speed: number;
    acceleration?: number;
    sight: number;
    cargoSpace?: number;
  };
  pickGroup?: {
    groupName: string;
    alternativeUnitId: string;
  };
  description: string;
}
