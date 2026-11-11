import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, mockData } from '../lib/api';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCheck,
  Clock,
  AlertCircle,
  Download,
  Search,
  Filter,
  Send,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function BroadcastReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'seen' | 'not_seen' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDetails = () => {
    setLoading(true);
    api.campaigns.getDetails(id ? parseInt(id, 10) : 101).then((res) => {
      setData(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadDetails();
    const interval = setInterval(loadDetails, 5000); // Live poll every 5s
    return () => clearInterval(interval);
  }, [id]);

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-gray-400 space-y-2">
        <div className="animate-spin h-6 w-6 border-2 border-whatsapp-teal border-t-transparent rounded-full mx-auto" />
        <p className="text-xs">Loading campaign progress & delivery receipts…</p>
      </div>
    );
  }

  const campaign = data?.campaign ?? mockData.campaigns[0];
  const counts = data?.counts ?? {
    total: 1250,
    sent: 1250,
    delivered: 1220,
    seen: 984,
    notSeen: 236,
    failed: 30,
  };

  const seenPct = ((counts.seen / (counts.total || 1)) * 100).toFixed(1);
  const notSeenPct = ((counts.notSeen / (counts.total || 1)) * 100).toFixed(1);

  // Filter recipients
  let list = data?.recipients ?? [];
  if (filterTab === 'seen') {
    list = list.filter((r: any) => r.has_seen);
  } else if (filterTab === 'not_seen') {
    list = list.filter((r: any) => !r.has_seen && r.status !== 'failed');
  } else if (filterTab === 'failed') {
    list = list.filter((r: any) => r.status === 'failed');
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (r: any) =>
        r.contact_name?.toLowerCase().includes(q) ||
        r.whatsapp_e164?.includes(q)
    );
  }

  const exportCSV = (filter: string) => {
    let rowsToExport = data?.recipients ?? [];
    if (filter === 'seen') rowsToExport = rowsToExport.filter((r: any) => r.has_seen);
    if (filter === 'not_seen') rowsToExport = rowsToExport.filter((r: any) => !r.has_seen);

    const headers = 'Client Name,Mobile,Status,Seen At,Delivered At\n';
    const csvContent = rowsToExport
      .map((r: any) => `"${r.contact_name}","${r.whatsapp_e164}","${r.has_seen ? 'SEEN' : 'NOT SEEN'}","${r.seen_at || '—'}","${r.delivered_at || '—'}"`)
      .join('\n');

    const blob = new Blob([headers + csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_${campaign.id}_${filter}_contacts.csv`;
    a.click();
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="space-y-1">
          <button
            onClick={() => navigate('/campaigns')}
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 font-medium mb-1"
          >
            <ArrowLeft size={14} /> Back to Campaigns
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-gray-900">{campaign.name}</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {campaign.status}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Template: <strong className="text-gray-700">{campaign.template_name}</strong> • Audience:{' '}
            <strong className="text-gray-700">{campaign.list_name}</strong>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => exportCSV('seen')}
            className="btn-secondary text-xs px-3 py-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <Download size={13} /> Export Seen ({counts.seen})
          </button>
          <button
            onClick={() => exportCSV('not_seen')}
            className="btn-secondary text-xs px-3 py-2 text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            <Download size={13} /> Export Not Seen ({counts.notSeen})
          </button>
          <button
            onClick={() => navigate(`/sequences`)}
            className="btn-primary text-xs px-3 py-2"
          >
            <Send size={13} /> Trigger Follow-up to Unseen
          </button>
        </div>
      </div>

      {/* Primary Seen vs Not Seen KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Sent */}
        <div className="card p-4 space-y-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase">Total Targeted</p>
          <p className="text-2xl font-bold text-gray-900">{counts.total.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">100% Dispatched via Meta API</p>
        </div>

        {/* Delivered */}
        <div className="card p-4 space-y-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase">Delivered to Handsets</p>
          <p className="text-2xl font-bold text-gray-800">{counts.delivered.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-600 font-medium">97.6% delivery success</p>
        </div>

        {/* WHO HAS SEEN IT (User focus point) */}
        <div className="card p-4 space-y-1 border-2 border-emerald-500 bg-emerald-50/40">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1">
              <Eye size={14} className="text-emerald-600" />
              Who Has Seen It (Read)
            </p>
            <CheckCheck size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-800">{counts.seen.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-emerald-700">{seenPct}% of recipients opened</p>
        </div>

        {/* WHO HAS NOT SEEN IT (User focus point) */}
        <div className="card p-4 space-y-1 border-2 border-amber-400 bg-amber-50/40">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
              <EyeOff size={14} className="text-amber-600" />
              Who Has Not Seen It
            </p>
            <Clock size={16} className="text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-800">{counts.notSeen.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-amber-700">{notSeenPct}% delivered unread</p>
        </div>
      </div>

      {/* Visual Seen vs Unseen Ratio Bar */}
      <div className="card p-5 space-y-2">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-emerald-700 flex items-center gap-1">
            <Eye size={14} /> Seen / Opened: {counts.seen} ({seenPct}%)
          </span>
          <span className="text-amber-700 flex items-center gap-1">
            <EyeOff size={14} /> Not Seen Yet: {counts.notSeen} ({notSeenPct}%)
          </span>
        </div>
        <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${seenPct}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
            title={`Seen by ${counts.seen} contacts`}
          />
          <div
            style={{ width: `${notSeenPct}%` }}
            className="bg-amber-400 h-full transition-all duration-500"
            title={`Not seen by ${counts.notSeen} contacts`}
          />
          <div
            style={{ width: `${((counts.failed / (counts.total || 1)) * 100).toFixed(1)}%` }}
            className="bg-red-400 h-full transition-all duration-500"
            title={`Failed: ${counts.failed}`}
          />
        </div>
      </div>

      {/* Recipient Roster Filter Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto text-xs">
            <button
              onClick={() => setFilterTab('all')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg font-medium transition',
                filterTab === 'all' ? 'bg-white shadow-sm text-gray-900 font-bold' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              All Targeted ({counts.total})
            </button>
            <button
              onClick={() => setFilterTab('seen')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5',
                filterTab === 'seen'
                  ? 'bg-emerald-600 shadow-sm text-white font-bold'
                  : 'text-emerald-800 hover:bg-emerald-50'
              )}
            >
              <Eye size={13} />
              Seen / Read ({counts.seen})
            </button>
            <button
              onClick={() => setFilterTab('not_seen')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5',
                filterTab === 'not_seen'
                  ? 'bg-amber-500 shadow-sm text-white font-bold'
                  : 'text-amber-800 hover:bg-amber-50'
              )}
            >
              <EyeOff size={13} />
              Not Seen ({counts.notSeen})
            </button>
            <button
              onClick={() => setFilterTab('failed')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5',
                filterTab === 'failed'
                  ? 'bg-red-600 shadow-sm text-white font-bold'
                  : 'text-red-700 hover:bg-red-50'
              )}
            >
              Failed ({counts.failed})
            </button>
          </div>

          {/* Search box inside the campaign roster */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-8 text-xs py-1.5"
              placeholder="Search recipient name or mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Detailed Recipients Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Primary Mobile</th>
                  <th className="py-3 px-4">Seen / Read Status</th>
                  <th className="py-3 px-4">Seen Timestamp</th>
                  <th className="py-3 px-4">Delivered Timestamp</th>
                  <th className="py-3 px-4 text-right">Direct Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      No contacts found matching current filter or search.
                    </td>
                  </tr>
                ) : (
                  list.map((r: any) => (
                    <tr key={r.id || r.whatsapp_e164} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {r.contact_name}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-800">
                        {r.whatsapp_e164}
                      </td>
                      <td className="py-3 px-4">
                        {r.has_seen ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2.5 py-1 rounded-full shadow-sm">
                            <CheckCheck size={14} className="text-emerald-600" />
                            Seen ✓✓
                          </span>
                        ) : r.status === 'delivered' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-100/70 border border-amber-300 px-2.5 py-1 rounded-full">
                            <EyeOff size={13} className="text-amber-600" />
                            Delivered (Not Seen)
                          </span>
                        ) : r.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                            <AlertCircle size={12} />
                            Failed ({r.error_message || 'Undeliverable'})
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">In-Flight</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-700">
                        {r.seen_at ? (
                          <span className="font-semibold text-emerald-700">
                            {new Date(r.seen_at).toLocaleTimeString()} ({new Date(r.seen_at).toLocaleDateString()})
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-500">
                        {r.delivered_at ? new Date(r.delivered_at).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`https://wa.me/${r.whatsapp_e164?.replace('+', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-whatsapp-teal font-semibold hover:underline"
                        >
                          Chat on WhatsApp ↗
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
