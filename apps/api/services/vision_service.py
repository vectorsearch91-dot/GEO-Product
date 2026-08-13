import httpx
import json
import re
from typing import List
from core.config import settings


VISION_SYSTEM_PROMPT = (
    "You are an expert CPG Product Analyst. "
    "Analyze ALL provided product images simultaneously (front label, back ingredients, side claims). "
    "Extract complete, accurate structured data. Return ONLY valid JSON, no markdown."
)

VISION_USER_PROMPT = """Analyze these product images and return a JSON object with this exact structure:
{
  "product_name": "exact product title from label",
  "brand_name": "brand or manufacturer name",
  "category": "e.g. Skincare, Supplement, Haircare",
  "primary_description": "1-2 sentence summary of what this product does",
  "ingredients": ["ingredient1", "ingredient2"],
  "key_benefits": ["benefit1", "benefit2"],
  "target_demographics": {
    "age_range": "e.g. 25-40",
    "skin_types": ["oily", "acne-prone"],
    "primary_concerns": ["adult acne", "hyperpigmentation"],
    "climate_fit": "humid"
  },
  "pricing_tier": "Mass or Premium or Luxury",
  "personas": [
    {
      "name": "Urban Professional",
      "age_range": "28-35",
      "location": "humid city",
      "occupation": "working professional",
      "pain_points": ["adult acne", "busy schedule"]
    },
    {
      "name": "Eco-Conscious Shopper",
      "age_range": "25-38",
      "location": "suburban",
      "occupation": "health-conscious consumer",
      "pain_points": ["chemical-free options", "sustainable ingredients"]
    },
    {
      "name": "Budget Beauty Enthusiast",
      "age_range": "18-26",
      "location": "college town",
      "occupation": "student",
      "pain_points": ["affordable skincare", "hormonal acne"]
    }
  ]
}"""


async def extract_product_from_images(image_urls: List[str]) -> dict:
    """Extract structured product metadata from product images using GPT-4o Vision via OpenRouter."""
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not configured")

    content = [{"type": "text", "text": VISION_USER_PROMPT}]
    for url in image_urls:
        content.append({
            "type": "image_url",
            "image_url": {"url": url}
        })

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://geoplatform.ai",
        "X-Title": "GEO Platform",
        "Content-Type": "application/json"
    }

    payload = {
        "model": settings.VISION_MODEL,
        "messages": [
            {"role": "system", "content": VISION_SYSTEM_PROMPT},
            {"role": "user", "content": content}
        ],
        "max_tokens": 2000,
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload
        )

    if response.status_code != 200:
        raise Exception(f"Vision API error: {response.status_code} — {response.text[:300]}")

    data = response.json()
    raw_text = data["choices"][0]["message"]["content"]

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise Exception("Could not parse vision response as JSON")


def get_default_skincare_personas() -> list:
    return [
        {
            "name": "Urban Professional",
            "age_range": "28-35",
            "location": "humid city",
            "occupation": "working professional",
            "pain_points": ["adult acne", "busy schedule", "pollution damage"]
        },
        {
            "name": "Eco-Conscious Shopper",
            "age_range": "25-40",
            "location": "suburban",
            "occupation": "health-conscious consumer",
            "pain_points": ["natural ingredients", "sensitive skin", "sustainable beauty"]
        },
        {
            "name": "Budget Beauty Enthusiast",
            "age_range": "18-26",
            "location": "college town",
            "occupation": "student",
            "pain_points": ["affordable options", "hormonal acne", "simple routine"]
        }
    ]
