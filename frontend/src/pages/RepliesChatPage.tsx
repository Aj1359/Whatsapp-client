import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Send,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Radio,
  CheckSquare,
  Square,
  Filter,
  Users,
  Megaphone,
  Calendar,
  MessageCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ReplyMessage {
  id: string | number;
  from_e164: string;
  from_name: string;
  body: string;
  is_stop: boolean;
  received_at: string;
  timestamp?: number;
  outbound_reply?: string;
  outbound_sent_at?: string;
}

interface BroadcastItem {
  id: string;
  date: string;
  title: string;
  template_name: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  error_message?: string;
  status: string;
  recipients?: Array<{ mobile: string; name?: string }>;
}

export default function RepliesChatPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'inbound' | 'followup'>('all');

  // ── SECTION 1: INBOUND REPLIES STATE ──────────────────────────────────────
  const [replies, setReplies] = useState<ReplyMessage[]>(() => {
    try {
      const raw = localStorage.getItem('reachflow-replies');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [individualReplyTexts, setIndividualReplyTexts] = useState<Record<string, string>>({});
  const [sendingIndividualId, setSendingIndividualId] = useState<string | number | null>(null);
  const [subscribingWebhook, setSubscribingWebhook] = useState(false);

  const handleSubscribeWebhook = async () => {
    setSubscribingWebhook(true);
    try {
      const metaCreds = JSON.parse(localStorage.getItem('reachflow-active-wa') || '{}');
      await api.settings.subscribeWaba({
        waba_id: metaCreds.waba_id || undefined,
        token: metaCreds.token || undefined,
      });
      showNotification('Meta App subscribed to WABA webhook successfully!');
    } catch (err: any) {
      showNotification(`Webhook subscription: ${err.message}`, 'error');
    } finally {
      setSubscribingWebhook(false);
    }
  };

  // ── SECTION 2: 24-HOUR BROADCAST FOLLOW-UP STATE ──────────────────────────
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(() => {
    try {
      const raw = localStorage.getItem('reachflow-broadcast-history');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string>('');
  const [followupTarget, setFollowupTarget] = useState<'all' | 'selected'>('all');
  const [selectedRecipientMobiles, setSelectedRecipientMobiles] = useState<string[]>([]);
  const [followupText, setFollowupText] = useState('');
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [followupLogs, setFollowupLogs] = useState<Array<{ id: string; time: string; text: string; count: number; broadcastName: string }>>(() => {
    try {
      const raw = localStorage.getItem('reachflow-followup-logs');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // Global Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Simulation modal
  const [showSimModal, setShowSimModal] = useState(false);
  const [simName, setSimName] = useState('Aditya Jha');
  const [simMobile, setSimMobile] = useState('+917439879074');
  const [simText, setSimText] = useState('Hello! Received your broadcast offer, can you share pricing?');

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ── LOAD CONTACTS FALLBACK ────────────────────────────────────────────────
  const getStoredContacts = () => {
    try {
      const raw = localStorage.getItem('reachflow-contacts');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  };

  // ── FETCH INBOUND REPLIES ─────────────────────────────────────────────────
  const fetchReplies = async (silent = false) => {
    if (!silent) setLoadingReplies(true);
    try {
      const res: any = await api.replies.list();
      const serverReplies = Array.isArray(res) ? res : res?.data || [];
      if (serverReplies.length > 0) {
        setReplies((prev) => {
          const map = new Map<string | number, ReplyMessage>();
          prev.forEach((r) => map.set(r.id, r));
          serverReplies.forEach((r: ReplyMessage) => map.set(r.id, { ...map.get(r.id), ...r }));
          const merged = Array.from(map.values()).sort(
            (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
          );
          localStorage.setItem('reachflow-replies', JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn('Could not fetch server replies:', err);
    } finally {
      if (!silent) setLoadingReplies(false);
    }
  };

  useEffect(() => {
    fetchReplies(false);
    const interval = setInterval(() => {
      fetchReplies(true);
    }, 6000);

    // Load recent broadcast list
    try {
      const rawB = localStorage.getItem('reachflow-broadcast-history');
      if (rawB) {
        const parsed: BroadcastItem[] = JSON.parse(rawB);
        setBroadcasts(parsed);
        if (parsed.length > 0 && !selectedBroadcastId) {
          setSelectedBroadcastId(parsed[0].id);
        }
      }
    } catch {}

    return () => clearInterval(interval);
  }, []);

  // Set default selected broadcast when broadcasts load
  useEffect(() => {
    if (broadcasts.length > 0 && !selectedBroadcastId) {
      setSelectedBroadcastId(broadcasts[0].id);
    }
  }, [broadcasts, selectedBroadcastId]);

  // Determine current active broadcast
  const currentBroadcast =
    broadcasts.find((b) => String(b.id) === String(selectedBroadcastId)) || broadcasts[0];

  // Determine recipients of the current broadcast
  const broadcastRecipients: Array<{ mobile: string; name: string }> = React.useMemo(() => {
    if (currentBroadcast?.recipients && currentBroadcast.recipients.length > 0) {
      return currentBroadcast.recipients.map((r) => ({
        mobile: r.mobile,
        name: r.name || 'Customer',
      }));
    }
    // Fallback to active contacts
    const contacts = getStoredContacts();
    return contacts.map((c: any) => ({
      mobile: c.whatsapp_e164 || c.mobile_number || c.mobile || '',
      name: c.name || c.display_name || 'Customer',
    })).filter((c: any) => c.mobile);
  }, [currentBroadcast]);

  // Sync recipient checkboxes when broadcast changes
  useEffect(() => {
    if (broadcastRecipients.length > 0) {
      setSelectedRecipientMobiles(broadcastRecipients.map((r) => r.mobile));
    } else {
      setSelectedRecipientMobiles([]);
    }
  }, [selectedBroadcastId, broadcastRecipients]);

  // Toggle recipient checkbox
  const toggleRecipientMobile = (mob: string) => {
    setSelectedRecipientMobiles((prev) =>
      prev.includes(mob) ? prev.filter((m) => m !== mob) : [...prev, mob]
    );
  };

  const selectAllRecipients = () => {
    if (selectedRecipientMobiles.length === broadcastRecipients.length) {
      setSelectedRecipientMobiles([]);
    } else {
      setSelectedRecipientMobiles(broadcastRecipients.map((r) => r.mobile));
    }
  };

  // ── ACTION: SEND 1-ON-1 INLINE REPLY TO INBOUND CUSTOMER ──────────────────
  const handleSendIndividualReply = async (inquiry: ReplyMessage) => {
    const text = individualReplyTexts[inquiry.id]?.trim();
    if (!text) return;

    setSendingIndividualId(inquiry.id);
    try {
      await api.replies.send({
        to: inquiry.from_e164,
        text,
      });

      const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const updated = replies.map((r) =>
        r.id === inquiry.id
          ? { ...r, outbound_reply: text, outbound_sent_at: nowStr }
          : r
      );
      setReplies(updated);
      localStorage.setItem('reachflow-replies', JSON.stringify(updated));

      // Clear input
      setIndividualReplyTexts((prev) => ({ ...prev, [inquiry.id]: '' }));
      showNotification(`Reply sent to ${inquiry.from_name} (${inquiry.from_e164})!`);
    } catch (err: any) {
      showNotification(`Failed to dispatch reply: ${err.message}`, 'error');
    } finally {
      setSendingIndividualId(null);
    }
  };

  // ── ACTION: SEND 24-HOUR BROADCAST FOLLOW-UP ──────────────────────────────
  const handleSendBroadcastFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = followupText.trim();
    if (!text) return;

    const targets =
      followupTarget === 'all'
        ? broadcastRecipients.map((r) => r.mobile)
        : selectedRecipientMobiles;

    if (targets.length === 0) {
      alert('Please select at least one recipient to dispatch the follow-up.');
      return;
    }

    setSendingFollowup(true);
    try {
      for (const target of targets) {
        await api.replies.send({
          to: target,
          text,
        });
      }

      const sentCount = targets.length;
      const newLog = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        text,
        count: sentCount,
        broadcastName: currentBroadcast?.template_name || currentBroadcast?.title || 'Broadcast',
      };
      const updatedLogs = [newLog, ...followupLogs];
      setFollowupLogs(updatedLogs);
      localStorage.setItem('reachflow-followup-logs', JSON.stringify(updatedLogs));

      showNotification(`Follow-up dispatched to ${sentCount} recipient(s) in broadcast "${currentBroadcast?.template_name || 'Broadcast'}"!`);
      setFollowupText('');
    } catch (err: any) {
      showNotification(`Failed to dispatch follow-up: ${err.message}`, 'error');
    } finally {
      setSendingFollowup(false);
    }
  };

  // ── SIMULATE INBOUND TEST ─────────────────────────────────────────────────
  const handleSimulateInbound = async () => {
    const fakeReply: ReplyMessage = {
      id: `sim_${Date.now()}`,
      from_e164: simMobile.trim() || '+917439879074',
      from_name: simName.trim() || 'Aditya Jha',
      body: simText.trim() || 'Received your broadcast! Please send more details.',
      is_stop: simText.toLowerCase().trim() === 'stop',
      received_at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      timestamp: Date.now(),
    };

    const updated = [fakeReply, ...replies];
    setReplies(updated);
    localStorage.setItem('reachflow-replies', JSON.stringify(updated));
    setShowSimModal(false);
    showNotification(`Simulated inbound message from ${fakeReply.from_name} added!`);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 border animate-in fade-in ${
            toast.type === 'error'
              ? 'bg-red-950 text-white border-red-500'
              : 'bg-gray-900 text-white border-emerald-500'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={16} className="text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="text-whatsapp-teal" size={26} />
            Customer Replies & 24h Broadcast Messaging
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Two-way WhatsApp engagement: View inbound customer enquiries, and dispatch 24h follow-ups to past broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReplies(false)}
            disabled={loadingReplies}
            className="btn-secondary text-xs flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={13} className={loadingReplies ? 'animate-spin' : ''} />
            {loadingReplies ? 'Syncing…' : 'Sync Replies'}
          </button>
          <button
            onClick={() => setShowSimModal(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
          >
            <Sparkles size={13} className="text-emerald-600" />
            Simulate Inbound Reply
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl text-xs w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            'px-4 py-2 rounded-lg font-bold transition flex items-center gap-2',
            activeTab === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <Filter size={13} />
          View Both Sections
        </button>
        <button
          onClick={() => setActiveTab('inbound')}
          className={cn(
            'px-4 py-2 rounded-lg font-bold transition flex items-center gap-2',
            activeTab === 'inbound'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-emerald-900 hover:bg-emerald-50'
          )}
        >
          <MessageCircle size={13} />
          Section 1: Customer Enquiries ({replies.length})
        </button>
        <button
          onClick={() => setActiveTab('followup')}
          className={cn(
            'px-4 py-2 rounded-lg font-bold transition flex items-center gap-2',
            activeTab === 'followup'
              ? 'bg-whatsapp-teal text-white shadow-sm'
              : 'text-gray-700 hover:bg-gray-200'
          )}
        >
          <Megaphone size={13} />
          Section 2: 24h Broadcast Follow-Up
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1: CUSTOMER INBOUND REPLIES & ENQUIRIES
      ══════════════════════════════════════════════════════════════════════ */}
      {(activeTab === 'all' || activeTab === 'inbound') && (
        <div className="space-y-4">
          <div className="card p-6 border-2 border-emerald-500/30 bg-white shadow-sm space-y-4">
            {/* Section 1 Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                  📥
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-gray-900">
                      SECTION 1: Customer Inbound Replies & Enquiries
                    </h2>
                    <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">
                      {replies.length} Received
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Live messages sent by customers from their handsets in response to your broadcasts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <ShieldCheck size={13} className="text-emerald-600" />
                  Meta Customer Care Window (Free ₹0.00)
                </span>
              </div>
            </div>

            {/* Live Webhook & Inbound Sync Helper */}
            <div className="bg-gradient-to-r from-blue-50/70 to-emerald-50/70 border border-blue-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <strong className="text-gray-900 font-bold">Meta Webhook Live Endpoint:</strong>
                  <code className="bg-white px-2 py-0.5 rounded border text-[11px] font-mono text-blue-900">
                    https://wa-backend-ayta.onrender.com/webhooks/whatsapp
                  </code>
                </div>
                <p className="text-[11px] text-gray-500">
                  Ensure <strong>&ldquo;messages&rdquo;</strong> is subscribed in Meta Developer Console under WhatsApp &rarr; Configuration.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSubscribeWebhook}
                  disabled={subscribingWebhook}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 font-bold shadow-sm"
                >
                  <RefreshCw size={12} className={subscribingWebhook ? 'animate-spin' : ''} />
                  {subscribingWebhook ? 'Subscribing…' : 'Subscribe App to WABA Webhook'}
                </button>
                <a
                  href="https://developers.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-700 underline font-semibold flex items-center gap-0.5"
                >
                  Meta Console <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* Inbound Replies Feed */}
            {replies.length === 0 ? (
              <div className="p-10 text-center text-gray-400 space-y-2 border border-dashed rounded-xl bg-gray-50/50">
                <MessageSquare size={32} className="mx-auto text-gray-300" />
                <p className="font-bold text-gray-700 text-xs">No Inbound Customer Enquiries Yet</p>
                <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                  When contacts reply to your broadcast messages on their WhatsApp phones, their incoming messages will appear right here with a 1-click reply button!
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setShowSimModal(true)}
                    className="btn-secondary text-xs px-3.5 py-1.5 font-bold"
                  >
                    Simulate Inbound Customer Reply
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {replies.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    className="p-4 border rounded-xl bg-gray-50/40 hover:bg-gray-50/80 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                          {inquiry.from_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-xs text-gray-900">{inquiry.from_name}</span>
                        <span className="font-mono text-xs text-emerald-800 font-semibold">
                          {inquiry.from_e164}
                        </span>
                        {inquiry.is_stop && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                            STOP / OPT-OUT
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock size={12} /> {inquiry.received_at}
                        </span>
                        <a
                          href={`https://wa.me/${inquiry.from_e164.replace('+', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-whatsapp-teal hover:underline flex items-center gap-1"
                        >
                          Open in WA <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>

                    {/* Customer Inquiry Bubble */}
                    <div className="bg-white border p-3 rounded-2xl rounded-tl-sm text-xs font-medium text-gray-900 shadow-sm max-w-2xl">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                        Customer Enquiry:
                      </span>
                      <p className="text-gray-800 text-sm leading-relaxed">&ldquo;{inquiry.body}&rdquo;</p>
                    </div>

                    {/* Previous Outbound Reply if sent */}
                    {inquiry.outbound_reply && (
                      <div className="ml-6 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl rounded-tr-sm text-xs text-emerald-950 max-w-2xl shadow-sm">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                          Your Reply Sent ✓:
                        </span>
                        <p className="text-emerald-900">{inquiry.outbound_reply}</p>
                        <p className="text-[10px] text-emerald-700 mt-1">Dispatched at {inquiry.outbound_sent_at || 'Just now'}</p>
                      </div>
                    )}

                    {/* 1-on-1 Reply Box */}
                    {!inquiry.is_stop && (
                      <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          className="input text-xs py-2 bg-white flex-1"
                          placeholder={`Write a direct reply to ${inquiry.from_name}...`}
                          value={individualReplyTexts[inquiry.id] || ''}
                          onChange={(e) =>
                            setIndividualReplyTexts((prev) => ({
                              ...prev,
                              [inquiry.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendIndividualReply(inquiry);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSendIndividualReply(inquiry)}
                          disabled={
                            sendingIndividualId === inquiry.id ||
                            !individualReplyTexts[inquiry.id]?.trim()
                          }
                          className="btn-primary text-xs px-4 py-2 flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                          <Send size={13} />
                          {sendingIndividualId === inquiry.id ? 'Sending…' : 'Send Reply'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2: 24-HOUR BROADCAST FOLLOW-UP & SELF-REPLIES
      ══════════════════════════════════════════════════════════════════════ */}
      {(activeTab === 'all' || activeTab === 'followup') && (
        <div className="space-y-4">
          <div className="card p-6 border-2 border-whatsapp-teal/40 bg-white shadow-sm space-y-5">
            {/* Section 2 Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-whatsapp-teal/10 text-whatsapp-teal flex items-center justify-center font-bold text-sm shrink-0">
                  📢
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-gray-900">
                      SECTION 2: Follow-Up / Reply to Broadcast in Last 24 Hours
                    </h2>
                    <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono">
                      24h Session Window
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Select a broadcast sent in the last 24 hours, choose all recipients or selected contacts, and dispatch your follow-up reply directly.
                  </p>
                </div>
              </div>
            </div>

            {/* 1. BROADCAST SELECTOR WITH TIME & TEMPLATE */}
            <div className="space-y-2 bg-gray-50 border p-4 rounded-xl">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Calendar size={14} className="text-whatsapp-teal" />
                Step 1: Select Broadcast (Dispatched in Last 24 Hours)
              </label>

              {broadcasts.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  No broadcasts found in history. Send a broadcast in <strong>Posts & Templates</strong> to enable 24h follow-ups!
                </p>
              ) : (
                <div className="space-y-2">
                  <select
                    className="input text-xs font-semibold bg-white"
                    value={selectedBroadcastId}
                    onChange={(e) => setSelectedBroadcastId(e.target.value)}
                  >
                    {broadcasts.map((b) => (
                      <option key={b.id} value={b.id}>
                        Broadcast ID #{b.id.slice(-6)} • Template: &ldquo;{b.template_name}&rdquo; — {b.date} ({b.sent_count || b.total_recipients} Recipients)
                      </option>
                    ))}
                  </select>

                  {/* Broadcast Details Banner */}
                  {currentBroadcast && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white p-3 rounded-lg border">
                      <div className="space-y-0.5">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          <span>Template: &ldquo;{currentBroadcast.template_name}&rdquo;</span>
                          <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                            {currentBroadcast.sent_count || currentBroadcast.total_recipients} Handsets Delivered
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Dispatched on: <strong>{currentBroadcast.date}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Active 24-Hour Meta Conversation Window
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. RECIPIENT TARGETING: ALL VS SELECTED */}
            <div className="space-y-3 bg-gray-50 border p-4 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider">
                  <Users size={14} className="text-whatsapp-teal" />
                  Step 2: Choose Recipients in This Broadcast
                </label>

                <div className="flex items-center gap-4 text-xs font-semibold text-gray-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="followup_target"
                      checked={followupTarget === 'all'}
                      onChange={() => setFollowupTarget('all')}
                    />
                    <span>All Recipients ({broadcastRecipients.length})</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="followup_target"
                      checked={followupTarget === 'selected'}
                      onChange={() => setFollowupTarget('selected')}
                    />
                    <span>Selected Recipients ({selectedRecipientMobiles.length})</span>
                  </label>
                </div>
              </div>

              {/* Individual Recipient Checkbox List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-gray-500">
                    {followupTarget === 'all'
                      ? `Dispatching to all ${broadcastRecipients.length} recipients in this broadcast.`
                      : `Select contacts below to target specific recipients:`}
                  </span>
                  {followupTarget === 'selected' && (
                    <button
                      type="button"
                      onClick={selectAllRecipients}
                      className="text-[11px] font-bold text-whatsapp-teal hover:underline flex items-center gap-1"
                    >
                      {selectedRecipientMobiles.length === broadcastRecipients.length ? (
                        <>
                          <CheckSquare size={13} /> Deselect All
                        </>
                      ) : (
                        <>
                          <Square size={13} /> Select All
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {broadcastRecipients.map((r, i) => {
                    const isChecked = selectedRecipientMobiles.includes(r.mobile);
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (followupTarget === 'selected') toggleRecipientMobile(r.mobile);
                        }}
                        className={cn(
                          'p-2.5 rounded-lg border text-xs flex items-center justify-between transition',
                          followupTarget === 'all'
                            ? 'bg-white text-gray-800 border-gray-200'
                            : isChecked
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-400 cursor-pointer shadow-sm'
                            : 'bg-white text-gray-400 border-gray-200 cursor-pointer hover:bg-gray-50'
                        )}
                      >
                        <div className="truncate">
                          <p className="font-bold text-gray-900 truncate">{r.name}</p>
                          <p className="font-mono text-[11px] text-gray-500">{r.mobile}</p>
                        </div>
                        {followupTarget === 'selected' && (
                          <div className="shrink-0 ml-2">
                            {isChecked ? (
                              <CheckSquare size={16} className="text-whatsapp-teal" />
                            ) : (
                              <Square size={16} className="text-gray-300" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. FOLLOW-UP MESSAGE COMPOSER */}
            <form onSubmit={handleSendBroadcastFollowup} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1">
                  Step 3: Type Your Follow-Up Reply Message
                </label>
                <textarea
                  className="input text-xs font-medium h-24 resize-none bg-gray-50 focus:bg-white"
                  placeholder="Type your follow-up message to this broadcast... (e.g. 'Hello, following up on our message sent earlier today! Feel free to reply here if you have any questions.')"
                  value={followupText}
                  onChange={(e) => setFollowupText(e.target.value)}
                  required
                />
              </div>

              {/* Quick Preset Prompts */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] text-gray-500 font-bold">Quick Templates:</span>
                {[
                  'Quick follow-up on our message earlier today! Let us know if you need any assistance.',
                  'Special offer update: Offer is active until midnight today!',
                  'Have any questions? Reply directly to this chat and our team will help you immediately.',
                ].map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFollowupText(prompt)}
                    className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full border transition text-left truncate max-w-xs"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Dispatch Action */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t">
                <span className="text-xs text-gray-600">
                  Targeting:{' '}
                  <strong className="text-emerald-800 font-bold">
                    {followupTarget === 'all'
                      ? `All ${broadcastRecipients.length} Recipient(s)`
                      : `${selectedRecipientMobiles.length} Selected Recipient(s)`}
                  </strong>{' '}
                  in broadcast &ldquo;{currentBroadcast?.template_name}&rdquo;
                </span>

                <button
                  type="submit"
                  disabled={
                    sendingFollowup ||
                    !followupText.trim() ||
                    (followupTarget === 'selected' && selectedRecipientMobiles.length === 0)
                  }
                  className="btn-primary text-xs px-5 py-2.5 flex items-center justify-center gap-2 shadow disabled:opacity-50"
                >
                  <Send size={14} />
                  {sendingFollowup
                    ? 'Broadcasting Follow-Up via Meta…'
                    : `Dispatch Follow-Up to ${
                        followupTarget === 'all'
                          ? broadcastRecipients.length
                          : selectedRecipientMobiles.length
                      } Customer(s)`}
                </button>
              </div>
            </form>

            {/* Follow-up Dispatched Logs */}
            {followupLogs.length > 0 && (
              <div className="pt-4 border-t space-y-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Recent Follow-Ups Dispatched Today:
                </span>
                <div className="space-y-1.5">
                  {followupLogs.slice(0, 3).map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 bg-gray-50 border rounded-lg text-xs flex items-center justify-between text-gray-700"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span className="font-semibold truncate">&ldquo;{log.text}&rdquo;</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[11px] text-gray-500 font-mono">
                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          {log.count} Sent
                        </span>
                        <span>{log.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SIMULATE INBOUND TEST MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 space-y-4 shadow-2xl bg-white">
            <div className="border-b pb-3">
              <h2 className="text-base font-bold text-gray-900">Simulate Customer Inbound Reply</h2>
              <p className="text-[11px] text-gray-500">
                Simulate receiving an incoming WhatsApp enquiry from a contact to test the chat & 1-on-1 reply flow.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="label">Customer Name</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Customer WhatsApp Number (E.164)</label>
                <input
                  type="text"
                  className="input font-mono text-xs"
                  value={simMobile}
                  onChange={(e) => setSimMobile(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Inbound Enquiry Text</label>
                <textarea
                  className="input text-xs h-20 resize-none"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSimulateInbound}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <Sparkles size={13} />
                  Inject Inbound Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
