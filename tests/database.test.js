import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const root='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';

export async function setupDatabase({beforeSecurityUpgrade,beforeFinanceControls}={}) {
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
    CREATE SCHEMA auth;CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT COALESCE(current_setting('request.jwt.claims',true),'{}')::jsonb$$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO authenticated,anon;
    CREATE TABLE storage.buckets(id text primary key,name text,public boolean);
    CREATE TABLE storage.objects(id text primary key,bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
  for(const file of fs.readdirSync('supabase/migrations').filter(file=>file.endsWith('.sql')).sort()) {
    if(file.endsWith('_secure_operations_release.sql') && beforeSecurityUpgrade) await beforeSecurityUpgrade(db);
    if(file.endsWith('_finance_receipt_controls.sql') && beforeFinanceControls) await beforeFinanceControls(db);
    const sql=fs.readFileSync(`supabase/migrations/${file}`,'utf8').replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/g,'');
    try {await db.exec(sql);} catch(error) {await db.close();throw new Error(`${file}: ${error.message} ${error.where || ''}`);}
  }
  await db.exec(`INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
    ('${root}','root@example.test',now(),'{}'),('${member}','member@example.test',now(),'{"role":"super_admin"}'),('${other}','other@example.test',now(),'{}');
    UPDATE public.profiles SET role='super_admin',authorization_reviewed_at=now() WHERE id='${root}';`);
  return db;
}
async function asUser(db,id,fn) {
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${id}',false)`);
  try{return await fn();}finally{await db.exec('RESET ROLE');}
}
let op=0;
const operation=()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(++op).padStart(12,'0')}`;
const apply=(db,changes,id=operation())=>db.query('SELECT public.gwcc_apply_mutations($1,$2) AS result',[id,JSON.stringify(changes)]);
const upsert=(table,record,expected)=>({table,id:record.id,operation:'upsert',record,expected_updated_at:expected});
const reconcile=(db,original,recovery,changes)=>db.query('SELECT public.gwcc_reconcile_sync_operation($1,$2,$3) AS result',[original,recovery,JSON.stringify(changes)]);

test('new finance references are server-assigned and collision-safe while historical duplicate references and balances remain intact',async()=>{
  let before;
  const db=await setupDatabase({beforeFinanceControls:async(db)=>{
    await db.exec("INSERT INTO public.church_accounts(id,name,current_balance,opening_balance,currency,is_active) VALUES('legacy-bank','Legacy Bank',100,100,'GHS',true); INSERT INTO public.church_finances(id,account_id,account_name,transaction_type,title,category,amount,currency,date,status,reference_no) VALUES('legacy-one','legacy-bank','Legacy Bank','income','One','Review',2,'GHS','2026-10-01','completed','OLD-DUP'),('legacy-two','legacy-bank','Legacy Bank','income','Two','Review',3,'GHS','2026-10-02','completed','OLD-DUP');");
    before=(await db.query("SELECT to_jsonb(a) AS doc FROM public.church_accounts a WHERE id='legacy-bank'")).rows[0].doc;
  }});
  try{
    assert.deepEqual((await db.query("SELECT to_jsonb(a) AS doc FROM public.church_accounts a WHERE id='legacy-bank'")).rows[0].doc,before);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.church_finances WHERE reference_no='OLD-DUP'")).rows[0].n,2);
    await asUser(db,root,async()=>{
      const receipt={id:'numbered',transaction_type:'income',account_id:'legacy-bank',title:'New receipt',amount:10,currency:'GHS',date:'2026-10-16',status:'completed',reference_no:'PENDING-browser-id'};
      const operationId=operation(),first=(await apply(db,[upsert('church_finances',receipt)],operationId)).rows[0].result;
      assert.match(first[0].record.reference_no,/^INC-2026-\d{6,}$/);assert.deepEqual((await apply(db,[upsert('church_finances',receipt)],operationId)).rows[0].result,first);
      await assert.rejects(apply(db,[upsert('church_finances',{...receipt,id:'duplicate',reference_no:'old-dup'})]),/reference is already in use/);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM public.church_finances WHERE id='duplicate'")).rows[0].n,0);
      const legacy=(await db.query("SELECT to_jsonb(f) AS doc FROM public.church_finances f WHERE id='legacy-one'")).rows[0].doc;
      await apply(db,[upsert('church_finances',{...legacy,title:'Reviewed title'},legacy.updated_at)]);
      assert.equal((await db.query("SELECT reference_no FROM public.church_finances WHERE id='legacy-one'")).rows[0].reference_no,'OLD-DUP');
      const custom=(await apply(db,[upsert('church_finances',{...receipt,id:'custom',reference_no:' Bank#Ref "Quoted" '})])).rows[0].result[0].record;
      assert.equal(custom.reference_no,'Bank#Ref "Quoted"');
      await assert.rejects(apply(db,[upsert('church_finances',{...receipt,id:'custom-duplicate',reference_no:'bank#ref "quoted"'})]),/already in use/);
      await assert.rejects(db.query('SELECT * FROM gwcc_private.finance_reference_reservations'),/permission denied/);
      await assert.rejects(apply(db,[upsert('church_accounts',{id:'nan-account',name:'Bad',current_balance:'NaN',currency:'GHS'})]),/gwcc_finite_account_balances/);
      await assert.rejects(apply(db,[upsert('church_accounts',{id:'null-account',name:'Bad',current_balance:null,currency:'GHS'})]),/not-null|gwcc_finite_account_balances/);
    });
  }finally{await db.close();}
});

test('cash denomination sheets validate witnesses, amount and physical account; duplicate service/date postings are atomic and voidable',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec("INSERT INTO public.services(id,name,type,day_of_week,start_time,end_time,is_active) VALUES('cash-service','Cash service','sunday','Sunday','08:00','10:00',true)");
    await asUser(db,root,async()=>{
      await apply(db,[upsert('church_accounts',{id:'cash',name:'Cash',account_type:'cash_petty',current_balance:0,currency:'GHS'}),upsert('church_accounts',{id:'cash-other',name:'Other cash',account_type:'cash_petty',current_balance:0,currency:'GHS'}),upsert('church_accounts',{id:'bank',name:'Bank',account_type:'bank',current_balance:100,currency:'GHS'})]);
      const receipt={id:'count',account_id:'cash',account_name:'Cash',transaction_type:'income',amount:20.5,currency:'GHS',date:'2026-10-11',title:'Count',payment_method:'cash',status:'completed',cash_count_service_id:'cash-service',cash_count_key:'untrusted-key',cash_count_details:{denominations:{10:2,0.5:1},counter1:'One Counter',counter2:'Two Counter',supervisor:'Supervisor',recorded_by_user_id:other}};
      const reject=async(changes,regex)=>await assert.rejects(apply(db,[upsert('church_finances',{...receipt,id:'rejected',...changes})]),regex);
      await reject({account_id:'bank'},/cash account/);await reject({cash_count_service_id:'missing'},/active service/);
      await reject({status:null},/valid receipt status/);await reject({transaction_type:null},/valid transaction type/);
      await reject({currency:null},/valid currency/);await reject({payment_method:null},/cash income receipt/);
      await reject({amount:21},/match its counted denominations/);
      await reject({cash_count_details:{...receipt.cash_count_details,counter2:'One Counter'}},/different counter/);
      await reject({cash_count_details:{...receipt.cash_count_details,counter1:123}},/different counter/);
      await reject({cash_count_details:{...receipt.cash_count_details,denominations:{10:2.5}}},/whole, non-negative/);
      const saved=(await apply(db,[upsert('church_finances',receipt)])).rows[0].result[0].record;
      assert.equal(saved.cash_count_key,'cash-service:2026-10-11');assert.equal(saved.cash_count_details.recorded_by_user_id,root);assert.match(saved.reference_no,/^CASH-2026-\d{6,}$/);
      await assert.rejects(apply(db,[upsert('church_finances',{...receipt,id:'duplicate-count',account_id:'cash-other'})]),/already recorded/);
      assert.deepEqual((await db.query("SELECT id,current_balance::float AS balance FROM public.church_accounts WHERE id IN ('cash','cash-other') ORDER BY id")).rows,[{id:'cash',balance:20.5},{id:'cash-other',balance:0}]);
      await assert.rejects(apply(db,[upsert('church_finances',{...saved,amount:21},saved.updated_at)]),/Void this cash count/);
      await apply(db,[upsert('church_finances',{...saved,status:'voided',void_reason:'Recount'},saved.updated_at)]);
      await apply(db,[upsert('church_finances',{...receipt,id:'replacement'})]);
      assert.equal((await db.query("SELECT current_balance::float AS balance FROM public.church_accounts WHERE id='cash'")).rows[0].balance,20.5);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM public.church_finances WHERE cash_count_key='cash-service:2026-10-11'")).rows[0].n,2);
    });
  }finally{await db.close();}
});

test('budget period validation is enforced by the database and prevents concurrent overlapping allocations without changing ledger balances',async()=>{
  const db=await setupDatabase();
  try{await asUser(db,root,async()=>{
    const budget={id:'budget',department:'Facilities',period:'2026 Annual',allocated_amount:1000,spent_amount:0,currency:'GHS'};
    await apply(db,[upsert('department_budgets',budget)]);
    await assert.rejects(apply(db,[upsert('department_budgets',{...budget,id:'overlap',department:' facilities ',period:'Q1-2026'})]),/overlapping period/);
    await apply(db,[upsert('department_budgets',{...budget,id:'next-year',period:'2027 Annual'})]);
    await apply(db,[upsert('department_budgets',{...budget,id:'other-currency',currency:'USD'})]);
    await assert.rejects(apply(db,[upsert('department_budgets',{...budget,id:'unknown',period:'Legacy'})]),/supported budget period/);
    await assert.rejects(apply(db,[upsert('department_budgets',{...budget,id:'negative',allocated_amount:-1})]),/positive allocation/);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.gwcc_documents WHERE namespace='department_budgets'")).rows[0].n,3);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.church_finances')).rows[0].n,0);
  });}finally{await db.close();}
});

test('legacy recovery confirms 20 saved records and saves only the outstanding 21st record, with immutable retry receipts',async()=>{
  const db=await setupDatabase();
  try{await asUser(db,root,async()=>{
    const original=operation(),recovery=operation();
    const saved=[upsert('settings',{id:'recovery-settings',church_name:'Recovery Church'}),...Array.from({length:19},(_,i)=>upsert('members',{
      id:`recovery-${i}`,first_name:'Saved',last_name:String(i),phone:'0240000000',number_of_children:'2',created_at:'2026-10-15T12:00:00.000Z'
    }))];
    const receipt=(await apply(db,saved,original)).rows[0].result;
    const pending=[...saved,upsert('members',{id:'recovery-last',first_name:'Memory',last_name:'Only',phone:'0240000001',profile_photo_url:'data:image/jpeg;base64,'+'A'.repeat(110000)})];
    await assert.rejects(apply(db,pending,original),/Operation ID was reused/);
    const versions=await db.query("SELECT id,updated_at FROM public.members WHERE id LIKE 'recovery-%' ORDER BY id");
    const audits=(await db.query('SELECT count(*)::int AS n FROM public.audit_logs')).rows[0].n;
    const result=(await reconcile(db,original,recovery,pending)).rows[0].result;
    assert.equal(result.length,21);assert.equal(result.find(r=>r.record?.id==='recovery-last').record.profile_photo_url,pending.at(-1).record.profile_photo_url);
    assert.deepEqual((await db.query("SELECT id,updated_at FROM public.members WHERE id LIKE 'recovery-%' AND id<>'recovery-last' ORDER BY id")).rows,versions.rows);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.audit_logs')).rows[0].n,audits+1);
    assert.deepEqual((await reconcile(db,original,recovery,pending)).rows[0].result,result);
    assert.deepEqual((await apply(db,saved,original)).rows[0].result,receipt);
    await assert.rejects(reconcile(db,original,recovery,pending.slice(1)),/Recovery request ID was reused/);
    await assert.rejects(apply(db,pending,original),/Operation ID was reused/);
  });}finally{await db.close();}
});

test('recovery respects later edits and deletions, rejects stale or unversioned overwrites atomically, and allows current versions',async()=>{
  const db=await setupDatabase();
  try{await asUser(db,root,async()=>{
    const original=operation(),saved=[upsert('members',{id:'recovery-edited',first_name:'Original',last_name:'Member',phone:'0240000000'})];
    await apply(db,saved,original);
    const get=async()=> (await db.query("SELECT to_jsonb(m) AS doc FROM public.members m WHERE id='recovery-edited'")).rows[0]?.doc;
    const first=await get();
    await apply(db,[upsert('members',{...first,first_name:'Later'},first.updated_at)]);
    const later=await get(),newMember=upsert('members',{id:'recovery-atomic',first_name:'New',last_name:'Member',phone:'0240000001'});
    const result=(await reconcile(db,original,operation(),[...saved,newMember])).rows[0].result;
    assert.equal(result.find(r=>r.record?.id==='recovery-edited').record.first_name,'Later');assert.equal((await get()).first_name,'Later');
    const stale=[upsert('members',{id:'recovery-rollback',first_name:'Rollback',last_name:'Member',phone:'0240000002'}),upsert('members',{...first,first_name:'Unsaved'},first.updated_at)];
    await assert.rejects(reconcile(db,original,operation(),stale),/Sync conflict/);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.members WHERE id='recovery-rollback'")).rows[0].n,0);
    await assert.rejects(reconcile(db,original,operation(),[upsert('members',{...later,first_name:'Unversioned'})]),/Sync conflict/);
    await reconcile(db,original,operation(),[upsert('members',{...later,first_name:'Reviewed'},later.updated_at)]);
    assert.equal((await get()).first_name,'Reviewed');
    await apply(db,[{table:'members',operation:'delete',id:'recovery-edited'}]);
    assert.deepEqual((await reconcile(db,original,operation(),saved)).rows[0].result,[{table:'members',id:'recovery-edited',deleted:true}]);
    await assert.rejects(reconcile(db,original,operation(),[upsert('members',{...first,first_name:'Resurrect'})]),/was removed/);
  });}finally{await db.close();}
});

test('recovery denies anonymous, member and inactive access, direct receipt access, mixed financial batches and unrelated ID reuse',async()=>{
  const db=await setupDatabase(),original=operation(),recovery=operation();
  const saved=[upsert('members',{id:'recovery-auth',first_name:'Saved',last_name:'Member',phone:'0240000000'})];
  try{
    await db.exec('SET ROLE anon');await assert.rejects(reconcile(db,original,recovery,saved),/permission denied/);await db.exec('RESET ROLE');
    await asUser(db,member,async()=>await assert.rejects(reconcile(db,original,recovery,saved),/Staff authorization/));
    await asUser(db,root,async()=>{
      await assert.rejects(db.query('SELECT * FROM gwcc_private.sync_recoveries'),/permission denied/);
      await apply(db,saved,original);
      await assert.rejects(reconcile(db,original,recovery,[...saved,upsert('church_finances',{id:'never-replayed',amount:50})]),/financial and other changes have been retained/);
      await assert.rejects(reconcile(db,original,recovery,[{table:'members',id:'recovery-auth',operation:'delete'}]),/supports member and settings saves only/);
      await assert.rejects(reconcile(db,original,recovery,[upsert('members',{id:'unrelated',first_name:'Other',last_name:'Member'})]),/does not match/);
      await assert.rejects(reconcile(db,original,recovery,[...saved,...saved]),/Duplicate records/);
      await reconcile(db,original,recovery,saved);
    });
    await db.exec(`UPDATE public.profiles SET is_active=false WHERE id='${root}'`);
    await asUser(db,root,async()=>await assert.rejects(reconcile(db,original,recovery,saved),/Staff authorization/));
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.church_finances WHERE id='never-replayed'")).rows[0].n,0);
  }finally{await db.close();}
});

test('an augmented legacy request never seen by the cloud recovers under the new ID without overwriting unversioned records',async()=>{
  const db=await setupDatabase();
  try{await asUser(db,root,async()=>{
    const original=operation(),recovery=operation(),changes=[upsert('members',{id:'recovery-unsent',first_name:'First',last_name:'Save',phone:'0240000000'})];
    assert.equal((await reconcile(db,original,recovery,changes)).rows[0].result.length,1);
    assert.deepEqual((await reconcile(db,original,recovery,changes)).rows[0].result,(await reconcile(db,original,recovery,changes)).rows[0].result);
    await assert.rejects(reconcile(db,operation(),operation(),[upsert('members',{...changes[0].record,first_name:'Stale'})]),/Sync conflict/);
    await assert.rejects(reconcile(db,original,recovery,[upsert('members',{...changes[0].record,first_name:'Changed'})]),/Recovery request ID was reused/);
  });}finally{await db.close();}
});

test('member login linking is atomic, root-only, identity-specific and cannot reuse another person’s account',async()=>{
  const db=await setupDatabase();
  const link=(id,uid,email)=>db.query('SELECT public.gwcc_link_member_login($1,$2,$3) AS result',[id,uid,email]);
  try{
    await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone) VALUES
      ('portal-a','GWCC-PORTAL-A','Own','Member','0240000001'),('portal-b','GWCC-PORTAL-B','Other','Member','0240000002');`);
    await db.exec('SET ROLE anon');await assert.rejects(link('portal-a',member,'member@example.test'),/permission denied/);await db.exec('RESET ROLE');
    await asUser(db,member,async()=>await assert.rejects(link('portal-a',member,'member@example.test'),/super administrator/));
    await asUser(db,root,async()=>{
      await assert.rejects(link('portal-a',root,'root@example.test'),/active member account/);
      await assert.rejects(link('portal-a',member,'different@example.test'),/email changed/);
      await assert.rejects(link('missing',member,'member@example.test'),/not found/);
      await link('portal-a',member,'  MEMBER@example.test  ');
      await link('portal-a',member,'member@example.test'); // Safe retry of the same exact link.
      await assert.rejects(link('portal-b',member,'member@example.test'),/already assigned/);
      await assert.rejects(link('portal-a',other,'other@example.test'),/different login/);
    });
    assert.deepEqual((await db.query("SELECT id,auth_user_id FROM public.members WHERE id LIKE 'portal-%' ORDER BY id")).rows,[{id:'portal-a',auth_user_id:member},{id:'portal-b',auth_user_id:null}]);
    assert.deepEqual((await db.query('SELECT member_id,role FROM public.profiles WHERE id=$1',[member])).rows,[{member_id:'portal-a',role:'member'}]);
    await db.exec("INSERT INTO public.giving(id,member_id,category,amount) VALUES('portal-own-gift','portal-a','Tithe',100),('portal-other-gift','portal-b','Tithe',200)");
    await asUser(db,member,async()=>{
      assert.deepEqual((await db.query("SELECT id FROM public.members WHERE id LIKE 'portal-%'")).rows,[{id:'portal-a'}]);
      assert.deepEqual((await db.query("SELECT id FROM public.giving WHERE id LIKE 'portal-%'")).rows,[{id:'portal-own-gift'}]);
      await assert.rejects(link('portal-b',member,'member@example.test'),/super administrator/);
    });
  }finally{await db.close();}
});

