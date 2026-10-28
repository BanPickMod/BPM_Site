import type { Lang } from "@/lib/i18n/config";
import { EVENT_ART, eventArtPath } from "@/lib/events";

/** 16:9 event banner. The 828px file is sent to narrow screens. */
export function EventBanner({ slug, lang, priority = false }: { slug: string; lang: Lang; priority?: boolean }) {
  const art = EVENT_ART[slug];
  if (!art) return null;
  return (
    <picture className="ev-banner">
      <source media="(max-width: 640px)" srcSet={eventArtPath(slug, "banner-sm.webp")} />
      <img
        src={eventArtPath(slug, "banner.webp")}
        width={1672}
        height={941}
        alt={art.alt[lang]}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}

/** Square emblem with a transparent background. Decorative next to the event name, so it has no alt text. */
export function EventLogo({ slug, size = 72 }: { slug: string; size?: number }) {
  if (!EVENT_ART[slug]) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimised static file
    <img className="ev-logo" src={eventArtPath(slug, "logo.webp")} width={size} height={size} alt="" loading="lazy" decoding="async" />
  );
}
