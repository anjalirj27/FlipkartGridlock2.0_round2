"""
copilot.py
Gridlock AI Copilot - intentionally a GROUNDED, rule-based Q&A system, not a
generative LLM. Every answer is built from already-validated fields - this
guarantees zero hallucination risk and needs no external API key to deploy.
Pattern-matches a question to one of a curated set of intents.
"""
import pandas as pd

EXAMPLE_QUESTIONS = [
    "Which hotspot should I prioritize?",
    "Why is this location high risk?",
    "How much money can be saved?",
    "Show the top emerging hotspots",
    "How many patrol units are needed?",
    "What's next week's forecast?",
    "Which zones are critical?",
    "What's the total economic loss?",
]


def _match_intent(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ["prioritize", "focus on", "which hotspot should", "top priority"]):
        return "prioritize"
    if any(k in q for k in ["why is", "why does", "explain", "high risk", "risk breakdown"]):
        return "explain_risk"
    if any(k in q for k in ["save", "savings", "roi", "money"]):
        return "roi"
    if any(k in q for k in ["emerging", "rising", "growing"]):
        return "emerging"
    if any(k in q for k in ["patrol unit", "how many unit", "units needed"]):
        return "patrol_units"
    if any(k in q for k in ["forecast", "next week", "predict"]):
        return "forecast"
    if any(k in q for k in ["critical", "which zones"]):
        return "critical_zones"
    if any(k in q for k in ["economic loss", "cost", "loss"]):
        return "economic_loss"
    return "unknown"


def answer_question(question: str, hotspot_id: str | None, hotspots: pd.DataFrame, evolution: pd.DataFrame, roi: dict, summary: dict) -> dict:
    intent = _match_intent(question)

    if intent == "prioritize":
        top = hotspots.sort_values("risk_score", ascending=False).iloc[0]
        return {
            "intent": intent,
            "answer": f"Prioritize {top['hotspot_id']} - it has the highest risk score in the city "
                      f"(PCII {top['PCII']}, classified as {top['hotspot_type']}), with an estimated "
                      f"{top['capacity_loss_pct']:.0f}% road-capacity loss from illegal parking.",
            "data": {"hotspot_id": top["hotspot_id"], "PCII": float(top["PCII"]), "hotspot_type": top["hotspot_type"]},
        }

    if intent == "explain_risk":
        target = hotspots[hotspots["hotspot_id"] == hotspot_id] if hotspot_id else None
        if target is None or target.empty:
            target_row = hotspots.sort_values("risk_score", ascending=False).iloc[0]
        else:
            target_row = target.iloc[0]
        breakdown = target_row["risk_breakdown"]
        return {
            "intent": intent,
            "answer": f"{target_row['hotspot_id']} is high risk primarily because of "
                      f"{target_row['top_risk_driver']} - its risk-score contribution breakdown is "
                      f"{breakdown}, with {target_row['violations']:,} total recorded violations.",
            "data": {"hotspot_id": target_row["hotspot_id"], "risk_breakdown": breakdown, "top_risk_driver": target_row["top_risk_driver"]},
        }

    if intent == "roi":
        return {
            "intent": intent,
            "answer": f"Deploying the recommended {roi['units_used']} patrol units is estimated to cut "
                      f"annual economic loss from Rs. {roi['before_total_loss_rs']/1e7:.2f} crore to "
                      f"Rs. {roi['after_total_loss_rs']/1e7:.2f} crore - a savings of "
                      f"Rs. {roi['annual_savings_rs']/1e7:.2f} crore/year "
                      f"(~Rs. {roi['savings_per_unit_rs']:,.0f} per unit).",
            "data": roi,
        }

    if intent == "emerging":
        reliable = evolution[evolution["reliable"]].sort_values("pct_change", ascending=False).head(5)
        names = ", ".join(reliable["hotspot_id"].tolist())
        return {
            "intent": intent,
            "answer": f"Top emerging hotspots (reliability-filtered): {names}.",
            "data": reliable[["hotspot_id", "pct_change"]].to_dict(orient="records"),
        }

    if intent == "patrol_units":
        return {
            "intent": intent,
            "answer": f"{roi['units_used']} patrol units are recommended (covers "
                      f"{int(hotspots['patrol_allocated'].sum())} hotspots), out of "
                      f"{int(hotspots['units_required'].sum())} units needed for full city-wide coverage.",
            "data": {"units_used": roi["units_used"], "full_coverage_needed": int(hotspots["units_required"].sum())},
        }

    if intent == "forecast":
        rising = hotspots[hotspots["trend"] == "Rising"].sort_values("forecasted_next_week_violations", ascending=False)
        leader = rising.iloc[0] if len(rising) else hotspots.iloc[0]
        return {
            "intent": intent,
            "answer": f"{leader['hotspot_id']} has the highest forecasted volume next week: "
                      f"{int(leader['forecasted_next_week_violations'])} violations "
                      f"({leader['trend_pct']:+.1f}% trend).",
            "data": {"hotspot_id": leader["hotspot_id"], "forecasted_violations": int(leader["forecasted_next_week_violations"])},
        }

    if intent == "critical_zones":
        critical = hotspots[hotspots["hotspot_type"] == "Critical Impact Zone"]
        return {
            "intent": intent,
            "answer": f"{len(critical)} hotspots are classified as Critical Impact Zones, led by "
                      f"{critical.sort_values('risk_score', ascending=False).iloc[0]['hotspot_id']}.",
            "data": {"count": int(len(critical)), "hotspot_ids": critical["hotspot_id"].tolist()[:10]},
        }

    if intent == "economic_loss":
        return {
            "intent": intent,
            "answer": f"Estimated annual economic loss from parking violations: "
                      f"Rs. {summary['annualized_economic_loss_rs']/1e7:.2f} crore/year, with the top "
                      f"10 hotspots accounting for {summary['top10_loss_share_pct']:.1f}% of that total.",
            "data": {"annualized_economic_loss_rs": summary["annualized_economic_loss_rs"]},
        }

    return {
        "intent": "unknown",
        "answer": "I can answer questions about hotspot priority, risk explanations, ROI/savings, "
                  "emerging zones, patrol units, forecasts, critical zones, and economic loss - "
                  "all grounded in this platform's validated data. Try one of the example questions.",
        "data": {"example_questions": EXAMPLE_QUESTIONS},
    }
