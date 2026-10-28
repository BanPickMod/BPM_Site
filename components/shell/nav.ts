import type { Dictionary } from "@/lib/i18n/dictionary";

export interface NavItem {
  key: keyof Dictionary["nav"];
  /** Path below /{lang}. */
  path: string;
  /** false renders a dimmed "coming soon" entry instead of a link. Flip to true when the page ships. */
  live: boolean;
}

export const primaryNav: NavItem[] = [
  { key: "home", path: "", live: true },
  { key: "news", path: "#news", live: true },
  { key: "guide", path: "/guide", live: true },
  { key: "wiki", path: "/wiki", live: true },
  { key: "patches", path: "/patches", live: true },
];

export const secondaryNav: NavItem[] = [
  { key: "ai", path: "/ai", live: true },
  { key: "replay", path: "/replay-analysis", live: true },
  { key: "events", path: "/events", live: true },
  { key: "ladder", path: "/ladder", live: true },
];
