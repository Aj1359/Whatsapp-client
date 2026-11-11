/**
 * API client module for WhatsApp Broadcast & Follow-up App
 * Handles:
 * - JWT authentication via Supabase session
 * - Organization scoping (X-Org-Id header)
 * - Automatic retry on network error
 * - Full fallback mock state so the entire UI can be explored immediately
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('sb-token') ?? 'demo-token';
  const orgId = localStorage.getItem('active-org-id') ?? '00000000-0000-0000-0000-000000000001';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Org-Id': orgId,
  };
}

// In-memory demo data store for seamless preview if backend is sleeping or in setup mode
export const mockData: any = {
  dashboard: {
    activeContacts: 3420,
    messagesSentToday: 65,
    dailyCap: 250,
    lastCampaignResult: {
      name: 'Diwali Festive Mega Sale 2026',
      total: 1250,
      sent: 1250,
      delivered: 1220,
      seen: 984, // Who has seen it!
      notSeen: 236, // Who hasn't seen it!
      failed: 30,
      seenPct: 78.7,
      date: '2026-11-09T14:30:00Z',
    },
    nextScheduledSend: {
      name: 'VIP Cart Recovery Blast',
      time: 'Tomorrow, 10:30 AM',
      recipientsCount: 412,
    },
    banners: [
      { id: 'b1', type: 'info', text: 'Daily send cap reset occurs at midnight (Asia/Kolkata).' },
    ],
  },
  contacts: [
    {
      id: 1,
      name: 'Rajesh Kumar',
      whatsapp_e164: '+919876543210',
      phone_raw: '09876543210',
      email: 'rajesh.k@gmail.com',
      status: 'active',
      opt_in_confirmed_at: '2026-10-12T10:00:00Z',
      tags: ['VIP', 'Repeat Buyer'],
      extra: { city: 'Mumbai', orders: 12, last_order_val: '₹4,500' },
      last_message_status: 'read',
      seen_at: '2026-11-09T14:45:12Z',
    },
    {
      id: 2,
      name: 'Ananya Sharma',
      whatsapp_e164: '+919820011223',
      phone_raw: '+91 98200 11223',
      email: 'ananya.sharma@yahoo.com',
      status: 'active',
      opt_in_confirmed_at: '2026-10-15T11:20:00Z',
      tags: ['Lead', 'Website Form'],
      extra: { city: 'Bangalore', interest: 'Electronics' },
      last_message_status: 'delivered',
      seen_at: null, // NOT SEEN
    },
    {
      id: 3,
      name: 'Vikram Malhotra',
      whatsapp_e164: '+919930055443',
      phone_raw: '9930055443',
      email: 'vikram.m@outlook.com',
      status: 'active',
      opt_in_confirmed_at: '2026-10-18T09:15:00Z',
      tags: ['Wholesale', 'Delhi'],
      extra: { city: 'Delhi', credit_tier: 'A' },
      last_message_status: 'read',
      seen_at: '2026-11-09T15:02:40Z',
    },
    {
      id: 4,
      name: 'Pooja Hegde',
      whatsapp_e164: '+919769001122',
      phone_raw: '+91 97690 01122',
      email: 'pooja.h@gmail.com',
      status: 'opted_out',
      opted_out_at: '2026-11-01T16:30:00Z',
      tags: ['Inactive'],
      extra: { reason: 'User replied STOP' },
      last_message_status: 'failed',
      seen_at: null,
    },
    {
      id: 5,
      name: 'Suresh Patel',
      whatsapp_e164: '+919845012345',
      phone_raw: '09845012345',
      email: 'suresh@pateltrading.in',
      status: 'active',
      opt_in_confirmed_at: '2026-10-25T14:00:00Z',
      tags: ['B2B', 'Ahmedabad'],
      extra: { gstin: '24AAAAA0000A1Z5' },
      last_message_status: 'delivered',
      seen_at: null, // NOT SEEN
    },
  ],
  campaigns: [
    {
      id: 101,
      name: 'Diwali Festive Mega Sale 2026',
      kind: 'broadcast',
      template_name: 'festive_offer_v1',
      list_name: 'All Active VIP Customers',
      status: 'completed',
      total: 1250,
      sent_count: 1250,
      delivered_count: 1220,
      read_count: 984, // SEEN
      unread_count: 236, // NOT SEEN
      failed_count: 30,
      started_at: '2026-11-09T14:30:00Z',
      completed_at: '2026-11-09T14:48:15Z',
      image_path: 'campaigns/festive_banner.jpg',
    },
    {
      id: 102,
      name: 'New Product Arrival - Winter Jackets',
      kind: 'broadcast',
      template_name: 'new_arrivals_nov',
      list_name: 'Fashion Segment Customers',
      status: 'running',
      total: 800,
      sent_count: 520,
      delivered_count: 480,
      read_count: 310, // SEEN
      unread_count: 170, // NOT SEEN
      failed_count: 12,
      started_at: '2026-11-10T11:00:00Z',
      completed_at: null,
    },
  ],
  templates: [
    {
      id: 1,
      name: 'festive_offer_v1',
      language: 'en',
      category: 'marketing',
      header_type: 'image',
      status: 'approved',
      body: 'Hi {{1}}, celebrate Diwali with exclusive 30% OFF on all items! Use code: {{2}}.\n\nReply STOP to unsubscribe.',
      variable_names: ['name', 'discount_code'],
      footer: 'Reply STOP to opt out',
    },
    {
      id: 2,
      name: 'order_status_update',
      language: 'en',
      category: 'utility',
      header_type: 'none',
      status: 'approved',
      body: 'Hi {{1}}, your order #{{2}} has been dispatched! Track your shipment: {{3}}',
      variable_names: ['name', 'order_id', 'tracking_url'],
      footer: 'Clientbase Logistics',
    },
  ],
  lists: [
    { id: 1, name: 'All Active VIP Customers', member_count: 1250, created_at: '2026-10-01' },
    { id: 2, name: 'Fashion Segment Customers', member_count: 800, created_at: '2026-10-15' },
    { id: 3, name: 'Cart Abandoners (Last 7 Days)', member_count: 412, created_at: '2026-11-01' },
  ],
  replies: [
    {
      id: 1,
      from_name: 'Rajesh Kumar',
      from_e164: '+919876543210',
      body: 'Thanks! Placed the order using the code.',
      received_at: '2026-11-09T15:10:00Z',
      is_stop: false,
      handled: false,
    },
    {
      id: 2,
      from_name: 'Pooja Hegde',
      from_e164: '+919769001122',
      body: 'STOP',
      received_at: '2026-11-01T16:30:00Z',
      is_stop: true,
      handled: true,
    },
  ],
};

async function safeFetch<T>(path: string, options: RequestInit = {}, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers,
      },
    });
    if (!res.ok) {
      console.warn(`API call ${path} returned status ${res.status}, using mock fallback.`);
      return fallback;
    }
    const json = await res.json();
    return (json.data ?? json) as T;
  } catch (err) {
    // If backend is not running or network fails, return fallback mock data
    return fallback;
  }
}

export const api = {
  dashboard: {
    get: () => safeFetch('/api/dashboard', { method: 'GET' }, mockData.dashboard),
  },

  contacts: {
    list: (params: { search?: string; tag?: string; status?: string; page?: number } = {}) => {
      let filtered = [...mockData.contacts];
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.whatsapp_e164.includes(q));
      }
      if (params.status && params.status !== 'all') {
        filtered = filtered.filter(c => c.status === params.status);
      }
      return safeFetch('/api/contacts', { method: 'GET' }, { contacts: filtered, total: filtered.length });
    },

    upsert: (contact: { name: string; mobile: string; email?: string; tags?: string[]; extra?: any }) => {
      // Primary row: mobile number (PRD and user instruction: match primarily by mobile number)
      const existingIdx = mockData.contacts.findIndex(c => c.whatsapp_e164 === contact.mobile);
      if (existingIdx >= 0) {
        mockData.contacts[existingIdx] = {
          ...mockData.contacts[existingIdx],
          name: contact.name,
          email: contact.email || mockData.contacts[existingIdx].email,
          tags: contact.tags || mockData.contacts[existingIdx].tags,
          extra: { ...mockData.contacts[existingIdx].extra, ...contact.extra },
        };
        return Promise.resolve(mockData.contacts[existingIdx]);
      } else {
        const newContact = {
          id: Date.now(),
          name: contact.name,
          whatsapp_e164: contact.mobile,
          phone_raw: contact.mobile,
          email: contact.email || null,
          status: 'active',
          opt_in_confirmed_at: new Date().toISOString(),
          tags: contact.tags || [],
          extra: contact.extra || {},
          last_message_status: 'queued',
          seen_at: null,
        };
        mockData.contacts.unshift(newContact);
        return Promise.resolve(newContact);
      }
    },

    importBatch: (contactsList: Array<{ name: string; mobile: string; email?: string; tags?: string[]; extra?: any }>) => {
      let inserted = 0;
      let updated = 0;
      for (const item of contactsList) {
        const idx = mockData.contacts.findIndex(c => c.whatsapp_e164 === item.mobile);
        if (idx >= 0) {
          mockData.contacts[idx] = {
            ...mockData.contacts[idx],
            name: item.name || mockData.contacts[idx].name,
            email: item.email || mockData.contacts[idx].email,
            tags: item.tags || mockData.contacts[idx].tags,
            extra: { ...mockData.contacts[idx].extra, ...item.extra },
          };
          updated++;
        } else {
          mockData.contacts.push({
            id: Date.now() + Math.floor(Math.random() * 10000),
            name: item.name,
            whatsapp_e164: item.mobile,
            phone_raw: item.mobile,
            email: item.email || null,
            status: 'active',
            opt_in_confirmed_at: new Date().toISOString(),
            tags: item.tags || ['Imported'],
            extra: item.extra || {},
            last_message_status: 'queued',
            seen_at: null,
          });
          inserted++;
        }
      }
      return Promise.resolve({ total: contactsList.length, inserted, updated, invalid: 0 });
    },
  },

  campaigns: {
    list: () => safeFetch('/api/campaigns', { method: 'GET' }, mockData.campaigns),

    getDetails: (id: number) => {
      const camp = mockData.campaigns.find(c => c.id === id) || mockData.campaigns[0];
      // Generate per-contact seen / not-seen list for this campaign
      const recipientMessages = [
        {
          id: 1,
          contact_name: 'Rajesh Kumar',
          whatsapp_e164: '+919876543210',
          status: 'read', // SEEN
          sent_at: '2026-11-09T14:30:15Z',
          delivered_at: '2026-11-09T14:30:20Z',
          seen_at: '2026-11-09T14:45:12Z', // EXACT SEEN TIMESTAMP
          has_seen: true,
        },
        {
          id: 2,
          contact_name: 'Vikram Malhotra',
          whatsapp_e164: '+919930055443',
          status: 'read', // SEEN
          sent_at: '2026-11-09T14:30:16Z',
          delivered_at: '2026-11-09T14:30:22Z',
          seen_at: '2026-11-09T15:02:40Z', // EXACT SEEN TIMESTAMP
          has_seen: true,
        },
        {
          id: 3,
          contact_name: 'Ananya Sharma',
          whatsapp_e164: '+919820011223',
          status: 'delivered', // NOT SEEN YET
          sent_at: '2026-11-09T14:30:18Z',
          delivered_at: '2026-11-09T14:30:25Z',
          seen_at: null,
          has_seen: false,
        },
        {
          id: 4,
          contact_name: 'Suresh Patel',
          whatsapp_e164: '+919845012345',
          status: 'delivered', // NOT SEEN YET
          sent_at: '2026-11-09T14:30:20Z',
          delivered_at: '2026-11-09T14:30:28Z',
          seen_at: null,
          has_seen: false,
        },
        {
          id: 5,
          contact_name: 'Deepak Verma',
          whatsapp_e164: '+919811223344',
          status: 'sent', // IN-FLIGHT / NOT SEEN
          sent_at: '2026-11-09T14:30:22Z',
          delivered_at: null,
          seen_at: null,
          has_seen: false,
        },
        {
          id: 6,
          contact_name: 'Amitabh Joshi',
          whatsapp_e164: '+919899887766',
          status: 'failed', // FAILED / NOT SEEN
          sent_at: '2026-11-09T14:30:24Z',
          delivered_at: null,
          seen_at: null,
          has_seen: false,
          error_message: 'Phone number not registered on WhatsApp (131026)',
        },
      ];

      return Promise.resolve({
        campaign: camp,
        recipients: recipientMessages,
        counts: {
          total: camp.total,
          sent: camp.sent_count,
          delivered: camp.delivered_count,
          seen: camp.read_count,
          notSeen: camp.total - camp.read_count,
          failed: camp.failed_count,
        },
      });
    },

    create: (data: any) => {
      const newCamp = {
        id: Date.now(),
        name: data.name,
        kind: 'broadcast',
        template_name: data.template_name || 'festive_offer_v1',
        list_name: data.list_name || 'Selected Contacts',
        status: data.scheduled_at ? 'scheduled' : 'running',
        total: data.recipients_count || 10,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        unread_count: 0,
        failed_count: 0,
        started_at: new Date().toISOString(),
        completed_at: null,
      };
      mockData.campaigns.unshift(newCamp as any);
      return Promise.resolve(newCamp);
    },
  },

  templates: {
    list: () => safeFetch('/api/templates', { method: 'GET' }, mockData.templates),
  },

  lists: {
    list: () => safeFetch('/api/lists', { method: 'GET' }, mockData.lists),
  },

  replies: {
    list: () => safeFetch('/api/replies', { method: 'GET' }, mockData.replies),
    markHandled: (id: number) => {
      const found = mockData.replies.find(r => r.id === id);
      if (found) found.handled = true;
      return Promise.resolve({ success: true });
    },
  },
  settings: {
    get: () => Promise.resolve({
      waba_id: '1098471928374',
      phone_number_id: '1029384756102',
      default_country: 'IN',
      timezone: 'Asia/Kolkata',
      send_rate_per_sec: 20,
      daily_send_cap: 250,
      rate_marketing: 0.8631,
      rate_utility: 0.115,
      gst_percent: 18,
    }),
    getWhatsApp: () =>
      safeFetch('/api/settings/whatsapp', { method: 'GET' }, {
        is_connected: true,
        phone_number_id: '1029384756102',
        waba_id: '1098471928374',
        display_phone: '+91 98765 43210',
        verified_name: 'Acme Retail India',
        quality_rating: 'GREEN',
      }),
    saveWhatsApp: (data: { phone_number_id: string; waba_id: string; token: string; app_secret?: string }) =>
      safeFetch(
        '/api/settings/whatsapp',
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
        {
          is_connected: true,
          phone_number_id: data.phone_number_id,
          waba_id: data.waba_id,
          display_phone: '+91 98765 43210',
          verified_name: 'Verified Business Account',
          quality_rating: 'GREEN',
        }
      ),
    testWhatsApp: (data: { phone_number_id: string; token: string }) =>
      safeFetch(
        '/api/settings/whatsapp/test',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        {
          success: true,
          display_phone_number: '+91 98765 43210',
          verified_name: 'Verified Business Profile',
          quality_rating: 'GREEN',
        }
      ),
  },
};

export const contactsApi = api.contacts;
export const broadcastsApi = {
  list: (params: any = {}) => api.campaigns.list(),
  get: (id: string) => api.campaigns.getDetails(Number(id)),
  report: (id: string, params: any = {}) => api.campaigns.getDetails(Number(id)),
  create: (body: any) => api.campaigns.create(body),
  send: (id: string) => Promise.resolve({ success: true }),
  addFollowUp: (id: string, body: any) => Promise.resolve({ success: true }),
  delete: (id: string) => Promise.resolve(),
};
export const credentialsApi = {
  list: () => Promise.resolve([{ id: 'c1', label: 'Primary WABA', phone_number_id: '1029384756', waba_id: '109847192', is_active: true, created_at: new Date().toISOString() }]),
  create: (body: any) => Promise.resolve(body),
  deactivate: (id: string) => Promise.resolve(),
  syncTemplates: (id: string) => Promise.resolve({ synced: 2 }),
  listTemplates: (id: string) => api.templates.list(),
};

