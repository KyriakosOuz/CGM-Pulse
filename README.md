# CGM Pulse

A LinkedIn campaign performance dashboard with AI-powered insights. Pulls daily ad spend and KPI data from a Google Sheet, computes per-campaign and account-level metrics, surfaces budget pacing alerts, and uses Claude to generate human-readable performance reports and answer ad-hoc questions about the data.

## What it does

- **KPI engine** — daily aggregation of CPC, CTR, CPL, conversion rate, leads, and total spend per campaign and across the account, with target-based status (good/bad/neutral).
- **Budget pacing** — pro-rata pacing math anchored to a configurable dataset end date. Estimates monthly budget as 110% of each campaign's historical max month, then flags `OVERPACING` (>110% of expected), `ON TRACK` (80–110%), or `UNDERPACING` (<80%).
- **AI reports** — Claude generates a structured performance summary (top movers, anomalies, pacing concerns, recommendations) on demand.
- **Ask Claude** — chat interface backed by Voyage embeddings + Pinecone semantic search over campaign history, scoped per-campaign or account-wide.
- **Alerts** — email and Slack notifications when a KPI flips from good → bad. State-change based, not threshold-spam.
- **Webhook sync** — Google Apps Script trigger pushes Sheet edits to the backend, invalidating the in-memory cache so the dashboard reflects changes within seconds.

## Architecture

```
┌──────────────────┐         ┌────────────────────┐         ┌────────────────┐
│   Google Sheet   │  read   │   FastAPI backend  │  HTTPS  │  React (Vite)  │
│  (daily ad data) │────────▶│      (Railway)     │◀───────▶│  (Vercel)      │
└────────┬─────────┘         │                    │         └────────────────┘
         │ on edit            │  - KPI engine      │
         │ (Apps Script)      │  - Budget pacing   │
         ▼                    │  - In-memory cache │         External services
┌──────────────────┐ POST     │  - Alerts          │         ─────────────────
│ Webhook trigger  │─────────▶│                    │────────▶ Anthropic Claude
│  invalidate      │          │                    │────────▶ Voyage embeddings
│  cache           │          │                    │────────▶ Pinecone vectors
└──────────────────┘          └────────────────────┘────────▶ SMTP / Slack
```

### Backend
FastAPI + Uvicorn. Deployed to Railway. Talks to:
- Google Sheets API (data source)
- Anthropic Claude (`claude-sonnet-4-5` for reports, `claude-haiku-4-5` for chat)
- Voyage AI (`voyage-3-lite`, 512-dim embeddings)
- Pinecone (semantic search index)
- SMTP (Resend) and Slack webhooks for alerts

In-memory cache with 5-minute TTL on `/api/campaigns`. Webhook from Apps Script flushes the cache on Sheet edits.

### Frontend
React 19 + Vite + Tailwind. Deployed to Vercel. Modular cards for analytics, campaign tables, budget pacing, AI report, and chat.

### Google Apps Script
A small `webhook_trigger.gs` script attached to the source Sheet that POSTs to the backend's webhook endpoint when rows change.

## Tech stack

**Backend**: FastAPI · Uvicorn · Pydantic · APScheduler · google-api-python-client · anthropic · voyageai · pinecone · aiosmtplib

**Frontend**: React 19 · Vite 8 · Tailwind 3 · React Router 7 · Recharts · Axios

**Infra**: Railway (backend) · Vercel (frontend) · Google Sheets (data source) · Pinecone (vector DB)

## Local setup

### Prerequisites
- Python 3.11+
- Node 20+
- A Google service account with read access to the source Sheet
- API keys: Anthropic, Voyage, Pinecone

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env with your keys (see comments in the file)
uvicorn main:app --reload --port 8000
```

The Google service account JSON goes into the `GOOGLE_SERVICE_ACCOUNT_JSON` env var as a single-line stringified JSON. Locally you can also drop the file at `backend/service_account.json` (gitignored) and adjust the loader if preferred.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8000 for local dev
npm run dev
```

Frontend runs on `http://localhost:5173`.

