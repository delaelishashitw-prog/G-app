import React, { useState } from 'react';
import { Printer, Copy, Check, X, CalendarDays, Clock, MapPin, User, ShieldCheck } from 'lucide-react';
import { ChurchService, ChurchSettings } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface ServiceBulletinModalProps {
  service: ChurchService;
  settings: ChurchSettings;
  onClose: () => void;
}

export const ServiceBulletinModal: React.FC<ServiceBulletinModalProps> = ({
  service,
  settings,
  onClose,
}) => {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  const programItems = service.order_of_service || [];

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const text = `${settings.church_name || 'GREATER WORKS CITY CHURCH'} - ORDER OF SERVICE
Service: ${service.name}
Day & Time: Every ${service.day_of_week} (${service.start_time} - ${service.end_time} GMT)
Venue: ${service.venue || 'Main Cathedral Sanctuary, Joma, Accra'}
Preacher: ${service.preacher || 'Senior Pastor'}
Service Leader: ${service.service_leader || 'Pastoral Team'}

ORDER OF SERVICE:
${programItems.map((p, idx) => `${idx + 1}. [${p.time || p.duration || ''}] ${p.title} - ${p.minister || 'Minister'}`).join('\n')}

"I was glad when they said unto me, Let us go into the house of the LORD." — Psalm 122:1`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    success('Bulletin Copied', 'Order of service copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <CalendarDays className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold block">Service Program & Order of Service</span>
              <span className="text-[10px] text-slate-400">{service.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Bulletin</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Bulletin Body */}
        <div className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white overflow-y-auto flex-1 print:p-0">
          {/* Header Letterhead */}
          <div className="flex items-start justify-between pb-4 border-b-2 border-emerald-900 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-slate-50 p-1 border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={settings.logo_url || '/assets/logo.png'}
                  alt="GWCC Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-slate-950 uppercase tracking-tight">
                  {settings.church_name || 'Greater Works City Church'}
                </h2>
                <p className="text-xs font-medium text-emerald-900">
                  {settings.branch_name || 'Joma Assembly'} • Accra, Ghana
                </p>
                <p className="text-[10px] text-slate-500">
                  Main Sanctuary • GPS: GA-183-4921 • www.greaterworkscitychurch.org
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-block px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                Worship Program
              </span>
              <div className="text-xs font-bold text-slate-800">{service.day_of_week}s</div>
              <div className="text-[11px] font-mono text-slate-500">
                {service.start_time} - {service.end_time} GMT
              </div>
            </div>
          </div>

          {/* Service Banner */}
          <div className="p-4 bg-emerald-950 text-white rounded-xl space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-base font-extrabold">{service.name}</h3>
              <span className="text-[11px] text-emerald-300 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {service.venue || 'Main Cathedral Sanctuary, Joma'}
              </span>
            </div>
            {service.description && (
              <p className="text-xs text-emerald-100/90 leading-relaxed italic">
                "{service.description}"
              </p>
            )}
          </div>

          {/* Ministers on Duty Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Preacher / Exhorter</span>
              <span className="font-bold text-slate-900 block mt-0.5">
                {service.preacher || 'Prophet Elisha K. Richard'}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Minister of the Word</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Service Leader / MC</span>
              <span className="font-bold text-slate-900 block mt-0.5">
                {service.service_leader || 'Pastoral Council'}
              </span>
              <span className="text-[10px] text-slate-500">Service Moderator</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Praise & Worship</span>
              <span className="font-bold text-slate-900 block mt-0.5">
                {service.worship_leader || 'Voice of Dominion Choir'}
              </span>
              <span className="text-[10px] text-purple-700 font-medium">Music Ministration</span>
            </div>
          </div>

          {/* Liturgical Program Order */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center justify-between">
              <span>Order of Service & Liturgical Schedule</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">
                {programItems.length} Program Segments
              </span>
            </h4>

            {programItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 border border-dashed rounded-xl text-xs">
                No specific order of service items scheduled yet. Click "Edit Order of Service" on the services page to add liturgical segments.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    <tr>
                      <th className="py-2.5 px-3 w-8">#</th>
                      <th className="py-2.5 px-3 w-32">Time / Duration</th>
                      <th className="py-2.5 px-3">Liturgy / Activity</th>
                      <th className="py-2.5 px-3">Ministration By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {programItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {item.time || item.duration || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{item.title}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {item.minister || 'Ministers on Duty'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Scripture Callout */}
          <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-100 text-center">
            <p className="text-[11px] text-slate-700 italic">
              "Enter his gates with thanksgiving and his courts with praise; give thanks to him and praise his name. For the LORD is good and his love endures forever."
            </p>
            <span className="text-[10px] font-bold text-emerald-900 uppercase mt-0.5 block">
              Psalm 100:4-5
            </span>
          </div>

          {/* Footer Signoff */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-8 text-[10px]">
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-3/4 mb-1"></div>
              <span className="font-bold text-slate-800 block">{settings.senior_pastor || 'Prophet Elisha K. Richard'}</span>
              <span className="text-slate-400">Senior Pastor & General Overseer</span>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-3/4 mb-1"></div>
              <span className="font-bold text-slate-800 block">{settings.general_secretary || 'Tamekloe Clara Gaewornu'}</span>
              <span className="text-slate-400">General Secretary / Secretariat</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