test('linking preserves suspended accounts and archived members; pending invitations cannot read member records before verification',async()=>{
  const db=await setupDatabase();
  const link=()=>db.query("SELECT public.gwcc_link_member_login('portal-pending',$1,'member@example.test')",[member]);
  try{
    await db.exec("INSERT INTO public.members(id,member_id,first_name,last_name,phone,is_archived) VALUES('portal-pending','GWCC-PENDING','Pending','Member','0240000001',true)");
    await asUser(db,root,async()=>await assert.rejects(link(),/restore/));
    await db.exec(`UPDATE public.members SET is_archived=false WHERE id='portal-pending';UPDATE public.profiles SET is_active=false WHERE id='${member}'`);
    await asUser(db,root,async()=>await assert.rejects(link(),/active member account/));
    await db.exec(`UPDATE public.profiles SET is_active=true WHERE id='${member}';UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${member}'`);
    await asUser(db,root,link);
    await asUser(db,member,async()=>{
      assert.equal((await db.query('SELECT public.current_user_role() AS role')).rows[0].role,'disabled');
      assert.equal((await db.query("SELECT id FROM public.members WHERE id='portal-pending'")).rows.length,0);
    });
    await db.exec(`UPDATE auth.users SET email_confirmed_at=now() WHERE id='${member}'`);
    await asUser(db,member,async()=>assert.deepEqual((await db.query("SELECT id FROM public.members WHERE id='portal-pending'")).rows,[{id:'portal-pending'}]));
  }finally{await db.close();}
});

