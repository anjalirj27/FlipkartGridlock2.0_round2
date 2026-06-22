"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, AlertTriangle, ArrowRight, Target, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { api, Summary, Hotspot, RISK_COLORS } from "@/lib/api";
import { PageHeader, Card, StatCard, Loading, ErrorBox, HotspotBadge, fmtNum, fmtCrore , chartTooltipStyle } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

interface DashboardData {
  highest_risk_hotspot: { hotspot_id: string; risk_score: number; PCII: number; hotspot_type: string; capacity_loss_pct: number };
  expected_next_week_risk: { hotspot_id: string; forecasted_violations: number; trend_pct: number };
  patrol_units_needed: { recommended_budget: number; full_coverage_needed: number; hotspots_covered_at_recommended: number };
  annual_savings_potential_rs: number;
  top_emerging_zone: { hotspot_id: string | null; pct_change: number | null };
}

interface EnforcementPlanRow {
  priority_rank: number; hotspot_id: string; hotspot_type: string; PCII: number;
  capacity_loss_pct: number; units_assigned: number; nearest_station: string; action: string; trend: string;
}

const PIPELINE = [
  { label: "Violation\nReports", built: true },
  { label: "DBSCAN\nClustering", built: true },
  { label: "Risk Scoring &\nCapacity Loss", built: true },
  { label: "XGBoost\nForecast", built: true },
  { label: "Patrol\nOptimization", built: true },
  { label: "Traffic\nImprovement", built: false },
];

