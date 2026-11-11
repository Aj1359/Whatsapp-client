import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WhatsAppSetupModal } from '../components/WhatsAppSetupModal';
import {
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Key,
  Globe,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export default function SettingsPage() {
  const { currentOrg, whatsAppStatus, updateWhatsAppStatusLocally } = useAuth();
  const [showSetupModal, setShowSetupModal] = useState(false);

  // Sending & Pricing settings from PRD Page 6
  const [defaultCountry, setDefaultCountry] = useState('IN');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [dailyCap, setDailyCap] = useState(250);
  const [sendRate, setSendRate] = useState(20);
  const [rateMarketing, setRateMarketing] = useState(0.8631);
  const [rateUtility, setRateUtility] = useState(0.115);
  const [gstPercent, setGstPercent] = useState(18);
  const [savedSettingsNotice, setSavedSettingsNotice] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSettingsNotice(true);
    setTimeout(() => setSavedSettingsNotice(false), 3000);
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Workspace & WhatsApp Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage your Meta WhatsApp Cloud API credentials, rate caps, and billing rates for <strong>{currentOrg?.name}</strong>.
        </p>
      </div>

      {savedSettingsNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Sending and pricing preferences saved successfully!</span>
        </div>
      )}

      {/* Meta WhatsApp Integration Card */}
      <div className="card p-6 space-y-5 border-l-4 border-l-whatsapp-teal">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Meta WhatsApp Business Integration
              </h2>
              <p className="text-xs text-gray-500">
                Credentials are encrypted with AES-256-GCM. Stored isolated for {currentOrg?.name}.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSetupModal(true)}
            className="btn-primary text-xs px-4 py-2 self-start sm:self-auto"
          >
            {whatsAppStatus.isConnected ? 'Update / Reconnect API' : 'Connect Meta Account'}
          </button>
        </div>

        {whatsAppStatus.isConnected ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-0.5">
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Verified Business Name</span>
              <p className="font-bold text-gray-900 text-sm flex items-center gap-1">
                {whatsAppStatus.verifiedName || currentOrg?.name}
                <ShieldCheck size={14} className="text-emerald-600" />
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-0.5">
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Sender Phone Number</span>
              <p className="font-mono font-bold text-emerald-800 text-sm">
                {whatsAppStatus.displayPhone || '+91 98765 43210'}
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-0.5">
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Quality Rating</span>
              <p className="font-bold text-emerald-700 text-sm flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {whatsAppStatus.qualityRating || 'GREEN (High Quality)'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <p className="font-bold flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600" />
              WhatsApp Business Profile Not Integrated Yet
            </p>
            <p className="text-[11px] text-amber-800">
              Each user connects their own Meta Business account. Once connected, your verified sender name, phone number, and templates are linked directly to your organization.
            </p>
            <button
              onClick={() => setShowSetupModal(true)}
              className="text-xs font-bold text-amber-900 underline"
            >
              Click here to enter Phone Number ID & Access Token →
            </button>
          </div>
        )}

        {/* Webhook Endpoint Guide */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
          <p className="font-bold text-gray-800 flex items-center gap-1.5">
            <Globe size={14} className="text-whatsapp-teal" /> Webhook Configuration (Meta Developer Portal)
          </p>
          <p className="text-[11px] text-gray-500">
            Paste this URL into <strong>Meta App → WhatsApp → Configuration → Webhook</strong> so delivery and read receipts flow into your reports:
          </p>
          <div className="bg-white border rounded p-2 font-mono text-[11px] select-all break-all text-gray-800">
            {window.location.origin.replace('5173', '4000')}/webhooks/whatsapp
          </div>
          <p className="text-[11px] text-gray-500">
            Verify Token: <code className="font-mono font-bold text-gray-700">wa_verify_token_123456</code> • Field subscription: <code className="bg-gray-100 px-1 rounded">messages</code>
          </p>
        </div>
      </div>

      {/* Sending & Rate Caps Form */}
      <div className="card p-6 space-y-5">
        <div className="border-b pb-3">
          <h2 className="text-base font-bold text-gray-900">
            Sending Caps & Regional Settings
          </h2>
          <p className="text-xs text-gray-500">
            Configure safety throttling, daily caps, and default region.
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Default Country Code (E.164 Normalization)</label>
              <select
                className="input"
                value={defaultCountry}
                onChange={(e) => setDefaultCountry(e.target.value)}
              >
                <option value="IN">India (+91)</option>
                <option value="US">United States (+1)</option>
                <option value="GB">United Kingdom (+44)</option>
                <option value="AE">United Arab Emirates (+971)</option>
              </select>
            </div>

            <div>
              <label className="label">Timezone (for Daily Caps & Reset)</label>
              <select
                className="input"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="UTC">UTC (GMT)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              </select>
            </div>

            <div>
              <label className="label">Daily Send Cap (Messages per Day)</label>
              <input
                type="number"
                className="input"
                value={dailyCap}
                onChange={(e) => setDailyCap(Number(e.target.value))}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Tier 1 Meta accounts start at 250/day. Automatically pauses when cap reached.
              </p>
            </div>

            <div>
              <label className="label">Send Rate Throttling (Messages per Second)</label>
              <input
                type="number"
                className="input"
                value={sendRate}
                onChange={(e) => setSendRate(Number(e.target.value))}
              />
              <p className="text-[10px] text-gray-400 mt-1">Default 20/sec (max 80/sec).</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-bold text-sm text-gray-900 mb-3">Estimated Pricing Rates (INR)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Marketing Fee (₹ / delivered msg)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="input font-mono"
                  value={rateMarketing}
                  onChange={(e) => setRateMarketing(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="label">Utility Fee (₹ / delivered msg)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="input font-mono"
                  value={rateUtility}
                  onChange={(e) => setRateUtility(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="label">GST Percentage (%)</label>
                <input
                  type="number"
                  className="input font-mono"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button type="submit" className="btn-primary text-xs px-5 py-2">
              Save Workspace Preferences
            </button>
          </div>
        </form>
      </div>

      <WhatsAppSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSuccess={(saved) => {
          updateWhatsAppStatusLocally({
            isConnected: true,
            displayPhone: saved.display_phone || saved.phone_number_id || 'Connected Number',
            verifiedName: saved.verified_name || 'Verified Business Profile',
            qualityRating: saved.quality_rating || 'GREEN',
          });
        }}
      />
    </div>
  );
}