test('release snapshot preserves original rows privately and a retry cannot overwrite recovery data',async()=>{
  const snapshot=fs.readFileSync('supabase/release-snapshot.sql','utf8');
  const db=await setupDatabase({beforeSecurityUpgrade:async db=>{
    await db.exec("INSERT INTO public.church_accounts(id,name,current_balance) VALUES('snapshot-account','Recovery account',123.45)");
    await db.exec(snapshot);
  }});
  try {
    const original=(await db.query("SELECT content,checksum FROM gwcc_release_backup_20261015.snapshots WHERE name='public.church_accounts'")).rows[0];
    assert.equal(original.content[0].current_balance,123.45);
    await db.exec(`SELECT set_config('gwcc.release_administrator','${root}',false);`+fs.readFileSync('supabase/release-validate.sql','utf8'));
    await db.exec("UPDATE public.church_accounts SET name='Changed after snapshot'");
    await db.exec(snapshot);
    assert.deepEqual((await db.query("SELECT content,checksum FROM gwcc_release_backup_20261015.snapshots WHERE name='public.church_accounts'")).rows[0],original);
    await assert.rejects(db.exec(fs.readFileSync('supabase/release-validate.sql','utf8')),/changed or lost 1 original rows/);
    await asUser(db,root,async()=>await assert.rejects(db.query('SELECT * FROM gwcc_release_backup_20261015.snapshots'),/permission denied/));
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM gwcc_release_backup_20261015.snapshots'),/permission denied/);
    await db.exec('RESET ROLE');
  } finally {await db.close();}
});

