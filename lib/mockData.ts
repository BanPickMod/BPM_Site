export interface MockUnit {
  id: string;
  nameKo: string;
  nameEn: string;
  race: "terran" | "protoss" | "zerg";
  role: string;
  tier: number;
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
    sight: number;
  };
  weapons: {
    name: string;
    targets: "ground" | "air" | "any";
    damage: number;
    bonusDamage?: { amount: number; targetAttribute: string };
    attacks?: number;
    period: number;
    dps: number;
    range: number;
  }[];
  abilities: {
    name: string;
    cost?: string;
    cooldown?: number;
    description: string;
  }[];
  pickGroupId?: string;
  description: string;
}

export interface MockPickGroup {
  id: string;
  race: "terran" | "protoss" | "zerg";
  name: string;
  unitAId: string;
  unitBId: string;
  tacticalRole: string;
  summary: string;
}

export const MOCK_PICK_GROUPS: MockPickGroup[] = [
  {
    id: "pg-terran-1",
    race: "terran",
    name: "보병 지원/충격군 (Infantry Assault)",
    unitAId: "firebat",
    unitBId: "marauder",
    tacticalRole: "바이오닉 전열 탱킹 및 대경장갑 vs 중장갑 충격",
    summary:
      "화염방사병은 저글링/광전사 등 경장갑 밀집 부대에 극대화된 방사 피해를 가하며, 불곰은 충격탄을 통한 강력한 둔화와 중장갑 추뎀을 제공합니다.",
  },
  {
    id: "pg-terran-2",
    race: "terran",
    name: "중기계화 대공/대지 (Heavy Mech)",
    unitAId: "goliath",
    unitBId: "thor",
    tacticalRole: "팩토리 체제 범용 대공 및 거대 충격 화력",
    summary:
      "골리앗은 기동성과 긴 사거리의 듀얼 미사일로 뮤탈/공중을 견제하며, 토르는 거대한 맷집과 고충격 탄두로 거대 공중/지상을 압도합니다.",
  },
  {
    id: "pg-protoss-1",
    race: "protoss",
    name: "공성 화력 지원 (Robotics Siege)",
    unitAId: "reaver",
    unitBId: "colossus",
    tacticalRole: "로봇공학시설 기반 광역 섬멸 화력",
    summary:
      "파괴자(리버)는 스카라브를 통한 치명적인 단발 폭딜로 셔틀 드랍과 방어에 뛰어나며, 거신은 언덕 지형을 무시하고 일관된 열광선 방사 피해를 입힙니다.",
  },
  {
    id: "pg-protoss-2",
    race: "protoss",
    name: "사이오닉 함대 보조 (Fleet Tactics)",
    unitAId: "arbiter",
    unitBId: "mothership",
    tacticalRole: "은폐 필드 및 대규모 전장 왜곡 제어",
    summary:
      "중재자(아비터)는 리콜과 스테이시스 필드로 기습과 전장 분할에 특화되어 있으며, 모선은 시간 왜곡과 강력한 생존성을 자랑합니다.",
  },
  {
    id: "pg-zerg-1",
    race: "zerg",
    name: "군단 특수 마법사 (Bio Spellcaster)",
    unitAId: "defiler",
    unitBId: "viper",
    tacticalRole: "원거리 사격 무력화 및 적 핵심 유닛 무력화",
    summary:
      "디파일러는 다크 스웜으로 원거리 탄환을 100% 무효화하고 플레이그로 체력을 고갈시키며, 살모사는 납치와 흑구름으로 정밀 타격을 유도합니다.",
  },
];

