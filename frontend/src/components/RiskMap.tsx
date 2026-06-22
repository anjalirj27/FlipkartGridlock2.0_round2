"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPoint, RISK_COLORS, MetroStation } from "@/lib/api";

function makeIcon(color: string, size: number, pulse: boolean) {
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${pulse ? `<div class="radar-pulse" style="position:absolute;inset:0;border-radius:50%;background:${color};"></div>` : ""}
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.5);box-shadow:0 0 8px ${color}aa;"></div>
    </div>
  `;
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function makeMetroIcon() {
  const html = `
    <div style="width:14px;height:14px;background:#9B7BD4;transform:rotate(45deg);border:2px solid white;box-shadow:0 0 6px #9B7BD4cc;"></div>
  `;
  return L.divIcon({ html, className: "", iconSize: [14, 14], iconAnchor: [7, 7] });
}

function FlyTo({ point }: { point: MapPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo([point.latitude, point.longitude], 15, { duration: 0.8 });
  }, [point, map]);
  return null;
}

export default function RiskMap({
  points, activeTypes, selected, metroStations, showMetro,
}: { points: MapPoint[]; activeTypes: string[]; selected: MapPoint | null; metroStations?: MetroStation[]; showMetro?: boolean }) {
  const filtered = useMemo(
    () => points.filter((p) => activeTypes.includes(p.hotspot_type)),
    [points, activeTypes]
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <MapContainer
      center={[12.9716, 77.5946]}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      zoomControl={true}
    >
      {/* Detailed basemap (CARTO Voyager) - has road names, labels, POIs,
          much closer to a Google-Maps level of detail. Always rendered in
          its natural light styling. */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
      />
      {filtered.map((p) => {
        const color = RISK_COLORS[p.hotspot_type] || "#4FA8D8";
        const size = 10 + p.risk_score * 26;
        const isCritical = p.hotspot_type === "Critical Impact Zone" || p.hotspot_type === "Enforcement Failure Zone";
        return (
          <Marker key={p.hotspot_id} position={[p.latitude, p.longitude]} icon={makeIcon(color, size, isCritical)}>
            <Popup>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.hotspot_id}</div>
                <div style={{ fontSize: 11.5, color: "#7C8DA6", marginBottom: 6 }}>{p.hotspot_type}</div>
                <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span>Risk score</span><span style={{ fontFamily: "monospace", color: "#F2A93C" }}>{p.risk_score.toFixed(3)}</span>
                </div>
                <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span>Violations</span><span style={{ fontFamily: "monospace" }}>{p.violations.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>Nearest station</span><span>{p.nearest_station} ({p.distance_to_station_km}km)</span>
                </div>
                <div style={{ fontSize: 11.5, paddingTop: 6, borderTop: "1px solid #1F2F44", color: "#EDF1F6" }}>
                  {p.recommendation}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
      <FlyTo point={selected} />
      {showMetro && metroStations?.map((m) => (
        <Marker key={m.name} position={[m.latitude, m.longitude]} icon={makeMetroIcon()}>
          <Popup>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
            <div style={{ fontSize: 10.5, color: "#7C8DA6" }}>Namma Metro Station</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