test('standalone live mitigation removes unsigned access and direct role edits while preserving signed-in access and money',async()=>{
  const db=await setupDatabase({beforeSecurityUpgrade:async db=>{
    const legacyUser='44444444-4444-4444-8444-444444444444';
    await db.exec(`INSERT INTO public.church_accounts(id,name,current_balance) VALUES('legacy','Legacy',123.45);
      INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('${legacyUser}','finance@example.test',now());
      INSERT INTO public.profiles(id,first_name,last_name,email,role) VALUES('${legacyUser}','Finance','Staff','finance@example.test','finance_officer');`);
    const mitigation=fs.readFileSync('supabase/migrations/20261015162757_restrict_legacy_public_access.sql','utf8');
    await db.exec(mitigation);
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.members'),/permission denied/);
    await assert.rejects(db.query("UPDATE public.profiles SET role='super_admin'"),/permission denied/);
    await db.exec(`RESET ROLE;SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${legacyUser}',false)`);
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='legacy'")).rows[0].current_balance,'123.45');
    await assert.rejects(db.query("UPDATE public.profiles SET role='super_admin'"),/permission denied/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='legacy'")).rows[0].current_balance,'123.45');
  }});
  await db.close();
});

test('upgrade preserves legacy directory contacts and balances without inheriting email-matched staff authority',async()=>{
  const account='44444444-4444-4444-8444-444444444444';
  const db=await setupDatabase({beforeSecurityUpgrade:async db=>{
    // Observed SQL Editor installation: missing welfare tables, required profile
    // names, and a globally unique email on a directory ID different from Auth.
    await db.exec(`DROP TABLE public.welfare_event_contributions; DROP TABLE public.welfare_events;
      ALTER TABLE public.profiles ALTER COLUMN first_name SET NOT NULL;
      ALTER TABLE public.profiles ALTER COLUMN last_name SET NOT NULL;
      ALTER TABLE public.profiles ALTER COLUMN email SET NOT NULL;
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE(email);
      INSERT INTO public.profiles(id,first_name,last_name,email,role) VALUES('old-directory','Legacy','Staff','legacy@example.test','super_admin');
      INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('${account}','legacy@example.test',now());
      INSERT INTO public.church_accounts(id,name,current_balance) VALUES('existing-account','Existing',123.45);`);
  }});
  try{
    assert.deepEqual((await db.query("SELECT id,email,role,has_login_account FROM public.profiles WHERE email='legacy@example.test' ORDER BY id")).rows,[
      {id:account,email:'legacy@example.test',role:'member',has_login_account:true},
      {id:'old-directory',email:'legacy@example.test',role:'super_admin',has_login_account:false},
    ]);
    assert.deepEqual((await db.query("SELECT current_balance,opening_balance FROM public.church_accounts WHERE id='existing-account'")).rows,[{current_balance:'123.45',opening_balance:'123.45'}]);
    await asUser(db,account,async()=>assert.equal((await db.query('SELECT public.current_user_role() AS role')).rows[0].role,'member'));
    await asUser(db,root,async()=>await assert.rejects(db.query("SELECT public.gwcc_manage_profile('old-directory','{\"has_login_account\":true}')"),/directory record cannot become a login/));
    await db.exec("INSERT INTO public.profiles(id,email,role,has_login_account) VALUES('new-directory',NULL,'member',false)");
    const sql=fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(file=>file.endsWith('_secure_operations_release.sql')),'utf8');
    await db.exec(sql);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.profiles WHERE email='legacy@example.test'")).rows[0].n,2);
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='existing-account'")).rows[0].current_balance,'123.45');
  }finally{await db.close();}
});

