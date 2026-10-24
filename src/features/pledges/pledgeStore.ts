import type {
  GivingRecord,
  PaymentMethod,
  PledgeCampaign,
  PledgePayment,
  PledgeRecord,
} from "../../types/database.types";
import { ghanaToday } from "../../lib/financeViewUtils";

export const PLEDGE_WRITE_ROLES = [
  "super_admin",
  "senior_pastor",
  "finance_officer",
];
export type PledgeInput = Omit<
  PledgeRecord,
  | "balance"
  | "status"
  | "created_at"
  | "updated_at"
  | "payments"
  | "legacy_paid_amount"
  | "_sync_status"
>;
export interface PledgePaymentInput {
  id: string;
  date?: string;
  method?: PaymentMethod;
  channel?: string;
  reference?: string;
  notes?: string;
  syncWithGiving?: boolean;
  expectedVersion?: string;
  service_id?: string;
  service_name?: string;
}
export interface PledgePaymentResult {
  pledge: PledgeRecord;
  payment: PledgePayment;
  giving?: GivingRecord;
}

export function requireConfirmedPledge<
  T extends { updated_at?: string; _sync_status?: string },
>(row: T | undefined, expected?: string): T {
  if (!row)
    throw new Error("This record was not found. Refresh and try again.");
  if (row._sync_status === "pending")
    throw new Error(
      "This record is awaiting cloud confirmation. Sync before making another change.",
    );
  if (!row.updated_at)
    throw new Error("Refresh to load the current record version.");
  if (expected && row.updated_at !== expected)
    throw new Error(
      "This record changed while the form was open. Close and reopen the form.",
    );
  return row;
}
export function validatePledgeMoney(amount: number): void {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1e9 ||
    amount !== Math.round(amount * 100) / 100
  )
    throw new Error(
      "Enter an amount above zero with at most two decimal places.",
    );
}
export function validPledgeDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}
export function validateCampaign(row: PledgeCampaign): void {
  if (!row.name.trim() || row.name.trim().length > 300)
    throw new Error("Enter a campaign name of up to 300 characters.");
  validatePledgeMoney(row.target_amount);
  if (
    !validPledgeDate(row.start_date) ||
    !validPledgeDate(row.end_date) ||
    row.end_date < row.start_date
  )
    throw new Error("Campaign end date must be on or after its start.");
}
export function validatePledge(row: PledgeRecord): void {
  validatePledgeMoney(row.amount_pledged);
  if (row.amount_pledged < row.amount_paid)
    throw new Error(
      "The commitment cannot be lower than the amount already collected.",
    );
  if (
    !validPledgeDate(row.start_date || "") ||
    !validPledgeDate(row.due_date) ||
    row.due_date < row.start_date!
  )
    throw new Error("Pledge due date must be on or after its start.");
}
export function buildPledgePayment(
  pledge: PledgeRecord,
  amount: number,
  input: PledgePaymentInput,
  today = ghanaToday(),
): PledgePaymentResult {
  validatePledgeMoney(amount);
  if (
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
      input.id,
    )
  )
    throw new Error("Reopen the payment form to create a receipt ID.");
  if (pledge.status === "cancelled")
    throw new Error("Payments are closed for a cancelled pledge.");
  if (amount > pledge.balance)
    throw new Error("The payment exceeds the remaining pledge balance.");
  const date = input.date || today;
  if (
    !validPledgeDate(date) ||
    date > today ||
    date < (pledge.start_date || "")
  )
    throw new Error("Payment date must be between the pledge start and today.");
  if (
    (input.notes?.length || 0) > 1000 ||
    (input.reference?.length || 0) > 200 ||
    (input.channel?.length || 0) > 200
  )
    throw new Error("Payment reference, channel or notes are too long.");
  const sync = Boolean(input.syncWithGiving),
    givingId = sync ? `pledge-${input.id}` : undefined;
  const payment: PledgePayment = {
    id: input.id,
    amount,
    date,
    payment_method: input.method || "cash",
    payment_channel: input.channel || "",
    transaction_reference: input.reference || "",
    notes: input.notes || "",
    sync_with_giving: sync,
    ...(givingId ? { giving_id: givingId } : {}),
    status: "completed",
  };
  const giving: GivingRecord | undefined = givingId
    ? {
        id: givingId,
        member_id: pledge.member_id,
        member_name: pledge.member_name,
        donor_name: pledge.member_name,
        category: "Building Fund",
        amount,
        currency: "GHS",
        date,
        payment_method: payment.payment_method,
        payment_channel: payment.payment_channel,
        reference_number: payment.transaction_reference,
        notes: payment.notes,
        pledge_id: pledge.id,
        pledge_campaign_name: pledge.campaign_name,
        status: "completed",
        created_at: new Date().toISOString(),
        ...(input.service_id
          ? { service_id: input.service_id, service_name: input.service_name }
          : {}),
      }
    : undefined;
  // Financial totals retain their last cloud-confirmed values until the atomic batch is acknowledged.
  return {
    pledge: { ...pledge, payments: [...(pledge.payments || []), payment] },
    payment,
    giving,
  };
}
export function pledgeOverdue(
  pledge: Pick<PledgeRecord, "balance" | "due_date" | "status">,
  today = ghanaToday(),
): boolean {
  return (
    pledge.status !== "cancelled" &&
    pledge.balance > 0 &&
    Boolean(pledge.due_date) &&
    pledge.due_date < today
  );
}
export function pledgeDisplayStatus(
  pledge: PledgeRecord,
  today = ghanaToday(),
): string {
  return pledgeOverdue(pledge, today) ? "overdue" : pledge.status;
}
export function pledgeLegacyPaid(pledge: PledgeRecord): number {
  return (
    pledge.legacy_paid_amount ??
    Math.max(
      0,
      pledge.amount_paid -
        (pledge.payments || [])
          .filter((p) => p.status === "completed" && p.recorded_at)
          .reduce((sum, p) => sum + p.amount, 0),
    )
  );
}
