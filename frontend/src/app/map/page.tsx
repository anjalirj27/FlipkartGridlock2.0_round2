"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon, TramFront } from "lucide-react";
import { api, MapPoint, RISK_COLORS, MetroStation } from "@/lib/api";
import { PageHeader, Loading, ErrorBox, fmtNum } from "@/components/ui";
import { useTranslation } from "@/lib/useTranslation";

const RiskMap = dynamic(() => import("@/components/RiskMap"), { ssr: false });

const TYPES = ["Critical Impact Zone", "Enforcement Failure Zone", "Weekend Congestion Zone", "Daily Congestion Zone"];

export default function MapPage() {
  const { t: tr } = useTranslation();
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<string[]>(TYPES);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [search, setSearch] = useState("");
  const [metroStations, setMetroStations] = useState<MetroStation[]>([]);
  const [showMetro, setShowMetro] = useState(false);

  useEffect(() => {
    api.mapData().then(setPoints).catch((e) => setError(String(e)));
    api.locationIntelligence().then((d) => setMetroStations(d.metro_stations)).catch(() => {});
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!points) return <Loading />;

  const toggleType = (typ: string) =>
    setActiveTypes((cur) => (cur.includes(typ) ? cur.filter((x) => x !== typ) : [...cur, typ]));

  const filteredList = points
    .filter((p) => activeTypes.includes(p.hotspot_type))
    .filter((p) => p.hotspot_id.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={tr("map.title")} subtitle={tr("map.subtitle")} icon={<MapIcon size={18} />} />

      <div className="flex-1 flex px-8 pb-8 gap-4 min-h-0">
        <div className="w-72 shrink-0 flex flex-col gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("map.searchPlaceholder")}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-amber/50"
          />
          <div className="flex flex-col gap-1.5">
            {TYPES.map((typ) => (
              <button
                key={typ}
                onClick={() => toggleType(typ)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] border transition-colors text-left ${
                  activeTypes.includes(typ) ? "border-border bg-surface-2" : "border-border/50 bg-transparent opacity-40"
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RISK_COLORS[typ] }} />
                {tr(`hotspotTypes.${typ}`)}
              </button>
            ))}
            <button
              onClick={() => setShowMetro((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] border transition-colors text-left ${
                showMetro ? "border-purple/40 bg-purple/10 text-purple" : "border-border/50 bg-transparent opacity-60"
              }`}
            >
              <TramFront size={13} />
              {tr("map.metroStations")} ({metroStations.length})
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-surface border border-border rounded-lg">
            {filteredList.map((p) => (
              <button
                key={p.hotspot_id}
                onClick={() => setSelected(p)}
                className="w-full text-left px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-surface-2 transition-colors"
              >
                <div className="text-[12px] font-medium truncate">{p.hotspot_id}</div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10.5px] text-text-muted">{fmtNum(p.violations)}</span>
                  <span className="text-[10.5px] font-mono" style={{ color: RISK_COLORS[p.hotspot_type] }}>
                    {p.risk_score.toFixed(3)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 rounded-xl overflow-hidden border border-border min-h-0">
          <RiskMap points={points} activeTypes={activeTypes} selected={selected} metroStations={metroStations} showMetro={showMetro} />
        </div>
      </div>
    </div>
  );
}