test('committed migrations deny anonymous access and self-promotion, allow own giving, and revoke inactive users',async()=>{
  const db=await setupDatabase();
  try {
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.members'),/permission denied/);
    await assert.rejects(db.query('DELETE FROM public.audit_logs'),/permission denied/);
    await db.exec('RESET ROLE');
    await asUser(db,member,async()=>{
      assert.equal((await db.query('SELECT public.current_user_role() AS role')).rows[0].role,'member');
      await assert.rejects(db.query("UPDATE public.profiles SET role='super_admin'"),/permission denied/);
      await assert.rejects(apply(db,[upsert('members',{id:'attack',first_name:'No',last_name:'Access'})]),/Staff authorization/);
    });
    await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone,auth_user_id) VALUES('own','GWCC-TEST-A','Own','Member','0240000001','${member}'),('other','GWCC-TEST-B','Other','Member','0240000002','${other}');
      INSERT INTO public.giving(id,member_id,category,amount) VALUES('own-giving','own','Tithe',100),('other-giving','other','Tithe',200)`);
    await asUser(db,member,async()=>{
      const rows=(await db.query('SELECT id FROM public.giving ORDER BY id')).rows;
      assert.deepEqual(rows,[{id:'own-giving'}]);
      await assert.rejects(db.query("DELETE FROM public.giving WHERE id='own-giving'"),/permission denied/);
    });
    await db.exec(`UPDATE public.profiles SET is_active=false WHERE id='${root}'`);
    await asUser(db,root,async()=>assert.equal((await db.query('SELECT public.current_user_role() AS role')).rows[0].role,'disabled'));
  } finally {await db.close();}
});

test('money mutations preserve both transfer legs, reject overdrafts, are idempotent, and require current versions',async()=>{
  const db=await setupDatabase();
  try {await asUser(db,root,async()=>{
    await apply(db,[upsert('church_accounts',{id:'A',name:'A',current_balance:100}),upsert('church_accounts',{id:'B',name:'B',current_balance:0})]);
    const receipt={id:'transfer',transaction_type:'transfer',account_id:'A',to_account_id:'B',title:'Move funds',amount:20,status:'completed'};
    const requestId=operation();await apply(db,[upsert('church_finances',receipt)],requestId);await apply(db,[upsert('church_finances',receipt)],requestId);
    assert.deepEqual((await db.query('SELECT id,current_balance::float AS balance FROM public.church_accounts ORDER BY id')).rows,[{id:'A',balance:80},{id:'B',balance:20}]);
    const current=(await db.query("SELECT * FROM public.church_finances WHERE id='transfer'")).rows[0];
    await assert.rejects(apply(db,[upsert('church_finances',{...receipt,amount:200})]),/version is required/);
    await apply(db,[upsert('church_finances',{...receipt,status:'voided',void_reason:'Corrected'},current.updated_at.toISOString())]);
    assert.deepEqual((await db.query('SELECT id,current_balance::float AS balance FROM public.church_accounts ORDER BY id')).rows,[{id:'A',balance:100},{id:'B',balance:0}]);
    await assert.rejects(apply(db,[upsert('church_finances',{...receipt,id:'overdraft',amount:200})]),/Insufficient balance/);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.church_finances WHERE id='overdraft'")).rows[0].n,0);
    await assert.rejects(apply(db,[upsert('church_finances',{...receipt,status:'completed'},current.updated_at.toISOString())]),/another device/);
    await assert.rejects(db.query("UPDATE public.church_accounts SET current_balance=99999"),/permission denied/);
  });}finally{await db.close();}
});

test('member IDs are centrally allocated, custom tithe collisions are rejected, and failed batches roll back',async()=>{
  const db=await setupDatabase();
  try {await asUser(db,root,async()=>{
    await apply(db,[upsert('members',{id:'new1',member_id:'PENDING-same',phone:'0240000000',first_name:'New','last_name':'One'}),upsert('members',{id:'new2',member_id:'PENDING-same',phone:'0240000000',first_name:'New','last_name':'Two'})]);
    const rows=(await db.query("SELECT member_id,tithe_number FROM public.members WHERE id IN ('new1','new2')")).rows;
    assert.equal(new Set(rows.map(row=>row.member_id)).size,2);assert.equal(new Set(rows.map(row=>row.tithe_number)).size,2);
    await assert.rejects(apply(db,[upsert('members',{id:'rollback',phone:'0240000000',first_name:'Must','last_name':'Rollback'}),upsert('members',{id:'collision',phone:'0240000000',first_name:'Duplicate','last_name':'Tithe',tithe_number:rows[0].tithe_number})]),/already assigned/);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.members WHERE id='rollback'")).rows[0].n,0);
  });}finally{await db.close();}
});

test('welfare receipts reconcile atomically, disbursements require real ledger entries, and repair scripts stay closed',async()=>{
  const db=await setupDatabase();
  try{await asUser(db,root,async()=>{
    await apply(db,[upsert('church_accounts',{id:'cash',name:'Cash',current_balance:100}),upsert('welfare_events',{id:'appeal',title:'Aid',category:'other',member_id:'M',member_name:'Member',description:'Support',end_date:'2026-10-31',minimum_contribution:20,created_by:'Root'})]);
    const receipt={id:'welfare-receipt',title:'Aid receipt',account_id:'cash',transaction_type:'income',amount:20,status:'completed'};
    const contribution={id:'contribution',event_id:'appeal',member_id:'M',contributor_name:'Donor',amount:20,payment_status:'confirmed',recorded_by:'Root',finance_linked:true,finance_transaction_id:receipt.id};
    await apply(db,[upsert('church_finances',receipt),upsert('welfare_event_contributions',contribution)]);
    const version=async(table,id)=>(await db.query(`SELECT updated_at FROM public.${table} WHERE id=$1`,[id])).rows[0].updated_at.toISOString();
    await assert.rejects(apply(db,[upsert('church_finances',{...receipt,status:'voided'},await version('church_finances',receipt.id))]),/linked welfare/);
    assert.equal((await db.query("SELECT current_balance::float AS b FROM public.church_accounts WHERE id='cash'")).rows[0].b,120);
    await apply(db,[upsert('church_finances',{...receipt,amount:30},await version('church_finances',receipt.id)),upsert('welfare_event_contributions',{...contribution,amount:30})]);
    assert.equal((await db.query("SELECT current_balance::float AS b FROM public.church_accounts WHERE id='cash'")).rows[0].b,130);
    await apply(db,[upsert('church_finances',{...receipt,amount:30,status:'voided'},await version('church_finances',receipt.id)),upsert('welfare_event_contributions',{...contribution,amount:30,payment_status:'voided'})]);
    assert.equal((await db.query("SELECT current_balance::float AS b FROM public.church_accounts WHERE id='cash'")).rows[0].b,100);
    const claim={id:'claim',claim_number:'BEN-TEST',member_id:'M',member_name:'Member',category:'emergency_relief',title:'Aid',description:'Request',amount_requested:50,amount_approved:50,amount_disbursed:50,status:'disbursed',disbursements:[{amount:50,finance_transaction_id:'payout'}]};
    await assert.rejects(apply(db,[upsert('welfare_claims',claim)]),/treasury receipt/);
    await apply(db,[upsert('church_finances',{id:'payout',title:'Aid payout',account_id:'cash',transaction_type:'disbursement',amount:50,status:'completed'}),upsert('welfare_claims',claim)]);
    assert.equal((await db.query("SELECT current_balance::float AS b FROM public.church_accounts WHERE id='cash'")).rows[0].b,50);
    await assert.rejects(apply(db,[upsert('welfare_claims',{...claim,amount_disbursed:0})]),/total does not match/);
  });
    // A later use of the in-app repair SQL must not restore anonymous access or reset money.
    const {SQL_FIX_RLS_SCHEMA}=await import('../src/lib/supabaseSchema.ts');await db.exec(SQL_FIX_RLS_SCHEMA);
    const grants=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND (has_table_privilege('anon', quote_ident(schemaname)||'.'||quote_ident(tablename), 'SELECT') OR has_table_privilege('anon',quote_ident(schemaname)||'.'||quote_ident(tablename),'INSERT,UPDATE,DELETE'))")).rows;
    assert.deepEqual(grants,[]);
    assert.equal((await db.query("SELECT current_balance::float AS b FROM public.church_accounts WHERE id='cash'")).rows[0].b,50);
    await db.exec('SET ROLE anon');await assert.rejects(db.query("SELECT public.gwcc_apply_mutations(gen_random_uuid(),'[]')"),/permission denied/);await db.exec('RESET ROLE');
  }finally{await db.close();}
});

test('roster notifications persist under ownership rules and child pickup tokens cannot be duplicated or released to an unlisted person',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone,auth_user_id) VALUES('own','GWCC-TEST-A','Own','Member','0240000001','${member}'),('other','GWCC-TEST-B','Other','Member','0240000002','${other}')`);
    await asUser(db,root,async()=>{
      await apply(db,[upsert('services',{id:'roster-service',name:'Sunday',type:'sunday',day_of_week:'Sunday',start_time:'08:00',end_time:'10:30'}),upsert('roster_assignments',{id:'own-duty',service_id:'roster-service',member_id:'own',member_name:'Own Member',service_name:'Sunday',role_title:'Usher'}),upsert('roster_assignments',{id:'other-duty',service_id:'roster-service',member_id:'other',member_name:'Other Member',service_name:'Sunday',role_title:'Choir'})]);
      const child={id:'child',security_code:'GWCC-ABCDEF123456',child_name:'Child',age_group:'juniors',class_room:'A',service_id:'S',service_name:'Sunday',date:'2026-10-15',check_in_time:'08:00',parent_name:'Parent',parent_phone:'0240000001',status:'checked_in'};
      await apply(db,[upsert('child_check_ins',child)]);
      await assert.rejects(apply(db,[upsert('child_check_ins',{...child,id:'duplicate'})]),/unique constraint/);
      await assert.rejects(apply(db,[upsert('child_check_ins',{...child,status:'checked_out',checked_out_to_person:'Stranger'})]),/authorized guardian/);
      await apply(db,[upsert('child_check_ins',{...child,status:'checked_out',checked_out_to_person:'Parent'})]);
      assert.equal((await db.query("SELECT verified_by_leader FROM public.child_check_ins WHERE id='child'")).rows[0].verified_by_leader,root);
      await assert.rejects(apply(db,[upsert('child_check_ins',{...child,status:'checked_out',checked_out_to_person:'Parent'})]),/already been checked out/);
    });
    await asUser(db,member,async()=>{
      assert.deepEqual((await db.query('SELECT DISTINCT member_id FROM public.roster_notifications')).rows,[{member_id:'own'}]);
      await assert.rejects(db.query("SELECT public.gwcc_member_action('roster','other-duty','{\"status\":\"confirmed\"}')"),/not your duty/);
      await db.query("SELECT public.gwcc_member_action('roster','own-duty','{\"status\":\"confirmed\"}')");
      assert.equal((await db.query("SELECT status FROM public.roster_assignments WHERE id='own-duty'")).rows[0].status,'confirmed');
      await db.query("SELECT public.gwcc_member_action('notification_read','all','{}')");
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.roster_notifications WHERE read_at IS NULL')).rows[0].n,0);
      await assert.rejects(db.query("SELECT public.gwcc_manage_profile($1,'{\"role\":\"super_admin\"}')",[member]),/super administrator/);
      await db.query("SELECT public.gwcc_member_action('profile','own','{\"phone\":\"0249999999\",\"is_active\":true,\"auth_user_id\":\"11111111-1111-4111-8111-111111111111\"}')");
      assert.equal((await db.query("SELECT auth_user_id FROM public.members WHERE id='own'")).rows[0].auth_user_id,member);
      await db.query("SELECT public.gwcc_member_action('prayer','own','{\"request\":\"Please pray\",\"category\":\"general\"}')");
      assert.equal((await db.query('SELECT request FROM public.prayer_requests')).rows[0].request,'Please pray');
      await db.query("SELECT public.gwcc_member_action('welfare','own','{\"title\":\"Aid\",\"description\":\"Support\",\"category\":\"emergency_relief\",\"amount_requested\":20}')");
      assert.equal((await db.query("SELECT public.gwcc_member_records('welfare_claims') AS rows")).rows[0].rows.length,1);
    });
  }finally{await db.close();}
});


