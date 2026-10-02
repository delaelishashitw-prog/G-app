import React, { useState } from 'react';
import { X, FileText, Phone, MessageCircle, Home, Heart, Calendar } from 'lucide-react';
import { Visitor, VisitorStatus } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';

interface LogInteractionModalProps {
  visitor: Visitor | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LogInteractionModal: React.FC<LogInteractionModalProps> = ({
  visitor,
  isOpen,
  onClose,
}) => {
  const { updateVisitor } = useChurchData();
  const { success, error } = useToast();

  const [channel, setChannel] = useState<'phone_call' | 'whatsapp' | 'home_visit' | 'in_person' | 'prayer_call'>('phone_call');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [minister, setMinister] = useState(visitor?.assigned_to_name || 'Pastor David Osei-Tutu');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [newStatus, setNewStatus] = useState<VisitorStatus>(
    visitor?.follow_up_status === 'new' ? 'contacted' : visitor?.follow_up_status || 'contacted'
  );

  if (!isOpen || !visitor) return null;

  const channelLabels: Record<string, string> = {
    phone_call: 'Phone Call',
    whatsapp: 'WhatsApp Message',
    home_visit: 'Home Visitation',
    in_person: 'In-Person at Church',
    prayer_call: 'Dedicated Prayer Session',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeNotes.trim()) {
      error('Please write a brief summary of the conversation or interaction.');
      return;
    }

    try {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newEntry = `[${date} ${timestamp} - ${channelLabels[channel]} by ${minister}]\n${outcomeNotes.trim()}`;
      const updatedNotes = visitor.notes ? `${newEntry}\n\n${visitor.notes}` : newEntry;

      updateVisitor(visitor.id, {
        notes: updatedNotes,
        follow_up_status: newStatus,
        assigned_to_name: minister,
      });

      success(`Logged follow-up interaction with ${visitor.full_name}`);
      onClose();
    } catch (err) {
      console.error(err);
      error('Failed to log interaction.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Log Pastoral Follow-Up</h3>
              <p className="text-xs text-slate-500">Record outreach for {visitor.full_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Communication Channel</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'phone_call', label: 'Phone Call', icon: Phone },
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                { id: 'home_visit', label: 'Home Visit', icon: Home },
                { id: 'in_person', label: 'In-Church Chat', icon: Calendar },
                { id: 'prayer_call', label: 'Prayer Call', icon: Heart },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = channel === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setChannel(item.id as any)}
                    className={`p-2 rounded-xl border flex items-center gap-1.5 text-left transition font-medium ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-700' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Interaction Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:outline-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Minister / Caller Name</label>
              <input
                type="text"
                required
                value={minister}
                onChange={(e) => setMinister(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
                placeholder="e.g. Pastor David Osei-Tutu"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Update Follow-Up Pipeline Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as VisitorStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-600"
            >
              <option value="contacted">Contacted (In Progress)</option>
              <option value="follow_up_required">Follow-Up Required (Requires Another Visit/Call)</option>
              <option value="returning_visitor">Returning Visitor (Attended again or agreed to return)</option>
              <option value="converted_to_member">Converted to Member</option>
              <option value="closed">Closed / Relocated</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Conversation Summary & Pastoral Notes *</label>
            <textarea
              required
              rows={4}
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
              placeholder="e.g. Called Brother Kwabena. He expressed joy with the warm reception and praise ministry. Prayed for his visa application. Promised to attend the upcoming Sunday 2nd Service."
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              Save Follow-Up Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
