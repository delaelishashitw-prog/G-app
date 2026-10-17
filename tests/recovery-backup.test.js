import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BACKUP_TABLES, bytesToBase64, decryptRecoveryBundle, encryptRecoveryBundle, recoveryDigest, verifyRecoveryBundle} from '../src/lib/recoveryBackup.ts';

const owner='11111111-1111-4111-8111-111111111111',source='44444444-4444-4444-8444-444444444444';
const password='Separate backup passphrase 2026';
async function fixture({files=false,photoSize=0}={}) {
  const tables=Object.fromEntries(BACKUP_TABLES.map(table=>[table,[]]));
  tables['public.members']=[{id:'member-one',first_name:'Synthetic member',profile_photo_url:'data:image/jpeg;base64,'+'A'.repeat(photoSize)}];
  tables['public.church_accounts']=[{id:'cash',current_balance:10895.55}];
  tables['public.gwcc_documents']=[{namespace:'foundation_students',id:'foundation-one',data:{completed_modules:[1,2,3]}},{namespace:'assets',id:'asset-one',data:{name:'Synthetic sound system'}}];
  tables['gwcc_private.sms_dispatches']=[{id:'test-dispatch',state:'unknown',snapshot:{recipients:[{phone:'233240000001'}]}}];
  const bytes=new Uint8Array([0,1,2,3,255]);
  const stored=files?[{bucket:'gwcc-media',name:'members/photo.jpg',data:bytesToBase64(bytes),digest:await recoveryDigest(bytes),mime:'image/jpeg'}]:[];
  const doc={format:'gwcc-records-v1',source_id:source,created_at:'2026-10-16T22:00:00Z',tables,counts:Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,rows.length])),storage_objects:stored.map(({bucket,name})=>({bucket,name})),exclusions:['Supabase Auth accounts and sessions']};
  const payload_text=JSON.stringify(doc);
  return {format:'gwcc-recovery-v1',project_ref:'gwcc-e2e',exported_at:'2026-10-16T22:01:00Z',cloud:{id:source,payload_text,digest:await recoveryDigest(payload_text)},files:stored,
    device:{owner,pending_text:JSON.stringify({owner,batches:[{id:source,createdAt:'2026-10-16T22:00:00Z',attempts:0,changes:[{table:'members',id:'pending-member',operation:'upsert',record:{id:'pending-member',profile_photo_url:'data:image/png;base64,AA=='}}]}],versions:{}}),preferences:{gwcc_momo_name:'Synthetic account'}}};
}
async function replaceSnapshot(bundle,change) {
  const snapshot=JSON.parse(bundle.cloud.payload_text);change(snapshot);
  bundle.cloud.payload_text=JSON.stringify(snapshot);bundle.cloud.digest=await recoveryDigest(bundle.cloud.payload_text);return bundle;
}

