import { findPickup } from '../../lib/childSafety';
import { childSessionActionError, childSessionRecord, childSessionRecords, canPrintChildPickupPass } from '../../features/attendance/childSafetySession';
import { useAuth } from '../../contexts/AuthContext';
import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Printer,
  QrCode,
  Phone,
  AlertTriangle,
  UserCheck,
  Check,
  Bell,
  Clock,
  Search,
  Plus,
  Baby,
} from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';
import { ChildCheckInRecord, ChildAgeGroup } from '../../types/database.types';

interface ChildSafetyPickupModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRecord?: ChildCheckInRecord | null;
  serviceId: string;
  date: string;
}

export const ChildSafetyPickupModal: React.FC<ChildSafetyPickupModalProps> = ({
  isOpen,
  onClose,
  targetRecord,
  serviceId,
  date,
}) => {
  const {
    services,
    members,
    childCheckIns,
    checkInChild,
    checkOutChild,
    summonChildParent,
    settings,
  } = useChurchData();
  const {currentUser}=useAuth();
  const [busy,setBusy]=useState(false);
  const { success, warning, error: toastError } = useToast();

  // The parent unmounts this modal between openings to discard stale child tags.
  const selectedRecord = childSessionRecord(targetRecord, serviceId, date);
  const [activeView, setActiveView] = useState<'pass' | 'checkin' | 'checkout'>(
    selectedRecord ? 'pass' : 'checkin'
  );
  const [activeRecord, setActiveRecord] = useState<ChildCheckInRecord | null>(selectedRecord);
  const sessionRecords = childSessionRecords(childCheckIns, serviceId, date);
  const currentService = services.find(service => service.id === serviceId);
  const actionError = childSessionActionError(currentService, serviceId, date);
  const canPrint = canPrintChildPickupPass(activeRecord, serviceId, date);

  // Check-in form states
  const [childName, setChildName] = useState('');
  const [ageGroup, setAgeGroup] = useState<ChildAgeGroup>('beginners');
  const [classRoom, setClassRoom] = useState('Samuel Hall (Ages 4-6)');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('+233 ');
  const [alternatePickupName, setAlternatePickupName] = useState('');
  const [alternatePickupPhone, setAlternatePickupPhone] = useState('');
  const [hasAllergyAlert, setHasAllergyAlert] = useState(false);
  const [allergyNotes, setAllergyNotes] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Checkout form states
  const [checkoutCode, setCheckoutCode] = useState('');
  const [collectorName, setCollectorName] = useState('');
  const [verifiedLeader, setVerifiedLeader] = useState(`${currentUser.first_name} ${currentUser.last_name}`);

  // Parent summon state
  const [summonReason, setSummonReason] = useState('Child feeling unwell / requesting parent assistance');

  if (!isOpen) return null;

  const handleAgeGroupChange = (grp: ChildAgeGroup) => {
    setAgeGroup(grp);
    if (grp === 'nursery_toddler') setClassRoom('Hannah Hall (Nursery & Toddlers 0-3)');
    else if (grp === 'beginners') setClassRoom('Samuel Hall (Beginners 4-6)');
    else if (grp === 'juniors') setClassRoom('David Hall (Juniors 7-9)');
    else if (grp === 'pre_teens') setClassRoom('Timothy Hall (Pre-Teens 10-12)');
  };

  const handleSelectMemberChild = (memberId: string) => {
    const parent = members.find((m) => m.id === memberId);
    if (parent) {
      setParentName(`${parent.first_name} ${parent.last_name}`);
      setParentPhone(parent.phone);
    }
  };

  const handleCreateCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (actionError || !currentService) { toastError('Check-in unavailable', actionError || 'Select an active service.'); return; }
    if (!childName.trim()) {
      toastError('Validation Error', "Please enter the child's name");
      return;
    }
    if (!parentName.trim() || !parentPhone.trim()) {
      toastError('Validation Error', "Please provide the parent or guardian's contact details");
      return;
    }

    const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' });
    setBusy(true);
    try {
    const newRecord = await checkInChild({
      child_name: childName.trim(),
      age_group: ageGroup,
      class_room: classRoom,
      service_id: currentService.id,
      service_name: currentService.name,
      date,
      check_in_time: nowTime,
      parent_name: parentName.trim(),
      parent_phone: parentPhone.trim(),
      alternate_pickup_name: alternatePickupName.trim() || undefined,
      alternate_pickup_phone: alternatePickupPhone.trim() || undefined,
      allergies_medical_notes: hasAllergyAlert ? allergyNotes.trim() : 'None reported',
      has_allergy_alert: hasAllergyAlert,
      special_instructions: specialInstructions.trim() || undefined,
      checked_in_by: verifiedLeader,
    });

    setActiveRecord(newRecord);
    setActiveView('pass');
    success('Child Security Tag Generated', `${newRecord.child_name} assigned Code: ${newRecord.security_code}`);

    // Reset checkin inputs
    setChildName('');
    setAllergyNotes('');
    setHasAllergyAlert(false);
    setSpecialInstructions('');
    }catch(error){toastError('Check-in not confirmed',(error as Error).message);}finally{setBusy(false);}
  };

  const handleProcessCheckout = async (e:React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (actionError) { toastError('Pickup unavailable', actionError); return; }
    setBusy(true);
    try {
      const found=findPickup(sessionRecords,checkoutCode,collectorName);
      await checkOutChild(found.id,{checked_out_to_person:collectorName.trim(),verified_by_leader:currentUser.id});
      success('Pickup Confirmed',`${found.child_name} released to ${collectorName.trim()}.`);
      setActiveRecord({...found,status:'checked_out'});setCheckoutCode('');setCollectorName('');setActiveView('pass');
    }catch(error){toastError('Pickup not confirmed',(error as Error).message);}finally{setBusy(false);}
  };

  const handleTriggerParentSummon = (rec: ChildCheckInRecord) => {
    if (!canPrintChildPickupPass(rec, serviceId, date)) {
      toastError('Parent contact unavailable', 'Only active check-ins from today can request parent contact.');
      return;
    }
    summonChildParent(rec.id, summonReason);
    warning(
      'Parent contact recorded',
      `Call ${rec.parent_name} at ${rec.parent_phone}. This app has not sent a message.`
    );
  };

  const handlePrint = () => {
    if (!canPrint) { toastError('Pass unavailable', 'Only active pickup passes from today can be printed.'); return; }
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="no-print px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">Sunday School Child Safety & Security Passes</h3>
          </div>
          <div className="flex items-center gap-2">
            {activeView === 'pass' && canPrint && (
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Tags
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switcher Bar (Hidden on print) */}
        <div className="no-print px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('checkin')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeView === 'checkin'
                  ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Check-in Child
            </button>
            <button
              onClick={() => setActiveView('pass')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeView === 'pass'
                  ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Wearable Tag & Parent Stub
            </button>
            <button
              onClick={() => setActiveView('checkout')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeView === 'checkout'
                  ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Verify & Release Child
            </button>
          </div>

          {activeRecord && (
            <span className="font-mono font-bold text-slate-700 text-[11px] bg-slate-200 px-2 py-0.5 rounded">
              Active: {activeRecord.security_code}
            </span>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <p className="text-xs text-slate-600">Selected service: <strong>{currentService?.name || 'Unavailable'}</strong> · {date} (Ghana time)</p>
          {actionError && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{actionError} Historical records remain available for review.</p>}
          {/* VIEW 1: PRINTABLE WEARABLE BADGE + PARENT PICKUP STUB */}
          {activeView === 'pass' && (
            <div className="space-y-6">
              {!activeRecord ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No active child record selected. Please check in a child first.
                </div>
              ) : (
                <div className="print-container space-y-6">
                  {!canPrint && <p role="status" className="no-print rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">This is a historical or released child record. A new pickup pass cannot be printed.</p>}
                  {/* Emergency Parent Summon Box (Hidden on Print) */}
                  <div className="no-print p-4 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-700 shrink-0" />
                      <div>
                        <span className="font-bold text-amber-900">Need Parent in Children's Church?</span>
                        <p className="text-amber-700 text-[11px]">
                          Call the parent directly: {activeRecord.parent_name} ({activeRecord.parent_phone})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTriggerParentSummon(activeRecord)}
                      disabled={!canPrint}
                      className="disabled:opacity-50 disabled:cursor-not-allowed "+"px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition shadow-2xs shrink-0 flex items-center gap-1.5 text-xs"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      Record Parent Contact Needed
                    </button>
                  </div>

                  {/* 1. CHILD WEARABLE BADGE (STICKER / LANYARD) */}
                  <div className="border-2 border-dashed border-emerald-600 p-5 rounded-2xl bg-white shadow-2xs space-y-3 relative overflow-hidden">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Child Wearable Name Tag
                        </span>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                          {activeRecord.child_name}
                        </h2>
                        <p className="text-xs font-semibold text-slate-600">{activeRecord.class_room}</p>
                      </div>

                      {/* Security Code Badge */}
                      <div className="text-right">
                        <div className="bg-slate-900 text-white font-mono text-lg font-black px-3 py-1 rounded-xl shadow-xs">
                          {activeRecord.security_code}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">MATCH TAG</span>
                      </div>
                    </div>

                    {/* Allergy & Medical Alert Flag */}
                    {activeRecord.has_allergy_alert ? (
                      <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-300 flex items-center gap-2 text-rose-900 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>MEDICAL / ALLERGY ALERT: {activeRecord.allergies_medical_notes}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">No medical allergies recorded</div>
                    )}

                    {/* Parent details & emergency line */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Parent: <strong className="text-slate-800">{activeRecord.parent_name}</strong> (
                        <span className="font-mono">{activeRecord.parent_phone}</span>)
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">{activeRecord.check_in_time}</span>
                    </div>
                  </div>

                  {/* Cut / Tear Divider */}
                  <div className="flex items-center gap-2 text-slate-400 text-[10px] uppercase font-bold tracking-widest justify-center">
                    <span className="border-t border-dashed border-slate-300 flex-1" />
                    <span>✂ TEAR HERE — HAND PARENT TICKET BELOW ✂</span>
                    <span className="border-t border-dashed border-slate-300 flex-1" />
                  </div>

                  {/* 2. PARENT SECURITY PICKUP PASS */}
                  <div className="border-2 border-slate-900 p-5 rounded-2xl bg-slate-50 shadow-2xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <img src="/assets/logo.png" alt="GWCC" className="w-6 h-6 object-contain" />
                          <span className="text-xs font-black uppercase text-slate-900">{settings.church_name}</span>
                        </div>
                        <h3 className="text-sm font-bold text-emerald-800 mt-1">Parent Official Pickup Pass</h3>
                        <p className="text-xs text-slate-600">Child: <strong className="text-slate-900">{activeRecord.child_name}</strong></p>
                      </div>

                      <div className="text-right">
                        <div className="bg-emerald-800 text-white font-mono text-xl font-black px-4 py-1.5 rounded-xl shadow-xs">
                          {activeRecord.security_code}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Present to Teacher</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-snug">
                      <strong>Security Policy:</strong> For child safety, Sunday School teachers will strictly release your child only upon presentation of this matching security stub.
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                      <span>Room: {activeRecord.class_room}</span>
                      <span>Authorized Guardian: {activeRecord.alternate_pickup_name || activeRecord.parent_name}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: NEW CHILD CHECK-IN */}
          {activeView === 'checkin' && (
            <form onSubmit={handleCreateCheckIn} className="space-y-4">
              {/* Quick parent autofill from church members */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Autofill Parent from Member Registry (Optional)
                </label>
                <select
                  onChange={(e) => handleSelectMemberChild(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 py-2 px-3 bg-slate-50 text-slate-700"
                >
                  <option value="">-- Choose registered church parent --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Child Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Child Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Samuel Mensah"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    required
                    className="w-full text-sm rounded-xl border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Sunday School Class
                  </label>
                  <select
                    value={ageGroup}
                    onChange={(e) => handleAgeGroupChange(e.target.value as ChildAgeGroup)}
                    className="w-full text-sm rounded-xl border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="nursery_toddler">Hannah Hall (Nursery 0-3 yrs)</option>
                    <option value="beginners">Samuel Hall (Beginners 4-6 yrs)</option>
                    <option value="juniors">David Hall (Juniors 7-9 yrs)</option>
                    <option value="pre_teens">Timothy Hall (Pre-Teens 10-12 yrs)</option>
                  </select>
                </div>
              </div>

              {/* Parent Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Parent / Guardian Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kwame Mensah"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    required
                    className="w-full text-sm rounded-xl border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Parent Phone Contact <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+233 24 000 0000"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    required
                    className="w-full text-sm rounded-xl border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Alternate Collector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Alternate Authorized Pickup Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Auntie Grace Mensah"
                    value={alternatePickupName}
                    onChange={(e) => setAlternatePickupName(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Alternate Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+233 20 000 0000"
                    value={alternatePickupPhone}
                    onChange={(e) => setAlternatePickupPhone(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Allergy Alert Checkbox */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAllergyAlert}
                    onChange={(e) => setHasAllergyAlert(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Flag Medical / Food Allergy Alert (Prints red warning on tag)</span>
                </label>

                {hasAllergyAlert && (
                  <input
                    type="text"
                    placeholder="Specify allergies (e.g. Severe peanut allergy, Asthma inhaler in bag, Lactose)"
                    value={allergyNotes}
                    onChange={(e) => setAllergyNotes(e.target.value)}
                    required={hasAllergyAlert}
                    className="w-full text-xs rounded-lg border border-rose-300 p-2 text-rose-900 bg-rose-50/50"
                  />
                )}
              </div>

              {/* Submit */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={busy || Boolean(actionError)}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Generate Security Passes
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: VERIFY & CHECKOUT CHILD */}
          {activeView === 'checkout' && (
            <form onSubmit={handleProcessCheckout} className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Scan / Enter Matching Security Code
                </h4>
                <p className="text-[11px] text-slate-600">
                  Ask the parent or authorized collector for their pickup stub security tag.
                </p>
                <input
                  type="text"
                  placeholder="GWCC- followed by 12 characters"
                  value={checkoutCode}
                  onChange={(e) => setCheckoutCode(e.target.value)}
                  required
                  className="w-full text-lg font-mono font-black uppercase text-emerald-900 p-3 rounded-xl border border-slate-300 bg-white tracking-widest text-center"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Person Collecting Child
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Parent name or authorized person"
                    value={collectorName}
                    onChange={(e) => setCollectorName(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 py-2 px-3"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Verified By (Teacher)
                  </label>
                  <input
                    type="text"
                    value={verifiedLeader}
                    onChange={(e) => setVerifiedLeader(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 py-2 px-3 text-slate-700"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={busy || Boolean(actionError)}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  Verify & Release Child
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