export default function CommissionerDashboardPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [topHotspots, setTopHotspots] = useState<Hotspot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [plan, setPlan] = useState<EnforcementPlanRow[] | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.summary(),
      api.hotspots(),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/commissioner-dashboard`).then((r) => r.json()),
    ])
      .then(([s, h, d]) => {
        setSummary(s);
        setTopHotspots(h.sort((a, b) => b.risk_score - a.risk_score).slice(0, 6));
        setDashboard(d);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const generatePlan = () => {
    setShowPlan((v) => !v);
    if (!plan) {
      setPlanLoading(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/enforcement-plan?top_n=10`)
        .then((r) => r.json())
        .then((d) => { setPlan(d); setPlanLoading(false); });
    }
  };

  if (error) return <ErrorBox message={error} />;
  if (!summary || !dashboard) return <Loading />;

  const typeData = Object.entries(summary.hotspot_type_counts).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        icon={<LayoutDashboard size={18} />}
      />

      <div className="px-8">
        <Card className="p-4 border-amber/20 bg-amber/[0.04]">
          <div className="flex items-start gap-3">
            <Target size={16} className="text-amber mt-0.5 shrink-0" />
            <div className="text-[12.5px] text-text-muted leading-relaxed">
              <span className="text-text font-medium">{t("dashboard.problemStatementLabel")} </span>
              {t("dashboard.problemStatementText")}
            </div>
          </div>
        </Card>
      </div>

      <div className="px-8 grid grid-cols-5 gap-3 mt-5">
        <StatCard label={t("dashboard.statHighestRisk")} value={`PCII ${dashboard.highest_risk_hotspot.PCII}`}
                   sublabel={dashboard.highest_risk_hotspot.hotspot_id} color="var(--coral)" />
        <StatCard label={t("dashboard.statNextWeekRisk")} value={fmtNum(dashboard.expected_next_week_risk.forecasted_violations)}
                   sublabel={dashboard.expected_next_week_risk.hotspot_id} color="var(--amber)" />
        <StatCard label={t("dashboard.statPatrolUnits")} value={`${dashboard.patrol_units_needed.recommended_budget} / ${dashboard.patrol_units_needed.full_coverage_needed}`}
                   sublabel={t("dashboard.statPatrolUnitsSub")} color="var(--cyan)" />
        <StatCard label={t("dashboard.statSavings")} value={fmtCrore(dashboard.annual_savings_potential_rs)}
                   sublabel={t("dashboard.statSavingsSub")} color="var(--teal)" />
        <StatCard label={t("dashboard.statTopEmerging")} value={dashboard.top_emerging_zone.pct_change ? `+${dashboard.top_emerging_zone.pct_change}%` : "\u2014"}
                   sublabel={dashboard.top_emerging_zone.hotspot_id || ""} color="var(--purple)" mono={false} />
      </div>

      <div className="px-8 mt-5">
        <button
          onClick={generatePlan}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber text-bg font-semibold text-[14px] hover:bg-amber/90 transition-colors"
        >
          <Sparkles size={16} />
          {t("dashboard.generatePlan")}
          {showPlan ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showPlan && (
          <Card className="p-5 mt-3">
            {planLoading || !plan ? (
              <div className="text-center text-text-muted text-[13px] py-6">{t("dashboard.generatingPlan")}</div>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide border-b border-border">
                    <th className="pb-2 font-normal">#</th>
                    <th className="pb-2 font-normal">Hotspot</th>
                    <th className="pb-2 font-normal">Type</th>
                    <th className="pb-2 font-normal text-right">PCII</th>
                    <th className="pb-2 font-normal text-right">Units</th>
                    <th className="pb-2 font-normal">Station</th>
                    <th className="pb-2 font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((p) => (
                    <tr key={p.hotspot_id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 font-mono text-amber">{p.priority_rank}</td>
                      <td className="py-2 font-medium">{p.hotspot_id}</td>
                      <td className="py-2"><HotspotBadge type={p.hotspot_type} /></td>
                      <td className="py-2 text-right font-mono">{p.PCII}</td>
                      <td className="py-2 text-right font-mono">{p.units_assigned}</td>
                      <td className="py-2 text-text-muted">{p.nearest_station}</td>
                      <td className="py-2 text-text-muted">{p.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>

      <div className="px-8 mt-5 grid grid-cols-3 gap-5">
        <Card className="col-span-2 p-5">
          <div className="text-[13px] font-medium text-text-muted mb-4">{t("dashboard.classificationTitle")}</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={typeData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2F44" horizontal={false} />
              <XAxis type="number" stroke="#7C8DA6" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="#7C8DA6" fontSize={11} width={150} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {typeData.map((d) => (
                  <Cell key={d.name} fill={RISK_COLORS[d.name] || "#4FA8D8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-coral mb-3">
            <AlertTriangle size={15} />
            <div className="text-[13px] font-medium">{t("dashboard.dataQualityTitle")}</div>
          </div>
          <p className="text-[12.5px] text-text-muted leading-relaxed">
            {t("dashboard.dataQualityText1")}{" "}
            <span className="text-text font-medium">{summary.total_hotspots}</span> {t("dashboard.dataQualityText2")}
          </p>
          <div className="mt-4 pt-4 border-t border-border text-[12.5px] text-text-muted">
            {t("dashboard.avgTrustLabel")}{" "}
            <span className="font-mono text-text">{summary.avg_trust_score.toFixed(2)}</span>
          </div>
        </Card>
      </div>

      <div className="px-8 mt-5">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-1">{t("dashboard.twinTitle")}</div>
          <p className="text-[11.5px] text-text-muted mb-5">
            {t("dashboard.twinDesc")}
          </p>
          <div className="flex items-stretch overflow-x-auto pb-2">
            {PIPELINE.map((stage, i) => (
              <div key={stage.label} className="flex items-center shrink-0">
                <div
                  className={`w-32 h-20 rounded-xl flex items-center justify-center text-center px-2 text-[11.5px] font-medium whitespace-pre-line ${
                    stage.built ? "text-white" : "bg-surface-2 text-text-muted border border-dashed border-border"
                  }`}
                  style={stage.built ? { backgroundColor: "#27496D" } : undefined}
                >
                  {stage.label}
                </div>
                {i < PIPELINE.length - 1 && (
                  <ArrowRight size={18} className="text-amber mx-2 shrink-0" />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10.5px] text-text-muted">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#27496D" }} /> {t("dashboard.twinLegendBuilt")}</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-text-muted" /> {t("dashboard.twinLegendNext")}</div>
          </div>
        </Card>
      </div>

      <div className="px-8 mt-5 mb-8">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-medium text-text-muted">{t("dashboard.top6Title")}</div>
            <Link href="/map" className="text-[12px] text-amber flex items-center gap-1 hover:underline">
              View full map <ArrowRight size={12} />
            </Link>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide border-b border-border">
                <th className="pb-2 font-normal">Hotspot</th>
                <th className="pb-2 font-normal">Type</th>
                <th className="pb-2 font-normal text-right">Violations</th>
                <th className="pb-2 font-normal text-right">PCII</th>
                <th className="pb-2 font-normal text-right">Nearest Station</th>
              </tr>
            </thead>
            <tbody>
              {topHotspots.map((h) => (
                <tr key={h.hotspot_id} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 font-medium">{h.hotspot_id}</td>
                  <td className="py-2.5"><HotspotBadge type={h.hotspot_type} /></td>
                  <td className="py-2.5 text-right font-mono">{fmtNum(h.violations)}</td>
                  <td className="py-2.5 text-right font-mono text-amber">{h.PCII}</td>
                  <td className="py-2.5 text-right text-text-muted">{h.nearest_station}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
