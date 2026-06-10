from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Communication
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()

class ReceiptCallback(BaseModel):
    communication_id: str
    status: str  # delivered, failed, opened, read, clicked
    timestamp: Optional[str] = None
    metadata: Optional[dict] = None

STATUS_ORDER = ["queued", "sent", "delivered", "opened", "read", "clicked", "failed"]

@router.post("/callback")
def receive_callback(data: ReceiptCallback, db: Session = Depends(get_db)):
    comm = db.query(Communication).filter(Communication.id == data.communication_id).first()
    if not comm:
        raise HTTPException(404, "Communication not found")
    
    # Only upgrade status (except for failed, which can always be set)
    current_idx = STATUS_ORDER.index(comm.status) if comm.status in STATUS_ORDER else 0
    new_idx = STATUS_ORDER.index(data.status) if data.status in STATUS_ORDER else 0
    
    if data.status == "failed" or new_idx > current_idx:
        comm.status = data.status
        comm.updated_at = datetime.utcnow()
        db.commit()
    
    return {"ok": True, "communication_id": data.communication_id, "status": comm.status}

@router.get("/communications/{campaign_id}")
def get_communications(campaign_id: str, db: Session = Depends(get_db)):
    comms = db.query(Communication).filter(Communication.campaign_id == campaign_id).all()
    return [{"id": c.id, "customer_id": c.customer_id, "status": c.status,
             "channel": c.channel, "sent_at": c.sent_at, "updated_at": c.updated_at} for c in comms]
