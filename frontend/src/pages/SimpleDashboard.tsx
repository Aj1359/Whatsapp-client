import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  BarChart3,
  Send,
  CheckCircle,
  Eye,
  AlertCircle,
  Clock,
  RefreshCw,
  CreditCard,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Users,
  MessageSquare,
  Play,
  Pause,
  XCircle,
} from 'lucide-react';

export default function SimpleDashboard() {
  const navigate = useNavigate();
  const { currentOrg, whatsAppStatus } = useAuth();

  const [stats, setStats] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [campaignProgress, setCampaignProgress] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'seen' | 'delivered_not_seen' | 'sent_not_delivered' | 'failed'>('seen');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Dashboard Overview
  const fetchDashboardData = async () => {
    try {
      setError(null);
      const [dashData, campList] = await Promise.all([
        api.dashboard.getStats(),
        api.campaigns.list(),
      ]);
      setStats(dashData);
      setCampaigns(campList);

      if (campList.length > 0 && selectedCampaignId === null) {
        setSelectedCampaignId(campList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed loading live dashboard statistics from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentOrg?.id]);

  // 2. Fetch Selected Campaign Progress & Tab Messages
  const fetchCampaignDetails = async (campaignId: number, statusFilter: string) => {
    try {
      setMessagesLoading(true);
      const [prog, msgList] = await Promise.all([
        api.campaigns.getProgress(campaignId),
        api.campaigns.getMessages(campaignId, { status: statusFilter, limit: 50 }),
      ]);
      setCampaignProgress(prog);
      setMessages(msgList.data || []);
    } catch (err: any) {
      console.warn('Failed fetching campaign details:', err.message);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCampaignId) {
      fetchCampaignDetails(selectedCampaignId, activeTab);
    }
  }, [selectedCampaignId, activeTab]);

  // 3. Auto-refresh every 5 seconds while a campaign is running
  useEffect(() => {
    const isRunning = campaigns.some((c) => c.status === 'running') || campaignProgress?.campaign?.status === 'running';
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (selectedCampaignId) {
        fetchCampaignDetails(selectedCampaignId, activeTab);
      }
      api.dashboard.getStats().then(setStats).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns, selectedCampaignId, activeTab, campaignProgress]);

  const handlePause = async (id: number) => {
    try {
      await api.campaigns.pause(id);
      fetchDashboardData();
      if (selectedCampaignId === id) fetchCampaignDetails(id, activeTab);
    } catch (err: any) {
      alert(`Failed to pause: ${err.message}`);
    }
  };

  const handleResume = async (id: number) => {
    try {
      await api.campaigns.resume(id);
      fetchDashboardData();
      if (selectedCampaignId === id) fetchCampaignDetails(id, activeTab);
    } catch (err: any) {
      alert(`Failed to resume: ${err.message}`);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this campaign? Pending messages will be skipped.')) return;
    try {
      await api.campaigns.cancel(id);
      fetchDashboardData();
      if (selectedCampaignId === id) fetchCampaignDetails(id, activeTab);
    } catch (err: any) {
      alert(`Failed to cancel: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="animate-spin text-emerald-800" size={32} />
        <p className="text-sm font-semibold text-gray-700">Connecting to live PostgreSQL database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 border-red-200 bg-red-50 text-red-900 space-y-3 my-6">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} className="text-red-800" />
          <h2 className="text-base font-bold">Failed to load real stats</h2>
        </div>
        <p className="text-sm">{error}</p>
        <button onClick={fetchDashboardData} className="btn-primary text-xs px-4 py-2 mt-2">
          Retry Server Connection
        </button>
      </div>
    );
  }

  const account = stats?.account || {};
  const contacts = stats?.contacts || {};
  const overall = stats?.overall || {};
  const today = stats?.today || {};
  const banners = stats?.banners || [];
  const counts = campaignProgress?.counts || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-emerald-800" size={26} />
            Real-Time Broadcast & Engagement Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Verified delivery receipts, Meta read ticks, and customer response logs directly from PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchDashboardData();
              if (selectedCampaignId) fetchCampaignDetails(selectedCampaignId, activeTab);
            }}
            className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
          >
            <RefreshCw size={14} /> Refresh Live Stats
          </button>
          <button
            onClick={() => navigate('/posts')}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow"
          >
            <Send size={14} /> Launch New Campaign
          </button>
        </div>
      </div>

      {/* Real Active Banners */}
      {banners.map((b: any, i: number) => (
        <div
          key={i}
          className={`p-4 rounded-xl flex items-start gap-3 border ${
            b.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <ShieldAlert size={20} className="shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold uppercase tracking-wider">{b.type}: </span>
            {b.message}
          </div>
        </div>
      ))}

      {/* Account & Profile Summary Card */}
      <div className="card p-5 bg-gradient-to-r from-emerald-50/90 via-white to-blue-50/70 border border-emerald-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${account.is_connected ? 'bg-emerald-500' : 'bg-red-500'}`}
            />
            <span className="text-sm font-bold text-gray-900">
              {account.verified_name || currentOrg?.name || 'WhatsApp Account'}
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
              {account.display_phone || 'No phone attached'}
            </span>
          </div>
          <p className="text-xs text-gray-600 font-mono">
            WABA ID: <span className="font-bold">{account.waba_id || 'Not Connected'}</span> • Quality Rating:{' '}
            <span className="font-bold uppercase">{account.quality_rating || 'UNKNOWN'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={account.waba_id ? `https://business.facebook.com/wa/manage/home/?waba_id=${account.waba_id}` : 'https://business.facebook.com/wa/manage/home/'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            Meta Manager <ExternalLink size={12} />
          </a>
          <button
            onClick={() => navigate('/meta-connector')}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            Profile Connector <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Real High-Level Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1 border-l-4 border-l-blue-600 shadow-sm">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Dispatched</span>
            <Send size={16} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{overall.total_dispatched}</p>
          <p className="text-[11px] text-gray-500">Across all completed & running campaigns</p>
        </div>

        <div className="card p-4 space-y-1 border-l-4 border-l-emerald-600 shadow-sm">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Verified Delivered</span>
            <CheckCircle size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-950">{overall.total_delivered}</p>
          <p className="text-[11px] text-emerald-700">Confirmed reached customer handsets</p>
        </div>

        <div className="card p-4 space-y-1 border-l-4 border-l-teal-600 shadow-sm">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Confirmed Seen (✓✓)</span>
            <Eye size={16} className="text-teal-600" />
          </div>
          <p className="text-2xl font-black text-teal-950">{overall.total_read}</p>
          <p className="text-[11px] text-teal-800">Customers with read receipts enabled</p>
        </div>

        <div className="card p-4 space-y-1 border-l-4 border-l-purple-600 shadow-sm">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Contacts</span>
            <Users size={16} className="text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-950">{contacts.active_contacts}</p>
          <p className="text-[11px] text-gray-500">Opt-in confirmed selectable audience</p>
        </div>
      </div>

      {/* Campaign Selector Pill List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Select Campaign to Inspect Live Status:
          </h2>
          <span className="text-xs text-gray-500">{campaigns.length} campaign(s) recorded in database</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {campaigns.map((camp) => (
            <button
              key={camp.id}
              onClick={() => setSelectedCampaignId(camp.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-2 border ${
                selectedCampaignId === camp.id
                  ? 'bg-emerald-900 text-white border-emerald-900 shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
              }`}
            >
              <span>{camp.name}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  camp.status === 'running'
                    ? 'bg-amber-400 text-amber-950 animate-pulse'
                    : camp.status === 'completed'
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {camp.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Campaign Detail & Four Live Filter Tabs */}
      {selectedCampaignId && campaignProgress && (
        <div className="card p-6 space-y-5 border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-base font-black text-gray-900">
                  {campaignProgress.campaign?.name}
                </h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-900">
                  Status: {campaignProgress.campaign?.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">
                Total Queue: {counts.total} • Replied Inquiries: {counts.replied}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {campaignProgress.campaign?.status === 'running' && (
                <>
                  <button
                    onClick={() => handlePause(selectedCampaignId)}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                  >
                    <Pause size={13} /> Pause
                  </button>
                  <button
                    onClick={() => handleCancel(selectedCampaignId)}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 text-red-600 hover:bg-red-50"
                  >
                    <XCircle size={13} /> Cancel
                  </button>
                </>
              )}
              {campaignProgress.campaign?.status === 'paused' && (
                <button
                  onClick={() => handleResume(selectedCampaignId)}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  <Play size={13} /> Resume
                </button>
              )}
            </div>
          </div>

          {/* Four Real Status Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => setActiveTab('seen')}
              className={`p-3.5 rounded-xl border text-left transition ${
                activeTab === 'seen'
                  ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-600/30'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between text-teal-800">
                <span className="text-xs font-bold uppercase tracking-wider">Seen (Read)</span>
                <Eye size={16} />
              </div>
              <p className="text-2xl font-black text-teal-950 mt-1">{counts.read}</p>
              <p className="text-[10px] text-teal-700 mt-0.5">Blue tick confirmed opened</p>
            </button>

            <button
              onClick={() => setActiveTab('delivered_not_seen')}
              className={`p-3.5 rounded-xl border text-left transition ${
                activeTab === 'delivered_not_seen'
                  ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/30'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold uppercase tracking-wider">Delivered, Not Seen</span>
                <CheckCircle size={16} />
              </div>
              <p className="text-2xl font-black text-emerald-950 mt-1">
                {Math.max(0, counts.delivered - counts.read)}
              </p>
              <p className="text-[10px] text-emerald-700 mt-0.5">Double grey tick on phone</p>
            </button>

            <button
              onClick={() => setActiveTab('sent_not_delivered')}
              className={`p-3.5 rounded-xl border text-left transition ${
                activeTab === 'sent_not_delivered'
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/30'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between text-blue-800">
                <span className="text-xs font-bold uppercase tracking-wider">Sent, Not Delivered</span>
                <Clock size={16} />
              </div>
              <p className="text-2xl font-black text-blue-950 mt-1">{counts.sent}</p>
              <p className="text-[10px] text-blue-700 mt-0.5">Single tick on Meta network</p>
            </button>

            <button
              onClick={() => setActiveTab('failed')}
              className={`p-3.5 rounded-xl border text-left transition ${
                activeTab === 'failed'
                  ? 'border-red-600 bg-red-50 ring-2 ring-red-600/30'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between text-red-800">
                <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
                <AlertCircle size={16} />
              </div>
              <p className="text-2xl font-black text-red-950 mt-1">{counts.failed}</p>
              <p className="text-[10px] text-red-700 mt-0.5">Rejected by Meta or invalid number</p>
            </button>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 flex items-center justify-between">
            <span>
              ℹ️ <strong>Note:</strong> "Seen" is only counted when the customer has read receipts turned on in their WhatsApp settings.
            </span>
            <span className="text-[11px] text-gray-500 font-mono">Auto-refreshes every 5s while sending</span>
          </div>

          {/* Contact Status Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-[11px] border-b">
                <tr>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">WhatsApp Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sent At</th>
                  <th className="py-3 px-4">Delivered At</th>
                  <th className="py-3 px-4">Read At</th>
                  <th className="py-3 px-4">Error / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {messagesLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      Loading recipient messages from database...
                    </td>
                  </tr>
                ) : messages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No recipients found in tab "{activeTab.replace(/_/g, ' ')}" for this campaign.
                    </td>
                  </tr>
                ) : (
                  messages.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-bold text-gray-900">{m.contact_name}</td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-gray-700">{m.whatsapp_e164}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            m.status === 'read'
                              ? 'bg-teal-100 text-teal-800'
                              : m.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.status === 'sent'
                              ? 'bg-blue-100 text-blue-800'
                              : m.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-600">
                        {m.sent_at ? new Date(m.sent_at).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-600">
                        {m.delivered_at ? new Date(m.delivered_at).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-600">
                        {m.read_at ? new Date(m.read_at).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-red-600 font-mono">
                        {m.error_message || (m.error_code ? `Code: ${m.error_code}` : '—')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
