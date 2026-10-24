import React, { useState } from "react";
import { useChurchData } from "../../contexts/ChurchDataContext";
import { ghanaToday } from "../../lib/financeViewUtils";
import type { PledgePaymentInput } from "../../features/pledges/pledgeStore";
import {
  PledgeDialog,
  pledgeFieldClass as field,
  pledgeButtonClass as button,
} from "./PledgeDialog";
import { PledgePaymentFields } from "./PledgePaymentFields";

export function AddPledgeModal({
  isOpen,
  onClose,
  preselectedCampaignId,
  preselectedMemberId,
}: {
  isOpen: boolean;
  onClose: () => void;
  preselectedCampaignId?: string;
  preselectedMemberId?: string;
}) {
  const { members, campaigns, createPledge } = useChurchData();
  const [id] = useState(() => crypto.randomUUID()),
    [search, setSearch] = useState(""),
    [memberId, setMember] = useState(preselectedMemberId || ""),
    [campaignId, setCampaign] = useState(preselectedCampaignId || "");
  const [amount, setAmount] = useState(""),
    [start, setStart] = useState(ghanaToday),
    [due, setDue] = useState(""),
    [notes, setNotes] = useState("");
  const [deposit, setDeposit] = useState(false),
    [depositAmount, setDepositAmount] = useState(""),
    [details, setDetails] = useState<PledgePaymentInput>(() => ({
      id: crypto.randomUUID(),
      date: ghanaToday(),
      method: "cash",
      syncWithGiving: true,
    }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!isOpen) return null;
  const activeCampaigns = campaigns.filter(
      (row) => row.is_active && !row._sync_status,
    ),
    people = members.filter(
      (row) =>
        !row.is_archived && !["deceased", "transferred"].includes(row.status),
    );
  const visiblePeople = people.filter((row) =>
    `${row.first_name} ${row.last_name} ${row.member_id} ${row.phone || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const person = people.find((row) => row.id === memberId),
        campaign = activeCampaigns.find((row) => row.id === campaignId);
      if (!person || !campaign)
        throw new Error("Choose an active saved member and campaign.");
      await createPledge(
        {
          id,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          member_id: person.id,
          member_name: `${person.first_name} ${person.last_name}`,
          amount_pledged: Number(amount),
          amount_paid: 0,
          start_date: start,
          due_date: due,
          notes: notes.trim(),
        },
        deposit ? { amount: Number(depositAmount), details } : undefined,
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PledgeDialog
      title="Record New Pledge"
      onClose={onClose}
      busy={busy}
      error={error}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-4">
          {!activeCampaigns.length && (
            <p className="rounded-lg bg-amber-50 p-3">
              Create a campaign with New Campaign, then wait for cloud
              confirmation before adding pledges.
            </p>
          )}
          <label className="block">
            Find member
            <input
              className={field}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, membership number or phone"
            />
          </label>
          <div className="block">
            <label htmlFor="addpledgemodal-member">Member</label>
            <select
              id="addpledgemodal-member"
              className={field}
              required
              value={memberId}
              onChange={(e) => setMember(e.target.value)}
            >
              <option value="">Select member</option>
              {people
                .filter(
                  (row) => row.id === memberId || visiblePeople.includes(row),
                )
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.first_name} {row.last_name} ({row.member_id})
                  </option>
                ))}
            </select>
          </div>
          <div className="block">
            <label htmlFor="addpledgemodal-campaign">Campaign</label>
            <select
              id="addpledgemodal-campaign"
              className={field}
              required
              value={campaignId}
              onChange={(e) => {
                setCampaign(e.target.value);
                setDue(
                  activeCampaigns.find((row) => row.id === e.target.value)
                    ?.end_date || "",
                );
              }}
            >
              <option value="">Select campaign</option>
              {activeCampaigns.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <label className="block">
            Pledged amount (GH₵)
            <input
              className={field}
              type="number"
              step="0.01"
              min="0.01"
              max="1000000000"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              Start date
              <input
                className={field}
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Due date
              <input
                className={field}
                type="date"
                required
                min={start}
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          </div>
          <div className="block">
            <label htmlFor="addpledgemodal-pledge-notes">Pledge notes</label>
            <textarea
              id="addpledgemodal-pledge-notes"
              className={field}
              maxLength={1000}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={deposit}
              onChange={(e) => setDeposit(e.target.checked)}
            />
            Record an initial payment
          </label>
          {deposit && (
            <div className="space-y-3 rounded-xl border p-3">
              <label className="block">
                Initial payment (GH₵)
                <input
                  className={field}
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={amount || undefined}
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </label>
              <PledgePaymentFields
                value={details}
                onChange={setDetails}
                minDate={start}
                maxDate={ghanaToday()}
              />
            </div>
          )}
          <p className="text-xs text-slate-500">
            Changes are saved on this device first. Collected totals update
            after cloud confirmation.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className={button}
              type="submit"
              disabled={busy || !activeCampaigns.length}
            >
              {busy ? "Saving…" : "Save pledge"}
            </button>
          </div>
        </fieldset>
      </form>
    </PledgeDialog>
  );
}
