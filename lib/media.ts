import fs from "node:fs";
import path from "node:path";
import slotsJson from "@/content/media/slots.json";
import type { Bi, Lang } from "@/lib/i18n/config";

/**
 * Screenshot, GIF and video slots.
 *
 * A slot is a named place on a page (or in a patch note) where media can go. Drop a file named after the slot
 * into public/media/ and it shows up on the next build; with no file the slot renders nothing in production.
 *
 *   public/media/<slot-id>.<ext>        png, jpg, jpeg, webp, gif, mp4, webm
 *   public/media/<slot-id>.en.<ext>     optional English-client version, used on /en
 *   public/media/<slot-id>.poster.<ext> optional poster image for a video
 *   public/media/<slot-id>.json         optional {"caption": {"ko", "en"}, "youtube": "<video id>"}
 *
 * The slot list is content/media/slots.json. `npm run media:report` writes docs/media-slots.md, a checklist of
 * what each slot should show and whether its file exists.
 *
 * In Markdown (patch notes) a slot is written as an image: ![alt text](media:v2.0-effect-nuke)
 */

export interface SlotDef {
  id: string;
  area: string;
  /** What to capture, for whoever supplies the file. Not shown on the site. */
  hint: string;
  caption?: Bi;
}

export const slots = slotsJson as SlotDef[];
export const slotIds = new Set(slots.map((s) => s.id));

const IMAGE_EXT = ["webp", "png", "jpg", "jpeg", "gif"];
const VIDEO_EXT = ["mp4", "webm"];
const DIR = path.join(process.cwd(), "public", "media");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function findFile(base: string, exts: string[]): string | null {
  for (const ext of exts) {
    if (fs.existsSync(path.join(DIR, `${base}.${ext}`))) return `${base}.${ext}`;
  }
  return null;
}

interface Sidecar {
  caption?: Partial<Bi>;
  youtube?: string;
}

function readSidecar(id: string): Sidecar {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), "utf8")) as Sidecar;
  } catch {
    return {};
  }
}

/**
 * HTML for a slot, or an empty string when nothing has been supplied yet.
 * During `next dev` an empty slot shows a dashed placeholder naming the file it expects.
 */
export function mediaHtml(id: string, lang: Lang, fallbackCaption = ""): string {
  const def = slots.find((s) => s.id === id);
  const side = readSidecar(id);
  const caption = side.caption?.[lang] ?? def?.caption?.[lang] ?? fallbackCaption;
  const figcaption = caption ? `<figcaption>${esc(caption)}</figcaption>` : "";

  if (side.youtube && /^[\w-]{6,20}$/.test(side.youtube)) {
    return `<figure class="media media-video"><div class="media-frame"><iframe src="https://www.youtube-nocookie.com/embed/${side.youtube}" title="${esc(caption || id)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>${figcaption}</figure>`;
  }

  const localized = lang === "ko" ? null : findFile(`${id}.${lang}`, [...VIDEO_EXT, ...IMAGE_EXT]);
  const file = localized ?? findFile(id, [...VIDEO_EXT, ...IMAGE_EXT]);

  if (!file) {
    if (process.env.NODE_ENV === "production") return "";
    return `<figure class="media media-empty"><div class="media-ph"><b>${esc(id)}</b><span>${esc(def?.hint ?? "Unregistered slot. Add it to content/media/slots.json")}</span><code>public/media/${esc(id)}.png | .gif | .mp4</code></div></figure>`;
  }

  const ext = file.split(".").pop()!;
  const src = `/media/${file}`;
  if (VIDEO_EXT.includes(ext)) {
    const poster = findFile(`${id}.poster`, IMAGE_EXT);
    return `<figure class="media media-video"><video src="${src}" ${poster ? `poster="/media/${poster}"` : ""} controls muted loop playsinline preload="metadata"></video>${figcaption}</figure>`;
  }
  // Animated GIFs and still images use the same element; width/height are left to the CSS.
  return `<figure class="media"><img src="${src}" alt="${esc(caption || id)}" loading="lazy" decoding="async">${figcaption}</figure>`;
}

/** True when at least one of the slots has a file (or a YouTube sidecar). Used to hide whole sections. */
export function hasMedia(ids: string[], lang: Lang): boolean {
  return ids.some((id) => {
    const html = mediaHtml(id, lang);
    return html !== "" && !html.includes("media-empty");
  });
}
