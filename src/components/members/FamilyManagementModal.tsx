import React, { useEffect, useMemo, useState } from 'react';
import { X, Users, ShieldCheck, Plus, Trash2, RefreshCw } from 'lucide-react';
import type { Member, MemberGuardian } from '../../types/database.types';
import { getSupabaseClient } from '../../lib/supabase';
import { getMemberAgeGroup } from '../../lib/familyUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  actorId: string;
}

const relationshipLabels: Record<MemberGuardian['relationship'], string> = {
  mother: 'Mother', father: 'Father', legal_guardian: 'Legal guardian',
  grandparent: 'Grandparent', relative: 'Other relative', other: 'Other'
};

export const FamilyManagementModal: React.FC<Props> = ({ isOpen, onClose, members, actorId }) => {
  const children = useMemo(() => members.filter(m => !m.is_archived && getMemberAgeGroup(m) === 'child'), [members]);
  const adults = useMemo(() => members.filter(m => !m.is_archived && ['adult', 'senior'].includes(getMemberAgeGroup(m))), [members]);
  const [childId, setChildId] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [relationship, setRelationship] = useState<MemberGuardian['relationship']>('mother');
  const [isPrimary, setIsPrimary] = useState(false);
  const [pickupAuthorized, setPickupAuthorized] = useState(false);
  const [verified, setVerified] = useState(false);
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState<MemberGuardian[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedChild = children.find(m => m.id === childId);
  const getName = (id: string) => {
    const m = members.find(x => x.id === id);
    return m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : 'Unknown member';
  };

  const loadLinks = async (id: string) => {
    if (!id) { setLinks([]); return; }
    const client = getSupabaseClient();
    if (!client) { setMessage('Church database is not connected. Connect Supabase before managing family links.'); return; }
    setLoading(true); setMessage('');
    try {
      const { data, error } = await client.from('member_guardians').select('*').eq('child_member_id', id).order('created_at', { ascending: true });
      if (error) throw error;
      setLinks((data || []) as MemberGuardian[]);
    } catch (e) {
      setMessage((e as Error).message || 'Could not load guardian links.');
      setLinks([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (isOpen && childId) void loadLinks(childId);
  }, [isOpen, childId]);

  useEffect(() => {
    if (!isOpen) {
      setChildId(''); setGuardianId(''); setLinks([]); setMessage('');
      setRelationship('mother'); setIsPrimary(false); setPickupAuthorized(false); setVerified(false); setNotes('');
    }
  }, [isOpen]);

  const saveLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!childId || !guardianId || childId === guardianId) { setMessage('Select a child and a different adult guardian.'); return; }
    if (!verified) { setMessage('Please confirm that the relationship has been checked with the family before saving.'); return; }
    const client = getSupabaseClient();
    if (!client) { setMessage('Church database is not connected.'); return; }
    setSaving(true); setMessage('');
    try {
      const payload = {
        child_member_id: childId, guardian_member_id: guardianId, relationship,
        is_primary: isPrimary, pickup_authorized: pickupAuthorized,
        authorization_notes: notes.trim() || null, verified_by: actorId,
        verified_at: new Date().toISOString()
      };
      const { error } = await client.rpc('gwcc_save_member_guardian', {
        p_child_member_id: payload.child_member_id,
        p_guardian_member_id: payload.guardian_member_id,
        p_relationship: payload.relationship,
        p_is_primary: payload.is_primary,
        p_pickup_authorized: payload.pickup_authorized,
        p_authorization_notes: payload.authorization_notes,
        p_confirmed: verified,
      });
      if (error) throw error;
      setGuardianId(''); setIsPrimary(false); setPickupAuthorized(false); setVerified(false); setNotes('');
      await loadLinks(childId);
      setMessage('Verified guardian relationship saved.');
    } catch (e) { setMessage((e as Error).message || 'Could not save guardian relationship.'); }
    finally { setSaving(false); }
  };

  const removeLink = async (id: string) => {
    const client = getSupabaseClient();
    if (!client || !window.confirm('Remove this guardian relationship? This also removes its pickup authorization.')) return;
    setSaving(true);
    try {
      const { error } = await client.rpc('gwcc_delete_member_guardian', { p_guardian_link_id: id });
      if (error) throw error;
      await loadLinks(childId);
      setMessage('Guardian relationship removed.');
    } catch (e) { setMessage((e as Error).message || 'Could not remove guardian relationship.'); }
    finally { setSaving(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="family-management-title" className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3"><Users className="h-5 w-5 text-emerald-400"/><div><h2 id="family-management-title" className="font-bold">Verified Family & Guardian Management</h2><p className="text-xs text-slate-300">Manage a child's recorded guardians and pickup permissions</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-slate-800"><X className="h-5 w-5"/></button>
        </header>
        <div className="space-y-5 p-5">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><strong>Safety rule:</strong> A family grouping or a recorded relationship does not automatically authorize pickup. Only the separate pickup permission below does that. Verify identity and obtain guardian consent before enabling it.</div>
          <label className="block text-sm font-semibold text-slate-700">Select child
            <select value={childId} onChange={e => setChildId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5">
              <option value="">Choose a registered child…</option>
              {children.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name} · {m.member_id}</option>)}
            </select>
          </label>
          {selectedChild && <>
            <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">Recorded guardians for {selectedChild.first_name}</h3><button type="button" onClick={() => void loadLinks(childId)} disabled={loading} className="flex items-center gap-1 text-xs font-semibold text-teal-800"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button></div>
            {loading ? <p className="text-sm text-slate-500">Loading guardian records…</p> : links.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No guardian relationships recorded for this child yet.</p> : <div className="space-y-2">{links.map(link => <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-semibold text-slate-900">{getName(link.guardian_member_id)} <span className="font-normal text-slate-500">· {relationshipLabels[link.relationship]}</span></p><p className="mt-1 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">{link.verified_at ? 'Verified' : 'Not verified'}</span>{link.is_primary && <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">Primary guardian</span>}<span className={link.pickup_authorized ? 'rounded-full bg-emerald-50 px-2 py-1 text-emerald-800' : 'rounded-full bg-slate-100 px-2 py-1 text-slate-600'}>{link.pickup_authorized ? 'Pickup authorized' : 'Pickup not authorized'}</span></p></div><button type="button" disabled={saving} onClick={() => void removeLink(link.id)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50" aria-label="Remove guardian"><Trash2 className="h-4 w-4"/></button></div>)}</div>}
            <form onSubmit={saveLink} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <h3 className="flex items-center gap-2 font-bold text-slate-900"><Plus className="h-4 w-4"/>Add or update guardian</h3>
              <label className="block text-sm font-medium text-slate-700">Parent / guardian
                <select value={guardianId} onChange={e => setGuardianId(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"><option value="">Select an existing adult member…</option>{adults.filter(m => m.id !== childId).map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name} · {m.member_id}</option>)}</select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Relationship
                <select value={relationship} onChange={e => setRelationship(e.target.value as MemberGuardian['relationship'])} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5">{Object.entries(relationshipLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)}/>Mark as primary guardian</label>
              <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={pickupAuthorized} onChange={e => setPickupAuthorized(e.target.checked)} className="mt-1"/>Authorize this adult to pick up this child (only after identity and consent checks)</label>
              <label className="block text-sm font-medium text-slate-700">Verification / authorization notes
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="e.g. Checked with parent in person on…"/>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="mt-1"/>I have confirmed this relationship with the family and checked the required consent.</label>
              <button type="submit" disabled={saving || !verified || !guardianId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"><ShieldCheck className="h-4 w-4"/>{saving ? 'Saving…' : 'Save verified guardian'}</button>
            </form>
          </>}
          {message && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
          {children.length === 0 && <p className="text-sm text-slate-600">No active members are currently marked with the child age group. Register or update a child's member profile first.</p>}
        </div>
      </section>
    </div>
  );
};
