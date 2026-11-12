import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Send,
  CheckCircle2,
  AlertOctagon,
  CheckSquare,
  Square,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

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

export default function RepliesChatPage() {
  const [replies, setReplies] = useState<ReplyMessage[]>(() => {
    try {
      const raw = localStorage.getItem('reachflow-replies');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyTarget, setReplyTarget] = useState<'selected' | 'all'>('selected');
  const [sentToast, setSentToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simName, setSimName] = useState('Aditya Jha');
  const [simMobile, setSimMobile] = useState('+917439879074');
  const [simText, setSimText] = useState('Received your message! Please send more details.');

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setSentToast({ msg, type });
    setTimeout(() => setSentToast(null), 4000);
  };

  const fetchReplies = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res: any = await api.replies.list();
      const serverReplies = Array.isArray(res) ? res : res?.data || [];
      if (serverReplies.length > 0) {
        setReplies((prev) => {
          const map = new Map<string | number, ReplyMessage>();
          // Existing replies
          prev.forEach((r) => map.set(r.id, r));
          // Server replies
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
      if (!silent) setLoading(false);
    }
  };

  // Poll for replies every 6 seconds
  useEffect(() => {
    fetchReplies(false);
    const interval = setInterval(() => {
      fetchReplies(true);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const toggleSelect = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const nonStopReplies = replies.filter((r) => !r.is_stop);

  const selectAll = () => {
    const nonStopIds = nonStopReplies.map((r) => r.id);
    if (selectedIds.length === nonStopIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(nonStopIds);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) return;

    const targets =
      replyTarget === 'all'
        ? nonStopReplies
        : replies.filter((r) => selectedIds.includes(r.id));

    if (targets.length === 0) {
      alert('Please select at least one customer to reply to.');
      return;
    }

    setSending(true);
    try {
      const metaCreds = JSON.parse(localStorage.getItem('reachflow-active-wa') || '{}');
      const targetNumbers = targets.map((t) => t.from_e164);

      const res = await api.replies.send({
        to: targetNumbers,
        text: trimmed,
        phone_number_id: metaCreds.phone_number_id || undefined,
        token: metaCreds.token || undefined,
      });

      const sentCount = (res as any)?.sent ?? targetNumbers.length;
      const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      // Update local state with outbound reply
      const updated = replies.map((r) => {
        if (targets.some((t) => t.id === r.id)) {
          return {
            ...r,
            outbound_reply: trimmed,
            outbound_sent_at: nowStr,
          };
        }
        return r;
      });

      setReplies(updated);
      localStorage.setItem('reachflow-replies', JSON.stringify(updated));

      showNotification(`Reply dispatched to ${sentCount} customer(s) successfully!`);
      setReplyText('');
      setSelectedIds([]);
    } catch (err: any) {
      showNotification(`Failed to dispatch reply: ${err.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSimulateReply = async () => {
    const fakeReply: ReplyMessage = {
      id: `sim_${Date.now()}`,
      from_e164: simMobile.trim() || '+917439879074',
      from_name: simName.trim() || 'Aditya Jha',
      body: simText.trim() || 'Hi, received your broadcast!',
      is_stop: simText.toLowerCase().trim() === 'stop',
      received_at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      timestamp: Date.now(),
    };

    try {
      await api.replies.testSeed(fakeReply);
    } catch {}

    const updated = [fakeReply, ...replies];
    setReplies(updated);
    localStorage.setItem('reachflow-replies', JSON.stringify(updated));
    setShowSimModal(false);
    showNotification(`New reply from ${fakeReply.from_name} received!`);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {sentToast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 border animate-in fade-in ${
            sentToast.type === 'error'
              ? 'bg-red-950 text-white border-red-500'
              : 'bg-gray-900 text-white border-emerald-500'
          }`}
        >
          {sentToast.type === 'error' ? (
            <AlertCircle size={16} className="text-red-400" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400" />
          )}
          <span>{sentToast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="text-whatsapp-teal" size={26} />
            Customer Replies & Live Chat
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time inbound customer messages via WhatsApp Webhooks. Reply directly from here (Free Service Window).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReplies(false)}
            disabled={loading}
            className="btn-secondary text-xs flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing…' : 'Sync Replies'}
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

      {/* Customer Care Window Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <strong className="block font-bold">Meta 24-Hour Customer Care Window Active</strong>
            <span className="text-[11px] text-emerald-800">
              When a contact messages your WhatsApp Business number, replying within 24 hours is <strong>100% Free</strong> with no template restrictions!
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[11px] font-mono bg-emerald-100 text-emerald-900 font-bold px-2 py-1 rounded">
            Charge: ₹0.00 / Service Reply
          </span>
        </div>
      </div>

      {/* Direct Reply Console */}
      <div className="card p-6 border-2 border-whatsapp-teal/40 bg-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Send size={16} className="text-whatsapp-teal" />
            Send Direct Reply to Customer
          </h2>

          {/* Target: Selected vs All */}
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-700">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="target"
                checked={replyTarget === 'selected'}
                onChange={() => setReplyTarget('selected')}
              />
              <span>Reply to Selected ({selectedIds.length})</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="target"
                checked={replyTarget === 'all'}
                onChange={() => setReplyTarget('all')}
              />
              <span>Reply to All Active ({nonStopReplies.length})</span>
            </label>
          </div>
        </div>

        <form onSubmit={handleSendReply} className="space-y-3">
          <textarea
            className="input text-xs font-medium h-24 resize-none bg-gray-50 focus:bg-white"
            placeholder="Type your WhatsApp reply here... (e.g. 'Hello Aditya, thank you for reaching out! We have dispatched your request...')"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            required
          />

          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">
              Targeting:{' '}
              <strong className="text-emerald-800 font-bold">
                {replyTarget === 'all'
                  ? `All ${nonStopReplies.length} customer(s)`
                  : `${selectedIds.length} selected customer(s)`}
              </strong>
            </span>

            <button
              type="submit"
              disabled={sending || !replyText.trim() || (replyTarget === 'selected' && selectedIds.length === 0)}
              className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 shadow disabled:opacity-50"
            >
              <Send size={13} />
              {sending ? 'Sending Reply via Meta...' : 'Dispatch Reply Right Here'}
            </button>
          </div>
        </form>
      </div>

      {/* Inbound Replies List */}
      <div className="card overflow-hidden shadow-sm space-y-2 bg-white">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-whatsapp-teal"
            >
              {selectedIds.length === nonStopReplies.length && nonStopReplies.length > 0 ? (
                <CheckSquare size={16} className="text-whatsapp-teal" />
              ) : (
                <Square size={16} className="text-gray-400" />
              )}
              Select All Active
            </button>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">
              Selected: <strong>{selectedIds.length}</strong>
            </span>
          </div>

          <span className="text-xs font-bold text-gray-500">
            Total Inbound Messages: {replies.length}
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {replies.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs space-y-2">
              <MessageSquare size={32} className="mx-auto text-gray-300" />
              <p className="font-semibold text-gray-600">No Inbound Customer Messages Yet</p>
              <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                When customers reply to your broadcast messages on WhatsApp, their responses will automatically show up here via Meta Webhooks.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setShowSimModal(true)}
                  className="btn-secondary text-xs px-3 py-1.5 font-bold"
                >
                  Simulate Sample Customer Reply
                </button>
              </div>
            </div>
          ) : (
            replies.map((rep) => {
              const isSelected = selectedIds.includes(rep.id);
              return (
                <div
                  key={rep.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition ${
                    isSelected ? 'bg-emerald-50/60' : 'hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    {!rep.is_stop ? (
                      <button
                        type="button"
                        onClick={() => toggleSelect(rep.id)}
                        className="mt-1 text-gray-400 hover:text-whatsapp-teal shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-whatsapp-teal" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    ) : (
                      <div className="mt-1 w-4 h-4 text-red-500 shrink-0">
                        <AlertOctagon size={16} />
                      </div>
                    )}

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-gray-900">{rep.from_name}</h4>
                        <span className="font-mono text-xs text-emerald-800 font-semibold">
                          {rep.from_e164}
                        </span>
                        {rep.is_stop && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                            STOP / OPT-OUT
                          </span>
                        )}
                      </div>

                      {/* Customer Incoming Bubble */}
                      <div className="bg-gray-100 text-gray-900 border border-gray-200/80 p-3 rounded-2xl rounded-tl-sm max-w-xl text-xs font-medium space-y-1">
                        <p>"{rep.body}"</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={11} /> {rep.received_at}
                        </p>
                      </div>

                      {/* Outbound reply thread if sent */}
                      {rep.outbound_reply && (
                        <div className="bg-emerald-100 text-emerald-950 border border-emerald-200 p-3 rounded-2xl rounded-tr-sm max-w-xl text-xs font-medium ml-6 space-y-1">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                            Your Reply Sent ✓:
                          </span>
                          <p>{rep.outbound_reply}</p>
                          <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                            <Clock size={11} /> {rep.outbound_sent_at || 'Just now'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {!rep.is_stop && (
                      <button
                        onClick={() => {
                          setSelectedIds([rep.id]);
                          setReplyTarget('selected');
                        }}
                        className="btn-secondary text-xs px-2.5 py-1.5 font-bold"
                      >
                        Quick Reply
                      </button>
                    )}
                    <a
                      href={`https://wa.me/${rep.from_e164.replace('+', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-whatsapp-teal hover:underline flex items-center gap-1"
                    >
                      Open WA Web <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Simulate Inbound Reply Modal */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 space-y-4 shadow-2xl bg-white">
            <div className="border-b pb-3">
              <h2 className="text-base font-bold text-gray-900">Simulate Customer Inbound Reply</h2>
              <p className="text-[11px] text-gray-500">
                Simulate receiving an incoming WhatsApp response from a contact to test the chat & reply flow.
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
                <label className="label">Message Body</label>
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
                  onClick={handleSimulateReply}
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
