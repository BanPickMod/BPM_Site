export const locales = ["ko", "en"] as const;
export type Lang = (typeof locales)[number];
export const defaultLang: Lang = "ko";

export const isLang = (v: string): v is Lang => (locales as readonly string[]).includes(v);

/** A bilingual string. All site content is authored as {ko, en} pairs. */
export type Bi = { ko: string; en: string };

export const tx = (lang: Lang, v: Bi): string => v[lang];
