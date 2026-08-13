import threading
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import uuid4

from core.database import get_db, SessionLocal
from core.config import settings
from models.models import Product, SimulationRun, SimulationResult
from services.llm_runner import run_full_simulation

router = APIRouter(prefix="/simulations", tags=["simulations"])


class RunSimulationRequest(BaseModel):
    product_id: str
    target_llms: Optional[List[str]] = None
    queries_per_persona: Optional[int] = 4  # 1=Quick, 2=Standard, 4=Full


@router.post("/")
def start_simulation(
    request: RunSimulationRequest,
    db: Session = Depends(get_db)
):
    """Start a multi-LLM simulation for a product. Runs in a background thread."""
    product = db.query(Product).filter(Product.id == request.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    target_llms = request.target_llms or list(settings.LLM_ENGINES.keys())
    queries_per_persona = max(1, min(4, request.queries_per_persona or 4))

    run = SimulationRun(
        id=str(uuid4()),
        product_id=product.id,
        status="PENDING",
        target_llms=target_llms,
        progress=0
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    run_id = run.id

    # Capture data before spawning thread (avoids SQLAlchemy session issues)
    product_name = product.name
    brand_name = product.brand_name
    ingredients = list(product.ingredients or [])
    key_benefits = list(product.key_benefits or [])
    target_demographics = dict(product.target_demographics or {})
    personas = list(product.personas or [])

    def background_sim():
        run_full_simulation(
            run_id=run_id,
            product_id=product.id,
            product_name=product_name,
            brand_name=brand_name,
            ingredients=ingredients,
            key_benefits=key_benefits,
            target_demographics=target_demographics,
            personas=personas,
            target_llms=target_llms,
            queries_per_persona=queries_per_persona,
            db_session_factory=SessionLocal,
            result_model=SimulationResult,
            run_model=SimulationRun
        )

    thread = threading.Thread(target=background_sim, daemon=True)
    thread.start()

    return {
        "simulation_run_id": run_id,
        "status": "PENDING",
        "product_id": product.id,
        "target_llms": target_llms,
        "message": f"Simulation started — {len(personas) * len(target_llms) * 4} queries queued"
    }


@router.get("/{run_id}")
def get_simulation_status(run_id: str, db: Session = Depends(get_db)):
    """Get simulation status and real-time progress."""
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
        "target_llms": run.target_llms,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "error_message": run.error_message,
    }


@router.get("/product/{product_id}")
def get_product_simulations(product_id: str, db: Session = Depends(get_db)):
    """List all simulation runs for a product."""
    runs = db.query(SimulationRun).filter(
        SimulationRun.product_id == product_id
    ).order_by(SimulationRun.created_at.desc()).all()
    return {
        "runs": [
            {
                "id": r.id,
                "status": r.status,
                "progress": r.progress,
                "total_queries": r.total_queries,
                "completed_queries": r.completed_queries,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in runs
        ]
    }
