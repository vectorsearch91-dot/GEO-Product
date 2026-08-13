from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db
from models.models import Product
from services.seeding_engine import generate_action_plan
from api.v1.analytics import get_product_analytics

router = APIRouter(prefix="/seeding", tags=["seeding"])


class GenerateActionPlanRequest(BaseModel):
    product_id: str


@router.post("/generate")
async def generate_plan(
    request: GenerateActionPlanRequest,
    db: Session = Depends(get_db)
):
    """Generate PR pitch, JSON-LD schema markup, and forum draft for a product."""
    product = db.query(Product).filter(Product.id == request.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product_data = {
        "name": product.name,
        "brand_name": product.brand_name,
        "ingredients": product.ingredients or [],
        "key_benefits": product.key_benefits or [],
    }

    analytics_data = get_product_analytics(request.product_id, db)

    try:
        plan = await generate_action_plan(product_data, analytics_data)
        return {"success": True, "action_plan": plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
