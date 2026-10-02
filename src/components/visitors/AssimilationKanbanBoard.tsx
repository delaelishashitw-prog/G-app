import React from 'react';
import {
  Phone,
  MessageCircle,
  MoreVertical,
  UserCheck,
  UserPlus,
  Clock,
  Sparkles,
  MapPin,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { Visitor, VisitorStatus } from '../../types/database.types';

interface AssimilationKanbanBoardProps {
  visitors: Visitor[];
  onViewDossier: (visitor: Visitor) => void;
  onEdit: (visitor: Visitor) => void;
  onConvert: (visitor: Visitor) => void;
  onLogInteraction: (visitor: Visitor) => void;
  onStatusChange: (visitorId: string, newStatus: VisitorStatus) => void;
}

interface ColumnConfig {
  id: VisitorStatus;
  title: string;
  description: string;
  badgeClass: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'new',
    title: 'New Visitors',
    description: 'Awaiting initial outreach',
    badgeClass: 'text-blue-800 bg-blue-50 border-blue-200',
  },
  {
    id: 'follow_up_required',
    title: 'Follow-Up Required',
    description: 'Urgent pastoral care needed',
    badgeClass: 'text-amber-800 bg-amber-50 border-amber-200',
  },
  {
    id: 'contacted',
    title: 'Contacted',
    description: 'In outreach & fellowship',
    badgeClass: 'text-purple-800 bg-purple-50 border-purple-200',
  },
  {
    id: 'returning_visitor',
    title: 'Returning Guests',
    description: 'Assimilation / Second visit',
    badgeClass: 'text-indigo-800 bg-indigo-50 border-indigo-200',
  },
  {
    id: 'converted_to_member',
    title: 'Converted Members',
    description: 'Enrolled in church roster',
    badgeClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
];

export const AssimilationKanbanBoard: React.FC<AssimilationKanbanBoardProps> = ({
  visitors,
  onViewDossier,
  onEdit,
  onConvert,
  onLogInteraction,
  onStatusChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const columnVisitors = visitors.filter((v) => v.follow_up_status === col.id);

        return (
          <div
            key={col.id}
            className="bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col h-full min-w-[280px]"
          >
            {/* Column Header */}
            <div className="p-3.5 border-b border-slate-200 bg-white/80 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 tracking-tight">{col.title}</h4>
                <span className="text-xs font-mono tabular-nums font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {columnVisitors.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{col.description}</p>
            </div>

            {/* Column Body / Cards */}
            <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[680px]">
              {columnVisitors.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  No visitors in this stage
                </div>
              ) : (
                columnVisitors.map((v) => {
                  const cleanPhone = v.phone.replace(/[^0-9]/g, '');
                  const whatsappUrl = `https://wa.me/${cleanPhone}?text=Calvary%20greetings%20${encodeURIComponent(
                    v.full_name
                  )}!%20Thank%20you%20for%20worshipping%20with%20us%20at%20Greater%20Works%20City%20Church.`;

                  return (
                    <div
                      key={v.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <button
                            onClick={() => onViewDossier(v)}
                            className="font-bold text-xs text-slate-900 hover:text-blue-700 transition text-left"
                          >
                            {v.full_name}
                          </button>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono">{v.visit_date}</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{v.gender || 'Guest'}</span>
                          </div>
                        </div>

                        {/* Stage Selector Dropdown */}
                        <select
                          value={v.follow_up_status}
                          onChange={(e) => onStatusChange(v.id, e.target.value as VisitorStatus)}
                          className="text-[10px] py-0.5 px-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-600 focus:outline-blue-600 max-w-[90px]"
                          title="Change assimilation stage"
                        >
                          <option value="new">New</option>
                          <option value="follow_up_required">Action Req.</option>
                          <option value="contacted">Contacted</option>
                          <option value="returning_visitor">Returning</option>
                          <option value="converted_to_member">Member</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>

                      {/* Location & Contact snippet */}
                      <div className="text-[11px] text-slate-600 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Phone:</span>
                          <span className="font-mono font-medium text-slate-800">{v.phone}</span>
                        </div>
                        {v.address && (
                          <div className="truncate text-slate-500">
                            {v.address}
                          </div>
                        )}
                      </div>

                      {/* Prayer request note */}
                      {v.prayer_request && (
                        <div className="p-2 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px] text-slate-700 line-clamp-2">
                          <span className="font-semibold text-amber-900 block text-[10px]">Prayer Request:</span>
                          &ldquo;{v.prayer_request}&rdquo;
                        </div>
                      )}

                      {/* Assigned Minister */}
                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Assigned:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[120px]">
                          {v.assigned_to_name || 'Pastoral Care'}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-1 pt-1.5">
                        <div className="flex items-center gap-1">
                          <a
                            href={`tel:${v.phone}`}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            title="Call phone"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition"
                            title="Send WhatsApp message"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => onLogInteraction(v)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            title="Log pastoral interaction note"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                        </div>

                        {v.follow_up_status !== 'converted_to_member' ? (
                          <button
                            onClick={() => onConvert(v)}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded transition flex items-center gap-1"
                            title="Convert visitor to registered church member"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>Convert</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                            <CheckCircle className="w-3 h-3" /> Member
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
