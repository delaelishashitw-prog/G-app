import { attendanceSessionError } from '../../features/attendance/attendanceInsights';
import { useModalFocus } from '../../hooks/useModalFocus';
import { findPickup } from '../../lib/childSafety';
import { useAuth } from '../../contexts/AuthContext';
import React, { useState, useRef } from 'react';
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
  initialView?: 'checkin' | 'checkout';
}

export const ChildSafetyPickupModal: React.FC<ChildSafetyPickupModalProps> = ({
  isOpen,
  onClose,
  targetRecord,
  serviceId,
  date,
  initialView = 'checkin',
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
  const {currentUser,isAuthenticated,canAccess}=useAuth();
  const [busy,setBusy]=useState(false);
  const checkInRequest=useRef(crypto.randomUUID());
  const { success, warning, error: toastError } = useToast();

  const [activeView, setActiveView] = useState<'pass' | 'checkin' | 'checkout'>(
    targetRecord?.service_id === serviceId && targetRecord.date === date ? 'pass' : initialView
  );

  // Selected or active record for the pass view
  const [activeRecord, setActiveRecord] = useState<ChildCheckInRecord | null>(
    targetRecord?.service_id === serviceId && targetRecord.date === date ? targetRecord : null
  );

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
  const selectedService = services.find(service => service.id === serviceId);
  const sessionError = attendanceSessionError(selectedService, date);
  const canCheckIn = isAuthenticated && canAccess('attendance') && !sessionError;
  const sessionRecords = childCheckIns.filter(record => record.service_id === serviceId && record.date === date);
  const panel = useModalFocus(isOpen, () => { if (!busy) onClose(); });

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
    if (!childName.trim()) {
      toastError('Validation Error', "Please enter the child's name");
      return;
    }
    if (!parentName.trim() || !parentPhone.trim()) {
      toastError('Validation Error', "Please provide the parent or guardian's contact details");
      return;
    }

    if (!canCheckIn || !selectedService) {
      toastError('Check-in unavailable', sessionError || 'Attendance staff access is required.');
      return;
    }
    const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' });
    setBusy(true);
    try {
    const newRecord = await checkInChild({
      child_name: childName.trim(),
      age_group: ageGroup,
      class_room: classRoom,
      service_id: selectedService.id,
      service_name: selectedService.name,
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
    },checkInRequest.current);

    setActiveRecord(newRecord);
    checkInRequest.current=crypto.randomUUID();
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
    e.preventDefault();setBusy(true);
    try {
      const found=findPickup(sessionRecords,checkoutCode,collectorName);
      await checkOutChild(found.id,{checked_out_to_person:collectorName.trim(),verified_by_leader:currentUser.id});
      success('Pickup Confirmed',`${found.child_name} released to ${collectorName.trim()}.`);
      setActiveRecord({...found,status:'checked_out'});setCheckoutCode('');setCollectorName('');setActiveView('pass');
    }catch(error){toastError('Pickup not confirmed',(error as Error).message);}finally{setBusy(false);}
  };

  const handleTriggerParentSummon = (rec: ChildCheckInRecord) => {
    summonChildParent(rec.id, summonReason);
    warning(
      'Parent contact recorded',
      `Call ${rec.parent_name} at ${rec.parent_phone}. This app has not sent a message.`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Child safety and pickup" className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="no-print px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-start justify-between gap-3 border-b border-slate-800">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">Sunday School Child Safety & Security Passes</h3>
          </div>
          <div className="flex items-center gap-2">
            {activeView === 'pass' && activeRecord && (
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
              disabled={busy}
              aria-label="Close child safety"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div aria-label="Child safety session" className="no-print border-b border-slate-200 bg-emerald-50 px-6 py-3 text-xs text-emerald-950 break-words">
          <strong>{selectedService?.name || targetRecord?.service_name || 'Service unavailable'}</strong> · {date || 'Choose a valid service date'} (GMT)
          {sessionError && <p role="alert" className="mt-1 text-rose-800">{sessionError}</p>}
        </div>

        {/* View Switcher Bar (Hidden on print) */}
        <div className="no-print px-6 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={busy || !canCheckIn}
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
              disabled={busy || !activeRecord}
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
              disabled={busy}
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
          {/* VIEW 1: PRINTABLE WEARABLE BADGE + PARENT PICKUP STUB */}
          {activeView === 'pass' && (
            <div className="space-y-6">
              {!activeRecord ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No active child record selected. Please check in a child first.
                </div>
              ) : (
                <div className="print-container space-y-6">
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
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition shadow-2xs shrink-0 flex items-center gap-1.5 text-xs"
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
                        <p className="text-xs text-slate-600">{activeRecord.service_name} · {activeRecord.date} (GMT)</p>
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
                        <p className="text-xs text-slate-600">{activeRecord.service_name} · {activeRecord.date} (GMT)</p>
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
              <fieldset disabled={busy || !canCheckIn} className="contents">
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
                    aria-label="Child full name"
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
                    aria-label="Parent or guardian name"
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
                    aria-label="Parent phone contact"
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
                  type="submit" disabled={busy}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Generate Security Passes
                </button>
              </div>
              </fieldset>
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
                  aria-label="Pickup security code"
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
                    aria-label="Pickup collector name"
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
                  type="submit" disabled={busy}
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
