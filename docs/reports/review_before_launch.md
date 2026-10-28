# 공개 전 검수 목록

> **상태: 검수 완료 (2026-10-27, 사용자 확인).** 아래 세 절을 모두 확인했고, 유닛 역할 설명 17종은 `reviewed: true`로 반영했습니다. 이후 변경은 이 문서를 다시 쓰지 말고 필요할 때 새로 작성합니다.
세 가지를 한 번에 봅니다. 고칠 곳은 각 절 제목의 파일입니다. 고칠 문장만 알려 주셔도 제가 반영합니다.

## 1. 이벤트 페이지 (`app/[lang]/events/page.tsx`)

| 항목 | 현재 문구 | 근거 | 확인할 점 |
|---|---|---|---|
| 콜로세움 1 일정 | 11/1 ~ 11/2 (KST), 상태 "예정" | v2.0 패치노트 | 11/1은 확정이 아님. 날짜가 바뀌면 홈의 이벤트 문구도 같이 수정 |
| 콜로세움 방식 | 6개 매치업 Bo3 풀리그, 스네이크 밴 3밴 | 패치노트 | 그대로 맞는지 |
| 리플레이 공개 | 모든 리플레이를 이 사이트에서 공개, 크리에이터 중계 가능 | 패치노트 | 사이트의 리플레이 공개 기능은 아직 "준비 중"이라, 이벤트 전에 열려야 함 |
| 챌린지 S1 일정 | "일정 미정" | 패치노트 | |
| 챌린지 조건 | 어려움~프로는 아무 종족, 챌린지는 3종족 모두 클리어, 1:1 래더 맵 아무거나 | 패치노트 | |
| 상금 | "추후 공지" (패치노트와 이벤트 페이지) | 사용자 결정 | 금액은 공개하지 않음 |

## 2. 업그레이드 영어 문구 (`scripts/wiki/curated/upgrade-meta.json`)

한국어는 게임 툴팁 그대로이고, 영어만 제가 번역했습니다. 숫자는 한국어와 같게 두었습니다.

