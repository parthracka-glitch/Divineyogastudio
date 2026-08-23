# 🧘 Divine Yoga Studio — CRM & Management Platform

A modern, full-stack Studio Management & Practitioner CRM built specifically for Yoga Studios, wellness centers, and mindful movement spaces.

---

## 🌟 Key Features

- **Dashboard & Analytics**: Real-time revenue metrics, fee collection, pending dues, overdue accounts, and daily scheduled reminders.
- **Client Directory & CRM**: Detailed practitioner profiles, batch assignments, WhatsApp reminder opt-ins, and membership history.
- **Batch Management & PDF Roster Export**: Manage class schedules (Morning, Evening, Weekend) with capacity limits. **Download single-click PDF attendance and class rosters** for each batch.
- **Membership Plans & Pricing**: Self-serviceable monthly, quarterly, annual, and class-pack subscriptions.
- **Financial Ledger**: Automated payment status tracking (Paid, Partial, Pending, Overdue) with CSV export.
- **Automated & Manual WhatsApp Reminders**: Template-based payment alerts with WATI WhatsApp API integration and fallback queueing.
- **Settings & Studio Administration**: Studio profile customization, instructor assignments, security audit logs, and JWT cookie authentication.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, React Router v7, Lucide Icons, jsPDF & jsPDF-AutoTable, TailwindCSS / Vanilla CSS design tokens.
- **Backend**: FastAPI (Python 3.11+ / 3.12+), Uvicorn, Motor (Async MongoDB), PyMongo, Argon2, PyJWT, APScheduler.
- **Database**: MongoDB Atlas (with automatic MongoMock memory fallback for offline testing).
- **Deployment Ready**: Configured for seamless deployment on **Render** (Backend) and **Vercel** (Frontend).

---

## 🚀 Local Development Setup

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```
- API will be accessible at: `http://localhost:8000`
- API Health Check: `http://localhost:8000/health`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start
```
- Frontend will open at: `http://localhost:3000`

### 3. Default Admin Credentials
- **Email**: `admin@divineyogastudio.in`
- **Password**: `yamx1yNHKwKNeKrw7s9LqjAM`

---

## ☁️ Deployment Guide

### Deploy Backend to Render

1. Connect your GitHub repository (`Divineyogastudio`) to [Render](https://render.com).
2. Create a new **Web Service**:
   - **Environment**: `Python 3`
   - **Root Directory**: Leave blank (or `backend` if deploying only backend)
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn backend.server:app --host 0.0.0.0 --port $PORT`
3. Add Environment Variables in Render Dashboard:
   - `PYTHON_VERSION`: `3.11.9`
   - `MONGO_URL`: Your MongoDB Atlas connection URI
   - `DB_NAME`: `divine_yoga`
   - `ADMIN_EMAIL`: `admin@divineyogastudio.in`
   - `ADMIN_PASSWORD`: Your chosen admin password
   - `CORS_ORIGINS`: `https://your-frontend-domain.vercel.app`
   - `SEED_DEMO_DATA`: `true`

---

### Deploy Frontend to Vercel

1. Import your GitHub repository (`Divineyogastudio`) into [Vercel](https://vercel.com).
2. Configure Project Settings:
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
3. Add Environment Variable in Vercel:
   - `REACT_APP_BACKEND_URL`: `https://your-render-service.onrender.com` (Your deployed Render backend URL)
4. Deploy!

---

## 🧪 Testing

Run backend test suite:
```bash
pytest backend/tests
```
All 18 automated test suites test security headers, authentication, client operations, batch management, payment tracking, and WATI safe fallbacks.
