import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import type { Lang } from "@/lib/i18n/config";
import { mediaHtml } from "@/lib/media";

/**
 * Patch notes are authored as Markdown, one folder per version:
 *   content/patches/<version>/ko.md
 *   content/patches/<version>/en.md
 * Each file starts with a small frontmatter block (version, date, title, summary).
 * The Markdown body is the source of truth and is rendered as written.
 */
const ROOT = path.join(process.cwd(), "content", "patches");

export interface PatchMeta {
  version: string;
  /** ISO date, or null while the release date is not decided. */
  date: string | null;
  title: string;
  summary: string;
}

export interface Patch extends PatchMeta {
  /** Rendered HTML of the Markdown body. */
  html: string;
}

const MEDIA_PREFIX = "media:";

/**
 * Markdown renderer for patch notes. An image whose address is `media:<slot-id>` is a media slot
 * (see lib/media.ts); it renders the supplied file, or nothing while the file is missing.
 */
function createRenderer(lang: Lang) {
  return new Marked({
    renderer: {
      image({ href, text }) {
        if (href.startsWith(MEDIA_PREFIX)) return mediaHtml(href.slice(MEDIA_PREFIX.length), lang, text);
        return false;
      },
      listitem(item) {
        // Split media out of a list item so a layout can place it beside the text.
        const isMedia = (t: { type: string; tokens?: { type: string; raw?: string }[] }) =>
          (t.type === "paragraph" || t.type === "text") && !!t.tokens?.length && t.tokens.some((k) => k.type === "image") && t.tokens.every((k) => k.type === "image" || k.type === "br" || (k.type === "text" && !k.raw?.trim()));
        const media = item.tokens.filter(isMedia);
        if (!media.length) return false;
        const rest = item.tokens.filter((t) => !isMedia(t));
        return `<li class="has-media"><div class="li-g"><div class="li-t">${this.parser.parse(rest)}</div><div class="li-m">${this.parser.parse(media)}</div></div></li>
`;
      },
      paragraph({ tokens }) {
        // A slot on its own line is a block, not inline text: keep <figure> out of <p>.
        const only = tokens.length === 1 && tokens[0].type === "image" ? tokens[0] : null;
        if (only && only.href.startsWith(MEDIA_PREFIX)) return mediaHtml(only.href.slice(MEDIA_PREFIX.length), lang, only.text);
        return false;
      },
    },
  });
}

function parseFrontmatter(src: string): { meta: Record<string, string | null>; body: string } {
  const m = src.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error("Patch note is missing its frontmatter block");
  const meta: Record<string, string | null> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const value = line.slice(i + 1).trim();
    meta[line.slice(0, i).trim()] = value === "null" || value === "" ? null : value;
  }
  return { meta, body: m[2] };
}

function readPatch(version: string, lang: Lang): Patch | null {
  const file = path.join(ROOT, version, `${lang}.md`);
  if (!fs.existsSync(file)) return null;
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  return {
    version: meta.version ?? version,
    date: meta.date ?? null,
    title: meta.title ?? "",
    summary: meta.summary ?? "",
    html: createRenderer(lang).parse(body, { async: false }),
  };
}

/** Versions that have a note for `lang`, newest first by version number. */
export function listPatchVersions(): string[] {
  if (!fs.existsSync(ROOT)) return [];
  const num = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => {
      const [x, y] = [num(a), num(b)];
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (y[i] ?? 0) - (x[i] ?? 0);
        if (d) return d;
      }
      return 0;
    });
}

export function getPatch(version: string, lang: Lang): Patch | null {
  return readPatch(version, lang);
}

export interface PatchSection {
  id: string;
  title: string;
  html: string;
}

/** Splits rendered patch HTML at each top-level h2 into sections (the h2 text becomes the title, not part of `html`). */
export function splitSections(html: string): { intro: string; sections: PatchSection[] } {
  const parts = html.split(/(?=<h2[ >])/);
  const intro = parts[0].startsWith("<h2") ? "" : parts.shift() ?? "";
  const sections = parts.map((p, i) => {
    const m = p.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/);
    return { id: `sec-${i + 1}`, title: (m?.[1] ?? "").replace(/<[^>]+>/g, "").trim(), html: m ? p.slice(m[0].length) : p };
  });
  return { intro, sections };
}
