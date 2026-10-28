import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n/config";

/** Art for each event, served from public/events/<slug>/ (banner 1672x941, logo 512x512, og 1200x675). */
export const EVENT_ART: Record<string, { name: Record<Lang, string>; alt: Record<Lang, string> }> = {
  "colosseum-1": {
    name: { ko: "BPM AI 콜로세움 1", en: "BPM AI Colosseum 1" },
    alt: {
      ko: "BPM AI 콜로세움 1 배너. AI 대 AI, Bo3 풀리그, 11월 1일부터 2일(KST)",
      en: "BPM AI Colosseum 1 banner. AI vs AI, Bo3 round robin, Nov 1 to Nov 2 (KST)",
    },
  },
  "challenge-s1": {
    name: { ko: "BPM AI 챌린지 S1", en: "BPM AI Challenge S1" },
    alt: {
      ko: "BPM AI 챌린지 S1 배너. 사람 대 AI, 어려움에서 프로를 거쳐 챌린지까지",
      en: "BPM AI Challenge S1 banner. Human vs AI, from Hard through Pro to Challenge",
    },
  },
};

export const eventArtPath = (slug: string, file: string) => `/events/${slug}/${file}`;

/** Share-preview image. Absolute URLs need SITE_URL, so without it the page keeps the text-only preview. */
export function eventOpenGraph(slug: string, lang: Lang): Metadata["openGraph"] | undefined {
  const art = EVENT_ART[slug];
  if (!art || !process.env.SITE_URL) return undefined;
  return {
    title: art.name[lang],
    images: [{ url: eventArtPath(slug, "og.jpg"), width: 1200, height: 675, alt: art.alt[lang] }],
  };
}
