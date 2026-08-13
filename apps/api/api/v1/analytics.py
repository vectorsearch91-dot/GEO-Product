from collections import Counter, defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.models import Product, SimulationRun, SimulationResult

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/{product_id}")
def get_product_analytics(product_id: str, db: Session = Depends(get_db)):
    """
    Aggregated GEO analytics for the latest completed simulation.
    Overall surfacing score is IMPORTANCE-WEIGHTED across personas.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    latest_run = (
        db.query(SimulationRun)
        .filter(
            SimulationRun.product_id == product_id,
            SimulationRun.status == "COMPLETED",
        )
        .order_by(SimulationRun.created_at.desc())
        .first()
    )

    if not latest_run:
        return {
            "product_id": product_id,
            "has_data": False,
            "message": "No completed simulation found. Run an audit first.",
        }

    results = (
        db.query(SimulationResult)
        .filter(SimulationResult.simulation_run_id == latest_run.id)
        .all()
    )

    if not results:
        return {"product_id": product_id, "has_data": False, "message": "No results found."}

    total = len(results)

    # --- Per-persona scoring (raw) ---
    persona_groups = defaultdict(list)
    for r in results:
        persona_groups[r.persona_name].append(r)

    persona_stats = {}
    for pname, pres in persona_groups.items():
        raw_score = len([r for r in pres if r.is_product_surfaced]) / len(pres) * 100
        # Use importance_weight stored on the result row
        weight = pres[0].persona_importance_weight or 33.0
        persona_stats[pname] = {
            "score": round(raw_score, 1),
            "importance_weight": weight,
            "total_queries": len(pres),
            "surfaced_count": len([r for r in pres if r.is_product_surfaced]),
        }

    # --- Importance-weighted overall score ---
    total_weight = sum(v["importance_weight"] for v in persona_stats.values())
    if total_weight > 0:
        weighted_score = sum(
            v["score"] * v["importance_weight"] / total_weight
            for v in persona_stats.values()
        )
    else:
        surfaced = len([r for r in results if r.is_product_surfaced])
        weighted_score = surfaced / total * 100

    overall_score = round(weighted_score, 1)

    # --- By LLM ---
    llm_groups = defaultdict(list)
    for r in results:
        llm_groups[r.llm_display_name].append(r)

    by_llm = {
        name: round(len([r for r in res if r.is_product_surfaced]) / len(res) * 100, 1)
        for name, res in llm_groups.items()
    }

    # --- By persona (simplified for chart) ---
    by_persona = {
        pname: v["score"]
        for pname, v in persona_stats.items()
    }

    # --- Competitor share of voice ---
    comp_counter: Counter = Counter()
    for r in results:
        for c in (r.competitors_surfaced or []):
            comp_counter[c] += 1

    top_competitors = [
        {
            "name": name,
            "count": count,
            "share_of_voice": round(count / total * 100, 1),
        }
        for name, count in comp_counter.most_common(8)
    ]

    # --- Citation domains ---
    domain_counter: Counter = Counter()
    for r in results:
        for d in (r.cited_domains or []):
            domain_counter[d] += 1

    top_cited_domains = [
        {"domain": domain, "citations": count}
        for domain, count in domain_counter.most_common(8)
    ]

    return {
        "product_id": product_id,
        "has_data": True,
        "simulation_run_id": latest_run.id,
        "overall_surfacing_score": overall_score,    # importance-weighted
        "total_simulations": total,
        "surfaced_count": len([r for r in results if r.is_product_surfaced]),
        "by_llm": by_llm,
        "by_persona": by_persona,
        "persona_details": persona_stats,            # includes weight + raw score per persona
        "top_competitors": top_competitors,
        "top_cited_domains": top_cited_domains,
    }
