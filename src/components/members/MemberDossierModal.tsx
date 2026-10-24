import React, { useState } from 'react';
import {
  Printer,
  X,
  ShieldCheck,
  User,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Award,
  CheckCircle2,
  FileText,
  Church,
  Stamp,
  BadgeCheck
} from 'lucide-react';
import { Member, ChurchSettings, GivingRecord, AttendanceRecord, PledgeRecord } from '../../types/database.types';
import { formatGHS } from '../../lib/currencyUtils';
import { PastorSignature } from '../common/PastorSignature';

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
  const [logoError, setLogoError] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    if(member._sync_status !== 'pending')window.print();
  };

  const totalGiving = givingRecords
    .filter((g) => g.member_id === member.id)
    .reduce((sum, g) => sum + g.amount, 0);

  const totalPledged = pledgeRecords
    .filter((p) => p.member_id === member.id)
    .reduce((sum, p) => sum + p.amount_pledged, 0);

  const memberAttendance = attendanceRecords.filter((a) => a.member_id === member.id);

  const logoSrc = settings.logo_url || '/assets/logo.png';
  const docRef = `DOS-GWCC-${member.member_id || member.id.slice(0, 8).toUpperCase()}`;
  const currentDateFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in print:bg-transparent print:p-0 print:static print:overflow-visible print:block print:inset-auto print:z-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 my-auto print:shadow-none print:border-none print:m-0 print:p-0 print:max-w-none print:max-h-none print:w-full print:rounded-none print:overflow-visible print:block">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print print:hidden px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm block leading-none">Official Member Biographical Dossier</span>
              <span className="text-[11px] text-slate-400">A4 Printable Ecclesiastical Record</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={member._sync_status === 'pending'} onClick={handlePrint}
              type="button"
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Dossier (A4) / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Dossier Sheet: Designed specifically to fit an A4 page */}
        <div
          className="p-6 sm:p-10 overflow-y-auto flex-1 font-sans text-slate-900 bg-white print:p-0 print:m-0 print:overflow-visible print:w-full print:max-w-[195mm] print:mx-auto"
          id="printable-member-dossier"
        >
          {/* HEADER SECTION WITH OFFICIAL CHURCH LOGO */}
          <div className="border-b-2 border-slate-900 pb-3 sm:pb-4 mb-4 avoid-break">
            <div className="flex items-center justify-between gap-4 mb-2">
              {/* Church Logo & Names */}
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center overflow-hidden shadow-2xs">
                  {!logoError ? (
                    <img
                      src={logoSrc}
                      alt={settings.church_name || 'Church Logo'}
                      className="w-full h-full object-contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-teal-800 text-white rounded-xl flex items-center justify-center font-black text-xl">
                      GW
                    </div>
                  )}
                </div>

                <div className="text-left">
                  <span className="text-[9.5px] uppercase font-extrabold tracking-widest text-teal-800 block">
                    Greater Works City Church Worldwide • Ghana Mission
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 leading-tight">
                    {settings.church_name || 'Greater Works City Church'}
                  </h1>
                  <p className="text-xs font-bold text-slate-700">
                    {settings.branch_name || 'City of Refuge - Joma Assembly'} • Greater Accra, Ghana
                  </p>
                </div>
              </div>

              {/* Document Reference Badge */}
              <div className="text-right shrink-0">
                <span className="inline-block px-3 py-1 bg-teal-50 border border-teal-200 text-teal-900 text-[10px] font-black uppercase tracking-wider rounded-lg">
                  Official Dossier
                </span>
                <p className="font-mono text-[10px] text-slate-500 mt-1">
                  Ref: <strong className="text-slate-800">{docRef}</strong>
                </p>
                <p className="text-[10px] text-slate-500">
                  Date: <strong className="text-slate-800">{currentDateFormatted}</strong>
                </p>
              </div>
            </div>

            {/* Address & Meta Ribbon */}
            <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-600 pt-1.5 border-t border-slate-100">
              <div>
                <span>Address: {settings.address || 'Behind Joma School Park, Joma Central'}</span>
                <span className="mx-1.5 text-slate-300">•</span>
                <span>Tel: <strong className="font-mono text-slate-800">{settings.phone || '+233 24 000 0000'}</strong></span>
                {settings.email && (
                  <>
                    <span className="mx-1.5 text-slate-300">•</span>
                    <span>{settings.email}</span>
                  </>
                )}
              </div>
              <div>
                <span>GhanaPost GPS: </span>
                <strong className="font-mono text-teal-900 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  {settings.gps_address || 'GS-0192-8821'}
                </strong>
              </div>
            </div>
          </div>

          {/* DOCUMENT SUB-TITLE BANNER */}
          <div className="text-center mb-3.5 avoid-break">
            <div className="inline-block bg-slate-900 text-white px-5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xs">
              Official Congregation Membership Record & Biographical Dossier
            </div>
          </div>

          {/* MEMBER IDENTITY & PASSPORT BLOCK */}
          <div className="flex flex-row items-center gap-4 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 mb-3.5 avoid-break">
            {/* Passport Photo */}
            <div className="w-24 h-28 rounded-xl bg-slate-200 border-2 border-slate-300 overflow-hidden shrink-0 shadow-xs flex items-center justify-center relative">
              {member.profile_photo_url ? (
                <img
                  src={member.profile_photo_url}
                  alt={member.first_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-slate-400" />
              )}
              <div className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-[8px] text-white text-center py-0.5 font-mono">
                PASSPORT PHOTO
              </div>
            </div>

            {/* Member Primary Information */}
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                  {member.first_name} {member.middle_name ? `${member.middle_name} ` : ''}{member.last_name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {member.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Identifier Badges */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700 font-mono">
                <span>Member ID: <strong className="text-slate-900">{member.member_id}</strong></span>
                {member.tithe_number && (
                  <span>• Tithe No: <strong className="text-teal-800 font-bold">{member.tithe_number}</strong></span>
                )}
                <span>• Joined: <strong>{member.membership_date}</strong></span>
                {member.date_of_birth && (
                  <span>• DOB: <strong>{member.date_of_birth}</strong></span>
                )}
              </div>

              {/* 4-Item Demographics Strip */}
              <div className="grid grid-cols-4 gap-2 pt-1.5 text-[10.5px] border-t border-slate-200/80">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Gender</span>
                  <span className="font-bold capitalize text-slate-800">{member.gender || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Marital Status</span>
                  <span className="font-bold capitalize text-slate-800">{member.marital_status || 'Single'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Occupation</span>
                  <span className="font-semibold text-slate-800 truncate block">{member.occupation || 'Congregant'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Nationality</span>
                  <span className="font-semibold text-slate-800 capitalize truncate block">{member.nationality || 'Ghanaian'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2-COLUMN STRUCTURED DETAILS: CONTACT & SPIRITUAL */}
          <div className="grid grid-cols-2 gap-3.5 mb-3.5 avoid-break text-[10.5px]">
            {/* Column 1: Contact & Residential Info */}
            <div className="border border-slate-200 rounded-xl p-3 bg-white">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 uppercase text-[10px] tracking-wide flex items-center gap-1.5 text-teal-900">
                <MapPin className="w-3 h-3 text-teal-700" />
                Contact & Residential Placement
              </h4>
              <div className="divide-y divide-slate-100 mt-1">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Phone Number</span>
                  <span className="font-mono font-bold text-slate-800">{member.phone}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Alternative Phone</span>
                  <span className="font-mono text-slate-700">{member.alternative_phone || 'None'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Email Address</span>
                  <span className="text-slate-800 truncate max-w-[160px]">{member.email || 'None on file'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Residential Address</span>
                  <span className="text-slate-800 font-medium text-right truncate max-w-[170px]">
                    {member.residential_address || member.city || 'Joma, Accra'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">GhanaPost GPS Digital</span>
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1 rounded">
                    {member.gps_address || 'Not Provided'}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Spiritual Life & Ecclesial Standing */}
            <div className="border border-slate-200 rounded-xl p-3 bg-white">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1 uppercase text-[10px] tracking-wide flex items-center gap-1.5 text-teal-900">
                <Award className="w-3 h-3 text-teal-700" />
                Spiritual Life & Church Placement
              </h4>
              <div className="divide-y divide-slate-100 mt-1">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Salvation Experience</span>
                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 inline" />
                    {member.salvation_status ? 'Born Again (Affirmed)' : 'Pending Affirmation'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Water Baptism</span>
                  <span className="font-bold text-slate-800">
                    {member.baptism_status ? 'Baptized by Immersion' : 'Pending Baptism'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Foundation Class</span>
                  <span className="font-bold text-slate-800">
                    {member.membership_class_completed ? 'Completed & Certified' : 'In Progress'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Assigned Ministry</span>
                  <span className="font-bold text-teal-900">{member.ministry_name || 'General Assembly'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Cell Fellowship (Small Group)</span>
                  <span className="font-bold text-slate-800">{member.small_group_name || 'Unassigned'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* FINANCIAL STEWARDSHIP & PARTICIPATION SUMMARY */}
          <div className="mb-3.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-[10.5px] avoid-break">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wide flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5 text-teal-700" />
                Church Stewardship & Service Record Summary
              </h4>
              <span className="text-[9.5px] text-slate-500 italic">Historical records on file</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-500 block leading-tight">
                  Cumulative Tithes & Giving
                </span>
                <span className="text-sm sm:text-base font-black text-emerald-800 mt-0.5 block">
                  {formatGHS(totalGiving)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-500 block leading-tight">
                  Sanctuary Project Pledges
                </span>
                <span className="text-sm sm:text-base font-black text-slate-800 mt-0.5 block">
                  {formatGHS(totalPledged)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-500 block leading-tight">
                  Worship Check-Ins Logged
                </span>
                <span className="text-sm sm:text-base font-black text-teal-800 mt-0.5 block">
                  {memberAttendance.length} Services
                </span>
              </div>
            </div>
          </div>

          {/* PASTORAL OBSERVATIONS (IF RECORDED) */}
          {member.notes && (
            <div className="mb-3.5 text-[10px] p-2.5 rounded-xl border border-slate-200 bg-white avoid-break">
              <h4 className="font-bold text-slate-900 uppercase text-[9.5px] mb-0.5 text-teal-900">
                Pastoral Care Observations & Shepherding Notes
              </h4>
              <p className="text-slate-700 italic leading-relaxed line-clamp-2">{member.notes}</p>
            </div>
          )}

          {/* ECCLESIASTICAL CERTIFICATION, SEAL & SIGNATURES */}
          <div className="pt-3 border-t-2 border-slate-900 grid grid-cols-3 items-end gap-4 text-[10.5px] text-slate-700 avoid-break">
            {/* General Secretary */}
            <div>
              <p className="font-bold text-slate-900 uppercase text-[9.5px]">General Secretary</p>
              <p className="text-[9px] text-slate-500">Church Secretariat Administration</p>
              <div className="border-b border-dashed border-slate-400 h-8 mt-1 mb-1 flex items-end justify-start pb-0.5">
                <span className="font-serif italic text-xs text-slate-800">
                  {settings.general_secretary || 'Tamekloe Clara Gaewornu'}
                </span>
              </div>
              <p className="text-[10px] text-slate-800 font-bold">
                {settings.general_secretary || 'Tamekloe Clara Gaewornu'}
              </p>
              <p className="text-[9px] text-slate-400">Date: {currentDateFormatted}</p>
            </div>

            {/* Official Church Seal */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-18 h-18 rounded-full border-2 border-double border-teal-800 p-1 flex flex-col items-center justify-center bg-teal-50/50 shadow-2xs">
                <Church className="w-4 h-4 text-teal-800" />
                <span className="text-[6.5px] font-black uppercase text-teal-950 leading-tight mt-0.5 text-center">
                  GWCC OFFICIAL
                </span>
                <span className="text-[5.5px] text-teal-700 font-bold uppercase tracking-widest">
                  SEAL OF OFFICE
                </span>
              </div>
              <span className="text-[8px] font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                Ecclesiastical Seal
              </span>
            </div>

            {/* Senior Pastor */}
            <div className="text-right flex flex-col items-end">
              <p className="font-bold text-slate-900 uppercase text-[9.5px]">Senior Pastor & General Overseer</p>
              <p className="text-[9px] text-slate-500">Pastoral Council Oversight</p>
              <div className="border-b border-dashed border-slate-400 h-10 w-full max-w-[180px] mt-0.5 mb-1 flex items-end justify-end pb-0.5">
                <PastorSignature className="h-9 sm:h-10 w-auto max-w-[170px]" color="#0f388a" />
              </div>
              <p className="text-[10px] text-emerald-900 font-bold">
                {settings.senior_pastor || 'Prophet Elisha K. Richard'}
              </p>
              <p className="text-[9px] text-slate-400">Official Ecclesiastical Signature</p>
            </div>
          </div>

          {/* Official Bottom Security Footnote */}
          <div className="mt-3 pt-2 border-t border-slate-200 text-center text-[8.5px] text-slate-400 avoid-break flex items-center justify-between">
            <span>Official biographical dossier of {settings.church_name || 'Greater Works City Church Worldwide'}.</span>
            <span>Ref: {docRef}</span>
            <span>Valid only with church seal • Confidential ecclesiastical record</span>
          </div>
        </div>
      </div>
    </div>
  );
};
