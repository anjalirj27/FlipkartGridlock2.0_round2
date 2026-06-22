"use client";

import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api, RepeatOffendersResponse, MultiLocationOffender } from "@/lib/api";
import { PageHeader, Card, StatCard, Loading, ErrorBox, fmtNum , chartTooltipStyle } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

const PIE_COLORS = ["#4FA8D8", "#F2A93C", "#E0524A"];

export default function OffendersPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<RepeatOffendersResponse | null>(null);
  const [multi, setMulti] = useState<MultiLocationOffender[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.repeatOffenders(15), api.multiLocationOffenders(10)])
      .then(([d, m]) => { setData(d); setMulti(m); })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data || !multi) return <Loading />;

  const pieData = Object.entries(data.behavior_pattern_counts).map(([name, value]) => ({ name, value }));
  const totalMultiImpact = multi.reduce((s, m) => s + m.total_impact_contribution, 0);

  return (
    <div>
      <PageHeader title={t("offenders.title")} subtitle={t("offenders.subtitle")} icon={<Car size={18} />} />

      <div className="px-8 grid grid-cols-3 gap-4">
        <StatCard label={t("offenders.statTotal")} value={fmtNum(data.total_repeat_offenders)} sublabel={t("offenders.statTotalSub")} color="var(--coral)" />
        <StatCard label={t("offenders.statSingle")} value={fmtNum(data.behavior_pattern_counts["Single-Location Habitual"] || 0)} sublabel={t("offenders.statSingleSub")} color="var(--cyan)" />
        <StatCard label={t("offenders.statMulti")} value={fmtNum(data.behavior_pattern_counts["Multi-Location Roamer"] || 0)} sublabel={t("offenders.statMultiSub")} color="var(--purple)" />
      </div>

      <div className="px-8 mt-5 grid grid-cols-3 gap-5">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-4">{t("offenders.distributionTitle")}</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip {...chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="col-span-2 p-5">
          <div className="text-[13px] font-medium text-text-muted mb-3">{t("offenders.topOffendersTitle")}</div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide border-b border-border">
                <th className="pb-2 font-normal">{t("offenders.vehicle")}</th>
                <th className="pb-2 font-normal text-right">{t("common.violations")}</th>
                <th className="pb-2 font-normal">{t("offenders.pattern")}</th>
                <th className="pb-2 font-normal">{t("offenders.mostCommonLocation")}</th>
              </tr>
            </thead>
            <tbody>
              {data.top_offenders.slice(0, 8).map((o) => (
                <tr key={o.vehicle_number} className="border-b border-border/50 last:border-0">
                  <td className="py-2 font-mono">{o.vehicle_number}</td>
                  <td className="py-2 text-right font-mono">{o.total_violations}</td>
                  <td className="py-2 text-text-muted">{o.behavior_pattern}</td>
                  <td className="py-2 text-text-muted truncate max-w-[200px]">{o.most_common_hotspot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="px-8 mt-5 mb-8">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-1">{t("offenders.multiTitle")}</div>
          <p className="text-[11.5px] text-text-muted mb-3">
            {t("offenders.multiDesc")}
          </p>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide border-b border-border">
                <th className="pb-2 font-normal">{t("offenders.vehicle")}</th>
                <th className="pb-2 font-normal text-right">{t("offenders.hotspotsAffected")}</th>
                <th className="pb-2 font-normal text-right">{t("offenders.impactContribution")}</th>
              </tr>
            </thead>
            <tbody>
              {multi.slice(0, 6).map((m) => (
                <tr key={m.vehicle_number} className="border-b border-border/50 last:border-0">
                  <td className="py-2 font-mono">{m.vehicle_number}</td>
                  <td className="py-2 text-right font-mono">{m.unique_hotspots_affected}</td>
                  <td className="py-2 text-right font-mono">{m.total_impact_contribution.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[11px] text-text-muted mt-3 pt-3 border-t border-border">
            {t("offenders.multiFooter1")} {multi.length} {t("offenders.multiFooter2")} {totalMultiImpact.toFixed(0)} {t("offenders.multiFooter3")}
          </div>
        </Card>
      </div>
    </div>
  );
}
