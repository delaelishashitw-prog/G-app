import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Wrench,
  Printer,
  Tag,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building,
  User,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { ChurchAsset, AssetCategory, AssetCondition } from '../types/database.types';
import { formatGHS } from '../lib/currencyUtils';

// Modals
import { AddEditAssetModal } from '../components/inventory/AddEditAssetModal';
import { AssetDetailModal } from '../components/inventory/AssetDetailModal';
import { RecordMaintenanceModal } from '../components/inventory/RecordMaintenanceModal';
import { PrintAssetRegisterModal } from '../components/inventory/PrintAssetRegisterModal';

const CATEGORY_NAMES: Record<string, string> = {
  audio_sound: 'Audio & Sound Systems',
  musical_instruments: 'Musical Instruments',
  multimedia_broadcast: 'Multimedia & Live Broadcast',
  power_facility: 'Power & Physical Facilities',
  furniture_sanctuary: 'Sanctuary Furniture & Seating',
  communion_liturgical: 'Liturgical & Holy Communion',
};

export const InventoryPage: React.FC = () => {
  const {
    assets,
    addAsset,
    updateAsset,
    deleteAsset,
    addAssetMaintenanceLog,
    settings,
  } = useChurchData();
  const { success: toastSuccess } = useToast();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [conditionFilter, setConditionFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<ChurchAsset | null>(null);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<ChurchAsset | null>(null);
  const [selectedAssetForMaintenance, setSelectedAssetForMaintenance] = useState<ChurchAsset | null>(null);
  const [isPrintRegisterOpen, setIsPrintRegisterOpen] = useState(false);

  // Aggregated KPIs
  const totalValuation = useMemo(() => {
    return assets.reduce((sum, a) => sum + (a.purchase_cost || 0), 0);
  }, [assets]);

  const workingCount = useMemo(() => {
    return assets.filter((a) => a.current_condition === 'working').length;
  }, [assets]);

  const maintenanceCount = useMemo(() => {
    return assets.filter((a) => a.current_condition === 'under_maintenance').length;
  }, [assets]);

  const faultyCount = useMemo(() => {
    return assets.filter((a) => a.current_condition === 'faulty').length;
  }, [assets]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchSearch =
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.asset_tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.brand && a.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.model && a.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        a.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.custodian_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = categoryFilter === 'ALL' || a.category === categoryFilter;
      const matchCondition = conditionFilter === 'ALL' || a.current_condition === conditionFilter;

      return matchSearch && matchCategory && matchCondition;
    });
  }, [assets, searchTerm, categoryFilter, conditionFilter]);

  const handleOpenAdd = () => {
    setAssetToEdit(null);
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (asset: ChurchAsset) => {
    setAssetToEdit(asset);
    setIsAddEditOpen(true);
  };

  const handleSaveAsset = (assetData: Omit<ChurchAsset, 'id' | 'created_at'>) => {
    if (assetToEdit) {
      updateAsset(assetToEdit.id, assetData);
    } else {
      addAsset(assetData);
    }
  };

  const getConditionBadge = (condition: AssetCondition) => {
    switch (condition) {
      case 'working':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Working
          </span>
        );
      case 'under_maintenance':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" />
            Maintenance
          </span>
        );
      case 'faulty':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3" />
            Faulty
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Decommissioned
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800 text-white rounded-xl shadow-xs">
              <Package className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Church Asset & Equipment Registry
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Logistics, audio-visual gear, instruments, power facilities, and maintenance audit logs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPrintRegisterOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Register</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Asset</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Registered Assets
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{assets.length} items</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Across all ministries and halls</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Inventory Valuation
          </span>
          <div className="text-2xl font-black text-emerald-800 mt-1">
            {formatGHS(totalValuation)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Replacement cost evaluation</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            In Optimal Working State
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {workingCount}
            <span className="text-xs font-semibold text-slate-400 ml-1.5">
              ({assets.length > 0 ? Math.round((workingCount / assets.length) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Ready for service operations</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Attention Needed
          </span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {maintenanceCount + faultyCount}
            <span className="text-xs font-semibold text-slate-400 ml-1.5">
              ({maintenanceCount} maint • {faultyCount} faulty)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Requires technician visit</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by tag (AST-001), name, brand, model, serial no, or custodian..."
              className="w-full pl-9.5 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-medium text-slate-900 focus:bg-white focus:outline-emerald-600"
            />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-56">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold text-slate-800 focus:outline-emerald-600"
            >
              <option value="ALL">All Categories ({assets.length})</option>
              {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Condition Filter */}
          <div className="w-full md:w-48">
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold text-slate-800 focus:outline-emerald-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="working">Working Only</option>
              <option value="under_maintenance">Under Maintenance</option>
              <option value="faulty">Faulty / Needs Repair</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table' ? 'bg-white shadow-xs text-emerald-800' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'cards' ? 'bg-white shadow-xs text-emerald-800' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Assets Content */}
      {filteredAssets.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No assets found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            No equipment matches your current search keywords or category filters.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setCategoryFilter('ALL');
              setConditionFilter('ALL');
            }}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Tag ID</th>
                  <th className="py-3 px-4">Equipment & Model</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Department & Room</th>
                  <th className="py-3 px-4 text-right">Valuation</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Custodian</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedAssetForDetail(asset)}
                    className="hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 group-hover:border-emerald-500 group-hover:bg-emerald-50 transition">
                        {asset.asset_tag}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                      <div className="truncate">{asset.name}</div>
                      {(asset.brand || asset.model) && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {asset.brand} {asset.model} {asset.serial_number ? `• S/N: ${asset.serial_number}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {CATEGORY_NAMES[asset.category] || asset.category}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium text-slate-800">{asset.department}</div>
                      <div className="text-[10px] text-slate-400">{asset.location}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatGHS(asset.purchase_cost)}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {getConditionBadge(asset.current_condition)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                      {asset.custodian_name}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedAssetForMaintenance(asset)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Record Maintenance / Service"
                        >
                          <Wrench className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(asset)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          title="Edit Asset Details"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => setSelectedAssetForDetail(asset)}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-600 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-black bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-900">
                    {asset.asset_tag}
                  </span>
                  <div>{getConditionBadge(asset.current_condition)}</div>
                </div>

                <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition line-clamp-2">
                  {asset.name}
                </h4>

                <p className="text-[11px] text-slate-500 mt-1">
                  {CATEGORY_NAMES[asset.category] || asset.category} • {asset.department}
                </p>

                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Room</span>
                    <span className="font-semibold text-slate-700 truncate block">{asset.location}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Custodian</span>
                    <span className="font-semibold text-slate-700 truncate block">{asset.custodian_name}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Cost Valuation</span>
                  <span className="font-mono text-sm font-black text-slate-900">
                    {formatGHS(asset.purchase_cost)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedAssetForMaintenance(asset)}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                    title="Log Service"
                  >
                    <Wrench className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(asset)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    title="Edit Asset"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Asset Modal */}
      {isAddEditOpen && (
        <AddEditAssetModal
          isOpen={isAddEditOpen}
          onClose={() => setIsAddEditOpen(false)}
          onSave={handleSaveAsset}
          assetToEdit={assetToEdit}
        />
      )}

      {/* Asset Dossier & Maintenance History Modal */}
      {selectedAssetForDetail && (
        <AssetDetailModal
          isOpen={!!selectedAssetForDetail}
          onClose={() => setSelectedAssetForDetail(null)}
          asset={selectedAssetForDetail}
          onEdit={(a) => {
            setSelectedAssetForDetail(null);
            handleOpenEdit(a);
          }}
          onDelete={(id) => {
            deleteAsset(id);
            setSelectedAssetForDetail(null);
            toastSuccess('Asset Deleted', 'Asset record has been permanently removed.');
          }}
          onRecordMaintenance={addAssetMaintenanceLog}
        />
      )}

      {/* Quick Record Maintenance Modal */}
      {selectedAssetForMaintenance && (
        <RecordMaintenanceModal
          isOpen={!!selectedAssetForMaintenance}
          onClose={() => setSelectedAssetForMaintenance(null)}
          asset={selectedAssetForMaintenance}
          onRecord={addAssetMaintenanceLog}
        />
      )}

      {/* Printable Audit Register Modal */}
      {isPrintRegisterOpen && (
        <PrintAssetRegisterModal
          isOpen={isPrintRegisterOpen}
          onClose={() => setIsPrintRegisterOpen(false)}
          assets={assets}
          settings={settings}
        />
      )}
    </div>
  );
};
