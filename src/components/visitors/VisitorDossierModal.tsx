import React, { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  UserCheck,
  UserPlus,
  MessageCircle,
  Sparkles,
  Clock,
  Send,
  Edit,
  ExternalLink,
  CheckCircle,
  FileText,
  User,
  Heart,
  Share2,
} from 'lucide-react';
import { Visitor, VisitorStatus } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';

interface VisitorDossierModalProps {
  visitor: Visitor | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (visitor: Visitor) => void;
  onConvert: (visitor: Visitor) => void;
  onLogInteraction: (visitor: Visitor) => void;
}

export const VisitorDossierModal: React.FC<VisitorDossierModalProps> = ({
  visitor,
  isOpen,
  onClose,
  onEdit,
  onConvert,
  onLogInteraction,
}) => {
  const { updateVisitor } = useChurchData();
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'messages' | 'notes'>('profile');
  const [selectedTemplate, setSelectedTemplate] = useState<'welcome' | 'sunday' | 'prayer' | 'midweek'>('welcome');

  if (!isOpen || !visitor) return null;

  const cleanPhone = visitor.phone.replace(/[^0-9]/g, '');
  const isConverted = visitor.follow_up_status === 'converted_to_member';

  const messageTemplates = {
    welcome: `Calvary greetings ${visitor.full_name}! Thank you for worshipping with us at Greater Works City Church (GWCC) in Joma for ${visitor.service_attended}. We pray that God's grace, favor, and peace abound in your life. You are always welcome in God's presence! - Pastor David Osei-Tutu`,
    sunday: `Shalom ${visitor.full_name}! We warmly invite you to join us again this Sunday at Greater Works City Church, Joma. 1st Service: 7:30 AM | 2nd Service: 10:00 AM. Come expectant for another life-transforming encounter!`,
    prayer: `Peace be unto you ${visitor.full_name}. The Pastoral Intercessory Team at GWCC has been lifting up your prayer need (${visitor.prayer_request ? `regarding "${visitor.prayer_request}"` : 'before the throne of grace'}). May the Lord show Himself strong on your behalf!`,
    midweek: `Hello ${visitor.full_name}, join us this Wednesday at 6:30 PM for our Midweek Miracle & Teaching Service at GWCC Joma Sanctuary. A powerful word in season awaits you!`,
  };

  const getWhatsAppLink = (text: string) => {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const handleStatusChange = (newStatus: VisitorStatus) => {
    updateVisitor(visitor.id, { follow_up_status: newStatus });
    success(`Follow-up status updated to "${newStatus.replace(/_/g, ' ')}"`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-700 text-white font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
              {visitor.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{visitor.full_name}</h2>
                {isConverted && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Official Member
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>Visited {visitor.visit_date}</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{visitor.gender || 'Not specified'}</span>
                <span aria-hidden="true">·</span>
                <span>Assigned: {visitor.assigned_to_name || 'Pastoral Care'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEdit(visitor)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
              title="Edit visitor details"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-5 bg-white text-xs font-semibold gap-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Guest Profile & Details
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'messages'
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            WhatsApp Outreach Assistant
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'notes'
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Pastoral History & Notes
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
          {/* Status Quick Selector */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Assimilation & Follow-Up Status
              </span>
              <p className="text-xs text-slate-700">Update current stage in pastoral follow-up pipeline</p>
            </div>
            <select
              value={visitor.follow_up_status}
              onChange={(e) => handleStatusChange(e.target.value as VisitorStatus)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-blue-600"
            >
              <option value="new">New (Uncontacted)</option>
              <option value="follow_up_required">Follow-Up Required</option>
              <option value="contacted">Contacted (In Progress)</option>
              <option value="returning_visitor">Returning Visitor</option>
              <option value="converted_to_member">Converted to Member</option>
              <option value="closed">Closed / Inactive</option>
            </select>
          </div>

          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Primary Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Ghanaian Phone</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-900 text-sm">{visitor.phone}</span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${visitor.phone}`}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                        title="Voice Call"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={getWhatsAppLink(messageTemplates.welcome)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Email Address</span>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 truncate">
                      {visitor.email || 'No email provided'}
                    </span>
                    {visitor.email && (
                      <a
                        href={`mailto:${visitor.email}`}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Service & Origin Information */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Visit Background
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Service Attended:</span>
                    <span className="font-medium text-slate-800">{visitor.service_attended}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">First Visit Date:</span>
                    <span className="font-medium text-slate-800 font-mono">{visitor.visit_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Invited By:</span>
                    <span className="font-medium text-slate-800">{visitor.invited_by || 'Walk-in / None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">How They Heard:</span>
                    <span className="font-medium text-slate-800">{visitor.how_heard || 'General Outreach'}</span>
                  </div>
                </div>
              </div>

              {/* Residential Location & Digital Address */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Location & Residence
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Residential Address:</span>
                    <span className="font-medium text-slate-800">{visitor.address || 'Joma, Greater Accra'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">GhanaPost GPS:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900">
                        {visitor.gps_address || 'Not recorded'}
                      </span>
                      {visitor.gps_address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(visitor.gps_address + ', Ghana')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" /> Map
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Prayer Request */}
              {visitor.prayer_request ? (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Prayer Request & Spiritual Need</span>
                  </div>
                  <p className="text-slate-800 italic leading-relaxed text-xs">
                    &ldquo;{visitor.prayer_request}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-center text-xs">
                  No specific prayer request recorded on registration slip.
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-800">Ghanaian WhatsApp Outreach Templates</h4>
                <p className="text-slate-500">
                  Select a pastoral follow-up message customized with {visitor.full_name}&apos;s details:
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'welcome', label: 'First-Time Welcome' },
                  { id: 'sunday', label: 'Sunday Invitation' },
                  { id: 'prayer', label: 'Prayer Follow-Up' },
                  { id: 'midweek', label: 'Midweek Teaching' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedTemplate(item.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition font-medium text-xs ${
                      selectedTemplate === item.id
                        ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Message Preview</span>
                <p className="text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 font-sans text-xs">
                  {messageTemplates[selectedTemplate]}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400 text-[11px]">Recipient: {visitor.phone}</span>
                  <a
                    href={getWhatsAppLink(messageTemplates[selectedTemplate])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition text-xs shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Open in WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-800">Pastoral Interaction & Follow-Up Log</h4>
                  <p className="text-slate-500 text-[11px]">Document conversations, spiritual counseling, and home visits</p>
                </div>
                <button
                  onClick={() => onLogInteraction(visitor)}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold flex items-center gap-1.5 text-xs transition shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Log Interaction</span>
                </button>
              </div>

              {visitor.notes ? (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Recorded Notes & History</span>
                  <div className="text-slate-800 whitespace-pre-line leading-relaxed text-xs">
                    {visitor.notes}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>No follow-up notes logged yet for this visitor.</p>
                  <button
                    onClick={() => onLogInteraction(visitor)}
                    className="mt-3 text-blue-700 hover:text-blue-800 font-semibold underline text-xs"
                  >
                    Record first call or visitation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={`tel:${visitor.phone}`}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
            >
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              <span>Call ({visitor.phone})</span>
            </a>
            <button
              onClick={() => onLogInteraction(visitor)}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Log Note</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs"
            >
              Close
            </button>
            {!isConverted ? (
              <button
                onClick={() => onConvert(visitor)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center gap-1.5 text-xs transition shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Convert to Member</span>
              </button>
            ) : (
              <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Official Member Registered</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
