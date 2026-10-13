import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWelfareEvent,
  recordEventContribution,
  closeWelfareEvent,
  updateWelfareEvent,
} from '../features/welfare/welfareStore.ts';
import { sanitizeRecordForSupabase } from './supabase.ts';

test('1. Allows creating welfare contribution events for all six required categories', () => {
  let events = [];
  const setEvents = (action) => {
    events = typeof action === 'function' ? action(events) : action;
  };
  const loggedActions = [];
  const logAction = (action, module, details, recordId) => {
    loggedActions.push({ action, module, details, recordId });
  };

  const categories = [
    { cat: 'death_member', title: 'Late Elder Solomon Funeral Fund', member: 'Solomon Ofori', family: 'The Ofori Family' },
    { cat: 'death_parent', title: 'Condolence: Mother of Elder Kofi Addo', member: 'Kofi Addo', family: 'Elder Addo & Siblings' },
    { cat: 'death_spouse', title: 'Bereavement Solidarity: Wife of Bro Benjamin', member: 'Benjamin Antwi', family: 'Antwi Household' },
    { cat: 'sickness_hospitalization', title: 'Emergency Surgery: Sister Grace', member: 'Grace Mensah', family: 'Mensah Medical Trust' },
    { cat: 'emergency_assistance', title: 'Domestic Fire Relief: Brother Daniel', member: 'Daniel Nortey', family: 'Nortey Family' },
    { cat: 'other', title: 'Academic Aid for Orphans', member: 'Mercy Appiah', family: 'Academic Trust', custom: 'Orphan Scholarship' },
  ];

  for (const item of categories) {
    const created = createWelfareEvent(
      {
        title: item.title,
        category: item.cat,
        category_custom: item.custom,
        member_id: `mem-${item.cat}`,
        member_name: item.member,
        beneficiary_family_name: item.family,
        description: `Appeal for ${item.member} welfare assistance.`,
        pastoral_notes: 'Pastoral committee resolution passed.',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        target_amount: 5000.0,
        minimum_contribution: 20.0,
        status: 'open',
        created_by: 'Senior Pastor',
      },
      setEvents,
      logAction
    );

    assert.ok(created.id.startsWith('wevt-'));
    assert.equal(created.category, item.cat);
    assert.equal(created.minimum_contribution, 20.0);
    assert.equal(created.status, 'open');
  }

  assert.equal(events.length, 6);
  assert.equal(loggedActions.length, 6);
});

test('2. Enforces GH¢20.00 minimum per contribution: rejects GH¢19.99 and accepts GH¢20.00+', () => {
  const event = {
    id: 'wevt-test-min',
    title: 'Hospital Support Appeal',
    category: 'sickness_hospitalization',
    member_id: 'mem-1',
    member_name: 'Grace Mensah',
    description: 'Medical appeal',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    minimum_contribution: 20.0,
    status: 'open',
    created_by: 'Staff',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let contributions = [];
  const setContributions = (action) => {
    contributions = typeof action === 'function' ? action(contributions) : action;
  };
  const logAction = () => {};

  // Case A: Reject GH¢19.99
  const belowMinResult = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-1',
      contributor_name: 'Kwame Mensah',
      amount: 19.99,
      payment_date: '2026-10-13',
      payment_method: 'mobile_money',
      payment_status: 'confirmed',
      recorded_by: 'Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction
  );

  assert.equal(belowMinResult.success, false);
  assert.ok(belowMinResult.error?.includes('below the minimum requirement'));
  assert.equal(contributions.length, 0);

  // Case B: Reject GH¢10.00
  const belowMinResult2 = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-1',
      contributor_name: 'Kwame Mensah',
      amount: 10.0,
      payment_date: '2026-10-13',
      payment_method: 'cash',
      payment_status: 'confirmed',
      recorded_by: 'Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction
  );
  assert.equal(belowMinResult2.success, false);
  assert.equal(contributions.length, 0);

  // Case C: Accept exactly GH¢20.00
  const exactMinResult = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-1',
      contributor_name: 'Kwame Mensah',
      amount: 20.0,
      payment_date: '2026-10-13',
      payment_method: 'mobile_money',
      payment_status: 'confirmed',
      recorded_by: 'Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction
  );
  assert.equal(exactMinResult.success, true);
  assert.equal(contributions.length, 1);
  assert.equal(contributions[0].amount, 20.0);

  // Case D: Accept higher amounts (e.g. GH¢50.00, GH¢200.00)
  const higherResult = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-2',
      contributor_name: 'Akosua Frimpong',
      amount: 250.0,
      payment_date: '2026-10-13',
      payment_method: 'bank_transfer',
      payment_status: 'confirmed',
      recorded_by: 'Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction
  );
  assert.equal(higherResult.success, true);
  assert.equal(contributions.length, 2);
  assert.equal(contributions[0].amount, 250.0);
});