| 업그레이드 | 한국어 (게임) | 영어 (번역) |
|---|---|---|
| 네이팜 탄창 / Napalm Ammo | 경장갑 대상 대미지가 5 증가하고, 파이어뱃의 공격 범위가 2 증가하며, 공격 딜레이가 감소합니다. | Increases damage against Light by 5 and the Firebat's attack range by 2, and reduces the attack delay. |
| 보병 중장갑 / Infantry Heavy Armor | 파이어뱃과 불곰의 체력을 25 향상시키고 중장갑으로 변경시킵니다. | Increases Firebat and Marauder health by 25 and changes them to Armored. |
| 분쇄탄 / Shatter Shells | 불곰의 충격탄이 1.5 범위 내의 적 유닛들을 둔화시킵니다. 충격탄 연구, 유령 사관학교 필요 | Marauder Concussive Shells slow enemy units within 1.5 range. Requires Concussive Shells and Ghost Academy. |
| 카론 증폭기 / Charon Boosters | 골리앗의 대공 미사일 사거리를 3만큼 증가시킵니다. | Increases the Goliath's anti-air missile range by 3. |
| 폭주 미사일 / Haywire Missile | 투견이 중장갑 유닛에 추가 피해를 주는 폭주 미사일 능력을 사용할 수 있게 합니다. | Lets the WarHound use Haywire Missile, which deals extra damage to Armored units. |
| 크루시오 완충기 / Crucio Suppressor | 공성 모드에서 아군 유닛에 주는 직격 및 방사 피해 대미지가 75% 감소합니다. 무기고 필요 | In Sieged Mode, reduces direct and splash damage dealt to friendly units by 75%. Requires Armory. |
| 은폐장 / Cloaking Field | 레이스가 은폐 능력을 사용할 수 있게 합니다. | Lets the Wraith cloak. |
| 아폴로 반응로 / Apollo Reactor | 레이스의 최대 에너지를 50만큼 증가시키고, 초기 에너지를 50만큼 증가시킵니다. | Increases the Wraith's maximum energy by 50 and starting energy by 50. |
| 디펜시브 매트릭스 / Defensive Matrix | 사이언스 베슬이 디펜시브 매트릭스를 사용할 수 있게 합니다. 융합로 필요 | Lets the Science Vessel use Defensive Matrix. Requires Fusion Core. |
| 락다운 미사일 / Lockdown Missile | 사이언스 베슬이 락다운 미사일을 사용할 수 있게 합니다. 융합로 필요 | Lets the Science Vessel use Lockdown Missile. Requires Fusion Core. |
| 과학선 부스트 / Science Vessel Boost | 사이언스 베슬이 과학선 부스트를 사용할 수 있게 합니다. | Lets the Science Vessel use Science Vessel Boost. |
| 통합 화력 관제망 / Integrated Fire Control Network | 밤까마귀가 통합 화력 관제망을 사용할 수 있게 합니다. | Lets the Raven use Integrated Fire Control Network. |
| 특이점 장전 / Singularity Charge | 드라군의 사거리를 1만큼 증가시킵니다. | Increases the Dragoon's range by 1. |
| 위상 모드 활성화 / Phasing Mode | 동력기가 위상 모드를 활성화할 수 있게 합니다. | Lets the Energizer activate Phasing Mode. |
| 보호막 과충전 / Shield Overcharge | 동력기의 최대 보호막을 40 증가시킵니다. (40 → 80) | Increases the Energizer's maximum shields by 40. (40 → 80) |
| 디스크럽션 웹 / Disruption Web | 해적선이 디스크럽션 웹을 시전할 수 있게 합니다. 디스크럽션 웹 영역 안의 적 지상 유닛과 구조물은 공격할 수 없게 됩니다. | Lets the Corsair cast Disruption Web. Enemy ground units and structures inside the web cannot attack. |
| 원거리 센서 / Apial Sensors | 스카웃의 시야를 2만큼 증가시킵니다. | Increases the Scout's sight by 2. |
| 중력 추진기 / Gravitic Thrusters | 스카웃의 이동 속도를 33% 증가시킵니다. | Increases the Scout's movement speed by 33%. |
| 갑충탄 공격력 / Scarab Damage | 리버의 갑충탄 공격력을 25만큼 증가시킵니다. | Increases Reaver Scarab damage by 25. |
| 갑충탄 격납고 확장 / Scarab Capacity | 리버가 장전할 수 있는 최대 갑충탄 수를 5만큼 증가시킵니다. | Increases the Reaver's maximum loaded Scarabs by 5. |
| 스테이시스 필드 / Stasis Field | 중재자가 대상을 정지 상태로 만들어 행동을 불능으로 만드는 스테이시스 필드 능력을 사용할 수 있게 합니다. | Lets the Arbiter cast Stasis Field, freezing targets in place so they cannot act. |
| 리콜 / Recall | 중재자가 지정한 위치의 아군 유닛들을 자신에게로 순간이동시키는 리콜 능력을 사용할 수 있게 합니다. | Lets the Arbiter teleport friendly units at a chosen location to itself. |
| 다리 근육 보강 진화 / Leg Muscle Enhancement | 변형체의 이동 속도를 증가시킵니다. (3.5 → 4.13) | Increases the Aberration's movement speed. (3.5 → 4.13) |
| 돌기 수축 진화 / Volatile Spines | 휘발성 돌기의 사거리가 1만큼 증가합니다. | Increases Volatile Spines' range by 1. |
| 역병 연구 / Plague | 파멸충이 역병을 시전할 수 있게 합니다. 대상 지역의 적 유닛과 구조물에 지속 피해를 입힙니다. | Lets the Defiler cast Plague, dealing damage over time to enemy units and structures in the target area. |
| 흡수 연구 / Consume | 파멸충이 아군 저그 유닛을 흡수하여 에너지를 50 회복할 수 있게 합니다. | Lets the Defiler absorb a friendly Zerg unit to restore 50 energy. |
| 메타시냅스 결절 연구 / Metasynaptic Node | 파멸충의 초기 에너지가 25 증가하고 최대 에너지가 50 증가합니다. | Increases the Defiler's starting energy by 25 and maximum energy by 50. |
| 배우체 분열 / Gamete Meiosis | 클래식 퀸의 최대 에너지를 50만큼 증가시키고, 초기 에너지를 50만큼 증가시킵니다. | Increases the Classic Queen's maximum energy by 50 and starting energy by 50. |
| 원시 허물 진화 / Primal Molt | 티라노조르의 장갑을 1 증가시킵니다. 울트라리스크 동굴 필요 | Increases the Tyrannozor's armor by 1. Requires Ultralisk Cavern. |
| 전투 자극제 / Stimpack | 체력을 소모해 잠시 이동 속도와 공격 속도를 높입니다. | Spend health to briefly raise movement and attack speed. |

## 3. 유닛 17종 역할 설명 (`scripts/wiki/curated/unit-notes.json`)

기존 한국어 문장과 XML로 쓴 초안입니다. 수치는 표에서 나오므로 문장에는 없습니다. 틀리거나 어색한 줄만 알려 주세요.

