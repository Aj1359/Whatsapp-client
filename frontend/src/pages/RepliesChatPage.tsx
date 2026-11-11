import React, { useState } from 'react';
import { mockData } from '../lib/api';
import {
  MessageSquareQuote,
  Send,
  CheckCircle2,
  AlertOctagon,
  User,
  ExternalLink,
  Users,
  CheckSquare,
  Square,
} from 'lucide-react';

export default function RepliesChatPage() {
  const [replies, setReplies] = useState<any[]>([]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyTarget, setReplyTarget] = useState<'selected' | 'all'>('selected');
  const [sentToast, setSentToast] = useState<string | null>(null);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const nonStopIds = replies.filter((r) => !r.is_stop).map((r) => r.id);
    if (selectedIds.length === nonStopIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(nonStopIds);
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const count = replyTarget === 'all' ? replies.filter((r) => !r.is_stop).length : selectedIds.length;
    if (count === 0) {
      alert('Please select at least one customer to reply to.');
      return;
    }

    setSentToast(`Reply dispatched to ${count} customer(s) successfully!`);
    setReplyText('');
    setSelectedIds([]);
    setTimeout(() => setSentToast(null), 3500);
  };

  const nonStopReplies = replies.filter((r) => !r.is_stop);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      {sentToast && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 border border-emerald-500 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{sentToast}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Customer Replies & Live Chat</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Inbound messages from broadcast recipients. Reply right here to selected contacts or all at once.
        </p>
      </div>

      {/* Direct Reply Console (Right Here In Page) */}
      <div className="card p-6 border-2 border-whatsapp-teal/40 bg-emerald-50/20 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Send size={16} className="text-whatsapp-teal" />
            Send Reply Directly Here
          </h2>

          {/* Radio target: Selected vs All */}
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
            className="input text-xs font-medium h-24 resize-none bg-white shadow-inner"
            placeholder="Type your response here... (e.g. 'Hello, thanks for reaching out! Yes, we have dispatched your order...')"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            required
          />

          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">
              Targeting:{' '}
              <strong className="text-emerald-800">
                {replyTarget === 'all'
                  ? `All ${nonStopReplies.length} customer(s)`
                  : `${selectedIds.length} selected customer(s)`}
              </strong>
            </span>

            <button
              type="submit"
              disabled={!replyText.trim() || (replyTarget === 'selected' && selectedIds.length === 0)}
              className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 shadow"
            >
              <Send size={13} />
              Dispatch Reply Right Here
            </button>
          </div>
        </form>
      </div>

      {/* Inbound Replies List */}
      <div className="card overflow-hidden shadow-sm space-y-2">
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
            Total Inbound: {replies.length}
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {replies.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs">
              No inbound customer replies yet. Responses sent by your contacts will show up here.
            </div>
          ) : (
            replies.map((rep) => {
            const isSelected = selectedIds.includes(rep.id);
            return (
              <div
                key={rep.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  isSelected ? 'bg-emerald-50/60' : 'hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {!rep.is_stop ? (
                    <button
                      type="button"
                      onClick={() => toggleSelect(rep.id)}
                      className="mt-1 text-gray-400 hover:text-whatsapp-teal"
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-whatsapp-teal" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  ) : (
                    <div className="mt-1 w-4 h-4 text-red-500">
                      <AlertOctagon size={16} />
                    </div>
                  )}

                  <div className="space-y-1">
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

                    <p className="text-xs text-gray-800 bg-gray-50 border border-gray-200/80 p-2.5 rounded-lg max-w-xl font-medium">
                      "{rep.body}"
                    </p>

                    <p className="text-[10px] text-gray-400 font-medium">
                      Received at {rep.received_at}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {!rep.is_stop && (
                    <button
                      onClick={() => {
                        setSelectedIds([rep.id]);
                        setReplyTarget('selected');
                      }}
                      className="btn-secondary text-xs px-2.5 py-1.5"
                    >
                      Quick Select
                    </button>
                  )}
                  <a
                    href={`https://wa.me/${rep.from_e164.replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-whatsapp-teal hover:underline flex items-center gap-1"
                  >
                    Open WA Web ↗
                  </a>
                </div>
              </div>
            );
          }))}
        </div>
      </div>
    </div>
  );
}

