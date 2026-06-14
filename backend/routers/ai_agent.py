from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
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

def call_llm_messages(system: str, messages: list, max_tokens: int = 500) -> str:
    if not settings.GROQ_API_KEY:
        raise HTTPException(500, "GROQ_API_KEY not configured in .env file")
        
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    
    formatted_messages = [{"role": "system", "content": system}]
    for msg in messages:
        formatted_messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
        
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": formatted_messages,
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
def ai_chat(data: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """General AI chat for CRM assistance with action execution capabilities"""
    message = data.get("message", "")
    history = data.get("history", [])
    
    if not history and message:
        history = [{"role": "user", "content": message}]
        
    messages_payload = []
    for msg in history:
        role = msg.get("role", "user")
        if role == "ai":
            role = "assistant"
        content = msg.get("content") or msg.get("text") or ""
        messages_payload.append({
            "role": role,
            "content": content
        })

    # Get context
    from models import Customer, Campaign, Segment, Communication
    from sqlalchemy import func, text
    
    total_customers = db.query(func.count(Customer.id)).scalar() or 0
    total_campaigns = db.query(func.count(Campaign.id)).scalar() or 0
    total_segments = db.query(func.count(Segment.id)).scalar() or 0
    
    segments = db.query(Segment).all()
    campaigns = db.query(Campaign).all()
    
    segments_list = "\n".join([f"- Name: '{s.name}' (ID: '{s.id}', Customers: {s.customer_count})" for s in segments])
    campaigns_list = "\n".join([f"- Name: '{c.name}' (ID: '{c.id}', Segment ID: '{c.segment_id}', Status: '{c.status}', Channel: '{c.channel}')" for c in campaigns])
    
    system = f"""You are an AI assistant for Xeno CRM, helping marketers reach their shoppers.
You have access to the following SQLite database schema:
{DB_SCHEMA}

Current data in the database:
- {total_customers} customers
- {total_campaigns} campaigns
- {total_segments} segments

Existing segments:
{segments_list if segments_list else "None"}

Existing campaigns:
{campaigns_list if campaigns_list else "None"}

You can help with:
1. Answering marketing questions.
2. Generating audience segments.
3. Creating campaigns.
4. Sending campaigns.

To implement actions, you must output a JSON response. 
Even if the user just asks a general question, return JSON with an empty action list.
The JSON format must be EXACTLY:
{{
  "response": "Your text response to the user explaining what you did, or answering their question. Use markdown formatting.",
  "actions": [
    ...
  ]
}}

Supported action objects:
1. To create a new segment:
{{
  "type": "create_segment",
  "name": "Segment Name",
  "description": "Short explanation of the segment",
  "sql_query": "SQLite query starting with SELECT DISTINCT c.id FROM customers c..."
}}

2. To create a new campaign:
{{
  "type": "create_campaign",
  "name": "Campaign Name",
  "segment_name": "Name of the existing or newly created segment in this session",
  "message_template": "Message copy template, supports {{name}}",
  "channel": "email|sms|whatsapp|rcs"
}}

3. To send a campaign:
{{
  "type": "send_campaign",
  "campaign_name": "Name of the campaign to send"
}}

Rules for actions:
- CRITICAL: DO NOT automatically create segments or campaigns when answering general or analytical questions (e.g., "are there any customers who might leave next week?", "how many customers from Delhi?").
- For questions, first formulate the answer in your thoughts, write a helpful response, and then suggest if they want to create a segment for it and suggest a name for the segment (e.g., "Would you like me to create a segment for this? I suggest naming it 'At-Risk Customers'."). In this case, the "actions" array MUST be empty (`[]`).
- ONLY when the user explicitly requests segment/campaign creation (e.g., "create a segment named...", "make a segment...", "launch campaign...") or explicitly confirms your suggestion (e.g., "yes, create it", "please do"), include the action in the "actions" list.
- If you return an action, explain what action is being performed in your "response" text.
- Return ONLY the JSON object. No other text, no markdown code blocks around the JSON.
"""

    response_text = call_llm_messages(system=system, messages=messages_payload, max_tokens=600)
    
    # Strip markdown fences if present
    raw = response_text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1])
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    
    import json
    try:
        parsed = json.loads(raw)
    except Exception as e:
        # Fallback to plain text response if LLM failed to output JSON
        return {"response": response_text, "actions": [], "error": f"Failed to parse JSON response: {str(e)}"}
    
    actions = parsed.get("actions", [])
    response = parsed.get("response", "")
    
    # Track segments and campaigns created in this chat request
    session_created_segments = {}
    session_created_campaigns = {}
    
    executed_actions = []
    
    from datetime import datetime
    for action in actions:
        atype = action.get("type")
        if atype == "create_segment":
            name = action.get("name")
            desc = action.get("description")
            sql = action.get("sql_query")
            if not name or not sql:
                continue
            
            try:
                # Validate and count
                result = db.execute(text(sql))
                rows = result.fetchall()
                count = len(rows)
                
                # Check if exists, otherwise create
                seg = db.query(Segment).filter(Segment.name == name).first()
                if not seg:
                    seg = Segment(
                        name=name,
                        description=desc,
                        sql_query=sql,
                        customer_count=count
                    )
                    db.add(seg)
                    db.commit()
                    db.refresh(seg)
                
                session_created_segments[name] = seg
                executed_actions.append({"type": "create_segment", "name": name, "id": seg.id, "count": count})
            except Exception as e:
                db.rollback()
                executed_actions.append({"type": "create_segment", "name": name, "error": str(e)})
                
        elif atype == "create_campaign":
            name = action.get("name")
            segment_name = action.get("segment_name")
            msg_temp = action.get("message_template")
            channel = action.get("channel", "email")
            
            if not name or not segment_name or not msg_temp:
                continue
            
            # Find segment
            seg = db.query(Segment).filter(Segment.name == segment_name).first()
            if not seg and segment_name in session_created_segments:
                seg = session_created_segments[segment_name]
                
            if not seg:
                executed_actions.append({"type": "create_campaign", "name": name, "error": f"Segment '{segment_name}' not found."})
                continue
                
            try:
                camp = db.query(Campaign).filter(Campaign.name == name).first()
                if not camp:
                    camp = Campaign(
                        name=name,
                        segment_id=seg.id,
                        message_template=msg_temp,
                        channel=channel,
                        status="draft"
                    )
                    db.add(camp)
                    db.commit()
                    db.refresh(camp)
                
                session_created_campaigns[name] = camp
                executed_actions.append({"type": "create_campaign", "name": name, "id": camp.id})
            except Exception as e:
                db.rollback()
                executed_actions.append({"type": "create_campaign", "name": name, "error": str(e)})
                
        elif atype == "send_campaign":
            campaign_name = action.get("campaign_name")
            if not campaign_name:
                continue
                
            camp = db.query(Campaign).filter(Campaign.name == campaign_name).first()
            if not camp and campaign_name in session_created_campaigns:
                camp = session_created_campaigns[campaign_name]
                
            if not camp:
                executed_actions.append({"type": "send_campaign", "name": campaign_name, "error": f"Campaign '{campaign_name}' not found."})
                continue
                
            if camp.status == "sent":
                executed_actions.append({"type": "send_campaign", "name": campaign_name, "error": "Campaign already sent."})
                continue
                
            try:
                # Send logic
                seg = db.query(Segment).filter(Segment.id == camp.segment_id).first()
                result = db.execute(text(seg.sql_query))
                rows = result.fetchall()
                customer_ids = [str(row[0]) for row in rows]
                customers = db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
                
                comms = []
                for customer in customers:
                    personalised_msg = camp.message_template.replace("{{name}}", customer.name)
                    comm = Communication(
                        campaign_id=camp.id,
                        customer_id=customer.id,
                        channel=camp.channel,
                        message=personalised_msg,
                        status="queued",
                        sent_at=datetime.utcnow()
                    )
                    db.add(comm)
                    comms.append(comm)
                
                camp.status = "sent"
                camp.sent_at = datetime.utcnow()
                db.commit()
                
                # Refresh to get IDs
                comm_data = [{"id": c.id, "customer_id": c.customer_id, "message": c.message, "channel": c.channel} for c in comms]
                
                # Import dispatch function
                from routers.campaigns import dispatch_to_channel
                background_tasks.add_task(dispatch_to_channel, comm_data, camp.id)
                
                executed_actions.append({"type": "send_campaign", "name": campaign_name, "count": len(customers)})
            except Exception as e:
                db.rollback()
                executed_actions.append({"type": "send_campaign", "name": campaign_name, "error": str(e)})

    return {"response": response, "actions": executed_actions}

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