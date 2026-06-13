from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from pydantic import BaseModel
from typing import Optional
import httpx
from config import settings

router = APIRouter()

DB_SCHEMA = """
You have access to a SQLite CRM database with these tables:

customers(id TEXT, name TEXT, email TEXT, phone TEXT, city TEXT, age INTEGER, gender TEXT, tags JSON, created_at DATETIME)
orders(id TEXT, customer_id TEXT, amount REAL, product_name TEXT, category TEXT, status TEXT, ordered_at DATETIME)

The 'tags' column in customers is a JSON array stored as text. Use json_each() for SQLite JSON operations if needed.
All date comparisons use SQLite date functions like date('now', '-30 days').
Always return customer IDs as the first column in your SELECT.
"""

SEGMENT_SYSTEM = f"""You are a CRM analyst AI. Convert natural language audience descriptions into safe SQLite SELECT queries.

{DB_SCHEMA}

Rules:
- ALWAYS start with: SELECT DISTINCT c.id FROM customers c
- JOIN orders using: LEFT JOIN orders o ON o.customer_id = c.id
- Only use SELECT, no mutations
- Return ONLY the SQL query, nothing else, no markdown, no explanation
- Use realistic date math with SQLite date functions

Examples:
"customers who spent more than 5000 total" → SELECT DISTINCT c.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING SUM(o.amount) > 5000
"customers who haven't ordered in 90 days" → SELECT DISTINCT c.id FROM customers c WHERE c.id NOT IN (SELECT DISTINCT customer_id FROM orders WHERE ordered_at > date('now', '-90 days'))
"customers from Mumbai who ordered fashion" → SELECT DISTINCT c.id FROM customers c JOIN orders o ON o.customer_id = c.id WHERE c.city = 'Mumbai' AND o.category = 'Fashion'
"""

MESSAGE_SYSTEM = """You are a marketing copywriter for a D2C brand. Write a short, personalized campaign message.

Rules:
- Use {{name}} as placeholder for customer name
- Keep it under 160 characters for SMS, 300 for others
- Be warm, direct, and action-oriented
- No emojis unless channel is whatsapp
- Return ONLY the message text, nothing else
"""

INSIGHT_SYSTEM = """You are a marketing analyst. Given campaign performance data, provide a 2-3 sentence insight summary.
Be specific, actionable, and concise. Focus on what the numbers mean for the marketer.
Return plain text only."""

class NLSegmentRequest(BaseModel):
    query: str

class MessageDraftRequest(BaseModel):
    segment_description: str
    campaign_goal: str
    channel: str = "email"

class InsightRequest(BaseModel):
    stats: dict
    campaign_name: Optional[str] = None

def call_llm(system: str, prompt: str, max_tokens: int = 500) -> str:
    if not settings.GROQ_API_KEY:
        raise HTTPException(500, "GROQ_API_KEY not configured in .env file")
        
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2
    }
    
    with httpx.Client(timeout=30.0) as client:
        try:
            response = client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            raise HTTPException(500, f"AI generation failed: {str(e)}")

@router.post("/segment")
def nl_to_segment(data: NLSegmentRequest, db: Session = Depends(get_db)):
    """Convert natural language to SQL segment query"""
    sql_query = call_llm(system=SEGMENT_SYSTEM, prompt=data.query, max_tokens=500)
    
    # Clean up any accidental markdown
    if "```" in sql_query:
        parts = sql_query.split("```")
        if len(parts) >= 3:
            sql_query = parts[1]
            if sql_query.startswith("sql"):
                sql_query = sql_query[3:]
            elif sql_query.startswith("json"):
                sql_query = sql_query[4:]
    sql_query = sql_query.strip()
    
    # Preview the result
    from sqlalchemy import text
    from models import Customer
    try:
        result = db.execute(text(sql_query))
        rows = result.fetchall()
        customer_ids = [str(row[0]) for row in rows]
        sample = db.query(Customer).filter(Customer.id.in_(customer_ids[:5])).all()
        return {
            "sql_query": sql_query,
            "count": len(customer_ids),
            "sample": [{"id": c.id, "name": c.name, "email": c.email, "city": c.city} for c in sample]
        }
    except Exception as e:
        raise HTTPException(400, f"Generated SQL failed: {str(e)}")

