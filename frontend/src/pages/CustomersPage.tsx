import React, { useState, useEffect } from 'react';
import { api, mockData } from '../lib/api';
import {
  Users,
  Search,
  Plus,
  Upload,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Download,
  X,
  AlertTriangle,
} from 'lucide-react';

export default function CustomersPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const refreshList = () => {
    api.contacts.list({ search, status: statusFilter }).then((res: any) => {
      setContacts(res.contacts ?? res);
    });
  };

  useEffect(() => {
    refreshList();
  }, [search, statusFilter]);

  const activeCount = contacts.filter((c) => c.status === 'active').length;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 border border-emerald-500 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Customers Database</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Primary Identifier: <strong>Mobile Number (E.164)</strong>. Add or import client records anytime.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary text-xs px-3.5 py-2"
          >
            <Upload size={14} /> Bulk Import (Excel/CSV)
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs px-3.5 py-2"
          >
            <Plus size={14} /> Add / Update Customer
          </button>
        </div>
      </div>

      {/* Mobile Upsert Rule Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-950">
              Automatic Mobile Number Upsert Active
            </p>
            <p className="text-[11px] text-emerald-800">
              Whenever a customer's data is entered or uploaded, the system matches by their <strong>Mobile Number</strong>. Existing customers get updated; new numbers get added. No duplicates!
            </p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-emerald-900">
          <span>Active Customers: {activeCount}</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9 text-xs"
            placeholder="Search by name or mobile number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={14} className="text-gray-400" />
          <select
            className="input text-xs w-full sm:w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Customers ({contacts.length})</option>
            <option value="active">Active Only ({activeCount})</option>
            <option value="opted_out">Opted Out (STOP)</option>
          </select>
        </div>
      </div>

      {/* Customer Table */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b text-gray-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Primary Mobile Number</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Tags & Segment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Broadcast Receipt</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                    No customer records found. Click "+ Add Customer" or "Import CSV/Excel" to add your WhatsApp contacts.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id || c.whatsapp_e164} className="hover:bg-gray-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-gray-900">{c.name}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                    {c.whatsapp_e164}
                  </td>
                  <td className="py-3.5 px-4 text-gray-600">{c.email || '—'}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map((t: string) => (
                        <span
                          key={t}
                          className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {c.status === 'active' ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                        Opted Out
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {c.last_message_status === 'read' ? (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <Eye size={13} /> Seen ✓✓
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-700 flex items-center gap-1">
                        <EyeOff size={13} /> Delivered
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <a
                      href={`https://wa.me/${c.whatsapp_e164.replace('+', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-whatsapp-teal hover:underline"
                    >
                      Chat ↗
                    </a>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Update Modal */}
      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onSaved={(c) => {
            setShowAddModal(false);
            refreshList();
            showToast(`Saved customer ${c.name} (${c.whatsapp_e164})`);
          }}
        />
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={(summary) => {
            setShowImportModal(false);
            refreshList();
            showToast(`Imported ${summary.total} customers (${summary.updated} updated, ${summary.inserted} added)`);
          }}
        />
      )}
    </div>
  );
}

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: (c: any) => void }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [tags, setTags] = useState('VIP, Direct Customer');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !name.trim()) return;

    let cleaned = mobile.replace(/[^0-9+]/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) cleaned = '+91' + cleaned;
    }

    api.contacts.upsert({
      name,
      mobile: cleaned,
      email: email || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    }).then((c) => onSaved(c));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-gray-900">Add or Update Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="label">Primary Mobile Number *</label>
            <input
              type="text"
              className="input font-mono font-bold"
              placeholder="+919876543210 or 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
            />
            <p className="text-[10px] text-gray-400 mt-1">
              If this mobile exists, customer profile will be updated with new details.
            </p>
          </div>

          <div>
            <label className="label">Customer Full Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Email Address (Optional)</label>
            <input
              type="email"
              className="input"
              placeholder="rahul@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Tags (comma-separated)</label>
            <input
              type="text"
              className="input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs">
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (s: any) => void }) {
  const [data, setData] = useState(
    `Mobile,Name,Email\n+919811223344,Deepak Verma,deepak@verma.com\n+919899887766,Amitabh Joshi,amitabh@joshi.in\n+919876543210,Rajesh Kumar (Updated),rajesh.new@gmail.com`
  );

  const handleImport = () => {
    const lines = data.trim().split('\n');
    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        let mob = parts[0];
        if (!mob.startsWith('+') && mob.length === 10) mob = '+91' + mob;
        parsed.push({
          mobile: mob,
          name: parts[1],
          email: parts[2] || undefined,
        });
      }
    }
    api.contacts.importBatch(parsed).then((s) => onImported(s));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-gray-900">Bulk Import Customers</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="label">Paste CSV Data (Mobile is Primary Column)</label>
            <textarea
              className="input font-mono text-xs h-36 resize-none"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-900 border border-emerald-200 text-[11px]">
            Numbers that already exist will have their names & emails refreshed. New numbers are added.
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button onClick={handleImport} className="btn-primary text-xs">
              Process Upsert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

