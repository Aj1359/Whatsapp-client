import React, { useState } from 'react';
import { mockData } from '../lib/api';
import { FileText, Plus, CheckCircle2, RefreshCw, Smartphone, Image as ImageIcon } from 'lucide-react';

export default function TemplatesPage() {
  const [templates] = useState(mockData.templates);
  const [selectedTemplate, setSelectedTemplate] = useState(mockData.templates[0]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">WhatsApp Message Templates</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Meta Cloud API approved templates with image headers and dynamic variable replacement.
          </p>
        </div>

        <div className="flex gap-2">
          <button className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            <RefreshCw size={13} /> Sync from Meta WABA
          </button>
          <button className="btn-primary text-xs px-3.5 py-2">
            <Plus size={14} /> New Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Templates List Table */}
        <div className="lg:col-span-7 card overflow-hidden">
          <div className="p-4 border-b font-bold text-sm text-gray-800">
            Approved WABA Templates ({templates.length})
          </div>
          <div className="divide-y divide-gray-100">
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className={`p-4 hover:bg-gray-50 transition cursor-pointer flex items-center justify-between ${
                  selectedTemplate.id === t.id ? 'bg-emerald-50/50 border-l-4 border-l-whatsapp-teal' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-xs text-gray-900">{t.name}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 size={11} /> {t.status}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase font-medium bg-gray-100 px-1.5 py-0.5 rounded">
                      {t.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 line-clamp-1">{t.body}</p>
                </div>

                <span className="text-xs text-whatsapp-teal font-semibold">Preview →</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live WhatsApp Bubble Preview (PRD Page 15 requirement) */}
        <div className="lg:col-span-5 card p-5 space-y-4 bg-gray-100/70 border-gray-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Smartphone size={15} /> WhatsApp Handset Preview
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
              Meta Approved
            </span>
          </div>

          {/* Chat Bubble Phone Simulation */}
          <div className="bg-[#ECE5DD] p-4 rounded-2xl shadow-inner border border-gray-300 max-w-sm mx-auto space-y-2">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden text-xs text-gray-900 max-w-[280px]">
              {selectedTemplate.header_type === 'image' && (
                <div className="h-32 bg-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1 border-b">
                  <ImageIcon size={24} />
                  <span className="text-[10px]">Campaign Banner Image</span>
                </div>
              )}

              <div className="p-3 space-y-2">
                <p className="whitespace-pre-line leading-relaxed text-[11px] text-gray-800">
                  {selectedTemplate.body
                    .replace('{{1}}', 'Rahul')
                    .replace('{{2}}', 'DIWALI30')
                    .replace('{{3}}', 'https://track.clientbase.in/1029')}
                </p>

                {selectedTemplate.footer && (
                  <p className="text-[9px] text-gray-400 border-t pt-1">
                    {selectedTemplate.footer}
                  </p>
                )}

                <div className="flex justify-end items-center gap-1 text-[9px] text-gray-400">
                  <span>14:30</span>
                  <span className="text-whatsapp-teal font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

