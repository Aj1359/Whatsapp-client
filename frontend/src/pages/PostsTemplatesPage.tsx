import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, loadLocalTemplates, saveLocalTemplates } from '../lib/api';
import {
  Send,
  Plus,
  Repeat,
  Image as ImageIcon,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  RefreshCw,
  Smartphone,
  Check,
  AlertCircle,
  Users,
  Play,
} from 'lucide-react';

interface MetaTemplate {
  name: string;
  language: string;
  category?: string;
  status?: string;
  body?: string;
  header_type?: 'none' | 'image' | 'text';
  header_url?: string;
  id?: string;
}

interface BroadcastHistory {
  id: string;
  date: string;
  title: string;
  template_name: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  error_message?: string;
  status: 'sent' | 'scheduled' | 'failed';
}

export default function PostsTemplatesPage() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<MetaTemplate[]>(loadLocalTemplates());
  const [history, setHistory] = useState<BroadcastHistory[]>(() => {
    try {
      const raw = localStorage.getItem('reachflow-broadcast-history');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const [activeCustomers, setActiveCustomers] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);

  // Modals
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Loaders & feedback
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    // Load active contacts for broadcast targeting
    api.contacts.list({ status: 'active' }).then((res: any) => {
      const list = res.contacts ?? res ?? [];
      setActiveCustomers(list);
    });
  }, []);

  const handleSaveTemplates = (newTemplates: MetaTemplate[]) => {
    setTemplates(newTemplates);
    saveLocalTemplates(newTemplates);
  };

  const handleSyncFromMeta = async () => {
    setSyncing(true);
    try {
      const metaCreds = JSON.parse(localStorage.getItem('reachflow-active-wa') || '{}');
      const remoteList = await api.settings.listTemplates({
        waba_id: metaCreds.waba_id || '1360714332762492',
        token: metaCreds.token || undefined,
      });

      if (Array.isArray(remoteList) && remoteList.length > 0) {
        const formatted: MetaTemplate[] = remoteList.map((t: any) => {
          let bodyText = '';
          const bodyComp = (t.components || []).find((c: any) => c.type === 'BODY');
          if (bodyComp) bodyText = bodyComp.text || '';
          const hasHeader = (t.components || []).some((c: any) => c.type === 'HEADER');
          const hasBodyVars = /\{\{\d+\}\}/.test(bodyText);
          return {
            name: t.name,
            language: t.language || 'en',
            category: t.category || 'MARKETING',
            status: t.status || 'APPROVED',
            body: bodyText || `Meta template: ${t.name}`,
            header_type: hasHeader ? 'image' : 'none',
            header_url: hasHeader ? 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?w=800' : undefined,
          };
        });

        handleSaveTemplates(formatted);
        showToast(`Synced ${formatted.length} templates directly from Meta!`);
      } else {
        showToast('No templates returned from Meta. You can connect your template by name below.', 'error');
      }
    } catch (err: any) {
      showToast(`Meta Sync: ${err.message}. You can connect your template by name below.`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 border animate-in fade-in ${
            toast.type === 'error'
              ? 'bg-red-950 text-red-100 border-red-500'
              : 'bg-gray-900 text-white border-emerald-500'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={16} className="text-red-400" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            WhatsApp Posts & Meta Templates
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Connect approved Meta templates using their Template Name, test individual sends, and broadcast to your customer base.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSyncFromMeta}
            disabled={syncing}
            className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync from Meta WABA'}
          </button>
          <button
            onClick={() => setShowConnectModal(true)}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={14} /> Connect Meta Template
          </button>
        </div>
      </div>

      {/* Meta Template Banner Info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-emerald-950">
              Create Templates in Meta &rarr; Connect Using Template Name in ReachFlow
            </h3>
            <p className="text-[11px] text-emerald-800">
              Once you create and submit a template in <strong>Meta WhatsApp Manager</strong>, enter its approved <strong>Template Name</strong> (e.g. <code>summer_offer</code>) here. ReachFlow will dispatch it automatically to each customer via WhatsApp Cloud API.
            </p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-emerald-900 shrink-0">
          <span>Active Customers Ready: {activeCustomers.length}</span>
        </div>
      </div>

      {/* Connected Templates Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <Smartphone size={16} className="text-whatsapp-teal" />
            Connected Meta Templates ({templates.length})
          </h2>
          <button
            onClick={() => {
              const defaultTmpl: MetaTemplate = {
                name: 'hello_world',
                language: 'en_US',
                category: 'MARKETING',
                status: 'APPROVED',
                body: 'Welcome and congratulations! This pre-approved Meta message confirms your WhatsApp Business Cloud API integration is live and working.',
              };
              const exists = templates.some((t) => t.name === 'hello_world');
              if (!exists) {
                handleSaveTemplates([...templates, defaultTmpl]);
                showToast('Added pre-approved "hello_world" test template!');
              } else {
                showToast('"hello_world" template is already in your list.');
              }
            }}
            className="text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition self-start sm:self-auto"
          >
            <Sparkles size={13} /> Add Pre-Approved "hello_world" Test Template
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="card p-10 text-center border-dashed border-2 border-gray-200 space-y-3">
            <p className="text-xs text-gray-500">No Meta templates connected yet.</p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="btn-primary text-xs px-4 py-2"
            >
              + Connect Your Approved Meta Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map((t, idx) => (
              <div
                key={t.name + idx}
                className="card p-5 hover:border-emerald-500/50 transition shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded">
                      {t.name}
                    </span>
                    {t.status === 'APPROVED' ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={11} /> APPROVED
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1" title="Meta is still reviewing this template. Messages cannot be sent until approved.">
                        <Clock size={11} /> PENDING IN META
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-gray-500 flex items-center gap-3">
                    <span>Language: <strong className="font-mono text-gray-700">{t.language}</strong></span>
                    <span>Category: <strong className="text-gray-700">{t.category || 'MARKETING'}</strong></span>
                  </div>

                  {/* Message Bubble Preview */}
                  <div className="bg-[#ECE5DD] p-3 rounded-xl border border-gray-300 text-xs text-gray-800 leading-relaxed max-h-44 overflow-y-auto whitespace-pre-line shadow-inner space-y-2">
                    {t.header_type === 'image' && (
                      <div className="relative group">
                        {t.header_url ? (
                          <img
                            src={t.header_url}
                            alt="Header"
                            className="w-full h-24 object-cover rounded border"
                          />
                        ) : (
                          <div className="h-16 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-[11px]">
                            Image Header Template
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const newUrl = prompt('Enter custom Image URL for this template header:', t.header_url || '');
                            if (newUrl !== null) {
                              const updated = templates.map((tmpl) =>
                                tmpl.name === t.name ? { ...tmpl, header_url: newUrl.trim() || undefined } : tmpl
                              );
                              handleSaveTemplates(updated);
                            }
                          }}
                          className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white text-[10px] px-2 py-0.5 rounded shadow transition"
                        >
                          Change Picture
                        </button>
                      </div>
                    )}
                    <div>{t.body || `Hello {{1}}, here is your WhatsApp message from ${t.name}.`}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedTemplate(t);
                      setShowTestModal(true);
                    }}
                    className="btn-secondary text-xs px-3 py-1.5 flex-1 text-center"
                    title="Send a live test to 1 WhatsApp number"
                  >
                    Test Send (1)
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTemplate(t);
                      setShowBroadcastModal(true);
                    }}
                    className="btn-primary text-xs px-3 py-1.5 flex-1 flex items-center justify-center gap-1"
                    title="Broadcast to active customer database"
                  >
                    <Send size={12} /> Broadcast
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Broadcast History */}
      <div className="space-y-4 pt-4 border-t">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
          <Calendar size={16} className="text-whatsapp-teal" />
          Broadcast History (Day by Day)
        </h2>

        {history.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-xs">
            No broadcast history yet. Run a template test or dispatch to customers to see delivery logs here.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div
                key={h.id}
                className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm hover:border-gray-300 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{h.title}</span>
                    <span className="font-mono text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      Template: {h.template_name}
                    </span>
                    <span className="text-[10px] text-gray-400">{h.date}</span>
                  </div>
                  <div className="text-xs text-gray-600 flex flex-wrap items-center gap-3">
                    <span>Recipients: <strong>{h.total_recipients}</strong></span>
                    <span className="text-emerald-700">Sent: <strong>{h.sent_count}</strong></span>
                    {h.failed_count > 0 && (
                      <span className="text-red-600">Failed: <strong>{h.failed_count}</strong></span>
                    )}
                    {h.error_message && (
                      <span className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded font-sans">
                        Reason: {h.error_message}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    const tmpl = templates.find((t) => t.name === h.template_name) || {
                      name: h.template_name,
                      language: 'en',
                    };
                    setSelectedTemplate(tmpl);
                    setShowBroadcastModal(true);
                  }}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  <Repeat size={12} /> Repeat Broadcast
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect Template Modal */}
      {showConnectModal && (
        <ConnectTemplateModal
          onClose={() => setShowConnectModal(false)}
          onConnected={(newTmpl) => {
            setShowConnectModal(false);
            const updated = [newTmpl, ...templates.filter((t) => t.name !== newTmpl.name)];
            handleSaveTemplates(updated);
            showToast(`Connected Meta template "${newTmpl.name}"!`);
          }}
        />
      )}

      {/* Test Send Modal (1 Recipient) */}
      {showTestModal && selectedTemplate && (
        <TestSendModal
          template={selectedTemplate}
          onClose={() => setShowTestModal(false)}
          onSent={(res) => {
            setShowTestModal(false);
            showToast(`Test message sent successfully! WA ID: ${res.wa_message_id || 'OK'}`);
          }}
        />
      )}

      {/* Bulk Broadcast Modal (Active Customers) */}
      {showBroadcastModal && selectedTemplate && (
        <BroadcastModal
          template={selectedTemplate}
          activeCount={activeCustomers.length}
          customers={activeCustomers}
          onClose={() => setShowBroadcastModal(false)}
          onDispatched={(summary) => {
            setShowBroadcastModal(false);
            const newHistory: BroadcastHistory = {
              id: Date.now().toString(),
              date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
              title: `Broadcast: ${selectedTemplate.name}`,
              template_name: selectedTemplate.name,
              total_recipients: summary.total,
              sent_count: summary.sent,
              failed_count: summary.failed,
              error_message: summary.error,
              status: summary.sent > 0 ? 'sent' : 'failed',
            };
            const updatedHistory = [newHistory, ...history];
            setHistory(updatedHistory);
            localStorage.setItem('reachflow-broadcast-history', JSON.stringify(updatedHistory));
            if (summary.failed > 0 && summary.sent === 0) {
              showToast(`Send failed: ${summary.error || 'Meta template not approved yet'}`, 'error');
            } else {
              showToast(`Broadcast completed: ${summary.sent} sent, ${summary.failed} failed.`);
            }
          }}
        />
      )}
    </div>
  );
}

