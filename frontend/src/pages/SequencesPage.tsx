import React, { useState } from 'react';
import { Repeat, Plus, Clock, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function SequencesPage() {
  const [sequences] = useState([
    {
      id: 1,
      name: 'Unopened Campaign Follow-up (48h Nudge)',
      triggerCampaign: 'Diwali Festive Mega Sale 2026',
      active: true,
      steps: [
        {
          stepNo: 1,
          delayHours: 24,
          condition: 'delivered_not_read', // TARGET CLIENTS WHO HAVE NOT SEEN IT
          templateName: 'unopened_nudge_reminder',
          description: 'Nudges contacts who received the broadcast but have not yet seen/opened it.',
        },
        {
          stepNo: 2,
          delayHours: 48,
          condition: 'read_no_reply',
          templateName: 'last_chance_discount',
          description: 'Offers an additional incentive for those who opened but did not convert.',
        },
      ],
      enrolledCount: 236,
      completedCount: 184,
    },
  ]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Follow-up Sequences</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Automate step-by-step follow-ups conditioned on seen/read receipts, replies, or delivery delays.
          </p>
        </div>

        <button className="btn-primary text-xs px-3.5 py-2">
          <Plus size={14} /> New Follow-up Sequence
        </button>
      </div>

      {/* Sequence List */}
      <div className="space-y-4">
        {sequences.map((seq) => (
          <div key={seq.id} className="card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-gray-900">{seq.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Trigger Campaign: <strong>{seq.triggerCampaign}</strong>
                </p>
              </div>

              <div className="text-xs text-gray-600 flex items-center gap-4">
                <span>Enrolled (Unseen/Targeted): <strong>{seq.enrolledCount}</strong></span>
                <span>Completed: <strong>{seq.completedCount}</strong></span>
              </div>
            </div>

            {/* Sequence Steps Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {seq.steps.map((st) => (
                <div key={st.stepNo} className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800 text-xs">
                      Step {st.stepNo} ({st.delayHours}h delay)
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      Condition: {st.condition}
                    </span>
                  </div>
                  <p className="text-gray-600 text-[11px] leading-relaxed">{st.description}</p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    Template: <strong>{st.templateName}</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

