"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Lang } from "@/lib/i18n/config";
import { buildSteps, type LobbyConfig } from "@/lib/content/guide";

const BANS = [0, 1, 3, 5] as const;

export function LobbySetup({ lang }: { lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [cfg, setCfg] = useState<LobbyConfig>({ bans: 3, snake: false, conv: true, obs: false });
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<LobbyConfig>) => {
    setCopied(false);
    setCfg((c) => {
      const next = { ...c, ...patch };
      if (next.bans < 3) next.snake = false;
      return next;
    });
  };

  const steps = buildSteps(cfg).map((s) => s[lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(steps.map((s, i) => `${i + 1}. ${s}`).join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="g1">
      <div className="g1-ctl">
        <div className="field">
          <span className="lbl" id="g1-bans">
            {t("밴 개수", "Ban count")}
          </span>
          <div className="seg" role="group" aria-labelledby="g1-bans">
            {BANS.map((n) => (
              <button key={n} type="button" aria-pressed={cfg.bans === n} onClick={() => set({ bans: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="tgl">
          <input type="checkbox" checked={cfg.snake} disabled={cfg.bans < 3} onChange={(e) => set({ snake: e.target.checked })} />
          <span className="sw" />
          <span>{t("스네이크 밴 (3밴 이상)", "Snake ban (3+ bans)")}</span>
        </label>
        <label className="tgl">
          <input type="checkbox" checked={cfg.conv} onChange={(e) => set({ conv: e.target.checked })} />
          <span className="sw" />
          <span>{t("편의성 모드", "Convenience Mode")}</span>
        </label>
        <label className="tgl">
          <input type="checkbox" checked={cfg.obs} onChange={(e) => set({ obs: e.target.checked })} />
          <span className="sw" />
          <span>{t("관전자(중계·심판) 포함", "Include observers (casters, referees)")}</span>
        </label>
      </div>

      <div className="g1-out">
        <h3 className="g3-q">{t("이 순서대로 따라 하세요", "Follow these steps")}</h3>
        <ol className="steps g3-steps">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <button className="btn btn-sec" type="button" onClick={copy}>
          {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
          <span>{copied ? t("복사됨", "Copied") : t("순서 복사", "Copy steps")}</span>
        </button>
      </div>
    </div>
  );
}
