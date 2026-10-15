import type { ChurchFinanceRecord, ExpenseRecord } from '../types/database.types';
import { isActiveTransaction } from './ledgerUtils';

/** Include the current treasury ledger and retain legacy expense history once by record ID. */
export function reportExpenses(legacy:ExpenseRecord[],ledger:ChurchFinanceRecord[]):ExpenseRecord[] {
  const ledgerIds=new Set(ledger.map(row=>row.id));
  return [...legacy.filter(row=>!ledgerIds.has(row.id)&&isActiveTransaction(row as any)),
    ...ledger.filter(row=>isActiveTransaction(row)&&['expense','disbursement'].includes(row.transaction_type)).map(row=>({
      id:row.id,category:row.category,title:row.title,recipient:row.recipient_or_vendor,amount:row.amount,currency:row.currency,
      date:row.date,account:row.account_name,payment_method:row.payment_method as ExpenseRecord['payment_method'],reference_number:row.reference_no,
      description:row.description,notes:row.notes,recorded_by:row.recorded_by,created_at:row.created_at,
    }))];
}
