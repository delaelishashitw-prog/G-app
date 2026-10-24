import React, { useState } from "react";
import { useChurchData } from "../../contexts/ChurchDataContext";
import type { PledgeRecord } from "../../types/database.types";
import { formatGHS } from "../../lib/currencyUtils";
import {
  PledgeDialog,
  pledgeFieldClass as field,
  pledgeButtonClass as button,
} from "./PledgeDialog";

export function EditPledgeModal({
  isOpen,
  onClose,
  pledge,
}: {
  isOpen: boolean;
  onClose: () => void;
  pledge: PledgeRecord | null;
}) {
  const { updatePledge, deletePledge } = useChurchData();
  const [amount, setAmount] = useState(String(pledge?.amount_pledged || "")),
    [due, setDue] = useState(pledge?.due_date || ""),
    [notes, setNotes] = useState(pledge?.notes || "");
  const [version] = useState(pledge?.updated_at),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!isOpen || !pledge) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await updatePledge(
        pledge.id,
        {
          amount_pledged: Number(amount),
          due_date: due,
          notes: notes.trim(),
        },
        version,
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (busy || !confirm(`Delete the unpaid pledge for ${pledge.member_name}?`))
      return;
    setBusy(true);
    setError("");
    try {
      await deletePledge(pledge.id, version);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PledgeDialog
      title="Edit Pledge Commitment"
      onClose={onClose}
      busy={busy}
      error={error}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-4">
          <div className="rounded-lg bg-purple-50 p-3">
            <strong>{pledge.member_name}</strong>
            <p>{pledge.campaign_name}</p>
            <p>Confirmed collections: {formatGHS(pledge.amount_paid)}</p>
          </div>
          <label className="block">
            Pledged amount (GH₵)
            <input
              className={field}
              type="number"
              step="0.01"
              required
              min={Math.max(0.01, pledge.amount_paid)}
              max="1000000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block">
            Due date
            <input
              className={field}
              type="date"
              min={pledge.start_date}
              required
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <div className="block">
            <label htmlFor="editpledgemodal-pledge-notes">Pledge notes</label>
            <textarea
              id="editpledgemodal-pledge-notes"
              className={field}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <p className="text-xs text-slate-500">
            Collections are corrected through payment history. Saved payments
            and member identity are preserved.
          </p>
          <div className="flex flex-wrap justify-between gap-3">
            {!pledge.amount_paid && !pledge.payments?.length ? (
              <button className="text-rose-700" type="button" onClick={remove}>
                Delete unpaid pledge
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button className={button} type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </fieldset>
      </form>
    </PledgeDialog>
  );
}
