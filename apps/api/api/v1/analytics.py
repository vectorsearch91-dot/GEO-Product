from collections import Counter
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.models import Product, SimulationRun, SimulationResult

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/{product_id}")
def get_product_analytics(product_id: str, db: Session = Depends(get_db)):
    """Return aggregated GEO analytics for a product's latest completed simulation."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    latest_run = (
        db.query(SimulationRun)
        .filter(
            SimulationRun.product_id == product_id,
            SimulationRun.status == "COMPLETED"
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
    surfaced = [r for r in results if r.is_product_surfaced]
    overall_score = round(len(surfaced) / total * 100, 1)

    def pct(subset):
        s = len([r for r in subset if r.is_product_surfaced])
        return round(s / len(subset) * 100, 1) if subset else 0.0

    by_llm = {
        name: pct([r for r in results if r.llm_display_name == name])
        for name in set(r.llm_display_name for r in results)
    }
    by_persona = {
        name: pct([r for r in results if r.persona_name == name])
        for name in set(r.persona_name for r in results)
    }
    by_intent = {
        intent: pct([r for r in results if r.intent_category == intent])
        for intent in set(r.intent_category for r in results)
    }

    comp_counter: Counter = Counter()
    for r in results:
        for c in (r.competitors_surfaced or []):
            comp_counter[c] += 1

    top_competitors = [
        {"name": name, "count": count, "share_of_voice": round(count / total * 100, 1)}
        for name, count in comp_counter.most_common(6)
    ]

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
        "overall_surfacing_score": overall_score,
        "total_simulations": total,
        "surfaced_count": len(surfaced),
        "by_llm": by_llm,
        "by_persona": by_persona,
        "by_intent": by_intent,
        "top_competitors": top_competitors,
        "top_cited_domains": top_cited_domains,
    }
