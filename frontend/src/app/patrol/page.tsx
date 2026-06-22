"use client";

import { useEffect, useState, useCallback } from "react";
import { Route } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api, PatrolAllocationResponse, BudgetSensitivityPoint, WhatIfHoursResponse, BeforeAfterResponse } from "@/lib/api";
import { PageHeader, Card, StatCard, Loading, ErrorBox, HotspotBadge, fmtNum, fmtLakh , chartTooltipStyle } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

export default function PatrolPage() {
  const { t } = useTranslation();
  const [budget, setBudget] = useState(50);
  const [allocation, setAllocation] = useState<PatrolAllocationResponse | null>(null);
  const [sensitivity, setSensitivity] = useState<BudgetSensitivityPoint[] | null>(null);
  const [beforeAfter, setBeforeAfter] = useState<BeforeAfterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [extraHours, setExtraHours] = useState(4);
  const [capturePct, setCapturePct] = useState(70);
  const [whatIf, setWhatIf] = useState<WhatIfHoursResponse | null>(null);

  useEffect(() => {
    api.budgetSensitivity().then(setSensitivity).catch((e) => setError(String(e)));
    api.beforeAfter().then(setBeforeAfter).catch((e) => setError(String(e)));
  }, []);

  const loadAllocation = useCallback((b: number) => {
    api.patrolAllocation(b).then(setAllocation).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => { loadAllocation(budget); }, [budget, loadAllocation]);

  useEffect(() => {
    api.whatIfHours(extraHours, capturePct).then(setWhatIf).catch((e) => setError(String(e)));
  }, [extraHours, capturePct]);

  if (error) return <ErrorBox message={error} />;
  if (!allocation || !sensitivity) return <Loading />;

  return (
    <div>
      <PageHeader title={t("patrol.title")} subtitle={t("patrol.subtitle")} icon={<Route size={18} />} />

      <div className="px-8 grid grid-cols-4 gap-4">
        <StatCard label={t("patrol.statBudget")} value={`${allocation.units_used} ${t("patrol.unitsSuffix")}`} sublabel={`${t("patrol.statBudgetSub").replace("{n}", String(allocation.total_units_needed_for_full_coverage))}`} color="var(--amber)" />
        <StatCard label={t("patrol.statCovered")} value={fmtNum(allocation.hotspots_covered)} color="var(--cyan)" />
        <StatCard label={t("patrol.statCoverage")} value={`${allocation.coverage_pct}%`} color="var(--teal)" />
        <StatCard label={t("patrol.statEfficiency")} value={`${(allocation.coverage_pct / (budget / allocation.total_units_needed_for_full_coverage * 100)).toFixed(1)}x`} sublabel={t("patrol.statEfficiencySub")} color="var(--purple)" />
      </div>

      <div className="px-8 mt-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-medium text-text-muted">{t("patrol.sliderTitle")}</div>
            <div className="font-mono text-amber text-[15px]">{budget} {t("patrol.unitsSuffix")}</div>
          </div>
          <input
            type="range" min={5} max={allocation.total_units_needed_for_full_coverage} value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full accent-amber"
          />
          <div className="mt-5" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sensitivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2F44" />
                <XAxis dataKey="patrol_units" stroke="#7C8DA6" fontSize={11} />
                <YAxis stroke="#7C8DA6" fontSize={11} unit="%" />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="coverage_pct" stroke="#4FA8D8" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="px-8 mt-5 grid grid-cols-3 gap-5">
        <Card className="col-span-2 p-5">
          <div className="text-[13px] font-medium text-text-muted mb-3">{t("patrol.allocatedTitle")}</div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide border-b border-border">
                <th className="pb-2 font-normal">{t("common.hotspot")}</th>
                <th className="pb-2 font-normal">{t("common.type")}</th>
                <th className="pb-2 font-normal text-right">{t("common.units")}</th>
                <th className="pb-2 font-normal text-right">{t("common.station")}</th>
              </tr>
            </thead>
            <tbody>
              {allocation.allocation.filter((a) => a.patrol_allocated).slice(0, 12).map((a) => (
                <tr key={a.hotspot_id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 font-medium">{a.hotspot_id}</td>
                  <td className="py-2"><HotspotBadge type={a.hotspot_type} /></td>
                  <td className="py-2 text-right font-mono">{a.units_required}</td>
                  <td className="py-2 text-right text-text-muted">{a.nearest_station}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-3">{t("patrol.whatIfTitle")}</div>
          <div className="text-[11.5px] text-text-muted mb-3">{t("patrol.whatIfDesc")}</div>

          <div className="mb-3">
            <div className="flex justify-between text-[12px] mb-1"><span>{t("patrol.extraHours")}</span><span className="font-mono text-amber">{extraHours}h</span></div>
            <input type="range" min={1} max={9} value={extraHours} onChange={(e) => setExtraHours(Number(e.target.value))} className="w-full accent-amber" />
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-[12px] mb-1"><span>{t("patrol.captureRate")}</span><span className="font-mono text-amber">{capturePct}%</span></div>
            <input type="range" min={10} max={100} value={capturePct} onChange={(e) => setCapturePct(Number(e.target.value))} className="w-full accent-amber" />
          </div>

          {whatIf && (
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex justify-between text-[12.5px]"><span className="text-text-muted">{t("patrol.extensionWindow")}</span><span className="font-mono">{whatIf.extension_start_hour}:00-{whatIf.extension_end_hour}:00</span></div>
              <div className="flex justify-between text-[12.5px]"><span className="text-text-muted">{t("patrol.extraViolationsDay")}</span><span className="font-mono">{fmtNum(whatIf.projected_additional_violations_per_day, 0)}</span></div>
              <div className="flex justify-between text-[12.5px]"><span className="text-text-muted">{t("patrol.extraViolationsYear")}</span><span className="font-mono">{fmtNum(whatIf.projected_additional_violations_per_year)}</span></div>
              <div className="flex justify-between text-[13px] font-medium"><span>{t("patrol.recoverableValue")}</span><span className="font-mono text-teal">{fmtLakh(whatIf.projected_additional_recoverable_loss_rs)}</span></div>
              <div className="text-[10.5px] text-text-muted italic pt-2">{whatIf.note}</div>
            </div>
          )}
        </Card>
      </div>

      {beforeAfter && (
        <div className="px-8 mt-5 mb-8">
          <Card className="p-5">
            <div className="text-[13px] font-medium text-text-muted mb-1">{t("patrol.beforeAfterTitle")}</div>
            <p className="text-[11.5px] text-text-muted mb-4">
              {t("patrol.beforeAfterDesc")}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface-2 rounded-lg p-3 border border-border">
                <div className="text-[10.5px] text-text-muted uppercase mb-2">{t("patrol.avgCapacityLoss")}</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg text-coral">{beforeAfter.before.avg_capacity_loss_pct}%</span>
                  <span className="text-text-muted">&rarr;</span>
                  <span className="font-mono text-lg text-teal">{beforeAfter.after.avg_capacity_loss_pct}%</span>
                </div>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 border border-border">
                <div className="text-[10.5px] text-text-muted uppercase mb-2">{t("patrol.avgRiskScore")}</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg text-coral">{beforeAfter.before.avg_risk_score}</span>
                  <span className="text-text-muted">&rarr;</span>
                  <span className="font-mono text-lg text-teal">{beforeAfter.after.avg_risk_score}</span>
                </div>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 border border-border">
                <div className="text-[10.5px] text-text-muted uppercase mb-2">{t("patrol.criticalHotspots")}</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg text-coral">{beforeAfter.before.critical_hotspot_count}</span>
                  <span className="text-text-muted">&rarr;</span>
                  <span className="font-mono text-lg text-teal">{beforeAfter.after.critical_hotspot_count}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
