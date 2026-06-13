# Xeno Mini CRM — AI-Native Campaign Platform

A full-stack AI-native CRM for reaching shoppers, built for Xeno's engineering assignment. The system supports natural language database querying, automated personalization, delivery simulation, and customizable user datasets.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                         │
│   Dashboard · Customers · Segments · Campaigns · Insights   │
│                    AI Chat (Llama 3)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────────┐
│                  CRM Backend (FastAPI)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ NL→SQL Agent│  │Campaign Engine│ │  Receipt API       │  │
│  │  (Llama 3)  │  │  (AsyncIO)   │  │  (Callback handler)│  │
│  └─────────────┘  └───────┬──────┘  └──────────┬─────────┘  │
│                           │ /send              │ /callback  │
└───────────────────────────┼────────────────────┼────────────┘
                            │                    │
┌───────────────────────────▼────────────────────▼────────────┐
│              Channel Service (Stub — FastAPI)               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Outcome Sim  │  │Exp. Backoff  │  │  Dead Letter Queue │ │
│  │ (weighted    │  │  Retry Logic │  │  (DLQ for failures)│ │
│  │  random)     │  │              │  │                    │ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                       │ SQLite (dev) / PostgreSQL (prod)
┌──────────────────────▼──────────────────────────────────────┐
│  customers · orders · segments · campaigns · communications │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start (Running the Project)

### Option A: Automatic Launch (Windows)
We have provided a PowerShell script to spin up all services concurrently:
1. Open PowerShell.
2. Run:
   ```powershell
   .\start.ps1
   ```
This automatically opens three terminal windows to compile packages and serve the frontend, backend, and channel-service.

### Option B: Automatic Launch (macOS / Linux)
1. Open your terminal.
2. Make the script executable and run it:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

### Option C: Manual Launch (Step-by-Step)
If you prefer running services manually, open three separate terminal windows:

#### 1. CRM Backend
```bash
cd backend
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 2. Channel Service
```bash
cd channel-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

