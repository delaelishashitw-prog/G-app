import React, { useState } from 'react';
import {
  X,
  Package,
  Wrench,
  Calendar,
  DollarSign,
  Tag,
  Building,
  User,
  Clock,
  Printer,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Edit,
} from 'lucide-react';
import { ChurchAsset, AssetMaintenanceLog } from '../../types/database.types';
import { formatGHS } from '../../lib/currencyUtils';
import { RecordMaintenanceModal } from './RecordMaintenanceModal';

interface AssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: ChurchAsset;
  onEdit: (asset: ChurchAsset) => void;
  onDelete: (assetId: string) => void;
  onRecordMaintenance: (assetId: string, logData: Omit<AssetMaintenanceLog, 'id'>) => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  audio_sound: 'Audio & Sound Systems',
  musical_instruments: 'Musical Instruments',
  multimedia_broadcast: 'Multimedia & Live Broadcast',
  power_facility: 'Power & Physical Facilities',
  furniture_sanctuary: 'Sanctuary Furniture & Seating',
  communion_liturgical: 'Liturgical & Holy Communion',
};

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  isOpen,
  onClose,
  asset,
  onEdit,
  onDelete,
  onRecordMaintenance,
}) => {
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const logs = asset.maintenance_logs || [];
  const totalMaintenanceSpent = logs.reduce((sum, l) => sum + (l.cost || 0), 0);

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'working':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Working / Optimal
          </span>
        );
      case 'under_maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Under Maintenance
          </span>
        );
      case 'faulty':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            Faulty / Requires Attention
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Decommissioned
          </span>
        );
    }
  };

  const handlePrintTag = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Tag - ${asset.asset_tag}</title>
          <style>
            @page { size: 80mm 50mm; margin: 4mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 4mm; color: #0f172a; }
            .tag-card { border: 2px dashed #065f46; border-radius: 8px; padding: 10px; text-align: center; }
            .church { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #064e3b; letter-spacing: 0.5px; }
            .tag-id { font-size: 20px; font-weight: 900; color: #0f172a; font-family: monospace; margin: 4px 0; }
            .name { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
            .dept { font-size: 9px; color: #475569; }
            .footer { font-size: 8px; color: #64748b; margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px; }
          </style>
        </head>
        <body>
          <div class="tag-card">
            <div class="church">Greater Works City Church</div>
            <div class="dept">PROPERTY OF GWCC • JOMA BRANCH</div>
            <div class="tag-id">${asset.asset_tag}</div>
            <div class="name">${asset.name}</div>
            <div class="dept">Dept: ${asset.department} | Loc: ${asset.location}</div>
            <div class="footer">DO NOT REMOVE OR TAMPER • LOGISTICS & INVENTORY REGISTRY</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-700/60 rounded-xl">
                <Package className="w-5 h-5 text-emerald-200" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black bg-emerald-900/80 px-2 py-0.5 rounded text-emerald-200 border border-emerald-600">
                    {asset.asset_tag}
                  </span>
                  <h3 className="text-base font-bold truncate max-w-sm sm:max-w-md">
                    {asset.name}
                  </h3>
                </div>
                <p className="text-xs text-emerald-200">
                  {CATEGORY_NAMES[asset.category] || asset.category} • {asset.department}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintTag}
                title="Print Barcode Tag"
                className="p-1.5 text-emerald-200 hover:text-white rounded-lg transition hover:bg-emerald-800"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-emerald-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Dossier Content */}
          <div className="p-6 space-y-6 text-xs overflow-y-auto flex-1">
            {/* Condition Banner & Key Metric Row */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Current Status
                </span>
                <div>{getConditionBadge(asset.current_condition)}</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Original Valuation
                </span>
                <div className="text-base font-black text-slate-900">
                  {formatGHS(asset.purchase_cost)}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Total Servicing Cost
                </span>
                <div className="text-base font-black text-emerald-800">
                  {formatGHS(totalMaintenanceSpent)}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Physical Placement
                </span>
                <div className="font-bold text-slate-800">{asset.location}</div>
              </div>
            </div>

            {/* Technical & Custodial Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Brand / Manufacturer
                </span>
                <span className="font-semibold text-slate-800">{asset.brand || 'Unspecified'}</span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Model / Part Number
                </span>
                <span className="font-semibold text-slate-800">{asset.model || 'Standard'}</span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Serial Number
                </span>
                <span className="font-mono font-semibold text-slate-800">
                  {asset.serial_number || 'N/A'}
                </span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Purchase Date
                </span>
                <span className="font-semibold text-slate-800">{asset.purchase_date}</span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Responsible Custodian
                </span>
                <span className="font-semibold text-slate-800">{asset.custodian_name}</span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Next Service Due
                </span>
                <span className="font-semibold text-slate-800">
                  {asset.next_service_date || 'No routine date set'}
                </span>
              </div>
            </div>

            {/* Notes if present */}
            {asset.notes && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-amber-900">
                <span className="font-bold block mb-0.5">Asset Notes & Instructions:</span>
                <p className="text-xs text-amber-800">{asset.notes}</p>
              </div>
            )}

            {/* Maintenance History Section */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-emerald-700" />
                    <span>Maintenance & Repair History</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {logs.length}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Audit trail of technician visits, replacement parts, and expenditures
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMaintenanceModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Service</span>
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                  <CheckCircle2 className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="font-semibold">No maintenance logs recorded yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Equipment operating normally under standard custodian oversight.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/70 transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 capitalize">
                            {log.service_type.replace('_', ' ')}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{log.service_date}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-800">
                          {formatGHS(log.cost)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">{log.details}</p>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                        <span>Technician: <strong>{log.technician_vendor}</strong></span>
                        <span>Officer: <strong>{log.performed_by}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-rose-600 font-bold text-xs">Delete this asset?</span>
                  <button
                    onClick={() => {
                      onDelete(asset.id);
                      onClose();
                    }}
                    className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl font-bold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Decommission / Delete</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(asset);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-100 transition"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Asset</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record Maintenance Modal */}
      {isMaintenanceModalOpen && (
        <RecordMaintenanceModal
          isOpen={isMaintenanceModalOpen}
          onClose={() => setIsMaintenanceModalOpen(false)}
          asset={asset}
          onRecord={onRecordMaintenance}
        />
      )}
    </>
  );
};