test('3. Allows multiple legitimate contributions from the same member with duplicate protection', () => {
  const event = {
    id: 'wevt-multiple-test',
    title: 'Solomon Ofori Memorial',
    category: 'death_member',
    member_id: 'mem-solomon',
    member_name: 'Solomon Ofori',
    description: 'Funeral benevolence fund',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    minimum_contribution: 20.0,
    status: 'open',
    created_by: 'Staff',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let contributions = [];
  const setContributions = (action) => {
    contributions = typeof action === 'function' ? action(contributions) : action;
  };
  const logAction = () => {};

  // First contribution: GH¢ 100.00
  const first = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-kofi',
      contributor_name: 'Kofi Addo',
      amount: 100.0,
      payment_date: '2026-10-13',
      payment_method: 'mobile_money',
      reference_no: 'MOMO-101',
      payment_status: 'confirmed',
      recorded_by: 'Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction
  );
  assert.equal(first.success, true);
  assert.equal(contributions.length, 1);

  // Accidental duplicate attempt with exact same amount, date, and contributor
  const duplicateAttempt = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-kofi',
      contributor_name: 'Kofi Addo',
      amount: 100.0,
      payment_date: '2026-10-13',
      payment_method: 'mobile_money',
      reference_no: 'MOMO-101',
      payment_status: 'confirmed',
      recorded_by: 'Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction
  );
  // Should trigger duplicate warning
  assert.equal(duplicateAttempt.success, false);
  assert.equal(duplicateAttempt.isDuplicateWarning, true);
  assert.ok(duplicateAttempt.error?.includes('already recorded today'));
  assert.equal(contributions.length, 1);

  // Legitimate additional contribution confirmed with forceDuplicateConfirmation: true
  const confirmedSecond = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-kofi',
      contributor_name: 'Kofi Addo',
      amount: 100.0,
      payment_date: '2026-10-13',
      payment_method: 'mobile_money',
      reference_no: 'MOMO-102',
      payment_status: 'confirmed',
      recorded_by: 'Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction,
    undefined,
    { forceDuplicateConfirmation: true }
  );
  assert.equal(confirmedSecond.success, true);
  assert.equal(contributions.length, 2);

  // Third contribution with different amount (e.g. GH¢ 50.00) goes through directly
  const third = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-kofi',
      contributor_name: 'Kofi Addo',
      amount: 50.0,
      payment_date: '2026-10-13',
      payment_method: 'cash',
      payment_status: 'confirmed',
      recorded_by: 'Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction
  );
  assert.equal(third.success, true);
  assert.equal(contributions.length, 3);

  // Total contributed by Kofi Addo to this event
  const kofiTotal = contributions
    .filter((c) => c.member_id === 'mem-donor-kofi')
    .reduce((sum, c) => sum + c.amount, 0);
  assert.equal(kofiTotal, 250.0);
});

