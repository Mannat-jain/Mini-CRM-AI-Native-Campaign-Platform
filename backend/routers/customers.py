from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
import csv
import json
import io
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Customer, Order
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter()

class CustomerCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    city: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    tags: Optional[List[str]] = []

class OrderCreate(BaseModel):
    amount: float
    product_name: Optional[str] = None
    category: Optional[str] = None
    status: str = "completed"
    ordered_at: Optional[datetime] = None

@router.get("/")
def list_customers(
    skip: int = 0, limit: int = 50,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Customer)
    if search:
        q = q.filter(Customer.name.ilike(f"%{search}%") | Customer.email.ilike(f"%{search}%"))
    total = q.count()
    customers = q.offset(skip).limit(limit).all()
    result = []
    for c in customers:
        order_count = db.query(func.count(Order.id)).filter(Order.customer_id == c.id).scalar()
        total_spend = db.query(func.sum(Order.amount)).filter(Order.customer_id == c.id).scalar() or 0
        last_order = db.query(Order).filter(Order.customer_id == c.id).order_by(Order.ordered_at.desc()).first()
        result.append({
            "id": c.id, "name": c.name, "email": c.email, "phone": c.phone,
            "city": c.city, "age": c.age, "gender": c.gender, "tags": c.tags,
            "created_at": c.created_at, "order_count": order_count,
            "total_spend": round(total_spend, 2),
            "last_order_at": last_order.ordered_at if last_order else None
        })
    return {"total": total, "customers": result}

@router.post("/")
def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.email == data.email).first()
    if existing:
        raise HTTPException(400, "Email already exists")
    c = Customer(**data.dict())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@router.get("/stats")
def customer_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Customer.id)).scalar()
    total_orders = db.query(func.count(Order.id)).scalar()
    total_revenue = db.query(func.sum(Order.amount)).scalar() or 0
    return {
        "total_customers": total,
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "avg_order_value": round(total_revenue / total_orders, 2) if total_orders else 0
    }

@router.post("/seed")
def seed_data(db: Session = Depends(get_db)):
    from faker import Faker
    import random
    from datetime import timedelta
    fake = Faker('en_IN')
    
    existing = db.query(func.count(Customer.id)).scalar()
    if existing > 0:
        return {"message": f"Data already seeded ({existing} customers exist)"}
    
    categories = ["Fashion", "Electronics", "Beauty", "Home", "Sports", "Food"]
    products = {
        "Fashion": ["Cotton Kurta", "Denim Jacket", "Silk Saree", "Sneakers", "Formal Shirt"],
        "Electronics": ["Wireless Earbuds", "Phone Case", "Smart Watch", "Laptop Stand", "USB Hub"],
        "Beauty": ["Face Serum", "Lipstick Set", "Hair Mask", "Perfume", "Sunscreen SPF50"],
        "Home": ["Scented Candle", "Cushion Cover", "Wall Art", "Table Lamp", "Bed Sheet"],
        "Sports": ["Yoga Mat", "Water Bottle", "Running Shoes", "Gym Gloves", "Resistance Band"],
        "Food": ["Protein Bar Pack", "Green Tea Box", "Dry Fruit Mix", "Honey Jar", "Spice Kit"]
    }
    cities = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata", "Jaipur", "Ahmedabad", "Surat"]
    
    customers_created = []
    for _ in range(200):
        c = Customer(
            name=fake.name(),
            email=fake.unique.email(),
            phone=fake.phone_number()[:15],
            city=random.choice(cities),
            age=random.randint(18, 60),
            gender=random.choice(["Male", "Female", "Other"]),
            tags=random.sample(["loyal", "high-value", "at-risk", "new", "vip", "seasonal"], k=random.randint(0, 2)),
            created_at=datetime.utcnow() - timedelta(days=random.randint(30, 730))
        )
        db.add(c)
        customers_created.append(c)
    db.commit()
    
    for c in customers_created:
        num_orders = random.choices([0, 1, 2, 3, 4, 5, 8, 12], weights=[5, 20, 25, 20, 15, 8, 4, 3])[0]
        for _ in range(num_orders):
            cat = random.choice(categories)
            order = Order(
                customer_id=c.id,
                amount=round(random.uniform(200, 8000), 2),
                product_name=random.choice(products[cat]),
                category=cat,
                status="completed",
                ordered_at=datetime.utcnow() - timedelta(days=random.randint(1, 365))
            )
            db.add(order)
    db.commit()
    
    return {"message": "Seeded 200 customers with realistic orders"}

