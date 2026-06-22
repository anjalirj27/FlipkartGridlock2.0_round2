"use client";

import { useEffect, useState } from "react";
import { IndianRupee, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api, EconomicLossResponse, ROIResponse, RISK_COLORS } from "@/lib/api";
import { PageHeader, Card, StatCard, Loading, ErrorBox, fmtCrore, fmtLakh , chartTooltipStyle } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

export default function EconomicPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<EconomicLossResponse | null>(null);
  const [roi, setRoi] = useState<ROIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.economicLoss().then(setData).catch((e) => setError(String(e)));
    api.roi().then(setRoi).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const top10 = data.by_hotspot.slice(0, 10).map((h) => ({
    name: h.hotspot_id.replace("Cluster: ", "").replace("BTP0", "BTP-").slice(0, 22),
    value: h.annualized_economic_loss_rs / 1e5,
    type: h.hotspot_type,
  }));

  return (
    <div>
      <PageHeader title={t("economic.title")} subtitle={t("economic.subtitle")} icon={<IndianRupee size={18} />} />

      <div className="px-8 grid grid-cols-3 gap-4">
        <StatCard label={t("economic.statAnnualLoss")} value={fmtCrore(data.total_annualized_rs)} sublabel={t("economic.statAnnualLossSub")} color="var(--amber)" />
        <StatCard label={t("economic.statTop10")} value={`${data.top10_loss_share_pct.toFixed(1)}%`} sublabel={t("economic.statTop10Sub")} color="var(--coral)" />
        <StatCard label={t("economic.statAssumptions")} value={t("economic.assumptionsValue")} sublabel={t("economic.assumptionsSub")} color="var(--cyan)" mono={false} />
      </div>

      <div className="px-8 mt-5">
        <Card className="p-5">
          <div className="text-[13px] font-medium text-text-muted mb-4">{t("economic.chartTitle")}</div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top10} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2F44" vertical={false} />
              <XAxis dataKey="name" stroke="#7C8DA6" fontSize={10} angle={-30} textAnchor="end" height={70} interval={0} />
              <YAxis stroke="#7C8DA6" fontSize={11} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip {...chartTooltipStyle} formatter={(v: any) => `Rs. ${Number(v ?? 0).toFixed(1)}L`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {top10.map((d, i) => <Cell key={i} fill={RISK_COLORS[d.type] || "#4FA8D8"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {roi && (
        <div className="px-8 mt-5">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={15} className="text-teal" />
              <div className="text-[13px] font-medium">{t("economic.roiTitle")}</div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-surface-2 rounded-lg p-3 border border-border">
                <div className="text-[10.5px] text-text-muted uppercase mb-1.5">{t("economic.roiCurrentLoss")}</div>
                <div className="font-mono text-lg text-coral">{fmtCrore(roi.before_total_loss_rs)}</div>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 border border-border">
                <div className="text-[10.5px] text-text-muted uppercase mb-1.5">{t("economic.roiAfterPlan")}</div>
                <div className="font-mono text-lg text-cyan">{fmtCrore(roi.after_total_loss_rs)}</div>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 border border-border">
                <div className="text-[10.5px] text-text-muted uppercase mb-1.5">{t("economic.roiSavings")}</div>
                <div className="font-mono text-lg text-teal">{fmtCrore(roi.annual_savings_rs)}</div>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 border border-border">
                <div className="text-[10.5px] text-text-muted uppercase mb-1.5">{t("economic.roiPerUnit")}</div>
                <div className="font-mono text-lg text-amber">{fmtLakh(roi.savings_per_unit_rs)}</div>
              </div>
            </div>
            <p className="text-[11px] text-text-muted mt-3 italic">
              {t("economic.roiDisclaimer")}
            </p>
          </Card>
        </div>
      )}

      <div className="px-8 mt-5 mb-8">
        <Card className="p-5 border-amber/20">
          <div className="text-[13px] font-medium mb-2">{t("economic.scopeNoteTitle")}</div>
          <p className="text-[12.5px] text-text-muted leading-relaxed">
            {t("economic.scopeNoteText1")} <em>{t("economic.scopeNoteAll")}</em> {t("economic.scopeNoteText2")}{" "}
            <span className="text-text font-medium">{fmtCrore(data.total_annualized_rs)}/year</span>. {t("economic.scopeNoteText3")}
          </p>
        </Card>
      </div>
    </div>
  );
}
