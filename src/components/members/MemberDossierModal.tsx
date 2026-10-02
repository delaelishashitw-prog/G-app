import React from 'react';
import { Printer, X, ShieldCheck, User, Calendar, MapPin, Phone, Mail, Award, CheckCircle2 } from 'lucide-react';
import { Member, ChurchSettings, GivingRecord, AttendanceRecord, PledgeRecord } from '../../types/database.types';
import { formatGHS } from '../../lib/currencyUtils';

interface MemberDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
  settings: ChurchSettings;
  givingRecords: GivingRecord[];
  attendanceRecords: AttendanceRecord[];
  pledgeRecords: PledgeRecord[];
}

export const MemberDossierModal: React.FC<MemberDossierModalProps> = ({
  isOpen,
  onClose,
  member,
  settings,
  givingRecords,
  attendanceRecords,
  pledgeRecords,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalGiving = givingRecords
    .filter((g) => g.member_id === member.id)
    .reduce((sum, g) => sum + g.amount, 0);

  const totalPledged = pledgeRecords
    .filter((p) => p.member_id === member.id)
    .reduce((sum, p) => sum + p.amount_pledged, 0);

  const memberAttendance = attendanceRecords.filter((a) => a.member_id === member.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 my-auto">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-sm">Official Member Biographical Dossier</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Print Member Dossier / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Dossier Sheet */}
        <div className="p-8 sm:p-12 overflow-y-auto flex-1 font-sans text-slate-900 bg-white" id="printable-member-dossier">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white font-black text-2xl flex items-center justify-center shadow-md">
                GW
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
                  {settings.church_name}
                </h1>
                <p className="text-xs font-bold text-teal-800 mt-1">
                  {settings.branch_name || 'Joma Assembly'} • Greater Accra, Ghana
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Address: {settings.address} • GPS: {settings.gps_address} • Tel: {settings.phone}
            </p>
            <div className="mt-4 inline-block bg-slate-100 px-5 py-1.5 rounded-full border border-slate-300">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Official Congregation Membership Record & Dossier
              </h2>
            </div>
          </div>

          {/* Member Identity & Passport Block */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-200 mb-6">
            <div className="w-28 h-32 rounded-xl bg-slate-200 border-2 border-slate-300 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
              {member.profile_photo_url ? (
                <img
                  src={member.profile_photo_url}
                  alt={member.first_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-slate-400" />
              )}
            </div>

            <div className="space-y-1.5 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-black text-slate-900">
                  {member.first_name} {member.middle_name ? `${member.middle_name} ` : ''}{member.last_name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {member.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-600 font-mono">
                <span>Member ID: <strong>{member.member_id}</strong></span>
                {member.tithe_number && (
                  <span>• Tithe No: <strong>{member.tithe_number}</strong></span>
                )}
                <span>• Joined: <strong>{member.membership_date}</strong></span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-2 text-slate-600">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Gender</span>
                  <span className="font-semibold capitalize text-slate-800">{member.gender}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Marital Status</span>
                  <span className="font-semibold capitalize text-slate-800">{member.marital_status || 'Single'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Occupation</span>
                  <span className="font-semibold text-slate-800">{member.occupation || 'Congregant'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Biographical & Contact Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2 text-xs border border-slate-200 p-4 rounded-xl">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 uppercase text-[11px]">
                Contact & Residential Information
              </h4>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Phone Number</span>
                <span className="font-mono font-bold text-slate-800">{member.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Alternative Phone</span>
                <span className="font-mono text-slate-700">{member.alternative_phone || 'None'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Email Address</span>
                <span className="text-slate-800">{member.email || 'None on file'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Residential Address</span>
                <span className="text-slate-800 font-medium text-right">{member.residential_address || member.city}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">GhanaPost GPS Digital Address</span>
                <span className="font-mono font-bold text-emerald-800">{member.gps_address || 'Not Provided'}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs border border-slate-200 p-4 rounded-xl">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 uppercase text-[11px]">
                Spiritual Life & Church Placement
              </h4>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Salvation Experience</span>
                <span className="font-bold text-emerald-800">
                  {member.salvation_status ? 'Born Again (Affirmed)' : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Water Baptism</span>
                <span className="font-bold text-slate-800">
                  {member.baptism_status ? 'Baptized by Immersion' : 'Pending Baptism'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Membership Foundation Class</span>
                <span className="font-bold text-slate-800">
                  {member.membership_class_completed ? 'Completed & Certified' : 'In Progress'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Assigned Ministry</span>
                <span className="font-bold text-teal-800">{member.ministry_name || 'General Assembly'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Cell Fellowship (Small Group)</span>
                <span className="font-bold text-slate-800">{member.small_group_name || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          {/* Financial Stewardship Summary */}
          <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-3">
              Church Financial Stewardship & Service Summary
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center font-mono">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cumulative Tithes & Giving</span>
                <span className="text-base font-black text-emerald-800 mt-1 block">
                  {formatGHS(totalGiving)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Project Pledges</span>
                <span className="text-base font-black text-slate-800 mt-1 block">
                  {formatGHS(totalPledged)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Service Check-Ins Logged</span>
                <span className="text-base font-black text-teal-800 mt-1 block">
                  {memberAttendance.length} Services
                </span>
              </div>
            </div>
          </div>

          {/* Pastoral Remarks */}
          {member.notes && (
            <div className="mb-6 text-xs p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Pastoral Observations</h4>
              <p className="text-slate-700 italic leading-relaxed">{member.notes}</p>
            </div>
          )}

          {/* Signatures & Certification */}
          <div className="pt-8 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-700">
            <div>
              <p className="font-bold text-slate-900">General Secretary / Church Secretariat</p>
              <div className="border-b border-dashed border-slate-400 h-10 mt-2 mb-1 flex items-end justify-start pb-0.5">
                <span className="font-serif italic text-xs text-slate-700">{settings.general_secretary || 'Tamekloe Clara Gaewornu'}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-semibold">{settings.general_secretary || 'Tamekloe Clara Gaewornu'}</p>
              <p className="text-[10px] text-slate-400">Date: {new Date().toLocaleDateString('en-GB')}</p>
            </div>

            <div>
              <p className="font-bold text-slate-900">Senior Pastor & General Overseer</p>
              <div className="border-b border-dashed border-slate-400 h-10 mt-2 mb-1 flex items-end justify-start pb-0.5">
                <span className="font-serif italic text-xs text-slate-700">{settings.senior_pastor || 'Prophet Elisha K. Richard'}</span>
              </div>
              <p className="text-[11px] text-emerald-800 font-semibold">{settings.senior_pastor || 'Prophet Elisha K. Richard'}</p>
              <p className="text-[10px] text-slate-400">Official Stamp & Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
