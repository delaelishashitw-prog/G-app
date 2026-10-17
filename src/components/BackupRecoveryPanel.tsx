import React, {useEffect, useRef, useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {getSupabaseClient, getStoredSupabaseConfig, getSupabaseProjectRef, exportPendingChanges, restorePendingChanges} from '../lib/supabase';
import {bytesToBase64, decryptRecoveryBundle, encryptRecoveryBundle, MAX_RECOVERY_FILE_BYTES, recoveryDigest, verifyCloudBackup,
  type CloudBackup, type RecoveryBundle, type RecoveryStatus, type RecoverySummary} from '../lib/recoveryBackup';

const preferences = ['gwcc_momo_number','gwcc_momo_name','gwcc_telecel_number','gwcc_bank_name','gwcc_bank_account','gwcc_bank_branch',
  'gwcc_sunday_time','gwcc_midweek_time','gwcc_allnight_time','gwcc_cell_time'];
const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50';
const date = (value: string) => new Date(value).toLocaleString('en-GH', {timeZone: 'Africa/Accra'});

export function BackupRecoveryPanel() {
  const {currentUser} = useAuth();
  return currentUser.role === 'super_admin' ? <AdministratorRecovery key={currentUser.id} owner={currentUser.id}/> :
    <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Church recovery files are managed by the reviewed super administrator.</p>;
}

function AdministratorRecovery({owner}: {owner: string}) {
  const [status, setStatus] = useState<RecoveryStatus | null>(null), [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [filePassword, setFilePassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<{bundle: RecoveryBundle; summary: RecoverySummary} | null>(null);
  const active = useRef(true), working = useRef(false), fileInput = useRef<HTMLInputElement>(null);
  const config = getStoredSupabaseConfig(), project = getSupabaseProjectRef(config.url);
  const client = getSupabaseClient();
  const rpc = async (name: string, args = {}) => {
    if (!client || !navigator.onLine) throw new Error('Connect to the internet and sign in before using cloud recovery points.');
    const {data: identity, error: identityError} = await client.auth.getUser();
    if (identityError || identity.user?.id !== owner || !active.current) throw new Error('The signed-in account changed. Sign in again before continuing.');
    const {data, error: requestError} = await client.rpc(name, args);
    if (requestError) throw new Error(requestError.message);
    if (!active.current) throw new Error('The signed-in account changed.');
    return data;
  };
  const load = async (preferred?: string) => {
    const result: RecoveryStatus = await rpc('gwcc_backup_status');
    if (!result || !Array.isArray(result.points) || typeof result.source_id !== 'string') throw new Error('Recovery status could not be read.');
    setStatus(result);
    setSelected(current => result.points.some(point => point.id === (preferred || current)) ? (preferred || current) : result.points[0]?.id || '');
    return result;
  };
  const action = async (label: string, work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(label); setError(''); setMessage('');
    try {await work();} catch (err) {if (active.current) setError((err as Error).message);}
    finally {working.current = false; if (active.current) setBusy('');}
  };
  useEffect(() => {
    active.current = true;
    void action('Loading', async () => {await load();});
    return () => {active.current = false;};
  }, [owner]);

  const create = () => action('Creating', async () => {
    const id = await rpc('gwcc_backup_create');
    await load(id); setMessage('Recovery point created from cloud-confirmed records. Device pending changes are included separately when you download.');
  });
  const rehearse = () => action('Rehearsing', async () => {
    const result = await rpc('gwcc_backup_rehearse', {p_id: selected});
    await load(); setMessage(`${result.tables_checked} tables reconstructed successfully. Live church records were not overwritten.`);
  });
  const download = () => action('Preparing download', async () => {
    if (!project || !status) throw new Error('Reload recovery status first.');
    if (password !== confirmation) throw new Error('The backup passphrases do not match.');
    if (password.length < 12 || password.length > 256 || !password.trim()) throw new Error('Choose a backup passphrase of 12 to 256 characters.');
    const cloud: CloudBackup = await rpc('gwcc_backup_export', {p_id: selected});
    const snapshot = await verifyCloudBackup(cloud);
    if (snapshot.source_id !== status.source_id) throw new Error('This point belongs to a different church database.');
    await rpc('gwcc_backup_media_check', {p_id: selected});
    const files: RecoveryBundle['files'] = [];
    let totalBytes = 0;
    for (const entry of snapshot.storage_objects) {
      const {data: blob, error: storageError} = await client!.storage.from(entry.bucket).download(entry.name);
      if (storageError || !blob) throw new Error(`A storage file could not be preserved: ${entry.name}. No recovery file was downloaded.`);
      totalBytes += blob.size;
      if (blob.size > 20 * 1024 * 1024 || totalBytes > 30 * 1024 * 1024) throw new Error('Storage files exceed the browser backup limit. Arrange an administrator storage backup.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      files.push({...entry, data: bytesToBase64(bytes), digest: await recoveryDigest(bytes), mime: blob.type || 'application/octet-stream'});
    }
    await rpc('gwcc_backup_media_check', {p_id: selected});
    const localPreferences: Record<string, string> = {};
    for (const key of preferences) {const value = localStorage.getItem(key); if (value !== null) localPreferences[key] = value;}
    const bundle: RecoveryBundle = {format: 'gwcc-recovery-v1', project_ref: project, exported_at: new Date().toISOString(), cloud, files,
      device: {owner, pending_text: exportPendingChanges(), preferences: localPreferences}};
    const encrypted = await encryptRecoveryBundle(bundle, password);
    // Recheck identity after slow downloads/encryption, before creating a downloadable URL.
    const {data: identity, error: identityError} = await client!.auth.getUser();
    if (!active.current || identityError || identity.user?.id !== owner) throw new Error('The signed-in account changed. No recovery file was downloaded.');
    const url = URL.createObjectURL(new Blob([encrypted], {type: 'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = `GWCC-recovery-${snapshot.created_at.slice(0,10)}-${cloud.id.slice(0,8)}.gwcc.json`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPassword(''); setConfirmation(''); setMessage('Encrypted download prepared. Save it outside this app and keep its passphrase separately. Use Check recovery file to verify your saved copy.');
  });
  const check = () => action('Checking file', async () => {
    setReview(null);
    if (!file) throw new Error('Choose an encrypted recovery file.');
    if (file.size > MAX_RECOVERY_FILE_BYTES) throw new Error('Choose a recovery file smaller than 96 MB.');
    const result = await decryptRecoveryBundle(await file.text(), filePassword, project || undefined, status?.source_id);
    if (!active.current) return;
    setReview(result); setFilePassword(''); setMessage('File checks passed. No cloud records or device pending changes were restored by this check.');
  });
  const restorePending = () => action('Restoring pending changes', async () => {
    if (!review || review.bundle.device.owner !== owner) throw new Error('Pending changes can only be restored by their original account.');
    if (review.summary.device_review_required) throw new Error('Keep this file for administrator review of its preserved legacy device data.');
    const count = await restorePendingChanges(review.bundle.device.pending_text);
    if (active.current) setMessage(`${count} pending change(s) restored for review. Use the sync controls to review them before Retry sync. Nothing was sent by this restore action.`);
  });
  const newest = status?.points[0], point = status?.points.find(item => item.id === selected);
  const stale = Boolean(newest && Date.now() - Date.parse(newest.created_at) > 36 * 60 * 60 * 1000);
  return <section aria-label="Church backup and recovery" className="space-y-5 max-w-4xl">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div><h2 className="text-base font-bold text-slate-900">Church backup and recovery</h2>
        <p className="mt-1 text-sm text-slate-600">Preserve all church record tables, including welfare, finance, rosters, foundation records, private delivery ledgers and embedded photos.</p></div>
      <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-2">
        <p><strong>Daily record recovery:</strong> {status ? status.daily_enabled ? 'Scheduled at 03:00 GMT; latest 7 daily points retained.' : 'Not scheduled. Contact the project administrator.' : 'Status unavailable until loaded.'}</p>
        <p><strong>Latest point:</strong> {newest ? date(newest.created_at) : 'No point loaded.'}</p>
        {status?.last_run && <p><strong>Last scheduled run:</strong> {status.last_run.status}{status.last_run.ended_at ? ` — ${date(status.last_run.ended_at)}` : ''}</p>}
        {stale && <p role="alert" className="text-amber-800">The latest point is over 36 hours old. Create a fresh point and check the daily job.</p>}
        <p className="text-xs text-slate-600">Daily points stay in this project. Download encrypted copies for protection if the project is lost. Storage files and this device’s pending changes are added to downloads.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={Boolean(busy)} onClick={() => void action('Loading', async () => {await load();})}>Reload recovery points</button>
        <button type="button" className={button} disabled={Boolean(busy)} onClick={() => void create()}>Create recovery point</button>
      </div>
      <label className="block text-sm font-semibold">Recovery point
        <select aria-label="Recovery point" value={selected} onChange={event => setSelected(event.target.value)} className={`${field} mt-1`} disabled={Boolean(busy) || !status?.points.length}>
          {!status?.points.length && <option value="">Create a recovery point first</option>}
          {status?.points.map(item => <option key={item.id} value={item.id}>{date(item.created_at)} — {item.kind}</option>)}
        </select>
      </label>
      {point && <div className="text-sm text-slate-600 space-y-2">
        <p>{Object.keys(point.counts).length} tables · {Object.values(point.counts).reduce((sum, count) => sum + count, 0).toLocaleString()} records · {(point.byte_count / 1024 / 1024).toFixed(1)} MB · {point.media_count} storage files referenced</p>
        <p>{point.rehearsed_at ? `Records rehearsed: ${date(point.rehearsed_at)}` : 'This point has not had a record recovery rehearsal.'}</p>
        <button type="button" className={button} disabled={Boolean(busy)} onClick={() => void rehearse()}>Rehearse selected point</button>
        <p className="text-xs">A rehearsal checks saved values against the current record structure without overwriting live church records.</p>
      </div>}
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <h3 className="font-bold">Download encrypted recovery file</h3>
      <p className="text-sm text-slate-600">Choose a separate passphrase with at least 12 characters. It cannot be recovered by the church office. Save the file and passphrase in separate secure places.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Backup passphrase<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className={`${field} mt-1`} maxLength={256} disabled={Boolean(busy)}/></label>
        <label className="text-sm font-semibold">Confirm backup passphrase<input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} className={`${field} mt-1`} maxLength={256} disabled={Boolean(busy)}/></label>
      </div>
      <button type="button" className={button} disabled={Boolean(busy) || !selected} onClick={() => void download()}>Download encrypted backup</button>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <h3 className="font-bold">Check a saved recovery file</h3>
      <input ref={fileInput} type="file" accept="application/json,.json" aria-label="Encrypted recovery file" className="block w-full text-sm" disabled={Boolean(busy)} onChange={event => {setFile(event.target.files?.[0] || null); setReview(null); setError(''); setMessage('');}}/>
      <label className="block text-sm font-semibold">File passphrase<input type="password" autoComplete="off" value={filePassword} onChange={event => {setFilePassword(event.target.value); setReview(null);}} className={`${field} mt-1`} maxLength={256} disabled={Boolean(busy)}/></label>
      <button type="button" className={button} disabled={Boolean(busy) || !file} onClick={() => void check()}>Check recovery file</button>
      {review && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm space-y-2" aria-label="Verified recovery file">
        <p><strong>File checks passed:</strong> {review.summary.tables} tables, {review.summary.records.toLocaleString()} records, {review.summary.files} storage files and {review.summary.pending} pending device changes.</p>
        <p>Records captured: {date(review.summary.snapshot.created_at)}</p>
        {review.summary.device_review_required && <p className="text-amber-900">Legacy or unreadable device data is preserved in this file. Keep it for administrator review before restoring pending work.</p>}
        {review.summary.pending > 0 && <button type="button" className={button} disabled={Boolean(busy) || review.bundle.device.owner !== owner || review.summary.device_review_required} onClick={() => void restorePending()}>Restore this device’s pending changes</button>}
        {review.summary.pending > 0 && review.bundle.device.owner !== owner && <p>Sign in as the original account to restore these pending device changes.</p>}
      </div>}
      <p className="text-xs text-slate-600">Cloud record restoration requires administrator review of account links, balances and delivery history. Full Supabase project backups also cover login accounts and database configuration; these files do not contain passwords, provider keys or login sessions.</p>
      {project && <a className="inline-block text-sm text-emerald-800 underline" href={`https://supabase.com/dashboard/project/${project}/database/backups/scheduled`} target="_blank" rel="noopener noreferrer">Open Supabase project backups</a>}
    </div>
    {busy && <p role="status" className="text-sm text-slate-600">{busy}…</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
  </section>;
}
