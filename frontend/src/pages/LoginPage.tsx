import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, TEST_ACCOUNTS } from '../contexts/AuthContext';
import {
  MessageSquare,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Building2,
  User,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp, signInWithTestAccount, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!businessName.trim()) {
          setError('Please provide your business or brand name.');
          setLoading(false);
          return;
        }
        await signUp(email, password, businessName.trim());
      } else {
        await signIn(email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (accountEmail: string) => {
    signInWithTestAccount(accountEmail);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] p-4 py-12">
      <div className="w-full max-w-lg space-y-5">
        {/* Brand Header */}
        <div className="text-center text-white space-y-1.5">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur rounded-2xl shadow-lg border border-white/30 mb-1">
            <MessageSquare size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">WhatsApp Business Broadcast</h1>
          <p className="text-white/80 text-xs">
            Multi-Tenant Customer Broadcasts, Seen/Not-Seen Audit & Follow-ups
          </p>
        </div>

        {/* 1-Click Test Accounts Selection Card */}
        <div className="card p-4 bg-white/95 shadow-xl border-emerald-400 border-2 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <KeyRound size={15} className="text-whatsapp-teal" />
              Pre-Configured Test Accounts (1-Click Login)
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Ready to Test
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {TEST_ACCOUNTS.map((acc, idx) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleQuickLogin(acc.email)}
                className="text-left p-3 rounded-xl border border-gray-200 hover:border-whatsapp-teal hover:bg-emerald-50/50 transition flex items-center justify-between group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <p className="font-bold text-xs text-gray-900 group-hover:text-whatsapp-teal">
                      {acc.businessName}
                    </p>
                  </div>
                  <p className="text-[11px] font-mono text-gray-500 pl-7">
                    {acc.email} • Pass: <code className="font-semibold text-gray-700">{acc.password}</code>
                  </p>
                  <p className="text-[10px] text-emerald-700 pl-7">
                    WhatsApp: {acc.displayPhone} (Meta Verified)
                  </p>
                </div>
                <span className="btn-secondary text-[11px] px-2.5 py-1 text-whatsapp-teal group-hover:bg-whatsapp-teal group-hover:text-white transition">
                  Login →
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Sign In / Sign Up Form */}
        <div className="card p-6 shadow-xl border-white/20 backdrop-blur bg-white/95 space-y-5">
          {/* Mode Tabs: Sign In vs Create Account */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition ${
                mode === 'signin'
                  ? 'border-whatsapp-teal text-whatsapp-teal'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign In with Custom Email
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition ${
                mode === 'signup'
                  ? 'border-whatsapp-teal text-whatsapp-teal'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Register New Business
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Business / Brand Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    className="input pl-9"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Skyline Logistics"
                    required
                  />
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email Address *</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="founder@company.com"
                required
              />
            </div>

            <div>
              <label className="label">Password *</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-xs font-bold"
            >
              {loading
                ? 'Processing…'
                : mode === 'signup'
                ? 'Register Business Account & Launch'
                : 'Sign In to Workspace'}
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-500 space-y-1">
            <div className="flex items-center gap-1.5 text-gray-600">
              <CheckCircle2 size={13} className="text-whatsapp-teal shrink-0" /> Multi-tenant business isolation
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <CheckCircle2 size={13} className="text-whatsapp-teal shrink-0" /> Primary mobile number upsert on client updates
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <CheckCircle2 size={13} className="text-whatsapp-teal shrink-0" /> Seen / Read receipts audit with time of opening
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