export const MOCK_UNITS: MockUnit[] = [
  {
    id: "firebat",
    nameKo: "화염방사병",
    nameEn: "Firebat",
    race: "terran",
    role: "경장갑 분쇄 돌격병",
    tier: 1,
    cost: { minerals: 100, vespene: 25, supply: 2, buildTime: 24 },
    defense: { hp: 135, armor: 2, attributes: ["생체", "경장갑"] },
    movement: { speed: 2.75, sight: 9 },
    weapons: [
      {
        name: "화염 화포",
        targets: "ground",
        damage: 16,
        bonusDamage: { amount: 12, targetAttribute: "경장갑" },
        attacks: 2,
        period: 1.2,
        dps: 23.3,
        range: 3,
      },
    ],
    abilities: [
      {
        name: "전투 자극제 (Stimpack)",
        cost: "HP 10",
        description: "공격 속도 50% 및 이동 속도 50% 증가.",
      },
      {
        name: "소이탄 분사",
        description: "부채꼴 영역에 지속 불길을 생성하여 지상 유닛을 제압.",
      },
    ],
    pickGroupId: "pg-terran-1",
    description: "중장갑 슈트를 착용한 근접 화염 돌격병으로, 경장갑 무리에 괴멸적인 피해를 가합니다.",
  },
  {
    id: "marauder",
    nameKo: "불곰",
    nameEn: "Marauder",
    race: "terran",
    role: "중장갑 요격 충격 보병",
    tier: 1,
    cost: { minerals: 100, vespene: 25, supply: 2, buildTime: 21 },
    defense: { hp: 125, armor: 1, attributes: ["생체", "중장갑"] },
    movement: { speed: 2.25, sight: 10 },
    weapons: [
      {
        name: "유탄 발사기",
        targets: "ground",
        damage: 10,
        bonusDamage: { amount: 10, targetAttribute: "중장갑" },
        attacks: 1,
        period: 1.07,
        dps: 18.7,
        range: 6,
      },
    ],
    abilities: [
      {
        name: "전투 자극제 (Stimpack)",
        cost: "HP 20",
        description: "공격 속도 50% 및 이동 속도 50% 증가.",
      },
      {
        name: "충격탄 (Concussive Shells)",
        description: "적중된 적 지상 유닛의 이동 속도를 50% 감소시킵니다.",
      },
    ],
    pickGroupId: "pg-terran-1",
    description: "강력한 유탄으로 적의 돌격을 늦추고 중장갑 유닛을 효율적으로 요격합니다.",
  },
  {
    id: "goliath",
    nameKo: "골리앗",
    nameEn: "Goliath",
    race: "terran",
    role: "기동형 대공/대지 지원 워커",
    tier: 2,
    cost: { minerals: 150, vespene: 50, supply: 2, buildTime: 29 },
    defense: { hp: 140, armor: 1, attributes: ["기계", "중장갑"] },
    movement: { speed: 3.15, sight: 10 },
    weapons: [
      {
        name: "트윈 오토캐논 (지상)",
        targets: "ground",
        damage: 16,
        attacks: 2,
        period: 1.25,
        dps: 12.8,
        range: 6,
      },
      {
        name: "헬파이어 미사일 (대공)",
        targets: "air",
        damage: 18,
        bonusDamage: { amount: 10, targetAttribute: "중장갑" },
        attacks: 2,
        period: 1.5,
        dps: 18.7,
        range: 8,
      },
    ],
    abilities: [],
    pickGroupId: "pg-terran-2",
    description: "지상과 공중을 모두 상대할 수 있는 메카닉의 다목적 올라운더 전투 보행병기입니다.",
  },
  {
    id: "thor",
    nameKo: "토르",
    nameEn: "Thor",
    race: "terran",
    role: "결전형 중장갑 결전기",
    tier: 3,
    cost: { minerals: 300, vespene: 200, supply: 6, buildTime: 43 },
    defense: { hp: 400, armor: 2, attributes: ["기계", "중장갑", "거대"] },
    movement: { speed: 2.25, sight: 11 },
    weapons: [
      {
        name: "토르의 망치 (지상)",
        targets: "ground",
        damage: 60,
        attacks: 2,
        period: 1.28,
        dps: 46.9,
        range: 7,
      },
      {
        name: "재벌린 미사일포 (대공)",
        targets: "air",
        damage: 24,
        attacks: 4,
        period: 2.14,
        dps: 22.4,
        range: 10,
      },
    ],
    abilities: [
      {
        name: "고충격 탄두 모드",
        description: "단일 거대 공중 대상에게 관통 극딜을 가하는 모드로 전환합니다.",
      },
    ],
    pickGroupId: "pg-terran-2",
    description: "엄청난 내구도와 화력으로 전선을 단단히 고정하는 테란 지상군의 최종 결전병기입니다.",
  },
  {
    id: "reaver",
    nameKo: "파괴자 (리버)",
    nameEn: "Reaver",
    race: "protoss",
    role: "초중거리 공성 파괴병기",
    tier: 2,
    cost: { minerals: 200, vespene: 100, supply: 4, buildTime: 40 },
    defense: { hp: 100, shield: 80, armor: 1, attributes: ["기계", "중장갑"] },
    movement: { speed: 1.15, sight: 10 },
    weapons: [
      {
        name: "스카라브 (Scarab)",
        targets: "ground",
        damage: 100,
        attacks: 1,
        period: 2.2,
        dps: 45.5,
        range: 8,
      },
    ],
    abilities: [
      {
        name: "스카라브 생산",
        cost: "15 광물",
        description: "스카라브 탄약을 제조하여 최대 5발까지 장전합니다.",
      },
    ],
    pickGroupId: "pg-protoss-1",
    description: "느리지만 파괴적인 지상 탄두를 발사하여 뭉쳐있는 지상 병력을 일격에 분쇄합니다.",
  },
  {
    id: "colossus",
    nameKo: "거신",
    nameEn: "Colossus",
    race: "protoss",
    role: "지형 무시 광역 소탕기",
    tier: 3,
    cost: { minerals: 300, vespene: 200, supply: 6, buildTime: 54 },
    defense: { hp: 200, shield: 150, armor: 1, attributes: ["기계", "중장갑", "거대"] },
    movement: { speed: 3.15, sight: 11 },
    weapons: [
      {
        name: "열광선",
        targets: "ground",
        damage: 24,
        bonusDamage: { amount: 16, targetAttribute: "경장갑" },
        attacks: 2,
        period: 1.07,
        dps: 37.4,
        range: 7,
      },
    ],
    abilities: [
      {
        name: "언덕 보행",
        description: "고저차 지형을 자유롭게 넘나들며 위치를 선정합니다.",
      },
    ],
    pickGroupId: "pg-protoss-1",
    description: "긴 다리로 절벽을 이동하며 부채꼴 광선으로 경장갑 무리를 태워버립니다.",
  },
  {
    id: "arbiter",
    nameKo: "중재자 (아비터)",
    nameEn: "Arbiter",
    race: "protoss",
    role: "전술 지원 사이오닉 함선",
    tier: 3,
    cost: { minerals: 100, vespene: 350, supply: 4, buildTime: 50 },
    defense: { hp: 175, shield: 150, energy: 200, armor: 1, attributes: ["기계", "중장갑"] },
    movement: { speed: 2.75, sight: 10 },
    weapons: [
      {
        name: "위상포",
        targets: "any",
        damage: 10,
        attacks: 1,
        period: 1.4,
        dps: 7.1,
        range: 5,
      },
    ],
    abilities: [
      {
        name: "은폐장 (Cloaking Field)",
        description: "자신을 제외한 주변 모든 아군 유닛을 영구 은폐합니다.",
      },
      {
        name: "정지장 (Stasis Field)",
        cost: "100 에너지",
        description: "지정 영역의 모든 적 유닛을 25초간 얼려 무력화합니다.",
      },
      {
        name: "소환 (Recall)",
        cost: "150 에너지",
        description: "원거리의 아군 부대를 자신의 위치로 즉시 전송합니다.",
      },
    ],
    pickGroupId: "pg-protoss-2",
    description: "은폐장과 정지장, 리콜로 전황을 단숨에 뒤엎는 프로토스의 궁극 전술 기함입니다.",
  },
  {
    id: "defiler",
    nameKo: "파멸충 (디파일러)",
    nameEn: "Defiler",
    race: "zerg",
    role: "전장 차단 군단 마법사",
    tier: 3,
    cost: { minerals: 50, vespene: 150, supply: 2, buildTime: 36 },
    defense: { hp: 80, energy: 200, armor: 1, attributes: ["생체"] },
    movement: { speed: 2.5, sight: 10 },
    weapons: [],
    abilities: [
      {
        name: "다크 스웜 (Dark Swarm)",
        cost: "100 에너지",
        description: "오렌지 연막 내 모든 지상 유닛을 원거리 투사체 공격으로부터 100% 보호합니다.",
      },
      {
        name: "플레이그 (Plague)",
        cost: "150 에너지",
        description: "적 유닛 및 건물의 체력을 서서히 최대 295까지 갉아먹습니다.",
      },
      {
        name: "컨슘 (Consume)",
        description: "아군 저그 유닛 하나를 먹어치우고 50 에너지를 즉시 회복합니다.",
      },
    ],
    pickGroupId: "pg-zerg-1",
    description: "다크 스웜으로 적의 사격을 완전 봉쇄하고 플레이그로 치명상을 입히는 군단의 재앙입니다.",
  },
  {
    id: "viper",
    nameKo: "살모사 (바이퍼)",
    nameEn: "Viper",
    race: "zerg",
    role: "공중 제어 비행 마법사",
    tier: 3,
    cost: { minerals: 100, vespene: 200, supply: 3, buildTime: 29 },
    defense: { hp: 150, energy: 200, armor: 1, attributes: ["생체", "중장갑"] },
    movement: { speed: 3.85, sight: 11 },
    weapons: [],
    abilities: [
      {
        name: "납치 (Abduct)",
        cost: "75 에너지",
        description: "적 유닛을 즉시 자신 앞으로 끌고와 점사할 수 있도록 만듭니다.",
      },
      {
        name: "흑구름 (Blinding Cloud)",
        cost: "100 에너지",
        description: "구름 안의 모든 지상 유닛의 사거리를 근접(1)으로 제한합니다.",
      },
      {
        name: "기생 폭탄 (Parasitic Bomb)",
        cost: "125 에너지",
        description: "적 공중 유닛에 폭탄을 심어 주변 공중 부대 전체에 지속 방사 피해를 입힙니다.",
      },
    ],
    pickGroupId: "pg-zerg-1",
    description: "공중에서 적 핵심 병기를 납치하고 사거리를 무력화하는 정밀 전술 비행체입니다.",
  },
];
