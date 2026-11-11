import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, mockData } from '../lib/api';
import {
  Megaphone,
  Plus,
  Send,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Search,
  Filter,
  X,
  Sparkles,
} from 'lucide-react';

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>(mockData.campaigns);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    api.campaigns.list().then((res: any) => {
      setCampaigns(res);
    });
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Broadcast Campaigns</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Launch approved WhatsApp marketing & utility messages to segmented client lists.
          </p>
        </div>

        <button
          onClick={() => setShowWizard(true)}
          className="btn-primary text-xs px-4 py-2"
        >
          <Plus size={14} /> Create New Broadcast
        </button>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 gap-4">
        {campaigns.map((camp) => {
          const seenPct = ((camp.read_count / (camp.total || 1)) * 100).toFixed(1);
          const notSeenCount = camp.total - camp.read_count;

          return (
            <div
              key={camp.id}
              className="card p-5 hover:border-whatsapp-teal/50 transition cursor-pointer space-y-4"
              onClick={() => navigate(`/campaigns/${camp.id}`)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-gray-900">{camp.name}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {camp.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Template: <strong className="text-gray-700">{camp.template_name}</strong> • Audience:{' '}
                    <strong className="text-gray-700">{camp.list_name}</strong>
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/campaigns/${camp.id}`);
                  }}
                  className="btn-secondary text-xs px-3 py-1.5 self-start sm:self-auto"
                >
                  View Seen/Unseen Breakdown →
                </button>
              </div>

              {/* Progress & Seen Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Total Target</p>
                  <p className="text-lg font-bold text-gray-900">{camp.total.toLocaleString()}</p>
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Delivered</p>
                  <p className="text-lg font-bold text-gray-800">{camp.delivered_count.toLocaleString()}</p>
                </div>

                {/* Seen / Read Highlight */}
                <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <p className="text-[10px] text-emerald-800 uppercase font-bold flex items-center gap-1">
                    <Eye size={12} className="text-emerald-600" /> Seen / Read
                  </p>
                  <p className="text-lg font-black text-emerald-800">
                    {camp.read_count.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-emerald-600">({seenPct}%)</span>
                  </p>
                </div>

                {/* Unseen Highlight */}
                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <p className="text-[10px] text-amber-800 uppercase font-bold flex items-center gap-1">
                    <EyeOff size={12} className="text-amber-600" /> Not Seen Yet
                  </p>
                  <p className="text-lg font-black text-amber-800">{notSeenCount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showWizard && (
        <CreateCampaignModal
          onClose={() => setShowWizard(false)}
          onCreated={(c) => {
            setShowWizard(false);
            setCampaigns([c, ...campaigns]);
            navigate(`/campaigns/${c.id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: any) => void }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('festive_offer_v1');
  const [list, setList] = useState('All Active VIP Customers');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    api.campaigns
      .create({
        name,
        template_name: template,
        list_name: list,
        recipients_count: 50,
      })
      .then((created) => {
        onCreated(created);
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-gray-900">Create WhatsApp Broadcast</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="label">Campaign Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. November Weekend Special Offer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Select Meta-Approved Template</label>
            <select
              className="input"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="festive_offer_v1">festive_offer_v1 (Marketing, Image Header, 2 Variables)</option>
              <option value="order_status_update">order_status_update (Utility, Text Header, 3 Variables)</option>
            </select>
          </div>

          <div>
            <label className="label">Target Audience List</label>
            <select className="input" value={list} onChange={(e) => setList(e.target.value)}>
              <option value="All Active VIP Customers">All Active VIP Customers (1,250 clients)</option>
              <option value="Fashion Segment Customers">Fashion Segment Customers (800 clients)</option>
              <option value="Cart Abandoners (Last 7 Days)">Cart Abandoners (Last 7 Days) (412 clients)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="label">Dispatch Schedule</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="sched"
                  checked={scheduleType === 'now'}
                  onChange={() => setScheduleType('now')}
                />
                <span>Send Immediately</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="sched"
                  checked={scheduleType === 'later'}
                  onChange={() => setScheduleType('later')}
                />
                <span>Schedule via Daily Planner</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs">
              Launch Broadcast Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

