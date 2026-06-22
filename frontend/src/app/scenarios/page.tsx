"use client";

import { useState } from "react";
import { Theater, TramFront, CalendarDays, Store, AlertCircle } from "lucide-react";
import { PageHeader, Card, Loading, ErrorBox } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

const SCENARIOS = [
  { key: "metro_congestion", labelKey: "scenarios.metroLabel", icon: TramFront, color: "var(--purple)" },
  { key: "event_day", labelKey: "scenarios.eventLabel", icon: CalendarDays, color: "var(--amber)" },
  { key: "commercial_overflow", labelKey: "scenarios.commercialLabel", icon: Store, color: "var(--cyan)" },
];

interface ScenarioResult {
  scenario: string;
  description: string;
  event_name?: string;
  validated_adjustment_pct?: number;
  hotspots: Record<string, unknown>[];
}

export default function ScenariosPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (key: string) => {
    setActive(key);
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/scenarios/${key}`)
      .then((r) => r.json())
      .then((d) => { setResult(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  };

  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <PageHeader title={t("scenarios.title")} subtitle={t("scenarios.subtitle")} icon={<Theater size={18} />} />

      <div className="px-8 grid grid-cols-3 gap-4">
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => run(s.key)}
              className={`text-left bg-surface border rounded-xl p-5 transition-colors ${
                active === s.key ? "border-amber/50" : "border-border hover:border-border"
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center mb-3">
                <Icon size={16} style={{ color: s.color }} />
              </div>
              <div className="font-display font-semibold text-[14px]">{t(s.labelKey)}</div>
            </button>
          );
        })}
      </div>

      <div className="px-8 mt-5 mb-8">
        {!active && (
          <div className="text-center text-text-muted text-[13px] py-12">{t("scenarios.selectPrompt")}</div>
        )}
        {active && loading && <Loading />}
        {active && !loading && result && (
          <Card className="p-5">
            <div className="text-[14px] font-medium mb-1">{result.scenario}</div>
            <p className="text-[12px] text-text-muted mb-4 leading-relaxed flex items-start gap-2">
              {result.scenario.includes("approximated") && <AlertCircle size={14} className="text-amber shrink-0 mt-0.5" />}
              {result.description}
            </p>
            {result.event_name && (
              <div className="mb-4 text-[12px] font-mono text-amber">
                {t("scenarios.eventPrefix")} {result.event_name} ({t("scenarios.validatedSuffix")} +{result.validated_adjustment_pct}%)
              </div>
            )}
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide border-b border-border">
                  {result.hotspots[0] && Object.keys(result.hotspots[0]).map((k) => (
                    <th key={k} className="pb-2 font-normal">{k.replace(/_/g, " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.hotspots.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="py-2">{typeof v === "number" ? v.toLocaleString() : String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
