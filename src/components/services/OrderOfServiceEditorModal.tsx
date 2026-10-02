import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, Clock, ListOrdered, Sparkles } from 'lucide-react';
import { ChurchService, ServiceProgramItem } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface OrderOfServiceEditorModalProps {
  service: ChurchService;
  onSave: (serviceId: string, orderOfService: ServiceProgramItem[]) => void;
  onClose: () => void;
}

const TEMPLATES: Record<string, Omit<ServiceProgramItem, 'id'>[]> = {
  sunday_communion: [
    { order: 1, time: '07:30 - 07:45', title: 'Opening Prayer & Declarations', minister: 'Intercessor', duration: '15 min' },
    { order: 2, time: '07:45 - 08:15', title: 'Praise & Worship Ministration', minister: 'Choir & Praise Band', duration: '30 min' },
    { order: 3, time: '08:15 - 08:30', title: 'Visitors Welcome & Pastoral Announcements', minister: 'Protocol Lead', duration: '15 min' },
    { order: 4, time: '08:30 - 08:45', title: 'Kingdom Tithes, Seed & Offering', minister: 'Finance Steward', duration: '15 min' },
    { order: 5, time: '08:45 - 09:20', title: 'Apostolic Sermon & Prophetic Ministry', minister: 'Senior Pastor', duration: '35 min' },
    { order: 6, time: '09:20 - 09:30', title: 'Holy Communion & Benediction', minister: 'Pastoral Council', duration: '10 min' },
  ],
  celebration_sunday: [
    { order: 1, time: '10:00 - 10:15', title: 'Opening Intercession & Call to Worship', minister: 'Presiding Minister', duration: '15 min' },
    { order: 2, time: '10:15 - 10:55', title: 'High Praise & Celebratory Worship', minister: 'Music Team', duration: '40 min' },
    { order: 3, time: '10:55 - 11:10', title: 'Testimonies & Visitor Welcome', minister: 'Lady Pastor', duration: '15 min' },
    { order: 4, time: '11:10 - 11:30', title: 'Covenant Tithes & Project Sacrificial Seed', minister: 'Church Board', duration: '20 min' },
    { order: 5, time: '11:30 - 12:15', title: 'Ministry of the Word', minister: 'Apostle / Guest Minister', duration: '45 min' },
    { order: 6, time: '12:15 - 12:30', title: 'Altar Call, Healing Ministry & Benediction', minister: 'Senior Pastor', duration: '15 min' },
  ],
  midweek_teaching: [
    { order: 1, time: '18:30 - 18:50', title: 'Opening Prayer & Family Intercession', minister: 'Prayer Warriors', duration: '20 min' },
    { order: 2, time: '18:50 - 19:15', title: 'Devotional Hymns & Adoration', minister: 'Choir Lead', duration: '25 min' },
    { order: 3, time: '19:15 - 20:05', title: 'Bible Exegesis & Verse-by-Verse Doctrine', minister: 'Resident Pastor', duration: '50 min' },
    { order: 4, time: '20:05 - 20:25', title: 'Targeted Deliverance & Miracle Prayers', minister: 'Pastoral Team', duration: '20 min' },
    { order: 5, time: '20:25 - 20:30', title: 'Offering & Benediction', minister: 'Elder on Duty', duration: '5 min' },
  ],
};

export const OrderOfServiceEditorModal: React.FC<OrderOfServiceEditorModalProps> = ({
  service,
  onSave,
  onClose,
}) => {
  const { success, info } = useToast();

  const [items, setItems] = useState<ServiceProgramItem[]>(
    service.order_of_service && service.order_of_service.length > 0
      ? service.order_of_service
      : TEMPLATES.celebration_sunday.map((t, idx) => ({ ...t, id: `item-${Date.now()}-${idx}` }))
  );

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        order: prev.length + 1,
        time: '',
        title: '',
        minister: '',
        duration: '15 min',
        notes: '',
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id).map((item, idx) => ({ ...item, order: idx + 1 })));
  };

  const handleChange = (id: string, field: keyof ServiceProgramItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const handleLoadTemplate = (templateKey: string) => {
    const tmpl = TEMPLATES[templateKey];
    if (!tmpl) return;
    setItems(tmpl.map((t, idx) => ({ ...t, id: `item-${Date.now()}-${idx}` })));
    info('Template Applied', 'Order of service updated with selected liturgical template.');
  };

  const handleSave = () => {
    onSave(service.id, items);
    success('Liturgy Updated', `Order of service for "${service.name}" saved successfully.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <ListOrdered className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Plan Order of Service (Liturgy)</h3>
              <p className="text-xs text-emerald-200">{service.name} • {service.day_of_week}s</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-emerald-200 hover:text-white rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Template Presets */}
        <div className="p-3 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between gap-2 text-xs shrink-0 flex-wrap">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            Apply Liturgical Template:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleLoadTemplate('celebration_sunday')}
              className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
            >
              Sunday Celebration (2h 30m)
            </button>
            <button
              type="button"
              onClick={() => handleLoadTemplate('sunday_communion')}
              className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
            >
              Prophetic & Communion (2h)
            </button>
            <button
              type="button"
              onClick={() => handleLoadTemplate('midweek_teaching')}
              className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
            >
              Midweek Bible Expository (2h)
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 text-xs">
          <div className="space-y-2.5">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2.5 transition"
              >
                <span className="font-mono font-bold text-slate-400 w-6 text-center shrink-0">
                  {idx + 1}
                </span>

                <div className="w-32 shrink-0">
                  <input
                    type="text"
                    value={item.time || ''}
                    onChange={(e) => handleChange(item.id, 'time', e.target.value)}
                    placeholder="e.g. 10:00 - 10:15"
                    className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="flex-1">
                  <input
                    type="text"
                    required
                    value={item.title}
                    onChange={(e) => handleChange(item.id, 'title', e.target.value)}
                    placeholder="Program Activity (e.g. High Praise & Worship)"
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="w-44 shrink-0">
                  <input
                    type="text"
                    value={item.minister || ''}
                    onChange={(e) => handleChange(item.id, 'minister', e.target.value)}
                    placeholder="Minister / Choir Lead"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer self-end sm:self-center"
                  title="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-2.5 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl text-emerald-800 hover:bg-emerald-50/60 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Program Segment (+1)</span>
          </button>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-white text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save Order of Service</span>
          </button>
        </div>
      </div>
    </div>
  );
};
