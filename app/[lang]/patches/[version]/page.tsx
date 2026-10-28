import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPatch, listPatchVersions, splitSections } from "@/lib/patches";
import { mediaHtml, slotIds } from "@/lib/media";
import { PatchView } from "@/components/patches/PatchView";

export function generateStaticParams() {
  return locales.flatMap((lang) => listPatchVersions().map((version) => ({ lang, version })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/patches/[version]">): Promise<Metadata> {
  const { lang, version } = await params;
  if (!isLang(lang)) return {};
  const patch = getPatch(version, lang);
  if (!patch) return {};
  return { title: `${patch.version} · ${getDictionary(lang).patches.title}`, description: patch.summary };
}

export default async function PatchPage({ params }: PageProps<"/[lang]/patches/[version]">) {
  const { lang, version } = await params;
  if (!isLang(lang)) notFound();
  const patch = getPatch(version, lang);
  if (!patch) notFound();

  const d = getDictionary(lang).patches;
  const versions = listPatchVersions();
  const { intro, sections } = splitSections(patch.html);
  const coverId = `${version}-cover`;
  const cover = slotIds.has(coverId) ? mediaHtml(coverId, lang) : "";

  return (
    <section className="wrap p3">
      <nav className="p3-tabs" aria-label={d.versions}>
        {versions.map((v, i) => {
          const on = v === version;
          return (
            <Link
              key={v}
              className={`p3-v${on ? " on" : ""}`}
              href={`/${lang}/patches/${v}`}
              aria-current={on ? "page" : undefined}
            >
              <b className="mono">{v}</b>
              <span>{i === 0 ? d.latest : d.earlier}</span>
            </Link>
          );
        })}
      </nav>

      <header className={`pn-hero${cover ? " has-cover" : ""}`}>
        <div className="pn-text">
          <span className="mono pn-ver">{patch.version}</span>
          <h1>{patch.title}</h1>
          <p>{patch.summary}</p>
          <span className="mute">{patch.date ?? d.dateTbd}</span>
        </div>
        {cover && <div className="pn-cover" dangerouslySetInnerHTML={{ __html: cover }} />}
      </header>

      <PatchView lang={lang} intro={intro} sections={sections} layout={/<figure|<img/.test(patch.html) ? "b" : "a"} />
    </section>
  );
}
