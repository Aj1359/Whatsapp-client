import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Send, Trash2, Eye } from 'lucide-react';
import { broadcastsApi, credentialsApi } from '../lib/api';
import { formatDate, pct } from '../lib/utils';
import { StatusBadge } from '../components/StatusBadge';

export default function BroadcastsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['broadcasts', page],
    queryFn: () => broadcastsApi.list({ page: String(page), limit: '20' }),
    placeholderData: prev => prev,
    refetchInterval: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => broadcastsApi.send(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcasts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => broadcastsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcasts'] }),
  });

  const broadcasts = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcasts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total campaigns</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Broadcast
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Campaign</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Recipients</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Sent</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Delivered</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-whatsapp-teal">Read ✓✓</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Failed</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sent At</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              )}
              {!isLoading && broadcasts.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No broadcasts yet — create one!</td></tr>
              )}
              {broadcasts.map((b: any) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium max-w-xs truncate">{b.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{(b.total_recipients ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{(b.sent_count ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-indigo-700">
                    {(b.delivered_count ?? 0).toLocaleString()}
                    <span className="text-gray-400 text-xs ml-1">({pct(b.delivered_count, b.total_recipients)})</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">
                    {(b.read_count ?? 0).toLocaleString()}
                    <span className="text-gray-400 text-xs font-normal ml-1">({pct(b.read_count, b.total_recipients)})</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">
                    {(b.failed_count ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(b.sent_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {(b.status === 'DRAFT' || b.status === 'SCHEDULED') && (
                        <button
                          onClick={() => { if (confirm('Send this broadcast now?')) sendMutation.mutate(b.id); }}
                          className="text-whatsapp-teal hover:text-whatsapp-dark transition-colors"
                          title="Send now"
                        >
                          <Send size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/broadcasts/${b.id}`)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="View report"
                      >
                        <Eye size={15} />
                      </button>
                      {b.status !== 'SENDING' && (
                        <button
                          onClick={() => { if (confirm('Delete this broadcast?')) deleteMutation.mutate(b.id); }}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs px-3 py-1">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-xs px-3 py-1">Next</button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateBroadcastModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['broadcasts'] }); }} />}
    </div>
  );
}

function CreateBroadcastModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    credential_id: '',
    message_body: '',
    recipient_type: 'all' as 'all' | 'tags' | 'manual',
    recipient_tags: '',
    recipient_mobiles: '',
    scheduled_at: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: creds } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsApi.list(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: any = {
        name: form.name,
        credential_id: form.credential_id,
        message_body: form.message_body,
        scheduled_at: form.scheduled_at || null,
      };
      if (form.recipient_type === 'all') payload.all_active_contacts = true;
      else if (form.recipient_type === 'tags') payload.recipient_tags = form.recipient_tags.split(',').map(t => t.trim()).filter(Boolean);
      else payload.recipient_mobile_numbers = form.recipient_mobiles.split('\n').map(m => m.trim()).filter(Boolean);

      await broadcastsApi.create(payload);
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="card w-full max-w-lg p-6 my-4">
        <h2 className="text-lg font-semibold mb-4">New Broadcast</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Campaign Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">WhatsApp Credential *</label>
            <select className="input" value={form.credential_id} onChange={e => set('credential_id', e.target.value)} required>
              <option value="">Select credential…</option>
              {(creds ?? []).filter((c: any) => c.is_active).map((c: any) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Message *</label>
            <textarea className="input h-24 resize-none" value={form.message_body} onChange={e => set('message_body', e.target.value)} required />
          </div>
          <div>
            <label className="label">Recipients</label>
            <div className="flex gap-3 mb-2">
              {(['all', 'tags', 'manual'] as const).map(t => (
                <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={form.recipient_type === t} onChange={() => set('recipient_type', t)} />
                  {t === 'all' ? 'All active contacts' : t === 'tags' ? 'By tags' : 'Manual list'}
                </label>
              ))}
            </div>
            {form.recipient_type === 'tags' && (
              <input className="input" placeholder="vip, customer" value={form.recipient_tags} onChange={e => set('recipient_tags', e.target.value)} />
            )}
            {form.recipient_type === 'manual' && (
              <textarea className="input h-24 font-mono text-xs resize-none" placeholder="+919876543210&#10;+919876543211" value={form.recipient_mobiles} onChange={e => set('recipient_mobiles', e.target.value)} />
            )}
          </div>
          <div>
            <label className="label">Schedule At (optional — leave blank to send now)</label>
            <input type="datetime-local" className="input" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
