import type { Lang } from "./config";

const ko = {
  brandLabel: "BPM",
  skip: "본문으로 건너뛰기",
  primaryNav: "주 메뉴",
  switchLang: "언어 전환",
  switchTheme: "테마 전환",
  themeLight: "라이트",
  themeDark: "다크",
  soon: "준비 중",
  nav: {
    home: "홈",
    news: "뉴스",
    guide: "가이드",
    wiki: "위키",
    patches: "패치",
    ai: "AI",
    replay: "리플레이 분석",
    events: "이벤트",
    ladder: "래더",
  },
  footer: {
    trademark: "StarCraft II는 Blizzard Entertainment, Inc.의 등록 상표입니다.",
  },
  races: { terran: "테란", protoss: "프로토스", zerg: "저그" },
  patches: {
    title: "패치 내역",
    versions: "버전",
    dateTbd: "날짜 미정",
    latest: "최신",
    earlier: "이전",
  },
  meta: {
    title: "BPM · 스타크래프트 II 밴픽 모드",
    description:
      "스타크래프트 II 밴픽 모드 BPM: 밴·히든 픽 규칙, 로비 가이드, 전체 유닛 밸런스 위키, 버전별 패치 내역",
  },
};

export type Dictionary = typeof ko;

const en: Dictionary = {
  brandLabel: "BPM",
  skip: "Skip to content",
  primaryNav: "Primary",
  switchLang: "Switch language",
  switchTheme: "Switch theme",
  themeLight: "Light",
  themeDark: "Dark",
  soon: "Coming soon",
  nav: {
    home: "Home",
    news: "News",
    guide: "Guide",
    wiki: "Wiki",
    patches: "Patches",
    ai: "AI",
    replay: "Replay Analysis",
    events: "Events",
    ladder: "Ladder",
  },
  footer: {
    trademark: "StarCraft II is a registered trademark of Blizzard Entertainment, Inc.",
  },
  races: { terran: "Terran", protoss: "Protoss", zerg: "Zerg" },
  patches: {
    title: "Patch history",
    versions: "Versions",
    dateTbd: "Date TBD",
    latest: "Latest",
    earlier: "Earlier",
  },
  meta: {
    title: "BPM · StarCraft II BanPick Mod",
    description:
      "BPM, the StarCraft II ban-pick mod: ban and hidden-pick rules, lobby guide, full unit balance wiki, and patch history",
  },
};

const dict: Record<Lang, Dictionary> = { ko, en };

export const getDictionary = (lang: Lang): Dictionary => dict[lang];
