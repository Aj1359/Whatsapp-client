import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Wifi, Send, User, Smartphone, AlertTriangle, ShieldCheck } from 'lucide-react';
import { WhatsAppSetupModal } from './WhatsAppSetupModal';

export function TopBar() {
  const { currentOrg, user, whatsAppStatus, updateWhatsAppStatusLocally } = useAuth();
  const [showSetupModal, setShowSetupModal] = useState(false);

  return (
    <>
      <header className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {/* Organization badge */}
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
            <Building2 size={16} className="text-whatsapp-teal" />
            <span className="max-w-[150px] truncate">{currentOrg?.name ?? 'Business Workspace'}</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-normal">
              {currentOrg?.role ?? 'Owner'}
            </span>
          </div>

          {/* User's WhatsApp Integration Status */}
          {whatsAppStatus.isConnected ? (
            <div
              onClick={() => setShowSetupModal(true)}
              className="flex items-center gap-2 text-xs text-gray-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-emerald-100/60 transition"
              title="Click to view or edit your WhatsApp Business settings"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <Smartphone size={13} className="text-emerald-700" />
              <span className="font-semibold text-emerald-900">
                {whatsAppStatus.displayPhone || 'WhatsApp Connected'}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium hidden lg:inline">
                ({whatsAppStatus.verifiedName || 'Meta Verified'})
              </span>
            </div>
          ) : (
            <button
              onClick={() => setShowSetupModal(true)}
              className="flex items-center gap-1.5 text-xs text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-1.5 rounded-md font-semibold hover:bg-amber-100 transition animate-pulse"
            >
              <AlertTriangle size={13} className="text-amber-600" />
              Connect WhatsApp Business Profile →
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Daily Send Allowance Badge */}
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1 rounded-full text-xs">
            <Send size={12} className="text-emerald-700" />
            <span className="font-medium">Daily Limit:</span>
            <span className="font-bold">185 / 250 remaining</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-700 pl-2 border-l border-gray-200">
            <div className="w-7 h-7 rounded-full bg-whatsapp-teal/10 text-whatsapp-teal flex items-center justify-center font-bold text-xs">
              <User size={14} />
            </div>
            <span className="text-xs text-gray-600 hidden md:inline truncate max-w-[140px]">
              {user?.email ?? 'User'}
            </span>
          </div>
        </div>
      </header>

      {/* WhatsApp Onboarding / Credentials Modal */}
      <WhatsAppSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSuccess={(saved) => {
          updateWhatsAppStatusLocally({
            isConnected: true,
            displayPhone: saved.display_phone || '+91 98765 43210',
            verifiedName: saved.verified_name || 'Verified Business Account',
            qualityRating: saved.quality_rating || 'GREEN',
          });
        }}
      />
    </>
  );
}
