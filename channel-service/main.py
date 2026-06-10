from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import httpx
import random
from pydantic import BaseModel
from typing import Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Xeno Channel Service (Stub)", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dead Letter Queue for failed callbacks
dlq: list = []

# Simulate realistic delivery outcomes by channel
CHANNEL_OUTCOMES = {
    "email":    {"delivered": 0.82, "failed": 0.08, "opened": 0.06, "read": 0.03, "clicked": 0.01},
    "sms":      {"delivered": 0.88, "failed": 0.06, "opened": 0.04, "read": 0.015, "clicked": 0.005},
    "whatsapp": {"delivered": 0.75, "failed": 0.05, "opened": 0.10, "read": 0.07, "clicked": 0.03},
    "rcs":      {"delivered": 0.70, "failed": 0.12, "opened": 0.08, "read": 0.06, "clicked": 0.04},
}

def pick_outcome(channel: str) -> str:
    weights = CHANNEL_OUTCOMES.get(channel, CHANNEL_OUTCOMES["email"])
    outcomes = list(weights.keys())
    probs = list(weights.values())
    return random.choices(outcomes, weights=probs)[0]

class SendRequest(BaseModel):
    communication_id: str
    recipient_id: str
    message: str
    channel: str = "email"
    callback_url: str

async def send_callback_with_retry(callback_url: str, payload: dict, max_retries: int = 3):
    """Exponential backoff retry for callbacks"""
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(callback_url, json=payload)
                if response.status_code < 500:
                    logger.info(f"Callback delivered: {payload['communication_id']} -> {payload['status']}")
                    return True
        except Exception as e:
            logger.warning(f"Callback attempt {attempt+1} failed: {e}")
        
        if attempt < max_retries - 1:
            wait = (2 ** attempt) + random.uniform(0, 1)
            await asyncio.sleep(wait)
    
    # Send to DLQ
    dlq.append({"payload": payload, "callback_url": callback_url, "failed_at": str(__import__('datetime').datetime.utcnow())})
    logger.error(f"Callback moved to DLQ: {payload['communication_id']}")
    return False

async def simulate_delivery(req: SendRequest):
    """Simulate async channel delivery with realistic timing"""
    # Simulate network + channel delay
    initial_delay = random.uniform(0.5, 3.0)
    await asyncio.sleep(initial_delay)
    
    outcome = pick_outcome(req.channel)
    
    # Send the delivery callback
    await send_callback_with_retry(req.callback_url, {
        "communication_id": req.communication_id,
        "status": outcome,
        "timestamp": str(__import__('datetime').datetime.utcnow()),
        "metadata": {"channel": req.channel, "attempt": 1}
    })
    
    # For positive outcomes, simulate engagement events
    if outcome in ["delivered", "opened"]:
        engagement_chance = {"email": 0.35, "whatsapp": 0.55, "sms": 0.20, "rcs": 0.40}
        if random.random() < engagement_chance.get(req.channel, 0.3):
            await asyncio.sleep(random.uniform(5, 30))  # engagement delay
            
            next_status = "opened" if outcome == "delivered" else "read"
            await send_callback_with_retry(req.callback_url, {
                "communication_id": req.communication_id,
                "status": next_status,
                "timestamp": str(__import__('datetime').datetime.utcnow()),
                "metadata": {"channel": req.channel}
            })
            
            # Simulate click
            if random.random() < 0.25:
                await asyncio.sleep(random.uniform(2, 10))
                await send_callback_with_retry(req.callback_url, {
                    "communication_id": req.communication_id,
                    "status": "clicked",
                    "timestamp": str(__import__('datetime').datetime.utcnow()),
                    "metadata": {"channel": req.channel, "url": "https://brand.example.com/offer"}
                })

@app.post("/send")
async def send_message(req: SendRequest):
    """Accept send request, process async"""
    asyncio.create_task(simulate_delivery(req))
    return {"accepted": True, "communication_id": req.communication_id}

@app.get("/dlq")
def get_dlq():
    return {"count": len(dlq), "items": dlq[-20:]}

@app.delete("/dlq/retry")
async def retry_dlq():
    """Retry all DLQ items"""
    items = dlq.copy()
    dlq.clear()
    for item in items:
        asyncio.create_task(send_callback_with_retry(item["callback_url"], item["payload"]))
    return {"retrying": len(items)}

@app.get("/health")
def health():
    return {"status": "ok", "service": "channel-stub", "dlq_size": len(dlq)}
