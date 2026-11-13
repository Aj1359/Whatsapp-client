import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import * as XLSX from 'xlsx';
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
  Trash2,
  FileSpreadsheet,
  FileText,
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
    const params: any = {};
    if (search.trim()) params.search = search.trim();
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter;

    api.contacts.list(params).then((res: any) => {
      const list = Array.isArray(res) ? res : (res?.data || res?.contacts || []);
      setContacts(list);
    }).catch((err) => {
      console.error('Failed to load contacts:', err);
    });
  };

  useEffect(() => {
    refreshList();
  }, [search, statusFilter]);

  const isActive = (c: any) => c.status === 'active' || (c.is_active !== false && c.status !== 'opted_out');
  const activeCount = contacts.filter(isActive).length;

  const handleDelete = (c: any) => {
    const name = c.name || c.display_name || c.whatsapp_e164;
    const mobile = c.whatsapp_e164 || c.mobile_number;
    if (window.confirm(`Are you sure you want to delete customer "${name}" (${mobile})?`)) {
      api.contacts.delete(c.id || mobile).then(() => {
        refreshList();
        showToast(`Deleted customer "${name}"`);
      });
    }
  };

  const handleClearAll = () => {
    alert('Bulk deletion is disabled in multi-tenant mode to protect customer data.');
  };

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
            className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
          >
            <Upload size={14} /> Bulk Import (Excel/CSV)
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
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

      {/* Search, Filters & Bulk Actions */}
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

          {contacts.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg border border-red-200 flex items-center gap-1.5 transition shrink-0"
              title="Delete all customer records"
            >
              <Trash2 size={13} />
              Clear All
            </button>
          )}
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
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                    No customer records found. Click "+ Add Customer" or "Bulk Import (Excel/CSV)" to add your WhatsApp contacts.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const phone = c.whatsapp_e164 || c.mobile_number || '';
                  const active = isActive(c);
                  return (
                    <tr key={c.id || phone} className="hover:bg-gray-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-gray-900">{c.name || c.display_name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                        {phone}
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
                        {active ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Opted Out
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {c.last_message_status === 'read' ? (
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                            <Eye size={13} /> Seen ✓✓
                          </span>
                        ) : c.last_message_status === 'delivered' ? (
                          <span className="text-[11px] text-amber-700 flex items-center gap-1">
                            <EyeOff size={13} /> Delivered
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-whatsapp-teal hover:underline px-2 py-1 rounded hover:bg-emerald-50 transition"
                            title="Open WhatsApp Chat"
                          >
                            Chat ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition"
                            title={`Delete customer ${c.name || phone}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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

    api.contacts
      .create({
        name: name.trim(),
        phone: cleaned,
        email: email.trim() || undefined,
        consent_confirmed: true,
      })
      .then((res: any) => onSaved(res.data || res));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-gray-900">Add / Update Customer</h2>
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
              If this mobile already exists, customer profile will be updated with new details.
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
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [pasteText, setPasteText] = useState(
    `Mobile,Name,Email,Tags\n+919811223344,Deepak Verma,deepak@verma.com,VIP\n+919899887766,Amitabh Joshi,amitabh@joshi.in,Client\n+919876543210,Rajesh Kumar,rajesh@gmail.com,Wholesale`
  );
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanMobile = (val: any) => {
    let mob = String(val || '').replace(/[^0-9+]/g, '');
    if (!mob.startsWith('+') && mob.length === 10) mob = '+91' + mob;
    return mob;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rawJson.length < 2) {
          alert('Spreadsheet appears empty or has only 1 header row.');
          return;
        }

        const headers = (rawJson[0] || []).map((h) => String(h || '').trim().toLowerCase());
        let mobIdx = headers.findIndex((h) => /mobile|phone|whatsapp|contact|cell|number/.test(h));
        let nameIdx = headers.findIndex((h) => /name|customer|client|fullname|first/.test(h));
        let emailIdx = headers.findIndex((h) => /email|mail/.test(h));
        let tagIdx = headers.findIndex((h) => /tag|tags|group|segment/.test(h));

        // Default fallbacks if no matching header strings
        if (mobIdx === -1) mobIdx = 0;
        if (nameIdx === -1) nameIdx = 1;
        if (emailIdx === -1) emailIdx = 2;

        const results: any[] = [];
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;
          const mob = cleanMobile(row[mobIdx]);
          const name = String(row[nameIdx] || '').trim();
          const email = emailIdx >= 0 && row[emailIdx] ? String(row[emailIdx]).trim() : undefined;
          const rawTags = tagIdx >= 0 && row[tagIdx] ? String(row[tagIdx]).trim() : '';
          const tags = rawTags ? rawTags.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : ['Excel Import'];

          if (mob && mob.length >= 8) {
            results.push({
              mobile: mob,
              name: name || `Customer ${mob.slice(-4)}`,
              email: email || undefined,
              tags: tags.length > 0 ? tags : ['Bulk Upload'],
            });
          }
        }

        setParsedRows(results);
      } catch (err: any) {
        alert('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadSample = () => {
    const wb = XLSX.utils.book_new();
    const sampleData = [
      ['Mobile', 'Name', 'Email', 'Tags'],
      ['+919811223344', 'Deepak Verma', 'deepak@verma.com', 'VIP, Retail'],
      ['+919899887766', 'Amitabh Joshi', 'amitabh@joshi.in', 'Direct Client'],
      ['+919876543210', 'Rajesh Kumar', 'rajesh.kumar@gmail.com', 'Wholesale'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'ReachFlow_Customers_Sample.xlsx');
  };

  const handleProcessImport = () => {
    let toImport: any[] = [];

    if (tab === 'file') {
      toImport = parsedRows;
    } else {
      const lines = pasteText.trim().split('\n');
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          const mob = cleanMobile(parts[0]);
          if (mob && mob.length >= 8) {
            toImport.push({
              mobile: mob,
              name: parts[1] || 'Customer',
              email: parts[2] || undefined,
              tags: parts[3] ? parts[3].split(';').map((t) => t.trim()) : ['CSV Import'],
            });
          }
        }
      }
    }

    if (toImport.length === 0) {
      alert('No valid customer rows found to import.');
      return;
    }

    setLoading(true);
    const fd = new FormData();
    if (selectedFile) {
      fd.append('file', selectedFile);
    } else {
      const blob = new Blob([pasteText], { type: 'text/csv' });
      fd.append('file', blob, 'pasted_contacts.csv');
    }
    fd.append('consent_confirmed', 'true');
    api.contacts
      .import(fd)
      .then((s) => {
        setLoading(false);
        onImported(s);
      })
      .catch((err) => {
        setLoading(false);
        alert('Import failed: ' + err.message);
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Bulk Import Customers</h2>
              <p className="text-[11px] text-gray-500">Supports Excel (.xlsx, .xls) and CSV files</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200 text-xs">
          <button
            onClick={() => setTab('file')}
            className={`py-2 px-4 font-bold border-b-2 flex items-center gap-1.5 transition ${
              tab === 'file'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileSpreadsheet size={14} /> Upload File (.xlsx, .xls, .csv)
          </button>
          <button
            onClick={() => setTab('paste')}
            className={`py-2 px-4 font-bold border-b-2 flex items-center gap-1.5 transition ${
              tab === 'paste'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={14} /> Paste CSV Text
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {tab === 'file' ? (
            <div className="space-y-3">
              {/* File Drop Area */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Upload size={22} />
                </div>
                <div className="text-gray-700 font-bold">
                  {fileName ? (
                    <span className="text-emerald-700 font-mono">{fileName}</span>
                  ) : (
                    'Click to choose an Excel or CSV file'
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  {fileName
                    ? 'Click to change file'
                    : 'Select .xlsx, .xls or .csv file from your computer'}
                </p>
              </div>

              {/* Sample Template Download */}
              <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                <span className="text-[11px] text-gray-600">Need a format template?</span>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <Download size={13} /> Download Sample Excel (.xlsx)
                </button>
              </div>

              {/* Parsed Preview */}
              {parsedRows.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-900 font-bold">
                    <span>Ready to import {parsedRows.length} customers</span>
                    <span className="text-[10px] bg-emerald-200 px-2 py-0.5 rounded font-mono">
                      Matched by Mobile
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-800 space-y-0.5 max-h-24 overflow-y-auto font-mono">
                    {parsedRows.slice(0, 3).map((r, i) => (
                      <div key={i} className="truncate">
                        • {r.mobile} — {r.name} {r.email ? `(${r.email})` : ''}
                      </div>
                    ))}
                    {parsedRows.length > 3 && (
                      <div className="text-gray-500 italic">...and {parsedRows.length - 3} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">Paste CSV Data (Mobile is Primary Column)</label>
                <textarea
                  className="input font-mono text-xs h-36 resize-none"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="p-2.5 bg-blue-50 rounded-lg text-blue-900 border border-blue-200 text-[11px]">
            Numbers that already exist will update their name and email. New numbers will be added automatically as Active customers.
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button
              onClick={handleProcessImport}
              disabled={loading || (tab === 'file' && parsedRows.length === 0)}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? 'Processing…' : 'Process Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
