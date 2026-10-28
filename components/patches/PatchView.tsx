import type { Lang } from "@/lib/i18n/config";
import type { PatchSection } from "@/lib/patches";

/**
 * Patch body. Layout "b" puts media beside the text it belongs to; layout "a" is a contents rail plus a wider
 * text column, used for notes without any media.
 */
export function PatchView({ lang, intro, sections, layout }: { lang: Lang; intro: string; sections: PatchSection[]; layout: "a" | "b" }) {
  return (
    <div className="pv" data-layout={layout}>
      <nav className="pv-toc" aria-label={lang === "ko" ? "이 문서" : "On this page"}>
        <b>{lang === "ko" ? "이 문서" : "On this page"}</b>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.title}
          </a>
        ))}
      </nav>

      <div className="pv-main md">
        {intro && <div className="pv-intro" dangerouslySetInnerHTML={{ __html: intro }} />}
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="ps">
            <h2>{s.title}</h2>
            <div className="ps-b" dangerouslySetInnerHTML={{ __html: s.html }} />
          </section>
        ))}
      </div>
    </div>
  );
}
