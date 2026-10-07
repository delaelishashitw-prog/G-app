import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  Plus,
  BookOpen,
  CheckCircle2,
  Calendar,
  User,
  Users,
  Award,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import {
  FoundationCohort,
  FoundationStudent,
  Member,
  ChurchSettings,
} from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface FoundationSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohorts: FoundationCohort[];
  students: FoundationStudent[];
  members: Member[];
  settings: ChurchSettings;
  onCreateCohort: (cohortData: Omit<FoundationCohort, 'id' | 'created_at'>) => void;
  onEnrollStudent: (studentData: Omit<FoundationStudent, 'id' | 'created_at'>) => void;
  onToggleModule: (studentId: string, moduleNumber: number) => void;
  onGraduateStudent: (studentId: string, certificateNo?: string) => void;
}

const MODULES_INFO = [
  { num: 1, title: 'Salvation & Assurance', description: 'The New Creation & Assurance of Salvation' },
  { num: 2, title: 'Holy Spirit & Prayer', description: 'Person of the Holy Spirit, Tongues & Prayer Life' },
  { num: 3, title: 'Christian Living & Stewardship', description: 'Holiness, Faith, Tithes, Offerings & Giving' },
  { num: 4, title: 'Church Doctrine & Soul Winning', description: 'GWCC Mandate, Evangelism & Cell Ministry' },
  { num: 5, title: 'Water Baptism & Holy Ghost Baptism', description: 'Full Immersion Water Baptism & Spiritual Gifts' },
];

