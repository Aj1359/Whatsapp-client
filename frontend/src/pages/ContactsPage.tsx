import React, { useState, useEffect, useRef } from 'react';
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
  Tag,
  Download,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>(mockData.contacts);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshContacts = () => {
    api.contacts.list({ search, status: statusFilter }).then((res: any) => {
      setContacts(res.contacts ?? res);
    });
  };

  useEffect(() => {
    refreshContacts();
  }, [search, statusFilter]);

  const activeCount = contacts.filter(c => c.status === 'active').length;
  const optedOutCount = contacts.filter(c => c.status === 'opted_out').length;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 border border-emerald-500 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Client Database</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Primary Row: <strong>Mobile Number (E.164)</strong>. Clients can add/update records anytime.
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
            <Plus size={14} /> Add / Update Single Client
          </button>
        </div>
      </div>

      {/* Mobile Upsert Info Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-900">
              Automatic Mobile Number Upsert Active
            </p>
            <p className="text-[11px] text-emerald-700">
              Whenever you add or import client records, existing mobile numbers are automatically updated with new names, emails, and tags. No duplicates are created!
            </p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-emerald-800">
          <span>Active: <strong>{activeCount}</strong></span>
          <span>•</span>
          <span>Opted Out: <strong>{optedOutCount}</strong></span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9 text-xs"
            placeholder="Search by client name or mobile (+91...)"
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
            <option value="all">All Contacts ({contacts.length})</option>
            <option value="active">Active Only ({activeCount})</option>
            <option value="opted_out">Opted Out (STOP) ({optedOutCount})</option>
          </select>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Primary Mobile (E.164)</th>
                <th className="py-3 px-4">Tags & Segment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Broadcast Receipt</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No contacts found matching "{search}".
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const hasSeen = c.last_message_status === 'read';
                  return (
                    <tr
                      key={c.id || c.whatsapp_e164}
                      className="hover:bg-gray-50/80 transition cursor-pointer"
                      onClick={() => setSelectedContact(c)}
                    >
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        {c.name}
                        {c.email && (
                          <span className="block font-normal text-[11px] text-gray-400 truncate max-w-[200px]">
                            {c.email}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-emerald-800">
                        {c.whatsapp_e164}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags ?? []).map((tag: string) => (
                            <span
                              key={tag}
                              className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {c.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={12} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                            <XCircle size={12} /> Opted Out (STOP)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {hasSeen ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                            <Eye size={13} className="text-emerald-600" />
                            Seen ✓✓
                          </span>
                        ) : c.last_message_status === 'delivered' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                            <EyeOff size={13} className="text-amber-600" />
                            Delivered (Unread)
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Pending / Queued</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContact(c);
                          }}
                          className="text-xs text-whatsapp-teal font-semibold hover:underline"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Update Single Contact Modal */}
      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onSaved={(c) => {
            setShowAddModal(false);
            refreshContacts();
            showToast(`Saved client: ${c.name} (${c.whatsapp_e164})`);
          }}
        />
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <BulkImportModal
          onClose={() => setShowImportModal(false)}
          onImported={(summary) => {
            setShowImportModal(false);
            refreshContacts();
            showToast(`Import Complete: ${summary.inserted} added, ${summary.updated} updated by mobile!`);
          }}
        />
      )}

      {/* Contact Drawer */}
      {selectedContact && (
        <ContactDrawer
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onOptOut={(mobile) => {
            selectedContact.status = 'opted_out';
            refreshContacts();
            showToast(`Marked ${mobile} as opted out.`);
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Add / Update Modal Component
// -------------------------------------------------------------
function AddContactModal({ onClose, onSaved }: { onClose: () => void; onSaved: (c: any) => void }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [tags, setTags] = useState('VIP, November-Client');
  const [city, setCity] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !name.trim()) return;

    // Normalize phone number (E.164)
    let cleaned = mobile.replace(/[^0-9+]/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) cleaned = '+91' + cleaned;
      else if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = '+' + cleaned;
    }

    const payload = {
      name,
      mobile: cleaned,
      email: email || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      extra: city ? { city } : {},
    };

    api.contacts.upsert(payload).then((saved) => {
      onSaved(saved);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Add or Update Client</h2>
            <p className="text-[11px] text-gray-500">
              Matched by primary mobile number automatically
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="label">Primary Mobile Number *</label>
            <input
              type="text"
              className="input font-mono font-medium"
              placeholder="+919876543210 or 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
            />
            <p className="text-[10px] text-gray-400 mt-1">
              If this mobile already exists, the client record will be updated.
            </p>
          </div>

          <div>
            <label className="label">Client Full Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Ramesh Patel"
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
              placeholder="ramesh@company.com"
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

          <div>
            <label className="label">City / Extra Info</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Mumbai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs">
              Save Client Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Bulk Import Modal Component
// -------------------------------------------------------------
function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: (summary: any) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pasteData, setPasteData] = useState(
    `Mobile,Name,Email,City\n+919811223344,Deepak Verma,deepak@verma.com,Delhi\n+919899887766,Amitabh Joshi,amitabh@joshi.in,Pune\n+919876543210,Rajesh Kumar (Updated),rajesh.new@gmail.com,Mumbai`
  );
  const [consentConfirmed, setConsentConfirmed] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleRunImport = () => {
    if (!consentConfirmed) {
      alert('Please confirm that these recipients have opted in to receive WhatsApp notifications.');
      return;
    }
    setLoading(true);

    // Parse CSV lines
    const lines = pasteData.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const mobileIdx = headers.findIndex((h) => h.includes('mobile') || h.includes('phone'));
    const nameIdx = headers.findIndex((h) => h.includes('name'));
    const emailIdx = headers.findIndex((h) => h.includes('email'));
    const cityIdx = headers.findIndex((h) => h.includes('city'));

    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        let mob = parts[mobileIdx !== -1 ? mobileIdx : 0];
        let nm = parts[nameIdx !== -1 ? nameIdx : 1];
        if (mob && nm) {
          if (!mob.startsWith('+') && mob.length === 10) mob = '+91' + mob;
          parsed.push({
            mobile: mob,
            name: nm,
            email: emailIdx !== -1 ? parts[emailIdx] : undefined,
            extra: cityIdx !== -1 ? { city: parts[cityIdx] } : {},
          });
        }
      }
    }

    api.contacts.importBatch(parsed).then((summary) => {
      setLoading(false);
      onImported(summary);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-xl p-6 space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Bulk Client Import & Update</h2>
            <p className="text-[11px] text-gray-500">
              Paste CSV rows or upload an Excel file. Primary row is Mobile Number.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="label">CSV Data with Mobile Number as Primary Column</label>
            <textarea
              className="input font-mono text-xs h-36 resize-none"
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-600" /> WhatsApp Opt-in Compliance
            </p>
            <p className="text-[11px] text-amber-800">
              Existing mobile numbers will be updated automatically. Numbers with opt-out (STOP) history will remain protected and excluded from broadcasts.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={(e) => setConsentConfirmed(e.target.checked)}
              className="rounded text-whatsapp-teal focus:ring-whatsapp-teal"
            />
            <span>I confirm that these contacts have given opt-in consent to receive business messages.</span>
          </label>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleRunImport}
              className="btn-primary text-xs"
            >
              {loading ? 'Processing Upserts…' : 'Run Import & Upsert'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Contact Detail Drawer Component
// -------------------------------------------------------------
function ContactDrawer({ contact, onClose, onOptOut }: { contact: any; onClose: () => void; onOptOut: (m: string) => void }) {
  const hasSeen = contact.last_message_status === 'read';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Client Profile
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">{contact.name}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {/* Contact Details Grid */}
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <Phone size={16} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400 font-medium">PRIMARY MOBILE (E.164)</p>
                <p className="font-mono font-bold text-gray-900">{contact.whatsapp_e164}</p>
              </div>
            </div>

            {contact.email && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Mail size={16} className="text-blue-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 font-medium">EMAIL</p>
                  <p className="text-gray-900">{contact.email}</p>
                </div>
              </div>
            )}

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
              <p className="text-[10px] text-gray-400 font-medium">SEEN & READ RECEIPT AUDIT</p>
              {hasSeen ? (
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
                  <Eye size={15} className="text-emerald-600" />
                  <span>Verified Seen ✓✓ at {contact.seen_at ? new Date(contact.seen_at).toLocaleTimeString() : 'Recent'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-800 text-xs">
                  <EyeOff size={15} className="text-amber-600" />
                  <span>Delivered to phone • Not yet opened by client</span>
                </div>
              )}
            </div>

            {contact.extra && Object.keys(contact.extra).length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                <p className="text-[10px] text-gray-400 font-medium">CUSTOM FIELDS</p>
                <div className="space-y-0.5 text-gray-700">
                  {Object.entries(contact.extra).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="capitalize">{k}:</span>
                      <strong className="font-medium">{String(v)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t space-y-2">
          <a
            href={`https://wa.me/${contact.whatsapp_e164.replace('+', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full justify-center text-xs py-2.5"
          >
            Chat Directly on WhatsApp Web ↗
          </a>
          {contact.status === 'active' && (
            <button
              onClick={() => onOptOut(contact.whatsapp_e164)}
              className="btn-secondary text-red-600 hover:bg-red-50 w-full justify-center text-xs py-2"
            >
              Opt Out (Mark Unsubscribed)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
