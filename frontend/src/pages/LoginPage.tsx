import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  MessageSquare,
  ArrowRight,
  Building2,
  Mail,
  Lock,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
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
        await signUp(email.trim(), password, businessName.trim());
      } else {
        await signIn(email.trim(), password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] p-4 py-12">
      <div className="w-full max-w-md space-y-5">
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

        {/* Custom Sign In / Sign Up Form */}
        <div className="card p-6 shadow-xl border-white/20 backdrop-blur bg-white/95 space-y-5">
          {/* Mode Tabs: Sign In vs Create Account */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition ${
                mode === 'signin'
                  ? 'border-whatsapp-teal text-whatsapp-teal'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition ${
                mode === 'signup'
                  ? 'border-whatsapp-teal text-whatsapp-teal'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Create Business Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Building2 size={13} className="text-whatsapp-teal" />
                  Business / Organization Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Retail Pvt Ltd"
                  className="input-field text-sm"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Mail size={13} className="text-whatsapp-teal" />
                Work Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@company.com"
                className="input-field text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Lock size={13} className="text-whatsapp-teal" />
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                className="input-field text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
            >
              {loading ? (
                'Processing...'
              ) : mode === 'signin' ? (
                <>
                  Sign In to Dashboard <ArrowRight size={14} />
                </>
              ) : (
                <>
                  Register & Connect WhatsApp <Sparkles size={14} />
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-gray-500 text-center">
            {mode === 'signin' ? (
              <>
                New organization?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                  className="text-whatsapp-teal font-bold hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                  }}
                  className="text-whatsapp-teal font-bold hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
