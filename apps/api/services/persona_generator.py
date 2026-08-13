import httpx
import json
import re
from core.config import settings

PERSONA_SYSTEM_PROMPT = (
    "You are a market research expert specializing in D2C consumer goods in India. "
    "Identify the most relevant Indian consumer personas for a given product. "
    "Be highly specific to the Indian market — cities, occupations, lifestyles, climate, and purchasing behavior. "
    "Return ONLY valid JSON, no markdown."
)


def build_persona_prompt(
    product_name: str, brand_name: str, category: str,
    ingredients: list, benefits: list
) -> str:
    ing = ", ".join(ingredients[:8]) if ingredients else "active ingredients"
    ben = ", ".join(benefits[:5]) if benefits else "product benefits"
    return f"""Analyze this {category} product and identify exactly 3 distinct consumer personas in India who would most benefit from it.

Product: {product_name} by {brand_name}
Category: {category}
Key Ingredients: {ing}
Key Benefits: {ben}

Requirements:
- Each persona must be realistic for the Indian consumer market
- Importance weights must sum to exactly 100
- Pain points must specifically relate to what this product addresses
- Location must be a real Indian city/region (e.g. Mumbai, Bengaluru, Delhi NCR, Chennai)
- Search behavior should reflect how this persona discovers products in India (Nykaa, Purplle, Instagram, YouTube, Reddit India, Quora)

Return ONLY this exact JSON:
{{
  "personas": [
    {{
      "name": "Short descriptive persona label",
      "importance_weight": 50,
      "age_range": "25-35",
      "location": "Mumbai, Maharashtra",
      "occupation": "IT Professional",
      "lifestyle": "Spends 10 hours/day in AC office, commutes through pollution daily, health-aware and Instagram-active",
      "pain_points": ["specific concern 1 related to product", "specific concern 2", "specific concern 3"],
      "search_behavior": "Asks ChatGPT for routines, browses Reddit India, reads Nykaa reviews before buying"
    }},
    {{
      "name": "Second persona label",
      "importance_weight": 30,
      "age_range": "...",
      "location": "...",
      "occupation": "...",
      "lifestyle": "...",
      "pain_points": ["...", "..."],
      "search_behavior": "..."
    }},
    {{
      "name": "Third persona label",
      "importance_weight": 20,
      "age_range": "...",
      "location": "...",
      "occupation": "...",
      "lifestyle": "...",
      "pain_points": ["...", "..."],
      "search_behavior": "..."
    }}
  ]
}}"""


async def generate_personas_with_gemini(
    product_name: str, brand_name: str, category: str,
    ingredients: list, benefits: list
) -> tuple:
    """
    Call Gemini via OpenRouter to generate 3 weighted Indian consumer personas.
    Returns: (personas_list, raw_api_response_str)
    """
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not configured")

    prompt = build_persona_prompt(product_name, brand_name, category, ingredients, benefits)
    messages = [
        {"role": "system", "content": PERSONA_SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://geoplatform.ai",
        "X-Title": "GEO Platform — Persona Generation",
        "Content-Type": "application/json"
    }
    payload = {
        "model": settings.PERSONA_MODEL,
        "messages": messages,
        "max_tokens": 1500,
        "temperature": 0.3,
        "response_format": {"type": "json_object"}
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload
        )

    if response.status_code != 200:
        raise Exception(
            f"Gemini persona API error {response.status_code}: {response.text[:400]}"
        )

    raw_response_str = response.text
    data = response.json()
    raw_text = data["choices"][0]["message"]["content"]

    # Parse JSON
    try:
        result = json.loads(raw_text)
        personas = result.get("personas", [])
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if match:
            result = json.loads(match.group())
            personas = result.get("personas", [])
        else:
            raise Exception("Could not parse Gemini persona response as JSON")

    # Normalize importance weights to sum exactly to 100
    if personas:
        total = sum(p.get("importance_weight", 0) for p in personas)
        if total > 0 and total != 100:
            for p in personas:
                p["importance_weight"] = round(p.get("importance_weight", 0) / total * 100)
        # Fix rounding drift
        diff = 100 - sum(p.get("importance_weight", 0) for p in personas)
        if diff != 0:
            idx = max(range(len(personas)), key=lambda i: personas[i].get("importance_weight", 0))
            personas[idx]["importance_weight"] = personas[idx].get("importance_weight", 0) + diff

    return personas, raw_response_str
