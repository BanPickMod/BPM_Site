import type { Lang } from "@/lib/i18n/config";
import { mediaHtml } from "@/lib/media";

/** Renders the file supplied for a media slot (see lib/media.ts), or nothing when there is none. */
export function MediaSlot({ id, lang }: { id: string; lang: Lang }) {
  const html = mediaHtml(id, lang);
  if (!html) return null;
  return <div className="media-slot" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A row of slots. Renders nothing at all when none of them has a file yet. */
export function MediaRow({ ids, lang }: { ids: string[]; lang: Lang }) {
  const items = ids.map((id) => ({ id, html: mediaHtml(id, lang) })).filter((x) => x.html);
  if (!items.length) return null;
  return (
    <div className="media-row">
      {items.map((x) => (
        <div key={x.id} className="media-slot" dangerouslySetInnerHTML={{ __html: x.html }} />
      ))}
    </div>
  );
}
