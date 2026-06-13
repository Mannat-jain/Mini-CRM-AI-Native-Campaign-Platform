from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from database import get_db
from models import Campaign, Communication, Customer, Order, Segment
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    total_campaigns = db.query(func.count(Campaign.id)).scalar()
    sent_campaigns = db.query(func.count(Campaign.id)).filter(Campaign.status == "sent").scalar()
    total_comms = db.query(func.count(Communication.id)).scalar()
    
    by_status = db.query(Communication.status, func.count(Communication.id))\
        .group_by(Communication.status).all()
    status_map = {s: c for s, c in by_status}
    
    delivered = status_map.get("delivered", 0) + status_map.get("opened", 0) + \
                status_map.get("read", 0) + status_map.get("clicked", 0)
    opened = status_map.get("opened", 0) + status_map.get("read", 0) + status_map.get("clicked", 0)
    clicked = status_map.get("clicked", 0)
    failed = status_map.get("failed", 0)
    
    total_customers = db.query(func.count(Customer.id)).scalar()
    total_revenue = db.query(func.sum(Order.amount)).scalar() or 0
    
    # Calculate last 7 days daily activity
    daily_activity = []
    today = datetime.utcnow().date()
    for i in range(6, -1, -1):
        day_date = today - timedelta(days=i)
        day_name = day_date.strftime("%a")
        start_dt = datetime.combine(day_date, datetime.min.time())
        end_dt = datetime.combine(day_date, datetime.max.time())
        count = db.query(func.count(Communication.id)).filter(
            Communication.updated_at >= start_dt,
            Communication.updated_at <= end_dt
        ).scalar() or 0
        daily_activity.append({
            "day": day_name,
            "val": count,
            "active": False
        })
        
    max_val = max([d["val"] for d in daily_activity]) if daily_activity else 0
    if max_val > 0:
        for d in daily_activity:
            if d["val"] == max_val:
                d["active"] = True
                break
    
    return {
        "total_campaigns": total_campaigns,
        "sent_campaigns": sent_campaigns,
        "total_communications": total_comms,
        "delivered": delivered,
        "opened": opened,
        "clicked": clicked,
        "failed": failed,
        "delivery_rate": round(delivered / total_comms * 100, 1) if total_comms else 0,
        "open_rate": round(opened / delivered * 100, 1) if delivered else 0,
        "click_rate": round(clicked / opened * 100, 1) if opened else 0,
        "total_customers": total_customers,
        "total_revenue": round(total_revenue, 2),
        "daily_activity": daily_activity
    }


@router.get("/campaigns/performance")
def campaign_performance(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).filter(Campaign.status == "sent")\
        .order_by(Campaign.sent_at.desc()).limit(10).all()
    result = []
    for c in campaigns:
        total = db.query(func.count(Communication.id)).filter(Communication.campaign_id == c.id).scalar()
        by_status = db.query(Communication.status, func.count(Communication.id))\
            .filter(Communication.campaign_id == c.id).group_by(Communication.status).all()
        stats = {s: cnt for s, cnt in by_status}
        delivered = stats.get("delivered", 0) + stats.get("opened", 0) + stats.get("read", 0) + stats.get("clicked", 0)
        opened = stats.get("opened", 0) + stats.get("read", 0) + stats.get("clicked", 0)
        result.append({
            "id": c.id, "name": c.name, "channel": c.channel, "sent_at": c.sent_at,
            "total": total, "delivered": delivered, "opened": opened,
            "clicked": stats.get("clicked", 0), "failed": stats.get("failed", 0),
            "delivery_rate": round(delivered / total * 100, 1) if total else 0,
            "open_rate": round(opened / delivered * 100, 1) if delivered else 0,
        })
    return result

@router.get("/channel/breakdown")
def channel_breakdown(db: Session = Depends(get_db)):
    result = db.query(Communication.channel, Communication.status, func.count(Communication.id))\
        .group_by(Communication.channel, Communication.status).all()
    data = {}
    for channel, status, count in result:
        if channel not in data:
            data[channel] = {}
        data[channel][status] = count
    return data

@router.get("/communications")
def list_communications(db: Session = Depends(get_db)):
    comms = db.query(Communication).order_by(Communication.updated_at.desc()).limit(50).all()
    result = []
    for c in comms:
        result.append({
            "id": c.id,
            "customer_name": c.customer.name if c.customer else "Unknown",
            "campaign_name": c.campaign.name if c.campaign else "System",
            "channel": c.channel or "email",
            "status": c.status or "queued",
            "sent_at": c.sent_at or c.updated_at
        })
    return result