@router.post("/reset")
def reset_data(db: Session = Depends(get_db)):
    from models import Customer, Order, Segment, Campaign, Communication
    try:
        db.query(Communication).delete()
        db.query(Campaign).delete()
        db.query(Segment).delete()
        db.query(Order).delete()
        db.query(Customer).delete()
        db.commit()
        return {"message": "Database reset successfully"}
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Reset failed: {str(e)}")

@router.post("/upload")
def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from models import Customer, Order
    content = file.file.read()
    filename = file.filename.lower()
    
    # Read as text
    try:
        text_content = content.decode("utf-8")
    except Exception:
        try:
            text_content = content.decode("latin-1")
        except Exception as e:
            raise HTTPException(400, f"Failed to decode file: {str(e)}")
            
    customers_imported = 0
    orders_imported = 0
    
    if filename.endswith(".json"):
        try:
            data = json.loads(text_content)
            if not isinstance(data, list):
                data = [data]
        except Exception as e:
            raise HTTPException(400, f"Invalid JSON format: {str(e)}")
            
        for item in data:
            if "name" not in item or "email" not in item:
                continue
            
            # Check unique email
            existing = db.query(Customer).filter(Customer.email == item["email"]).first()
            if existing:
                c = existing
            else:
                tags = item.get("tags", [])
                if isinstance(tags, str):
                    tags = [t.strip() for t in tags.split(",") if t.strip()]
                c = Customer(
                    name=item["name"],
                    email=item["email"],
                    phone=item.get("phone"),
                    city=item.get("city"),
                    age=item.get("age"),
                    gender=item.get("gender"),
                    tags=tags
                )
                db.add(c)
                db.commit()
                db.refresh(c)
                customers_imported += 1
                
            # Import order if present in the customer object
            if "amount" in item or "order_amount" in item:
                amount = item.get("amount") or item.get("order_amount")
                try:
                    amount = float(amount)
                    order = Order(
                        customer_id=c.id,
                        amount=amount,
                        product_name=item.get("product_name") or item.get("product"),
                        category=item.get("category") or "General",
                        status="completed"
                    )
                    db.add(order)
                    orders_imported += 1
                except ValueError:
                    pass
                    
            # Or if there is an array of orders
            if "orders" in item and isinstance(item["orders"], list):
                for o_item in item["orders"]:
                    if "amount" in o_item:
                        try:
                            order = Order(
                                customer_id=c.id,
                                amount=float(o_item["amount"]),
                                product_name=o_item.get("product_name") or o_item.get("product"),
                                category=o_item.get("category") or "General",
                                status=o_item.get("status") or "completed"
                            )
                            db.add(order)
                            orders_imported += 1
                        except ValueError:
                            pass
        db.commit()
        
    elif filename.endswith(".csv"):
        try:
            f = io.StringIO(text_content)
            reader = csv.DictReader(f)
        except Exception as e:
            raise HTTPException(400, f"Failed to parse CSV: {str(e)}")
            
        for row in reader:
            row_lower = {k.lower().strip(): v for k, v in row.items() if k}
            
            email = row_lower.get("email")
            name = row_lower.get("name")
            if not email or not name:
                continue
                
            existing = db.query(Customer).filter(Customer.email == email).first()
            if existing:
                c = existing
            else:
                tags_str = row_lower.get("tags", "")
                tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []
                
                age_val = row_lower.get("age")
                try:
                    age = int(age_val) if age_val else None
                except ValueError:
                    age = None
                    
                c = Customer(
                    name=name,
                    email=email,
                    phone=row_lower.get("phone"),
                    city=row_lower.get("city"),
                    age=age,
                    gender=row_lower.get("gender"),
                    tags=tags
                )
                db.add(c)
                db.commit()
                db.refresh(c)
                customers_imported += 1
                
            # Order details (if in CSV row)
            amount_val = row_lower.get("amount") or row_lower.get("order_amount") or row_lower.get("order_value")
            if amount_val:
                try:
                    amount = float(amount_val)
                    order = Order(
                        customer_id=c.id,
                        amount=amount,
                        product_name=row_lower.get("product_name") or row_lower.get("product"),
                        category=row_lower.get("category") or "General",
                        status="completed"
                    )
                    db.add(order)
                    orders_imported += 1
                except ValueError:
                    pass
        db.commit()
    else:
        raise HTTPException(400, "Supported formats: CSV or JSON only.")
        
    return {"message": f"Successfully imported {customers_imported} customers and {orders_imported} orders."}
