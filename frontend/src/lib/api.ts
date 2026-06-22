const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json();
}

export interface Summary {
  total_records: number;
  validated_records: number;
  excluded_records: number;
  date_min: string;
  date_max: string;
  total_hotspots: number;
  hotspot_type_counts: Record<string, number>;
  annualized_economic_loss_rs: number;
  top10_loss_share_pct: number;
  repeat_offender_count: number;
  avg_trust_score: number;
  forecast_metrics: {
    test_r2: number; test_mae: number; train_r2: number; baseline_mae: number; improvement_pct: number;
  };
  feature_importance: Record<string, number>;
  peak_hour: number;
  peak_hour_daily_avg: number;
  avg_economic_loss_per_violation_rs: number;
}

export interface Hotspot {
  hotspot_id: string;
  latitude: number;
  longitude: number;
  violations: number;
  unique_vehicles: number;
  risk_score: number;
  hotspot_type: string;
  recommendation: string;
  impact_score: number;
  trust_score: number;
  nearest_station: string;
  distance_to_station_km: number;
  forecasted_next_week_violations: number;
  forecasted_next_week_violations_event_adjusted: number;
  trend: string;
  trend_pct: number;
  top_risk_driver: string;
  annualized_economic_loss_rs: number;
  evolution_pct_change: number | null;
  evolution_reliable: boolean | null;
  avg_repeat_count: number;
  vehicles_seen_5plus_times: number;
  dominant_vehicle: string;
  dominant_police_station: string;
  PCII: number;
  capacity_loss_pct: number;
  dist_to_nearest_metro_km: number;
  near_metro: boolean;
  patrol_allocated: boolean;
}

export interface MapPoint {
  hotspot_id: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  PCII: number;
  hotspot_type: string;
  violations: number;
  recommendation: string;
  nearest_station: string;
  distance_to_station_km: number;
  capacity_loss_pct: number;
  near_metro: boolean;
}

export interface PatrolAllocationRow {
  hotspot_id: string;
  hotspot_type: string;
  risk_score: number;
  units_required: number;
  nearest_station: string;
  distance_to_station_km: number;
  patrol_allocated: boolean;
}

export interface PatrolAllocationResponse {
  budget: number;
  units_used: number;
  total_units_needed_for_full_coverage: number;
  hotspots_covered: number;
  coverage_pct: number;
  allocation: PatrolAllocationRow[];
}

export interface BudgetSensitivityPoint {
  patrol_units: number;
  coverage_pct: number;
}

export interface WhatIfHoursResponse {
  extra_hours: number;
  capture_pct: number;
  extension_start_hour: number;
  extension_end_hour: number;
  projected_additional_violations_per_day: number;
  projected_additional_violations_per_year: number;
  projected_additional_recoverable_loss_rs: number;
  note: string;
}

export interface EconomicLossResponse {
  total_annualized_rs: number;
  top10_loss_share_pct: number;
  by_hotspot: { hotspot_id: string; hotspot_type: string; annualized_economic_loss_rs: number }[];
}

export interface RepeatOffender {
  vehicle_number: string;
  total_violations: number;
  unique_hotspots: number;
  most_common_hotspot: string;
  dominant_vehicle_type: string;
  avg_impact_score: number;
  behavior_pattern: string;
}

export interface RepeatOffendersResponse {
  total_repeat_offenders: number;
  behavior_pattern_counts: Record<string, number>;
  top_offenders: RepeatOffender[];
}

export interface MultiLocationOffender {
  vehicle_number: string;
  total_violations: number;
  unique_hotspots_affected: number;
  total_impact_contribution: number;
}

export interface EvolutionRow {
  hotspot_id: string;
  first_half_avg_per_day: number;
  second_half_avg_per_day: number;
  pct_change: number;
  reliable: boolean;
}

export interface EvolutionResponse {
  city_trend: Record<string, number>;
  reliable_count: number;
  total_count: number;
  top_emerging: EvolutionRow[];
  top_declining: EvolutionRow[];
}

export interface CitizenTrustResponse {
  average_trust_score: number;
  distribution: { hotspot_id: string; trust_score: number; rejected: number; duplicate: number }[];
}

// ---------------- PHASE 2 TYPES ----------------

export interface RoadCapacityHotspot {
  hotspot_id: string;
  hotspot_type: string;
  violations: number;
  capacity_loss_pct: number;
  capacity_loss_pct_10min: number;
  capacity_loss_pct_15min: number;
  capacity_loss_pct_20min: number;
  avg_vehicle_width_m: number;
  PCII: number;
}

export interface RoadCapacityResponse {
  road_width_m: number;
  methodology: string;
  top_hotspots: RoadCapacityHotspot[];
}

export interface BeforeAfterMetrics {
  avg_capacity_loss_pct: number;
  avg_risk_score: number;
  critical_hotspot_count: number;
}

export interface BeforeAfterResponse {
  before: BeforeAfterMetrics;
  after: BeforeAfterMetrics;
}

export interface ROIResponse {
  before_total_loss_rs: number;
  after_total_loss_rs: number;
  annual_savings_rs: number;
  savings_per_unit_rs: number;
  units_used: number;
}

