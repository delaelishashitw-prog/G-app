import React, { useState } from 'react';
import {
  X,
  Package,
  Save,
  Tag,
  Building,
  Calendar,
  DollarSign,
  AlertCircle,
  FileText,
  User,
  Wrench,
} from 'lucide-react';
import { ChurchAsset, AssetCategory, AssetCondition } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface AddEditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assetData: Omit<ChurchAsset, 'id' | 'created_at'>) => void;
  assetToEdit?: ChurchAsset | null;
}

const CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
  { value: 'audio_sound', label: 'Audio & Sound Systems' },
  { value: 'musical_instruments', label: 'Musical Instruments' },
  { value: 'multimedia_broadcast', label: 'Multimedia & Live Broadcast' },
  { value: 'power_facility', label: 'Power & Physical Facilities' },
  { value: 'furniture_sanctuary', label: 'Sanctuary Furniture & Seating' },
  { value: 'communion_liturgical', label: 'Liturgical & Holy Communion' },
];

const CONDITION_OPTIONS: { value: AssetCondition; label: string; color: string }[] = [
  { value: 'working', label: 'Working / Optimal', color: 'text-emerald-700 bg-emerald-50' },
  { value: 'under_maintenance', label: 'Under Maintenance', color: 'text-amber-700 bg-amber-50' },
  { value: 'faulty', label: 'Faulty / Needs Repair', color: 'text-rose-700 bg-rose-50' },
  { value: 'decommissioned', label: 'Decommissioned / Retired', color: 'text-slate-600 bg-slate-100' },
];

export const AddEditAssetModal: React.FC<AddEditAssetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  assetToEdit,
}) => {
  const { error: toastError, success: toastSuccess } = useToast();

  const [assetTag, setAssetTag] = useState(assetToEdit?.asset_tag || `AST-${String(Math.floor(100 + Math.random() * 900))}`);
  const [name, setName] = useState(assetToEdit?.name || '');
  const [category, setCategory] = useState<AssetCategory>(assetToEdit?.category || 'audio_sound');
  const [department, setDepartment] = useState(assetToEdit?.department || 'Sound & Audio Engineering');
  const [brand, setBrand] = useState(assetToEdit?.brand || '');
  const [model, setModel] = useState(assetToEdit?.model || '');
  const [serialNumber, setSerialNumber] = useState(assetToEdit?.serial_number || '');
  const [purchaseDate, setPurchaseDate] = useState(assetToEdit?.purchase_date || new Date().toISOString().split('T')[0]);
  const [purchaseCost, setPurchaseCost] = useState(assetToEdit?.purchase_cost ? String(assetToEdit.purchase_cost) : '');
  const [currentCondition, setCurrentCondition] = useState<AssetCondition>(assetToEdit?.current_condition || 'working');
  const [location, setLocation] = useState(assetToEdit?.location || 'Main Sanctuary Auditorium');
  const [custodianName, setCustodianName] = useState(assetToEdit?.custodian_name || 'Brother Kwame Mensah');
  const [nextServiceDate, setNextServiceDate] = useState(assetToEdit?.next_service_date || '');
  const [notes, setNotes] = useState(assetToEdit?.notes || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toastError('Validation Error', 'Please enter an asset name or description.');
      return;
    }

    const costNum = parseFloat(purchaseCost);
    if (isNaN(costNum) || costNum < 0) {
      toastError('Validation Error', 'Please provide a valid purchase cost (GH₵).');
      return;
    }

    onSave({
      asset_tag: assetTag.trim().toUpperCase(),
      name: name.trim(),
      category,
      department: department.trim(),
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      serial_number: serialNumber.trim() || undefined,
      purchase_date: purchaseDate,
      purchase_cost: costNum,
      current_condition: currentCondition,
      location: location.trim(),
      custodian_name: custodianName.trim(),
      next_service_date: nextServiceDate || undefined,
      notes: notes.trim() || undefined,
      maintenance_logs: assetToEdit?.maintenance_logs || [],
    });

    toastSuccess(
      assetToEdit ? 'Asset Updated' : 'Asset Registered',
      `${name} [${assetTag}] has been saved into the church registry.`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Package className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">
                {assetToEdit ? 'Edit Asset Record' : 'Register Church Asset / Equipment'}
              </h3>
              <p className="text-xs text-emerald-200">
                Logistics, AV, and facility property inventory tracking
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
          {/* Tag & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Asset Tag / Barcode ID <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Tag className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={assetTag}
                  onChange={(e) => setAssetTag(e.target.value)}
                  placeholder="e.g. AST-009"
                  className="w-full pl-8.5 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-slate-900 focus:bg-white focus:outline-emerald-600 uppercase"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">
                Asset Name & Model Description <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Yamaha Motif XF8 88-Key Synthesizer"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>
          </div>

          {/* Category & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Asset Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-semibold focus:outline-emerald-600"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Custodian Department / Ministry <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Sound & Audio Engineering, Facilities"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>
          </div>

          {/* Brand, Model, Serial Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Brand / Manufacturer</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Yamaha, Shure, Sony, Perkins"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Model / Part No</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. X32, Motif-8, SLXD4"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Serial Number</label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. SN-89124-GH"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-mono focus:outline-emerald-600"
              />
            </div>
          </div>

          {/* Financials & Physical Placement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Purchase Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Purchase Cost (GH₵) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-400">GH₵</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Operational Condition <span className="text-rose-500">*</span>
              </label>
              <select
                value={currentCondition}
                onChange={(e) => setCurrentCondition(e.target.value as AssetCondition)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600"
              >
                {CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location & Custodian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Physical Location / Room <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Sound Control Booth, Altar Stage, Vestry"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Primary Custodian / Responsible Officer <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={custodianName}
                onChange={(e) => setCustodianName(e.target.value)}
                placeholder="e.g. Brother Kwame Mensah, Elder Kofi Addo"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>
          </div>

          {/* Maintenance Schedule */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Next Scheduled Maintenance / Inspection Date (Optional)
            </label>
            <input
              type="date"
              value={nextServiceDate}
              onChange={(e) => setNextServiceDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Technical Specifications & Condition Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Firmware version, included accessories, power requirements, or specific operating precautions..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600 resize-none"
            />
          </div>

          {/* Buttons */}
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
              <span>{assetToEdit ? 'Save Changes' : 'Register Asset'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
