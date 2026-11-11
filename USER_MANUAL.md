# WABizConnect — Operating Manual & Administrator Guide
**WhatsApp Business Platform: Broadcasts, Seen/Not-Seen Audit, Customer Management & Inbound Follow-ups**

---

## Table of Contents
1. [Overview & Architecture](#1-overview--architecture)
2. [Account Setup & Sign In](#2-account-setup--sign-in)
3. [Connecting Meta WhatsApp Business Cloud API](#3-connecting-meta-whatsapp-business-cloud-api)
4. [Configuring Webhooks in Meta Developer Portal](#4-configuring-webhooks-in-meta-developer-portal)
5. [Managing Customers Database](#5-managing-customers-database)
6. [Creating & Repeating Day-Wise Posts (Broadcasts)](#6-creating--repeating-day-wise-posts-broadcasts)
7. [Live Delivery Analytics & Seen (✓✓) vs. Not Seen Reports](#7-live-delivery-analytics--seen--vs-not-seen-reports)
8. [Handling Customer Replies & Direct Chat Console](#8-handling-customer-replies--direct-chat-console)
9. [Automated Keep-Alive Cron Setup](#9-automated-keep-alive-cron-setup)
10. [Troubleshooting & Meta Error Codes](#10-troubleshooting--meta-error-codes)

---

## 1. Overview & Architecture

**WABizConnect** is a Multi-Tenant WhatsApp Business Broadcast and customer engagement web platform. It enables businesses to:
- Connect their official Meta WhatsApp Business Cloud API.
- Upsert and import customer databases anytime using normalized **Mobile Number (E.164)** as the primary identifier.
- Schedule and send daily broadcast posts with image and personalized text.
- Audit real-time delivery receipts with a clear breakdown of **Who Has Seen (Blue Ticks ✓✓ with exact timestamp)** vs. **Who Has Not Seen Yet**.
- Reply immediately to inbound responses directly from the console to either selected or all active customers.
- Automatically respect opt-out (`STOP`) keywords per WhatsApp Business policies.

### Cloud Architecture
```
┌─────────────────────────────────┐
│     WABizConnect Frontend       │  Static Web App (Vite + React)
│    (Render Static Site)         │  Hosted at: https://wa-frontend.onrender.com
└────────────────┬────────────────┘
                 │ REST / Bearer JWT
┌────────────────▼────────────────┐
│      WABizConnect Backend       │  Node.js 22 + Express API
│   (Render Web Service / Node)   │  Hosted at: https://wa-backend-ayta.onrender.com
└────────┬───────────────┬────────┘
         │               │
         ▼               ▼
┌─────────────────┐  ┌───────────────────────────────────┐
│  Supabase Cloud │  │     Meta WhatsApp Cloud API       │
│  Postgres + RLS │  │  graph.facebook.com/v21.0        │
└─────────────────┘  └───────────────────────────────────┘
```

---

## 2. Account Setup & Sign In

### Creating an Account
1. Open the web app at your hosted domain.
2. In the right card, click **Create Business Account**.
3. Fill in:
   - **Business / Brand Name**: Your legal business or brand name (e.g. *Apex Wholesalers & Retail*).
   - **Email Address**: Your work email.
   - **Password**: Secure password (at least 8 characters).
4. Click **Create Business Account →**.
5. Your account and organization are automatically provisioned in Supabase.

### Signing In
1. In the right card, select the **Sign In** tab.
2. Enter your registered email address and password.
3. Click **Sign In →**.

---

## 3. Connecting Meta WhatsApp Business Cloud API

Each tenant connects their own official WhatsApp Business number.

### Where to Find Your Meta Credentials
1. Go to **[developers.facebook.com](https://developers.facebook.com/)** and log in.
2. Click **My Apps** (top right) $\rightarrow$ open your App (or click *Create App* $\rightarrow$ select *Other* $\rightarrow$ *Business*).
3. In the left sidebar, expand **WhatsApp** $\rightarrow$ click **API Setup**:
   - **Phone Number ID**: A 15-digit number (e.g. `102938475610293`).
   - **WhatsApp Business Account (WABA) ID**: Found under *WhatsApp Business Account ID* (e.g. `109847192837465`).
4. Generate a **Permanent System User Access Token**:
   - Go to [business.facebook.com/settings](https://business.facebook.com/settings).
   - Click **System Users** (under *Users*).
   - Click **Add** to create a system user (role: *Admin*).
   - Click **Generate New Token**, select your WhatsApp App, and grant these 2 permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Set Token Expiration to **Never** (Permanent).
   - Copy the generated token string (`EAAG...`).

### Entering Credentials in WABizConnect
1. In WABizConnect, navigate to **Profile & Meta Connector** (`/profile`).
2. Enter:
   - **Phone Number ID**: Paste your 15-digit ID.
   - **WhatsApp Business Account ID (WABA ID)**: Paste your WABA ID.
   - **Permanent Access Token**: Paste your `EAAG...` token.
3. Click **Test Meta Connection**.
4. When verified, a green badge will appear showing your verified business phone number, display name, and Meta quality rating (`GREEN`).
5. Click **Save WhatsApp Configuration**. Credentials are encrypted using **AES-256-GCM** before being saved to the database.

---

## 4. Configuring Webhooks in Meta Developer Portal

Webhooks are required so your server receives real-time delivery receipts (`sent`, `delivered`, `read ✓✓`) and customer replies.

1. In WABizConnect, open **Profile & Meta Connector** (`/profile`) and find the **Webhook Configuration** card.
2. Note the two values:
   - **Callback URL**: `https://wa-backend-ayta.onrender.com/webhooks/whatsapp`
   - **Verify Token**: `wa_verify_token_123456`
3. In your **Meta Developer Portal**:
   - In the left sidebar, expand **WhatsApp** $\rightarrow$ click **Configuration**.
   - Under **Webhook**, click **Edit**.
   - Paste the **Callback URL** and **Verify Token** from above.
   - Click **Verify and Save**.
4. In the Webhook fields table, click **Manage** and subscribe to:
   - **`messages`** (covers delivery receipts, read ticks, incoming text, and media).
5. Click **Done**.

---

## 5. Managing Customers Database

The customer database matches contacts by **Mobile Number (E.164 format)**.

### Adding or Updating a Single Customer
1. Navigate to **Customers Data** (`/customers`).
2. Click **+ Add Customer** (top right).
3. Fill in:
   - **Primary Mobile Number**: e.g. `+919876543210` or `9876543210` (automatically normalized to E.164).
   - **Customer Name**: Full name or company contact.
   - **Email Address** *(optional)*.
   - **Tags & Segment**: Comma-separated tags (e.g. `VIP, Wholesale, Mumbai`).
4. Click **Save Customer**. If the number already exists, its details (name, email, tags) are updated seamlessly without creating duplicates.

### Bulk Import via CSV or Excel (.xlsx)
1. In **Customers Data**, click **Import CSV/Excel**.
2. Prepare a spreadsheet with any of these standard headers:

| Name | Mobile | Email | Tags | City |
| :--- | :--- | :--- | :--- | :--- |
| Ramesh Gupta | +91 98765 43210 | ramesh@gmail.com | VIP, Retail | Mumbai |
| Priya Verma | 9820011223 | priya@outlook.com | New Lead | Delhi |
| Amit Patel | +919930055443 | amit@patel.in | Wholesale | Ahmedabad |

3. Drag & drop your `.csv` or `.xlsx` file into the upload box.
4. Click **Upload & Process Import**.
5. The importer normalizes every number, inserts new contacts, updates existing contacts, and shows a summary of rows processed.

---

## 6. Creating & Repeating Day-Wise Posts (Broadcasts)

### Composing a Day-Wise Post
1. Navigate to **Posts & Templates** (`/posts`).
2. Click **+ Create Post / Template**.
3. Fill in:
   - **Post / Campaign Title**: Internal reference (e.g. *Weekend Flash Discount Push*).
   - **Image URL** *(optional)*: Public HTTPS link to product/promotional banner.
   - **Message Text**: The message body. Supports personalization tags like `{{name}}`.
     ```text
     Hi {{name}}! Flash weekend sale starts tonight at 8 PM.
     Use code FLASH20 for flat 20% OFF.

     Reply STOP to unsubscribe.
     ```
   - **Send Schedule**: Select **Send Immediately** or **Schedule for Later**.
4. Click **Publish Broadcast Post**.

### 1-Click "Repeat This Post"
To re-send a successful promotional message from a previous day:
1. In **Posts & Templates**, scroll through the **Broadcast History (Day by Day)**.
2. On any past post card, click **Repeat This Post**.
3. The composer opens pre-filled with the title, banner image, and message text.
4. Make any tweaks if desired, and click **Publish Broadcast Post**.

---

## 7. Live Delivery Analytics & Seen (✓✓) vs. Not Seen Reports

The **Dashboard & Stats** (`/dashboard`) is dedicated entirely to open-rate audits.

### Summary Metrics Cards
- **Total Sent**: Total broadcast messages dispatched.
- **Total Delivered**: Successfully delivered to recipients' handsets.
- **Seen (Blue Ticks ✓✓)**: Confirmed opened and read by the customer, with percentage read rate.
- **Not Seen Yet**: Delivered but not yet opened by the customer.

### Filtering Recipients
Under the drilldown table, toggle between:
- **Who Has Seen It (✓✓)**: List of contacts who opened the message, complete with the **Exact Seen Timestamp** (e.g. `14:45 PM`).
- **Who Has Not Seen It**: List of contacts who have not opened the message yet.
- **All Targeted**: Complete recipient audit.

### Exporting Reports
Click **Export Seen List (CSV)** at the top right to download a spreadsheet with names, mobile numbers, delivery timestamps, and exact read timestamps.

---

## 8. Handling Customer Replies & Direct Chat Console

When a customer replies to your broadcast:
1. Navigate to **Replies** (`/replies`).
2. The inbound reply appears instantly showing:
   - Customer Name and Phone Number.
   - Exact message body.
   - Received timestamp.
   - Opt-out tag if the user replied `STOP`.

### Sending a Direct Reply Right in the Console
1. At the top of the **Replies** page, use the **Send Reply Directly Here** console.
2. Select your target:
   - **Reply to Selected**: Check the box next to specific customer replies.
   - **Reply to All Active**: Send a broadcast response to all active repliers at once.
3. Type your response in the reply text box.
4. Click **Send WhatsApp Reply**.

### STOP / Opt-Out Compliance
If a customer replies with `STOP`, `UNSUBSCRIBE`, or `CANCEL`:
- The system automatically marks their contact status as `opted_out`.
- Future broadcasts automatically exclude this number.
- The reply is flagged with a red **STOP / OPT-OUT** badge in the console.

---

## 9. Automated Keep-Alive Cron Setup

Render's free tier spins down backend services after 15 minutes of inactivity. To ensure 24/7 uptime and punctual broadcast delivery:

1. Go to **[cron-job.org](https://cron-job.org)** (free service).
2. Create a new cron job:
   - **Title**: `WABizConnect Keep-Alive`
   - **URL**: 
     ```text
     https://wa-backend-ayta.onrender.com/internal/tick?secret=wa_cron_secret_789012
     ```
   - **Execution Schedule**: **Every 5 minutes** (or Every 10 minutes).
3. Click **Save / Create Job**.

---

## 10. Troubleshooting & Meta Error Codes

| Meta Error Code | Meaning | Solution |
| :--- | :--- | :--- |
| **`190`** | Access token expired or revoked | Regenerate a permanent system user token in Meta Business Manager and update it in `/profile`. |
| **`131026`** | Number not registered on WhatsApp | The mobile number has no active WhatsApp account. Marked as invalid in customer database. |
| **`131047`** | 24-hour customer service window closed | Outside the 24-hour window, you must send an approved Meta template message rather than free-form text. |
| **`130429`** | Rate limit exceeded | Daily messaging tier reached (e.g. 250 or 1,000/day). Upgrade tier by sending quality broadcasts. |
| **`100`** | Invalid parameter / phone number ID | Verify that the Phone Number ID in `/profile` belongs to the WhatsApp Business Account. |
