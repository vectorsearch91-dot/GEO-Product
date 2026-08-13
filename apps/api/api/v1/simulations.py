import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import uuid4

from core.database import get_db, SessionLocal
from core.config import settings
from models.models import Product, SimulationRun, SimulationResult, SimulationLog
from services.llm_runner import run_full_simulation

router = APIRouter(prefix="/simulations", tags=["simulations"])


class RunSimulationRequest(BaseModel):
    product_id: str
    target_llms: Optional[List[str]] = None
    queries_per_persona: Optional[int] = 2   # 1=Quick, 2=Standard, 4=Full


@router.post("/")
def start_simulation(
    request: RunSimulationRequest,
    db: Session = Depends(get_db)
):
    """
    Start a multi-LLM simulation for a product.
    Phase 1: Each selected LLM generates questions for each persona (India context, no brand name)
    Phase 2: Those questions are fired at the same LLM for product recommendations in India
    All API calls are logged to SimulationLog for full auditability.
    """
    product = db.query(Product).filter(Product.id == request.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    target_llms = request.target_llms or list(settings.LLM_ENGINES.keys())
    queries_per_persona = max(1, min(4, request.queries_per_persona or 2))
    personas = list(product.personas or [])

    if not personas:
        raise HTTPException(status_code=400, detail="Product has no personas. Please add personas before running an audit.")

    total_queries = len(target_llms) * len(personas) * queries_per_persona

    run = SimulationRun(
        id=str(uuid4()),
        product_id=product.id,
        status="PENDING",
        target_llms=target_llms,
        queries_per_persona=queries_per_persona,
        progress=0,
        total_queries=total_queries,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    run_id = run.id

    # Snapshot product data for the background thread (avoid SQLAlchemy detached instance issues)
    product_name = product.name
    brand_name = product.brand_name
    product_category = product.category or "Skincare"
    ingredients = list(product.ingredients or [])
    key_benefits = list(product.key_benefits or [])
    target_demographics = dict(product.target_demographics or {})

    def background_sim():
        run_full_simulation(
            run_id=run_id,
            product_id=product.id,
            product_name=product_name,
            brand_name=brand_name,
            product_category=product_category,
            ingredients=ingredients,
            key_benefits=key_benefits,
            target_demographics=target_demographics,
            personas=personas,
            target_llms=target_llms,
            queries_per_persona=queries_per_persona,
            db_session_factory=SessionLocal,
            result_model=SimulationResult,
            log_model=SimulationLog,
            run_model=SimulationRun,
        )

    thread = threading.Thread(target=background_sim, daemon=True)
    thread.start()

    return {
        "simulation_run_id": run_id,
        "status": "PENDING",
        "product_id": product.id,
        "target_llms": target_llms,
        "queries_per_persona": queries_per_persona,
        "total_queries": total_queries,
        "message": (
            f"Simulation started — {len(personas)} personas × {len(target_llms)} LLMs × "
            f"{queries_per_persona} questions = {total_queries} recommendation queries "
            f"(plus {len(target_llms) * len(personas)} question-generation calls)"
        ),
    }


@router.get("/{run_id}")
def get_simulation_status(run_id: str, db: Session = Depends(get_db)):
    """Real-time simulation status and progress."""
    run = db.query(SimulationRun).filter(SimulationRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {
        "simulation_run_id": run.id,
        "product_id": run.product_id,
        "status": run.status,
        "progress": run.progress,
        "total_queries": run.total_queries,
        "completed_queries": run.completed_queries,
        "queries_per_persona": run.queries_per_persona,
        "target_llms": run.target_llms,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "error_message": run.error_message,
    }


@router.get("/{run_id}/logs")
def get_simulation_logs(run_id: str, db: Session = Depends(get_db)):
    """Return all audit log entries for a simulation run."""
    run = db.query(SimulationRun).filter(SimulationRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Simulation not found")
    logs = (
        db.query(SimulationLog)
        .filter(SimulationLog.simulation_run_id == run_id)
        .order_by(SimulationLog.created_at)
        .all()
    )
    return {
        "run_id": run_id,
        "log_count": len(logs),
        "logs": [
            {
                "id": l.id,
                "step_type": l.step_type,
                "llm_model": l.llm_model,
                "llm_display_name": l.llm_display_name,
                "persona_name": l.persona_name,
                "persona_importance_weight": l.persona_importance_weight,
                "messages_sent": l.messages_sent,
                "raw_api_response": l.raw_api_response,
                "parsed_output": l.parsed_output,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
    }


@router.get("/product/{product_id}")
def get_product_simulations(product_id: str, db: Session = Depends(get_db)):
    """List all simulation runs for a product."""
    runs = (
        db.query(SimulationRun)
        .filter(SimulationRun.product_id == product_id)
        .order_by(SimulationRun.created_at.desc())
        .all()
    )
    return {
        "runs": [
            {
                "id": r.id,
                "status": r.status,
                "progress": r.progress,
                "total_queries": r.total_queries,
                "completed_queries": r.completed_queries,
                "queries_per_persona": r.queries_per_persona,
                "target_llms": r.target_llms,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in runs
        ]
    }
