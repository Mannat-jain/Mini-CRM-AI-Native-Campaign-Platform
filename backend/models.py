from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid
import enum

def gen_id():
    return str(uuid.uuid4())

class Customer(Base):
    __tablename__ = "customers"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String)
    city = Column(String)
    age = Column(Integer)
    gender = Column(String)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    orders = relationship("Order", back_populates="customer")
    communications = relationship("Communication", back_populates="customer")

class Order(Base):
    __tablename__ = "orders"
    id = Column(String, primary_key=True, default=gen_id)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    amount = Column(Float, nullable=False)
    product_name = Column(String)
    category = Column(String)
    status = Column(String, default="completed")
    ordered_at = Column(DateTime, default=datetime.utcnow)
    customer = relationship("Customer", back_populates="orders")

class Segment(Base):
    __tablename__ = "segments"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    description = Column(Text)
    nl_query = Column(Text)
    sql_query = Column(Text)
    customer_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    campaigns = relationship("Campaign", back_populates="segment")

class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    segment_id = Column(String, ForeignKey("segments.id"), nullable=False)
    message_template = Column(Text, nullable=False)
    channel = Column(String, default="email")
    status = Column(String, default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime)
    segment = relationship("Segment", back_populates="campaigns")
    communications = relationship("Communication", back_populates="campaign")

class Communication(Base):
    __tablename__ = "communications"
    id = Column(String, primary_key=True, default=gen_id)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    channel = Column(String)
    message = Column(Text)
    status = Column(String, default="queued")  # queued, sent, delivered, failed, opened, read, clicked
    sent_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow)
    retry_count = Column(Integer, default=0)
    campaign = relationship("Campaign", back_populates="communications")
    customer = relationship("Customer", back_populates="communications")
