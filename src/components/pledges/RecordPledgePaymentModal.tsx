import React, { useState } from "react";
import { useChurchData } from "../../contexts/ChurchDataContext";
import { ghanaToday } from "../../lib/financeViewUtils";
import { formatGHS } from "../../lib/currencyUtils";
import type { PledgeRecord } from "../../types/database.types";
import type { PledgePaymentInput } from "../../features/pledges/pledgeStore";
import {
  PledgeDialog,
  pledgeFieldClass as field,
  pledgeButtonClass as button,
} from "./PledgeDialog";
import { PledgePaymentFields } from "./PledgePaymentFields";

export function RecordPledgePaymentModal({
  isOpen,
  onClose,
  pledge,
}: {
  isOpen: boolean;
  onClose: () => void;
  pledge: PledgeRecord | null;
}) {
  const { recordPledgePayment } = useChurchData();
  const [amount, setAmount] = useState(""),
    [details, setDetails] = useState<PledgePaymentInput>(() => ({
      id: crypto.randomUUID(),
      date: ghanaToday(),
      method: "cash",
      syncWithGiving: true,
      expectedVersion: pledge?.updated_at,
    }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!isOpen || !pledge) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await recordPledgePayment(pledge.id, Number(amount), details);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PledgeDialog
      title="Record Pledge Payment"
      onClose={onClose}
      busy={busy}
      error={error}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-4">
          <div className="rounded-lg bg-purple-50 p-3">
            <strong>{pledge.member_name}</strong>
            <p>{pledge.campaign_name}</p>
            <p>Confirmed outstanding: {formatGHS(pledge.balance)}</p>
          </div>
          <label className="block">
            Payment amount (GH₵)
            <input
              className={field}
              type="number"
              step="0.01"
              min="0.01"
              max={pledge.balance}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <PledgePaymentFields
            value={details}
            onChange={setDetails}
            minDate={pledge.start_date}
            maxDate={ghanaToday()}
          />
          <p className="text-xs text-slate-500">
            The receipt and balance become confirmed when this change reaches
            the cloud. Keep this form open if saving fails.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className={button} type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save payment"}
            </button>
          </div>
        </fieldset>
      </form>
    </PledgeDialog>
  );
}
