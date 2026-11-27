import type { WelfareClaim, WelfareContribution } from '../../types/database.types';
import { buildCsv } from '../../lib/financeViewUtils';

/** Keep welfare exports machine-readable and safe to open in spreadsheet software. */
export function welfareClaimsCsv(claims: WelfareClaim[]): string {
  const headers = [
    'Claim ID', 'Date Submitted', 'Member Name', 'Phone', 'Category',
    'Emergency Level', 'Title', 'Amount Requested (GHS)',
    'Amount Approved (GHS)', 'Status', 'Disbursement Voucher',
  ];
  const rows = claims.map(claim => [
    claim.claim_number,
    claim.date_submitted,
    claim.member_name,
    claim.member_phone || '',
    claim.category,
    claim.emergency_level,
    claim.title,
    claim.amount_requested.toFixed(2),
    (claim.amount_approved || 0).toFixed(2),
    claim.status,
    claim.disbursement_voucher_no || '',
  ]);
  return buildCsv([headers, ...rows]);
}

export function welfareDuesCsv(dues: WelfareContribution[]): string {
  const headers = [
    'Receipt Ref', 'Date', 'Member Name', 'Tithe No', 'Month Applicable',
    'Payment Channel', 'Amount (GHS)', 'Recorded By',
  ];
  const rows = dues.map(due => [
    due.reference_no || '',
    due.date,
    due.member_name,
    due.tithe_number || '',
    due.month,
    due.payment_channel || due.payment_method,
    due.amount.toFixed(2),
    due.recorded_by,
  ]);
  return buildCsv([headers, ...rows]);
}
