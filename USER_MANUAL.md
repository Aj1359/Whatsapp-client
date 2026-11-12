# ReachFlow — User Manual & Operations Guide

Welcome to **ReachFlow**, an enterprise-grade WhatsApp Cloud API broadcasting and customer engagement platform. This manual walks you through everything from connecting a business to launching campaigns, tracking real-time delivery ticks, handling customer replies, and setting up inquiry forwarding to your personal phone.

---

## Table of Contents
1. [Prerequisites in Meta (One-Time Setup)](#1-prerequisites-in-meta-one-time-setup)
2. [Connecting a Client Business (Profile & Meta Connector)](#2-connecting-a-client-business-profile--meta-connector)
3. [Managing Customers & Importing Contact Lists](#3-managing-customers--importing-contact-lists)
4. [Syncing Approved Templates from Meta](#4-syncing-approved-templates-from-meta)
5. [Launching a Broadcast Campaign](#5-launching-a-broadcast-campaign)
6. [Monitoring Live Real-Time Delivery on the Dashboard](#6-monitoring-live-real-time-delivery-on-the-dashboard)
7. [Managing Inbound Customer Replies & Follow-Ups](#7-managing-inbound-customer-replies--follow-ups)
8. [Forwarding Inquiries to Your Personal WhatsApp](#8-forwarding-inquiries-to-your-personal-whatsapp)
9. [Automated Daily Planner & Follow-up Sequences](#9-automated-daily-planner--follow-up-sequences)
10. [Troubleshooting & Meta Error Codes](#10-troubleshooting--meta-error-codes)

---

## 1. Prerequisites in Meta (One-Time Setup)

Before connecting ReachFlow, complete these steps inside the client's [Meta Developers](https://developers.facebook.com) and [Meta Business Settings](https://business.facebook.com/settings) accounts:

1. **Meta Developer App**:
   - Create a Business App.
   - Set the App status to **Live** (Published).
2. **WhatsApp Business Account (WABA)**:
   - Add a valid payment method under **WhatsApp Manager &rarr; Billing** so conversation charges are authorized.
3. **Generate a Permanent Access Token**:
   - Go to [Meta Business Settings](https://business.facebook.com/settings) &rarr; **Users** &rarr; **System Users**.
   - Create an Admin System User (e.g. `ReachFlowAdmin`).
   - Click **Assign Assets**: Give Full Control over your **App** and **WhatsApp Account**.
   - Click **Generate New Token**: Choose your App, set expiration to **Never**, and select:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Copy and save this token.
4. **Configure Webhook**:
   - In Meta Developer Console under **WhatsApp &rarr; Configuration**:
     - **Callback URL**: `https://<YOUR_BACKEND_URL>/webhooks/whatsapp`
     - **Verify Token**: Your configured verify token.
   - Under **Webhook fields**, click **Manage** and subscribe to:
     - `messages`
     - `message_template_status_update`

---

## 2. Connecting a Client Business (Profile & Meta Connector)

1. Log into your ReachFlow portal.
2. Click **Profile & Meta Connector** in the left sidebar.
3. If previously connected to another client, click **Disconnect / Switch Client**.
4. Enter the client's credentials:
   - **WhatsApp Phone Number ID** (15–16 digit number from WhatsApp API Setup)
   - **WhatsApp Business Account (WABA) ID** (from WhatsApp Manager)
   - **Meta Permanent Access Token** (generated in Step 1)
5. Click **Connect WhatsApp Business Profile**.
6. ReachFlow will run an instant handshake with Meta Graph API, verify the phone name and quality rating, and store the token encrypted with AES-256-GCM.

---

## 3. Managing Customers & Importing Contact Lists

### Adding a Single Customer
1. Navigate to **Customers Data** in the sidebar.
2. Click **+ Add Customer**.
3. Enter Name, Mobile Number (e.g., `+91 98765 43210` or `9876543210`), and optional Email.
4. Check the mandatory **Opt-in Consent Confirmation** box.
5. Click **Save Customer**.

### Bulk Importing (.xlsx, .xls, .csv)
1. In **Customers Data**, click **Upload / Import**.
2. Drag and drop your `.xlsx` or `.csv` spreadsheet (up to 15 MB / 50,000 rows).
3. The importer auto-detects column headers for `Name`, `Phone`, and `Email`.
4. Check the **Consent Confirmation** checkbox confirming your contacts opted in to receive business WhatsApp notifications.
5. Click **Import Contacts**.
   - ReachFlow normalizes every phone number to standard E.164 (`+91...`).
   - Duplicates within the file or existing database are skipped.
   - Contacts who previously opted out (`STOP`) are preserved as opted-out and never reactivated.

---

## 4. Syncing Approved Templates from Meta

> [!NOTE]
> Per Meta policies, marketing and utility message templates must be authored and approved inside Meta WhatsApp Manager. ReachFlow automatically synchronizes them.

1. Navigate to **Posts & Templates** in the sidebar.
2. Click **Sync from Meta**.
3. ReachFlow pulls all approved templates, their headers, body texts, footers, and dynamic variable placeholders (`{{1}}`, `{{2}}`).
4. Only templates marked with the green **APPROVED** badge can be selected for broadcasts.

---

## 5. Launching a Broadcast Campaign

1. In **Posts & Templates**, find the approved template you want to broadcast.
2. Click **Broadcast**.
3. Configure your campaign:
   - **Campaign Name**: e.g., `Diwali Festival Sale 2026`
   - **Audience**: Select an Audience List or target all active opt-in contacts.
   - **Header Media (Optional)**: If the template has an image header, attach your image (`.jpg` / `.png`). ReachFlow uploads it once to Meta and distributes it efficiently.
   - **Dynamic Variables**: Fill in variables (e.g., `{{1}}` automatically defaults to the recipient's first name).
4. Click **Launch Broadcast**.
5. The campaign is queued instantly in PostgreSQL. ReachFlow's background sending worker claims rows via `FOR UPDATE SKIP LOCKED` and sends messages with rate limiting and exponential backoff.

---

## 6. Monitoring Live Real-Time Delivery on the Dashboard

Navigate to **Dashboard & Stats** to monitor real, verified database counts (zero simulated numbers):

### 1. High-Level Metric Tiles
- **Total Dispatched**: Total messages processed through Meta Cloud API.
- **Verified Delivered**: Double-tick confirmations that reached customer handsets.
- **Confirmed Seen (✓✓)**: Blue-tick confirmations where customer read receipts are active.
- **Active Contacts**: Size of your selectable opt-in audience.

### 2. Campaign Inspection Tabs
Select any campaign from the horizontal list to inspect its 4 live status tabs:
1. **Seen (Read)**: Recipients who opened and read the message.
2. **Delivered, Not Seen**: Double-grey tick on the recipient's phone.
3. **Sent, Not Delivered**: Single tick; message accepted by Meta and en route to the recipient.
4. **Failed**: Messages rejected by Meta (e.g., invalid phone number or user opted out), showing the exact Meta error code.

### 3. Campaign Controls
- **Pause**: Temporarily pauses an ongoing campaign.
- **Resume**: Continues sending from where it was paused.
- **Cancel**: Cancels sending and marks remaining queued messages as skipped.
- **Retry Failed**: Requeues failed messages that were blocked by temporary rate limits.

---

## 7. Managing Inbound Customer Replies & Follow-Ups

1. Click **Replies** in the sidebar.
2. The left pane shows customer conversations, sorted with the newest replies on top.
3. Click any customer to open their full chronological chat history:
   - Past broadcast templates sent to them.
   - Inbound replies sent by the customer.
   - Outbound 1-on-1 replies sent by your team.
4. **Meta 24-Hour Customer Care Window**:
   - When a customer replies, Meta opens a **free 24-hour service window** (indicated by a green badge).
   - During these 24 hours, you can type free-form replies directly from the input bar at ₹0.00 charge.
   - If 24 hours have passed, ReachFlow automatically disables free-form text and provides a **Send Template** shortcut to reopen the conversation safely.
5. **Customer Opt-Out (STOP)**:
   - If a customer replies with `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, or `QUIT`, ReachFlow marks them as `opted_out` immediately and stops all future broadcast messages to that number for your organization.

---

## 8. Forwarding Inquiries to Your Personal WhatsApp

Want to get notified on your own WhatsApp whenever a client's customer responds?

1. Go to **Profile & Meta Connector** (or Settings).
2. Under **Inquiry Auto-Forwarding**:
   - Toggle **Enable WhatsApp Forwarding** to **ON**.
   - Enter your **Personal WhatsApp Number** in international format (e.g. `+91 98765 43210`).
   - Enter your approved Meta utility template name (e.g., `customer_inquiry_alert`).
3. Click **Save Settings**.
4. **How It Works**:
   - Whenever an inbound reply arrives, ReachFlow dispatches an alert to your phone:
     ```text
     New WhatsApp inquiry from Rahul Sharma (+91 98310 XXXXX):
     "Hi, I would like to place an order for the promo item."
     ```
   - **Loop Guard**: If you message the business number from your personal phone, ReachFlow will never forward the message back to you.
   - All messages remain fully viewable and answerable in the web portal regardless of forwarding.

---

## 9. Automated Daily Planner & Follow-Up Sequences

### Daily Planner
- Plan campaigns days or weeks in advance.
- The automated background scheduler (`/internal/tick`) converts scheduled entries into active broadcasts at their designated date and time.
- If a planned entry is more than 2 hours overdue, it is automatically marked as `missed`.

### Multi-Step Follow-Up Sequences
- Set up conditional drip sequences:
  - Step 1: Initial broadcast
  - Step 2 (+24h): Follow-up if `no_reply` or `delivered_not_read`
  - Step 3 (+48h): Final reminder
- **Safety**: If a contact replies or opts out at any stage, they are automatically removed from the sequence immediately.

---

## 10. Troubleshooting & Meta Error Codes

| Error Code | Meaning | What to Do |
|---|---|---|
| **190** | Access Token Expired or Invalid | Re-generate a permanent System User Token in Meta Business Settings and save it in ReachFlow. |
| **130429** / **131056** | Rate Limit Hit | ReachFlow automatically backs off (30s, 2m, 10m, 30m) and retries. |
| **131048** | Spam Rate Limit Reached | Meta has temporarily paused outbound marketing messages due to user reports. Campaign is paused automatically. |
| **131026** | Undeliverable / Not on WhatsApp | The phone number is not registered on WhatsApp. |
| **132000** | Template Does Not Exist | Click **Sync from Meta** in Templates to refresh template IDs. |
| **WINDOW_CLOSED** | 24-Hour Customer Window Expired | Send an approved template instead of a free-form message. |
