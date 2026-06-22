"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api, CitizenTrustResponse } from "@/lib/api";
import { PageHeader, Card, StatCard, Loading, ErrorBox , chartTooltipStyle } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

export default function TrustPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CitizenTrustResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.citizenTrust().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const buckets = [
    { name: "0.0-0.2", min: 0, max: 0.2 }, { name: "0.2-0.4", min: 0.2, max: 0.4 },
    { name: "0.4-0.6", min: 0.4, max: 0.6 }, { name: "0.6-0.8", min: 0.6, max: 0.8 },
    { name: "0.8-1.0", min: 0.8, max: 1.01 },
  ].map((b) => ({
    name: b.name,
    count: data.distribution.filter((d) => d.trust_score >= b.min && d.trust_score < b.max).length,
  }));

  const lowTrust = data.distribution.filter((d) => d.trust_score < 0.3).sort((a, b) => a.trust_score - b.trust_score).slice(0, 8);

  return (
    <div>
      <PageHeader title={t("trust.title")} subtitle={t("trust.subtitle")} icon={<ShieldCheck size={18} />} />

      <div className="px-8 grid grid-cols-2 gap-4">
        <StatCard label={t("trust.statAvg")} value={data.average_trust_score.toFixed(2)} sublabel={t("trust.statAvgSub")} color="var(--teal)" />
        <StatCard label={t("trust.statTracked")} value={String(data.distribution.length)} color="var(--cyan)" />
      </div>

      <div className="px-8 mt-5">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-4">{t("trust.distributionTitle")}</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2F44" vertical={false} />
              <XAxis dataKey="name" stroke="#7C8DA6" fontSize={11} />
              <YAxis stroke="#7C8DA6" fontSize={11} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {buckets.map((_, i) => <Cell key={i} fill="#3FA796" fillOpacity={0.5 + i * 0.12} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="px-8 mt-5 mb-8">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-3">{t("trust.lowestTitle")}</div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide border-b border-border">
                <th className="pb-2 font-normal">{t("common.hotspot")}</th>
                <th className="pb-2 font-normal text-right">{t("trust.trustScore")}</th>
                <th className="pb-2 font-normal text-right">{t("trust.rejected")}</th>
                <th className="pb-2 font-normal text-right">{t("trust.duplicate")}</th>
              </tr>
            </thead>
            <tbody>
              {lowTrust.map((h) => (
                <tr key={h.hotspot_id} className="border-b border-border/50 last:border-0">
                  <td className="py-2">{h.hotspot_id}</td>
                  <td className="py-2 text-right font-mono text-coral">{h.trust_score.toFixed(2)}</td>
                  <td className="py-2 text-right font-mono">{h.rejected}</td>
                  <td className="py-2 text-right font-mono">{h.duplicate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
