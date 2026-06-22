"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Radar } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceArea, Legend,
} from "recharts";
import { api, Summary, Hotspot, LivePredictionResponse, LivePredictionProfileResponse } from "@/lib/api";
import { PageHeader, Card, StatCard, Loading, ErrorBox, TrendBadge, fmtNum , chartTooltipStyle } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

const RISK_LABEL_COLOR: Record<string, string> = {
  Critical: "#E0524A", High: "#F2A93C", Moderate: "#4FA8D8", Low: "#3FA796",
};

export default function ForecastPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [predHotspot, setPredHotspot] = useState("");
  const [predHour, setPredHour] = useState(10);
  const [predWeekend, setPredWeekend] = useState(false);
  const [predEvent, setPredEvent] = useState(false);
  const [predResult, setPredResult] = useState<LivePredictionResponse | null>(null);
  const [profile, setProfile] = useState<LivePredictionProfileResponse | null>(null);

  useEffect(() => {
    Promise.all([api.summary(), api.hotspots()])
      .then(([s, h]) => {
        setSummary(s); setHotspots(h);
        const top = h.sort((a, b) => b.risk_score - a.risk_score)[0];
        setPredHotspot(top?.hotspot_id || "");
      })
      .catch((e) => setError(String(e)));
  }, []);

  const runPrediction = useCallback(() => {
    if (!predHotspot) return;
    api.livePrediction(predHotspot, predHour, predWeekend, predEvent).then(setPredResult);
    api.livePredictionProfile(predHotspot).then(setProfile);
  }, [predHotspot, predHour, predWeekend, predEvent]);

  useEffect(() => { runPrediction(); }, [runPrediction]);

  if (error) return <ErrorBox message={error} />;
  if (!summary || !hotspots) return <Loading />;

  const fi = Object.entries(summary.feature_importance)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.value - b.value);

  const trendCounts: Record<string, number> = {};
  hotspots.forEach((h) => { trendCounts[h.trend] = (trendCounts[h.trend] || 0) + 1; });

  const rising = hotspots.filter((h) => h.trend === "Rising").sort((a, b) => b.trend_pct - a.trend_pct).slice(0, 8);

  return (
    <div>
      <PageHeader title={t("forecast.title")} subtitle={t("forecast.subtitle")} icon={<TrendingUp size={18} />} />

      <div className="px-8 grid grid-cols-4 gap-4">
        <StatCard label={t("forecast.statR2")} value={summary.forecast_metrics.test_r2.toFixed(3)} color="var(--teal)" />
        <StatCard label={t("forecast.statMae")} value={summary.forecast_metrics.test_mae.toFixed(1)} sublabel={t("forecast.statMaeSub")} color="var(--cyan)" />
        <StatCard label={t("forecast.statBaseline")} value={`+${summary.forecast_metrics.improvement_pct.toFixed(1)}%`} color="var(--amber)" />
        <StatCard label={t("forecast.statGap")} value={(summary.forecast_metrics.train_r2 - summary.forecast_metrics.test_r2).toFixed(3)} sublabel={t("forecast.statGapSub")} color="var(--purple)" />
      </div>

      <div className="px-8 mt-5 grid grid-cols-3 gap-5">
        <Card className="col-span-2 p-5">
          <div className="text-[13px] font-medium text-text-muted mb-4">{t("forecast.featureImportanceTitle")}</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={fi} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2F44" horizontal={false} />
              <XAxis type="number" stroke="#7C8DA6" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="#7C8DA6" fontSize={11} width={130} />
              <Tooltip {...chartTooltipStyle} formatter={(v: any) => Number(v ?? 0).toFixed(3)} />
              <Bar dataKey="value" fill="#4FA8D8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-4">{t("forecast.trendDistTitle")}</div>
          <div className="space-y-3">
            {Object.entries(trendCounts).map(([trend, count]) => (
              <div key={trend} className="flex items-center justify-between">
                <TrendBadge trend={trend} />
                <span className="font-mono text-[13px]">{count}</span>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-text-muted mt-4 pt-4 border-t border-border leading-relaxed">
            {t("forecast.insufficientNote")}
          </p>
        </Card>
      </div>

      <div className="px-8 mt-5">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Radar size={15} className="text-amber" />
            <div className="text-[13px] font-medium">{t("forecast.liveTitle")}</div>
          </div>
          <p className="text-[11.5px] text-text-muted mb-4">
            {t("forecast.liveDesc")}
          </p>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <select value={predHotspot} onChange={(e) => setPredHotspot(e.target.value)}
                    className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-[12.5px] outline-none focus:border-amber/50 col-span-2">
              {hotspots.slice(0, 20).map((h) => (
                <option key={h.hotspot_id} value={h.hotspot_id}>{h.hotspot_id}</option>
              ))}
            </select>
            <select value={predHour} onChange={(e) => setPredHour(Number(e.target.value))}
                    className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-[12.5px] outline-none focus:border-amber/50">
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
            <div className="flex items-center gap-3 text-[12px]">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={predWeekend} onChange={(e) => setPredWeekend(e.target.checked)} className="accent-amber" />
                {t("forecast.weekend")}
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={predEvent} onChange={(e) => setPredEvent(e.target.checked)} className="accent-amber" />
                {t("forecast.eventDay")}
              </label>
            </div>
          </div>

          {predResult && (
            predResult.status === "Insufficient Data" ? (
              <div className="p-3 rounded-lg bg-surface-2 text-[12.5px] text-text-muted border border-border">
                <span className="text-coral font-medium">{t("forecast.insufficientLabel")}</span> {predResult.reason}
              </div>
            ) : (
              <div className="flex items-center gap-6 p-3 rounded-lg bg-surface-2 border border-border">
                <div>
                  <div className="text-[10.5px] text-text-muted uppercase">{t("forecast.expectedViolations")}</div>
                  <div className="font-mono text-xl">{predResult.expected_violations_this_hour}</div>
                </div>
                <div>
                  <div className="text-[10.5px] text-text-muted uppercase">{t("forecast.percentileLabel")}</div>
                  <div className="font-mono text-xl">{predResult.risk_percentile_for_this_location}%</div>
                </div>
                <div>
                  <div className="text-[10.5px] text-text-muted uppercase">{t("forecast.riskLevel")}</div>
                  <div className="text-xl font-semibold" style={{ color: RISK_LABEL_COLOR[predResult.risk_label || "Low"] }}>
                    {predResult.risk_label}
                  </div>
                </div>
              </div>
            )
          )}

          {profile && (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={buildProfileChartData(profile)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2F44" />
                  <XAxis dataKey="hour" stroke="#7C8DA6" fontSize={10.5} />
                  <YAxis stroke="#7C8DA6" fontSize={10.5} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} />
                  <ReferenceArea x1={Math.max(...profile.valid_hours) + 0.5} x2={23.5} fill="#7C8DA6" fillOpacity={0.08}
                                 label={{ value: "no data", position: "insideTopRight", fill: "#7C8DA6", fontSize: 10 }} />
                  <Line type="monotone" dataKey="Weekday" stroke="#27496D" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                  <Line type="monotone" dataKey="Weekend" stroke="#F2A93C" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="px-8 mt-5 mb-8">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-4">{t("forecast.risingTitle")}</div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide border-b border-border">
                <th className="pb-2 font-normal">{t("common.hotspot")}</th>
                <th className="pb-2 font-normal text-right">{t("forecast.current")}</th>
                <th className="pb-2 font-normal text-right">{t("forecast.forecastNextWeek")}</th>
                <th className="pb-2 font-normal text-right">{t("forecast.eventAdjusted")}</th>
                <th className="pb-2 font-normal text-right">{t("forecast.trend")}</th>
              </tr>
            </thead>
            <tbody>
              {rising.map((h) => (
                <tr key={h.hotspot_id} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 font-medium">{h.hotspot_id}</td>
                  <td className="py-2.5 text-right font-mono text-text-muted">{fmtNum(h.violations)}</td>
                  <td className="py-2.5 text-right font-mono">{fmtNum(h.forecasted_next_week_violations)}</td>
                  <td className="py-2.5 text-right font-mono text-amber">{fmtNum(h.forecasted_next_week_violations_event_adjusted)}</td>
                  <td className="py-2.5 text-right">+{h.trend_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function buildProfileChartData(profile: LivePredictionProfileResponse) {
  const byHour: Record<number, { hour: number; Weekday: number | null; Weekend: number | null }> = {};
  for (let h = 0; h < 24; h++) byHour[h] = { hour: h, Weekday: null, Weekend: null };
  profile.profile.forEach((p) => {
    byHour[p.hour][p.weekday_type] = p.expected_per_hour;
  });
  return Object.values(byHour);
}
