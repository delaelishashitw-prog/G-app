import type { Dispatch, SetStateAction } from 'react';
import type { Member, PaymentMethod, PledgeCampaign, PledgeRecord, PledgeStatus } from '../../types/database.types';

export function addCampaign(
  data: Omit<PledgeCampaign, 'id'>,
  setCampaigns: Dispatch<SetStateAction<PledgeCampaign[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): PledgeCampaign {
  const newCampaign: PledgeCampaign = {
    ...data,
    id: `cmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  };

  setCampaigns((prev) => [newCampaign, ...prev]);
  logAction('CREATE_CAMPAIGN', 'Pledges', `Created campaign "${newCampaign.name}" with target GH₵ ${newCampaign.target_amount.toLocaleString()}`, newCampaign.id);
  dbSyncUpsert('pledge_campaigns', newCampaign);
  return newCampaign;
}

export function updateCampaign(
  id: string,
  updates: Partial<PledgeCampaign>,
  setCampaigns: Dispatch<SetStateAction<PledgeCampaign[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setCampaigns((prev) =>
    prev.map((c) => {
      if (c.id === id) {
        const updated = { ...c, ...updates };
        logAction('UPDATE_CAMPAIGN', 'Pledges', `Updated campaign "${updated.name}"`, id);
        dbSyncUpsert('pledge_campaigns', updated);
        return updated;
      }
      return c;
    })
  );
}

export function deleteCampaign(
  id: string,
  campaigns: PledgeCampaign[],
  setCampaigns: Dispatch<SetStateAction<PledgeCampaign[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  const cmp = campaigns.find((c) => c.id === id);
  setCampaigns((prev) => prev.filter((c) => c.id !== id));
  logAction('DELETE_CAMPAIGN', 'Pledges', `Deleted campaign "${cmp?.name || id}"`, id);
  dbSyncDelete('pledge_campaigns', id);
}

export function createPledge(
  data: Omit<PledgeRecord, 'id' | 'balance' | 'status' | 'created_at'>,
  members: Member[],
  setPledges: Dispatch<SetStateAction<PledgeRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): PledgeRecord {
  const balance = Math.max(0, data.amount_pledged - data.amount_paid);
  const status: PledgeStatus = balance <= 0 ? 'completed' : data.amount_paid > 0 ? 'partially_paid' : 'active';
  const newRecord: PledgeRecord = {
    ...data,
    id: `plg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    balance,
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  setPledges((prev) => [newRecord, ...prev]);
  const member = members.find((m) => m.id === data.member_id);
  const mName = member ? `${member.first_name} ${member.last_name}` : data.member_name || 'Member';
  logAction(
    'CREATE_PLEDGE',
    'Pledges',
    `Recorded pledge of GH₵ ${data.amount_pledged.toFixed(2)} by ${mName} for "${data.campaign_name}"`,
    newRecord.id
  );
  dbSyncUpsert('pledges', newRecord);
  return newRecord;
}

export function updatePledge(
  id: string,
  updates: Partial<PledgeRecord>,
  setPledges: Dispatch<SetStateAction<PledgeRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setPledges((prev) =>
    prev.map((p) => {
      if (p.id === id) {
        const updatedPledge = { ...p, ...updates, updated_at: new Date().toISOString() };
        if (updates.amount_pledged !== undefined || updates.amount_paid !== undefined) {
          const pledged = updates.amount_pledged ?? p.amount_pledged;
          const paid = updates.amount_paid ?? p.amount_paid;
          const newBal = Math.max(0, pledged - paid);
          updatedPledge.balance = newBal;
          updatedPledge.status = newBal <= 0 ? 'completed' : paid > 0 ? 'partially_paid' : 'active';
        }
        logAction('UPDATE_PLEDGE', 'Pledges', `Updated pledge record for ${updatedPledge.member_name}`, id);
        dbSyncUpsert('pledges', updatedPledge);
        return updatedPledge;
      }
      return p;
    })
  );
}

export function deletePledge(
  id: string,
  pledges: PledgeRecord[],
  setPledges: Dispatch<SetStateAction<PledgeRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  const p = pledges.find((item) => item.id === id);
  setPledges((prev) => prev.filter((item) => item.id !== id));
  logAction('DELETE_PLEDGE', 'Pledges', `Deleted pledge record of ${p?.member_name || id}`, id);
  dbSyncDelete('pledges', id);
}

export function recordPledgePayment(
  pledgeId: string,
  amount: number,
  pledges: PledgeRecord[],
  setPledges: Dispatch<SetStateAction<PledgeRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void,
  recordGiving: (data: Omit<any, 'id' | 'created_at'>) => any,
  paymentDetails?: {
    method?: PaymentMethod;
    channel?: string;
    reference?: string;
    syncWithGiving?: boolean;
  }
) {
  let affectedPledge: PledgeRecord | null = null;
  setPledges((prev) =>
    prev.map((p) => {
      if (p.id === pledgeId) {
        const newPaid = p.amount_paid + amount;
        const newBalance = Math.max(0, p.amount_pledged - newPaid);
        const newStatus: PledgeStatus = newBalance === 0 ? 'completed' : newPaid > 0 ? 'partially_paid' : 'active';
        const updated = {
          ...p,
          amount_paid: newPaid,
          balance: newBalance,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        affectedPledge = updated;
        logAction('PLEDGE_PAYMENT', 'Pledges', `Received installment of GH₵ ${amount.toFixed(2)} on pledge by ${p.member_name} (${p.campaign_name})`, pledgeId);
        dbSyncUpsert('pledges', updated);
        return updated;
      }
      return p;
    })
  );

  if (paymentDetails?.syncWithGiving && affectedPledge) {
    const plg = affectedPledge as PledgeRecord;
    recordGiving({
      member_id: plg.member_id,
      member_name: plg.member_name,
      donor_name: plg.member_name,
      category: 'Building Fund',
      amount,
      currency: 'GHS',
      date: new Date().toISOString().split('T')[0],
      payment_method: paymentDetails.method || 'cash',
      payment_channel: paymentDetails.channel || 'Cash Deposit',
      reference_number: paymentDetails.reference || `PLG-${Date.now().toString().slice(-6)}`,
      notes: `Pledge installment for ${plg.campaign_name}`,
    });
  }
}
