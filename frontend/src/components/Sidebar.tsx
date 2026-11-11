import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Users,
  Send,
  MessageSquareQuote,
  Settings,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

// Exactly the 5 sections requested:
// 1. Dashboard & Stats
// 2. Customers Data
// 3. Posts & Templates (Day-wise + History + Repeat)
// 4. Replies (Reply to all or selected)
// 5. Profile & Meta Connector
const navItems = [
  { to: '/dashboard', label: 'Dashboard & Stats', icon: BarChart3 },
  { to: '/customers', label: 'Customers Data', icon: Users },
  { to: '/posts', label: 'Posts & Templates', icon: Send },
  { to: '/replies', label: 'Replies', icon: MessageSquareQuote },
  { to: '/profile', label: 'Profile & Meta Connector', icon: Settings },
];

export function Sidebar() {
  const { signOut, user, currentOrg } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside className="flex flex-col h-screen w-64 bg-[#075E54] text-white shrink-0 shadow-xl border-r border-[#064e46]">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 bg-[#064e46]">
        <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center text-white shadow-md">
          <MessageSquare size={22} />
        </div>
        <div>
          <h2 className="font-extrabold text-sm tracking-wide">Clientbase WA</h2>
          <p className="text-[11px] text-emerald-200 truncate max-w-[140px]">
            {currentOrg?.name || 'WhatsApp Suite'}
          </p>
        </div>
      </div>

      {/* Navigation (Only the 5 sections) */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-white/20 text-white shadow-sm border border-white/20 font-bold'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <Icon size={18} className="shrink-0 text-emerald-300" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info & Sign out */}
      <div className="px-4 py-4 border-t border-white/10 bg-[#064e46] space-y-2">
        <div className="flex items-center justify-between">
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-white truncate">
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-[10px] text-emerald-200/80 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