test('4. Correctly integrates confirmed receipts with Church Finance module and counts only confirmed payments', () => {
  const event = {
    id: 'wevt-fin-test',
    title: 'Korle-Bu Surgery Appeal',
    category: 'sickness_hospitalization',
    member_id: 'mem-2',
    member_name: 'Grace Mensah',
    beneficiary_family_name: 'Grace Mensah Medical Fund',
    description: 'Hospital bill assistance',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    target_amount: 2000.0,
    minimum_contribution: 20.0,
    status: 'open',
    created_by: 'Staff',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let contributions = [];
  const setContributions = (action) => {
    contributions = typeof action === 'function' ? action(contributions) : action;
  };

  let finances = [];
  const setFinances = (action) => {
    finances = typeof action === 'function' ? action(finances) : action;
  };

  let accounts = [
    {
      id: 'acc-ops',
      name: 'Main Operating Account',
      account_number: '1041130009821',
      account_type: 'operating',
      currency: 'GHS',
      current_balance: 1000.0,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];
  const setAccounts = (action) => {
    accounts = typeof action === 'function' ? action(accounts) : action;
  };

  const logAction = () => {};

  // Confirmed payment with Finance Integration enabled
  const confirmedRes = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-1',
      contributor_name: 'Daniel Nortey',
      amount: 300.0,
      payment_date: '2026-10-13',
      payment_method: 'mobile_money',
      reference_no: 'MOMO-771',
      payment_status: 'confirmed',
      recorded_by: 'Finance Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction,
    undefined,
    {
      linkToChurchFinance: true,
      financeAccountId: 'acc-ops',
      financeAccountName: 'Main Operating Account',
      setChurchFinances: setFinances,
      setChurchAccounts: setAccounts,
    }
  );

  assert.equal(confirmedRes.success, true);
  assert.equal(contributions.length, 1);
  assert.ok(contributions[0].finance_transaction_id);

  // Check that finance record was posted
  assert.equal(finances.length, 1);
  assert.equal(finances[0].transaction_type, 'income');
  assert.equal(finances[0].category, 'Welfare Event Contributions');
  assert.equal(finances[0].amount, 300.0);
  assert.equal(accounts[0].current_balance, 1300.0);

  // Pending payment: does NOT create finance income and counts as pending, not collected
  const pendingRes = recordEventContribution(
    {
      event_id: event.id,
      member_id: 'mem-donor-2',
      contributor_name: 'Sister Mary',
      amount: 150.0,
      payment_date: '2026-10-13',
      payment_method: 'cheque',
      payment_status: 'pending',
      recorded_by: 'Finance Officer',
    },
    [event],
    contributions,
    setContributions,
    logAction,
    undefined,
    {
      linkToChurchFinance: true,
      financeAccountId: 'acc-ops',
      financeAccountName: 'Main Operating Account',
      setChurchFinances: setFinances,
      setChurchAccounts: setAccounts,
    }
  );

  assert.equal(pendingRes.success, true);
  assert.equal(contributions.length, 2);

  // Finance accounts should not have increased for pending
  assert.equal(finances.length, 1);
  assert.equal(accounts[0].current_balance, 1300.0);

  // Only confirmed contributions count as collected funds
  const confirmedTotal = contributions
    .filter((c) => c.payment_status === 'confirmed')
    .reduce((sum, c) => sum + c.amount, 0);
  assert.equal(confirmedTotal, 300.0);
});

test('5. Closing an event prevents further contributions and preserves history', () => {
  let events = [
    {
      id: 'wevt-close-test',
      title: 'Comfort Darko Memorial Appeal',
      category: 'death_member',
      member_id: 'mem-darko',
      member_name: 'Comfort Darko',
      description: 'Memorial drive',
      start_date: '2026-08-01',
      end_date: '2026-08-31',
      minimum_contribution: 20.0,
      status: 'open',
      created_by: 'Pastor',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  const setEvents = (action) => {
    events = typeof action === 'function' ? action(events) : action;
  };

  let contributions = [
    {
      id: 'wec-hist-1',
      event_id: 'wevt-close-test',
      member_id: 'mem-1',
      contributor_name: 'Kwame Mensah',
      amount: 100.0,
      payment_date: '2026-08-15',
      payment_method: 'mobile_money',
      payment_status: 'confirmed',
      recorded_by: 'Staff',
      created_at: new Date().toISOString(),
    },
  ];
  const setContributions = (action) => {
    contributions = typeof action === 'function' ? action(contributions) : action;
  };
  const logAction = () => {};

  // Close event
  closeWelfareEvent('wevt-close-test', 'Administrator Clara', setEvents, logAction);
  assert.equal(events[0].status, 'closed');

  // Attempting to record contribution on closed event must fail
  const attempt = recordEventContribution(
    {
      event_id: 'wevt-close-test',
      member_id: 'mem-2',
      contributor_name: 'Akosua Frimpong',
      amount: 50.0,
      payment_date: '2026-09-01',
      payment_method: 'cash',
      payment_status: 'confirmed',
      recorded_by: 'Staff',
    },
    events,
    contributions,
    setContributions,
    logAction
  );

  assert.equal(attempt.success, false);
  assert.ok(attempt.error?.includes('CLOSED'));

  // Historical contribution record must be safely preserved
  assert.equal(contributions.length, 1);
  assert.equal(contributions[0].amount, 100.0);
  assert.equal(contributions[0].contributor_name, 'Kwame Mensah');
});

test('6. Sanitizes welfare_events and welfare_event_contributions for Supabase persistence', () => {
  const sanitizedEvent = sanitizeRecordForSupabase('welfare_events', {
    id: 'wevt-99',
    title: 'Hospital Support',
    category: 'sickness_hospitalization',
    member_id: 'mem-5',
    member_name: 'Daniel Nortey',
    description: 'Medical support drive',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    target_amount: '4000.50',
    minimum_contribution: '15.00',
    status: 'open',
  });

  assert.equal(sanitizedEvent.minimum_contribution, 20.0);
  assert.equal(sanitizedEvent.target_amount, 4000.5);
  assert.equal(sanitizedEvent.category, 'sickness_hospitalization');

  const sanitizedContrib = sanitizeRecordForSupabase('welfare_event_contributions', {
    id: 'wec-99',
    event_id: 'wevt-99',
    member_id: 'mem-10',
    contributor_name: 'Kwame Mensah',
    amount: '12.50',
    payment_date: '2026-10-13',
    payment_method: 'mobile_money',
    payment_status: 'confirmed',
  });

  assert.equal(sanitizedContrib.amount, 20.0);
  assert.equal(sanitizedContrib.event_id, 'wevt-99');
  assert.equal(sanitizedContrib.payment_status, 'confirmed');
});
