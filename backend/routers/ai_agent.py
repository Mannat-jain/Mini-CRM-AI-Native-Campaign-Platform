from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from pydantic import BaseModel
from typing import Optional
import anthropic
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
    import httpx
    key = settings.GROQ_API_KEY
    if not key:
        raise HTTPException(500, "API key not configured (please set GROQ_API_KEY in backend/.env)")
    
    if key.startswith("gsk_"):
        # Use Groq API (OpenAI compatible)
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "llama-3.3-70b-specdec",
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": max_tokens,
                        "temperature": 0.2
                    }
                )
                if response.status_code != 200:
                    # Fallback model
                    response = client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": "llama-3.1-8b-instant",
                            "messages": [
                                {"role": "system", "content": system},
                                {"role": "user", "content": prompt}
                            ],
                            "max_tokens": max_tokens,
                            "temperature": 0.2
                        }
                    )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            raise HTTPException(500, f"Groq API call failed: {str(e)}")
    else:
        # Use Anthropic SDK
        try:
            client = anthropic.Anthropic(api_key=key)
            response = client.messages.create(
                model="claude-3-5-sonnet-latest",
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text.strip()
        except Exception as e:
            raise HTTPException(500, f"Anthropic API call failed: {str(e)}")

@router.post("/segment")
def nl_to_segment(data: NLSegmentRequest, db: Session = Depends(get_db)):
    """Convert natural language to SQL segment query"""
    sql_query = call_llm(system=SEGMENT_SYSTEM, prompt=data.query, max_tokens=500)
    
    # Clean up any accidental markdown
    if sql_query.startswith("```"):
        lines = sql_query.split("\n")
        if lines[0].startswith("```sql") or lines[0] == "```":
            sql_query = "\n".join(lines[1:-1])
        else:
            sql_query = "\n".join(lines[1:-1])
    
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
    from models import Customer, Campaign, Segment
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

