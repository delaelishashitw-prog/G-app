import React, { useState } from 'react';
import {
  HeartHandshake,
  Plus,
  Lock,
  Heart,
  Calendar,
  Sparkles,
  CheckCircle,
  Phone,
  User,
  Shield,
  MessageSquare,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { PastoralCareLog, PrayerRequest } from '../types/database.types';

export const PastoralCarePage: React.FC = () => {
  const { pastoralCare, prayerRequests, members, addPastoralCareLog, addPrayerRequest, updatePrayerStatus } =
    useChurchData();

  const [activeTab, setActiveTab] = useState<'care' | 'prayers'>('prayers');
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);

  // Forms
  const [careForm, setCareForm] = useState({
    member_id: members[0]?.id || '',
    pastor_name: 'Prophet Elisha K. Richard',
    care_type: 'counseling' as const,
    date: new Date().toISOString().split('T')[0],
    notes: '',
    action_items: '',
    is_confidential: true,
  });

  const [prayerForm, setPrayerForm] = useState({
    requester_name: '',
    member_id: '',
    category: 'Healing & Deliverance' as const,
    request: '',
    is_confidential: false,
  });

  const handleCareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mem = members.find((m) => m.id === careForm.member_id);
    const memberName = mem ? `${mem.first_name} ${mem.last_name}` : 'Member';

    addPastoralCareLog({
      member_id: careForm.member_id,
      member_name: memberName,
      pastor_name: careForm.pastor_name,
      care_type: careForm.care_type,
      date: careForm.date,
      notes: careForm.notes,
      action_items: careForm.action_items || undefined,
      is_confidential: careForm.is_confidential,
    });

    setIsCareModalOpen(false);
    setCareForm({
      member_id: members[0]?.id || '',
      pastor_name: 'Prophet Elisha K. Richard',
      care_type: 'counseling',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      action_items: '',
      is_confidential: true,
    });
  };

  const handlePrayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerForm.requester_name || !prayerForm.request) return;

    addPrayerRequest({
      requester_name: prayerForm.requester_name,
      member_id: prayerForm.member_id || undefined,
      category: prayerForm.category,
      request: prayerForm.request,
      status: 'new',
      date_submitted: new Date().toISOString().split('T')[0],
      is_confidential: prayerForm.is_confidential,
    });

    setIsPrayerModalOpen(false);
    setPrayerForm({
      requester_name: '',
      member_id: '',
      category: 'Healing & Deliverance',
      request: '',
      is_confidential: false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-emerald-800" />
            Pastoral Care & Prayer Intercession
          </h1>
          <p className="text-xs text-slate-500">
            Shepherding the flock, ministerial counseling, and spiritual warfare intercession
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCareModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Log Pastoral Counseling</span>
          </button>

          <button
            onClick={() => setIsPrayerModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Prayer Request</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('prayers')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'prayers'
              ? 'border-[#064e3b] text-[#064e3b] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Prayer Requests Board ({prayerRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('care')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'care'
              ? 'border-[#064e3b] text-[#064e3b] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Pastoral Counseling Logs ({pastoralCare.length})
        </button>
      </div>

      {/* TAB 1: PRAYER REQUESTS BOARD */}
      {activeTab === 'prayers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prayerRequests.map((req) => (
              <div
                key={req.id}
                className={`p-5 rounded-2xl border transition shadow-xs flex flex-col justify-between space-y-3 ${
                  req.status === 'answered'
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : req.is_confidential
                    ? 'bg-amber-50/20 border-amber-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{req.requester_name}</h3>
                        {req.is_confidential && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Confidential
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{req.category}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        req.status === 'answered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'praying'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">&ldquo;{req.request}&rdquo;</p>

                  {req.testimony && (
                    <div className="p-3 bg-emerald-100/60 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                      <span className="font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-700" /> Praise Report & Testimony:
                      </span>
                      <p className="italic">{req.testimony}</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Interceding Team: Pastoral Council</span>
                  <div className="flex items-center gap-2">
                    {req.status !== 'answered' && (
                      <button
                        onClick={() => {
                          const test = prompt('Enter the praise report or answered testimony:');
                          if (test !== null) {
                            updatePrayerStatus(req.id, 'answered', test);
                          }
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-semibold text-xs border border-emerald-200 flex items-center gap-1 transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Answered
                      </button>
                    )}
                    {req.status === 'new' && (
                      <button
                        onClick={() => updatePrayerStatus(req.id, 'praying')}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-semibold text-xs border border-blue-200"
                      >
                        Start Praying
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PASTORAL COUNSELING LOGS */}
      {activeTab === 'care' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Confidential Shepherding Logs ({pastoralCare.length})
            </h3>
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-amber-600" /> Protected by Pastoral Privilege
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {pastoralCare.map((log) => (
              <div key={log.id} className="p-5 space-y-2 hover:bg-slate-50/50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{log.member_name}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {log.care_type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">{log.date}</span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{log.notes}</p>

                {log.action_items && (
                  <div className="text-xs text-emerald-800 font-medium bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                    <strong>Action items / Follow-up:</strong> {log.action_items}
                  </div>
                )}

                <div className="text-[11px] text-slate-400 pt-1">
                  Minister: <strong>{log.pastor_name}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRAYER MODAL */}
      {isPrayerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between">
              <h3 className="text-base font-bold">New Prayer Request</h3>
              <button onClick={() => setIsPrayerModalOpen(false)} className="p-1 text-white/80 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handlePrayerSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requester Name *</label>
                <input
                  type="text"
                  required
                  value={prayerForm.requester_name}
                  onChange={(e) => setPrayerForm({ ...prayerForm, requester_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Sister Beatrice Mensah"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={prayerForm.category}
                  onChange={(e) => setPrayerForm({ ...prayerForm, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Healing & Deliverance">Healing & Deliverance</option>
                  <option value="Financial & Business Breakthrough">Financial & Business Breakthrough</option>
                  <option value="Family & Marital Peace">Family & Marital Peace</option>
                  <option value="Fruit of the Womb (Childbearing)">Fruit of the Womb</option>
                  <option value="Academic & Career Favor">Academic & Career Favor</option>
                  <option value="Spiritual Growth & Ministry">Spiritual Growth</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specific Prayer Need *</label>
                <textarea
                  rows={3}
                  required
                  value={prayerForm.request}
                  onChange={(e) => setPrayerForm({ ...prayerForm, request: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="Describe the petition for the intercessory altar..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="conf"
                  checked={prayerForm.is_confidential}
                  onChange={(e) => setPrayerForm({ ...prayerForm, is_confidential: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="conf" className="font-semibold text-slate-700 cursor-pointer">
                  Confidential (Pastoral team only)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrayerModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold shadow-md"
                >
                  Submit Prayer Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CARE MODAL */}
      {isCareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">Log Pastoral Counseling</h3>
              <button onClick={() => setIsCareModalOpen(false)} className="p-1 text-white/80 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCareSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Member *</label>
                <select
                  value={careForm.member_id}
                  onChange={(e) => setCareForm({ ...careForm, member_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.member_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Care Type</label>
                  <select
                    value={careForm.care_type}
                    onChange={(e) => setCareForm({ ...careForm, care_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="counseling">Pastoral Counseling</option>
                    <option value="home_visit">Home Visit</option>
                    <option value="hospital_visit">Hospital Visit</option>
                    <option value="pre_marital">Pre-Marital Counseling</option>
                    <option value="bereavement">Bereavement Support</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={careForm.date}
                    onChange={(e) => setCareForm({ ...careForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pastoral Notes (Confidential)</label>
                <textarea
                  rows={3}
                  required
                  value={careForm.notes}
                  onChange={(e) => setCareForm({ ...careForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="Summary of consultation and spiritual advice..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Action Items / Follow-Up</label>
                <input
                  type="text"
                  value={careForm.action_items}
                  onChange={(e) => setCareForm({ ...careForm, action_items: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="Follow-up call next Tuesday, fasting schedule..."
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCareModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
