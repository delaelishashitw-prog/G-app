import React, { useState } from 'react';
import { X, Check, Building, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {budgetPeriodRange} from '../../lib/budgetPeriod';
import {ghanaToday} from '../../lib/financeViewUtils';

export interface DepartmentBudget {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  lead: string;
  period?:string;
}

interface DepartmentBudgetModalProps {
  initialBudget?: DepartmentBudget | null;
  onSave: (budget: DepartmentBudget & {period:string}) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export const DepartmentBudgetModal: React.FC<DepartmentBudgetModalProps> = ({
  initialBudget,
  onSave,
  onDelete,
  onClose,
}) => {
  const { error } = useToast();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [form, setForm] = useState({
    name: initialBudget?.name || '',
    allocated: initialBudget ? initialBudget.allocated.toString() : '',
    lead: initialBudget?.lead || '',
    period:initialBudget?.period||`${ghanaToday().slice(0,4)} Annual`,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allocatedNum = Math.round(Number(form.allocated)*100)/100;
    if (!Number.isFinite(allocatedNum) || allocatedNum <= 0) {
      error('Invalid Budget Allocation', 'Please enter a valid positive allocation.');
      return;
    }

    if (!form.name.trim()) {
      error('Missing Name', 'Please provide a department or ministry name.');
      return;
    }
    if(!budgetPeriodRange(form.period)){error('Invalid Budget Period','Use a year (2026 Annual), quarter (Q1-2026) or month (2026-10).');return;}

    try{onSave({
      id: initialBudget?.id || crypto.randomUUID(),
      name: form.name.trim(),
      allocated: allocatedNum,
      spent: initialBudget?.spent || 0,
      lead: form.lead.trim() || 'Department Committee',
      period:form.period.trim(),
    });}catch(cause){error('Budget not recorded',(cause as Error).message);}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-800 rounded-lg">
              <Building className="w-4 h-4 text-purple-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">
                {initialBudget ? 'Adjust Department Budget' : 'Add Department Budget'}
              </h3>
              <p className="text-xs text-purple-200">Allocation and reporting period</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-purple-200 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label htmlFor="budget-department" className="block font-semibold text-slate-700 mb-1">
              Department / Ministry Name *
            </label>
            <input
              type="text"
              id="budget-department"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              placeholder="e.g. Media, Sound & Live-Streaming"
            />
          </div>

          <div>
            <label htmlFor="budget-allocation" className="block font-semibold text-slate-700 mb-1">
              Budget Allocation (GH₵) *
            </label>
            <input
              type="number"
              id="budget-allocation"
              step="0.01"
              min="0.01"
              required
              value={form.allocated}
              onChange={(e) => setForm({ ...form, allocated: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
              placeholder="5000.00"
            />
          </div>

          <label className="block font-semibold text-slate-700">Budget period
            <input aria-label="Budget period" type="text" required value={form.period} onChange={e=>setForm({...form,period:e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-lg p-2"/>
            <span className="block mt-1 font-normal text-slate-500">For example: 2026 Annual, Q1-2026 or 2026-10.</span>
          </label>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Department Lead / Steward
            </label>
            <input
              type="text"
              value={form.lead}
              onChange={(e) => setForm({ ...form, lead: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              placeholder="e.g. Bro. Emmanuel Boateng"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            {initialBudget && onDelete ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onDelete(initialBudget.id)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Delete Budget
                </button>
              )
            ) : <span />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{initialBudget ? 'Save Changes' : 'Create Budget'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