@router.post("/message")
def draft_message(data: MessageDraftRequest):
    """AI-generated campaign message draft"""
    prompt = f"Channel: {data.channel}\nAudience: {data.segment_description}\nCampaign goal: {data.campaign_goal}\n\nWrite the message:"
    message = call_llm(system=MESSAGE_SYSTEM, prompt=prompt, max_tokens=300)
    return {"message": message}

@router.post("/insights")
def generate_insights(data: InsightRequest):
    """AI-generated campaign insight summary"""
    stats_str = "\n".join([f"{k}: {v}" for k, v in data.stats.items()])
    prompt = f"Campaign: {data.campaign_name or 'Recent campaign'}\n\nStats:\n{stats_str}\n\nProvide insight:"
    insight = call_llm(system=INSIGHT_SYSTEM, prompt=prompt, max_tokens=200)
    return {"insight": insight}

@router.post("/chat")
def ai_chat(data: dict, db: Session = Depends(get_db)):
    """General AI chat for CRM assistance"""
    message = data.get("message", "")
    
    # Get context
    from models import Customer, Campaign
    from sqlalchemy import func
    total_customers = db.query(func.count(Customer.id)).scalar()
    total_campaigns = db.query(func.count(Campaign.id)).scalar()
    
    system = f"""You are an AI assistant for Xeno CRM, helping marketers reach their shoppers.
Current data: {total_customers} customers, {total_campaigns} campaigns.

You can help with:
- Suggesting audience segments (describe who to target)
- Campaign strategy advice  
- Message copy suggestions
- Interpreting campaign performance

Be concise, practical, and marketing-focused. If the user wants to create a segment, ask them to use the Segment Builder with natural language."""
    
    response = call_llm(system=system, prompt=message, max_tokens=400)
    return {"response": response}

RECOMMENDATION_SYSTEM = """You are a CRM marketing strategist AI. You will be given a list of
customer segments with their live counts from a real database.

For each segment with count > 0, write a short campaign recommendation.

Return ONLY a JSON array, no markdown, no explanation, in this exact format:
[
  {
    "segment_key": "<the key from input>",
    "title": "<short action-oriented title, max 6 words>",
    "reasoning": "<one sentence, specific, mentions the actual number>",
    "suggested_channel": "<email|sms|whatsapp|rcs>",
    "urgency": "<high|medium|low>"
  }
]

Rules:
- Skip segments with count = 0
- urgency=high only for things that represent revenue at risk or time-sensitive opportunity
- Be specific and reference the number in reasoning
- Pick channel based on segment type: whatsapp/rcs for win-back & urgent, email for informational, sms for short reminders
"""

