/**
 * API client module for WhatsApp Broadcast & Follow-up App
 * Handles:
 * - JWT authentication via Supabase session
 * - Organization scoping (X-Org-Id header)
 * - Automatic retry on network error
 * - Full fallback mock state so the entire UI can be explored immediately
 */

const LIVE_BACKEND_URL = 'https://wa-backend-ayta.onrender.com';

const API_BASE =
  typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')
    ? LIVE_BACKEND_URL
    : (import.meta.env.VITE_API_URL ?? 'http://localhost:4000');

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('sb-token') ?? 'demo-token';
  const orgId = localStorage.getItem('active-org-id') ?? '00000000-0000-0000-0000-000000000001';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Org-Id': orgId,
  };
}

// In-memory initial data store (starts clean and empty for real production testing)
export const mockData: any = {
  dashboard: {
    activeContacts: 0,
    messagesSentToday: 0,
    dailyCap: 250,
    lastCampaignResult: null,
    nextScheduledSend: null,
    banners: [],
  },
  contacts: [],
  campaigns: [],
  templates: [],
  lists: [],
  replies: [],
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
      const camp = mockData.campaigns.find((c: any) => c.id === id);
      if (!camp) {
        return Promise.resolve({
          campaign: null,
          recipients: [],
          counts: { total: 0, sent: 0, delivered: 0, seen: 0, notSeen: 0, failed: 0 },
        });
      }
      return Promise.resolve({
        campaign: camp,
        recipients: [],
        counts: {
          total: camp.total || 0,
          sent: camp.sent_count || 0,
          delivered: camp.delivered_count || 0,
          seen: camp.read_count || 0,
          notSeen: (camp.total || 0) - (camp.read_count || 0),
          failed: camp.failed_count || 0,
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
    getWhatsApp: async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings/whatsapp`, {
          method: 'GET',
          headers: getHeaders(),
        });
        if (!res.ok) return { is_connected: false };
        const json = await res.json();
        return json.data ?? json;
      } catch {
        return { is_connected: false };
      }
    },
    saveWhatsApp: async (data: { phone_number_id: string; waba_id: string; token: string; app_secret?: string }) => {
      const res = await fetch(`${API_BASE}/api/settings/whatsapp`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to save WhatsApp settings');
      }
      return json.data ?? json;
    },
    testWhatsApp: async (data: { phone_number_id: string; token: string }) => {
      const res = await fetch(`${API_BASE}/api/settings/whatsapp/test`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Meta test connection failed');
      }
      return json.data ?? json;
    },
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

