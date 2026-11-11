import React, { useState } from 'react';
import { mockData } from '../lib/api';
import {
  BarChart3,
  Eye,
  EyeOff,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';

export default function ReportsPage() {
  const campaigns = mockData.campaigns;

  const totalDelivered = campaigns.reduce((acc, c) => acc + c.delivered_count, 0);
  const totalSeen = campaigns.reduce((acc, c) => acc + c.read_count, 0);
  const totalUnseen = totalDelivered - totalSeen;
  const overallSeenPct = ((totalSeen / (totalDelivered || 1)) * 100).toFixed(1);

  // Meta Indian Billing Rates from PRD (Page 4):
  // Marketing: ~₹0.8631, GST: 18% = ~₹1.018 per delivered message
  const estimatedSpendINR = (totalDelivered * 0.8631 * 1.18).toFixed(2);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Broadcast Performance & Seen Audit</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Aggregated delivery receipts, read rates, and estimated Meta spend.
          </p>
        </div>

        <button
          onClick={() => alert('Exporting full analytics workbook (SheetJS Excel)...')}
          className="btn-primary text-xs px-3.5 py-2"
        >
          <Download size={14} /> Download Excel Analytics (.xlsx)
        </button>
      </div>

      {/* Aggregate KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border-l-4 border-l-whatsapp-teal space-y-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase">Delivered Messages</p>
          <p className="text-2xl font-bold text-gray-900">{totalDelivered.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">Across {campaigns.length} active campaigns</p>
        </div>

        {/* Total Seen */}
        <div className="card p-5 border-l-4 border-l-emerald-500 space-y-1 bg-emerald-50/20">
          <p className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
            <Eye size={13} className="text-emerald-600" /> Total Verified Seen (Read)
          </p>
          <p className="text-2xl font-black text-emerald-800">{totalSeen.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-emerald-700">{overallSeenPct}% overall read rate</p>
        </div>

        {/* Total Unseen */}
        <div className="card p-5 border-l-4 border-l-amber-500 space-y-1 bg-amber-50/20">
          <p className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
            <EyeOff size={13} className="text-amber-600" /> Total Delivered Unseen
          </p>
          <p className="text-2xl font-black text-amber-800">{totalUnseen.toLocaleString()}</p>
          <p className="text-[11px] text-amber-700 font-medium">Eligible for follow-up sequence</p>
        </div>

        {/* Estimated Meta Spend */}
        <div className="card p-5 border-l-4 border-l-blue-500 space-y-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase">Meta Spend (incl. 18% GST)</p>
          <p className="text-2xl font-bold text-blue-900">₹{estimatedSpendINR}</p>
          <p className="text-[11px] text-gray-500">₹0.8631/marketing msg + GST</p>
        </div>
      </div>

      {/* Campaign-by-Campaign Breakdown Table */}
      <div className="card overflow-hidden space-y-4 p-5">
        <h3 className="font-bold text-sm text-gray-900">Campaign-Level Seen vs Not Seen Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Campaign Name</th>
                <th className="py-3 px-4">Target Audience</th>
                <th className="py-3 px-4">Delivered</th>
                <th className="py-3 px-4 text-emerald-800">Seen (Read)</th>
                <th className="py-3 px-4 text-amber-800">Not Seen Yet</th>
                <th className="py-3 px-4">Read Rate</th>
                <th className="py-3 px-4 text-right">Meta Fee (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c) => {
                const readPct = ((c.read_count / (c.delivered_count || 1)) * 100).toFixed(1);
                const unseen = c.delivered_count - c.read_count;
                const cost = (c.delivered_count * 0.8631 * 1.18).toFixed(2);
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="py-3 px-4 font-semibold text-gray-900">{c.name}</td>
                    <td className="py-3 px-4 text-gray-500">{c.list_name}</td>
                    <td className="py-3 px-4 font-medium">{c.delivered_count.toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700 bg-emerald-50/50">
                      {c.read_count.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-700 bg-amber-50/50">
                      {unseen.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-700">{readPct}%</td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-gray-700">₹{cost}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

