import type { Lang } from "@/lib/i18n/config";
import { unitInfo } from "@/lib/replay/units";

/** Display name: the wiki's localized name, or the replay id split into words when the wiki has no entry (buildings, mod-internal units). */
export function typeName(id: string, lang: Lang): string {
  const u = unitInfo(id, lang);
  return u.wikiId ? u.name : id.replace(/^BPM_/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}