#### 3. React Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm start
```

---

## File Map & Directory Explanations

### 1. Workspace Root Files
| File / Directory | Description |
| :--- | :--- |
| `backend/` | Folder containing the FastAPI REST backend service and database configurations. |
| `frontend/` | Folder containing the React.js client interface and style systems. |
| `channel-service/` | Mock delivery service to simulate message dispatching and delivery state callbacks. |
| `docker-compose.yml` | Multi-container Docker configuration for local environment setup. |
| `render.yaml` | Blueprint configurations for deployment on Render. |
| `start.sh` | Bash startup helper script to spin up services on macOS/Linux. |
| `start.ps1` | PowerShell startup helper script to spin up services on Windows. |
| `README.md` | General instructions, file directory listings, and design summaries. |

### 2. Backend Files (`backend/`)
| File / Directory | Description |
| :--- | :--- |
| `main.py` | App entry point; boots up FastAPI, adds CORS/headers, and mounts core routing systems. |
| `config.py` | Configuration model built with Pydantic; parses environment variables such as `GROQ_API_KEY`. |
| `database.py` | Configures SQLite/SQLAlchemy ORM engine instance and exposes database sessions. |
| `models.py` | Database schemas representing Customer, Order, Segment, Campaign, and Communication tables. |
| `requirements.txt` | Python dependency package requirements (FastAPI, SQLAlchemy, Faker, etc.). |
| `Dockerfile` | Image parameters for containerizing the backend microservice. |
| `routers/` | Sub-directory containing modularized API endpoint controllers. |
| `routers/customers.py` | Endpoints to fetch, add, seed sample data, reset databases, and upload JSON/CSV datasets. |
| `routers/segments.py` | Endpoints to construct, list, and preview audience segments. |
| `routers/campaigns.py` | Endpoints to build campaigns, draft copies, and dispatch message queues. |
| `routers/insights.py` | Endpoints returning aggregated counts, channel breakdowns, and the last 50 communication events. |
| `routers/receipts.py` | Callback endpoint receiving delivery receipts from the channel service. |
| `routers/ai_agent.py` | Integrates LLM interactions using Groq (Llama 3) for NL-to-SQL, drafting copies, and recommendations. |

### 3. Channel Service Files (`channel-service/`)
| File / Directory | Description |
| :--- | :--- |
| `main.py` | Runs the FastAPI stub queue; simulates outcomes, schedules callbacks, and manages retries/DLQs. |
| `requirements.txt` | Python dependencies required to run the channel service. |
| `Dockerfile` | Image parameters to build the channel service. |

### 4. Frontend Files (`frontend/`)
| File / Directory | Description |
| :--- | :--- |
| `src/App.js` | Main React routing module; integrates light/dark theme variables, sidebar navigation, and the global floating AI Chat drawer. |
| `src/index.js` | React application mount and rendering anchor. |
| `src/index.css` | Universal CSS sheet; defines premium color tokens, light themes, campaign grids, and layout rules. |
| `src/api/index.js` | Axios endpoint configs for customers, segments, campaigns, and AI integration. |
| `src/pages/` | Folder containing individual page components. |
| `src/pages/Dashboard.js` | Displays funnels, customer seed triggers, DB resets, and custom file uploaders. |
| `src/pages/Customers.js` | Searchable customer listing page exhibiting full ordering logs and customer tag bubbles. |
| `src/pages/Segments.js` | Audience segmentation builder incorporating Natural Language input and SQL previews. |
| `src/pages/Campaigns.js` | Card-grid campaign management interfaces with delayed hover-triggered AI performance summaries. |
| `src/pages/Insights.js` | High-fidelity metrics dashboard with channel progress bars, a 7-day activity chart, and a live searchable communications table. |
| `src/pages/AIPlanner.js` | Split-pane campaign drafting workspace displaying active Opportunities and automated AI copywriting generation. |

---

## AI-Native Features
1. **NL → SQL Segmentation** — Type plain English ("customers who spent ₹5000+ but haven't ordered in 60 days"), Llama 3 generates safe SELECT queries.
2. **AI Message Drafting** — Llama 3 writes personalized copy tailored to the selected customer segment and target channel.
3. **AI Performance Insights** — Llama 3 evaluates aggregate campaign analytics and summarizes performance.
4. **AI Chat Assistant** — Strategy consulting chat answering query design and campaign ideas.
5. **AI Campaign Recommendation Planner** — Analyzes live database counts (e.g., inactive high spenders, quiet repeat buyers, VIP opportunities) and generates contextual recommendations with automated campaign execution.

---

## System Design Highlights
- **Async Delivery Loop**: Campaign sends are dispatched to the channel service via async background tasks.
- **Exponential Backoff**: Callbacks retry with $2^n$ delay (1s, 2s, 4s) before hitting the Dead Letter Queue.
- **Dead Letter Queue**: Failed callbacks are stored in-memory for manual retry via `/dlq/retry`.
- **Status Ordering**: Communication status only upgrades (`queued` → `sent` → `delivered` → `opened` → `read` → `clicked`); `failed` can be set at any point.
- **Safe SQL**: All NL-generated queries are validated for SELECT-only actions, and forbidden keyword patterns are blocked.

---

## API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/customers/` | GET | List customers with order stats. |
| `/api/customers/seed` | POST | Seed 200 demo customers. |
| `/api/customers/reset` | POST | Clear database back to basic slate. |
| `/api/customers/upload` | POST | Upload and parse custom JSON/CSV datasets. |
| `/api/segments/` | GET/POST | List or create segments. |
| `/api/segments/preview` | POST | Preview SQL query results. |
| `/api/campaigns/` | GET/POST | List or create campaigns. |
| `/api/campaigns/{id}/send` | POST | Launch campaign dispatch queue. |
| `/api/receipts/callback` | POST | Channel callback receiver. |
| `/api/insights/overview` | GET | Aggregate metrics and funnels. |
| `/api/insights/communications` | GET | List the 50 most recent communication events. |
| `/api/ai/segment` | POST | NL → SQL query generation. |
| `/api/ai/message` | POST | AI campaign copy drafting. |
| `/api/ai/insights` | POST | AI campaign performance insights. |
| `/api/ai/chat` | POST | General assistant chat. |
| `/api/ai/recommendations` | GET | Generate LLM recommendations from database metrics. |

---

## Deployment (Render)

### Backend (Web Service)
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env vars: `GROQ_API_KEY`, `CHANNEL_SERVICE_URL`, `CRM_RECEIPT_URL`

### Channel Service (Web Service)
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Frontend (Static Site)
- Build Command: `npm install && npm run build`
- Publish dir: `build`
- Env: `REACT_APP_API_URL=https://your-backend.onrender.com`

---

## Deliberate Tradeoffs

| Decision | Reasoning |
| :--- | :--- |
| SQLite in dev | Zero-config for assignment; swap `DATABASE_URL` for PostgreSQL in prod. |
| In-memory DLQ | Simple for demo; production would use Redis Streams or SQS. |
| No auth | Out of scope for assignment; would add JWT + row-level security. |
| No scheduling | Simplified; production would use APScheduler or Celery Beat. |
| Batch size of 20 | Prevents channel service overload; tunable via env var. |
