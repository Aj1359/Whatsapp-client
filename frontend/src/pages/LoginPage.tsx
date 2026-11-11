import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  MessageSquare,
  BarChart3,
  Send,
  GitBranch,
  Users,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      setError(err.message ?? 'Authentication failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#021f15] via-[#064e3b] to-[#022c22] flex items-center justify-center p-4 lg:p-12 relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[32rem] h-[32rem] bg-[#25D366]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-80 h-80 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main Grid Container */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        
        {/* LEFT COLUMN: Hero Brand & Feature Showcase */}
        <div className="lg:col-span-7 text-white space-y-7 px-2 sm:px-6">
          
          {/* Logo & Platform Tag */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#128C7E] to-[#25D366] flex items-center justify-center shadow-lg shadow-emerald-950/40 border border-emerald-400/30">
              <div className="relative">
                <MessageSquare size={26} className="text-white fill-white/20" />
                <BarChart3 size={13} className="text-white absolute top-1 left-1.5" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white block leading-none">
                WABizConnect
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300/90 block mt-1">
                WHATSAPP BUSINESS PLATFORM
              </span>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.15]">
              Grow Your Business with{' '}
              <span className="text-[#34d399] drop-shadow-sm block sm:inline">
                WhatsApp Marketing
              </span>
            </h1>
            <p className="text-emerald-100/80 text-sm sm:text-base max-w-xl leading-relaxed">
              Broadcast campaigns, automate follow-ups, manage customers, and track performance — all in one place.
            </p>
          </div>

          {/* 4 Feature Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-1">
            <div className="space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-800/50 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <Send size={18} />
              </div>
              <h4 className="font-bold text-xs text-white">Bulk Broadcasts</h4>
              <p className="text-[11px] text-emerald-200/70 leading-snug">Reach thousands instantly</p>
            </div>

            <div className="space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-800/50 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <GitBranch size={18} />
              </div>
              <h4 className="font-bold text-xs text-white">Automated Follow-ups</h4>
              <p className="text-[11px] text-emerald-200/70 leading-snug">Send smart sequences</p>
            </div>

            <div className="space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-800/50 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <Users size={18} />
              </div>
              <h4 className="font-bold text-xs text-white">Customer Management</h4>
              <p className="text-[11px] text-emerald-200/70 leading-snug">Organize and segment contacts</p>
            </div>

            <div className="space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-800/50 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <BarChart3 size={18} />
              </div>
              <h4 className="font-bold text-xs text-white">Real-time Analytics</h4>
              <p className="text-[11px] text-emerald-200/70 leading-snug">Track delivery, reads and replies</p>
            </div>
          </div>

          {/* Perspective Dashboard Preview Mockup Card */}
          <div className="hidden sm:block pt-3">
            <div className="bg-gradient-to-b from-gray-900/90 to-gray-950/95 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md max-w-lg transform -rotate-1 hover:rotate-0 transition duration-300">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-white">WABizConnect</span>
                  <span className="text-[10px] text-gray-400">/ Dashboard</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                  Live Meta Cloud API
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700/50">
                  <span className="text-[9px] text-gray-400 block">Contacts</span>
                  <span className="text-xs font-bold text-white">12,540</span>
                  <span className="text-[8px] text-emerald-400 block">+8.4%</span>
                </div>
                <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700/50">
                  <span className="text-[9px] text-gray-400 block">Sent</span>
                  <span className="text-xs font-bold text-white">9,820</span>
                  <span className="text-[8px] text-emerald-400 block">+12.6%</span>
                </div>
                <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700/50">
                  <span className="text-[9px] text-gray-400 block">Delivered</span>
                  <span className="text-xs font-bold text-white">95.8%</span>
                  <span className="text-[8px] text-emerald-400 block">Verified</span>
                </div>
                <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700/50">
                  <span className="text-[9px] text-gray-400 block">Read (✓✓)</span>
                  <span className="text-xs font-bold text-[#34d399]">80.4%</span>
                  <span className="text-[8px] text-emerald-400 block">Blue Ticks</span>
                </div>
              </div>

              {/* Chart Wave SVG */}
              <div className="h-10 w-full flex items-end">
                <svg viewBox="0 0 400 60" className="w-full h-full stroke-emerald-400 fill-emerald-500/20">
                  <path
                    d="M0,50 Q40,10 80,35 T160,20 T240,40 T320,15 T400,25 L400,60 L0,60 Z"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Modern Floating White Card */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-7 sm:p-9 border border-gray-100 space-y-6">
            
            {/* Header */}
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                {mode === 'signin' ? (
                  <>
                    Welcome Back <span className="inline-block animate-wave">👋</span>
                  </>
                ) : (
                  <>
                    Get Started Free <span className="inline-block">🚀</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {mode === 'signin'
                  ? 'Sign in to your WABizConnect account'
                  : 'Create your WABizConnect business profile'}
              </p>
            </div>

            {/* Pill Tabs: Sign In vs Create Business Account */}
            <div className="bg-gray-100 p-1 rounded-xl flex items-center">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                }}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'signin'
                    ? 'bg-[#064e3b] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
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
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'signup'
                    ? 'bg-[#064e3b] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Create Business Account
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {error}
                </div>
              )}

              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Building2 size={13} className="text-[#064e3b]" />
                    Business / Brand Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Wholesalers & Retail"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#064e3b] text-xs font-medium bg-gray-50/50"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
              )}

              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <Mail size={13} className="text-[#064e3b]" />
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="Enter your work email"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#064e3b] text-xs font-medium bg-gray-50/50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <Lock size={13} className="text-[#064e3b]" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#064e3b] text-xs font-medium bg-gray-50/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-gray-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-gray-300 text-[#064e3b] focus:ring-[#064e3b]"
                  />
                  <span>Remember me for 30 days</span>
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Password reset instructions will be sent to your registered email address.');
                  }}
                  className="text-xs font-bold text-[#064e3b] hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              {/* Main Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#064e3b] hover:bg-[#043d2e] text-white font-bold text-xs transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-1.5 active:scale-[0.99]"
              >
                {loading ? (
                  'Please wait...'
                ) : mode === 'signin' ? (
                  <>
                    Sign In →
                  </>
                ) : (
                  <>
                    Create Business Account →
                  </>
                )}
              </button>
            </form>

            {/* Social Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-white px-2 text-gray-400 font-semibold">
                  or continue with
                </span>
              </div>
            </div>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={() => {
                alert('Google Sign-in is available once Google OAuth provider is enabled in your Supabase Auth settings.');
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50/80 transition flex items-center justify-center gap-2 text-xs font-bold text-gray-700 shadow-sm"
            >
              {/* Google G Logo SVG */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>

            {/* Terms and Privacy Policy Notice */}
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              By signing in, you agree to our{' '}
              <a href="#terms" className="text-gray-600 font-semibold underline hover:text-gray-900">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#privacy" className="text-gray-600 font-semibold underline hover:text-gray-900">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
