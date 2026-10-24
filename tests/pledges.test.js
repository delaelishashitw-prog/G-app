import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPledgePayment,
  requireConfirmedPledge,
  validatePledge,
  validateCampaign,
  pledgeOverdue,
  pledgeLegacyPaid,
} from "../src/features/pledges/pledgeStore.ts";
import { pledgeCsv } from "../src/features/pledges/pledgeExport.ts";
const pledge = {
  id: "synthetic",
  campaign_id: "campaign",
  member_id: "synthetic-member",
  member_name: "Synthetic Member",
  campaign_name: "Synthetic campaign",
  amount_pledged: 100,
  amount_paid: 20,
  balance: 80,
  status: "partially_paid",
  start_date: "2026-01-01",
  due_date: "2026-10-24",
  created_at: "2026-01-01T12:00:00Z",
  updated_at: "2026-10-23T12:00:00.123456+00:00",
};
const input = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  date: "2026-10-24",
  method: "mobile_money",
  channel: "MTN MoMo",
  reference: "SYNTHETIC-123",
  notes: "Synthetic installment",
  syncWithGiving: true,
};
test("pledge payments preserve confirmed totals until cloud acknowledgment and link exactly one matching Giving receipt", () => {
  const result = buildPledgePayment(pledge, 10.05, input, "2026-10-24");
  assert.equal(result.pledge.amount_paid, 20);
  assert.equal(result.pledge.balance, 80);
  assert.equal(result.payment.amount, 10.05);
  assert.equal(result.payment.recorded_at, undefined);
  assert.equal(result.payment.notes, input.notes);
  assert.equal(result.giving.notes, input.notes);
  assert.equal(result.giving.pledge_id, pledge.id);
  assert.equal(result.payment.giving_id, result.giving.id);
  assert.equal(result.giving.amount, result.payment.amount);
  assert.equal(
    buildPledgePayment(pledge, 10, input, "2026-10-24").giving.id,
    result.giving.id,
    "retry preserves receipt ID",
  );
  const separate = buildPledgePayment(
    pledge,
    10,
    { ...input, syncWithGiving: false },
    "2026-10-24",
  );
  assert.equal(separate.giving, undefined);
  assert.equal(separate.payment.amount, 10);
  assert.equal(separate.pledge.payments.length, 1);
});
test("pledge money, date and version guards reject stale, pending, invalid and overpaid changes", () => {
  for (const amount of [0, -1, NaN, Infinity, 80.01, 1.001])
    assert.throws(() =>
      buildPledgePayment(pledge, amount, input, "2026-10-24"),
    );
  for (const date of ["2026-02-30", "2025-12-31", "2026-10-25"])
    assert.throws(() =>
      buildPledgePayment(pledge, 1, { ...input, date }, "2026-10-24"),
    );
  assert.throws(() =>
    buildPledgePayment(
      { ...pledge, status: "cancelled" },
      1,
      input,
      "2026-10-24",
    ),
  );
  assert.throws(
    () => requireConfirmedPledge({ ...pledge, _sync_status: "pending" }),
    /awaiting cloud/,
  );
  assert.throws(
    () => requireConfirmedPledge(pledge, "old-version"),
    /changed while/,
  );
  assert.equal(requireConfirmedPledge(pledge, pledge.updated_at), pledge);
  assert.throws(() => validatePledge({ ...pledge, amount_pledged: 19 }));
  assert.throws(() => validatePledge({ ...pledge, due_date: "2025-12-31" }));
  assert.throws(() =>
    validateCampaign({
      name: "Synthetic",
      target_amount: 10,
      start_date: "2026-10-24",
      end_date: "2026-10-23",
    }),
  );
});
test("Ghana pledge due dates, honest historical totals and CSV formula protection remain consistent", () => {
  assert.equal(pledgeOverdue(pledge, "2026-10-24"), false);
  assert.equal(pledgeOverdue(pledge, "2026-10-25"), true);
  assert.equal(
    pledgeOverdue({ ...pledge, status: "cancelled" }, "2026-10-25"),
    false,
  );
  assert.equal(pledgeLegacyPaid(pledge), 20);
  assert.equal(
    pledgeLegacyPaid({
      ...pledge,
      legacy_paid_amount: 20,
      payments: [{ amount: 10, status: "completed" }],
    }),
    20,
  );
  const csv = pledgeCsv([
    {
      ...pledge,
      member_name: ' =HYPERLINK("x")',
      notes: 'first\nsecond,"quoted"',
      member_phone: "+233240000000",
      campaign_name: "@sum(1)",
    },
  ]);
  assert.match(csv, /"' =HYPERLINK\(""x""\)"/);
  assert.match(csv, /"'\+233240000000"/);
  assert.match(csv, /"'@sum\(1\)"/);
  assert.ok(csv.includes('first\nsecond,""quoted""'));
});