| 유닛 | 항목 | 기본 유닛 | BPM 유닛 (한국어) | BPM 유닛 (영어) |
|---|---|---|---|---|
| 파이어뱃 / Firebat | **역할** | | 경장갑 광역 근접 화염 | Short-range splash flames, strong against Light |
| | 생산 | | 병영 (기술실) / 선행: 병영 기술실 | Barracks (Tech Lab) / Barracks Tech Lab |
| | 전투 포지션 | 원거리 단일 대상 타격, 중장갑에 강함 | 초근접 광역 화염, 경장갑에 강함 | Very short range splash flames, strong against Light |
| | 특수 기능 | 충격탄 감속 연구 | 전투 자극제 사용 가능 | Can use Stimpack |
| 골리앗 / Goliath | **역할** | | 대공/지상 올라운더 | All-round anti-air and ground |
| | 생산 | | 군수공장 / 선행: 무기고 | Factory / Armory |
| | 운용 기동성 | 둔중한 대형 병기 | 기동성이 좋은 올라운더 | Mobile all-rounder |
| | 대공 타격 | 모드 전환이 필요합니다. | 즉시 반응하는 쌍발 대공 미사일 | Twin anti-air missiles that react at once |
| 투견 / WarHound | **역할** | | 기계 특화 전열 탱커 | Front-line tank that counters Mechanical |
| | 생산 | | 군수공장 (기술실) / 선행: 군수공장 기술실 | Factory (Tech Lab) / Factory Tech Lab |
| | 전투 포지션 | 시즈 모드로 거치하는 장거리 포격 | 이동하며 돌파하는 전열 탱커 | Mobile front-line tank that pushes through |
| | 기계 특화 | 중장갑 대상 광역 피해 | 기계 대상 단일 고피해와 스킬 | High single-target damage to Mechanical, plus an ability |
| 레이스 / Wraith | **역할** | | 고속 은폐 요격기 | Fast cloaking interceptor |
| | 생산 | | 우주공항 / 선행: 우주공항 | Starport / Starport |
| | 형태와 은폐 | 착륙해 지상 공격하는 돌격 모드 | 항상 비행하며 은폐할 수 있음 | Always flying, can cloak |
| | 대공 교전 | 긴 사거리의 중장갑 단발 공격 | 짧은 사거리의 고속 쌍발 레이저 | Short-range fast twin lasers |
| 사이언스 베슬 / Science Vessel | **역할** | | 마법 지원 | Spellcaster support |
| | 생산 | | 우주공항 (기술실) / 선행: 우주공항 기술실 | Starport (Tech Lab) / Starport Tech Lab |
| | 스킬 구성 | 자동 포탑, 대장갑 미사일, 방해 매트릭스 | 디펜시브 매트릭스, EMP, 락다운, 이레디에이트 | Defensive Matrix, EMP, Lockdown, Irradiate |
| 드라군 / Dragoon | **역할** | | 중장갑 포격 | Armored-focused ranged fire |
| | 생산 | | 관문 / 차원관문 / 선행: 인공제어소 | Gateway / Warp Gate / Cybernetics Core |
| | 내구도와 포격 | 점멸로 기동하는 추적자 | 묵직한 중장갑 원거리 포격 | Heavier ranged fire against Armored |
| | 사거리 | 고정 사거리 | 연구로 사거리가 늘어납니다. | Range grows with research. |
| 동력기 / Energizer | **역할** | | 시간 제어와 동력장 지원 | Time control and power-field support |
| | 생산 | | 관문 / 차원관문 / 선행: 인공제어소 | Gateway / Warp Gate / Cybernetics Core |
| | 지원 스킬 | 역장, 수호방패, 환상 | 시간 방패, 위상 모드 | Time Shield, Phasing Mode |
| | 이동식 파일런 | 동력을 공급할 수 없습니다. | 위상 모드로 동력장을 펼칩니다. | Deploys a power field in Phasing Mode. |
| 해적선 / Corsair | **역할** | | 대공 광역 스플래시 | Anti-air splash |
| | 생산 | | 우주관문 / 선행: 우주관문 | Stargate / Stargate |
| | 대공 교전 | 이동 사격하는 단일 대상, 경장갑에 강함 | 공중 광역 스플래시, 뮤탈리스크와 타락귀에 강함 | Air splash, strong against Mutalisks and Corruptors |
| | 지상 견제 | 중력자 광선 | 디스크럽션 웹으로 지상 공격을 막습니다. | Disruption Web shuts down ground attacks. |
| 스카웃 / Scout | **역할** | | 고화력 중장갑 요격 | High-damage Armored interceptor |
| | 생산 | | 우주관문 / 선행: 우주관문 | Stargate / Stargate |
| | 타격 방식 | 충전하는 지속 빔 | 즉시 피해를 주는 쌍발 요격 미사일 | Twin interceptor missiles with instant damage |
| | 업그레이드 | 이동 속도 증폭 | 원거리 센서와 중력 추진기 | Apial Sensors and Gravitic Thrusters |
| 리버 / Reaver | **역할** | | 자동 추적 광역 폭격 | Auto-tracking splash bombardment |
| | 생산 | | 로봇공학시설 / 선행: 로봇공학지원소 | Robotics Facility / Robotics Bay |
| | 조작 방식 | 구체를 쏜 뒤 궤적을 직접 조종합니다. | 갑충탄을 장전해 목표를 자동으로 추적합니다. | Loads Scarabs that track the target automatically. |
| | 기동성과 수송 | 준족의 기동 | 매우 느려서 차원 분광기 수송이 필수입니다. | Very slow; relies on Warp Prism transport. |
| 중재자 / Arbiter | **역할** | | 은폐와 시공간 전술 | Cloaking and space-time tactics |
| | 생산 | | 우주관문 / 선행: 함대 신호소 | Stargate / Fleet Beacon |
| | 편제 수량 | 경기당 한 기만 보유할 수 있습니다. | 자원이 허용하는 만큼 여러 기를 둘 수 있습니다. | As many as resources allow. |
| | 스킬 구성 | 시간 왜곡, 소환, 은폐장 | 스테이시스 필드, 리콜, 주변 은폐장 | Stasis Field, Recall, nearby cloak |
| 변형체 / Aberration | **역할** | | 대형 근접 브루저 | Large melee bruiser |
| | 생산 | | 애벌레 (바퀴 소굴 + 군락) / 선행: 군락 | Larva (Roach Warren + Lair) / Lair |
| | 공격 형태 | 원거리 산성액 사격 | 근접 대형 타격, 중장갑에 강함 | Heavy melee hits, strong against Armored |
| | 내구도와 이동 | 잠복하며 빠르게 재생합니다. | 아군 소형 유닛 위를 걸어서 지나갑니다. | Walks over friendly small units. |
| 라바사우르스 / Ravasaur | **역할** | | 장거리 중장갑 저격 | Long-range Armored sniper |
| | 생산 | | 애벌레 (바퀴 소굴 + 군락) / 선행: 군락 | Larva (Roach Warren + Lair) / Lair |
| | 타격 메커니즘 | 부식성 담즙을 스킬로 조준해 발사합니다. | 평타로 안정적으로 중장갑을 저격합니다. | Snipes Armored targets with a steady basic attack. |
| | 생산 방식 | 바퀴를 만든 뒤 변태합니다. | 애벌레에서 바로 생산합니다. | Produced straight from Larva. |
| 파멸충 / Defiler | **역할** | | 전술 마법 | Tactical caster |
| | 생산 | | 애벌레 (파멸충 언덕 + 군락) / 선행: 파멸충 언덕 | Larva (Defiler Mound + Lair) / Defiler Mound |
| | 전술 마법 | 진균 번식, 신경 기생충, 미생물 기포 | 다크 스웜, 플레이그 | Dark Swarm, Plague |
| | 에너지 수급 | 시간이 지나며 회복합니다. | 컨슘으로 아군 유닛을 흡수해 충전합니다. | Consume absorbs friendly units to recharge. |
| 퀸 / Queen | **역할** | | 공중 비행 마법사 | Flying caster |
| | 생산 | | 애벌레 (감염 구덩이) / 선행: 감염 구덩이 | Larva (Infestation Pit) / Infestation Pit |
| | 기동성 | 비행하며 이동합니다. | 더 빠르게 비행해 전장을 순회합니다. | Flies faster and roams the battlefield. |
| | 스킬 구성 | 납치, 흑구름, 기생 폭탄, 흡수 | 인스네어, 브루들링 | Ensnare, Broodling |
| 티라노조르 / Tyrannozor | **역할** | | 최종 전선 파쇄 괴수 | Late-game front-line breaker |
| | 생산 | | 애벌레 (울트라리스크 동굴) / 선행: 울트라리스크 동굴 | Larva (Ultralisk Cavern) / Ultralisk Cavern |
| | 공격 | 단일 대상 근접 공격 | 광역 피해 | Splash damage |
| 가디언 / Guardian | **역할** | | 장거리 공성 폭격 | Long-range siege bombardment |
| | 생산 | | 뮤탈리스크 변태 (둥지탑) / 선행: 둥지탑 | Mutalisk morph (Spire) / Spire |
| | 공격 방식 | 공생충을 투하해 착탄이 늦고 어그로가 분산됩니다. | 지연 없이 산성탄을 연속으로 쏩니다. | Fires acid shots in quick succession with no delay. |
| | 변태 테크 | 거대 둥지탑이 필요합니다. | 일반 둥지탑에서 바로 변태합니다. | Morphs from a regular Spire. |
