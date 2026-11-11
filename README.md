# WhatsApp Business Broadcast & Follow-up Web App

A full-stack production-ready web app for sending WhatsApp broadcast messages to a client database, tracking delivery & read receipts per contact, and automating follow-up messages.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + React Query |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (JWT) |
| Messaging | Meta WhatsApp Cloud API |
| Hosting | Render (backend as Web Service, frontend as Static Site) |

---

## Project Structure

```
Clientbase/
├── backend/
│   └── src/
│       ├── config/         # env, supabase client, logger
│       ├── middleware/     # auth (JWT), error handler
│       ├── routes/         # contacts, broadcasts, webhook, credentials, cron
│       ├── services/       # metaApi.ts, broadcastSender.ts
│       ├── utils/          # crypto (AES-256-GCM), phone (E.164)
│       └── index.ts        # Express app entry
├── frontend/
│   └── src/
│       ├── components/     # Sidebar, StatusBadge, ProtectedRoute
│       ├── contexts/       # AuthContext (Supabase session)
│       ├── lib/            # api.ts, supabase.ts, utils.ts
│       └── pages/          # Login, Contacts, Broadcasts, BroadcastReport, Settings
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql   # all tables + RLS
│       └── 002_views.sql            # broadcast_report, recipient_report views
└── render.yaml             # one-click Render deploy config
```

---

## Quick Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → New project
2. Run migrations in SQL Editor:
   - Paste contents of `supabase/migrations/001_initial_schema.sql`
   - Paste contents of `supabase/migrations/002_views.sql`
3. Enable Email auth under **Authentication → Providers**
4. Create your first user under **Authentication → Users → Invite user**

### 2. Create a Meta (Facebook) App

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Business
2. Add **WhatsApp** product
3. Get your:
   - **Phone Number ID** (from WhatsApp → API Setup)
   - **WABA ID** (WhatsApp Business Account ID)
   - **Permanent System User Access Token** (from Business Settings → System Users)
4. Configure webhook URL after deploying backend (see Settings page in app)

### 3. Backend Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...
ENCRYPTION_KEY=<run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
WEBHOOK_VERIFY_TOKEN=any_random_string
CRON_SECRET=any_random_string
FRONTEND_ORIGIN=http://localhost:5173
```

### 4. Frontend Environment Variables

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
```

### 5. Run Locally

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

App available at: http://localhost:5173

---

## Deployment (Render)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Select this repo — `render.yaml` configures both services automatically
4. Set all env vars in Render dashboard for `wa-backend` and `wa-frontend`
5. After deploy, add cron jobs in Render:
   - Every 5 mins: `POST /cron/scheduled-broadcasts` with header `X-Cron-Secret: <your secret>`
   - Every 10 mins: `POST /cron/follow-ups` with header `X-Cron-Secret: <your secret>`

---

## Key Features

### Contact Management
- **Primary key: mobile number** (E.164 normalized — handles any format input)
- **Bulk import** via CSV or Excel — name, mobile, email, tags, any extra columns → custom_fields
- Upsert on import — running import again updates existing contacts
- Soft delete / opt-out (never hard-deletes)
- Tags for segmentation
- Paginated search

### Broadcast Sending
- Create a broadcast targeting: all contacts, contacts by tag(s), or a manual list
- Sends via **Meta WhatsApp Cloud API** in batches (rate-limit safe)
- Schedule for a future time or send immediately
- Tracks per-message `wa_message_id` for status correlation

### Real-time Delivery Reports
- Webhook receives `sent` → `delivered` → `read` / `failed` status updates from Meta
- **Per-contact breakdown** showing who has seen (READ ✓✓) vs not seen
- Filter by: ALL / READ / DELIVERED / SENT / FAILED / PENDING
- Summary stats: read%, delivered%, failed%
- Visual progress bar
- **Export to CSV** (filtered or all recipients)
- Auto-refreshes every 15 seconds

### Follow-up Automation
- Add follow-up messages to any sent broadcast
- Configure delay (e.g. 24 hours after parent send)
- Target only contacts with specific statuses (e.g. "SENT but not READ" = send follow-up to those who haven't opened)
- Processed automatically by cron

### Security
- AES-256-GCM encryption of access tokens at rest
- Supabase JWT auth on all API endpoints
- Row Level Security (RLS) on all Postgres tables
- Helmet, CORS, rate limiting on Express

---

## CSV Import Format

Your CSV/Excel file should have these columns (column names are flexible):

| Column | Required | Notes |
|--------|----------|-------|
| `mobile_number` or `Mobile` or `Phone` | ✅ | Any format: 9876543210, +91 98765 43210, etc. |
| `display_name` or `Name` | ✅ | Contact's name |
| `email` or `Email` | ❌ | Optional |
| `tags` or `Tags` | ❌ | Comma/semicolon separated: `vip, customer` |
| Any other columns | ❌ | Stored as `custom_fields` JSON |

Example:
```csv
Name,Mobile,Email,Tags,City,Plan
Rahul Sharma,9876543210,rahul@example.com,"vip,customer",Mumbai,Premium
Priya Patel,+91 98765 43211,priya@example.com,customer,Delhi,Basic
```
