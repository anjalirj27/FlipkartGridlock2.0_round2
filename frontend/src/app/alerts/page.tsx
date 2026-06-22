"use client";

import { useEffect, useState } from "react";
import { Siren, ArrowRight } from "lucide-react";
import { PageHeader, Card, StatCard, Loading, ErrorBox, HotspotBadge } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

interface Alert {
  hotspot_id: string;
  hotspot_type: string;
  priority: "Critical" | "High" | "Medium";
  PCII: number;
  capacity_loss_pct: number;
  trend: string;
  trend_pct: number | null;
  recommended_action: string;
  nearest_station: string;
}

const PRIORITY_COLOR: Record<string, string> = { Critical: "#E0524A", High: "#F2A93C", Medium: "#4FA8D8" };
const PRIORITY_KEY: Record<string, string> = { Critical: "alerts.criticalPriority", High: "alerts.highPriority", Medium: "alerts.mediumPriority" };

export default function AlertsPage() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/alerts`)
      .then((r) => r.json())
      .then((d) => { setAlerts(d.alerts); setCounts(d.counts); })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!alerts || !counts) return <Loading />;

  const filtered = filter ? alerts.filter((a) => a.priority === filter) : alerts;

  return (
    <div>
      <PageHeader title={t("alerts.title")} subtitle={t("alerts.subtitle")} icon={<Siren size={18} />} />

      <div className="px-8 grid grid-cols-3 gap-4">
        {(["Critical", "High", "Medium"] as const).map((p) => (
          <button key={p} onClick={() => setFilter(filter === p ? null : p)} className="text-left">
            <StatCard label={t(PRIORITY_KEY[p])} value={String(counts[p])} sublabel={t("alerts.clickToFilter")} color={PRIORITY_COLOR[p]} />
          </button>
        ))}
      </div>

      <div className="px-8 mt-5 mb-8">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-medium text-text-muted">
              {filter ? `${t(PRIORITY_KEY[filter])} ${t("alerts.priorityAlerts")}` : t("alerts.allActive")} ({filtered.length})
            </div>
            {filter && <button onClick={() => setFilter(null)} className="text-[11.5px] text-amber hover:underline">{t("alerts.clearFilter")}</button>}
          </div>
          <div className="space-y-2">
            {filtered.map((a) => (
              <div key={a.hotspot_id} className="flex items-center gap-4 p-3 rounded-lg bg-surface-2 border border-border">
                <div className="w-2 h-12 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLOR[a.priority] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[13px] truncate">{a.hotspot_id}</span>
                    <HotspotBadge type={a.hotspot_type} />
                  </div>
                  <div className="text-[11.5px] text-text-muted">{a.recommended_action}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-[13px]" style={{ color: PRIORITY_COLOR[a.priority] }}>PCII {a.PCII}</div>
                  <div className="text-[10.5px] text-text-muted">{a.capacity_loss_pct}% {t("alerts.capacityLoss")}</div>
                </div>
                <div className="text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: `${PRIORITY_COLOR[a.priority]}1A`, color: PRIORITY_COLOR[a.priority] }}>
                  {t(PRIORITY_KEY[a.priority])}
                </div>
                <ArrowRight size={14} className="text-text-muted shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
