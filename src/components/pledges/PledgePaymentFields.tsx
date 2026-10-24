import type { PledgePaymentInput } from "../../features/pledges/pledgeStore";
import type { PaymentMethod } from "../../types/database.types";
import { pledgeFieldClass as field } from "./PledgeDialog";

export function PledgePaymentFields({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: PledgePaymentInput;
  onChange: (value: PledgePaymentInput) => void;
  minDate?: string;
  maxDate: string;
}) {
  const update = (patch: Partial<PledgePaymentInput>) =>
    onChange({ ...value, ...patch });
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          Payment date
          <input
            className={field}
            type="date"
            required
            min={minDate}
            max={maxDate}
            value={value.date || ""}
            onChange={(e) => update({ date: e.target.value })}
          />
        </label>
        <div>
          <label htmlFor="pledgepaymentfields-payment-method">
            Payment method
          </label>
          <select
            id="pledgepaymentfields-payment-method"
            className={field}
            value={value.method || "cash"}
            onChange={(e) =>
              update({ method: e.target.value as PaymentMethod })
            }
          >
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile money</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <label className="block">
        Channel / provider
        <input
          className={field}
          maxLength={200}
          value={value.channel || ""}
          onChange={(e) => update({ channel: e.target.value })}
          placeholder="e.g. MTN MoMo"
        />
      </label>
      <label className="block">
        Transaction reference
        <input
          className={field}
          maxLength={200}
          value={value.reference || ""}
          onChange={(e) => update({ reference: e.target.value })}
        />
      </label>
      <div>
        <label htmlFor={`payment-notes-${value.id}`} className="block">
          Payment notes
        </label>
        <textarea
          id={`payment-notes-${value.id}`}
          className={field}
          maxLength={1000}
          rows={2}
          value={value.notes || ""}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </div>
      <label className="flex items-start gap-2 rounded-lg bg-purple-50 p-3">
        <input
          type="checkbox"
          checked={Boolean(value.syncWithGiving)}
          onChange={(e) => update({ syncWithGiving: e.target.checked })}
        />
        <span>
          Include this payment in the Giving ledger.
          <span className="block text-xs text-slate-600">
            Every payment has a pledge receipt, with or without a Giving entry.
          </span>
        </span>
      </label>
    </>
  );
}