test('service safeguards preserve legacy history, reject new broken links, protect used services and persist announcements',async()=>{
  const db=await setupDatabase({beforeSecurityUpgrade:async db=>{
    await db.exec("INSERT INTO public.attendance(id,service_id,service_name,date) VALUES('legacy-service-attendance','deleted-service','Historical Sunday','2026-10-04')");
  }});
  try {
    assert.equal((await db.query("SELECT count(*)::int n FROM public.attendance WHERE id='legacy-service-attendance'")).rows[0].n,1);
    await asUser(db,root,async()=>{
      for(const table of ['attendance','headcounts','roster_assignments','giving']) {
        const id='guard-'+table;
        await apply(db,[upsert('services',{id,name:'Guard '+table,type:'sunday',day_of_week:'Sunday',start_time:'08:00',end_time:'10:30',announcements:'Orientation after service',announcements_minister:'QA Secretary'})]);
        const row={id:'record-'+table,service_id:id,service_name:'Guard '+table,date:'2026-10-11',member_id:'qa-service-person',member_name:'QA',role_title:'Usher',department:'ushers_protocol',category:'Offering',amount:50};
        await apply(db,[upsert(table,row)]);
        await assert.rejects(apply(db,[{table:'services',id,operation:'delete'}]),/foreign key|history.*archived/i);
        await apply(db,[upsert('services',{id,is_active:false})]);
        await assert.rejects(apply(db,[upsert(table,{...row,id:'invalid-'+table,service_id:'missing-service'})]),/foreign key/i);
      }
      const saved=(await db.query("SELECT announcements,announcements_minister FROM public.services WHERE id='guard-attendance'")).rows[0];
      assert.deepEqual(saved,{announcements:'Orientation after service',announcements_minister:'QA Secretary'});
      await assert.rejects(apply(db,[upsert('services',{id:'bad-service',name:'Invalid',type:'sunday',day_of_week:'Sunday',start_time:'08:00',end_time:'08:00',expected_attendance:-1})]),/check constraint/);
    });
    await db.exec(`UPDATE public.profiles SET role='attendance_officer',authorization_reviewed_at=now() WHERE id='${member}'`);
    await asUser(db,member,async()=>{
      assert.ok((await db.query('SELECT id FROM public.services')).rows.length>0);
      await assert.rejects(apply(db,[upsert('services',{id:'unauthorized',name:'Not allowed'})]),error=>error.code==='42501');
    });
    assert.equal((await db.query("SELECT count(*)::int n FROM public.attendance WHERE id='legacy-service-attendance'")).rows[0].n,1);
  }finally{await db.close();}
});