export const FoundationSchoolModal: React.FC<FoundationSchoolModalProps> = ({
  isOpen,
  onClose,
  cohorts,
  students,
  members,
  settings,
  onCreateCohort,
  onEnrollStudent,
  onToggleModule,
  onGraduateStudent,
}) => {
  const { success: toastSuccess, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'students' | 'cohorts' | 'new_cohort' | 'new_student'>('students');
  const [selectedCohortFilter, setSelectedCohortFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Certificate modal state
  const [certificateStudent, setCertificateStudent] = useState<FoundationStudent | null>(null);

  // New Cohort Form States
  const [cohortName, setCohortName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetGradDate, setTargetGradDate] = useState('');
  const [instructorName, setInstructorName] = useState('Pastor Emmanuel Osei');
  const [cohortNotes, setCohortNotes] = useState('');

  // New Student Enrollment Form States
  const [enrollMemberId, setEnrollMemberId] = useState('');
  const [enrollCohortId, setEnrollCohortId] = useState(cohorts[0]?.id || '');
  const [enrollWaterBaptized, setEnrollWaterBaptized] = useState(false);

  if (!isOpen) return null;

  const handleCreateCohortSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortName.trim()) {
      toastError('Validation Error', 'Please enter a cohort class name.');
      return;
    }

    onCreateCohort({
      name: cohortName.trim(),
      start_date: startDate,
      target_graduation_date: targetGradDate || startDate,
      instructor_name: instructorName.trim(),
      status: 'active',
      notes: cohortNotes.trim() || undefined,
    });

    toastSuccess('Cohort Created', `Launched new discipleship class "${cohortName}".`);
    setCohortName('');
    setActiveTab('students');
  };

  const handleEnrollStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = members.find((m) => m.id === enrollMemberId);
    const targetCohort = cohorts.find((c) => c.id === enrollCohortId);

    if (!targetMember || !targetCohort) {
      toastError('Validation Error', 'Please select a member and cohort.');
      return;
    }

    // Check if already enrolled in this cohort
    const alreadyEnrolled = students.some(
      (s) => s.member_id === targetMember.id && s.cohort_id === targetCohort.id
    );
    if (alreadyEnrolled) {
      toastError('Already Enrolled', `${targetMember.first_name} is already registered in this cohort.`);
      return;
    }

    onEnrollStudent({
      cohort_id: targetCohort.id,
      cohort_name: targetCohort.name,
      member_id: targetMember.id,
      member_name: `${targetMember.first_name} ${targetMember.last_name}`,
      member_phone: targetMember.phone,
      enrollment_date: new Date().toISOString().split('T')[0],
      completed_modules: [],
      water_baptism_status: enrollWaterBaptized || Boolean(targetMember.baptism_status),
      status: 'in_progress',
    });

    toastSuccess('Student Enrolled', `Enrolled ${targetMember.first_name} into ${targetCohort.name}.`);
    setEnrollMemberId('');
    setActiveTab('students');
  };

  // Filtered students
  const filteredStudents = students.filter((s) => {
    const matchCohort = selectedCohortFilter === 'ALL' || s.cohort_id === selectedCohortFilter;
    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchSearch =
      s.member_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cohort_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.member_phone && s.member_phone.includes(searchQuery));
    return matchCohort && matchStatus && matchSearch;
  });

  const printCertificate = () => {
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-700/60 rounded-xl">
                <GraduationCap className="w-5 h-5 text-emerald-200" />
              </span>
              <div>
                <h3 className="text-base font-bold">Foundation School & Believers Academy</h3>
                <p className="text-xs text-emerald-200">
                  New converts discipleship, 5 pillars curriculum, water baptism & graduation registry
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-emerald-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tab Bar */}
          <div className="border-b border-slate-200 px-6 pt-3 flex items-center gap-2 overflow-x-auto text-xs font-bold bg-slate-50 shrink-0">
            <button
              onClick={() => setActiveTab('students')}
              className={`pb-2.5 px-3 border-b-2 transition ${
                activeTab === 'students'
                  ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Enrolled Students ({students.length})
            </button>

            <button
              onClick={() => setActiveTab('cohorts')}
              className={`pb-2.5 px-3 border-b-2 transition ${
                activeTab === 'cohorts'
                  ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Discipleship Cohorts ({cohorts.length})
            </button>

            <button
              onClick={() => setActiveTab('new_student')}
              className={`pb-2.5 px-3 border-b-2 transition ${
                activeTab === 'new_student'
                  ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              + Enroll New Believer
            </button>

            <button
              onClick={() => setActiveTab('new_cohort')}
              className={`pb-2.5 px-3 border-b-2 transition ${
                activeTab === 'new_cohort'
                  ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              + Launch Cohort
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
            {/* TAB 1: STUDENTS MATRIX */}
            {activeTab === 'students' && (
              <div className="space-y-4">
                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search student name, cohort, or phone..."
                      className="w-full pl-8.5 pr-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-900 focus:outline-emerald-600"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCohortFilter}
                      onChange={(e) => setSelectedCohortFilter(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold text-slate-800"
                    >
                      <option value="ALL">All Cohorts ({cohorts.length})</option>
                      {cohorts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold text-slate-800"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="in_progress">In Progress</option>
                      <option value="ready_for_baptism">Ready for Baptism</option>
                      <option value="graduated">Graduated</option>
                    </select>
                  </div>
                </div>

                {/* Students List */}
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold">No students found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Enroll new converts or believers into the discipleship academy.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredStudents.map((std) => {
                      const completedCount = std.completed_modules.length;
                      const progressPct = Math.round((completedCount / 5) * 100);

                      return (
                        <div
                          key={std.id}
                          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-emerald-600 transition space-y-3"
                        >
                          {/* Student Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 text-sm">
                                  {std.member_name}
                                </h4>
                                {std.status === 'graduated' ? (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px] border border-emerald-200">
                                    ★ Graduated
                                  </span>
                                ) : std.status === 'ready_for_baptism' ? (
                                  <span className="px-2 py-0.5 bg-sky-100 text-sky-800 font-bold rounded-full text-[10px] border border-sky-200">
                                    Ready for Baptism
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px] border border-amber-200">
                                    In Progress ({progressPct}%)
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {std.cohort_name} • Enrolled: {std.enrollment_date} • Tel: {std.member_phone || '—'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {std.status === 'graduated' ? (
                                <button
                                  type="button"
                                  onClick={() => setCertificateStudent(std)}
                                  className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200 text-xs flex items-center gap-1.5 transition"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  <span>View Certificate</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onGraduateStudent(std.id)}
                                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-xs"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  <span>Graduate & Certify</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div>
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                              <span>Curriculum Mastery: {completedCount} / 5 Modules Completed</span>
                              <span className="font-bold text-emerald-900">{progressPct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/80">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  progressPct === 100 ? 'bg-emerald-600' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* 5 Modules Checklist Buttons */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                            {MODULES_INFO.map((mod) => {
                              const isDone = std.completed_modules.includes(mod.num);
                              return (
                                <button
                                  key={mod.num}
                                  type="button"
                                  onClick={() => onToggleModule(std.id, mod.num)}
                                  className={`p-2 rounded-lg border text-left transition flex items-start gap-1.5 ${
                                    isDone
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                  }`}
                                  title={`Click to mark ${mod.title} as ${isDone ? 'incomplete' : 'completed'}`}
                                >
                                  <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold mt-0.5 ${
                                      isDone ? 'bg-emerald-700 text-white' : 'bg-slate-300 text-slate-700'
                                    }`}
                                  >
                                    {mod.num}
                                  </span>
                                  <div className="truncate">
                                    <span className="block text-[11px] truncate">{mod.title}</span>
                                    <span className="text-[9px] font-normal text-slate-400 block">
                                      {isDone ? 'Completed ✓' : 'Pending'}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Water Baptism & Notes footer */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span>Water Baptism Status:</span>
                              {std.water_baptism_status ? (
                                <strong className="text-emerald-700 font-bold">Baptized by Immersion ✓</strong>
                              ) : (
                                <strong className="text-amber-700 font-bold">Pending Immersion</strong>
                              )}
                            </span>
                            {std.certificate_no && (
                              <span className="font-mono text-[10px] text-slate-400">
                                Cert: {std.certificate_no}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: COHORTS OVERVIEW */}
            {activeTab === 'cohorts' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cohorts.map((cohort) => {
                    const cohortStudents = students.filter((s) => s.cohort_id === cohort.id);
                    const graduatedStudents = cohortStudents.filter((s) => s.status === 'graduated');

                    return (
                      <div
                        key={cohort.id}
                        className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              cohort.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {cohort.status}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {cohort.start_date}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{cohort.name}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Instructor: <strong>{cohort.instructor_name}</strong>
                          </p>
                        </div>

                        {cohort.notes && (
                          <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                            {cohort.notes}
                          </p>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>{cohortStudents.length} Students Enrolled</span>
                          <span className="text-emerald-800">{graduatedStudents.length} Graduated</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: ENROLL NEW STUDENT FORM */}
            {activeTab === 'new_student' && (
              <form onSubmit={handleEnrollStudentSubmit} className="max-w-md mx-auto space-y-4 py-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Select Member / New Convert <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={enrollMemberId}
                    onChange={(e) => setEnrollMemberId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600 text-xs"
                  >
                    <option value="">-- Choose Member from Congregation --</option>
                    {members
                      .filter((m) => !m.is_archived)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.first_name} {m.last_name} ({m.phone}) — {m.status}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Select Discipleship Cohort <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={enrollCohortId}
                    onChange={(e) => setEnrollCohortId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600 text-xs"
                  >
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.status.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="water-baptized"
                    checked={enrollWaterBaptized}
                    onChange={(e) => setEnrollWaterBaptized(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                  />
                  <label htmlFor="water-baptized" className="text-slate-700 font-semibold cursor-pointer">
                    Already baptized by full water immersion
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition text-xs"
                >
                  Confirm Enrollment
                </button>
              </form>
            )}

            {/* TAB 4: LAUNCH NEW COHORT FORM */}
            {activeTab === 'new_cohort' && (
              <form onSubmit={handleCreateCohortSubmit} className="max-w-md mx-auto space-y-4 py-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Cohort Class Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cohortName}
                    onChange={(e) => setCohortName(e.target.value)}
                    placeholder="e.g. Class of Victorious Believers (Cohort 2026-C)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Target Graduation Date</label>
                    <input
                      type="date"
                      value={targetGradDate}
                      onChange={(e) => setTargetGradDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Lead Instructor / Pastor</label>
                  <input
                    type="text"
                    required
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Curriculum Notes</label>
                  <textarea
                    rows={2}
                    value={cohortNotes}
                    onChange={(e) => setCohortNotes(e.target.value)}
                    placeholder="Details on venue, class times, and teaching syllabus..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600 text-xs resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition text-xs"
                >
                  Create & Launch Cohort
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Graduation Certificate Viewer Modal */}
      {certificateStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border-4 border-emerald-900 p-8 text-center space-y-6">
            <button
              onClick={() => setCertificateStudent(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Letterhead */}
            <div className="space-y-1">
              <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-800">
                {settings.church_name}
              </span>
              <h2 className="text-2xl font-black text-slate-950 tracking-wider uppercase font-serif">
                Certificate of Discipleship
              </h2>
              <p className="text-xs text-slate-500 font-serif italic">
                Believers Foundation School & Ministerial Academy
              </p>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-600 uppercase tracking-wider">This is to certify that</p>
              <h3 className="text-2xl font-black text-emerald-950 font-serif border-b-2 border-emerald-900 inline-block px-8 pb-1">
                {certificateStudent.member_name}
              </h3>
              <p className="text-xs text-slate-700 max-w-md mx-auto leading-relaxed pt-2">
                has faithfully completed all 5 foundational modules of doctrine, spiritual disciplines, and Christian maturity, and is hereby certified as a rooted communicant believer in the Body of Christ.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-xs text-slate-700">
              <div className="space-y-4">
                <div className="border-b border-slate-400 pb-1"></div>
                <div>
                  <p className="font-bold text-slate-900">Pastor Emmanuel Osei</p>
                  <p className="text-[10px] text-slate-500 uppercase">Director of Foundation School</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-b border-slate-400 pb-1"></div>
                <div>
                  <p className="font-bold text-slate-900">{settings.senior_pastor || 'Prophet Elisha K. Richard'}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Senior Pastor & General Overseer</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              <span className="font-mono">Cert No: {certificateStudent.certificate_no || 'GWCC-FS-2026'}</span>
              <span>Date: {certificateStudent.graduation_date || new Date().toISOString().split('T')[0]}</span>
            </div>

            <div className="pt-2 flex justify-center gap-2">
              <button
                onClick={printCertificate}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Certificate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
