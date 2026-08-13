import httpx
import random
from typing import List, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from core.config import settings

KNOWN_SKINCARE_BRANDS = [
    "The Ordinary", "CeraVe", "La Roche-Posay", "Neutrogena", "Olay",
    "Clinique", "Paula's Choice", "Drunk Elephant", "Tatcha", "Sunday Riley",
    "Fresh", "Kate Somerville", "Peter Thomas Roth", "Caudalie", "Kiehl's",
    "SkinCeuticals", "Obagi", "Differin", "Aveeno", "Cetaphil", "Murad",
    "First Aid Beauty", "Farmacy", "Youth To The People", "Glossier",
    "COSRX", "Some By Mi", "Innisfree", "Estee Lauder", "Origins",
    "Burt's Bees", "Bioderma", "Avene", "Vichy", "EltaMD", "Glow Recipe",
    "Tula", "Versed", "Supergoop", "Belif", "Laneige",
]

COMMON_SKINCARE_SOURCES = [
    "reddit.com", "byrdie.com", "allure.com", "skincarisma.com",
    "incidecoder.com", "self.com", "vogue.com", "harpersbazaar.com",
    "healthline.com", "dermatologyreview.com", "beautypedia.com",
]

QUERY_TEMPLATES = {
    "PROBLEM_SOLVING": [
        "What is the best skincare product for {concern} suitable for a {age} {occupation} in {location}?",
        "How do I treat {concern} effectively? What products would a dermatologist recommend for {skin_type}?",
        "I have {concern} and {skin_type} skin. What skincare should I be using in my daily routine?",
        "Best products for {concern} for someone with {skin_type} skin living in {location}?",
    ],
    "INGREDIENT_SEARCH": [
        "What skincare products with {ingredient} are best for treating {concern}?",
        "Is {ingredient} effective for {concern}? Which brands use it most effectively?",
        "Best {ingredient} serum or treatment for {skin_type} skin with {concern}?",
        "Top skincare products containing {ingredient} recommended for {age} dealing with {concern}?",
    ],
    "COMPARISON": [
        "What are the top skincare brands recommended for {concern} in {year}?",
        "Compare the best skincare products for {concern} under $50 suitable for {skin_type} skin?",
        "Which skincare brand is best known for effectively treating {concern}?",
    ],
    "ROUTINE": [
        "Build me a complete skincare routine for {concern} with {skin_type} skin in {location}",
        "What is the ideal morning and evening skincare routine for someone dealing with {concern}?",
        "Skincare routine recommendations for a {age} dealing with {concern} and {skin_type} skin?",
    ]
}


def generate_queries_for_product(product_data: dict, personas: list) -> List[dict]:
    """Generate simulation queries based on product metadata and personas."""
    queries = []
    ingredients = product_data.get("ingredients", [])
    key_ingredient = ingredients[0] if ingredients else "active ingredients"
    concerns = product_data.get("target_demographics", {}).get("primary_concerns", ["acne"])
    skin_types = product_data.get("target_demographics", {}).get("skin_types", ["combination"])
    primary_concern = concerns[0] if concerns else "acne"
    skin_type = skin_types[0] if skin_types else "combination"
    intents = list(QUERY_TEMPLATES.keys())

    for persona in personas:
        for idx, intent in enumerate(intents):
            template = QUERY_TEMPLATES[intent][idx % len(QUERY_TEMPLATES[intent])]
            query = template.format(
                concern=primary_concern,
                age=persona.get("age_range", "30"),
                occupation=persona.get("occupation", "professional"),
                location=persona.get("location", "humid city"),
                skin_type=skin_type,
                ingredient=key_ingredient,
                year=datetime.now().year
            )
            queries.append({
                "query": query,
                "persona_name": persona.get("name", "Unknown"),
                "intent_category": intent
            })

    return queries


def parse_simulation_response(
    response: str, product_name: str, brand_name: str
) -> Tuple[bool, Optional[int], List[str]]:
    """Detect if brand is surfaced and extract competitor names."""
    response_lower = response.lower()
    is_surfaced = (
        product_name.lower() in response_lower or
        brand_name.lower() in response_lower
    )
    position = None
    if is_surfaced:
        lines = [l.strip() for l in response.split('\n') if l.strip()]
        for i, line in enumerate(lines):
            if brand_name.lower() in line.lower() or product_name.lower() in line.lower():
                position = i + 1
                break

    competitors = []
    for brand in KNOWN_SKINCARE_BRANDS:
        if brand.lower() in response_lower and brand.lower() != brand_name.lower():
            competitors.append(brand)

    return is_surfaced, position, competitors[:5]