@router.get("/recommendations")
def get_recommendations(db: Session = Depends(get_db)):
    """
    Analyzes real customer data and returns AI-generated campaign
    recommendations. This is the data <-> AI integration point:
    the NUMBERS come from the DB, the RECOMMENDATIONS come from the LLM.
    """
    from models import Customer, Order
    from sqlalchemy import func, text

    # ---- Fixed heuristic queries against real data ----
    # 1. High-value customers inactive 60+ days
    inactive_high_value = db.execute(text("""
        SELECT COUNT(DISTINCT c.id) FROM customers c
        JOIN orders o ON o.customer_id = c.id
        GROUP BY c.id
        HAVING SUM(o.amount) > 5000
        AND c.id NOT IN (
            SELECT DISTINCT customer_id FROM orders WHERE ordered_at > date('now', '-60 days')
        )
    """)).fetchall()
    inactive_high_value_count = len(inactive_high_value)

    # 2. One-time buyers who haven't returned in 30+ days
    one_time_buyers = db.execute(text("""
        SELECT c.id FROM customers c
        JOIN orders o ON o.customer_id = c.id
        GROUP BY c.id
        HAVING COUNT(o.id) = 1
        AND MAX(o.ordered_at) < date('now', '-30 days')
    """)).fetchall()
    one_time_buyers_count = len(one_time_buyers)

    # 3. Very high spenders (top tier, VIP-style)
    vip_customers = db.execute(text("""
        SELECT c.id FROM customers c
        JOIN orders o ON o.customer_id = c.id
        GROUP BY c.id
        HAVING SUM(o.amount) > 20000
    """)).fetchall()
    vip_count = len(vip_customers)

    # 4. New customers (signed up last 30 days)
    new_customers_count = db.execute(text("""
        SELECT COUNT(*) FROM customers
        WHERE created_at > date('now', '-30 days')
    """)).scalar() or 0

    # 5. Customers with 2+ orders but quiet for 30-90 days (mid-funnel, recoverable)
    quiet_repeat_buyers = db.execute(text("""
        SELECT c.id FROM customers c
        JOIN orders o ON o.customer_id = c.id
        GROUP BY c.id
        HAVING COUNT(o.id) >= 2
        AND MAX(o.ordered_at) BETWEEN date('now', '-90 days') AND date('now', '-30 days')
    """)).fetchall()
    quiet_repeat_count = len(quiet_repeat_buyers)

    segment_counts = {
        "inactive_high_value": inactive_high_value_count,
        "one_time_buyers": one_time_buyers_count,
        "vip_customers": vip_count,
        "new_customers": new_customers_count,
        "quiet_repeat_buyers": quiet_repeat_count,
    }

    # If everything is zero (empty DB), return empty list — frontend handles this
    if all(v == 0 for v in segment_counts.values()):
        return {"recommendations": []}

    # ---- Ask the LLM to turn real numbers into recommendations ----
    prompt = "Segment counts from live database:\n" + "\n".join(
        f"- {k}: {v} customers" for k, v in segment_counts.items() if v > 0
    )

    try:
        raw = call_llm(system=RECOMMENDATION_SYSTEM, prompt=prompt, max_tokens=700)

        # Strip markdown fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1])
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        import json
        parsed = json.loads(raw)

        # Attach the real count back onto each recommendation
        for rec in parsed:
            rec["count"] = segment_counts.get(rec.get("segment_key"), 0)

        # Sort: high urgency first, then by count descending
        urgency_order = {"high": 0, "medium": 1, "low": 2}
        parsed.sort(key=lambda r: (urgency_order.get(r.get("urgency", "low"), 2), -r.get("count", 0)))

        return {"recommendations": parsed}

    except Exception:
        # ---- Fallback: deterministic recommendations, no LLM needed ----
        # Keeps the panel useful even if GROQ_API_KEY is missing/rate-limited
        fallback = []
        if inactive_high_value_count > 0:
            fallback.append({
                "segment_key": "inactive_high_value",
                "title": "Win back high-value customers",
                "reasoning": f"{inactive_high_value_count} customers spent over ₹5,000 but haven't ordered in 60+ days.",
                "suggested_channel": "whatsapp",
                "urgency": "high",
                "count": inactive_high_value_count,
            })
        if one_time_buyers_count > 0:
            fallback.append({
                "segment_key": "one_time_buyers",
                "title": "Convert one-time buyers",
                "reasoning": f"{one_time_buyers_count} customers made only one purchase and haven't returned in 30+ days.",
                "suggested_channel": "email",
                "urgency": "medium",
                "count": one_time_buyers_count,
            })
        if vip_count > 0:
            fallback.append({
                "segment_key": "vip_customers",
                "title": "Reward your VIP customers",
                "reasoning": f"{vip_count} customers have spent over ₹20,000 — keep them loyal with exclusive offers.",
                "suggested_channel": "whatsapp",
                "urgency": "medium",
                "count": vip_count,
            })
        if quiet_repeat_count > 0:
            fallback.append({
                "segment_key": "quiet_repeat_buyers",
                "title": "Re-engage repeat buyers going quiet",
                "reasoning": f"{quiet_repeat_count} repeat customers haven't ordered in 30-90 days — recoverable before they churn.",
                "suggested_channel": "sms",
                "urgency": "medium",
                "count": quiet_repeat_count,
            })
        if new_customers_count > 0:
            fallback.append({
                "segment_key": "new_customers",
                "title": "Welcome new customers",
                "reasoning": f"{new_customers_count} customers joined in the last 30 days — nurture them toward a second purchase.",
                "suggested_channel": "email",
                "urgency": "low",
                "count": new_customers_count,
            })

        return {"recommendations": fallback}