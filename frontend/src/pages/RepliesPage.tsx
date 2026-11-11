import React, { useState } from 'react';
import { api, mockData } from '../lib/api';
import { MessageCircle, CheckCircle2, ExternalLink, AlertOctagon, User } from 'lucide-react';

export default function RepliesPage() {
  const [replies, setReplies] = useState(mockData.replies);

  const markHandled = (id: number) => {
    api.replies.markHandled(id).then(() => {
      setReplies(
        replies.map((r) => (r.id === id ? { ...r, handled: true } : r))
      );
    });
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Inbound Customer Replies</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Live customer responses via WhatsApp webhook. Replying with STOP automatically opts out the contact.
        </p>
      </div>

      <div className="card divide-y divide-gray-100 overflow-hidden">
        {replies.map((rep) => (
          <div key={rep.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-whatsapp-teal/10 text-whatsapp-teal flex items-center justify-center font-bold text-xs shrink-0">
                <User size={18} />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-gray-900">{rep.from_name}</h4>
                  <span className="font-mono text-xs text-emerald-800 font-medium">
                    {rep.from_e164}
                  </span>
                  {rep.is_stop && (
                    <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <AlertOctagon size={11} /> STOP / OPT-OUT
                    </span>
                  )}
                  {rep.handled && (
                    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 size={11} /> Handled
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-800 bg-gray-50 border border-gray-200/80 p-2.5 rounded-lg max-w-xl font-medium">
                  "{rep.body}"
                </p>

                <p className="text-[10px] text-gray-400">
                  Received at {new Date(rep.received_at).toLocaleTimeString()} on {new Date(rep.received_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {!rep.handled && (
                <button
                  onClick={() => markHandled(rep.id)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Mark Handled
                </button>
              )}
              <a
                href={`https://wa.me/${rep.from_e164.replace('+', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
              >
                Chat on WhatsApp Web <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

