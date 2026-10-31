import type { ChurchFinanceRecord, DepartmentBudget } from '../types/database.types';

export function budgetPeriodRange(period: string): { start: string; end: string; year: string } | null {
  const value=String(period||'').trim();
  const annual=value.match(/^(\d{4})(?:\s+Annual)?$/i);
  if(annual)return {start:`${annual[1]}-01-01`,end:`${annual[1]}-12-31`,year:annual[1]};
  const quarter=value.match(/^Q([1-4])[-\s](\d{4})$/i);
  if(quarter){const endMonth=Number(quarter[1])*3,year=quarter[2];return {start:`${year}-${String(endMonth-2).padStart(2,'0')}-01`,end:`${year}-${String(endMonth).padStart(2,'0')}-${new Date(Date.UTC(Number(year),endMonth,0)).getUTCDate()}`,year};}
  const month=value.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if(month)return {start:`${value}-01`,end:`${value}-${new Date(Date.UTC(Number(month[1]),Number(month[2]),0)).getUTCDate()}`,year:month[1]};
  return null;
}

export function recordMatchesBudget(record:ChurchFinanceRecord,budget:DepartmentBudget):boolean {
  const range=budgetPeriodRange(budget.period);
  const date=String(record.date||'').slice(0,10);
  if(!range || date<range.start || date>range.end || record.currency!==budget.currency)return false;
  const departmentMatches = record.department?.trim().toLowerCase() === budget.department.trim().toLowerCase();
  return budget.enforce_limit ? record.budget_id === budget.id || departmentMatches : record.budget_id ? record.budget_id === budget.id : departmentMatches;
}
