import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  Smartphone,
  ShieldCheck,
  Globe,
  Key,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Building2,
  User,
} from 'lucide-react';

export default function ProfileConnectorPage() {
  const { currentOrg, user, whatsAppStatus, updateWhatsAppStatusLocally } = useAuth();

  const [phoneId, setPhoneId] = useState(whatsAppStatus.phoneNumberId || '974413665755017');
  const [wabaId, setWabaId] = useState(whatsAppStatus.wabaId || '1360714332762492');
  const [token, setToken] = useState('');
  const [appSecret, setAppSecret] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/webhooks/whatsapp`
    : 'https://wa-backend-ayta.onrender.com/webhooks/whatsapp';

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.settings.testWhatsApp({
        phone_number_id: phoneId,
        token,
      });
      setTestResult({
        success: true,
        display_phone: res.display_phone_number || res.display_phone || phoneId,
        verified_name: res.verified_name || currentOrg?.name || 'Verified WhatsApp Profile',
        quality_rating: res.quality_rating || 'GREEN',
      });
    } catch (err: any) {
      console.error('Meta connection test error:', err);
      setTestResult({
        success: false,
        error: err.message || 'Connection test failed. Please verify credentials.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.settings.saveWhatsApp({
        phone_number_id: phoneId,
        waba_id: wabaId,
        token,
        app_secret: appSecret || undefined,
      });
      updateWhatsAppStatusLocally({
        isConnected: true,
        phoneNumberId: phoneId,
        wabaId,
        displayPhone: testResult?.display_phone || phoneId,
        verifiedName: testResult?.verified_name || currentOrg?.name,
        qualityRating: testResult?.quality_rating || 'GREEN',
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
          Profile & Meta WhatsApp Connector
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Everything you need to link your WhatsApp Business Cloud API to the backend.
        </p>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl text-xs flex items-center gap-2 shadow-sm">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span className="font-bold">WhatsApp credentials saved and connected to backend successfully!</span>
        </div>
      )}

      {/* User & Organization Profile Details */}
      <div className="card p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
          <Building2 size={16} className="text-whatsapp-teal" />
          Account & Workspace Profile
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Business Name</span>
            <p className="font-bold text-gray-900 text-sm">{currentOrg?.name}</p>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">User Email</span>
            <p className="font-medium text-gray-800 text-sm">{user?.email}</p>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Workspace Role</span>
            <p className="font-bold text-emerald-700 text-sm uppercase">{currentOrg?.role || 'Owner'}</p>
          </div>
        </div>
      </div>

      {/* Meta WhatsApp Connector (Form + Test Connection) */}
      <div className="card p-6 shadow-sm border-l-4 border-l-whatsapp-teal space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Meta Cloud API Credentials (Backend Connector)
              </h2>
              <p className="text-xs text-gray-500">
                Encrypted with AES-256-GCM. Never logged or exposed.
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-600" />
            Meta API v21.0
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone Number ID *</label>
              <input
                type="text"
                className="input font-mono font-bold"
                value={phoneId}
                onChange={(e) => setPhoneId(e.target.value)}
                placeholder="e.g. 1029384756102"
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">From Meta App → WhatsApp → API Setup</p>
            </div>

            <div>
              <label className="label">WhatsApp Business Account (WABA) ID *</label>
              <input
                type="text"
                className="input font-mono font-bold"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="e.g. 1098471928374"
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">From Meta App → WhatsApp → API Setup</p>
            </div>
          </div>

          <div>
            <label className="label">Permanent System User Access Token *</label>
            <input
              type="password"
              className="input font-mono text-xs"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAAG..."
              required
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Token with permissions: <code className="bg-gray-100 px-1 rounded">whatsapp_business_messaging</code> & <code className="bg-gray-100 px-1 rounded">whatsapp_business_management</code>
            </p>
          </div>

          <div>
            <label className="label">Meta App Secret (Optional - for webhook signature validation)</label>
            <input
              type="password"
              className="input font-mono text-xs"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="Meta App Settings → Basic → App Secret"
            />
          </div>

          {/* Test Connection Button */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={testing || !phoneId || !token}
              onClick={handleTestConnection}
              className="btn-secondary text-xs px-4 py-2 flex items-center justify-center gap-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              <ShieldCheck size={15} />
              {testing ? 'Testing Meta Connection…' : 'Test Connection with Meta API'}
            </button>

            <button type="submit" className="btn-primary text-xs px-6 py-2 shadow">
              Save & Link to Backend
            </button>
          </div>

          {/* Test connection feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {testResult.success ? (
                <div className="space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Connection Successful! Verified with Meta Cloud API.
                  </p>
                  <p className="text-[11px] text-emerald-900">
                    Display Phone: <strong>{testResult.display_phone}</strong> • Verified Name: <strong>{testResult.verified_name}</strong> • Rating: <strong className="text-emerald-700">{testResult.quality_rating}</strong>
                  </p>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-red-700">
                  <AlertCircle size={15} /> {testResult.error}
                </p>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Webhook URL & Connection Details (Everything to connect to backend) */}
      <div className="card p-6 shadow-sm border border-emerald-200 bg-emerald-50/20 space-y-4">
        <div className="border-b pb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Globe size={16} className="text-whatsapp-teal" />
            Meta Webhook Configuration (Backend URL)
          </h2>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
            Required for Delivery & Seen Receipts
          </span>
        </div>

        <p className="text-xs text-gray-600">
          In your <strong>Meta App Dashboard → WhatsApp → Configuration → Webhook</strong>, paste the following callback URL and verify token:
        </p>

        <div className="space-y-3">
          <div>
            <label className="label">Webhook Callback URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                className="input font-mono text-xs bg-white text-gray-800 font-bold"
                value={webhookUrl}
              />
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1 shrink-0"
              >
                <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="label">Verify Token</label>
              <div className="p-2.5 bg-white border rounded-lg font-mono font-bold text-gray-800 select-all">
                wa_verify_token_123456
              </div>
            </div>

            <div>
              <label className="label">Webhook Subscription Fields</label>
              <div className="p-2.5 bg-white border rounded-lg font-mono text-gray-800 font-bold">
                messages, message_template_status_update
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

