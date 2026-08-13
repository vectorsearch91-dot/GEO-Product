# GEO Platform — Deployment Guide

## Overview
GEO Platform consists of two services:
1. **API** — FastAPI Python backend (`apps/api/`)
2. **Web** — Next.js 14 frontend (`apps/web/`)

Deployed on Railway.app with a managed PostgreSQL database.

---

## Step 1: Get Your API Key

1. Go to **https://openrouter.ai** → Sign up (or log in)
2. Click **Keys** → Create a new key
3. Optionally add $5 credit (covers ~100+ audit runs)
4. Copy the key — you'll need it in Step 4

---

## Step 2: Push to GitHub

```bash
# In the geo-platform/ folder:
git init
git add .
git commit -m "Initial GEO Platform build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Step 3: Set Up Railway Project

1. Go to **https://railway.app** → New Project → **Deploy from GitHub repo**
2. Select your repository
3. Railway will detect it as a monorepo

---

## Step 4: Create the API Service

1. In Railway, click **+ New** → **GitHub Repo** → select your repo
2. In service settings → **Build** → set **Root Directory** to `apps/api`
3. Railway auto-detects the `Dockerfile` in that folder
4. In **Variables** tab, add:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

5. Deploy — it will take ~2 minutes to build

---

## Step 5: Create the PostgreSQL Database

1. In Railway project → **+ New** → **Database** → **PostgreSQL**
2. Railway provisions it instantly and injects `DATABASE_URL` into services that reference `${{Postgres.DATABASE_URL}}`
3. Tables are auto-created on first API startup (SQLAlchemy `create_all`)

---

## Step 6: Create the Web Service

1. In Railway → **+ New** → **GitHub Repo** → same repo again
2. In service settings → **Build** → set **Root Directory** to `apps/web`
3. In **Variables** tab, add:

```
NEXT_PUBLIC_API_URL=https://YOUR-API-SERVICE.railway.app
```
(Copy the API service URL from Step 4's deployment)

4. Deploy — Next.js build takes ~3 minutes

---

## Step 7: Verify Deployment

1. Open your Web service URL → you should see the GEO Platform landing page
2. Visit `https://YOUR-API-SERVICE.railway.app/docs` → FastAPI Swagger UI
3. The API health check: `GET /health` → `{"status": "healthy"}`

---

## Using the Platform

### Add Your First Product
1. Click **Start Free Audit** on the landing page
2. Paste product image URLs (from your Shopify store, CDN, or any public URL)
3. Click **Analyze with AI** — GPT-4o Vision reads your product in ~15 seconds
4. Review the extracted data (ingredients, personas, benefits) → **Confirm**

### Run an AI Audit
1. On your product page, click **Run New Audit**
2. The platform runs 48+ queries across ChatGPT, Gemini, Claude, and Perplexity
3. Watch the real-time progress bar — typically completes in 2-5 minutes
4. Results appear automatically when done

### Generate Action Plan
1. After audit completes, click **Generate Action Plan** (purple button)
2. Receive ready-to-deploy:
   - PR pitch email to beauty editors
   - JSON-LD schema markup for your product page
   - Organic forum draft for Reddit/Quora

---

## Local Development (Optional)

```bash
# Backend
cd apps/api
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
# Create .env with OPENROUTER_API_KEY=sk-or-v1-...
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd apps/web
npm install
# Create .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

---

## Cost Estimate

| Resource | Cost |
|---|---|
| Railway Hobby Plan | $5/month |
| PostgreSQL | Included |
| OpenRouter (per audit run) | ~$0.05–0.30 |
| 20 demo audit runs | ~$2–6 total |

---

## Troubleshooting

**API won't start:** Check `DATABASE_URL` is set correctly in Railway variables
**Vision analysis fails:** Verify `OPENROUTER_API_KEY` is set and has credits
**Frontend can't reach API:** Verify `NEXT_PUBLIC_API_URL` has no trailing slash and uses `https://`
**Simulation stuck at 0%:** Check API service logs in Railway for errors
