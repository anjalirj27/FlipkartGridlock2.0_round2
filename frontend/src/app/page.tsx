"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, TrendingUp, Route, IndianRupee, Radio } from "lucide-react";
import { api, Summary } from "@/lib/api";
import { Loading, ErrorBox, fmtNum, fmtCrore } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

function HeroIllustration() {
  return (
    <svg viewBox="0 0 600 360" className="w-full h-auto" fill="none">
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#F2A93C" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F2A93C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="300" cy="180" r="170" fill="url(#glow)" />
      <path d="M30 280 Q200 60 570 120" stroke="#27496D" strokeWidth="3" fill="none" opacity="0.7">
        <animate attributeName="opacity" values="0.7;0.4;0.7" dur="4s" repeatCount="indefinite" />
      </path>
      <path d="M60 40 Q250 220 560 260" stroke="#27496D" strokeWidth="3" fill="none" opacity="0.7">
        <animate attributeName="opacity" values="0.4;0.7;0.4" dur="4s" repeatCount="indefinite" />
      </path>
      <circle r="4" fill="#F2A93C">
        <animateMotion dur="6s" repeatCount="indefinite" path="M30 280 Q200 60 570 120" />
      </circle>
      <circle r="4" fill="#4FA8D8">
        <animateMotion dur="7s" repeatCount="indefinite" path="M60 40 Q250 220 560 260" />
      </circle>
      <path d="M300 10 L300 350" stroke="#1F2F44" strokeWidth="2" strokeDasharray="6 6" />
      <path d="M10 180 L590 180" stroke="#1F2F44" strokeWidth="2" strokeDasharray="6 6" />
      {[
        { x: 150, y: 110, r: 14, c: "#E0524A", pulse: true },
        { x: 420, y: 90, r: 10, c: "#F2A93C" },
        { x: 470, y: 230, r: 16, c: "#9B7BD4", pulse: true },
        { x: 200, y: 250, r: 8, c: "#4FA8D8" },
        { x: 320, y: 170, r: 22, c: "#E0524A", pulse: true },
        { x: 100, y: 230, r: 9, c: "#4FA8D8" },
      ].map((n, i) => (
        <g key={i}>
          {n.pulse && <circle cx={n.x} cy={n.y} r={n.r} fill={n.c} opacity="0.25">
            <animate attributeName="r" values={`${n.r};${n.r * 2.2};${n.r}`} dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
          </circle>}
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.c} stroke="white" strokeOpacity="0.4" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}

export default function HomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    api.summary().then(setSummary).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!summary) return <Loading />;

  const FEATURES = [
    { icon: MapPin, title: t("home.featDetectTitle"), desc: t("home.featDetectDesc"), href: "/map" },
    { icon: TrendingUp, title: t("home.featQuantifyTitle"), desc: t("home.featQuantifyDesc"), href: "/congestion" },
    { icon: Route, title: t("home.featEnforceTitle"), desc: t("home.featEnforceDesc"), href: "/patrol" },
    { icon: IndianRupee, title: t("home.featRoiTitle"), desc: t("home.featRoiDesc"), href: "/economic" },
  ];

  return (
    <div className="min-h-full">
      <div className="px-8 pt-10 pb-6 grid grid-cols-2 gap-10 items-center">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-md bg-amber/15 flex items-center justify-center">
              <Radio size={16} className="text-amber" />
            </div>
            <span className="text-[11px] font-mono tracking-wider text-text-muted">{t("home.badge")}</span>
          </div>
          <h1 className="font-display font-bold text-[34px] leading-tight tracking-tight mb-3">
            {t("home.title1")}<br />{t("home.title2")}
          </h1>
          <p className="text-[14px] text-text-muted leading-relaxed mb-6 max-w-md">
            {t("home.description")}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber text-bg font-semibold text-[14px] hover:bg-amber/90 transition-colors"
          >
            {t("home.enterDashboard")} <ArrowRight size={16} />
          </Link>
        </div>
        <HeroIllustration />
      </div>

      <div className="px-8 grid grid-cols-4 gap-4 py-6">
        <div className="text-center">
          <div className="font-mono text-2xl text-amber">{fmtNum(summary.total_records)}</div>
          <div className="text-[11px] text-text-muted mt-1">{t("home.statRecords")}</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl text-cyan">{summary.total_hotspots}</div>
          <div className="text-[11px] text-text-muted mt-1">{t("home.statHotspots")}</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl text-teal">{summary.forecast_metrics.test_r2.toFixed(3)}</div>
          <div className="text-[11px] text-text-muted mt-1">{t("home.statR2")}</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl text-coral">{fmtCrore(summary.annualized_economic_loss_rs)}</div>
          <div className="text-[11px] text-text-muted mt-1">{t("home.statLoss")}</div>
        </div>
      </div>

      <div className="px-8 py-8 grid grid-cols-4 gap-5">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Link key={f.title} href={f.href} className="bg-surface border border-border rounded-xl p-5 hover:border-amber/40 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center mb-3 group-hover:bg-amber/10 transition-colors">
                <Icon size={16} className="text-amber" />
              </div>
              <div className="font-display font-semibold text-[14px] mb-1.5">{f.title}</div>
              <div className="text-[12px] text-text-muted leading-relaxed">{f.desc}</div>
            </Link>
          );
        })}
      </div>

      <div className="px-8 py-6 pb-10">
        <div className="bg-surface border border-border rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="font-display font-semibold text-[16px] mb-1">{t("home.ctaTitle")}</div>
            <div className="text-[12.5px] text-text-muted">{t("home.ctaDesc")}</div>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/scenarios" className="px-4 py-2.5 rounded-lg border border-border text-[13px] hover:bg-surface-2 transition-colors">{t("home.ctaScenarios")}</Link>
            <Link href="/copilot" className="px-4 py-2.5 rounded-lg bg-amber text-bg font-medium text-[13px] hover:bg-amber/90 transition-colors">{t("home.ctaCopilot")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
