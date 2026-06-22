"use client";

import { useEffect, useState, useCallback } from "react";
import { Gauge } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend } from "recharts";
import { api, Hotspot, CongestionSimulatorResponse } from "@/lib/api";
import { PageHeader, Card, StatCard, Loading, ErrorBox , chartTooltipStyle } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

export default function CongestionSimulatorPage() {
  const { t } = useTranslation();
  const [hotspots, setHotspots] = useState<Hotspot[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [vcRatio, setVcRatio] = useState(0.7);
  const [sim, setSim] = useState<CongestionSimulatorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.hotspots().then((h) => {
      const sorted = h.sort((a, b) => b.risk_score - a.risk_score).slice(0, 15);
      setHotspots(sorted);
      setSelected(sorted[0]?.hotspot_id || "");
    }).catch((e) => setError(String(e)));
  }, []);

  const loadSim = useCallback((hotspotId: string, vc: number) => {
    if (!hotspotId) return;
    api.congestionSimulator(hotspotId, vc).then(setSim).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => { loadSim(selected, vcRatio); }, [selected, vcRatio, loadSim]);

  if (error) return <ErrorBox message={error} />;
  if (!hotspots) return <Loading />;

  const currentRow = sim?.curve.find((p) => Math.abs(p.vc_ratio - vcRatio) < 0.02);

  return (
    <div>
      <PageHeader
        title={t("congestion.title")}
        subtitle={t("congestion.subtitle")}
        icon={<Gauge size={18} />}
      />

      <div className="px-8 grid grid-cols-3 gap-4">
        <Card className="p-4 col-span-2">
          <div className="text-[11px] text-text-muted uppercase tracking-wide mb-2">{t("congestion.selectHotspot")}</div>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-amber/50"
          >
            {hotspots.map((h) => (
              <option key={h.hotspot_id} value={h.hotspot_id}>{h.hotspot_id} (PCII {h.PCII})</option>
            ))}
          </select>
        </Card>
        <Card className="p-4">
          <div className="flex justify-between text-[11px] text-text-muted uppercase tracking-wide mb-2">
            <span>{t("congestion.trafficLoad")}</span>
            <span className="font-mono text-amber">{(vcRatio * 100).toFixed(0)}%</span>
          </div>
          <input type="range" min={0.1} max={1.0} step={0.05} value={vcRatio}
                 onChange={(e) => setVcRatio(Number(e.target.value))} className="w-full accent-amber" />
          <div className="text-[10.5px] text-text-muted mt-1">{t("congestion.trafficLoadSub")}</div>
        </Card>
      </div>

      {sim && (
        <>
          <div className="px-8 mt-5 grid grid-cols-4 gap-4">
            <StatCard label={t("congestion.statCapacityLoss")} value={`${sim.result.capacity_loss_pct_actual}%`}
                       sublabel={sim.result.capacity_loss_capped ? t("congestion.statCapacityLossSub1") : t("congestion.statCapacityLossSub2")} color="var(--coral)" />
            <StatCard label={t("congestion.statTimeNormal")} value={`${sim.result.travel_time_ratio_without_illegal_parking}x`}
                       sublabel={t("congestion.statTimeNormalSub")} color="var(--teal)" />
            <StatCard label={t("congestion.statTimeWith")}
                       value={sim.result.is_gridlock ? t("congestion.gridlock") : `${sim.result.travel_time_ratio_with_illegal_parking}x`}
                       sublabel={t("congestion.statTimeWithSub")} color="var(--coral)" />
            <StatCard label={t("congestion.statExtra")} value={sim.result.is_gridlock ? t("congestion.severe") : `+${sim.result.extra_congestion_pct}%`}
                       sublabel={`~${sim.result.indicative_speed_drop_pct}% ${t("congestion.speedDrop")}`} color="var(--amber)" />
          </div>

          <div className="px-8 mt-5 mb-8">
            <Card className="p-5">
              <div className="text-[13px] font-medium text-text-muted mb-4">
                {t("congestion.curveTitle")} - {selected}
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={sim.curve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2F44" />
                  <XAxis dataKey="vc_ratio" stroke="#7C8DA6" fontSize={11}
                         label={{ value: "Background Traffic Load (V/C)", position: "insideBottom", offset: -5, fill: "#7C8DA6", fontSize: 11 }} />
                  <YAxis stroke="#7C8DA6" fontSize={11}
                         label={{ value: "Travel Time Ratio (x free-flow)", angle: -90, position: "insideLeft", fill: "#7C8DA6", fontSize: 11 }} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="ratio_without" name="Without illegal parking" stroke="#3FA796" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="ratio_with" name="With illegal parking (this hotspot)" stroke="#E0524A" strokeWidth={2.5} dot={false} />
                  {currentRow && (
                    <ReferenceDot x={currentRow.vc_ratio} y={currentRow.ratio_with} r={6} fill="#E0524A" stroke="white" />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-text-muted mt-3 pt-3 border-t border-border leading-relaxed">
                {t("congestion.methodology")}
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