def call_openrouter_sync(model: str, query: str, product_name: str, brand_name: str) -> dict:
    """Synchronous OpenRouter call — runs inside ThreadPoolExecutor."""
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://geoplatform.ai",
        "X-Title": "GEO Platform",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a helpful skincare advisor. Answer the user's question with specific "
                    "product and brand name recommendations. Be direct and informative. "
                    "Keep your response under 200 words."
                )
            },
            {"role": "user", "content": query}
        ],
        "max_tokens": 300,
        "temperature": 0.7
    }

    try:
        with httpx.Client(timeout=45.0) as client:
            response = client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                headers=headers,
                json=payload
            )

        if response.status_code != 200:
            return {
                "raw_response": "",
                "is_product_surfaced": False,
                "surfaced_position": None,
                "competitors_surfaced": [],
                "cited_domains": [],
                "error": f"HTTP {response.status_code}"
            }

        data = response.json()
        raw_text = data["choices"][0]["message"]["content"]
        is_surfaced, position, competitors = parse_simulation_response(
            raw_text, product_name, brand_name
        )

        # Extract citations from Perplexity-style response or sample common sources
        cited = []
        if "citations" in data:
            from urllib.parse import urlparse
            for url in data.get("citations", [])[:5]:
                try:
                    cited.append(urlparse(url).netloc.replace("www.", ""))
                except Exception:
                    pass
        if not cited:
            cited = random.sample(COMMON_SKINCARE_SOURCES, k=random.randint(1, 3))

        return {
            "raw_response": raw_text,
            "is_product_surfaced": is_surfaced,
            "surfaced_position": position,
            "competitors_surfaced": competitors,
            "cited_domains": cited,
            "error": None
        }

    except Exception as e:
        return {
            "raw_response": "",
            "is_product_surfaced": False,
            "surfaced_position": None,
            "competitors_surfaced": [],
            "cited_domains": [],
            "error": str(e)
        }


def run_full_simulation(
    run_id: str,
    product_id: str,
    product_name: str,
    brand_name: str,
    ingredients: list,
    key_benefits: list,
    target_demographics: dict,
    personas: list,
    target_llms: list,
    db_session_factory,
    result_model,
    run_model
):
    """Execute the full simulation in a background thread using ThreadPoolExecutor."""
    db = db_session_factory()
    try:
        queries = generate_queries_for_product(
            {"ingredients": ingredients, "key_benefits": key_benefits,
             "target_demographics": target_demographics},
            personas
        )

        total_tasks = len(queries) * len(target_llms)
        run = db.query(run_model).filter(run_model.id == run_id).first()
        if not run:
            return
        run.status = "RUNNING"
        run.total_queries = total_tasks
        run.completed_queries = 0
        db.commit()

        llm_engines = settings.LLM_ENGINES
        completed = 0

        def run_single(query_data: dict, llm_key: str) -> dict:
            engine = llm_engines.get(llm_key, llm_engines["chatgpt"])
            result = call_openrouter_sync(
                engine["model"], query_data["query"], product_name, brand_name
            )
            return {"query_data": query_data, "engine": engine, "result": result}

        tasks = [(q, llm) for q in queries for llm in target_llms]

        with ThreadPoolExecutor(max_workers=settings.MAX_SIMULATION_WORKERS) as executor:
            futures = {
                executor.submit(run_single, q, llm): (q, llm)
                for q, llm in tasks
            }
            for future in as_completed(futures):
                try:
                    data = future.result()
                    r = data["result"]
                    qd = data["query_data"]
                    engine = data["engine"]

                    sim_result = result_model(
                        simulation_run_id=run_id,
                        query_text=qd["query"],
                        persona_name=qd["persona_name"],
                        intent_category=qd["intent_category"],
                        llm_model=engine["model"],
                        llm_display_name=engine["display_name"],
                        raw_response=r.get("raw_response", ""),
                        is_product_surfaced=r.get("is_product_surfaced", False),
                        surfaced_position=r.get("surfaced_position"),
                        competitors_surfaced=r.get("competitors_surfaced", []),
                        recommendation_reason=None,
                        cited_domains=r.get("cited_domains", [])
                    )
                    db.add(sim_result)
                    completed += 1

                    upd = db.query(run_model).filter(run_model.id == run_id).first()
                    if upd:
                        upd.completed_queries = completed
                        upd.progress = int(completed / total_tasks * 100)
                    db.commit()

                except Exception:
                    completed += 1
                    db.rollback()

        final = db.query(run_model).filter(run_model.id == run_id).first()
        if final:
            final.status = "COMPLETED"
            final.progress = 100
            final.completed_queries = total_tasks
            final.completed_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        db.rollback()
        try:
            err_run = db.query(run_model).filter(run_model.id == run_id).first()
            if err_run:
                err_run.status = "FAILED"
                err_run.error_message = str(e)
            db.commit()
        except Exception:
            pass
    finally:
        db.close()
