import React, { useState } from 'react';
import {
  X,
  Wrench,
  Save,
  Calendar,
  DollarSign,
  User,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { ChurchAsset, AssetMaintenanceLog } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface RecordMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: ChurchAsset;
  onRecord: (assetId: string, logData: Omit<AssetMaintenanceLog, 'id'>) => void;
}

export const RecordMaintenanceModal: React.FC<RecordMaintenanceModalProps> = ({
  isOpen,
  onClose,
  asset,
  onRecord,
}) => {
  const { error: toastError, success: toastSuccess } = useToast();

  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState<AssetMaintenanceLog['service_type']>('routine_maintenance');
  const [technicianVendor, setTechnicianVendor] = useState('');
  const [cost, setCost] = useState('');
  const [details, setDetails] = useState('');
  const [performedBy, setPerformedBy] = useState(asset.custodian_name || 'Brother Kwame Mensah');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!technicianVendor.trim()) {
      toastError('Validation Error', 'Please specify the technician or service company name.');
      return;
    }
    if (!details.trim()) {
      toastError('Validation Error', 'Please describe the maintenance or repairs performed.');
      return;
    }

    const costNum = parseFloat(cost) || 0;

    onRecord(asset.id, {
      asset_id: asset.id,
      service_date: serviceDate,
      service_type: serviceType,
      technician_vendor: technicianVendor.trim(),
      cost: costNum,
      details: details.trim(),
      performed_by: performedBy.trim(),
    });

    toastSuccess('Service Logged', `Maintenance record added for ${asset.name} [${asset.asset_tag}].`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Wrench className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Record Maintenance / Repair</h3>
              <p className="text-xs text-emerald-200 truncate max-w-xs">
                {asset.name} • Tag: {asset.asset_tag}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Service Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Service Nature <span className="text-rose-500">*</span>
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600"
              >
                <option value="routine_maintenance">Routine Servicing / Maintenance</option>
                <option value="repair">Fault Repair / Component Fix</option>
                <option value="inspection">Diagnostic Inspection / Audit</option>
                <option value="replacement">Parts Replacement / Upgrade</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Technician / Vendor Company <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={technicianVendor}
              onChange={(e) => setTechnicianVendor(e.target.value)}
              placeholder="e.g. SoundPro West Africa, Mantrac Field Engineers, Ablekuma AC Tech"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Cost of Service (GH₵)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-400">GH₵</span>
                <input
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Verified By Church Officer <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                placeholder="e.g. Brother Kwame Mensah, Elder Kofi Addo"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Work Performed & Diagnostic Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Detail the work carried out, replaced components, diagnostic readings, or follow-up recommendations..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Service Log</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
