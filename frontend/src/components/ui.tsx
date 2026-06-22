import { ReactNode } from "react";
import { RISK_COLORS } from "@/lib/api";
import { useTranslation } from "@/lib/useTranslation";

export function PageHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: ReactNode }) {
  return (
    <div className="px-8 pt-7 pb-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-amber">
          {icon}
        </div>
        <div>
          <h1 className="font-display font-semibold text-[22px] leading-tight tracking-tight">{title}</h1>
          <p className="text-[13px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-elevated bg-surface border border-border rounded-xl ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label, value, sublabel, color = "var(--cyan)", mono = true,
}: { label: string; value: string; sublabel?: string; color?: string; mono?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-text-muted uppercase tracking-wide">{label}</div>
      <div
        className={`text-[26px] font-semibold mt-1.5 ${mono ? "font-mono" : "font-display"}`}
        style={{ color }}
      >
        {value}
      </div>
      {sublabel && <div className="text-[11.5px] text-text-muted mt-1">{sublabel}</div>}
    </Card>
  );
}

export function HotspotBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const color = RISK_COLORS[type] || "#7C8DA6";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {t(`hotspotTypes.${type}`)}
    </span>
  );
}

export function TrendBadge({ trend }: { trend: string }) {
  const { t } = useTranslation();
  const map: Record<string, { color: string; symbol: string }> = {
    Rising: { color: "#E0524A", symbol: "\u2191" },
    Falling: { color: "#3FA796", symbol: "\u2193" },
    Stable: { color: "#4FA8D8", symbol: "\u2192" },
    "Insufficient Data": { color: "#7C8DA6", symbol: "?" },
  };
  const m = map[trend] || map["Insufficient Data"];
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-mono font-medium" style={{ color: m.color }}>
      {m.symbol} {t(`trend.${trend}`)}
    </span>
  );
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-64 text-text-muted text-[13px] font-mono">
      <span className="w-2 h-2 rounded-full bg-amber radar-pulse mr-3" />
      {t("common.loading")}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="m-8 p-4 rounded-lg border border-coral/30 bg-coral/10 text-coral text-[13px]">
      {t("common.errorPrefix")} {message}. {t("common.errorSuffix")}
    </div>
  );
}

export function fmtNum(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

export function fmtCrore(rs: number) {
  return `Rs. ${(rs / 1e7).toFixed(2)} Cr`;
}

export function fmtLakh(rs: number) {
  return `Rs. ${(rs / 1e5).toFixed(1)} L`;
}

// Shared, theme-aware style for recharts <Tooltip>. Uses CSS vars so it
// flips correctly between light/dark instead of being hardcoded dark
// (which made the label text invisible in light mode).
export const chartTooltipStyle = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--text)",
  },
  labelStyle: { color: "var(--text)", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "var(--text)" },
};