test('encrypted recovery round-trip preserves financial values, all modules, private SMS safety state, photos and device operations',async()=>{
  const original=await fixture({files:true,photoSize:2*1024*1024});
  const raw=await encryptRecoveryBundle(original,password);
  assert.ok(!raw.includes('Synthetic member'));assert.ok(!raw.includes('233240000001'));assert.ok(!raw.includes(password));assert.ok(!raw.includes('current_balance'));
  const {bundle,summary}=await decryptRecoveryBundle(raw,password,'gwcc-e2e',source);
  assert.deepEqual(bundle,original);assert.equal(summary.tables,BACKUP_TABLES.length);assert.equal(summary.records,5);assert.equal(summary.files,1);assert.equal(summary.pending,1);
  assert.equal(summary.snapshot.tables['public.members'][0].profile_photo_url.length,2*1024*1024+23);
  assert.equal(summary.snapshot.tables['public.church_accounts'][0].current_balance,10895.55);
  const again=await encryptRecoveryBundle(original,password);assert.notEqual(JSON.parse(raw).salt,JSON.parse(again).salt);assert.notEqual(JSON.parse(raw).iv,JSON.parse(again).iv);
});
test('wrong passwords, changed ciphertext and excessive work factors fail before accepting an archive',async()=>{
  const raw=await encryptRecoveryBundle(await fixture(),password);
  await assert.rejects(decryptRecoveryBundle(raw,'Incorrect passphrase'),/incorrect|damaged/i);
  const corrupted=JSON.parse(raw);corrupted.data=(corrupted.data[0]==='A'?'B':'A')+corrupted.data.slice(1);
  await assert.rejects(decryptRecoveryBundle(JSON.stringify(corrupted),password),/incorrect|damaged/i);
  const expensive=JSON.parse(raw);expensive.iterations=2000000000;
  await assert.rejects(decryptRecoveryBundle(JSON.stringify(expensive),password),/encrypted GWCC/);
  await assert.rejects(encryptRecoveryBundle(await fixture(),'short'),/12 to 256/);
  await assert.rejects(decryptRecoveryBundle('{"version":"1.0","data":{}}',password),/Older partial JSON/);
});
test('incomplete tables, mismatched counts and foreign project/database recovery files are rejected',async()=>{
  const missing=await replaceSnapshot(await fixture(),doc=>delete doc.tables['public.welfare_claims']);
  await assert.rejects(verifyRecoveryBundle(missing),/every supported church table/);
  const counts=await replaceSnapshot(await fixture(),doc=>doc.counts['public.members']=4);
  await assert.rejects(verifyRecoveryBundle(counts),/count failed/);
  await assert.rejects(verifyRecoveryBundle(await fixture(),'another-project'),/different Supabase project/);
  await assert.rejects(verifyRecoveryBundle(await fixture(),null,owner),/different church database/);
  const checksum=await fixture();checksum.cloud.payload_text+=' ';
  await assert.rejects(verifyRecoveryBundle(checksum),/checksum failed/);
});
test('missing, duplicated, damaged and unsafe storage objects cannot be labelled a complete recovery file',async()=>{
  const missing=await fixture({files:true});missing.files=[];
  await assert.rejects(verifyRecoveryBundle(missing),/missing storage files/);
  const damaged=await fixture({files:true});damaged.files[0].data='AAAA';
  await assert.rejects(verifyRecoveryBundle(damaged),/missing, duplicated or damaged/);
  const unsafe=await replaceSnapshot(await fixture({files:true}),doc=>doc.storage_objects[0].name='../private');
  await assert.rejects(verifyRecoveryBundle(unsafe),/storage coverage/);
  const wrongOwner=await fixture();wrongOwner.device.owner=source;
  await assert.rejects(verifyRecoveryBundle(wrongOwner),/different account/);
});
test('legacy unreadable device data remains encrypted and visible for review while malformed batches are rejected',async()=>{
  const original=await fixture();
  const pending=JSON.parse(original.device.pending_text);pending.unreadable='preserved legacy queue bytes';
  original.device.pending_text=JSON.stringify(pending);
  const checked=await decryptRecoveryBundle(await encryptRecoveryBundle(original,password),password);
  assert.equal(checked.summary.device_review_required,true);assert.equal(JSON.parse(checked.bundle.device.pending_text).unreadable,pending.unreadable);
  pending.batches[0].changes[0].record.id='different-id';original.device.pending_text=JSON.stringify(pending);
  await assert.rejects(verifyRecoveryBundle(original),/Pending changes are unreadable/);
});
test('the SQL coverage manifest matches encrypted archives and includes every application module',()=>{
  const file=fs.readdirSync('supabase/migrations').find(name=>name.endsWith('_complete_recovery_backups.sql'));
  const sql=fs.readFileSync(`supabase/migrations/${file}`,'utf8');
  const manifest=sql.slice(sql.indexOf('AS $$SELECT ARRAY['),sql.indexOf(']::text[];$$;'));
  assert.deepEqual([...manifest.matchAll(/'((?:public|gwcc_private)\.[a-z_]+)'/g)].map(match=>match[1]),[...BACKUP_TABLES]);
  for(const table of ['public.gwcc_documents','public.church_accounts','public.church_finances','public.welfare_claims','public.roster_assignments','public.child_check_ins','gwcc_private.sms_dispatches','public.gwcc_applied_operations'])assert.ok(BACKUP_TABLES.includes(table));
});
