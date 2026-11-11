import React, { useState } from 'react';
import { mockData } from '../lib/api';
import { FolderKanban, Plus, Users, Trash2, Edit } from 'lucide-react';

export default function ListsPage() {
  const [lists] = useState(mockData.lists);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Audience Lists</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Static and dynamic audience groups used to dispatch broadcasts.
          </p>
        </div>

        <button className="btn-primary text-xs px-3.5 py-2">
          <Plus size={14} /> Create Audience List
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {lists.map((l) => (
          <div key={l.id} className="card p-5 space-y-3 hover:border-whatsapp-teal/40 transition">
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-lg bg-whatsapp-teal/10 text-whatsapp-teal flex items-center justify-center">
                <FolderKanban size={18} />
              </div>
              <span className="text-[10px] font-medium text-gray-400">Created {l.created_at}</span>
            </div>

            <div>
              <h3 className="font-bold text-sm text-gray-900">{l.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                <Users size={13} className="text-gray-400" />
                <strong>{l.member_count.toLocaleString()}</strong> client members
              </p>
            </div>

            <div className="pt-2 border-t flex justify-end gap-2 text-xs">
              <button className="btn-secondary text-xs px-2.5 py-1">Edit Members</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

