import React, { useEffect, useState } from 'react';
import { api, mockData } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { WhatsAppSetupModal } from '../components/WhatsAppSetupModal';
import {
  Users,
  Send,
  Eye,
  EyeOff,
  AlertCircle,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentOrg, whatsAppStatus, updateWhatsAppStatusLocally } = useAuth();
  const [data, setData] = useState<any>(mockData.dashboard);
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);

  useEffect(() => {
    api.dashboard.get().then((res) => {
      setData(res);
      setLoading(false);
    });
  }, []);

  const lastCamp = data?.lastCampaignResult;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Onboarding Callout for New User without WhatsApp connected */}
      {!whatsAppStatus.isConnected && (
        <div className="card p-6 bg-amber-50/90 border-2 border-amber-300 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <Smartphone size={22} />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-amber-950">
                Action Required: Integrate Your Meta WhatsApp Cloud API
              </h2>
              <p className="text-xs text-amber-800 max-w-xl">
                Welcome to <strong>{currentOrg?.name}</strong>! To send broadcasts and receive read receipts, enter your Meta Phone Number ID, WABA ID, and permanent access token.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSetupModal(true)}
            className="btn-primary text-xs px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white shrink-0 shadow"
          >
            Connect WhatsApp Profile →
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              System Ready
            </span>
            <span className="text-xs text-emerald-100">Meta Cloud API v21.0 Active</span>
          </div>
          <h1 className="text-2xl font-extrabold">WhatsApp Business Console</h1>
          <p className="text-emerald-100 text-xs max-w-xl">
            Broadcast messages, update client records anytime by primary mobile number, and audit live delivery & seen receipts.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/campaigns')}
            className="px-4 py-2 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-semibold text-xs rounded-lg shadow transition flex items-center gap-2"
          >
            <Send size={14} /> New Broadcast
          </button>
          <button
            onClick={() => navigate('/contacts')}
            className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white font-medium text-xs rounded-lg border border-white/20 transition flex items-center gap-2"
          >
            <Users size={14} /> Manage Clients
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card p-5 border-l-4 border-l-whatsapp-teal space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase">Total Active Clients</span>
            <Users size={18} className="text-whatsapp-teal" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{data?.activeContacts?.toLocaleString() ?? '3,420'}</p>
          <p className="text-[11px] text-gray-500">
            Primary identifier: <span className="font-mono text-gray-700">Mobile (E.164)</span>
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-emerald-500 space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase">Dispatched Today</span>
            <Send size={18} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{data?.messagesSentToday ?? 65}</p>
          <p className="text-[11px] text-gray-500">
            Daily limit: <span className="font-medium text-gray-700">{data?.dailyCap ?? 250} msgs</span> (185 left)
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-blue-500 space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase">Seen / Read Rate</span>
            <Eye size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-700">{lastCamp?.seenPct ?? 78.7}%</p>
          <p className="text-[11px] text-gray-500">
            {lastCamp?.seen?.toLocaleString() ?? '984'} recipients verified seen
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-amber-500 space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase">Unseen / In-Flight</span>
            <EyeOff size={18} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700">{lastCamp?.notSeen?.toLocaleString() ?? '236'}</p>
          <p className="text-[11px] text-gray-500">Delivered without read receipt</p>
        </div>
      </div>

      {/* Featured Seen vs Not Seen Report Highlight */}
      {lastCamp && (
        <div className="card p-6 space-y-4 border-emerald-200 bg-emerald-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/60 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                Latest Broadcast Audit
              </span>
              <h2 className="text-lg font-bold text-gray-900 mt-1">{lastCamp.name}</h2>
              <p className="text-xs text-gray-500">Sent on Nov 09, 2026 • 1,250 recipients targeted</p>
            </div>
            <button
              onClick={() => navigate('/campaigns/101')}
              className="btn-primary text-xs px-3 py-1.5 self-start sm:self-auto"
            >
              Inspect Who Has Seen It <ArrowRight size={14} />
            </button>
          </div>

          {/* Progress Bar of Seen vs Not Seen */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-gray-700">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <Eye size={14} className="text-emerald-600" />
                Seen: <strong>{lastCamp.seen}</strong> ({lastCamp.seenPct}%)
              </span>
              <span className="flex items-center gap-1.5 text-amber-800">
                <EyeOff size={14} className="text-amber-600" />
                Not Seen: <strong>{lastCamp.notSeen}</strong> ({(100 - lastCamp.seenPct).toFixed(1)}%)
              </span>
            </div>

            <div className="h-3.5 w-full bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${lastCamp.seenPct}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`Seen by ${lastCamp.seen} contacts`}
              />
              <div
                style={{ width: `${100 - lastCamp.seenPct}%` }}
                className="bg-amber-400 h-full transition-all duration-500"
                title={`Not seen yet by ${lastCamp.notSeen} contacts`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
              <span>✓✓ Double green ticks confirmed</span>
              <span>Delivered to phone but not yet opened</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions & Scheduler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Next Scheduled Campaign */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <Clock size={16} className="text-whatsapp-teal" /> Next Scheduled Send
            </h3>
            <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
              Daily Planner
            </span>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
            <p className="font-semibold text-sm text-gray-800">
              {data?.nextScheduledSend?.name ?? 'VIP Cart Recovery Blast'}
            </p>
            <p className="text-xs text-gray-500">
              Scheduled for: <strong className="text-gray-700">{data?.nextScheduledSend?.time}</strong>
            </p>
            <p className="text-xs text-gray-500">
              Audience size: {data?.nextScheduledSend?.recipientsCount ?? 412} contacts
            </p>
          </div>

          <button
            onClick={() => navigate('/daily')}
            className="text-xs font-semibold text-whatsapp-teal hover:underline flex items-center gap-1"
          >
            Open 30-Day Planner Calendar →
          </button>
        </div>

        {/* Dynamic Client Update Feature Notice */}
        <div className="card p-5 space-y-3 bg-white">
          <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" /> Client Upsert Rule
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            You or your client can upload client lists or paste contacts at any time. The database automatically matches by <strong>Mobile Number (E.164)</strong>:
          </p>
          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
            <li>Existing numbers get updated instantly (name, email, tags, custom fields).</li>
            <li>New numbers get inserted into the active audience.</li>
            <li>Opted-out (STOP) users are never re-activated.</li>
          </ul>
          <button
            onClick={() => navigate('/contacts')}
            className="btn-secondary text-xs w-full justify-center"
          >
            Upload or Edit Client Data
          </button>
        </div>
      </div>

      <WhatsAppSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSuccess={(saved) => {
          updateWhatsAppStatusLocally({
            isConnected: true,
            displayPhone: saved.display_phone || saved.phone_number_id || 'Connected Number',
            verifiedName: saved.verified_name || 'Verified Business Account',
            qualityRating: saved.quality_rating || 'GREEN',
          });
        }}
      />
    </div>
  );
}

