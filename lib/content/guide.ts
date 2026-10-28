import type { Bi } from "@/lib/i18n/config";

/**
 * Guide content that is not generated from mod data.
 * TODO: the lobby option names and positions are written without a location until lobby screenshots are provided.
 */

export interface LobbyConfig {
  bans: 0 | 1 | 3 | 5;
  snake: boolean;
  conv: boolean;
  obs: boolean;
}

/** Step-by-step room creation for the chosen options. Same steps in both languages. */
export function buildSteps(cfg: LobbyConfig): Bi[] {
  const steps: Bi[] = [
    { ko: "플레이할 섬멸전 맵을 고릅니다.", en: "Pick the melee map you want to play." },
    { ko: "[모드 만들기]를 선택합니다.", en: "Choose Create with Mod." },
    { ko: "모드 검색창에 'BPM_Core'를 입력해 선택합니다.", en: "Search for 'BPM_Core' in the mod search and select it." },
    { ko: "방을 만들고 상대를 초대합니다.", en: "Create the room and invite your opponent." },
  ];
  if (cfg.obs) {
    steps.push({
      ko: "중계진과 심판은 [관전자] 슬롯으로 입장합니다. 옵저버 UI는 자동으로 켜지므로 따로 설정할 것이 없습니다.",
      en: "Casters and referees join through the Observer slots. The observer UI turns on automatically; there is nothing to set up.",
    });
  }
  const snake = cfg.snake && cfg.bans >= 3;
  steps.push({
    ko: `방장이 대기실에서 밴 개수를 ${cfg.bans}밴으로${snake ? ", 스네이크 밴을 켠 상태로" : ""} 설정하고, 편의성 모드를 ${cfg.conv ? "켭니다" : "끕니다"}.`,
    en: `As host, set the ban count to ${cfg.bans}${snake ? ", turn the snake ban on" : ""}, and Convenience Mode ${cfg.conv ? "on" : "off"} in the lobby.`,
  });
  steps.push(
    cfg.bans === 0
      ? { ko: "게임을 시작합니다. 밴 단계 없이 곧바로 비공개 히든 픽이 열립니다.", en: "Start the game. There is no ban phase; the hidden pick opens right away." }
      : {
          ko: `게임을 시작합니다. ${cfg.bans}밴을 각 30초 제한 시간 안에 진행한 뒤 비공개 히든 픽이 열립니다.`,
          en: `Start the game. Run ${cfg.bans} bans with a 30-second limit each, then the hidden pick opens.`,
        },
  );
  if (cfg.obs) {
    steps.push({
      ko: "게임이 시작되면 관전자에게 전용 밴픽 오버레이와 경기 중계 HUD가 표시됩니다.",
      en: "Once the game starts, observers get the broadcast draft overlay and match HUD.",
    });
  }
  return steps;
}

export const convenienceEn = [
  "Army and worker supply shown separately",
  "12-slot production panel with click-to-select",
  "5 basic upgrade tracks with research buttons",
  "Research overlay for up to 4 projects",
  "One-click gas worker auto-fill (up to 3)",
  "Optimal mineral worker count display restored",
  "Host toggles it in the lobby; on by default",
];

export interface OptionRow {
  name: Bi;
  values: string;
  effect: Bi;
  since: string;
}

export const optionRows: OptionRow[] = [
  {
    name: { ko: "밴 개수", en: "Ban count" },
    values: "0 · 1 · 3 · 5",
    effect: { ko: "밴 라운드를 진행하는 횟수입니다.", en: "How many ban rounds are played." },
    since: "v1.0",
  },
  {
    name: { ko: "스네이크 밴", en: "Snake ban" },
    values: "ON / OFF",
    effect: { ko: "3밴에서 1→2→2→1→1→2 순서로 진행합니다.", en: "With 3 bans the order runs 1→2→2→1→1→2." },
    since: "v1.4.3",
  },
  {
    name: { ko: "편의성 모드", en: "Convenience Mode" },
    values: "ON / OFF",
    effect: {
      ko: "생산·연구·공방업·보급품 HUD와 가스 일꾼 자동 배치를 켭니다. 기본값은 켜짐입니다.",
      en: "Enables the production, research, upgrade and supply HUD plus gas-worker auto-fill. On by default.",
    },
    since: "v1.4.1",
  },
  {
    name: { ko: "옵저버", en: "Observer" },
    values: "Observer slot",
    effect: {
      ko: "관전자 슬롯으로 입장하면 전용 밴픽 오버레이가 자동으로 켜집니다.",
      en: "Joining through an Observer slot turns the broadcast draft overlay on automatically.",
    },
    since: "v1.4",
  },
];