test('attendance integrity classifies visitors, rejects duplicates and invalid tallies, and restricts write access',async()=>{
  const db=await setupDatabase();
  try{
    await asUser(db,root,async()=>{
      await apply(db,[upsert('services',{id:'attendance-service',name:'Test service',type:'sunday',day_of_week:'Sunday',start_time:'08:00',end_time:'10:30'})]);
      const row={id:'visit-one',service_id:'attendance-service',service_name:'Test service',date:'2026-10-11',visitor_id:'visitor',person_type:'member',status:'present'};
      await apply(db,[upsert('attendance',row)]);
      assert.equal((await db.query("SELECT person_type FROM public.attendance WHERE id='visit-one'")).rows[0].person_type,'visitor');
      await assert.rejects(apply(db,[upsert('attendance',{...row,id:'visit-duplicate'})]),/unique constraint/);
      await assert.rejects(apply(db,[upsert('attendance',{...row,id:'both',member_id:'member'})]),/exactly one/);
      await assert.rejects(apply(db,[upsert('attendance',{...row,id:'none',visitor_id:null})]),/exactly one/);
      await assert.rejects(apply(db,[upsert('attendance',{...row,id:'future',date:'2999-01-01'})]),/check constraint/);
      await assert.rejects(apply(db,[upsert('attendance',{...row,id:'bad-status',status:'unknown'})]),/check constraint/);
      const head={id:'head',service_id:'attendance-service',date:'2026-10-11',men:2,women:3,youth:4,children:5,visitors:1,ushers_protocol:2,online_viewers:7,total_auditorium:17};
      await apply(db,[upsert('headcounts',head)]);
      await assert.rejects(apply(db,[upsert('headcounts',{...head,id:'head-duplicate'})]),/unique constraint/);
      await assert.rejects(apply(db,[upsert('headcounts',{...head,date:'2026-10-10',id:'head-negative',men:-1,total_auditorium:14})]),/check constraint/);
      await assert.rejects(apply(db,[upsert('headcounts',{...head,date:'2026-10-10',id:'head-bad-total',total_auditorium:999})]),/check constraint/);
      await apply(db,[upsert('services',{id:'archive',name:'Archived original',type:'special',day_of_week:'',start_time:'',end_time:'',is_active:false})]);
      await assert.rejects(apply(db,[upsert('services',{id:'archive',is_active:true})]),/check constraint/);
    });
    await asUser(db,member,async()=>{
      await assert.rejects(apply(db,[upsert('attendance',{id:'unauthorized',service_id:'attendance-service',member_id:'member',date:'2026-10-11'})]),error=>error.code==='42501');
    });
    await db.exec(`UPDATE public.profiles SET role='attendance_officer',authorization_reviewed_at=now() WHERE id='${other}'`);
    await asUser(db,other,async()=>{
      await apply(db,[upsert('attendance',{id:'officer',service_id:'attendance-service',member_id:'member',date:'2026-10-11'})]);
      assert.equal((await db.query("SELECT person_type FROM public.attendance WHERE id='officer'")).rows[0].person_type,'member');
    });
  }finally{await db.close();}
});

