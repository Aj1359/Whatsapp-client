import React, { useState } from 'react';
import { CalendarDays, Plus, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DailyPlannerPage() {
  const [currentMonth] = useState('November 2026');

  const days = [
    { day: 1, date: '2026-11-01', planned: true, title: 'Diwali Teaser Campaign', status: 'sent', seenPct: 82 },
    { day: 2, date: '2026-11-02', planned: false },
    { day: 3, date: '2026-11-03', planned: false },
    { day: 4, date: '2026-11-04', planned: true, title: 'Gold Coin Offer Push', status: 'sent', seenPct: 79 },
    { day: 5, date: '2026-11-05', planned: false },
    { day: 6, date: '2026-11-06', planned: false },
    { day: 7, date: '2026-11-07', planned: true, title: 'Weekend Flash Sale', status: 'sent', seenPct: 75 },
    { day: 8, date: '2026-11-08', planned: false },
    { day: 9, date: '2026-11-09', planned: true, title: 'Diwali Festive Mega Sale', status: 'sent', seenPct: 78.7 },
    { day: 10, date: '2026-11-10', planned: true, title: 'New Arrivals Winter Jackets', status: 'running', seenPct: 65 },
    { day: 11, date: '2026-11-11', planned: true, title: 'VIP Cart Recovery Blast', status: 'planned', time: '10:30 AM' },
    { day: 12, date: '2026-11-12', planned: false, noContentFlag: true },
    { day: 13, date: '2026-11-13', planned: false, noContentFlag: true },
    { day: 14, date: '2026-11-14', planned: false, noContentFlag: true },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Daily Broadcast Planner</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Plan scheduled daily broadcasts. Days in the next 7 with no content are flagged.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-xs font-bold text-gray-800 px-2">{currentMonth}</span>
          <button className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {days.map((d) => (
            <div
              key={d.day}
              className={`p-3 rounded-xl border text-xs min-h-[110px] flex flex-col justify-between transition ${
                d.planned
                  ? d.status === 'running'
                    ? 'border-blue-400 bg-blue-50/50'
                    : d.status === 'sent'
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-whatsapp-teal/40 bg-whatsapp-teal/5'
                  : d.noContentFlag
                  ? 'border-amber-300 bg-amber-50/40 border-dashed'
                  : 'border-gray-200 bg-gray-50/50'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-gray-700 text-sm">{d.day} Nov</span>
                {d.planned && d.status === 'sent' && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                    {d.seenPct}% seen
                  </span>
                )}
                {d.noContentFlag && (
                  <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-1 rounded">
                    Empty
                  </span>
                )}
              </div>

              {d.planned ? (
                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-900 line-clamp-2 text-[11px]">{d.title}</p>
                  <p className="text-[10px] text-gray-500">
                    {d.status === 'planned' ? `Due: ${d.time}` : 'Completed'}
                  </p>
                </div>
              ) : (
                <button className="text-[11px] text-whatsapp-teal hover:underline flex items-center gap-1 mt-auto">
                  <Plus size={11} /> Plan Send
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

