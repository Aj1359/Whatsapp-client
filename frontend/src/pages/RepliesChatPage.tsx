import React, { useState, useEffect } from 'react';
import { api, API_BASE } from '../lib/api';
import {
  MessageSquare,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  User,
  RefreshCw,
  Forward,
  ShieldCheck,
  Check,
  Paperclip,
  FileText,
  Video,
  Image as ImageIcon,
  X,
} from 'lucide-react';

export default function RepliesChatPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [threadData, setThreadData] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unhandled'>('unhandled');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // 1. Fetch Inquiries List
  const fetchInquiries = async () => {
    try {
      const data = await api.replies.list();
      setInquiries(data);
      if (data.length > 0 && selectedContactId === null) {
        const firstContact = data.find((i: any) => i.contact_id);
        if (firstContact) setSelectedContactId(firstContact.contact_id);
      }
    } catch (err: any) {
      console.warn('Failed loading inquiries:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
    // 10-second polling for new customer replies
    const timer = setInterval(fetchInquiries, 10000);
    return () => clearInterval(timer);
  }, []);

  // 2. Fetch Active Thread
  const fetchThread = async (contactId: number) => {
    try {
      setThreadLoading(true);
      const res: any = await fetch(`${API_BASE}/api/replies/${contactId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sb-token') || ''}`,
          'X-Org-Id': localStorage.getItem('active-org-id') || '',
        },
      });
      const json = await res.json();
      if (json.data) {
        setThreadData(json.data);
      }
    } catch (err: any) {
      console.warn('Failed loading thread:', err.message);
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    if (selectedContactId) {
      fetchThread(selectedContactId);
    }
  }, [selectedContactId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText.trim() && !attachedFile) || !selectedContactId) return;

    setSending(true);
    try {
      let res: Response;
      if (attachedFile) {
        const fd = new FormData();
        fd.append('file', attachedFile);
        if (replyText.trim()) fd.append('text', replyText.trim());

        res = await fetch(`${API_BASE}/api/replies/${selectedContactId}/send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('sb-token') || ''}`,
            'X-Org-Id': localStorage.getItem('active-org-id') || '',
          },
          body: fd,
        });
      } else {
        res = await fetch(
          `${API_BASE}/api/replies/${selectedContactId}/send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('sb-token') || ''}`,
              'X-Org-Id': localStorage.getItem('active-org-id') || '',
            },
            body: JSON.stringify({ text: replyText.trim() }),
          }
        );
      }

      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409 && json.error?.code === 'WINDOW_CLOSED') {
          alert('Meta 24-Hour Customer Care Window is closed for this contact. You must send an approved template instead.');
          return;
        }
        throw new Error(json.error?.message || 'Send failed');
      }

      setReplyText('');
      setAttachedFile(null);
      fetchThread(selectedContactId);
      setNotification({ msg: 'Reply dispatched to customer!', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ msg: `Failed to send: ${err.message}`, type: 'error' });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setSending(false);
    }
  };

  const handleMarkHandled = async (inquiryId: number) => {
    try {
      await fetch(
        `${API_BASE}/api/replies/${inquiryId}/handled`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('sb-token') || ''}`,
            'X-Org-Id': localStorage.getItem('active-org-id') || '',
          },
        }
      );
      fetchInquiries();
    } catch {}
  };

  const filteredInquiries = inquiries.filter((inq) => {
    if (filter === 'unhandled' && inq.handled) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (inq.contact_name || '').toLowerCase().includes(s) ||
        (inq.from_e164 || '').includes(s) ||
        (inq.body || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-white">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold text-white flex items-center gap-2 border ${
            notification.type === 'success' ? 'bg-emerald-900 border-emerald-500' : 'bg-red-900 border-red-500'
          }`}
        >
          {notification.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Left Column: Customer Conversations List */}
      <div className="w-80 md:w-96 border-r border-gray-200 flex flex-col h-full bg-gray-50/50">
        <div className="p-4 border-b border-gray-200 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              <MessageSquare size={18} className="text-emerald-800" />
              Replies Inbox
            </h2>
            <button onClick={fetchInquiries} className="text-gray-400 hover:text-gray-600">
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone or text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-lg border-none focus:ring-2 focus:ring-emerald-700 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setFilter('unhandled')}
              className={`px-3 py-1 rounded-full font-bold text-[11px] transition ${
                filter === 'unhandled' ? 'bg-emerald-900 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Needs Reply
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full font-bold text-[11px] transition ${
                filter === 'all' ? 'bg-emerald-900 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              All Inquiries ({inquiries.length})
            </button>
          </div>
        </div>

        {/* Conversations Scroll Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-500">Loading customer threads...</div>
          ) : filteredInquiries.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">No customer replies in this filter.</div>
          ) : (
            filteredInquiries.map((inq) => {
              const isSelected = inq.contact_id === selectedContactId;
              return (
                <div
                  key={inq.id}
                  onClick={() => inq.contact_id && setSelectedContactId(inq.contact_id)}
                  className={`p-3.5 cursor-pointer transition flex flex-col gap-1 ${
                    isSelected ? 'bg-emerald-50/80 border-l-4 border-l-emerald-800' : 'hover:bg-white bg-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 truncate">
                      {inq.contact_name || inq.from_e164}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(inq.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2">{inq.body}</p>

                  <div className="flex items-center justify-between mt-1 pt-1">
                    <span className="text-[10px] font-mono text-gray-500">{inq.from_e164}</span>
                    {inq.matched_campaign_name && (
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded truncate max-w-[120px]">
                        Re: {inq.matched_campaign_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Chat Thread View */}
      <div className="flex-1 flex flex-col h-full bg-white">
        {selectedContactId && threadData ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">
                  {(threadData.contact?.name || 'C')[0]}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{threadData.contact?.name}</h3>
                  <p className="text-xs font-mono text-gray-500">{threadData.contact?.whatsapp_e164}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {threadData.is_window_open ? (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <ShieldCheck size={14} /> 24h Customer Care Window Active (Free)
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Clock size={14} /> 24h Window Closed (Requires Template)
                  </span>
                )}
              </div>
            </div>

            {/* Messages Thread Scroll View */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
              {threadLoading ? (
                <div className="text-center text-xs text-gray-400 py-10">Loading thread history...</div>
              ) : (
                threadData.thread?.map((item: any, idx: number) => {
                  const isInbound = item.direction === 'inbound';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-lg rounded-2xl p-3.5 shadow-sm text-xs space-y-1 ${
                          isInbound
                            ? 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                            : 'bg-emerald-900 text-white rounded-tr-none'
                        }`}
                      >
                        {item.direction === 'campaign' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-300">
                            📢 Broadcast Template Sent
                          </span>
                        )}
                        <p className="whitespace-pre-wrap">{item.body}</p>
                        <span
                          className={`text-[10px] block text-right font-mono ${
                            isInbound ? 'text-gray-400' : 'text-emerald-200'
                          }`}
                        >
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-gray-200 bg-white space-y-2">
              {attachedFile && (
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded-lg shadow-sm">
                  {attachedFile.type.startsWith('video/') ? (
                    <Video size={14} className="text-emerald-700" />
                  ) : attachedFile.type.startsWith('image/') ? (
                    <ImageIcon size={14} className="text-emerald-700" />
                  ) : (
                    <FileText size={14} className="text-emerald-700" />
                  )}
                  <span className="font-semibold truncate max-w-xs">{attachedFile.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    ({(attachedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="text-gray-400 hover:text-red-600 transition ml-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {threadData.is_window_open ? (
                <form onSubmit={handleSendReply} className="flex items-center gap-2">
                  <label
                    className="p-2.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl cursor-pointer border border-gray-200 transition"
                    title="Attach Image, Video, or Document (PDF)"
                  >
                    <Paperclip size={16} />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,application/pdf,.doc,.docx,.xlsx,.csv"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setAttachedFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>

                  <input
                    type="text"
                    placeholder={attachedFile ? 'Add a caption for this media...' : 'Type your WhatsApp follow-up response...'}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 py-2.5 px-4 text-xs border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-700"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || (!replyText.trim() && !attachedFile)}
                    className="btn-primary text-xs px-5 py-2.5 flex items-center gap-1.5 shadow"
                  >
                    <Send size={14} /> Send
                  </button>
                </form>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <span>
                    ⚠️ The 24-hour service window has elapsed. Meta only permits sending an approved template to this contact.
                  </span>
                  <button
                    onClick={() => (window.location.href = '/posts')}
                    className="btn-secondary text-xs px-3 py-1 font-bold"
                  >
                    Send Template &rarr;
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-2">
            <MessageSquare size={36} className="text-gray-300" />
            <p className="text-sm font-semibold">Select a customer inquiry on the left to read and reply.</p>
          </div>
        )}
      </div>
    </div>
  );
}
