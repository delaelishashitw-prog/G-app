import type { PledgeRecord } from "../../types/database.types";
import { pledgeDisplayStatus } from "./pledgeStore";
export function pledgeCsv(rows: readonly PledgeRecord[]): string {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const data: unknown[][] = [
    [
      "Member Name",
      "Phone",
      "Campaign",
      "Pledged (GHS)",
      "Paid (GHS)",
      "Balance (GHS)",
      "Start Date",
      "Due Date",
      "Status",
      "Notes",
    ],
  ];
  rows.forEach((row) =>
    data.push([
      row.member_name,
      row.member_phone,
      row.campaign_name,
      row.amount_pledged.toFixed(2),
      row.amount_paid.toFixed(2),
      row.balance.toFixed(2),
      row.start_date,
      row.due_date,
      pledgeDisplayStatus(row),
      row.notes,
    ]),
  );
  return "\uFEFF" + data.map((row) => row.map(cell).join(",")).join("\r\n");
}
