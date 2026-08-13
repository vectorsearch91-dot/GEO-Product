from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import uuid4

from core.database import get_db
from models.models import Product, Organization
from services.vision_service import extract_product_from_images, get_default_skincare_personas

router = APIRouter(prefix="/products", tags=["products"])


class AnalyzeImagesRequest(BaseModel):
    image_urls: List[str]
    product_name: Optional[str] = None


class ConfirmProductRequest(BaseModel):
    name: str
    brand_name: str
    category: str = "Skincare"
    description: Optional[str] = None
    image_urls: List[str] = []
    ingredients: List[str] = []
    key_benefits: List[str] = []
    target_demographics: dict = {}
    pricing_tier: Optional[str] = None
    personas: List[dict] = []
    organization_name: Optional[str] = "Demo Organization"


@router.post("/analyze-images")
async def analyze_images(request: AnalyzeImagesRequest):
    """Analyze product images with GPT-4o Vision and extract structured metadata."""
    if not request.image_urls:
        raise HTTPException(status_code=400, detail="At least one image URL is required")
    try:
        extracted = await extract_product_from_images(request.image_urls)
        if not extracted.get("personas"):
            extracted["personas"] = get_default_skincare_personas()
        return {"success": True, "data": extracted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def create_product(request: ConfirmProductRequest, db: Session = Depends(get_db)):
    """Create a confirmed product in the database."""
    org = db.query(Organization).filter(
        Organization.name == (request.organization_name or "Demo Organization")
    ).first()
    if not org:
        org = Organization(
            id=str(uuid4()),
            name=request.organization_name or "Demo Organization"
        )
        db.add(org)
        db.flush()

    personas = request.personas if request.personas else get_default_skincare_personas()

    product = Product(
        id=str(uuid4()),
        organization_id=org.id,
        name=request.name,
        brand_name=request.brand_name,
        category=request.category,
        description=request.description,
        image_urls=request.image_urls,
        ingredients=request.ingredients,
        key_benefits=request.key_benefits,
        target_demographics=request.target_demographics,
        pricing_tier=request.pricing_tier,
        personas=personas
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"success": True, "product_id": product.id, "product": _product_dict(product)}


@router.get("/")
def list_products(db: Session = Depends(get_db)):
    """List all products ordered by newest first."""
    products = db.query(Product).order_by(Product.created_at.desc()).all()
    return {"products": [_product_dict(p) for p in products]}


@router.get("/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db)):
    """Get a single product by ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"product": _product_dict(product)}


@router.delete("/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    """Delete a product and all its simulation data."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"success": True}


def _product_dict(p: Product) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "brand_name": p.brand_name,
        "category": p.category,
        "description": p.description,
        "image_urls": p.image_urls or [],
        "ingredients": p.ingredients or [],
        "key_benefits": p.key_benefits or [],
        "target_demographics": p.target_demographics or {},
        "pricing_tier": p.pricing_tier,
        "personas": p.personas or [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
