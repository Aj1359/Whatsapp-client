import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Building2, Plus, Users, Check } from 'lucide-react';

export default function AdminPage() {
  const { organizations, currentOrg, switchOrg } = useAuth();
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-gray-900">Platform Administration</h1>
            <span className="text-[10px] font-bold uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage multi-tenant business organizations, isolate client data, and create client logins.
          </p>
        </div>

        <button
          onClick={() => setShowAddOrg(true)}
          className="btn-primary text-xs px-3.5 py-2"
        >
          <Plus size={14} /> Provision New Business Org
        </button>
      </div>

      {/* Organizations List */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b font-bold text-sm text-gray-800">
          Managed Client Organizations ({organizations.length})
        </div>

        <div className="divide-y divide-gray-100">
          {organizations.map((org) => {
            const isActive = currentOrg?.id === org.id;
            return (
              <div
                key={org.id}
                className="p-5 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900">{org.name}</h4>
                      {isActive && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <Check size={11} /> Active Workspace
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-gray-400">Org UUID: {org.id}</p>
                  </div>
                </div>

                <div>
                  {!isActive ? (
                    <button
                      onClick={() => switchOrg(org.id)}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Switch to Org
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-semibold">Currently Viewing</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

