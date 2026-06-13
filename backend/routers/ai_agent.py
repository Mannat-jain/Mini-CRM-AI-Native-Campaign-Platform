# backend/routers/ai_agent.py  ── ADDITION
# =====================================================================
# ADD this endpoint to the bottom of your existing ai_agent.py file.
# It's the backend for the AI Planner modal in Campaigns.js.
# =====================================================================

# (Your existing imports and router setup stay as-is)
# from fastapi import APIRouter, Depends
# from sqlalchemy.orm import Session
# from database import get_db
# from config import settings
# import groq, json

# ── ADD THIS ENDPOINT ────────────────────────────────────────────────

from pydantic import BaseModel
from typing import List

class PlanRequest(BaseModel):
    goal: str

class CampaignPlan(BaseModel):
    title: str
    segment: str
    channel: str
    message: str

class PlanResponse(BaseModel):
    campaigns: List[CampaignPlan]


@router.post("/plan", response_model=PlanResponse)
async def plan_campaign(req: PlanRequest, db: Session = Depends(get_db)):
    """
    Takes a broad marketer goal and returns 2-4 campaign plans,
    each with an audience, message, and recommended channel.

    The prompt includes live segment counts from the DB so that
    the AI references real numbers, not hallucinated ones.
    """
    # Pull real segment counts to ground the AI
    from models import Customer, Order
    from sqlalchemy import func
    from datetime import datetime, timedelta

    now = datetime.utcnow()

    inactive_premium = db.query(func.count(Customer.id)).filter(
        Customer.total_spend > 5000,
        Customer.last_order_date < now - timedelta(days=90)
    ).scalar() or 0

    one_time_buyers = db.query(func.count(Customer.id)).filter(
        Customer.order_count == 1
    ).scalar() or 0

    vip_count = db.query(func.count(Customer.id)).filter(
        Customer.total_spend > 20000
    ).scalar() or 0

    new_customers = db.query(func.count(Customer.id)).filter(
        Customer.created_at > now - timedelta(days=30)
    ).scalar() or 0

    high_value_at_risk = db.query(func.count(Customer.id)).filter(
        Customer.total_spend > 10000,
        Customer.last_order_date < now - timedelta(days=60)
    ).scalar() or 0

    # Build prompt with live context
    context = f"""
You are an AI marketing assistant for a D2C brand CRM.

Live customer data:
- Inactive premium customers (spend >₹5000, no order 90d): {inactive_premium}
- One-time buyers who never returned: {one_time_buyers}
- VIP customers (spend >₹20000): {vip_count}
- New customers (joined last 30 days): {new_customers}
- High-value at risk (spend >₹10000, no order 60d): {high_value_at_risk}

Marketer's goal: "{req.goal}"

Based on the goal and the real customer data above, generate 2-4 targeted campaign plans.
Each campaign should target a different audience segment.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{{
  "campaigns": [
    {{
      "title": "short campaign name",
      "segment": "segment description with count e.g. Inactive premium (324 customers)",
      "channel": "WhatsApp|Email|SMS|RCS",
      "message": "personalized message template using {{name}} placeholder"
    }}
  ]
}}

Rules:
- Choose the most appropriate channel per segment (WhatsApp for urgent/personal, Email for detailed, SMS for short, RCS for rich)
- Messages must feel personal and specific, not generic
- Reference the actual customer counts from the live data above
- 2 campaigns minimum, 4 maximum
"""

    client = groq.Groq(api_key=settings.groq_api_key)
    response = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[{"role": "user", "content": context}],
        temperature=0.7,
        max_tokens=1000,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        parsed = json.loads(raw)
        return PlanResponse(campaigns=[CampaignPlan(**c) for c in parsed["campaigns"]])
    except Exception:
        # Fallback: return sensible hardcoded plans rather than 500
        return PlanResponse(campaigns=[
            CampaignPlan(
                title="Win-back inactive premium",
                segment=f"Inactive premium ({inactive_premium} customers)",
                channel="WhatsApp",
                message="Hi {name}, we've missed you! Enjoy 15% off your next order — valid 48 hours. 🛍️"
            ),
            CampaignPlan(
                title="Retention — one-time buyers",
                segment=f"One-time buyers ({one_time_buyers} customers)",
                channel="RCS",
                message="Hey {name}! Loved your last purchase? Here are picks you'll love next →"
            ),
            CampaignPlan(
                title="VIP early access",
                segment=f"VIP customers ({vip_count} customers)",
                channel="WhatsApp",
                message="Hi {name}, as a VIP you get exclusive early access — 24 hours before everyone else. ✨"
            ),
        ])