// ── Connect Template Modal ───────────────────────────────────────────────────
function ConnectTemplateModal({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: (t: MetaTemplate) => void;
}) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState('MARKETING');
  const [bodyText, setBodyText] = useState('Hello {{1}}, check out our latest offers today!');
  const [headerUrl, setHeaderUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanedName = name.trim().toLowerCase().replace(/\s+/g, '_');
    onConnected({
      name: cleanedName,
      language: language.trim(),
      category,
      body: bodyText.trim(),
      header_url: headerUrl.trim() || undefined,
      status: 'APPROVED',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Connect Meta Template</h2>
            <p className="text-[11px] text-gray-500">Link your approved template from Meta WhatsApp Manager</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="label">Template Name (as created in Meta) *</label>
            <input
              type="text"
              className="input font-mono font-bold"
              placeholder="e.g. summer_offer or client_promo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Must match the exact template name approved in your Meta WhatsApp Manager.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Language Code *</label>
              <input
                type="text"
                className="input font-mono"
                placeholder="e.g. en, en_US, hi"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utility</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Sample Message Body (Preview)</label>
            <textarea
              className="input font-medium text-xs h-20 resize-none"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Use &#123;&#123;1&#125;&#125; for customer name variable</p>
          </div>

          <div>
            <label className="label">Header Image URL (Optional)</label>
            <input
              type="url"
              className="input"
              placeholder="https://example.com/banner.jpg"
              value={headerUrl}
              onChange={(e) => setHeaderUrl(e.target.value)}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs">
              Save & Connect Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Test Send Modal (1 Number) ───────────────────────────────────────────────
function TestSendModal({
  template,
  onClose,
  onSent,
}: {
  template: MetaTemplate;
  onClose: () => void;
  onSent: (res: any) => void;
}) {
  const [phone, setPhone] = useState('+918240813577');
  const [customerName, setCustomerName] = useState('Aritra');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setError(null);

    const components: any[] = [];
    const hasHeader = template.header_type === 'image' || Boolean(template.header_url);
    if (hasHeader) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: {
              link: template.header_url || 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?w=800',
            },
          },
        ],
      });
    }

    const hasBodyVar = /\{\{\d+\}\}/.test(template.body || '');
    if (hasBodyVar && customerName.trim()) {
      components.push({
        type: 'body',
        parameters: [{ type: 'text', text: customerName.trim() }],
      });
    }

    try {
      const metaCreds = JSON.parse(localStorage.getItem('reachflow-active-wa') || '{}');
      const res = await api.settings.sendTemplate({
        to: phone,
        template_name: template.name,
        language_code: template.language || 'en',
        components,
        phone_number_id: metaCreds.phone_number_id || undefined,
        token: metaCreds.token || undefined,
      });

      onSent(res);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch test message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Test Send Template</h2>
            <p className="text-[11px] text-gray-500 font-mono">Template: {template.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {template.status !== 'APPROVED' && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center gap-2">
            <Clock size={16} className="shrink-0 text-amber-600" />
            <div>
              <strong>Pending Meta Approval:</strong> Meta has not approved &ldquo;{template.name}&rdquo; yet. In WhatsApp Cloud API, sending is blocked until Meta changes status to APPROVED. You can use <strong>hello_world</strong> to test right now!
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-3.5 text-xs">
          <div>
            <label className="label">Send Test To Mobile Number *</label>
            <input
              type="text"
              className="input font-mono font-bold"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+918240813577"
              required
            />
          </div>

          <div>
            <label className="label">Customer Name Variable (for &#123;&#123;1&#125;&#125;)</label>
            <input
              type="text"
              className="input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Aritra"
            />
          </div>

          <div className="p-2.5 bg-gray-50 border rounded-lg text-[11px] text-gray-600">
            This will trigger a real WhatsApp Cloud API request to verify template acceptance on Meta's servers.
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs flex items-center gap-1.5">
              {loading ? 'Sending...' : 'Send Test Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Bulk Broadcast Modal ─────────────────────────────────────────────────────
function BroadcastModal({
  template,
  activeCount,
  customers,
  onClose,
  onDispatched,
}: {
  template: MetaTemplate;
  activeCount: number;
  customers: any[];
  onClose: () => void;
  onDispatched: (summary: { total: number; sent: number; failed: number; error?: string }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState(template.header_url || '');
  const [error, setError] = useState<string | null>(null);

  const validRecipients = customers
    .map((c) => {
      const mob = c.whatsapp_e164 || c.mobile_number || c.mobile || c.phone || c.phone_raw || '';
      return {
        mobile: mob,
        name: c.name || c.display_name || 'Customer',
      };
    })
    .filter((r) => r.mobile && r.mobile.replace(/[^0-9]/g, '').length >= 8);

  const handleStartBroadcast = async () => {
    if (validRecipients.length === 0) {
      alert(
        'No valid customer phone numbers found. Please make sure customers in Customers Data have a valid mobile number with country code (e.g. +91 9876543210).'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const metaCreds = JSON.parse(localStorage.getItem('reachflow-active-wa') || '{}');
      const hasBodyVar = /\{\{\d+\}\}/.test(template.body || '');
      const finalHeader = headerImageUrl.trim() || template.header_url || (template.header_type === 'image' ? 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?w=800' : undefined);

      const res = await api.settings.broadcastTemplate({
        recipients: validRecipients,
        template_name: template.name,
        language_code: template.language || 'en',
        header_image_url: finalHeader,
        has_body_variable: hasBodyVar,
        phone_number_id: metaCreds.phone_number_id || undefined,
        token: metaCreds.token || undefined,
      });

      const firstErr = res.data?.details?.find((d: any) => d.status === 'failed')?.error;
      onDispatched({
        total: res.data?.total || validRecipients.length,
        sent: res.data?.sent || 0,
        failed: res.data?.failed || 0,
        error: firstErr,
      });
    } catch (err: any) {
      setError(err.message || 'Broadcast failed to dispatch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Broadcast WhatsApp Template</h2>
            <p className="text-[11px] text-gray-500 font-mono">Template: {template.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {template.status !== 'APPROVED' && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center gap-2">
            <Clock size={16} className="shrink-0 text-amber-600" />
            <div>
              <strong>Pending Meta Approval:</strong> Meta has not approved &ldquo;{template.name}&rdquo; yet. In WhatsApp Cloud API, sending is blocked until Meta changes status to APPROVED. You can use <strong>hello_world</strong> to test right now!
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-950 font-bold">
              <Users size={16} className="text-emerald-700" />
              <span>Target Audience:</span>
            </div>
            <span className="font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              {validRecipients.length} Valid Numbers
            </span>
          </div>

          {/* Valid Recipients Preview */}
          <div className="bg-gray-50 border p-2.5 rounded-lg text-xs space-y-1">
            <div className="font-bold text-gray-700 flex items-center justify-between">
              <span>Recipients:</span>
              <span className="text-[10px] text-gray-500 font-normal">
                {validRecipients.length} verified
              </span>
            </div>
            {validRecipients.slice(0, 3).map((r, i) => (
              <div key={i} className="text-gray-600 font-mono text-[11px] truncate">
                • {r.mobile} ({r.name})
              </div>
            ))}
            {validRecipients.length === 0 && (
              <p className="text-red-600 text-[11px]">
                No customer with a valid mobile number found. Go to Customers Data and add/check customer mobile numbers.
              </p>
            )}
          </div>

          {template.header_type === 'image' && (
            <div>
              <label className="label">Custom Header Image URL (Optional)</label>
              <input
                type="url"
                className="input text-xs font-mono"
                placeholder="https://your-domain.com/banner.jpg"
                value={headerImageUrl}
                onChange={(e) => setHeaderImageUrl(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                Paste any image link you wish to attach to this template broadcast.
              </p>
            </div>
          )}

          <div className="space-y-1 bg-gray-50 p-3 rounded-lg border text-gray-600 text-[11px]">
            <div>• Each customer receives an individual message using Meta Cloud API.</div>
            <div>• Variables like &#123;&#123;1&#125;&#125; are automatically replaced with each customer's name.</div>
            <div>• Dispatches with safe pacing to respect Meta rate limits.</div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button
              onClick={handleStartBroadcast}
              disabled={loading || activeCount === 0}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              {loading ? 'Broadcasting...' : `Send to ${activeCount} Customers`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
