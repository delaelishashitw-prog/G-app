import React, { useState } from "react";
import { useChurchData } from "../../contexts/ChurchDataContext";
import { useGivingChannels } from "../../hooks/useGivingChannels";
import { givingInstructions } from "../../lib/givingChannels";
import { formatGHS, cleanGhanaPhone } from "../../lib/currencyUtils";
import {
  pledgeDisplayStatus,
  pledgeLegacyPaid,
} from "../../features/pledges/pledgeStore";
import type { PledgeRecord } from "../../types/database.types";
import {
  PledgeDialog,
  pledgeFieldClass as field,
  pledgeButtonClass as button,
} from "./PledgeDialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pledge: PledgeRecord | null;
  onOpenPaymentModal: (row: PledgeRecord) => void;
  onOpenEditModal: (row: PledgeRecord) => void;
}
export function PledgeDossierModal({
  isOpen,
  onClose,
  pledge: selection,
  onOpenPaymentModal,
  onOpenEditModal,
}: Props) {
  const { pledges, members, settings, voidPledgePayment } = useChurchData();
  const { channels } = useGivingChannels(isOpen);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [voidId, setVoidId] = useState(""),
    [reason, setReason] = useState(""),
    [copied, setCopied] = useState(false),
    [voidVersion, setVoidVersion] = useState<string>();
  if (!isOpen || !selection) return null;
  const pledge = pledges.find((row) => row.id === selection.id);
  if (!pledge)
    return (
      <PledgeDialog title="Pledge unavailable" onClose={onClose}>
        <p>This pledge is no longer available. Refresh the register.</p>
      </PledgeDialog>
    );
  const pending = pledge._sync_status === "pending",
    payments = pledge.payments || [],
    legacy = pledgeLegacyPaid(pledge),
    member = members.find((row) => row.id === pledge.member_id),
    phone = cleanGhanaPhone(pledge.member_phone || member?.phone || "");
  const message = `Hello ${pledge.member_name},\n\n${settings.church_name}: a reminder about your pledge for ${pledge.campaign_name}.\nPledged: ${formatGHS(pledge.amount_pledged)}\nCollected: ${formatGHS(pledge.amount_paid)}\nOutstanding: ${formatGHS(pledge.balance)}\nDue: ${pledge.due_date}\n\n${givingInstructions(channels)}`;
  const copy = async () => {
    try {
      if (pending)
        throw new Error("Wait for cloud confirmation before sharing.");
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const submitVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await voidPledgePayment(pledge.id, voidId, reason, voidVersion);
      setVoidId("");
      setReason("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PledgeDialog
      title="Pledge Statement & Payment History"
      onClose={onClose}
      busy={busy}
      error={error}
      printable
    >
      <div className="space-y-5">
        <header>
          <p className="text-sm text-slate-500">{settings.church_name}</p>
          <h2 className="text-xl font-bold">Pledge statement</h2>
          <p className="font-semibold">{pledge.member_name}</p>
          <p>{pledge.campaign_name}</p>
          <p className="text-sm capitalize">
            Status: {pledgeDisplayStatus(pledge).replaceAll("_", " ")} · Due:{" "}
            {pledge.due_date}
          </p>
        </header>
        {pending && (
          <p
            role="status"
            className="rounded-lg bg-amber-50 p-3 text-amber-900"
          >
            Awaiting cloud confirmation. Collected totals show the last
            confirmed balance; sharing and printing are paused.
          </p>
        )}
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Pledged", pledge.amount_pledged],
            ["Collected", pledge.amount_paid],
            ["Outstanding", pledge.balance],
          ].map(([label, amount]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3">
              <dt>{label}</dt>
              <dd className="font-bold">{formatGHS(Number(amount))}</dd>
            </div>
          ))}
        </dl>
        {pledge.notes && <p className="whitespace-pre-wrap">{pledge.notes}</p>}
        <section>
          <h3 className="font-bold">Payment history</h3>
          {legacy > 0 && (
            <p className="my-3 rounded-lg bg-slate-50 p-3">
              Earlier collections: {formatGHS(legacy)}. This historical total
              has no itemized receipts in the app.
            </p>
          )}
          {!payments.length && (
            <p className="my-3 text-slate-500">
              No itemized pledge payments have been recorded.
            </p>
          )}
          <ol className="space-y-3">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="break-inside-avoid rounded-lg border p-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{formatGHS(payment.amount)}</strong>
                  <span>
                    {payment.date} ·{" "}
                    {payment.status === "voided"
                      ? payment.voided_at
                        ? "Voided"
                        : "Void awaiting confirmation"
                      : payment.recorded_at
                        ? "Confirmed"
                        : "Awaiting cloud confirmation"}
                  </span>
                </div>
                <p className="break-all text-xs text-slate-500">
                  {payment.receipt_no || `Pending receipt ${payment.id}`}
                </p>
                <p className="text-sm">
                  {payment.payment_method.replaceAll("_", " ")}
                  {payment.payment_channel
                    ? ` · ${payment.payment_channel}`
                    : ""}
                </p>
                {payment.transaction_reference && (
                  <p className="break-all text-sm">
                    Reference: {payment.transaction_reference}
                  </p>
                )}
                {payment.notes && (
                  <p className="whitespace-pre-wrap text-sm">{payment.notes}</p>
                )}
                <p className="text-xs text-slate-500">
                  {payment.sync_with_giving
                    ? "Linked to the Giving ledger"
                    : "Pledge receipt only"}
                  {payment.recorded_by
                    ? ` · Recorded by ${payment.recorded_by}`
                    : ""}
                </p>
                {payment.void_reason && (
                  <p className="text-sm text-rose-700">
                    Void reason: {payment.void_reason}
                  </p>
                )}
                {payment.status === "completed" && payment.recorded_at && (
                  <button
                    type="button"
                    className="no-print mt-2 text-sm text-rose-700 disabled:opacity-50"
                    disabled={pending || busy}
                    onClick={() => {
                      setVoidId(payment.id);
                      setVoidVersion(pledge.updated_at);
                      setReason("");
                    }}
                  >
                    Void payment
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
        {voidId && (
          <form
            onSubmit={submitVoid}
            className="no-print space-y-3 rounded-lg bg-rose-50 p-3"
          >
            <div className="block">
              <label htmlFor="pledgedossiermodal-reason-for-voiding-this-payment">
                Reason for voiding this payment
              </label>
              <textarea
                id="pledgedossiermodal-reason-for-voiding-this-payment"
                className={field}
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              />
            </div>
            <p className="text-xs">
              The receipt remains in history. Its Giving entry, if present, is
              voided in the same change.
            </p>
            <button className={button} disabled={busy || pending} type="submit">
              {busy ? "Saving…" : "Confirm void"}
            </button>
            <button
              className="ml-3"
              disabled={busy}
              type="button"
              onClick={() => setVoidId("")}
            >
              Cancel
            </button>
          </form>
        )}
        {pledge.balance > 0 && pledge.status !== "cancelled" && (
          <section className="no-print space-y-2">
            <h3 className="font-bold">Reminder draft</h3>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">
              {message}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                className="disabled:opacity-50"
                onClick={copy}
              >
                {copied ? "Copied" : "Copy reminder"}
              </button>
              {phone && !pending && (
                <a
                  className="text-emerald-700"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                >
                  Review in WhatsApp
                </a>
              )}
            </div>
          </section>
        )}
        <div className="no-print flex flex-wrap gap-3 border-t pt-4">
          <button
            disabled={pending}
            className="disabled:opacity-50"
            onClick={() => {
              if (!pending) window.print();
            }}
          >
            Print statement
          </button>
          <button
            disabled={pending}
            className="disabled:opacity-50"
            onClick={() => {
              onClose();
              onOpenEditModal(pledge);
            }}
          >
            Edit pledge
          </button>
          {pledge.balance > 0 && pledge.status !== "cancelled" && (
            <button
              className={button}
              disabled={pending}
              onClick={() => {
                onClose();
                onOpenPaymentModal(pledge);
              }}
            >
              Record payment
            </button>
          )}
        </div>
      </div>
    </PledgeDialog>
  );
}