test('service history recovery preserves original IDs and overlapping sessions, leaves ambiguous names untouched and is repeatable',async()=>{
  const db=await setupDatabase({beforeSecurityUpgrade:async db=>{
    await db.exec(`INSERT INTO public.attendance(id,service_id,service_name,date,member_id) VALUES
      ('history-one','old-one','Former Sunday','2026-10-04','history-member'),
      ('history-two','old-two','Former Sunday','2026-10-04','history-member'),
      ('ambiguous-one','ambiguous','One service','2026-10-04','history-other'),
      ('ambiguous-two','ambiguous','Another service','2026-10-11','history-other');`);
  }});
  try{
    const before=(await db.query('SELECT id,service_id,date,member_id FROM public.attendance ORDER BY id')).rows;
    const recovery=fs.readFileSync('scripts/recover-service-history.sql','utf8');
    await db.exec(recovery);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.services WHERE id IN ('old-one','old-two') AND NOT is_active AND start_time='' AND end_time='' AND day_of_week=''")).rows[0].n,2);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.services WHERE id='ambiguous'")).rows[0].n,0);
    assert.deepEqual((await db.query('SELECT id,service_id,date,member_id FROM public.attendance ORDER BY id')).rows,before);
    await db.exec(recovery);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.audit_logs WHERE action='RESTORE_SERVICE_REFERENCES'")).rows[0].n,1);
  }finally{await db.close();}
});
