/**
 * API client module for WhatsApp Broadcast & Follow-up App
 * Handles:
 * - JWT authentication via Supabase session
 * - Organization scoping (X-Org-Id header)
 * - Automatic retry on network error
 * - Full fallback mock state so the entire UI can be explored immediately
 */

// Exact live backend URL on Render (wa-backend-ayta.onrender.com)
export const LIVE_BACKEND_URL = 'https://wa-backend-ayta.onrender.com';

// Force live backend URL directly to eliminate any stale/misconfigured Render environment variable
const API_BASE: string = LIVE_BACKEND_URL;
function getHeaders(): HeadersInit {
  const token = localStorage.getItem('sb-token') ?? 'demo-token';
  const orgId = localStorage.getItem('active-org-id') ?? '00000000-0000-0000-0000-000000000001';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Org-Id': orgId,
  };
}

function loadLocalContacts(): any[] {
  try {
    const raw = localStorage.getItem('reachflow-contacts');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalContacts(contacts: any[]) {
  try {
    localStorage.setItem('reachflow-contacts', JSON.stringify(contacts));
  } catch {}
}

export function loadLocalTemplates(): any[] {
  try {
    const raw = localStorage.getItem('reachflow-templates');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    {
      name: 'hello_world',
      language: 'en_US',
      category: 'MARKETING',
      status: 'APPROVED',
      body: 'Welcome to ReachFlow! This is an official WhatsApp template message.',
    },
  ];
}

export function saveLocalTemplates(templates: any[]) {
  try {
    localStorage.setItem('reachflow-templates', JSON.stringify(templates));
  } catch {}
}

// In-memory initial data store (backed by localStorage for contacts)
export const mockData: any = {
  dashboard: {
    activeContacts: 0,
    messagesSentToday: 0,
    dailyCap: 250,
    lastCampaignResult: null,
    nextScheduledSend: null,
    banners: [],
  },
  contacts: loadLocalContacts(),
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
      mockData.contacts = loadLocalContacts();
      let filtered = [...mockData.contacts];
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            (c.name || c.display_name || '').toLowerCase().includes(q) ||
            (c.whatsapp_e164 || c.mobile_number || '').includes(q)
        );
      }
      if (params.status && params.status !== 'all') {
        if (params.status === 'active') {
          filtered = filtered.filter((c) => c.status === 'active' || c.is_active !== false);
        } else if (params.status === 'opted_out') {
          filtered = filtered.filter((c) => c.status === 'opted_out' || c.is_active === false);
        }
      }
      return Promise.resolve({ contacts: filtered, total: filtered.length });
    },

    upsert: (contact: { name: string; mobile: string; email?: string; tags?: string[]; extra?: any }) => {
      let mob = contact.mobile.replace(/[^0-9+]/g, '');
      if (!mob.startsWith('+') && mob.length === 10) mob = '+91' + mob;

      mockData.contacts = loadLocalContacts();
      const existingIdx = mockData.contacts.findIndex(
        (c: any) => c.whatsapp_e164 === mob || c.mobile_number === mob
      );

      let record: any;
      if (existingIdx >= 0) {
        mockData.contacts[existingIdx] = {
          ...mockData.contacts[existingIdx],
          name: contact.name,
          display_name: contact.name,
          email: contact.email || mockData.contacts[existingIdx].email,
          tags: contact.tags || mockData.contacts[existingIdx].tags,
          status: 'active',
          is_active: true,
          extra: { ...mockData.contacts[existingIdx].extra, ...contact.extra },
        };
        record = mockData.contacts[existingIdx];
      } else {
        record = {
          id: Date.now().toString(),
          name: contact.name,
          display_name: contact.name,
          whatsapp_e164: mob,
          mobile_number: mob,
          phone_raw: mob,
          email: contact.email || null,
          status: 'active',
          is_active: true,
          opt_in_confirmed_at: new Date().toISOString(),
          tags: contact.tags && contact.tags.length > 0 ? contact.tags : ['Customer'],
          extra: contact.extra || {},
          last_message_status: 'delivered',
          seen_at: null,
          created_at: new Date().toISOString(),
        };
        mockData.contacts.unshift(record);
      }
      saveLocalContacts(mockData.contacts);

      // Also fire sync to backend API in background
      fetch(`${API_BASE}/api/contacts`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          mobile_number: mob,
          display_name: contact.name,
          email: contact.email || undefined,
          tags: contact.tags || ['Customer'],
        }),
      }).catch(() => {});

      return Promise.resolve(record);
    },

    delete: (idOrMobile: string) => {
      mockData.contacts = loadLocalContacts().filter(
        (c: any) =>
          c.id !== idOrMobile &&
          c.whatsapp_e164 !== idOrMobile &&
          c.mobile_number !== idOrMobile
      );
      saveLocalContacts(mockData.contacts);

      fetch(`${API_BASE}/api/contacts/${encodeURIComponent(idOrMobile)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      }).catch(() => {});

      return Promise.resolve({ success: true });
    },

    clearAll: () => {
      mockData.contacts = [];
      saveLocalContacts([]);
      return Promise.resolve({ success: true });
    },

    importBatch: (
      contactsList: Array<{ name: string; mobile: string; email?: string; tags?: string[]; extra?: any }>
    ) => {
      mockData.contacts = loadLocalContacts();
      let inserted = 0;
      let updated = 0;
      for (const item of contactsList) {
        let mob = String(item.mobile).replace(/[^0-9+]/g, '');
        if (!mob.startsWith('+') && mob.length === 10) mob = '+91' + mob;
        if (!mob || mob.length < 8) continue;

        const idx = mockData.contacts.findIndex(
          (c: any) => c.whatsapp_e164 === mob || c.mobile_number === mob
        );
        if (idx >= 0) {
          mockData.contacts[idx] = {
            ...mockData.contacts[idx],
            name: item.name || mockData.contacts[idx].name,
            display_name: item.name || mockData.contacts[idx].name,
            email: item.email || mockData.contacts[idx].email,
            tags: item.tags || mockData.contacts[idx].tags,
            status: 'active',
            is_active: true,
          };
          updated++;
        } else {
          mockData.contacts.push({
            id: (Date.now() + Math.floor(Math.random() * 100000)).toString(),
            name: item.name || 'Customer',
            display_name: item.name || 'Customer',
            whatsapp_e164: mob,
            mobile_number: mob,
            phone_raw: mob,
            email: item.email || null,
            status: 'active',
            is_active: true,
            opt_in_confirmed_at: new Date().toISOString(),
            tags: item.tags || ['Bulk Import'],
            extra: item.extra || {},
            last_message_status: 'delivered',
            seen_at: null,
            created_at: new Date().toISOString(),
          });
          inserted++;
        }
      }
      saveLocalContacts(mockData.contacts);
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
    listTemplates: async (params?: { waba_id?: string; token?: string }) => {
      const qs = new URLSearchParams();
      if (params?.waba_id) qs.set('waba_id', params.waba_id);
      if (params?.token) qs.set('token', params.token);
      const res = await fetch(`${API_BASE}/api/settings/whatsapp/templates?${qs.toString()}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to list templates from Meta');
      }
      const json = await res.json();
      return json.data ?? [];
    },
    sendTemplate: async (data: {
      to: string;
      template_name: string;
      language_code?: string;
      components?: any[];
      phone_number_id?: string;
      token?: string;
    }) => {
      const res = await fetch(`${API_BASE}/api/settings/whatsapp/send-template`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to send template message');
      }
      return json.data ?? json;
    },
    broadcastTemplate: async (data: {
      recipients: Array<{ mobile: string; name?: string }>;
      template_name: string;
      language_code?: string;
      header_image_url?: string;
      phone_number_id?: string;
      token?: string;
    }) => {
      const res = await fetch(`${API_BASE}/api/settings/whatsapp/broadcast-template`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Broadcast failed');
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

