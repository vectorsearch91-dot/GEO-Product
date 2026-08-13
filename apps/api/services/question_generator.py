import httpx
import json
import re
from typing import List, Tuple


def build_question_gen_system_prompt(product_category: str) -> str:
    return (
        f"You are simulating authentic Indian consumer search behavior for {product_category} products. "
        "Generate realistic questions a person with the given profile would ask an AI assistant when looking for solutions. "
        "Questions must be about the consumer's PROBLEM or NEED — never mention any brand or product name. "
        "Make questions sound natural and specific to India. "
        "Return ONLY a valid JSON array of question strings — no markdown, no explanation."
    )


def build_question_gen_user_prompt(
    persona: dict, product_category: str, key_ingredients: list, n_questions: int
) -> str:
    pain = ", ".join(persona.get("pain_points", ["skin concerns"]))
    ing = ", ".join(key_ingredients[:3]) if key_ingredients else "specialized active ingredients"
    return f"""You are roleplaying as this Indian consumer:

Profile:
- Type: {persona['name']}
- Age: {persona.get('age_range', '25-35')}
- Location: {persona.get('location', 'India')}
- Occupation: {persona.get('occupation', 'professional')}
- Lifestyle: {persona.get('lifestyle', 'busy urban professional')}
- Main Concerns: {pain}
- How you search: {persona.get('search_behavior', 'searches online, reads reviews')}

Generate exactly {n_questions} questions you would ask this AI assistant when searching for solutions to your concerns.

Rules:
1. Ask about your PROBLEM or NEED — never mention any brand name or specific product
2. Use natural Indian English (how people in India actually type questions)
3. Questions should be answerable using {product_category} products, especially those with ingredients like {ing}
4. Mix question types: some problem-focused, some ingredient-focused, some asking for comparisons or routines
5. Include India-specific context: humidity, pollution, Indian skin tones, available in India, Nykaa/Amazon.in
6. Each question must be unique and specific to your pain points

Return ONLY a JSON array of exactly {n_questions} question strings:
["question 1", "question 2"]"""


def build_recommendation_system_prompt(persona: dict, product_category: str) -> str:
    return (
        f"You are a knowledgeable {product_category} advisor helping Indian consumers. "
        f"You are speaking with: {persona.get('name', 'a consumer')} — "
        f"{persona.get('age_range', '')} from {persona.get('location', 'India')}, "
        f"{persona.get('occupation', '')}. "
        "Recommend 4-6 specific products available in India. "
        "Include the exact brand name and product name for each recommendation. "
        "Consider Indian climate, skin types, and product availability on Nykaa, Purplle, or Amazon.in. "
        "Be specific and direct with your recommendations."
    )


def build_recommendation_user_prompt(question: str, product_category: str) -> str:
    return (
        f"{question}\n\n"
        f"Please recommend specific {product_category} products available in India that would help. "
        "List each product with its brand name, product name, and a brief reason why it works for this concern."
    )


def generate_questions_sync(
    model: str,
    persona: dict,
    product_category: str,
    key_ingredients: list,
    n_questions: int,
    api_key: str,
    base_url: str
) -> Tuple[List[str], list, str]:
    """
    Generate N questions using the target LLM for a given persona.
    Returns: (questions_list, messages_sent, raw_api_response_str)
    Context injected: persona profile, product category, key ingredients, India
    """
    system_msg = build_question_gen_system_prompt(product_category)
    user_msg = build_question_gen_user_prompt(persona, product_category, key_ingredients, n_questions)
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg}
    ]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://geoplatform.ai",
        "X-Title": "GEO Platform — Question Generation",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 600,
        "temperature": 0.8   # Higher temp = more diverse, realistic question variety
    }

    try:
        with httpx.Client(timeout=45.0) as client:
            response = client.post(f"{base_url}/chat/completions", headers=headers, json=payload)

        raw_response_str = response.text

        if response.status_code != 200:
            return [], messages, raw_response_str

        data = response.json()
        raw_text = data["choices"][0]["message"]["content"]

        # Try direct JSON parse
        try:
            parsed = json.loads(raw_text)
            if isinstance(parsed, list):
                return [str(q).strip() for q in parsed[:n_questions]], messages, raw_response_str
            if isinstance(parsed, dict) and "questions" in parsed:
                return [str(q).strip() for q in parsed["questions"][:n_questions]], messages, raw_response_str
        except json.JSONDecodeError:
            pass

        # Extract JSON array from text
        match = re.search(r'\[.*?\]', raw_text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
                return [str(q).strip() for q in parsed[:n_questions]], messages, raw_response_str
            except Exception:
                pass

        # Fallback: extract lines containing question marks
        lines = [
            l.strip().strip('"\'').strip('- ').strip()
            for l in raw_text.split('\n')
            if '?' in l and len(l.strip()) > 15
        ]
        return lines[:n_questions], messages, raw_response_str

    except Exception as e:
        return [], messages, str(e)


def query_for_recommendations_sync(
    model: str,
    question: str,
    persona: dict,
    product_category: str,
    api_key: str,
    base_url: str
) -> Tuple[str, list, str]:
    """
    Ask the target LLM to recommend products in India for a given question.
    Returns: (response_text, messages_sent, raw_api_response_str)
    Context injected: persona profile, India, product category
    """
    system_msg = build_recommendation_system_prompt(persona, product_category)
    user_msg = build_recommendation_user_prompt(question, product_category)
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg}
    ]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://geoplatform.ai",
        "X-Title": "GEO Platform — Recommendation Query",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 400,
        "temperature": 0.7
    }

    try:
        with httpx.Client(timeout=45.0) as client:
            response = client.post(f"{base_url}/chat/completions", headers=headers, json=payload)

        raw_response_str = response.text

        if response.status_code != 200:
            return "", messages, raw_response_str

        data = response.json()
        text = data["choices"][0]["message"]["content"]
        return text, messages, raw_response_str

    except Exception as e:
        return "", messages, str(e)
