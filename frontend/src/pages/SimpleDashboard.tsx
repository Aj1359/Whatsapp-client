import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  BarChart3,
  Eye,
  EyeOff,
  CheckCheck,
  Send,
  Users,
  Clock,
  Download,
  Search,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function SimpleDashboard() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [tab, setTab] = useState<'seen' | 'not_seen' | 'all'>('seen');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.campaigns
      .list()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.campaigns ?? [];
        setCampaigns(list);
        if (list.length > 0) {
          setSelectedCampaignId(list[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      api.campaigns.getDetails(selectedCampaignId).then((res: any) => {
        setRecipients(res.recipients || []);
      });
    } else {
      setRecipients([]);
    }
  }, [selectedCampaignId]);

  const currentCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0];

  // Aggregated totals
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + (c.delivered_count || 0), 0);
  const totalSeen = campaigns.reduce((acc, c) => acc + (c.read_count || 0), 0);
  const totalUnseen = Math.max(0, totalDelivered - totalSeen);
  const overallSeenPct = totalDelivered > 0 ? ((totalSeen / totalDelivered) * 100).toFixed(1) : '0.0';

  let filteredRecipients = recipients;
  if (tab === 'seen') filteredRecipients = filteredRecipients.filter((r) => r.has_seen || r.hasSeen);
  if (tab === 'not_seen') filteredRecipients = filteredRecipients.filter((r) => !(r.has_seen || r.hasSeen));
  if (search) {
    const q = search.toLowerCase();
    filteredRecipients = filteredRecipients.filter(
      (r) =>
        (r.contact_name || r.name || '').toLowerCase().includes(q) ||
        (r.whatsapp_e164 || r.mobile || '').includes(q)
    );
  }

  const exportSeenCSV = () => {
    const rows = filteredRecipients.map((r) => ({
      Name: r.contact_name || r.name,
      Mobile: r.whatsapp_e164 || r.mobile,
      SeenStatus: (r.has_seen || r.hasSeen) ? 'SEEN' : 'NOT_SEEN',
      SeenAt: r.seen_at || r.seenAt || '',
      DeliveredAt: r.delivered_at || r.deliveredAt || '',
    }));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Name,Mobile,SeenStatus,SeenAt,DeliveredAt']
        .concat(rows.map((row) => `"${row.Name}","${row.Mobile}","${row.SeenStatus}","${row.SeenAt}","${row.DeliveredAt}"`))
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `broadcast_seen_report_${tab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-whatsapp-teal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-500 font-medium">Loading delivery & read statistics...</p>
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="text-whatsapp-teal" size={26} />
            Dashboard & Live Stats
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time delivery receipts, open-rate audits, and Seen (✓✓) vs. Not Seen analytics.
          </p>
        </div>

        {/* Empty State Card */}
        <div className="card p-12 text-center border-dashed border-2 border-gray-200 bg-white space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-whatsapp-teal flex items-center justify-center mx-auto shadow-inner">
            <Send size={28} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-bold text-gray-900">No Broadcasts Sent Yet</h2>
            <p className="text-xs text-gray-500">
              When you launch your first broadcast, live Seen (✓✓) receipts, exact timestamps, and recipient drilldowns will appear here.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => navigate('/posts')}
              className="btn-primary py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2 shadow"
            >
              <Sparkles size={14} />
              Create First Broadcast Post
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="text-whatsapp-teal" size={26} />
            Dashboard & Live Stats
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time delivery receipts, open-rate audits, and Seen (✓✓) vs. Not Seen analytics.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={exportSeenCSV}
            className="btn-secondary text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Download size={14} />
            Export Seen List (CSV)
          </button>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1 border-l-4 border-l-blue-500">
          <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
            <Send size={13} className="text-blue-600" />
            Total Sent
          </span>
          <p className="text-2xl font-black text-gray-900">{totalSent.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">Lifetime broadcast messages</p>
        </div>

        <div className="card p-4 space-y-1 border-l-4 border-l-emerald-500 bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
            <CheckCheck size={14} className="text-emerald-600" />
            Total Delivered
          </span>
          <p className="text-2xl font-black text-emerald-900">{totalDelivered.toLocaleString()}</p>
          <p className="text-[10px] text-emerald-700">Delivered to recipient handsets</p>
        </div>

        <div className="card p-4 space-y-1 border-l-4 border-l-whatsapp-teal bg-emerald-50/50">
          <span className="text-[11px] font-bold text-whatsapp-teal flex items-center gap-1">
            <Eye size={14} />
            Seen (Blue Ticks ✓✓)
          </span>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-whatsapp-teal">{totalSeen.toLocaleString()}</p>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
              {overallSeenPct}% Read Rate
            </span>
          </div>
          <p className="text-[10px] text-emerald-700">Confirmed opened & read</p>
        </div>

        <div className="card p-4 space-y-1 border-l-4 border-l-amber-500 bg-amber-50/20">
          <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
            <EyeOff size={14} className="text-amber-600" />
            Not Seen Yet
          </span>
          <p className="text-2xl font-black text-amber-900">{totalUnseen.toLocaleString()}</p>
          <p className="text-[10px] text-amber-700">Delivered but unopened</p>
        </div>
      </div>

      {/* Campaign Selector Pill Bar */}
      <div className="card p-4 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Select Broadcast Campaign:
          </label>
          <span className="text-[11px] text-gray-500">
            {campaigns.length} past broadcast(s)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaigns.map((camp) => (
            <button
              key={camp.id}
              onClick={() => setSelectedCampaignId(camp.id)}
              className={cn(
                'text-xs px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 border',
                selectedCampaignId === camp.id
                  ? 'bg-whatsapp-teal text-white border-whatsapp-teal shadow-md'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              )}
            >
              <span>{camp.name}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-mono',
                  selectedCampaignId === camp.id
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                )}
              >
                {camp.read_count ?? 0} Seen
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recipient Drilldown Table */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setTab('seen')}
              className={cn(
                'px-4 py-2 rounded-lg font-bold transition flex items-center gap-2',
                tab === 'seen'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-900 hover:bg-emerald-50'
              )}
            >
              <Eye size={14} />
              Who Has Seen It ({currentCampaign?.read_count || 0})
            </button>
            <button
              onClick={() => setTab('not_seen')}
              className={cn(
                'px-4 py-2 rounded-lg font-bold transition flex items-center gap-2',
                tab === 'not_seen'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-900 hover:bg-amber-50'
              )}
            >
              <EyeOff size={14} />
              Who Has Not Seen It (
              {Math.max(0, (currentCampaign?.total || 0) - (currentCampaign?.read_count || 0))})
            </button>
            <button
              onClick={() => setTab('all')}
              className={cn(
                'px-3 py-2 rounded-lg font-medium transition',
                tab === 'all' ? 'bg-white shadow-sm text-gray-900 font-bold' : 'text-gray-500'
              )}
            >
              All Targeted
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input-field pl-8 text-xs py-1.5"
              placeholder="Search customer name or mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Recipient Rows Table */}
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b text-gray-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Primary Mobile</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Exact Seen Timestamp</th>
                <th className="py-3 px-4">Delivered Timestamp</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                    No recipients found in this view.
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((r, idx) => {
                  const seen = r.has_seen || r.hasSeen || r.status === 'read';
                  const mobile = r.whatsapp_e164 || r.mobile || '';
                  const name = r.contact_name || r.name || 'Customer';
                  return (
                    <tr key={r.id || idx} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4 font-bold text-gray-900">{name}</td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-800">{mobile}</td>
                      <td className="py-3 px-4">
                        {seen ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                            <CheckCheck size={13} className="text-emerald-600" />
                            Seen ✓✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                            <EyeOff size={13} className="text-amber-600" />
                            Not Seen Yet
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {r.seen_at || r.seenAt || <span className="text-gray-400 font-normal">—</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500">
                        {r.delivered_at || r.deliveredAt || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`https://wa.me/${mobile.replace('+', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-whatsapp-teal hover:underline"
                        >
                          Chat Direct ↗
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
