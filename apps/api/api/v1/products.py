from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import uuid4

from core.database import get_db
from models.models import Product, Organization
from services.vision_service import extract_product_from_images
from services.persona_generator import generate_personas_with_gemini

router = APIRouter(prefix="/products", tags=["products"])

DEFAULT_PERSONAS = [
    {"name": "Urban Professional", "importance_weight": 50, "age_range": "28-35",
     "location": "Mumbai, Maharashtra", "occupation": "IT Professional",
     "lifestyle": "Busy office life, pollution exposure, health-conscious",
     "pain_points": ["adult acne", "busy schedule", "pollution damage"],
     "search_behavior": "Asks ChatGPT, reads Reddit India and Nykaa reviews"},
    {"name": "Eco-Conscious Shopper", "importance_weight": 30, "age_range": "25-40",
     "location": "Bengaluru, Karnataka", "occupation": "Health & wellness enthusiast",
     "lifestyle": "Active lifestyle, prefers natural ingredients, reads ingredient lists",
     "pain_points": ["natural ingredients", "sensitive skin", "sustainable beauty"],
     "search_behavior": "Reads ingredient blogs, Quora, watches YouTube skincare reviews"},
    {"name": "Budget Beauty Enthusiast", "importance_weight": 20, "age_range": "18-26",
     "location": "Delhi NCR", "occupation": "Student / Young professional",
     "lifestyle": "Budget-conscious, follows influencers, shops on Nykaa sales",
     "pain_points": ["affordable options", "hormonal acne", "simple routine"],
     "search_behavior": "Instagram reels, YouTube tutorials, Nykaa app recommendations"},
]


class AnalyzeImagesRequest(BaseModel):
    image_urls: List[str]


class GeneratePersonasRequest(BaseModel):
    product_name: str
    brand_name: str
    category: str = "Skincare"
    ingredients: List[str] = []
    key_benefits: List[str] = []


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
    """
    Step 1: GPT-4o Vision extracts product data from images.
    Step 2: Gemini generates 3 weighted Indian consumer personas.
    Both steps are combined into one response for the onboarding flow.
    """
    if not request.image_urls:
        raise HTTPException(status_code=400, detail="At least one image URL is required")

    try:
        extracted = await extract_product_from_images(request.image_urls)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision analysis failed: {e}")

    # Generate Gemini personas with importance weights
    try:
        personas, _ = await generate_personas_with_gemini(
            product_name=extracted.get("product_name", ""),
            brand_name=extracted.get("brand_name", ""),
            category=extracted.get("category", "Skincare"),
            ingredients=extracted.get("ingredients", []),
            benefits=extracted.get("key_benefits", []),
        )
        if personas:
            extracted["personas"] = personas
    except Exception:
        # Fallback to default personas if Gemini call fails
        if not extracted.get("personas"):
            extracted["personas"] = DEFAULT_PERSONAS

    return {"success": True, "data": extracted}


@router.post("/generate-personas")
async def generate_personas(request: GeneratePersonasRequest):
    """
    Call Gemini to generate 3 weighted Indian consumer personas for a product.
    Used for manual entry flow (no images) and can be called independently to refresh personas.
    """
    try:
        personas, raw = await generate_personas_with_gemini(
            product_name=request.product_name,
            brand_name=request.brand_name,
            category=request.category,
            ingredients=request.ingredients,
            benefits=request.key_benefits,
        )
        return {"success": True, "personas": personas}
    except Exception as e:
        # Return defaults on error so the UI never breaks
        return {"success": False, "personas": DEFAULT_PERSONAS, "error": str(e)}


@router.post("/")
def create_product(request: ConfirmProductRequest, db: Session = Depends(get_db)):
    """Save a confirmed product to the database."""
    org = db.query(Organization).filter(
        Organization.name == (request.organization_name or "Demo Organization")
    ).first()
    if not org:
        org = Organization(id=str(uuid4()), name=request.organization_name or "Demo Organization")
        db.add(org)
        db.flush()

    personas = request.personas if request.personas else DEFAULT_PERSONAS

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
        personas=personas,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"success": True, "product_id": product.id, "product": _product_dict(product)}


@router.get("/")
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.created_at.desc()).all()
    return {"products": [_product_dict(p) for p in products]}


@router.get("/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"product": _product_dict(product)}


@router.delete("/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
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
