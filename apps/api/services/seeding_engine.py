import httpx
import json
import re
from core.config import settings


async def generate_action_plan(product_data: dict, analytics_data: dict) -> dict:
    """Generate PR pitch, JSON-LD schema, and forum draft via OpenRouter."""

    name = product_data.get("name", "")
    brand = product_data.get("brand_name", "")
    ingredients = ", ".join(product_data.get("ingredients", [])[:5]) or "key active ingredients"
    benefits = ", ".join(product_data.get("key_benefits", [])[:4]) or "skin improvement"
    competitors = ", ".join(
        [c["name"] for c in analytics_data.get("top_competitors", [])[:3]]
    ) or "established competitors"
    sources = ", ".join(
        [d["domain"] for d in analytics_data.get("top_cited_domains", [])[:3]]
    ) or "top beauty sites"
    score = analytics_data.get("overall_surfacing_score", 0)

    prompt = f"""You are a Digital PR & GEO (Generative Engine Optimization) Strategist.

Product: {name} by {brand}
Key Ingredients: {ingredients}
Key Benefits: {benefits}
Current AI Surfacing Score: {score}%
Top AI-recommended competitors: {competitors}
Top LLM citation sources: {sources}

The brand has a low AI surfacing score because competitors are better represented on sites that LLMs use as RAG sources. Create a complete GEO Action Plan as JSON:

{{
  "pr_pitch_email": "Write a complete, professional 200-word pitch email to the editor of a top beauty publication like Byrdie or Allure. Ask them to include {brand} in their 'Best for [relevant concern]' listicle. Be compelling, specific, and human — not generic.",
  "schema_markup": "Write complete JSON-LD schema markup for the {name} product page. Include @context, @type:Product, name, brand, description, keywords (from ingredients), and offers. Format as a valid <script type='application/ld+json'> block.",
  "forum_draft": "Write a genuine, helpful 120-word Reddit-style comment for r/SkincareAddiction that organically mentions {brand} as a solution. Sound like a real user who discovered the product. Start with empathy for the problem, not with the brand name.",
  "priority_actions": [
    "Specific outreach action 1 with publication name",
    "Content placement action 2 with platform name",
    "Technical schema implementation step 3",
    "Community engagement step 4 with subreddit or forum"
  ]
}}

Return ONLY valid JSON. No markdown, no extra text."""

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://geoplatform.ai",
        "X-Title": "GEO Platform",
        "Content-Type": "application/json"
    }

    payload = {
        "model": settings.SEEDING_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2000,
        "temperature": 0.75,
        "response_format": {"type": "json_object"}
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload
        )

    if response.status_code != 200:
        raise Exception(f"Seeding API error: {response.status_code} — {response.text[:300]}")

    data = response.json()
    raw = data["choices"][0]["message"]["content"]

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        return {
            "pr_pitch_email": raw[:500],
            "schema_markup": "{}",
            "forum_draft": "See PR pitch above.",
            "priority_actions": [
                "Contact beauty editors at top citation sites",
                "Add JSON-LD Product schema to your product page",
                "Engage in r/SkincareAddiction and r/beauty communities",
                "Submit product for review to Byrdie, Allure, and Healthline"
            ]
        }