### Webhook (optional, for live Sheet sync)

In your source Google Sheet → Extensions → Apps Script, paste the contents of `google-apps-script/webhook_trigger.gs`, set the webhook URL to your backend, and add an `onChange` installable trigger.

## Deployment

### Backend → Railway
```bash
cd backend
railway up
```
`railway.toml` and `Procfile` define the build (Nixpacks) and start command (`uvicorn main:app --host 0.0.0.0 --port $PORT`). Set all env vars from `.env.example` in the Railway dashboard.

### Frontend → Vercel
```bash
cd frontend
vercel --prod
```
`vercel.json` configures the Vite build, output directory, and SPA rewrite. Set `VITE_API_URL` in the Vercel dashboard to your Railway backend URL.

## Project structure

```
.
├── backend/
│   ├── main.py                    # FastAPI app entry + CORS
│   ├── config.py                  # Env vars, KPI targets, pacing window
│   ├── requirements.txt
│   ├── routers/
│   │   ├── campaigns.py           # GET /api/campaigns (KPI + pacing)
│   │   ├── analytics.py           # GET /api/analytics/history (per-period)
│   │   ├── chat.py                # POST /api/chat (Claude-powered Q&A)
│   │   ├── report.py              # POST /api/report (AI summary)
│   │   ├── alerts.py              # state-change alert dispatcher
│   │   ├── settings.py            # alert / report config persistence
│   │   ├── sync.py                # manual refresh
│   │   └── webhook.py             # Apps Script webhook receiver
│   ├── services/
│   │   ├── sheets.py              # Google Sheets client
│   │   ├── kpi_engine.py          # per-campaign + account aggregation
│   │   ├── budget_pacing.py       # pro-rata pacing math
│   │   ├── claude_service.py      # report generation, prompt assembly
│   │   ├── pinecone_service.py    # vector indexing + semantic search
│   │   └── alert_service.py       # email + Slack dispatch
│   ├── jobs/sync_job.py           # APScheduler periodic refresh
│   └── data/targets.json          # KPI threshold defaults
│
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Dashboard, Campaigns, Docs, Settings
│   │   ├── components/
│   │   │   ├── Dashboard/         # KPI cards, BudgetPacingCard, charts
│   │   │   ├── Campaigns/         # CampaignTable, CampaignDetailRow
│   │   │   ├── Settings/          # AlertConfig
│   │   │   ├── Layout/            # Header, navigation
│   │   │   └── Shared/            # DateRangePicker, etc.
│   │   ├── api/client.js          # Axios instance + endpoints
│   │   └── hooks/useAnalytics.js
│   ├── public/
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── vercel.json
│
└── google-apps-script/
    └── webhook_trigger.gs
```

## Key API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/campaigns` | All campaigns with KPIs and pacing |
| `GET` | `/api/analytics/history?from=&to=` | Daily series per campaign over a date range |
| `POST` | `/api/campaigns/refresh` | Force-flush the in-memory cache |
| `POST` | `/api/report` | Generate Claude-authored performance summary |
| `POST` | `/api/chat` | Ask Claude a question (with Pinecone-retrieved context) |
| `POST` | `/api/webhook/sheet-edit` | Apps Script trigger — invalidates cache |

## Configuration highlights

| Env var | Default | Purpose |
|---|---|---|
| `DATASET_END_DATE` | `2026-03-03` | Anchors pacing math to the official dataset window. Stops stray late-dated rows from skewing pacing math. |
| `CAMPAIGN_BUDGETS` | `{}` | Per-campaign monthly budget overrides (JSON dict). `"default"` key is the fallback for new campaigns. |
| `ALERTS_ENABLED` | `false` | Master switch for email + Slack alerts. |
| `CACHE_TTL` | 5 min (hardcoded) | In-memory cache lifetime on `/api/campaigns`. |

KPI targets (`config.py`):
- CPC < $5.00
- CTR > 0.65%
- CPL < $120
- Conv Rate > 1.00%

## License

MIT — see [LICENSE](./LICENSE).
