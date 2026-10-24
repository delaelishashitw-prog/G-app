import React, { useState } from "react";
import { useChurchData } from "../../contexts/ChurchDataContext";
import type { PledgeRecord } from "../../types/database.types";
import { formatGHS } from "../../lib/currencyUtils";
import { ghanaToday } from "../../lib/financeViewUtils";
import { pledgeDisplayStatus } from "../../features/pledges/pledgeStore";
import {
  PledgeDialog,
  pledgeFieldClass as field,
  pledgeButtonClass as button,
} from "./PledgeDialog";
import { pledgeCsv } from "../../features/pledges/pledgeExport";

export function PrintPledgesModal({
  isOpen,
  onClose,
  pledgesList,
}: {
  isOpen: boolean;
  onClose: () => void;
  pledgesList: PledgeRecord[];
}) {
  const { settings, campaigns } = useChurchData(),
    [campaign, setCampaign] = useState("all"),
    [status, setStatus] = useState("all");
  if (!isOpen) return null;
  const rows = pledgesList.filter(
      (row) =>
        (campaign === "all" || row.campaign_id === campaign) &&
        (status === "all" || pledgeDisplayStatus(row) === status),
    ),
    pending = rows.some((row) => row._sync_status === "pending");
  const download = () => {
    if (pending) return;
    const url = URL.createObjectURL(
        new Blob([pledgeCsv(rows)], { type: "text/csv;charset=utf-8;" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `Pledges_${ghanaToday()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <PledgeDialog title="Pledge Register" onClose={onClose} printable>
      <div className="space-y-4">
        <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="printpledgesmodal-campaign">Campaign</label>
            <select
              id="printpledgesmodal-campaign"
              className={field}
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            >
              <option value="all">All campaigns</option>
              {campaigns.map((row) => (
                <option value={row.id} key={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="printpledgesmodal-status">Status</label>
            <select
              id="printpledgesmodal-status"
              className={field}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {[
                "all",
                "active",
                "partially_paid",
                "completed",
                "overdue",
                "cancelled",
              ].map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <header>
          <p>{settings.church_name}</p>
          <h2 className="text-xl font-bold">Pledge register</h2>
          <p className="text-sm">
            As of {ghanaToday()} · {rows.length} commitments
          </p>
        </header>
        {pending && (
          <p role="status" className="rounded-lg bg-amber-50 p-3">
            Wait for cloud confirmation before printing or exporting this
            selection.
          </p>
        )}
        <div className="text-sm">
          Pledged:{" "}
          {formatGHS(rows.reduce((n, row) => n + row.amount_pledged, 0))} ·
          Collected:{" "}
          {formatGHS(rows.reduce((n, row) => n + row.amount_paid, 0))} ·
          Outstanding: {formatGHS(rows.reduce((n, row) => n + row.balance, 0))}
        </div>
        <div className="overflow-x-auto" data-pledge-print-content>
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {[
                  "Member / Campaign",
                  "Pledged",
                  "Collected",
                  "Outstanding",
                  "Due / Status",
                ].map((label) => (
                  <th className="border-b p-2" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border-b p-2">
                    {row.member_name}
                    <br />
                    {row.campaign_name}
                  </td>
                  <td className="border-b p-2">
                    {formatGHS(row.amount_pledged)}
                  </td>
                  <td className="border-b p-2">{formatGHS(row.amount_paid)}</td>
                  <td className="border-b p-2">{formatGHS(row.balance)}</td>
                  <td className="border-b p-2">
                    {row.due_date}
                    <br />
                    {pledgeDisplayStatus(row).replaceAll("_", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="no-print flex gap-3">
          <button
            className={button}
            disabled={pending}
            onClick={() => {
              if (!pending) window.print();
            }}
          >
            Print register
          </button>
          <button
            disabled={pending}
            className="disabled:opacity-50"
            onClick={download}
          >
            Download CSV
          </button>
        </div>
      </div>
    </PledgeDialog>
  );
}
