/**
 * ReachFlow API Client
 * Strict multi-tenant backend client:
 * - Uses VITE_API_URL environment variable
 * - Authenticated with Supabase JWT
 * - Strictly zero mock fallbacks, zero demo-tokens, zero fabricated localStorage stats
 */

function resolveApiBase(): string {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  // Auto-correct Render missing suffix or empty value
  if (!envUrl || envUrl === 'https://wa-backend.onrender.com' || envUrl === 'http://wa-backend.onrender.com') {
    return 'https://wa-backend-ayta.onrender.com';
  }
  return envUrl.replace(/\/$/, '');
}

export const API_BASE: string = resolveApiBase();

function getHeaders(isFormData = false): HeadersInit {
  const token = localStorage.getItem('sb-token') || '';
  const orgId = localStorage.getItem('active-org-id') || '';

  const headers: Record<string, string> = {
    'Authorization': token ? `Bearer ${token}` : '',
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (orgId) {
    headers['X-Org-Id'] = orgId;
  }

  return headers;
}

async function request<T>(path: string, options: RequestInit = {}, isFormData = false): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = getHeaders(isFormData);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });
  } catch (networkErr: any) {
    throw new Error(
      `Network error connecting to backend (${API_BASE}): ${networkErr?.message || 'Connection failed'}. If the backend is waking from sleep, please retry in a few seconds.`
    );
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    let errorMsg =
      json?.error?.message ||
      (typeof json?.error === 'string' ? json?.error : '') ||
      json?.message;

    if (!errorMsg && json?.error?.issues && Array.isArray(json.error.issues)) {
      errorMsg = json.error.issues.map((i: any) => `${i.path?.join('.')}: ${i.message}`).join(', ');
    }

    if (!errorMsg) {
      errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    }

    const err: any = new Error(errorMsg);
    err.code = json?.error?.code || 'API_ERROR';
    err.status = res.status;
    throw err;
  }

  return (json?.data !== undefined ? json.data : json) as T;
}

export const api = {
  // ── Dashboard (Real Numbers Only) ───────────────────────────────────────────
  dashboard: {
    getStats: () => request<any>('/api/dashboard'),
  },

  // ── Campaigns ───────────────────────────────────────────────────────────────
  campaigns: {
    list: () => request<any[]>('/api/campaigns'),
    getProgress: (id: string | number) => request<any>(`/api/campaigns/${id}/progress`),
    getMessages: (id: string | number, params?: { status?: string; page?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      return request<{ data: any[]; total: number; page: number; limit: number }>(`/api/campaigns/${id}/messages?${q.toString()}`);
    },
    create: (formData: FormData) =>
      request<any>('/api/campaigns', { method: 'POST', body: formData }, true),
    pause: (id: string | number) => request<any>(`/api/campaigns/${id}/pause`, { method: 'POST' }),
    resume: (id: string | number) => request<any>(`/api/campaigns/${id}/resume`, { method: 'POST' }),
    cancel: (id: string | number) => request<any>(`/api/campaigns/${id}/cancel`, { method: 'POST' }),
    retryFailed: (id: string | number) => request<any>(`/api/campaigns/${id}/retry-failed`, { method: 'POST' }),
  },

  // ── Templates ───────────────────────────────────────────────────────────────
  templates: {
    list: () => request<any[]>('/api/templates'),
    sync: () => request<{ success: boolean; synced: number }>('/api/templates/sync', { method: 'POST' }),
  },

  // ── Contacts ────────────────────────────────────────────────────────────────
  contacts: {
    list: (params?: { search?: string; status?: string; list_id?: number; page?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.status) q.set('status', params.status);
      if (params?.list_id) q.set('list_id', String(params.list_id));
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      return request<{ data: any[]; total: number; page: number; limit: number }>(`/api/contacts?${q.toString()}`);
    },
    selectable: (listId?: number) =>
      request<{ data: any[]; total: number }>(`/api/contacts/selectable${listId ? `?list_id=${listId}` : ''}`),
    create: (data: { name: string; phone: string; email?: string; consent_confirmed: boolean; opt_in_source?: string; list_ids?: number[] }) =>
      request<any>('/api/contacts', { method: 'POST', body: JSON.stringify(data) }),
    import: (formData: FormData) =>
      request<any>('/api/contacts/import', { method: 'POST', body: formData }, true),
    optOut: (id: string | number) => request<any>(`/api/contacts/${id}/opt-out`, { method: 'POST' }),
    delete: (id: string | number) => request<any>(`/api/contacts/${id}`, { method: 'DELETE' }),
    lists: () => request<any[]>('/api/contacts/lists/all'),
    createList: (name: string) =>
      request<any>('/api/contacts/lists', { method: 'POST', body: JSON.stringify({ name }) }),
  },

  // ── Replies ─────────────────────────────────────────────────────────────────
  replies: {
    list: () => request<any[]>('/api/replies'),
    send: (data: { to: string; text: string; contact_id?: number }) =>
      request<any>('/api/replies/send', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  settings: {
    getWhatsApp: () => request<any>('/api/settings/whatsapp'),
    saveWhatsApp: async (data: {
      phone_number_id: string;
      waba_id: string;
      token: string;
      app_secret?: string;
      forward_enabled?: boolean;
      forward_to_e164?: string;
      forward_template_name?: string;
      forward_template_language?: string;
    }) => {
      try {
        return await request<any>('/api/settings/whatsapp', { method: 'POST', body: JSON.stringify(data) });
      } catch (err: any) {
        if (err.status === 404) {
          return await request<any>('/api/settings/whatsapp', { method: 'PUT', body: JSON.stringify(data) });
        }
        throw err;
      }
    },
    disconnectWhatsApp: () => request<any>('/api/settings/whatsapp', { method: 'DELETE' }),
    testWhatsApp: (data?: { phone_number_id?: string; token?: string }) =>
      request<any>('/api/settings/whatsapp/test', { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
    subscribeWaba: (data?: { waba_id?: string; token?: string }) =>
      request<any>('/api/settings/whatsapp/subscribe-waba', { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  },
};
