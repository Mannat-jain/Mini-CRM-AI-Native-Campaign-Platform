from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import Segment, Customer
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class SegmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    nl_query: Optional[str] = None
    sql_query: str

class SQLPreview(BaseModel):
    sql_query: str

@router.get("/")
def list_segments(db: Session = Depends(get_db)):
    segments = db.query(Segment).order_by(Segment.created_at.desc()).all()
    return segments

@router.post("/preview")
def preview_segment(data: SQLPreview, db: Session = Depends(get_db)):
    """Preview how many customers a SQL query would match"""
    try:
        safe_sql = data.sql_query.strip()
        if not safe_sql.upper().startswith("SELECT"):
            raise HTTPException(400, "Only SELECT queries allowed")
        forbidden = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE"]
        for kw in forbidden:
            if kw in safe_sql.upper():
                raise HTTPException(400, f"Keyword {kw} not allowed")
        
        result = db.execute(text(safe_sql))
        rows = result.fetchall()
        customer_ids = [str(row[0]) for row in rows]
        sample_customers = db.query(Customer).filter(Customer.id.in_(customer_ids[:5])).all()
        
        return {
            "count": len(customer_ids),
            "sample": [{"id": c.id, "name": c.name, "email": c.email, "city": c.city} for c in sample_customers]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"SQL error: {str(e)}")

@router.post("/")
def create_segment(data: SegmentCreate, db: Session = Depends(get_db)):
    try:
        safe_sql = data.sql_query.strip()
        if not safe_sql.upper().startswith("SELECT"):
            raise HTTPException(400, "Only SELECT queries allowed")
        result = db.execute(text(safe_sql))
        rows = result.fetchall()
        count = len(rows)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"SQL error: {str(e)}")
    
    segment = Segment(
        name=data.name,
        description=data.description,
        nl_query=data.nl_query,
        sql_query=data.sql_query,
        customer_count=count
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment

@router.get("/{segment_id}/customers")
def get_segment_customers(segment_id: str, db: Session = Depends(get_db)):
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(404, "Segment not found")
    try:
        result = db.execute(text(segment.sql_query))
        rows = result.fetchall()
        customer_ids = [str(row[0]) for row in rows]
        customers = db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
        return {"count": len(customers), "customers": [{"id": c.id, "name": c.name, "email": c.email} for c in customers]}
    except Exception as e:
        raise HTTPException(400, str(e))

@router.delete("/{segment_id}")
def delete_segment(segment_id: str, db: Session = Depends(get_db)):
    from models import Campaign, Communication
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(404, "Segment not found")
        
    # Delete campaigns referencing this segment, and their communication records
    campaigns = db.query(Campaign).filter(Campaign.segment_id == segment_id).all()
    for campaign in campaigns:
        db.query(Communication).filter(Communication.campaign_id == campaign.id).delete()
        db.delete(campaign)
        
    db.delete(segment)
    db.commit()
    return {"message": "Deleted"}
