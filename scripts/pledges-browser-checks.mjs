import assert from "node:assert/strict";
import { initialSettings, sampleMembers } from "../src/lib/initialData.ts";
import { waitForSync, watchSyncStatus } from "./sync-browser-utils.mjs";

export async function checkPledges(browser, { origin }) {
  const owner = "71717171-7171-4171-8171-717171717171",
    now = new Date().toISOString(),
    today = now.slice(0, 10);
  async function setup(width = 1440, timeZone = "Africa/Accra") {
    const profile = {
      id: owner,
      email: "pledges@example.test",
      first_name: "Synthetic",
      last_name: "Reviewer",
      role: "super_admin",
      is_active: true,
      has_login_account: true,
      authorization_reviewed_at: now,
    };
    const user = {
      id: owner,
      email: profile.email,
      email_confirmed_at: now,
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: {},
    };
    const exp = Math.floor(Date.now() / 1000) + 3600,
      token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, role: "authenticated", aal: "aal2", session_id: owner, exp })).toString("base64url")}.synthetic-signature`;
    const session = {
      user,
      access_token: token,
      refresh_token: "synthetic-pledge-refresh",
      expires_at: exp,
      expires_in: 3600,
      token_type: "bearer",
    };
    const data = {
      settings: [{ id: "gwcc_global_settings", ...initialSettings }],
      members: [
        {
          ...sampleMembers[0],
          id: "pledge-member",
          member_id: "GWCC-PLG-TEST",
          first_name: "Synthetic",
          last_name: "Partner",
          status: "active",
          is_archived: false,
          auth_user_id: null,
        },
      ],
      pledge_campaigns: [
        {
          id: "pledge-campaign",
          name: "Synthetic campaign",
          target_amount: 1000,
          start_date: "2026-01-01",
          end_date: "2099-12-31",
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ],
      pledges: [
        {
          id: "pledge-one",
          campaign_id: "pledge-campaign",
          campaign_name: "Synthetic campaign",
          member_id: "pledge-member",
          member_name: "Synthetic Partner",
          member_phone: "0240000001",
          amount_pledged: 100,
          amount_paid: 20,
          balance: 80,
          status: "partially_paid",
          start_date: "2026-01-01",
          due_date: today,
          created_at: now,
          updated_at: now,
          payments: [],
        },
      ],
      giving: [
        {
          id: "unrelated-gift",
          member_id: "pledge-member",
          member_name: "Synthetic Partner",
          amount: 999,
          currency: "GHS",
          category: "Building Fund",
          payment_method: "cash",
          date: today,
          notes: "UNRELATED SYNTHETIC BUILDING DONATION",
          status: "completed",
          created_at: now,
          updated_at: now,
        },
      ],
    };
    const context = await browser.newContext({
        viewport: { width, height: 1000 },
        timezoneId: timeZone,
        reducedMotion: "reduce",
      }),
      requests = [],
      errors = [];
    let reject = false;
    await context.addInitScript(watchSyncStatus);
    await context.addInitScript(
      ({ session }) => {
        localStorage.setItem(
          "gwcc_supabase_url",
          "https://gwcc-e2e.supabase.co",
        );
        localStorage.setItem("gwcc_supabase_anon_key", "synthetic-public-key");
        localStorage.setItem("gwcc-church-auth-token", JSON.stringify(session));
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (window.__FAIL_PLEDGE_STORAGE__ && this.name === "outboxes")
            throw new DOMException(
              "Synthetic pledge storage full",
              "QuotaExceededError",
            );
          return put.apply(this, args);
        };
      },
      { session },
    );
    await context.route("https://gwcc-e2e.supabase.co/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        headers = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "content-type": "application/json",
        };
      if (req.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      let result = [];
      if (url.pathname === "/auth/v1/user") result = user;
      else if (url.pathname === "/auth/v1/token") result = session;
      else if (url.pathname === "/rest/v1/rpc/gwcc_security_status")
        result = {
          role: "super_admin",
          required: true,
          verified_factors: 1,
          satisfied: true,
        };
      else if (url.pathname === "/rest/v1/profiles")
        result = req.headers().accept?.includes("vnd.pgrst.object")
          ? profile
          : [profile];
      else if (url.pathname === "/rest/v1/rpc/gwcc_apply_mutations") {
        const body = req.postDataJSON();
        requests.push(body);
        if (reject) {
          await route.fulfill({
            status: 503,
            headers,
            body: JSON.stringify({
              message: "Synthetic pledge cloud unavailable",
            }),
          });
          return;
        }
        result = body.p_changes
          .filter((c) => c.table !== "audit_logs")
          .map((c) => {
            if (c.operation === "delete") {
              data[c.table] = (data[c.table] || []).filter(
                (r) => r.id !== c.id,
              );
              return { table: c.table, id: c.id, deleted: true };
            }
            const old = (data[c.table] || []).find((r) => r.id === c.id),
              record = { ...c.record, updated_at: new Date().toISOString() };
            if (c.table === "pledges") {
              record.legacy_paid_amount =
                old?.legacy_paid_amount ?? old?.amount_paid ?? 0;
              record.payments = (record.payments || []).map((r) => ({
                ...r,
                receipt_no: `PLG-${r.id}`,
                recorded_at: r.recorded_at || new Date().toISOString(),
                recorded_by: "Synthetic Reviewer",
                recorded_by_id: owner,
                ...(r.status === "voided"
                  ? { voided_at: new Date().toISOString(), voided_by_id: owner }
                  : {}),
              }));
              record.amount_paid =
                record.legacy_paid_amount +
                record.payments
                  .filter((r) => r.status === "completed")
                  .reduce((n, r) => n + r.amount, 0);
              record.balance = record.amount_pledged - record.amount_paid;
              record.status =
                record.balance === 0
                  ? "completed"
                  : record.status === "cancelled"
                    ? "cancelled"
                    : record.amount_paid
                      ? "partially_paid"
                      : "active";
            }
            data[c.table] = [
              record,
              ...(data[c.table] || []).filter((r) => r.id !== record.id),
            ];
            return { table: c.table, record };
          });
      } else if (url.pathname.startsWith("/rest/v1/")) {
        const rows = data[url.pathname.split("/").at(-1)] || [];
        result = rows.slice(
          Number(url.searchParams.get("offset") || 0),
          Number(url.searchParams.get("offset") || 0) +
            Number(url.searchParams.get("limit") || 500),
        );
      }
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(result),
      });
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/pledges");
    await page
      .getByRole("button", { name: "Record Pledge", exact: true })
      .waitFor();
    await page
      .getByRole("cell", { name: "Synthetic campaign", exact: true })
      .waitFor();
    return {
      page,
      context,
      data,
      requests,
      errors,
      rejectWrites: (value) => {
        reject = value;
      },
    };
  }
  const app = await setup();
  try {
    const { page } = app,
      dossier = () =>
        page.getByRole("dialog", {
          name: "Pledge Statement & Payment History",
          exact: true,
        }),
      payment = () =>
        page.getByRole("dialog", {
          name: "Record Pledge Payment",
          exact: true,
        });
    await page.getByTitle("View Pledge Dossier", { exact: true }).click();
    await dossier()
      .getByText("Earlier collections:", { exact: false })
      .waitFor();
    assert.equal(
      await dossier()
        .getByText("UNRELATED SYNTHETIC BUILDING DONATION", { exact: true })
        .count(),
      0,
    );
    await dossier()
      .getByRole("button", { name: "Record payment", exact: true })
      .click();
    await payment()
      .getByLabel("Payment amount (GH₵)", { exact: true })
      .fill("10");
    await payment()
      .getByLabel("Payment notes", { exact: true })
      .fill("SYNTHETIC PLEDGE ONLY NOTE");
    await payment().getByRole("checkbox").uncheck();
    await page.evaluate(() => {
      window.__FAIL_PLEDGE_STORAGE__ = true;
    });
    await payment()
      .getByRole("button", { name: "Save payment", exact: true })
      .click();
    await payment()
      .getByRole("alert")
      .filter({ hasText: /storage|preserve/ })
      .waitFor();
    assert.equal(app.requests.length, 0);
    assert.equal(
      await payment().getByLabel("Payment notes", { exact: true }).inputValue(),
      "SYNTHETIC PLEDGE ONLY NOTE",
    );
    await page.evaluate(() => {
      window.__FAIL_PLEDGE_STORAGE__ = false;
    });
    app.rejectWrites(true);
    await payment()
      .getByRole("button", { name: "Save payment", exact: true })
      .click();
    await page
      .getByText("Synthetic pledge cloud unavailable", { exact: true })
      .waitFor();
    await page.getByTitle("View Pledge Dossier", { exact: true }).click();
    await dossier()
      .getByText("SYNTHETIC PLEDGE ONLY NOTE", { exact: true })
      .waitFor();
    assert.equal(
      await dossier()
        .getByRole("button", { name: "Print statement", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await dossier()
        .getByRole("button", { name: "Record payment", exact: true })
        .isDisabled(),
      true,
    );
    const saved = app.requests.at(-1);
    assert.equal(saved.p_changes.length, 1);
    assert.equal(saved.p_changes[0].record.amount_paid, 20);
    assert.equal(
      saved.p_changes[0].record.payments[0].notes,
      "SYNTHETIC PLEDGE ONLY NOTE",
    );
    assert.equal(saved.p_changes[0].expected_updated_at, now);
    app.rejectWrites(false);
    await dossier().getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Retry sync", exact: true }).click();
    await waitForSync(page);
    assert.equal(app.data.pledges[0].amount_paid, 30);
    assert.equal(app.data.giving.length, 1);
    assert.equal(app.requests.at(-1).p_operation_id, saved.p_operation_id);
    await page.getByTitle("View Pledge Dossier", { exact: true }).click();
    await dossier()
      .getByText("SYNTHETIC PLEDGE ONLY NOTE", { exact: true })
      .waitFor();
    await dossier()
      .getByRole("button", { name: "Record payment", exact: true })
      .click();
    assert.equal(
      await payment()
        .getByLabel("Payment amount (GH₵)", { exact: true })
        .inputValue(),
      "",
    );
    await payment()
      .getByLabel("Payment amount (GH₵)", { exact: true })
      .fill("15");
    await payment()
      .getByLabel("Payment notes", { exact: true })
      .fill("SYNTHETIC LINKED NOTE");
    await payment()
      .getByLabel("Transaction reference", { exact: true })
      .fill("SYNTHETIC-REF");
    await payment()
      .getByRole("button", { name: "Save payment", exact: true })
      .click();
    await payment().waitFor({ state: "hidden" });
    await waitForSync(page);
    const batch = app.requests.at(-1).p_changes;
    assert.deepEqual(
      batch.map((r) => r.table),
      ["pledges", "giving"],
    );
    assert.equal(batch[0].record.payments.at(-1).giving_id, batch[1].id);
    assert.equal(batch[1].record.pledge_id, "pledge-one");
    assert.equal(batch[1].record.notes, "SYNTHETIC LINKED NOTE");
    assert.equal(app.data.pledges[0].amount_paid, 45);
    assert.equal(app.data.giving.length, 2);
    await page.getByTitle("View Pledge Dossier", { exact: true }).click();
    const linkedReceipt = dossier()
      .getByRole("listitem")
      .filter({ hasText: "SYNTHETIC LINKED NOTE" });
    await linkedReceipt
      .getByRole("button", { name: "Void payment", exact: true })
      .click();
    await dossier()
      .getByLabel("Reason for voiding this payment", { exact: true })
      .fill("Synthetic duplicate correction");
    await dossier()
      .getByRole("button", { name: "Confirm void", exact: true })
      .click();
    await dossier()
      .getByLabel("Reason for voiding this payment", { exact: true })
      .waitFor({ state: "hidden" });
    await waitForSync(page);
    await dossier()
      .getByText("Void reason: Synthetic duplicate correction", { exact: true })
      .waitFor();
    assert.equal(app.data.pledges[0].amount_paid, 30);
    assert.equal(app.data.giving.find((r) => r.pledge_id)?.status, "voided");
    await page.emulateMedia({ media: "print" });
    assert.equal(
      await page
        .getByRole("heading", {
          name: "Pledge Campaigns & Kingdom Commitments",
          exact: true,
        })
        .isVisible(),
      false,
    );
    assert.deepEqual(
      await dossier().evaluate((el) => ({
        maxHeight: getComputedStyle(el).maxHeight,
        overflow: getComputedStyle(el).overflow,
        position: getComputedStyle(el).position,
      })),
      { maxHeight: "none", overflow: "visible", position: "static" },
    );
    await page.emulateMedia({ media: "screen" });
    await dossier()
      .getByRole("button", { name: "Edit pledge", exact: true })
      .click();
    const edit = page.getByRole("dialog", {
      name: "Edit Pledge Commitment",
      exact: true,
    });
    assert.equal(
      await edit
        .getByRole("button", { name: "Delete unpaid pledge", exact: true })
        .count(),
      0,
    );
    const external = {
      ...app.data.pledges.find((row) => row.id === "pledge-one"),
      updated_at: new Date(Date.now() + 1000).toISOString(),
    };
    app.data.pledges = app.data.pledges.map((row) =>
      row.id === external.id ? external : row,
    );
    await page.evaluate(
      ({ owner, record }) =>
        window.dispatchEvent(
          new CustomEvent("gwcc-sync-records", {
            detail: { owner, records: [{ table: "pledges", record }] },
          }),
        ),
      { owner, record: external },
    );
    await edit
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await edit
      .getByRole("alert")
      .filter({ hasText: /changed while the form/ })
      .waitFor();
    await edit.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByTitle("View Pledge Dossier", { exact: true }).click();
    await dossier()
      .getByRole("button", { name: "Edit pledge", exact: true })
      .click();
    await edit
      .getByLabel("Pledge notes", { exact: true })
      .fill("Synthetic updated pledge note");
    await edit
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await edit.waitFor({ state: "hidden" });
    await waitForSync(page);
    assert.equal(app.data.pledges[0].amount_paid, 30);
    await page.getByTitle("Edit Campaign Details", { exact: true }).click();
    const campaign = page.getByRole("dialog", {
      name: "Edit Campaign",
      exact: true,
    });
    assert.equal(
      await campaign
        .getByRole("button", { name: "Archive campaign", exact: true })
        .count(),
      1,
    );
    await campaign.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("button", { name: "Record Pledge", exact: true })
      .click();
    const add = page.getByRole("dialog", {
      name: "Record New Pledge",
      exact: true,
    });
    assert.equal(await add.getByRole("option", { name: /custom/i }).count(), 0);
    await add
      .getByLabel("Member", { exact: true })
      .selectOption("pledge-member");
    await add
      .getByLabel("Campaign", { exact: true })
      .selectOption("pledge-campaign");
    await add.getByLabel("Pledged amount (GH₵)", { exact: true }).fill("50");
    await add.getByLabel("Record an initial payment", { exact: true }).check();
    await add.getByLabel("Initial payment (GH₵)", { exact: true }).fill("5");
    await add
      .getByLabel("Payment notes", { exact: true })
      .fill("Synthetic initial deposit");
    await add.getByRole("button", { name: "Save pledge", exact: true }).click();
    await add.waitFor({ state: "hidden" });
    await waitForSync(page);
    assert.equal(app.data.pledges.length, 2);
    assert.equal(
      app.data.pledges.find((r) => r.id !== "pledge-one").amount_paid,
      5,
    );
    assert.deepEqual(
      app.requests.at(-1).p_changes.map((r) => r.table),
      ["pledges", "giving"],
    );
    await page.goto(origin + "/giving");
    await page
      .getByRole("button", { name: "Record Member Giving", exact: true })
      .click();
    const givingForm = page.getByRole("dialog", {
      name: "Record member giving",
      exact: true,
    });
    await givingForm
      .getByLabel("Credit to active pledge", { exact: true })
      .selectOption("pledge-one");
    assert.equal(
      await givingForm
        .getByLabel("Giving member", { exact: true })
        .inputValue(),
      "pledge-member",
    );
    await givingForm.getByPlaceholder("0.00", { exact: true }).fill("7");
    await givingForm
      .getByPlaceholder("e.g. 7819203912 or Envelope #", { exact: true })
      .fill("SYNTHETIC-GIVING-PLEDGE");
    await givingForm
      .getByPlaceholder("Prophetic seed prayer focus or thanksgiving note...", {
        exact: true,
      })
      .fill("Synthetic Giving-page pledge payment");
    app.rejectWrites(true);
    await givingForm
      .getByRole("button", { name: "Save Giving Record", exact: true })
      .click();
    await givingForm.waitFor({ state: "hidden" });
    await page
      .getByText("Synthetic pledge cloud unavailable", { exact: true })
      .waitFor();
    const givingBatch = app.requests.at(-1).p_changes;
    assert.deepEqual(
      givingBatch.map((r) => r.table),
      ["pledges", "giving"],
    );
    assert.equal(
      givingBatch[0].record.payments.at(-1).notes,
      "Synthetic Giving-page pledge payment",
    );
    assert.equal(
      app.data.pledges.find((r) => r.id === "pledge-one").amount_paid,
      30,
    );
    await page.getByRole("button", { name: /^Giving Ledger/ }).click();
    assert.equal(
      await page
        .getByRole("cell", { name: "SYNTHETIC-GIVING-PLEDGE", exact: true })
        .count(),
      0,
      "Unconfirmed linked Giving must not enter financial reports",
    );
    app.rejectWrites(false);
    await page.getByRole("button", { name: "Retry sync", exact: true }).click();
    await waitForSync(page);
    await page
      .getByRole("cell", { name: "SYNTHETIC-GIVING-PLEDGE", exact: true })
      .waitFor();
    const linkedRow = page
      .getByRole("row")
      .filter({
        has: page.getByRole("cell", {
          name: "SYNTHETIC-GIVING-PLEDGE",
          exact: true,
        }),
      });
    assert.equal(
      await linkedRow
        .getByTitle("Correct from pledge payment history", { exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await linkedRow
        .getByTitle("Void from pledge payment history", { exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await linkedRow
        .getByTitle("Delete from Database", { exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      app.data.pledges.find((r) => r.id === "pledge-one").amount_paid,
      37,
    );
    const printable = app.data.pledges.find((row) => row.id === "pledge-one");
    printable.payments.push(
      ...Array.from({ length: 55 }, (_, index) => ({
        id: `dddddddd-dddd-4ddd-8ddd-${String(index).padStart(12, "0")}`,
        amount: 1,
        date: today,
        payment_method: "cash",
        sync_with_giving: false,
        status: "voided",
        receipt_no: `PLG-SYNTHETIC-${index}`,
        recorded_at: now,
        voided_at: now,
        void_reason: "Synthetic print layout check",
        notes:
          index === 54
            ? "SYNTHETIC FINAL RECEIPT"
            : "Synthetic historical receipt",
      })),
    );
    await page.goto(origin + "/pledges");
    await page
      .getByTitle("View Pledge Dossier", { exact: true })
      .first()
      .click();
    await dossier()
      .getByText("SYNTHETIC FINAL RECEIPT", { exact: true })
      .waitFor();
    await page.emulateMedia({ media: "print" });
    assert.equal(
      await page
        .getByRole("heading", {
          name: "Pledge Campaigns & Kingdom Commitments",
          exact: true,
        })
        .isVisible(),
      false,
    );
    const canvas = page.locator("[data-pledge-print-content]").first();
    assert.ok(
      await canvas.evaluate((el) => el.clientHeight >= el.scrollHeight - 2),
      "All statement receipts remain printable",
    );
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      ...(process.env.TEST_PLEDGE_PDF
        ? { path: process.env.TEST_PLEDGE_PDF }
        : {}),
    });
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    await page.emulateMedia({ media: "screen" });
    if (process.env.TEST_PLEDGE_SCREENSHOT)
      await page.screenshot({ path: process.env.TEST_PLEDGE_SCREENSHOT });
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
  const mobile = await setup(390, "Pacific/Auckland");
  try {
    const { page } = mobile;
    assert.equal(
      await page.getByText("Past Due", { exact: true }).count(),
      0,
      "Due today in Ghana remains due today regardless of viewer timezone",
    );
    await page.getByRole("button", { name: "+ Pay", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Record Pledge Payment",
      exact: true,
    });
    await dialog.waitFor();
    assert.ok(
      await dialog.evaluate(
        (el) => el.getBoundingClientRect().width <= window.innerWidth,
      ),
    );
    if (process.env.TEST_PLEDGE_MOBILE_SCREENSHOT)
      await page.screenshot({
        path: process.env.TEST_PLEDGE_MOBILE_SCREENSHOT,
      });
    await page.keyboard.press("Escape");
    assert.equal(await dialog.count(), 0);
    assert.deepEqual(mobile.errors, []);
  } finally {
    await mobile.context.close();
  }
  console.info(
    "Pledge browser checks passed: durable storage failures, immutable retries, confirmed balances, separate and linked receipts, atomic void, initial deposits, print isolation, mobile and Ghana dates.",
  );
}
