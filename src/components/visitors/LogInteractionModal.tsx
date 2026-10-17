import React, { useEffect,useRef,useState } from 'react';
import { X, FileText, Phone, MessageCircle, Home, Heart, Calendar } from 'lucide-react';
import { Visitor, VisitorStatus } from '../../types/database.types';
import {useAuth} from '../../contexts/AuthContext';
import {followUpRpc} from '../../lib/followUp';
import {ghanaToday} from '../../lib/financeViewUtils';
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
  const {refreshData}=useChurchData();
  const {currentUser}=useAuth();
  const minister=`${currentUser.first_name} ${currentUser.last_name}`.trim();
  const [busy,setBusy]=useState(false);
  const locked=useRef(false),operation=useRef<{key:string;id:string}|null>(null);
  const selected=useRef(visitor?.id);selected.current=visitor?.id;
  useEffect(()=>{if(!visitor||!isOpen)return;setDate(ghanaToday());setChannel('phone_call');setOutcomeNotes('');setNewStatus(visitor.follow_up_status==='new'?'contacted':visitor.follow_up_status);operation.current=null;},[visitor?.id,isOpen]);
  const { success, error } = useToast();

  const [channel, setChannel] = useState<'phone_call' | 'whatsapp' | 'home_visit' | 'in_person' | 'prayer_call'>('phone_call');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [newStatus, setNewStatus] = useState<VisitorStatus>(
    visitor?.follow_up_status === 'new' ? 'contacted' : visitor?.follow_up_status || 'contacted'
  );

  if (!isOpen || !visitor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();if(locked.current)return;
    if(outcomeNotes.trim().length<3){error('Write a summary of at least three characters.');return;}
    const id=visitor.id;const data={channel,date,summary:outcomeNotes.trim(),status:newStatus};const key=JSON.stringify({id,data});
    if(operation.current?.key!==key)operation.current={key,id:crypto.randomUUID()};locked.current=true;setBusy(true);
    try{
      await followUpRpc('gwcc_log_visitor_follow_up',{p_operation_id:operation.current.id,p_visitor_id:id,p_data:data});
      if(selected.current!==id)return;success('Follow-up saved to cloud','Your signed-in account is recorded with this interaction.');
      onClose();void refreshData().catch(()=>error('Refresh visitor records','The interaction is saved. Refresh to view the latest records.'));
    }catch(cause){if(selected.current===id)error('Follow-up not confirmed',`${(cause as Error).message} Retry without changing the details if confirmation was interrupted.`);}
    finally{locked.current=false;setBusy(false);}
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="visitor-followup-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 id="visitor-followup-title" className="text-base font-bold text-slate-900">Log Pastoral Follow-Up</h3>
              <p className="text-xs text-slate-500">Record outreach for {visitor.full_name}</p>
            </div>
          </div>
          <button
            disabled={busy} onClick={onClose} aria-label="Close follow-up note"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} aria-busy={busy} className="p-6 space-y-4 text-xs">
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
                    disabled={busy} type="button"
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
              <label htmlFor="visitor-followup-date" className="block font-semibold text-slate-700 mb-1">Interaction Date</label>
              <input id="visitor-followup-date"
                disabled={busy} type="date" max={ghanaToday()}
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:outline-blue-600"
              />
            </div>
            <div>
              <label htmlFor="visitor-followup-recorder" className="block font-semibold text-slate-700 mb-1">Recorded by (signed-in account)</label>
              <input id="visitor-followup-recorder"
                type="text"
                disabled={busy} required
                value={minister}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="visitor-followup-status" className="block font-semibold text-slate-700 mb-1">Update Follow-Up Pipeline Status</label>
            <select id="visitor-followup-status"
              disabled={busy} value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as VisitorStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-600"
            >
              <option value="contacted">Contacted (In Progress)</option>
              <option value="follow_up_required">Follow-Up Required (Requires Another Visit/Call)</option>
              <option value="returning_visitor">Returning Visitor (Attended again or agreed to return)</option>

              <option value="closed">Closed / Relocated</option>
            </select>
          </div>

          <div>
            <label htmlFor="visitor-followup-summary" className="block font-semibold text-slate-700 mb-1">Conversation Summary & Pastoral Notes *</label>
            <textarea id="visitor-followup-summary"
              required
              rows={4}
              disabled={busy} value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
              placeholder="e.g. Called Brother Kwabena. He expressed joy with the warm reception and praise ministry. Prayed for his visa application. Promised to attend the upcoming Sunday 2nd Service."
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy} onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              disabled={busy} type="submit"
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
