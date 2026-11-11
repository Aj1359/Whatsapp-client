import React, { useState } from 'react';
import { mockData } from '../lib/api';
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
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function SimpleDashboard() {
  const campaigns = mockData.campaigns;
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0].id);
  const [tab, setTab] = useState<'seen' | 'not_seen' | 'all'>('seen');
  const [search, setSearch] = useState('');

  const currentCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0];

  // Aggregated totals
  const totalSent = campaigns.reduce((acc, c) => acc + c.sent_count, 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + c.delivered_count, 0);
  const totalSeen = campaigns.reduce((acc, c) => acc + c.read_count, 0);
  const totalUnseen = totalDelivered - totalSeen;
  const overallSeenPct = ((totalSeen / (totalDelivered || 1)) * 100).toFixed(1);

  // Recipient drilldown for current campaign
  const recipients = [
    {
      id: 1,
      name: 'Rajesh Kumar',
      mobile: '+919876543210',
      hasSeen: true,
      seenAt: '14:45 PM (09 Nov)',
      deliveredAt: '14:30 PM (09 Nov)',
    },
    {
      id: 2,
      name: 'Vikram Malhotra',
      mobile: '+919930055443',
      hasSeen: true,
      seenAt: '15:02 PM (09 Nov)',
      deliveredAt: '14:30 PM (09 Nov)',
    },
    {
      id: 3,
      name: 'Pooja Hegde',
      mobile: '+919769001122',
      hasSeen: true,
      seenAt: '15:18 PM (09 Nov)',
      deliveredAt: '14:31 PM (09 Nov)',
    },
    {
      id: 4,
      name: 'Kavita Chawla',
      mobile: '+919811002233',
      hasSeen: true,
      seenAt: '16:05 PM (09 Nov)',
      deliveredAt: '14:31 PM (09 Nov)',
    },
    {
      id: 5,
      name: 'Ananya Sharma',
      mobile: '+919820011223',
      hasSeen: false,
      seenAt: null,
      deliveredAt: '14:30 PM (09 Nov)',
    },
    {
      id: 6,
      name: 'Suresh Patel',
      mobile: '+919845012345',
      hasSeen: false,
      seenAt: null,
      deliveredAt: '14:30 PM (09 Nov)',
    },
    {
      id: 7,
      name: 'Deepak Verma',
      mobile: '+919811223344',
      hasSeen: false,
      seenAt: null,
      deliveredAt: '14:30 PM (09 Nov)',
    },
  ];

  let filteredRecipients = recipients;
  if (tab === 'seen') filteredRecipients = filteredRecipients.filter((r) => r.hasSeen);
  if (tab === 'not_seen') filteredRecipients = filteredRecipients.filter((r) => !r.hasSeen);
  if (search) {
    const q = search.toLowerCase();
    filteredRecipients = filteredRecipients.filter(
      (r) => r.name.toLowerCase().includes(q) || r.mobile.includes(q)
    );
  }

  const exportCSV = (type: string) => {
    const list = type === 'seen' ? recipients.filter((r) => r.hasSeen) : recipients.filter((r) => !r.hasSeen);
    const csv = 'Name,Mobile,Status,Seen At\n' + list.map((r) => `"${r.name}","${r.mobile}","${r.hasSeen ? 'SEEN' : 'NOT SEEN'}","${r.seenAt || '—'}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_contacts.csv`;
    a.click();
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Broadcast Performance & Seen Stats
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time delivery confirmation, open rates, and per-contact seen audit.
          </p>
        </div>

        {/* Campaign Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">Inspect Campaign:</span>
          <select
            className="input text-xs font-semibold max-w-xs bg-white shadow-sm"
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(Number(e.target.value))}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary KPI Grid (Entirely Stats) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Sent */}
        <div className="card p-5 border-l-4 border-l-whatsapp-teal shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Dispatched</span>
            <Send size={18} className="text-whatsapp-teal" />
          </div>
          <p className="text-2xl font-black text-gray-900">{currentCampaign.sent_count.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">Target audience: {currentCampaign.list_name}</p>
        </div>

        {/* Delivered */}
        <div className="card p-5 border-l-4 border-l-blue-500 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Delivered to Handsets</span>
            <CheckCheck size={18} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-900">{currentCampaign.delivered_count.toLocaleString()}</p>
          <p className="text-[11px] text-blue-600 font-semibold">97.6% Handset delivery rate</p>
        </div>

        {/* WHO HAS SEEN IT (Prominent Green) */}
        <div className="card p-5 border-2 border-emerald-500 bg-emerald-50/50 shadow-md space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Eye size={16} className="text-emerald-600" /> Who Has Seen It (Read)
            </span>
            <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              ✓✓ Seen
            </span>
          </div>
          <p className="text-3xl font-black text-emerald-800">{currentCampaign.read_count.toLocaleString()}</p>
          <p className="text-xs font-bold text-emerald-700">
            {((currentCampaign.read_count / currentCampaign.total) * 100).toFixed(1)}% of recipients opened
          </p>
        </div>

        {/* WHO HAS NOT SEEN IT (Prominent Amber) */}
        <div className="card p-5 border-2 border-amber-400 bg-amber-50/50 shadow-md space-y-1">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <EyeOff size={16} className="text-amber-600" /> Who Has Not Seen It
            </span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <p className="text-3xl font-black text-amber-800">
            {(currentCampaign.total - currentCampaign.read_count).toLocaleString()}
          </p>
          <p className="text-xs font-bold text-amber-700">
            {(100 - (currentCampaign.read_count / currentCampaign.total) * 100).toFixed(1)}% unread on phone
          </p>
        </div>
      </div>

      {/* Visual Seen vs Unseen Ratio Bar */}
      <div className="card p-6 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between text-xs font-bold text-gray-700 gap-1">
          <span className="text-emerald-800 flex items-center gap-1.5">
            <Eye size={15} className="text-emerald-600" />
            Verified Seen: {currentCampaign.read_count} clients (
            {((currentCampaign.read_count / currentCampaign.total) * 100).toFixed(1)}%)
          </span>
          <span className="text-amber-800 flex items-center gap-1.5">
            <EyeOff size={15} className="text-amber-600" />
            Not Seen Yet: {currentCampaign.total - currentCampaign.read_count} clients (
            {(100 - (currentCampaign.read_count / currentCampaign.total) * 100).toFixed(1)}%)
          </span>
        </div>

        <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${(currentCampaign.read_count / currentCampaign.total) * 100}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
            title="Seen by customers"
          />
          <div
            style={{ width: `${100 - (currentCampaign.read_count / currentCampaign.total) * 100}%` }}
            className="bg-amber-400 h-full transition-all duration-500"
            title="Not seen yet"
          />
        </div>
      </div>

      {/* Interactive Recipient List: WHO HAS SEEN IT vs WHO HAS NOT SEEN IT */}
      <div className="card p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Per-Customer Seen / Unseen Visibility
            </h2>
            <p className="text-xs text-gray-500">
              Inspect exactly which customers have seen the message and who has not opened it yet.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => exportCSV('seen')}
              className="btn-secondary text-xs px-3 py-1.5 text-emerald-800 border-emerald-300 hover:bg-emerald-50"
            >
              <Download size={13} /> Export Seen List
            </button>
            <button
              onClick={() => exportCSV('not_seen')}
              className="btn-secondary text-xs px-3 py-1.5 text-amber-800 border-amber-300 hover:bg-amber-50"
            >
              <Download size={13} /> Export Unseen List
            </button>
          </div>
        </div>

        {/* Filter Tabs + Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs w-full sm:w-auto">
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
              Who Has Seen It ({currentCampaign.read_count})
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
              Who Has Not Seen It ({currentCampaign.total - currentCampaign.read_count})
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
              className="input pl-8 text-xs py-1.5"
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
              {filteredRecipients.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/80 transition">
                  <td className="py-3 px-4 font-bold text-gray-900">{r.name}</td>
                  <td className="py-3 px-4 font-mono font-medium text-emerald-800">{r.mobile}</td>
                  <td className="py-3 px-4">
                    {r.hasSeen ? (
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
                    {r.seenAt || <span className="text-gray-400 font-normal">—</span>}
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-500">{r.deliveredAt}</td>
                  <td className="py-3 px-4 text-right">
                    <a
                      href={`https://wa.me/${r.mobile.replace('+', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-whatsapp-teal hover:underline"
                    >
                      Chat Direct ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

