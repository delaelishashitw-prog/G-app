import React from 'react';
import {
  X,
  Printer,
  Download,
  Award,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { FoundationStudent, ChurchSettings, Member } from '../../types/database.types';

interface MemberCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: FoundationStudent;
  member: Member;
  settings: ChurchSettings;
}

export const MemberCertificateModal: React.FC<MemberCertificateModalProps> = ({
  isOpen,
  onClose,
  student,
  member,
  settings,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const certNumber = student.certificate_no || `GWCC-FND-2026-${member.member_id.replace('GWCC-', '')}`;
  const graduationDate = student.graduation_date || new Date().toISOString().split('T')[0];

  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // Background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 297, 210, 'F');

      // Outer & Inner Borders
      doc.setDrawColor(6, 78, 59); // emerald-900
      doc.setLineWidth(2.5);
      doc.rect(10, 10, 277, 190);

      doc.setDrawColor(217, 119, 6); // amber-600
      doc.setLineWidth(0.8);
      doc.rect(14, 14, 269, 182);

      // Church Header
      doc.setFont('times', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.setFontSize(22);
      doc.text(settings.church_name || 'GREATER WORKS CITY CHURCH', 148.5, 33, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${settings.branch_name || 'City of Refuge - Joma Central'} • Discipleship & Ministerial Academy`,
        148.5,
        41,
        { align: 'center' }
      );

      // Title
      doc.setFont('times', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(15, 23, 42);
      doc.text('CERTIFICATE OF DISCIPLESHIP', 148.5, 57, { align: 'center' });

      // Amber Accent line
      doc.setDrawColor(217, 119, 6);
      doc.setLineWidth(1);
      doc.line(95, 62, 202, 62);

      // Certification statement
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text('This is to officially certify that', 148.5, 75, { align: 'center' });

      // Member Name
      doc.setFont('times', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(6, 78, 59);
      doc.text(student.member_name, 148.5, 88, { align: 'center' });

      // Underline under member name
      doc.setDrawColor(6, 78, 59);
      doc.setLineWidth(0.7);
      doc.line(60, 91, 237, 91);

      // Member ID
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Member ID: ${member.member_id}`, 148.5, 98, { align: 'center' });

      // Body text
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(51, 65, 85);
      const textDesc = `has successfully fulfilled all curriculum requirements, tests, and spiritual disciplines of the Believers Foundation School (${student.cohort_name}), covering New Creation Realities, The Holy Spirit, Christian Stewardship, Sound Doctrine, and the Great Commission.`;
      const splitText = doc.splitTextToSize(textDesc, 230);
      doc.text(splitText, 148.5, 110, { align: 'center' });

      // Water Baptism & Modules Badges
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(6, 78, 59);
      const baptismText = student.water_baptism_status
        ? `Water Immersion Baptism: Confirmed (${student.water_baptism_date || 'August 2026'})`
        : 'Water Immersion Baptism: Scheduled';
      doc.text(`Curriculum: 5 of 5 Modules Completed  •  ${baptismText}`, 148.5, 136, { align: 'center' });

      // Signature Lines
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.5);
      doc.line(45, 165, 115, 165);
      doc.line(182, 165, 252, 165);

      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Pastor Emmanuel Osei', 80, 171, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Dean & Director, Foundation School', 80, 176, { align: 'center' });

      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(settings.senior_pastor || 'Prophet Elisha K. Richard', 217, 171, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Senior Pastor & General Overseer', 217, 176, { align: 'center' });

      // Serial & Date
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Serial: ${certNumber}   |   Issued: ${graduationDate}   |   Ephesians 4:12-14`, 148.5, 194, { align: 'center' });

      doc.save(`GWCC_Certificate_${student.member_name.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.warn('Direct PDF export error, triggering print fallback:', e);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm tracking-tight">Official Certificate of Discipleship</h3>
              <p className="text-[11px] text-slate-400">
                Greater Works City Church • Foundation School Graduate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Paper Canvas */}
        <div className="p-6 sm:p-10 bg-linear-to-b from-amber-50/40 via-white to-emerald-50/30 print:p-8 print:m-0">
          <div className="border-8 border-double border-emerald-900/80 p-6 sm:p-8 rounded-2xl relative text-center space-y-5 bg-white shadow-inner">
            {/* Corner Decorative Ornaments */}
            <div className="absolute top-2 left-2 text-amber-600/40 text-xs font-serif select-none">✦ ✦ ✦</div>
            <div className="absolute top-2 right-2 text-amber-600/40 text-xs font-serif select-none">✦ ✦ ✦</div>
            <div className="absolute bottom-2 left-2 text-amber-600/40 text-xs font-serif select-none">✦ ✦ ✦</div>
            <div className="absolute bottom-2 right-2 text-amber-600/40 text-xs font-serif select-none">✦ ✦ ✦</div>

            {/* Header / Seal */}
            <div className="space-y-1.5">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-900 text-amber-300 p-2.5 shadow-md flex items-center justify-center border-2 border-amber-400">
                <Award className="w-8 h-8" />
              </div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-900">
                {settings.church_name || 'Greater Works City Church'}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                {settings.branch_name || 'City of Refuge - Joma Central'} • Discipleship & Ministerial Academy
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 uppercase tracking-wider font-serif pt-1 text-emerald-950">
                Certificate of Discipleship
              </h1>
              <div className="w-24 h-0.5 bg-amber-500 mx-auto"></div>
            </div>

            {/* Certification Statement */}
            <div className="space-y-3 py-2">
              <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">
                This is to officially certify that
              </p>
              <div className="inline-block border-b-2 border-emerald-900 px-8 py-1">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-serif tracking-wide">
                  {student.member_name}
                </h2>
              </div>
              <p className="text-[11px] font-mono text-emerald-800 font-bold">
                Member ID: {member.member_id}
              </p>
              <p className="text-xs text-slate-700 max-w-lg mx-auto leading-relaxed pt-1 font-serif">
                has successfully fulfilled all curriculum requirements, tests, and spiritual disciplines of the{' '}
                <strong>Believers Foundation School ({student.cohort_name})</strong>, covering New Creation Realities, The Holy Spirit, Christian Stewardship, Sound Doctrine, and the Great Commission.
              </p>
            </div>

            {/* Water Baptism & Spiritual Seals */}
            <div className="flex flex-wrap items-center justify-center gap-4 py-2 border-y border-slate-200 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>5 of 5 Curriculum Modules Completed</span>
              </div>

              {student.water_baptism_status ? (
                <div className="flex items-center gap-1.5 text-blue-900 font-bold bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  <CheckCircle2 className="w-4 h-4 text-blue-700" />
                  <span>
                    Immersion Water Baptism Confirmed{' '}
                    {student.water_baptism_date ? `(${student.water_baptism_date})` : ''}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-amber-900 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  <Calendar className="w-4 h-4 text-amber-700" />
                  <span>Water Baptism Pending Scheduled Immersion</span>
                </div>
              )}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-4 text-xs">
              <div className="space-y-4">
                <div className="border-b border-slate-400 pb-1"></div>
                <div>
                  <p className="font-bold text-slate-900 font-serif">Pastor Emmanuel Osei</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    Dean & Director, Foundation School
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-b border-slate-400 pb-1"></div>
                <div>
                  <p className="font-bold text-slate-900 font-serif">
                    {settings.senior_pastor || 'Prophet Elisha K. Richard'}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    Senior Pastor & General Overseer
                  </p>
                </div>
              </div>
            </div>

            {/* Serial & Date Footer */}
            <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-slate-100">
              <span>Certificate Serial: <strong>{certNumber}</strong></span>
              <span>Issued: <strong>{graduationDate}</strong></span>
              <span>Ephesians 4:12-14</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
