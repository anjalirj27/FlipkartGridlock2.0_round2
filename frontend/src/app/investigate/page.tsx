"use client";

import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, MapPin, TrendingUp, Gauge, Route, IndianRupee, Check } from "lucide-react";
import { api, Hotspot, Summary } from "@/lib/api";
import { PageHeader, Card, Loading, ErrorBox, fmtNum, fmtCrore, HotspotBadge } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function InvestigatePage() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topHotspot, setTopHotspot] = useState<Hotspot | null>(null);
  const [congestion, setCongestion] = useState<{ result: Record<string, unknown> } | null>(null);
  const [roi, setRoi] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.summary(),
      api.hotspots(),
      fetch(`${API_BASE}/api/roi`).then((r) => r.json()),
    ]).then(([s, hotspots, roiData]) => {
      setSummary(s);
      const top = hotspots.sort((a, b) => b.risk_score - a.risk_score)[0];
      setTopHotspot(top);
      setRoi(roiData);
      fetch(`${API_BASE}/api/congestion-simulator?hotspot_id=${encodeURIComponent(top.hotspot_id)}&vc_ratio=0.7`)
        .then((r) => r.json()).then(setCongestion);
    }).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!summary || !topHotspot || !roi) return <Loading />;

  const STEPS = [
    { key: "detect", label: t("investigate.stepDetect"), icon: MapPin },
    { key: "forecast", label: t("investigate.stepForecast"), icon: TrendingUp },
    { key: "congestion", label: t("investigate.stepCongestion"), icon: Gauge },
    { key: "patrol", label: t("investigate.stepPatrol"), icon: Route },
    { key: "savings", label: t("investigate.stepSavings"), icon: IndianRupee },
  ];

  return (
    <div>
      <PageHeader title={t("investigate.title")} subtitle={t("investigate.subtitle")} icon={<Search size={18} />} />

      <div className="px-8 flex items-center gap-2 mb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center flex-1">
              <button onClick={() => setStep(i)} className="flex flex-col items-center gap-1.5 flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                  i < step ? "bg-teal border-teal text-white" : i === step ? "bg-amber border-amber text-bg" : "border-border text-text-muted"
                }`}>
                  {i < step ? <Check size={15} /> : <Icon size={15} />}
                </div>
                <span className={`text-[10px] ${i === step ? "text-text font-medium" : "text-text-muted"}`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mb-4 ${i < step ? "bg-teal" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>

      <div className="px-8 mt-6 mb-8">
        <Card className="p-6 min-h-[320px]">
          {step === 0 && (
            <div>
              <div className="text-[15px] font-semibold mb-3">{t("investigate.step1Title")}</div>
              <p className="text-[13px] text-text-muted leading-relaxed mb-4">
                {t("investigate.step1Text1")} <span className="text-text font-medium">{summary.total_hotspots}</span> {t("investigate.step1Text2")}
              </p>
              <div className="bg-surface-2 rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-[14px]">{topHotspot.hotspot_id}</span>
                  <HotspotBadge type={topHotspot.hotspot_type} />
                </div>
                <div className="text-[12.5px] text-text-muted">PCII {topHotspot.PCII} &middot; {fmtNum(topHotspot.violations)} {t("common.violations")} &middot; {topHotspot.nearest_station}</div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <div className="text-[15px] font-semibold mb-3">{t("investigate.step2Title")}</div>
              <p className="text-[13px] text-text-muted leading-relaxed mb-4">
                {t("investigate.step2Text1")} {summary.forecast_metrics.test_r2.toFixed(3)}{t("investigate.step2Text2")} {summary.forecast_metrics.improvement_pct.toFixed(1)}{t("investigate.step2Text3")} {topHotspot.hotspot_id}:
              </p>
              <div className="bg-surface-2 rounded-lg p-4 border border-border flex gap-8">
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step2ThisWeek")}</div><div className="font-mono text-lg">{fmtNum(topHotspot.violations)}</div></div>
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step2ForecastNext")}</div><div className="font-mono text-lg text-amber">{fmtNum(topHotspot.forecasted_next_week_violations)}</div></div>
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step2Trend")}</div><div className="font-mono text-lg">{topHotspot.trend}</div></div>
              </div>
            </div>
          )}
          {step === 2 && congestion && (
            <div>
              <div className="text-[15px] font-semibold mb-3">{t("investigate.step3Title")}</div>
              <p className="text-[13px] text-text-muted leading-relaxed mb-4">
                {t("investigate.step3Text")}
              </p>
              <div className="bg-surface-2 rounded-lg p-4 border border-border flex gap-8">
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step3CapacityLoss")}</div><div className="font-mono text-lg text-coral">{String(congestion.result.capacity_loss_pct_actual)}%</div></div>
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step3ExtraCongestion")}</div><div className="font-mono text-lg text-amber">+{String(congestion.result.extra_congestion_pct)}%</div></div>
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step3SpeedDrop")}</div><div className="font-mono text-lg">{String(congestion.result.indicative_speed_drop_pct)}%</div></div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <div className="text-[15px] font-semibold mb-3">{t("investigate.step4Title")}</div>
              <p className="text-[13px] text-text-muted leading-relaxed mb-4">
                {t("investigate.step4Text")}
              </p>
              <div className="bg-surface-2 rounded-lg p-4 border border-border flex gap-8">
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step4UnitsRecommended")}</div><div className="font-mono text-lg">{roi.units_used}</div></div>
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step4Coverage")}</div><div className="font-mono text-lg text-teal">27.3%</div></div>
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step4Cost")}</div><div className="font-mono text-lg">18%</div></div>
              </div>
            </div>
          )}
          {step === 4 && (
            <div>
              <div className="text-[15px] font-semibold mb-3">{t("investigate.step5Title")}</div>
              <p className="text-[13px] text-text-muted leading-relaxed mb-4">
                {t("investigate.step5Text")}
              </p>
              <div className="bg-surface-2 rounded-lg p-4 border border-border flex gap-8">
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step5CurrentLoss")}</div><div className="font-mono text-lg text-coral">{fmtCrore(roi.before_total_loss_rs)}</div></div>
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step5AfterPlan")}</div><div className="font-mono text-lg text-cyan">{fmtCrore(roi.after_total_loss_rs)}</div></div>
                <div><div className="text-[10.5px] text-text-muted uppercase">{t("investigate.step5Savings")}</div><div className="font-mono text-lg text-teal">{fmtCrore(roi.annual_savings_rs)}</div></div>
              </div>
              <p className="text-[12px] text-text-muted mt-4 italic">{t("investigate.step5Footer")}</p>
            </div>
          )}
        </Card>

        <div className="flex justify-between mt-4">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-[13px] disabled:opacity-30">
            <ChevronLeft size={14} /> {t("investigate.previous")}
          </button>
          <button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber text-bg font-medium text-[13px] disabled:opacity-30">
            {t("investigate.next")} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
