from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from database import get_db
from models import Campaign, Communication, Segment, Customer
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import httpx
import asyncio
from config import settings

router = APIRouter()

class CampaignCreate(BaseModel):
    name: str
    segment_id: str
    message_template: str
    channel: str = "email"

@router.get("/")
def list_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    result = []
    for c in campaigns:
        stats = get_campaign_stats_internal(c.id, db)
        result.append({
            "id": c.id, "name": c.name, "channel": c.channel,
            "status": c.status, "created_at": c.created_at, "sent_at": c.sent_at,
            "segment_id": c.segment_id,
            "segment_name": c.segment.name if c.segment else None,
            "stats": stats
        })
    return result

@router.post("/")
def create_campaign(data: CampaignCreate, db: Session = Depends(get_db)):
    segment = db.query(Segment).filter(Segment.id == data.segment_id).first()
    if not segment:
        raise HTTPException(404, "Segment not found")
    campaign = Campaign(**data.dict())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign

def get_campaign_stats_internal(campaign_id: str, db: Session):
    from sqlalchemy import case
    comms = db.query(Communication).filter(Communication.campaign_id == campaign_id)
    total = comms.count()
    by_status = db.query(Communication.status, func.count(Communication.id))\
        .filter(Communication.campaign_id == campaign_id)\
        .group_by(Communication.status).all()
    stats = {"total": total}
    for status, count in by_status:
        stats[status] = count
    return stats

@router.get("/{campaign_id}/stats")
def get_campaign_stats(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    return get_campaign_stats_internal(campaign_id, db)

@router.post("/{campaign_id}/send")
async def send_campaign(campaign_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status == "sent":
        raise HTTPException(400, "Campaign already sent")
    
    segment = db.query(Segment).filter(Segment.id == campaign.segment_id).first()
    result = db.execute(text(segment.sql_query))
    rows = result.fetchall()
    customer_ids = [str(row[0]) for row in rows]
    customers = db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
    
    # Create communication records
    comms = []
    for customer in customers:
        personalised_msg = campaign.message_template.replace("{{name}}", customer.name)
        comm = Communication(
            campaign_id=campaign.id,
            customer_id=customer.id,
            channel=campaign.channel,
            message=personalised_msg,
            status="queued",
            sent_at=datetime.utcnow()
        )
        db.add(comm)
        comms.append(comm)
    
    campaign.status = "sent"
    campaign.sent_at = datetime.utcnow()
    db.commit()
    
    # Refresh to get IDs
    comm_data = [{"id": c.id, "customer_id": c.customer_id, "message": c.message, "channel": c.channel} for c in comms]
    
    background_tasks.add_task(dispatch_to_channel, comm_data, campaign_id)
    
    return {"message": f"Campaign dispatched to {len(customers)} recipients", "count": len(customers)}

async def dispatch_to_channel(comm_data: list, campaign_id: str):
    """Send communications to channel service in batches"""
    async with httpx.AsyncClient(timeout=30) as client:
        tasks = []
        for comm in comm_data:
            payload = {
                "communication_id": comm["id"],
                "recipient_id": comm["customer_id"],
                "message": comm["message"],
                "channel": comm["channel"],
                "callback_url": settings.CRM_RECEIPT_URL
            }
            tasks.append(send_single(client, payload))
        
        # Process in batches of 20
        batch_size = 20
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i:i+batch_size]
            await asyncio.gather(*batch, return_exceptions=True)
            if i + batch_size < len(tasks):
                await asyncio.sleep(0.1)

async def send_single(client: httpx.AsyncClient, payload: dict):
    try:
        await client.post(f"{settings.CHANNEL_SERVICE_URL}/send", json=payload)
    except Exception:
        pass  # Channel service handles retries

@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(404, "Not found")
    db.delete(campaign)
    db.commit()
    return {"message": "Deleted"}
