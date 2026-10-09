import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, UserCheck, Calendar, ArrowRight, Phone, MapPin, Hash, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChurchData } from '../contexts/ChurchDataContext';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember?: (memberId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectMember,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { members, visitors, events } = useChurchData();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by layout
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanQuery = query.toLowerCase().trim();

  const matchingMembers = cleanQuery
    ? members.filter(
        (m) =>
          (m.first_name || '').toLowerCase().includes(cleanQuery) ||
          (m.last_name || '').toLowerCase().includes(cleanQuery) ||
          (m.member_id || '').toLowerCase().includes(cleanQuery) ||
          (m.tithe_number && m.tithe_number.toLowerCase().includes(cleanQuery)) ||
          (m.phone && m.phone.includes(cleanQuery)) ||
          (m.gps_address && m.gps_address.toLowerCase().includes(cleanQuery))
      )
    : [];

  const matchingVisitors = cleanQuery
    ? visitors.filter(
        (v) =>
          (v.full_name || '').toLowerCase().includes(cleanQuery) ||
          (v.phone && v.phone.includes(cleanQuery)) ||
          (v.address && v.address.toLowerCase().includes(cleanQuery))
      )
    : [];

  const matchingEvents = cleanQuery
    ? events.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(cleanQuery) ||
          (e.speaker && e.speaker.toLowerCase().includes(cleanQuery)) ||
          (e.venue && e.venue.toLowerCase().includes(cleanQuery))
      )
    : [];

  const SYSTEM_PAGES = [
    { title: 'Staff Directory & Access Control', path: '/users', keywords: ['staff', 'users', 'roles', 'directory', 'access', 'admin', 'permissions', 'super admin', 'password'], desc: 'Staff registry, role permissions & password management' },
    { title: 'Church Settings & Supabase', path: '/settings', keywords: ['settings', 'supabase', 'database', 'security', 'password', 'config'], desc: 'System configuration, security policies & cloud database' },
    { title: 'Members Directory', path: '/members', keywords: ['members', 'directory', 'people'], desc: 'Full member registry and profiles' },
    { title: 'Finance & Giving', path: '/finance', keywords: ['finance', 'giving', 'tithe', 'offering'], desc: 'Giving transactions, collections and accounts' },
    { title: 'Pastoral Care', path: '/pastoral-care', keywords: ['pastoral', 'visitation', 'care', 'counseling'], desc: 'Pastoral visits, counseling and requests' },
    { title: 'Welfare & Benevolence', path: '/welfare', keywords: ['welfare', 'benevolence', 'aid', 'claims', 'contributions'], desc: 'Benevolence funds and welfare claims' },
  ];

  const matchingPages = cleanQuery
    ? SYSTEM_PAGES.filter(
        (p) =>
          p.title.toLowerCase().includes(cleanQuery) ||
          p.keywords.some((k) => k.includes(cleanQuery) || cleanQuery.includes(k))
      )
    : [];

  const totalResults = matchingMembers.length + matchingVisitors.length + matchingEvents.length + matchingPages.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 bg-slate-50/50">
          <Search className="w-5 h-5 text-emerald-600 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by member name, phone, GWCC-ID, Tithe #, or visitor..."
            className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-2 text-xs font-mono px-2 py-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {!query && (
            <div className="py-8 text-center text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Search Greater Works City Church records</p>
              <p className="text-xs text-slate-400 mt-1">
                Type names like &quot;Kwame&quot;, ID like &quot;GWCC-000001&quot;, tithe &quot;T-1042&quot;, or Ghanaian phone numbers.
              </p>
            </div>
          )}

          {query && totalResults === 0 && (
            <div className="py-8 text-center text-slate-400">
              <p className="text-sm font-medium text-slate-600">No records found matching &quot;{query}&quot;</p>
              <p className="text-xs text-slate-400 mt-1">Try checking for typos or searching by phone number.</p>
            </div>
          )}

          {/* Quick Navigation Matches */}
          {matchingPages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800 mb-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>Modules & Workstations ({matchingPages.length})</span>
              </div>
              <div className="space-y-1.5">
                {matchingPages.map((page) => (
                  <div
                    key={page.path}
                    onClick={() => {
                      onClose();
                      navigate(page.path);
                    }}
                    className="flex items-center justify-between p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 group-hover:text-indigo-900">
                          {page.title}
                        </div>
                        <div className="text-xs text-slate-500">{page.desc}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members Results */}
          {matchingMembers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Members ({matchingMembers.length})
              </div>
              <div className="space-y-1.5">
                {matchingMembers.slice(0, 5).map((mem) => (
                  <div
                    key={mem.id}
                    onClick={() => {
                      onClose();
                      navigate(`/members?id=${mem.id}`);
                      onSelectMember?.(mem.id);
                    }}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3">
                      {mem.profile_photo_url ? (
                        <img
                          src={mem.profile_photo_url}
                          alt={mem.first_name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                          {mem.first_name[0]}
                          {mem.last_name[0]}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {mem.first_name} {mem.last_name}
                          </span>
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            {mem.member_id}
                          </span>
                          {mem.tithe_number && (
                            <span className="font-mono text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                              {mem.tithe_number}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {mem.phone}
                          </span>
                          {mem.residential_address && (
                            <span className="flex items-center gap-1 truncate max-w-xs">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {mem.residential_address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visitors Results */}
          {matchingVisitors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800 mb-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Visitors ({matchingVisitors.length})
              </div>
              <div className="space-y-1.5">
                {matchingVisitors.slice(0, 4).map((vis) => (
                  <div
                    key={vis.id}
                    onClick={() => {
                      onClose();
                      navigate('/visitors');
                    }}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{vis.full_name}</span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          {vis.follow_up_status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span>Visited: {vis.visit_date}</span>
                        <span>•</span>
                        <span>{vis.phone}</span>
                        <span>•</span>
                        <span className="truncate max-w-xs">{vis.service_attended}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events Results */}
          {matchingEvents.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-800 mb-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                Church Events ({matchingEvents.length})
              </div>
              <div className="space-y-1.5">
                {matchingEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => {
                      onClose();
                      navigate('/events');
                    }}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/50 cursor-pointer transition group"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900">{evt.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {evt.start_date} • {evt.venue}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-1 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Search index covers members, visitors, and church activities</span>
          <span>GWCC System v1.0</span>
        </div>
      </div>
    </div>
  );
};
