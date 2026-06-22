"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api, EvolutionResponse } from "@/lib/api";
import { PageHeader, Card, StatCard, Loading, ErrorBox , chartTooltipStyle } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

export default function EvolutionPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<EvolutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.evolution().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const trendData = Object.entries(data.city_trend).map(([month, value]) => ({ month, value }));
  const firstVal = trendData[0]?.value || 1;
  const lastVal = trendData[trendData.length - 1]?.value || 1;
  const pctChange = ((lastVal - firstVal) / firstVal) * 100;

  return (
    <div>
      <PageHeader title={t("evolution.title")} subtitle={t("evolution.subtitle")} icon={<History size={18} />} />

      <div className="px-8 grid grid-cols-3 gap-4">
        <StatCard label={t("evolution.statTrend")} value={`${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}%`} sublabel={t("evolution.statTrendSub")} color={pctChange >= 0 ? "var(--coral)" : "var(--teal)"} />
        <StatCard label={t("evolution.statReliable")} value={`${data.reliable_count} / ${data.total_count}`} sublabel={t("evolution.statReliableSub")} color="var(--cyan)" />
        <StatCard label={t("evolution.statTopEmerging")} value={data.top_emerging[0]?.hotspot_id.slice(0, 18) || "—"} sublabel={`+${data.top_emerging[0]?.pct_change.toFixed(1)}%`} color="var(--amber)" mono={false} />
      </div>

      <div className="px-8 mt-5">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-4">{t("evolution.chartTitle")}</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2F44" />
              <XAxis dataKey="month" stroke="#7C8DA6" fontSize={11} />
              <YAxis stroke="#7C8DA6" fontSize={11} />
              <Tooltip {...chartTooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#4FA8D8" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-text-muted mt-3 pt-3 border-t border-border">
            {t("evolution.chartFootnote")}
          </p>
        </Card>
      </div>

      <div className="px-8 mt-5 mb-8 grid grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-teal mb-3">{t("evolution.emergingTitle")}</div>
          <table className="w-full text-[12.5px]">
            <tbody>
              {data.top_emerging.slice(0, 8).map((e) => (
                <tr key={e.hotspot_id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 truncate max-w-[220px]">{e.hotspot_id}</td>
                  <td className="py-2 text-right font-mono text-teal">+{e.pct_change.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <div className="text-[13px] font-medium text-coral mb-3">{t("evolution.decliningTitle")}</div>
          <table className="w-full text-[12.5px]">
            <tbody>
              {data.top_declining.slice(0, 8).map((e) => (
                <tr key={e.hotspot_id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 truncate max-w-[220px]">{e.hotspot_id}</td>
                  <td className="py-2 text-right font-mono text-coral">{e.pct_change.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
