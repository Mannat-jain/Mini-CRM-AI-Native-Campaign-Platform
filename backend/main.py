from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine, Base
from routers import customers, campaigns, segments, receipts, insights, ai_agent
import models  # noqa

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Xeno Mini CRM", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers.router, prefix="/api/customers", tags=["customers"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(segments.router, prefix="/api/segments", tags=["segments"])
app.include_router(receipts.router, prefix="/api/receipts", tags=["receipts"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(ai_agent.router, prefix="/api/ai", tags=["ai"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "xeno-crm"}