export interface MetroStation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface LocationIntelligenceResponse {
  metro_station_count: number;
  radius_km: number;
  hotspots_near_metro: number;
  total_hotspots: number;
  violations_share_near_metro_pct: number;
  avg_risk_near_metro: number;
  avg_risk_far_from_metro: number;
  metro_stations: MetroStation[];
}

export interface LivePredictionResponse {
  status: "OK" | "Insufficient Data";
  reason?: string;
  hotspot_id?: string;
  hour?: string;
  is_weekend?: boolean;
  is_event_day?: boolean;
  expected_violations_this_hour?: number;
  risk_percentile_for_this_location?: number;
  risk_label?: string;
}

export interface HourlyProfilePoint {
  hour: number;
  weekday_type: "Weekday" | "Weekend";
  expected_per_hour: number | null;
  risk_percentile: number | null;
  has_data: boolean;
}

export interface LivePredictionProfileResponse {
  hotspot_id: string;
  valid_hours: number[];
  profile: HourlyProfilePoint[];
}

export interface CongestionResult {
  capacity_loss_pct_used: number;
  capacity_loss_capped: boolean;
  capacity_loss_pct_actual: number;
  travel_time_ratio_without_illegal_parking: number;
  travel_time_ratio_with_illegal_parking: number | null;
  is_gridlock: boolean;
  extra_congestion_pct: number | null;
  indicative_speed_drop_pct: number;
}

export interface CongestionCurvePoint {
  vc_ratio: number;
  ratio_without: number;
  ratio_with: number;
}

export interface CongestionSimulatorResponse {
  hotspot_id: string;
  vc_ratio_background: number;
  result: CongestionResult;
  curve: CongestionCurvePoint[];
}

export const api = {
  summary: () => getJSON<Summary>("/api/summary"),
  hotspots: (params?: { hotspot_type?: string; min_risk?: number }) => {
    const qs = new URLSearchParams();
    if (params?.hotspot_type) qs.set("hotspot_type", params.hotspot_type);
    if (params?.min_risk !== undefined) qs.set("min_risk", String(params.min_risk));
    const q = qs.toString();
    return getJSON<Hotspot[]>(`/api/hotspots${q ? `?${q}` : ""}`);
  },
  hotspotDetail: (id: string) => getJSON<Hotspot>(`/api/hotspots/${encodeURIComponent(id)}`),
  mapData: () => getJSON<MapPoint[]>("/api/map-data"),
  featureImportance: () => getJSON<Record<string, number>>("/api/feature-importance"),
  patrolAllocation: (budget: number) => getJSON<PatrolAllocationResponse>(`/api/patrol-allocation?budget=${budget}`),
  budgetSensitivity: () => getJSON<BudgetSensitivityPoint[]>("/api/budget-sensitivity"),
  whatIfHours: (extraHours: number, capturePct: number) =>
    getJSON<WhatIfHoursResponse>(`/api/what-if/hours?extra_hours=${extraHours}&capture_pct=${capturePct}`),
  economicLoss: () => getJSON<EconomicLossResponse>("/api/economic-loss"),
  repeatOffenders: (limit = 50) => getJSON<RepeatOffendersResponse>(`/api/repeat-offenders?limit=${limit}`),
  multiLocationOffenders: (limit = 20) => getJSON<MultiLocationOffender[]>(`/api/multi-location-offenders?limit=${limit}`),
  evolution: () => getJSON<EvolutionResponse>("/api/evolution"),
  citizenTrust: () => getJSON<CitizenTrustResponse>("/api/citizen-trust"),
  // Phase 2
  roadCapacity: (limit = 15) => getJSON<RoadCapacityResponse>(`/api/road-capacity?limit=${limit}`),
  beforeAfter: () => getJSON<BeforeAfterResponse>("/api/before-after"),
  roi: () => getJSON<ROIResponse>("/api/roi"),
  locationIntelligence: () => getJSON<LocationIntelligenceResponse>("/api/location-intelligence"),
  livePrediction: (hotspotId: string, hour: number, isWeekend: boolean, isEventDay: boolean) =>
    getJSON<LivePredictionResponse>(
      `/api/live-prediction?hotspot_id=${encodeURIComponent(hotspotId)}&hour=${hour}&is_weekend=${isWeekend}&is_event_day=${isEventDay}`
    ),
  livePredictionProfile: (hotspotId: string) =>
    getJSON<LivePredictionProfileResponse>(`/api/live-prediction/profile?hotspot_id=${encodeURIComponent(hotspotId)}`),
  congestionSimulator: (hotspotId: string, vcRatio: number) =>
    getJSON<CongestionSimulatorResponse>(
      `/api/congestion-simulator?hotspot_id=${encodeURIComponent(hotspotId)}&vc_ratio=${vcRatio}`
    ),
};

export const RISK_COLORS: Record<string, string> = {
  "Critical Impact Zone": "#E0524A",
  "Enforcement Failure Zone": "#9B7BD4",
  "Weekend Congestion Zone": "#F2A93C",
  "Daily Congestion Zone": "#4FA8D8",
};
