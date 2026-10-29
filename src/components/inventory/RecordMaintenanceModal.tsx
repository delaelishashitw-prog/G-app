import { useModalFocus } from '../../hooks/useModalFocus';
import { OPERATION_SAVE_NOTICE } from '../../features/operations/durableOperations';
import React, { useRef, useState } from 'react';
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
  onRecord: (assetId: string, logData: Omit<AssetMaintenanceLog, 'id'>, requestId: string, expectedVersion?:string) => Promise<unknown>;
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
  const [performedBy, setPerformedBy] = useState(asset.custodian_name || '');

  const requestId=useRef(crypto.randomUUID()),busy=useRef(false),version=useRef(asset.updated_at);
  const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
  const dialog=useModalFocus(isOpen,()=>{if(!busy.current)onClose();});
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    if(busy.current){e.preventDefault();return;}
    e.preventDefault();

    if (!technicianVendor.trim()) {
      toastError('Validation Error', 'Please specify the technician or service company name.');
      return;
    }
    if (!details.trim()) {
      toastError('Validation Error', 'Please describe the maintenance or repairs performed.');
      return;
    }

    const costNum = cost.trim() ? Number(cost) : 0;
    if(!Number.isFinite(costNum)||costNum<0){toastError('Validation Error','Enter a valid non-negative maintenance cost.');return;}

    busy.current=true;setSaving(true);setSaveError('');
    try {
    await onRecord(asset.id, {
      asset_id: asset.id,
      service_date: serviceDate,
      service_type: serviceType,
      technician_vendor: technicianVendor.trim(),
      cost: costNum,
      details: details.trim(),
      performed_by: performedBy.trim(),
    },requestId.current,version.current);

    toastSuccess('Service Logged', OPERATION_SAVE_NOTICE);
    onClose();
    } catch(error) { setSaveError(error instanceof Error ? error.message : 'The maintenance entry could not be saved. Keep this form open and retry.'); }
    finally {busy.current=false;setSaving(false);}
  };

  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Record asset maintenance" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
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
            disabled={saving} onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-emerald-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {saveError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{saveError}</p>}
          <fieldset disabled={saving} className="contents">
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
              disabled={saving} onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Service Log</span>
            </button>
          </div>
        </fieldset></form>
      </div>
    </div>
  );
};
