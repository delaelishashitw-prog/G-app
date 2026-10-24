import React, { useState } from "react";
import { useChurchData } from "../../contexts/ChurchDataContext";
import type { PledgeCampaign } from "../../types/database.types";
import { ghanaToday } from "../../lib/financeViewUtils";
import {
  PledgeDialog,
  pledgeFieldClass as field,
  pledgeButtonClass as button,
} from "./PledgeDialog";

export function CampaignManagerModal({
  isOpen,
  onClose,
  campaignToEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  campaignToEdit?: PledgeCampaign | null;
}) {
  const { addCampaign, updateCampaign, deleteCampaign, pledges } =
    useChurchData();
  const [id] = useState(() => campaignToEdit?.id || crypto.randomUUID()),
    [version] = useState(campaignToEdit?.updated_at);
  const [name, setName] = useState(campaignToEdit?.name || ""),
    [target, setTarget] = useState(String(campaignToEdit?.target_amount || "")),
    [start, setStart] = useState(campaignToEdit?.start_date || ghanaToday()),
    [end, setEnd] = useState(campaignToEdit?.end_date || "");
  const [description, setDescription] = useState(
      campaignToEdit?.description || "",
    ),
    [active, setActive] = useState(campaignToEdit?.is_active ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!isOpen) return null;
  const hasPledges = pledges.some((row) => row.campaign_id === id);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = {
        id,
        name: name.trim(),
        target_amount: Number(target),
        start_date: start,
        end_date: end,
        description: description.trim(),
        is_active: active,
      };
      if (campaignToEdit) await updateCampaign(id, data, version);
      else await addCampaign(data);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      busy ||
      !confirm(
        hasPledges
          ? "Archive this campaign? Existing pledges and payments will be preserved."
          : "Delete this unused campaign?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (hasPledges) await updateCampaign(id, { is_active: false }, version);
      else await deleteCampaign(id, version);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PledgeDialog
      title={campaignToEdit ? "Edit Campaign" : "New Campaign"}
      onClose={onClose}
      busy={busy}
      error={error}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-4">
          <label className="block">
            Campaign name
            <input
              className={field}
              required
              maxLength={300}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            Campaign target (GH₵)
            <input
              className={field}
              type="number"
              step="0.01"
              min="0.01"
              max="1000000000"
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
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
              End date
              <input
                className={field}
                type="date"
                required
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <div className="block">
            <label htmlFor="campaignmanagermodal-description">
              Description
            </label>
            <textarea
              id="campaignmanagermodal-description"
              className={field}
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active: accepts new commitments
          </label>
          <div className="flex flex-wrap justify-between gap-3">
            {campaignToEdit ? (
              <button type="button" className="text-rose-700" onClick={remove}>
                {hasPledges ? "Archive campaign" : "Delete unused campaign"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button className={button} type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save campaign"}
              </button>
            </div>
          </div>
        </fieldset>
      </form>
    </PledgeDialog>
  );
}
