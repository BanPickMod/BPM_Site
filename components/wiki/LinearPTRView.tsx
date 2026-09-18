import Image from "next/image";
import { ptrDiffs } from "@/lib/bpmData";
import { ExternalLink } from "lucide-react";

export function LinearPTRView() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-9 text-slate-200 font-sans">
      {ptrDiffs.map((entry, idx) => (
        <article key={idx} className="space-y-2">
          {/* Icon if exists - placed directly above title */}
          {entry.icon && (
            <div className="pt-2 pb-1">
              <Image
                src={`/${entry.icon}?v=2`}
                alt={entry.title}
                width={entry.icon.includes("reactor-techlab") ? 110 : 48}
                height={entry.icon.includes("reactor-techlab") ? 50 : 44}
                className="object-contain"
                unoptimized
              />
            </div>
          )}

          {/* Section Header: bold title with colon */}
          <h3 className="text-[17px] font-bold text-white tracking-tight">
            {entry.title}:
          </h3>

          {/* Bulleted list of changes */}
          <ul className="space-y-1.5 pl-6 text-[15px] text-slate-200">
            {entry.changes.map((change, cIdx) => (
              <li key={cIdx} className="list-disc leading-relaxed">
                {change}
              </li>
            ))}
          </ul>

          {/* Optional Showcase link */}
          {entry.showcase && (
            <div className="pl-12 text-sm text-sky-400 flex items-center gap-2 pt-0.5">
              <span className="text-slate-300">◦ Showcase:</span>
              <a
                href={entry.showcase}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-sky-300 inline-flex items-center gap-1"
              >
                {entry.showcase}
                <ExternalLink className="w-3.5 h-3.5 inline" />
              </a>
            </div>
          )}

          {/* Reasoning in italics: exact style matching screenshot */}
          {entry.reasoning && (
            <p className="text-[14px] italic text-slate-400 leading-relaxed pt-1.5 pl-0">
              Reasoning: {entry.reasoning}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
