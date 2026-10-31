import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { MEMBER_DIRECTORY_COLUMNS } from '../src/lib/memberPrivacy.ts';

const root='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';

export async function setupDatabase({beforeSecurityUpgrade,beforeFinanceControls,beforeCommunicationControls,beforeApprovalControls,beforePledgeControls}={}) {
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
    CREATE SCHEMA auth;CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE auth.mfa_factors(id uuid primary key,user_id uuid,factor_type text,status text);
    CREATE TABLE auth.sessions(id uuid primary key,user_id uuid,factor_id uuid,aal text,not_after timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT COALESCE(current_setting('request.jwt.claims',true),'{}')::jsonb$$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO authenticated,anon;
    CREATE TABLE storage.buckets(id text primary key,name text,public boolean);
    CREATE TABLE storage.objects(id text primary key,bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
  for(const file of fs.readdirSync('supabase/migrations').filter(file=>file.endsWith('.sql')).sort()) {
    if(file.endsWith('_secure_operations_release.sql') && beforeSecurityUpgrade) await beforeSecurityUpgrade(db);
    if(file.endsWith('_finance_receipt_controls.sql') && beforeFinanceControls) await beforeFinanceControls(db);
    if(file.endsWith('_communication_draft_controls.sql') && beforeCommunicationControls) await beforeCommunicationControls(db);
    if(file.endsWith('_financial_payment_approvals.sql') && beforeApprovalControls) await beforeApprovalControls(db);
    if(file.endsWith('_pledge_payment_receipts.sql') && beforePledgeControls)await beforePledgeControls(db);
    const sql=fs.readFileSync(`supabase/migrations/${file}`,'utf8').replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/g,'');
    try {await db.exec(sql);} catch(error) {await db.close();throw new Error(`${file}: ${error.message} ${error.where || ''}`);}
  }
  await db.exec(`INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
    ('${root}','root@example.test',now(),'{}'),('${member}','member@example.test',now(),'{"role":"super_admin"}'),('${other}','other@example.test',now(),'{}');
    UPDATE public.profiles SET role='super_admin',authorization_reviewed_at=now() WHERE id='${root}';
    INSERT INTO auth.mfa_factors SELECT id,id,'totp','verified' FROM auth.users WHERE id<>'${member}';
    INSERT INTO auth.sessions SELECT id,id,id,'aal2',NULL FROM auth.users WHERE id<>'${member}';`);
  return db;
}
async function asUser(db,id,fn,claims={aal:'aal2',session_id:id,role:'authenticated'}) {
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${id}',false)`);
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
  try{return await fn();}finally{await db.exec('RESET ROLE');}
}

test('confidential member notes survive directory edits but are hidden from direct reads, own-profile replies and retry receipts',async()=>{
  const db=await setupDatabase();
  try{
    await db.query("INSERT INTO public.members(id,member_id,first_name,last_name,phone,auth_user_id,notes) VALUES('private-member','PRIVATE-1','Synthetic','Member','0240000001',$1,'Confidential fixture')",[member]);
    const migration=fs.readdirSync('supabase/migrations').find(file=>file.endsWith('_protect_member_notes.sql'));
    await db.exec(fs.readFileSync(`supabase/migrations/${migration}`,'utf8'));
    await asUser(db,member,async()=>{
      assert.equal((await db.query("SELECT first_name FROM public.members WHERE id='private-member'")).rows.length,1);
      await assert.rejects(db.query('SELECT notes FROM public.members'),/permission denied/);
      await assert.rejects(db.query('SELECT * FROM public.members'),/permission denied/);
      await assert.rejects(db.query('SELECT * FROM public.gwcc_member_notes()'),/Pastoral authorization/);
      const reply=(await db.query("SELECT public.gwcc_member_action('profile','private-member','{\"phone\":\"0240000002\"}') result")).rows[0].result;
      assert.equal('notes' in reply,false);
    });
    for(const role of ['administrator','finance_officer','welfare_officer','attendance_officer','data_entry','ministry_leader']){
      await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,other]);
      await asUser(db,other,async()=>{
        await assert.rejects(db.query('SELECT notes FROM public.members'),/permission denied/);
        await assert.rejects(db.query('SELECT * FROM public.gwcc_member_notes()'),/Pastoral authorization/);
      });
    }
    await db.query("UPDATE public.profiles SET role='data_entry' WHERE id=$1",[other]);
    const current=(await db.query("SELECT updated_at FROM public.members WHERE id='private-member'")).rows[0];
    const change=upsert('members',{id:'private-member',phone:'0240000003',notes:null},current.updated_at);
    await asUser(db,other,async()=>{
      const reply=(await apply(db,[change])).rows[0].result;
      assert.equal('notes' in reply[0].record,false);
    });
    assert.equal((await db.query("SELECT notes FROM public.members WHERE id='private-member'")).rows[0].notes,'Confidential fixture');
    const changes=[upsert('members',{id:'private-member',phone:'0240000003'})],id=operation();
    await db.query("INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result) VALUES($1,$2,md5($3::jsonb::text),$4)",[other,id,JSON.stringify(changes),JSON.stringify([{table:'members',record:{id:'private-member',notes:'Confidential fixture'}}])]);
    await asUser(db,other,async()=>assert.equal('notes' in (await apply(db,changes,id)).rows[0].result[0].record,false));
    for(const role of ['super_admin','senior_pastor','pastor']){
      await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,root]);
      await asUser(db,root,async()=>assert.equal((await db.query("SELECT notes FROM public.gwcc_member_notes() WHERE id='private-member'")).rows[0].notes,'Confidential fixture'));
    }
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.gwcc_member_notes()'),/permission denied/);await db.exec('RESET ROLE');
  }finally{await db.close();}
});

test('AI attendance data remains behind actual RLS, reviewed roles, live session and MFA checks',async()=>{
  const db=await setupDatabase();
  try {
    await asUser(db,root,async()=>{
      await apply(db,[upsert('services',{id:'ai-test-service',name:'Synthetic AI service',type:'sunday',day_of_week:'Sunday',start_time:'08:00',end_time:'10:30'})]);
      await apply(db,[upsert('attendance',{id:'ai-test-row',service_id:'ai-test-service',service_name:'Synthetic AI service',date:'2026-10-18',member_id:'synthetic-ai-person',status:'present'})]);
    });
    const select=()=>db.query("SELECT id,service_id,service_name,date,status,member_id,visitor_id FROM public.attendance WHERE date BETWEEN '2026-10-01' AND '2026-10-21' AND id='ai-test-row'");
    for(const role of ['super_admin','senior_pastor','administrator','pastor','attendance_officer']) {
      await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,root]);
      await asUser(db,root,async()=>assert.equal((await select()).rows.length,1,role));
    }
    await asUser(db,member,async()=>assert.equal((await select()).rows.length,0,'member'));
    await db.query('UPDATE public.profiles SET is_active=false WHERE id=$1',[root]);
    await asUser(db,root,async()=>assert.equal((await select()).rows.length,0,'disabled account'));
    await db.query("UPDATE public.profiles SET is_active=true,role='administrator' WHERE id=$1",[root]);
    await asUser(db,root,async()=>assert.equal((await select()).rows.length,0,'MFA required'),{aal:'aal1',session_id:root,role:'authenticated'});
    await db.query('UPDATE auth.sessions SET not_after=now()-interval \'1 minute\' WHERE user_id=$1',[root]);
    await asUser(db,root,async()=>assert.equal((await select()).rows.length,0,'expired session'));
  } finally {await db.close();}
});
let op=0;
const operation=()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(++op).padStart(12,'0')}`;
const apply=(db,changes,id=operation())=>db.query('SELECT public.gwcc_apply_mutations($1,$2) AS result',[id,JSON.stringify(changes)]);
const upsert=(table,record,expected)=>({table,id:record.id,operation:'upsert',record,expected_updated_at:expected});
const reconcile=(db,original,recovery,changes)=>db.query('SELECT public.gwcc_reconcile_sync_operation($1,$2,$3) AS result',[original,recovery,JSON.stringify(changes)]);

test('recovery points include all records and private safety ledgers, rehearse without touching live rows, and preserve daily/manual retention',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec(`INSERT INTO public.members(id,first_name,last_name,member_id,phone,profile_photo_url) VALUES('backup-member','Synthetic','Member','BACKUP-1','0240000001','data:image/png;base64,AA==');
      INSERT INTO public.church_accounts(id,name,current_balance,opening_balance,currency) VALUES('backup-cash','Synthetic cash',10895.55,10895.55,'GHS');
      INSERT INTO public.gwcc_documents(namespace,id,data) VALUES('foundation_students','backup-student','{"completed_modules":[1,2]}');
      INSERT INTO gwcc_private.sms_dispatches(id,actor_id,request_hash,snapshot,estimated_units,state) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${root}','backup-hash','{"is_test":true}',1,'unknown');`);
    const before=(await db.query('SELECT to_jsonb(a) doc FROM public.church_accounts a')).rows;
    let id;
    await asUser(db,root,async()=>{
      id=(await db.query('SELECT public.gwcc_backup_create() id')).rows[0].id;
      const status=(await db.query('SELECT public.gwcc_backup_status() doc')).rows[0].doc;
      assert.equal(status.daily_enabled,false);assert.equal(status.points.length,1);assert.equal(status.points[0].counts['public.members'],1);
      assert.ok(!('payload_text' in status.points[0]));
      const exported=(await db.query('SELECT public.gwcc_backup_export($1) doc',[id])).rows[0].doc;
      const doc=JSON.parse(exported.payload_text);
      assert.equal(doc.tables['public.members'][0].profile_photo_url,'data:image/png;base64,AA==');
      assert.equal(doc.tables['public.church_accounts'][0].current_balance,10895.55);
      assert.equal(doc.tables['gwcc_private.sms_dispatches'][0].state,'unknown');assert.equal(doc.tables['public.gwcc_documents'][0].namespace,'foundation_students');
      const result=(await db.query('SELECT public.gwcc_backup_rehearse($1) doc',[id])).rows[0].doc;
      assert.equal(result.tables_checked,status.tables.length);
      assert.equal((await db.query('SELECT public.gwcc_backup_media_check($1) ok',[id])).rows[0].ok,true);
      await db.query('SELECT public.gwcc_backup_create()');
      await assert.rejects(db.query('SELECT public.gwcc_backup_create()'),/Two recent manual/);
    });
    assert.deepEqual((await db.query('SELECT to_jsonb(a) doc FROM public.church_accounts a')).rows,before);
    assert.equal((await db.query('SELECT state FROM gwcc_private.sms_dispatches')).rows[0].state,'unknown');
    assert.equal((await db.query('SELECT count(*)::int n FROM gwcc_private.recovery_points')).rows[0].n,2);
    await db.exec(`INSERT INTO storage.objects(id,bucket_id,name) VALUES('new-file','gwcc-media','new.jpg')`);
    await asUser(db,root,()=>assert.rejects(db.query('SELECT public.gwcc_backup_media_check($1)',[id]),/Storage files changed/));
    await db.exec(`UPDATE gwcc_private.recovery_points SET created_at=now()-interval '11 minutes';`);
    await asUser(db,root,()=>db.query('SELECT public.gwcc_backup_create()'));
    assert.equal((await db.query('SELECT count(*)::int n FROM gwcc_private.recovery_points')).rows[0].n,2);
    await db.exec(`SELECT set_config('request.jwt.claim.sub','',false);
      INSERT INTO gwcc_private.recovery_points(slot,kind,created_at,payload_text,digest,counts,byte_count,media_count)
      SELECT 'older-daily-'||n,'daily',now()-make_interval(days=>n),payload_text,digest,counts,byte_count,media_count
      FROM (SELECT * FROM gwcc_private.recovery_points LIMIT 1) p CROSS JOIN generate_series(1,8) n;`);
    const daily=(await db.query("SELECT gwcc_private.backup_capture('daily') id")).rows[0].id;
    assert.equal((await db.query("SELECT gwcc_private.backup_capture('daily') id")).rows[0].id,daily);
    assert.equal((await db.query("SELECT count(*)::int n FROM gwcc_private.recovery_points WHERE kind='daily'")).rows[0].n,7);
    await db.exec('CREATE TABLE public.future_uncovered_module(id text)');
    await asUser(db,root,()=>assert.rejects(db.query('SELECT public.gwcc_backup_create()'),/new church table/));
    await db.exec('DROP TABLE public.future_uncovered_module');
    await db.exec(`UPDATE gwcc_private.recovery_points SET payload_text=payload_text||' ';`);
    await asUser(db,root,()=>assert.rejects(db.query('SELECT public.gwcc_backup_export($1)',[daily]),/checksum/));
  }finally{await db.close();}
});

test('recovery RPCs deny ordinary staff, unreviewed or disabled administrators, forged metadata and anonymous callers',async()=>{
  const db=await setupDatabase();
  try{
    for(const id of [member,other])await asUser(db,id,async()=>{
      for(const name of ['gwcc_backup_status','gwcc_backup_create'])await assert.rejects(db.query(`SELECT public.${name}()`),/reviewed super administrator/);
      for(const name of ['gwcc_backup_export','gwcc_backup_rehearse','gwcc_backup_media_check'])await assert.rejects(db.query(`SELECT public.${name}($1)`,[root]),/reviewed super administrator/);
      await assert.rejects(db.query('SELECT * FROM gwcc_private.recovery_points'),/permission denied/);
      await assert.rejects(db.query("SELECT gwcc_private.backup_capture('daily')"),/permission denied/);
    });
    for(const role of ['senior_pastor','administrator','finance_officer','pastor']){
      await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,other]);
      await asUser(db,other,()=>assert.rejects(db.query('SELECT public.gwcc_backup_create()'),/reviewed super administrator/));
    }
    await db.exec(`UPDATE public.profiles SET authorization_reviewed_at=NULL WHERE id='${root}'`);
    await asUser(db,root,()=>assert.rejects(db.query('SELECT public.gwcc_backup_status()'),/reviewed super administrator/));
    await db.exec(`UPDATE public.profiles SET authorization_reviewed_at=now(),is_active=false WHERE id='${root}'`);
    await asUser(db,root,()=>assert.rejects(db.query('SELECT public.gwcc_backup_status()'),/reviewed super administrator/));
    await db.exec(`UPDATE public.profiles SET is_active=true WHERE id='${root}';ALTER TABLE auth.users ADD COLUMN banned_until timestamptz;UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='${root}'`);
    await asUser(db,root,()=>assert.rejects(db.query('SELECT public.gwcc_backup_status()'),/reviewed super administrator/));
    const timeout=(await db.query("SELECT proconfig FROM pg_proc WHERE oid='public.gwcc_backup_create()'::regprocedure")).rows[0].proconfig;
    assert.ok(timeout.includes('statement_timeout=30s'));
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT public.gwcc_backup_status()'),/permission denied/);
  }finally{await db.close();}
});

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
    const get=async()=> (await db.query(`SELECT to_jsonb(m) AS doc FROM (SELECT ${MEMBER_DIRECTORY_COLUMNS} FROM public.members WHERE id='recovery-edited') m`)).rows[0]?.doc;
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
    await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated',aal:'aal2',session_id:root})]);
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

const financeRow=async(db,id)=>(await db.query('SELECT to_jsonb(f) AS row FROM public.church_finances f WHERE id=$1',[id])).rows[0].row;
const approval=async(db,row,action,{operationId=operation(),reason='',reference='SYNTHETIC-PAYMENT-1'}={})=>(await db.query('SELECT public.gwcc_finance_approval_action($1,$2,$3,$4,$5,$6) AS result',[operationId,row.id,row.updated_at,action,reason,reference])).rows[0].result;
const enableReviewer=async db=>db.exec(`UPDATE public.profiles SET role='finance_officer',authorization_reviewed_at=now(),first_name='Independent',last_name='Reviewer' WHERE id='${other}'`);
const reviewAndPay=async(db,id)=>{
  const row=await financeRow(db,id);
  const approved=await asUser(db,other,()=>approval(db,row,'approve'));
  return asUser(db,root,()=>approval(db,approved,'paid'));
};

test('payment requests preserve both transfer legs until independent approval and one idempotent payment, reject overdrafts, and require current versions',async()=>{
  const db=await setupDatabase();
  try{
    await enableReviewer(db);
    await asUser(db,root,async()=>{
      await apply(db,[upsert('church_accounts',{id:'A',name:'A',current_balance:100}),upsert('church_accounts',{id:'B',name:'B',current_balance:0})]);
      const receipt={id:'transfer',transaction_type:'transfer',account_id:'A',to_account_id:'B',title:'Move funds',amount:20,status:'completed'};
      const requestId=operation();await apply(db,[upsert('church_finances',receipt)],requestId);await apply(db,[upsert('church_finances',receipt)],requestId);
      assert.deepEqual((await db.query('SELECT id,current_balance::float AS balance FROM public.church_accounts ORDER BY id')).rows,[{id:'A',balance:100},{id:'B',balance:0}]);
      await assert.rejects(approval(db,await financeRow(db,'transfer'),'approve'),/different finance/);
      await assert.rejects(apply(db,[upsert('church_finances',{...receipt,amount:200})]),/version is required/);
      await assert.rejects(db.query('UPDATE public.church_accounts SET current_balance=99999'),/permission denied/);
    });
    const paid=await reviewAndPay(db,'transfer');
    assert.deepEqual((await db.query('SELECT id,current_balance::float AS balance FROM public.church_accounts ORDER BY id')).rows,[{id:'A',balance:80},{id:'B',balance:20}]);
    await asUser(db,root,()=>approval(db,paid,'void',{reason:'Corrected transfer'}));
    assert.deepEqual((await db.query('SELECT id,current_balance::float AS balance FROM public.church_accounts ORDER BY id')).rows,[{id:'A',balance:100},{id:'B',balance:0}]);
    await asUser(db,root,()=>apply(db,[upsert('church_finances',{id:'overdraft',transaction_type:'expense',account_id:'A',title:'Too much',amount:200,status:'completed'})]));
    const approved=await asUser(db,other,async()=>approval(db,await financeRow(db,'overdraft'),'approve'));
    await asUser(db,root,()=>assert.rejects(approval(db,approved,'paid'),/Insufficient balance/));
    assert.equal((await financeRow(db,'overdraft')).approval_state,'approved');
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='A'")).rows[0].current_balance,'100.00');
  }finally{await db.close();}
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
  try{await enableReviewer(db);await asUser(db,root,async()=>{
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
    await assert.rejects(apply(db,[upsert('church_finances',{id:'payout',title:'Aid payout',account_id:'cash',transaction_type:'disbursement',amount:50,status:'completed'}),upsert('welfare_claims',claim)]),/treasury receipt|linked disbursement/);
    await apply(db,[upsert('welfare_claims',{...claim,amount_disbursed:0,status:'approved',disbursements:[]})]);
    await apply(db,[upsert('church_finances',{id:'payout',title:'Aid payout',account_id:'cash',transaction_type:'disbursement',amount:50,status:'completed',welfare_claim_id:'claim'})]);
    await apply(db,[upsert('church_finances',{id:'second-payout',title:'Second request',account_id:'cash',transaction_type:'disbursement',amount:50,status:'pending',welfare_claim_id:'claim'})]);
    assert.equal((await db.query("SELECT amount_disbursed FROM public.welfare_claims WHERE id='claim'")).rows[0].amount_disbursed,'0.00');
  });
    const competing=await asUser(db,other,async()=>approval(db,await financeRow(db,'second-payout'),'approve'));
    await reviewAndPay(db,'payout');
    await asUser(db,root,()=>assert.rejects(approval(db,competing,'paid'),/remaining approved claim/));
    assert.equal((await db.query("SELECT jsonb_array_length(disbursements) AS n FROM public.welfare_claims WHERE id='claim'")).rows[0].n,1);
    const cancelledCompeting=await asUser(db,root,()=>approval(db,competing,'cancel',{reason:'Claim already fully paid'}));assert.equal(cancelledCompeting.status,'cancelled');
    assert.equal((await db.query("SELECT current_balance::float AS b FROM public.church_accounts WHERE id='cash'")).rows[0].b,50);
    assert.equal((await db.query("SELECT amount_disbursed FROM public.welfare_claims WHERE id='claim'")).rows[0].amount_disbursed,'50.00');
    await asUser(db,root,()=>assert.rejects(apply(db,[upsert('welfare_claims',{id:'claim',amount_disbursed:0})]),/total does not match/));
    // A later use of the in-app repair SQL must not restore anonymous access or reset money.
    const {SQL_FIX_RLS_SCHEMA}=await import('../src/lib/supabaseSchema.ts');
    // WASM has no native pg_cron. Production scheduling is verified against the real database.
    await db.exec(SQL_FIX_RLS_SCHEMA.replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/g,''));
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
      const dutyVersion=(await db.query("SELECT updated_at FROM public.roster_assignments WHERE id='own-duty'")).rows[0].updated_at;
      await db.query("SELECT public.gwcc_member_action('roster','own-duty',$1)",[JSON.stringify({status:'confirmed',expected_updated_at:dutyVersion})]);
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

test('communication upgrade preserves historical drafts and server resolves valid unique audience IDs with authenticated authorship',async()=>{
  let original;
  const db=await setupDatabase({beforeCommunicationControls:async db=>{
    await db.exec("INSERT INTO public.communications(id,title,channel,recipient_type,recipient_count,message,sender_id,status,sent_at,created_by) VALUES('legacy-communication','Old draft','sms','custom',42,'Historical text','GWCC','draft','2026-10-01','Original Author')");
    original=(await db.query("SELECT to_jsonb(c) AS doc FROM public.communications c WHERE id='legacy-communication'")).rows[0].doc;
  }});
  try{
    const upgraded=(await db.query("SELECT to_jsonb(c)-ARRAY['recipient_group_id','recipient_group_name','recipient_ids','created_at','updated_at','updated_by','archived_at'] AS doc FROM public.communications c WHERE id='legacy-communication'")).rows[0].doc;
    assert.deepEqual(upgraded,original);
    await asUser(db,root,async()=>{
      await apply(db,[upsert('ministries',{id:'comm-ministry',name:'Synthetic Ministry'}),upsert('small_groups',{id:'comm-group',name:'Synthetic Group',meeting_location:'Synthetic hall',meeting_day:'Wednesday',meeting_time:'18:00'})]);
      await apply(db,[
        upsert('members',{id:'comm-a',first_name:'One',last_name:'Member',phone:'0240000001',status:'active',ministry_id:'comm-ministry',small_group_id:'comm-group'}),
        upsert('members',{id:'comm-b',first_name:'Duplicate',last_name:'Member',phone:'+233240000001',status:'active',ministry_id:'comm-ministry',small_group_id:'comm-group'}),
        upsert('members',{id:'comm-archived',first_name:'Archived',last_name:'Member',phone:'0240000002',status:'active',is_archived:true,ministry_id:'comm-ministry'}),
        upsert('members',{id:'comm-inactive',first_name:'Inactive',last_name:'Member',phone:'0240000003',status:'inactive',ministry_id:'comm-ministry'}),
        upsert('members',{id:'comm-bad',first_name:'Short',last_name:'Member',phone:'23324000001',status:'active',ministry_id:'comm-ministry'}),
        upsert('members',{id:'comm-leader',first_name:'Leader',last_name:'Member',phone:'00233240000004',status:'leader',ministry_id:'comm-ministry'})]);
      const draft={id:'comm-draft',title:'Notice',message:'Synthetic only',sender_id:'GWCC',channel:'sms',recipient_type:'ministry',recipient_group_id:'comm-ministry',recipient_group_name:'Forged name',recipient_ids:['forged-id'],recipient_count:999,status:'sent',created_by:'Forged Actor'};
      const op=operation(),response=(await apply(db,[upsert('communications',draft)],op)).rows[0].result;
      const saved=response[0].record;
      assert.deepEqual(saved.recipient_ids,['comm-a','comm-leader']);assert.equal(saved.recipient_count,2);assert.equal(saved.recipient_group_name,'Synthetic Ministry');assert.equal(saved.status,'draft');assert.equal(saved.created_by,root);assert.equal(saved.updated_by,root);assert.ok(saved.updated_at);
      assert.deepEqual((await apply(db,[upsert('communications',draft)],op)).rows[0].result,response);
      await assert.rejects(apply(db,[upsert('communications',{...saved,title:'Unversioned'})]),/draft version is required/);
      const edited=(await apply(db,[upsert('communications',{...saved,message:'Edited',created_by:'Impersonator'},saved.updated_at)])).rows[0].result[0].record;
      assert.equal(edited.created_by,root);assert.equal(edited.sent_at,saved.sent_at);assert.equal(edited.created_at,saved.created_at);
      await assert.rejects(apply(db,[upsert('communications',{...saved,title:'Stale'},saved.updated_at)]),/changed on another device/);
      await assert.rejects(apply(db,[upsert('communications',{...draft,id:'bad-title',title:'x'.repeat(201)})]),/too long|1-200/);
      await assert.rejects(apply(db,[upsert('communications',{...draft,id:'bad-count',recipient_count:-1})]),/non-negative/);
      await assert.rejects(apply(db,[upsert('communications',{...draft,id:'bad-group',recipient_group_id:'missing'})]),/no longer available/);
      await assert.rejects(apply(db,[upsert('communications',{...draft,id:'bad-message',message:' '})]),/message with/);
      const group=(await apply(db,[upsert('communications',{...draft,id:'comm-small',recipient_type:'small_group',recipient_group_id:'comm-group'})])).rows[0].result[0].record;
      assert.deepEqual(group.recipient_ids,['comm-a']);assert.equal(group.recipient_group_name,'Synthetic Group');
      await apply(db,[upsert('members',{id:'comm-a',is_archived:true})]);
      const archived=(await apply(db,[upsert('communications',{...edited,archived_at:'2026-10-16T15:00:00Z'},edited.updated_at)])).rows[0].result[0].record;
      assert.equal(archived.message,'Edited');assert.deepEqual(archived.recipient_ids,edited.recipient_ids);assert.equal(archived.recipient_count,2);assert.ok(archived.archived_at);
      await assert.rejects(apply(db,[upsert('communications',{...archived,message:'Hidden edit'},archived.updated_at)]),/Restore this archived/);
      const restored=(await apply(db,[upsert('communications',{...archived,archived_at:null},archived.updated_at)])).rows[0].result[0].record;
      assert.equal(restored.archived_at,null);assert.deepEqual(restored.recipient_ids,edited.recipient_ids);
      const refreshed=(await apply(db,[upsert('communications',{...restored,message:'Reviewed audience'},restored.updated_at)])).rows[0].result[0].record;
      assert.deepEqual(refreshed.recipient_ids,['comm-b','comm-leader']);
    });
  }finally{await db.close();}
});

test('communication draft RLS matches page permissions while ordinary members and anonymous users remain denied',async()=>{
  const db=await setupDatabase();
  try{
    await asUser(db,root,async()=>await apply(db,[upsert('communications',{id:'private-draft',title:'Private draft',message:'Synthetic private text',recipient_type:'all_members',recipient_count:0,sender_id:'GWCC',channel:'sms',status:'draft'})]));
    for(const role of ['attendance_officer','data_entry','finance_officer','member','administrator','pastor','ministry_leader','senior_pastor']){
      await db.exec("SELECT set_config('request.jwt.claim.sub','',false)");await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,other]);
      const allowed=['administrator','pastor','ministry_leader','senior_pastor'].includes(role);
      await asUser(db,other,async()=>{
        assert.equal((await db.query("SELECT public.gwcc_can_read('communications') AS allowed")).rows[0].allowed,allowed,role);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM public.communications')).rows[0].n,allowed?1:0,role);
        await assert.rejects(db.query("UPDATE public.communications SET title='Direct write' WHERE id='private-draft'"),/permission denied/);
        if(!allowed)await assert.rejects(apply(db,[upsert('communications',{id:'denied-'+role,title:'Denied',message:'No',channel:'sms',recipient_type:'all_members',recipient_count:0,sender_id:'GWCC'})]),/Not authorized|Staff authorization/);
      });
    }
    await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM public.communications'),/permission denied/);await db.exec('RESET ROLE');
  }finally{await db.close();}
});

const smsPreview=(db,draft)=>db.query('SELECT public.gwcc_sms_preview($1,$2) AS result',[draft.id,draft.updated_at]).then(r=>r.rows[0].result);
async function smsService(db,fn){
 const previous=(await db.query("SELECT current_setting('request.jwt.claim.sub',true) sub,current_setting('request.jwt.claims',true) claims")).rows[0];
 await db.exec(`SET ROLE service_role;SELECT set_config('request.jwt.claim.sub','',false);SELECT set_config('request.jwt.claims','{"role":"service_role"}',false)`);
 try{return await fn();}finally{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[previous.sub||'',previous.claims||'{}']);}
}
const smsClaim=(db,draft,preview,changes={})=>{
 const input={actor:root,id:operation(),draft:draft?.id||null,version:draft?.updated_at||null,digest:preview?.digest||null,sender:'GWCC',phone:null,segments:1,...changes};
 return db.query('SELECT public.gwcc_sms_claim($1,$2,$3,$4,$5,$6,$7,$8) AS result',[input.actor,input.id,input.draft,input.version,input.digest,input.sender,input.phone,input.segments]).then(r=>r.rows[0].result);
};
test('SMS audience claims recheck protected roles, current contacts, draft versions and sender; immutable claims prevent duplicate sends',async()=>{
 const db=await setupDatabase();try{
  let draft,preview;
  await asUser(db,root,async()=>{
   await apply(db,[upsert('members',{id:'sms-a',first_name:'One',last_name:'Synthetic',phone:'0240000001',status:'active'}),upsert('members',{id:'sms-b',first_name:'Duplicate',last_name:'Synthetic',phone:'+233240000001',status:'active'}),upsert('members',{id:'sms-c',first_name:'Foreign',last_name:'Synthetic',phone:'+12025550100',status:'active'}),upsert('members',{id:'sms-d',first_name:'Inactive',last_name:'Synthetic',phone:'0240000002',status:'inactive'})]);
   draft=(await apply(db,[upsert('communications',{id:'sms-draft',title:'Synthetic SMS',message:'Synthetic only',channel:'sms',recipient_type:'all_members',recipient_ids:[],recipient_count:0,sender_id:'GWCC'})])).rows[0].result[0].record;
   preview=await smsPreview(db,draft);assert.deepEqual(preview.recipients.map(row=>row.phone),['233240000001']);assert.equal(preview.excluded.length,1);
   await assert.rejects(smsPreview(db,{...draft,updated_at:'2000-01-01T00:00:00Z'}),/cloud confirmation/);
   await assert.rejects(smsClaim(db,draft,preview),/permission denied/);await assert.rejects(db.query('SELECT * FROM gwcc_private.sms_dispatches'),/permission denied/);
  });
  await smsService(db,async()=>{
   await assert.rejects(smsClaim(db,draft,preview,{actor:member}),/role cannot send/);
   await assert.rejects(smsClaim(db,draft,preview,{sender:'Forged'}),/approved configured sender/);
   await assert.rejects(smsClaim(db,draft,preview,{digest:'forged'}),/phone numbers changed/);
   const id=operation(),first=await smsClaim(db,draft,preview,{id});assert.equal(first.created,true);assert.equal(first.dispatch.actor_id,root);
   assert.equal((await smsClaim(db,draft,preview,{id})).created,false);
   assert.equal((await smsClaim(db,draft,preview)).dispatch.id,id);
   await assert.rejects(smsClaim(db,draft,preview,{id,segments:2}),/reused with different data/);
   const outcomes=[{phone:'233240000001',provider_id:'provider-id-synthetic',status:'accepted'}];
   const finished=(await db.query('SELECT public.gwcc_sms_finish($1,$2,$3) AS result',[id,'submitted',JSON.stringify(outcomes)])).rows[0].result;
   assert.equal(finished.outcomes[0].status,'accepted');assert.equal(finished.snapshot.message,'Synthetic only');
   const updated=(await db.query('SELECT public.gwcc_sms_reports($1,$2,$3) AS result',[root,id,JSON.stringify([{provider_id:'provider-id-synthetic',phone:'233240000001',status:'delivered'}])])).rows[0].result;
   assert.equal(updated.outcomes[0].status,'delivered');
   const unchanged=(await db.query('SELECT public.gwcc_sms_reports($1,$2,$3) AS result',[root,id,JSON.stringify([{provider_id:'provider-id-synthetic',phone:'233240000001',status:'accepted'}])])).rows[0].result;
   assert.equal(unchanged.outcomes[0].status,'delivered');assert.deepEqual(unchanged.snapshot,finished.snapshot);
  });
  assert.equal((await db.query("SELECT status FROM public.communications WHERE id='sms-draft'")).rows[0].status,'draft');
  await db.exec("UPDATE public.members SET phone='0240000009' WHERE id='sms-a'");
  await smsService(db,async()=>await assert.rejects(smsClaim(db,draft,preview),/phone numbers changed|audience changed/));
  const histories=await asUser(db,root,async()=>(await db.query('SELECT public.gwcc_sms_history() AS result')).rows[0].result);
  assert.equal(histories.length,1);assert.equal(histories[0].request_hash,undefined);
  await db.exec(`INSERT INTO auth.mfa_factors VALUES('${member}','${member}','totp','verified');INSERT INTO auth.sessions VALUES('${member}','${member}','${member}','aal2',NULL)`);
  for(const role of ['administrator','senior_pastor','pastor','ministry_leader','attendance_officer','finance_officer','data_entry','member']){
   await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,member]);
   await asUser(db,member,async()=>{
    if(['administrator','senior_pastor','pastor','ministry_leader'].includes(role))assert.equal((await db.query('SELECT public.gwcc_sms_history() AS result')).rows[0].result.length,1);
    else await assert.rejects(db.query('SELECT public.gwcc_sms_history()'),/role cannot read/);
    if(!['administrator','senior_pastor'].includes(role))await assert.rejects(smsPreview(db,draft),/role cannot send/);
    await assert.rejects(db.query("SELECT public.gwcc_sms_finish($1,'unknown','[]')",[histories[0].id]),/permission denied/);
   });
  }
  await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.gwcc_sms_history()'),/permission denied/);await db.exec('RESET ROLE');
  await asUser(db,root,async()=>{
   const updated=(await apply(db,[upsert('communications',{...draft,message:'Updated after review'},draft.updated_at)])).rows[0].result[0].record;
   await assert.rejects(smsPreview(db,draft),/cloud confirmation/);
   const archived=(await apply(db,[upsert('communications',{...updated,archived_at:new Date().toISOString()},updated.updated_at)])).rows[0].result[0].record;
   await assert.rejects(smsPreview(db,archived),/active SMS draft/);
  });
  await db.query("UPDATE public.profiles SET role='administrator',authorization_reviewed_at=NULL WHERE id=$1",[member]);
  await asUser(db,member,async()=>await assert.rejects(db.query('SELECT public.gwcc_sms_history()'),/role cannot read/));
 }finally{await db.close();}
});
test('SMS claims enforce test consent destinations and per-submission, daily and rate budgets without any network calls',async()=>{
 const db=await setupDatabase();try{
  await smsService(db,async()=>{
   for(let i=0;i<3;i++)assert.equal((await smsClaim(db,null,null,{phone:'0240000001'})).created,true);
   await assert.rejects(smsClaim(db,null,null,{phone:'0240000001'}),/three-test daily/);
   await assert.rejects(smsClaim(db,null,null,{phone:'+12025550100'}),/valid Ghana mobile/);
   await assert.rejects(smsClaim(db,null,null,{phone:'0240000002',segments:2}),/one valid Ghana/);
   await smsClaim(db,null,null,{phone:'0240000002'});await smsClaim(db,null,null,{phone:'0240000002'});
   await assert.rejects(smsClaim(db,null,null,{phone:'0240000003'}),/Too many SMS submissions/);
  });
  await db.exec('DELETE FROM gwcc_private.sms_dispatches');
  let draft,preview;
  await asUser(db,root,async()=>{
   await apply(db,Array.from({length:60},(_,i)=>upsert('members',{id:'budget-sms-'+i,first_name:'Synthetic',last_name:String(i),phone:'024'+String(i).padStart(7,'0'),status:'active'})));
   draft=(await apply(db,[upsert('communications',{id:'budget-draft',title:'Budget',message:'a'.repeat(1000),channel:'sms',recipient_type:'all_members',recipient_ids:[],recipient_count:0,sender_id:'GWCC'})])).rows[0].result[0].record;preview=await smsPreview(db,draft);
  });
  await smsService(db,async()=>await assert.rejects(smsClaim(db,draft,preview,{segments:10}),/500-segment/));
  const snapshot=JSON.stringify({recipients:[{phone:'233240000001'}],is_test:false});
  await db.query("INSERT INTO gwcc_private.sms_dispatches(id,actor_id,request_hash,snapshot,estimated_units,created_at) VALUES($1,$2,'daily',$3,500,now()-interval '2 hours'),($4,$2,'daily2',$3,500,now()-interval '1 hour')",[operation(),root,snapshot,operation()]);
  await smsService(db,async()=>await assert.rejects(smsClaim(db,null,null,{phone:'0240000002'}),/1,000-segment daily/));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.church_finances')).rows[0].n,0);
 }finally{await db.close();}
});

test('required staff roles cannot open records, mutate, manage profiles, export backups, read media or preview SMS before enrolling and verifying MFA',async()=>{
 const db=await setupDatabase();
 try{
  await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone) VALUES('mfa-private','MFA-1','Private','Record','0240000001');
   INSERT INTO public.church_accounts(id,name,current_balance,opening_balance) VALUES('mfa-cash','Cash',100,100);
   INSERT INTO storage.objects(id,bucket_id,name) VALUES('mfa-file','gwcc-media','private.jpg');GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT ON storage.objects TO authenticated;
   DELETE FROM auth.mfa_factors WHERE user_id='${other}';`);
  for(const role of ['super_admin','senior_pastor','administrator','finance_officer']){
   await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,other]);
   await asUser(db,other,async()=>{
    const state=(await db.query('SELECT public.gwcc_security_status() s')).rows[0].s;
    assert.deepEqual(state,{role,required:true,verified_factors:0,satisfied:false});
    assert.equal((await db.query('SELECT public.current_user_role() r')).rows[0].r,'disabled');
    for(const table of ['members','church_accounts','church_finances','communications','audit_logs'])assert.equal((await db.query(`SELECT id FROM public.${table}`)).rows.length,0,role+':'+table);
    assert.deepEqual((await db.query('SELECT id FROM public.profiles')).rows,[{id:other}]);
    assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);
    await assert.rejects(apply(db,[upsert('members',{id:'mfa-attack',first_name:'No',last_name:'Access'})]),/Staff authorization/);
    await assert.rejects(db.query("SELECT public.gwcc_manage_profile($1,'{}')",[other]),/super administrator/);
    await assert.rejects(db.query("SELECT public.gwcc_link_member_login('mfa-private',$1,'member@example.test')",[member]),/super administrator/);
    await assert.rejects(db.query('SELECT public.gwcc_backup_status()'),/reviewed super administrator/);
    await assert.rejects(db.query("SELECT public.gwcc_sms_preview('missing','2026-10-17')"),/role cannot/);
    await assert.rejects(db.query('SELECT public.gwcc_sms_history()'),/role cannot/);
    assert.equal((await db.query("SELECT public.gwcc_consume_api_limit('staff') allowed")).rows[0].allowed,false);
    await assert.rejects(db.query('SELECT * FROM auth.mfa_factors'),/permission denied/);
   },{role:'authenticated',aal:'aal1',session_id:other,user_metadata:{role:'super_admin',aal:'aal2'}});
  }
  assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='mfa-cash'")).rows[0].current_balance,'100.00');
  assert.equal((await db.query("SELECT count(*)::int n FROM public.members WHERE id='mfa-attack'")).rows[0].n,0);
  await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.gwcc_security_status()'),/permission denied/);
 }finally{await db.close();}
});

test('MFA rejects password-only, stale, revoked, wrong-owner and expired sessions; an AAL2 claim cannot outlive its verified factor',async()=>{
 const db=await setupDatabase();
 const allowed=claims=>asUser(db,root,async()=>(await db.query('SELECT public.gwcc_security_status() s')).rows[0].s.satisfied,claims);
 const claims={role:'authenticated',aal:'aal2',session_id:root};
 try{
  assert.equal(await allowed({...claims,aal:'aal1'}),false);assert.equal(await allowed({role:'authenticated',session_id:root}),false);
  assert.equal(await allowed({...claims,session_id:other}),false);assert.equal(await allowed({...claims,session_id:'malformed'}),false);
  assert.equal(await allowed(claims),true);
  await db.exec(`UPDATE auth.sessions SET aal='aal1' WHERE id='${root}'`);assert.equal(await allowed(claims),false);
  await db.exec(`UPDATE auth.sessions SET aal='aal2',not_after=now()-interval '1 minute' WHERE id='${root}'`);assert.equal(await allowed(claims),false);
  await db.exec(`UPDATE auth.sessions SET not_after=NULL,factor_id='${other}' WHERE id='${root}'`);assert.equal(await allowed(claims),false);
  await db.exec(`UPDATE auth.sessions SET factor_id='${root}' WHERE id='${root}';UPDATE auth.mfa_factors SET status='unverified' WHERE user_id='${root}'`);assert.equal(await allowed(claims),false);
  await db.exec(`UPDATE auth.mfa_factors SET status='verified' WHERE user_id='${root}'`);assert.equal(await allowed(claims),true);
  await db.exec(`DELETE FROM auth.sessions WHERE id='${root}'`);assert.equal(await allowed(claims),false);
 }finally{await db.close();}
});

test('ordinary members retain password sign-in, unverified setups do not enable MFA, and a verified optional factor protects their own portal records',async()=>{
 const db=await setupDatabase();const claims={role:'authenticated',aal:'aal1',session_id:member};
 const state=()=>asUser(db,member,async()=>(await db.query('SELECT public.gwcc_security_status() s')).rows[0].s,claims);
 try{
  assert.deepEqual(await state(),{role:'member',required:false,verified_factors:0,satisfied:true});
  await db.exec(`INSERT INTO auth.mfa_factors VALUES('${member}','${member}','totp','unverified')`);assert.equal((await state()).required,false);
  await db.exec(`UPDATE auth.mfa_factors SET status='verified' WHERE user_id='${member}'`);assert.equal((await state()).required,true);assert.equal((await state()).satisfied,false);
  await db.exec(`INSERT INTO auth.sessions VALUES('${member}','${member}','${member}','aal2',NULL)`);
  claims.aal='aal2';assert.equal((await state()).satisfied,true);
 }finally{await db.close();}
});

test('financial approval identities are server-owned; direct mutations, self-review and unpaid vouchers cannot bypass independent approval',async()=>{
  const db=await setupDatabase();
  try{
    await enableReviewer(db);
    const input={id:'protected-request',transaction_type:'expense',account_id:'approval-cash',account_name:'Cash',title:'Synthetic bill',recipient_or_vendor:'Vendor',amount:20,currency:'GHS',status:'completed',approved_by:'Fabricated Pastor',approved_by_id:other,approval_state:'paid',paid_by_id:root,approval_history:[{action:'paid'}]};
    await asUser(db,root,async()=>{
      await apply(db,[upsert('church_accounts',{id:'approval-cash',name:'Cash',current_balance:100})]);
      await apply(db,[upsert('church_finances',input)]);
      const row=await financeRow(db,input.id);
      assert.equal(row.status,'pending');assert.equal(row.approval_state,'requested');assert.equal(row.requested_by_id,root);
      assert.equal(row.approved_by_id,null);assert.equal(row.approved_by,null);assert.equal(row.paid_by_id,null);
      assert.deepEqual(row.approval_history.map(event=>event.action),['requested']);assert.equal(row.approval_history[0].actor_id,root);
      for(const patch of [{status:'completed'},{approval_state:'paid',paid_by_id:root},{amount:1},{transaction_type:'income'},{approval_history:[]},{requested_by_id:other}])
        await assert.rejects(apply(db,[upsert('church_finances',{...row,...patch},row.updated_at)]),/cannot be edited/);
      await assert.rejects(approval(db,row,'approve'),/different finance/);await assert.rejects(approval(db,row,'reject',{reason:'No'}),/different finance/);
      await assert.rejects(approval(db,row,'paid'),/independent approval/);
      await assert.rejects(db.query("UPDATE public.church_finances SET status='completed' WHERE id=$1",[input.id]),/permission denied/);
      await assert.rejects(apply(db,[upsert('expenses',{id:'legacy-bypass',amount:1})]),/Legacy expense history is read-only/);
    });
    await asUser(db,member,async()=>{
      await assert.rejects(approval(db,{id:input.id,updated_at:'2026-10-17T00:00:00Z'},'approve'),/two-factor/);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.church_finances')).rows[0].n,0);
    });
    const requested=await financeRow(db,input.id);
    await asUser(db,other,()=>assert.rejects(approval(db,requested,'approve'),/two-factor/),{aal:'aal1',session_id:other,role:'authenticated'});
    const approved=await asUser(db,other,()=>approval(db,requested,'approve'));
    assert.equal(approved.approved_by_id,other);assert.equal(approved.status,'pending');
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='approval-cash'")).rows[0].current_balance,'100.00');
    await asUser(db,root,()=>assert.rejects(approval(db,requested,'paid'),/changed/));
    const requestId=operation();
    const paid=await asUser(db,root,()=>approval(db,approved,'paid',{operationId:requestId,reference:'SYNTHETIC-MOMO-42'}));
    assert.equal(paid.paid_by_id,root);assert.equal(paid.payment_reference,'SYNTHETIC-MOMO-42');assert.equal(paid.status,'completed');
    await asUser(db,root,async()=>{
      assert.deepEqual(await approval(db,approved,'paid',{operationId:requestId,reference:'SYNTHETIC-MOMO-42'}),paid);
      await assert.rejects(approval(db,approved,'paid',{operationId:requestId,reference:'DIFFERENT'}),/reused with different/);
      await assert.rejects(approval(db,approved,'paid'),/changed/);await assert.rejects(approval(db,paid,'paid'),/independent approval/);
      await assert.rejects(approval(db,paid,'cancel',{reason:'Too late'}),/unpaid open/);
      await assert.rejects(apply(db,[upsert('church_finances',{...paid,amount:1},paid.updated_at)]),/cannot be edited/);
    });
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='approval-cash'")).rows[0].current_balance,'80.00');
    assert.deepEqual((await financeRow(db,input.id)).approval_history.map(event=>event.action),['requested','approve','paid']);
    await asUser(db,other,()=>assert.rejects(approval(db,paid,'void',{reason:'Denied reversal'}),/senior administrator/));
    const voided=await asUser(db,root,()=>approval(db,paid,'void',{reason:'Synthetic correction'}));
    assert.equal(voided.status,'voided');assert.equal(voided.paid_by_id,root);assert.equal(voided.approved_by_id,other);
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='approval-cash'")).rows[0].current_balance,'100.00');
  }finally{await db.close();}
});
test('rejection and cancellation preserve money, require reasons, reject stale decisions and cannot be reopened through sync',async()=>{
  const db=await setupDatabase();
  try{
    await enableReviewer(db);
    await asUser(db,root,()=>apply(db,[upsert('church_accounts',{id:'cash',name:'Cash',current_balance:100}),...['reject-me','cancel-me'].map(id=>upsert('church_finances',{id,title:id,account_id:'cash',transaction_type:'expense',amount:30,status:'completed'}))]));
    const row=await financeRow(db,'reject-me');
    await asUser(db,other,()=>assert.rejects(approval(db,row,'reject',{reason:''}),/reason/));
    const rejected=await asUser(db,other,()=>approval(db,row,'reject',{reason:'Invoice amount needs correction'}));
    await asUser(db,root,async()=>{
      await assert.rejects(approval(db,row,'cancel',{reason:'Stale action'}),/changed/);
      await assert.rejects(approval(db,rejected,'paid'),/independent approval/);
      await assert.rejects(apply(db,[upsert('church_finances',{...rejected,status:'completed',approval_state:'approved'},rejected.updated_at)]),/cannot be edited/);
    });
    const pending=await financeRow(db,'cancel-me');
    await asUser(db,other,()=>assert.rejects(approval(db,pending,'cancel',{reason:'Not my request'}),/Only the requester/));
    const approved=await asUser(db,other,()=>approval(db,pending,'approve'));
    const cancelled=await asUser(db,root,()=>approval(db,approved,'cancel',{reason:'Submit corrected invoice'}));
    assert.equal(cancelled.approval_state,'cancelled');assert.equal(cancelled.status,'cancelled');
    assert.deepEqual(cancelled.approval_history.map(event=>event.action),['requested','approve','cancel']);
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='cash'")).rows[0].current_balance,'100.00');
    await db.exec(`UPDATE public.profiles SET is_active=false WHERE id='${other}'`);
    await asUser(db,other,()=>assert.rejects(approval(db,cancelled,'approve'),/two-factor/));
  }finally{await db.close();}
});

test('approval rollout preserves historical expenses and balances; historical payment type changes cannot bypass controls and backups include approval history',async()=>{
  let original;
  const db=await setupDatabase({beforeApprovalControls:async db=>{
    await db.exec("INSERT INTO public.church_accounts(id,name,current_balance,opening_balance) VALUES('history-cash','Historical Cash',100,100); INSERT INTO public.church_finances(id,transaction_type,account_id,title,amount,status,approved_by) VALUES('old-paid','expense','history-cash','Original payment',20,'completed','Previously entered name'); INSERT INTO public.expenses(id,amount,category,description,approved_by) VALUES('old-expense',10,'History','Historical expense','Entered approver');");
    original=(await db.query("SELECT (SELECT row_to_json(e) FROM public.expenses e WHERE id='old-expense') AS legacy,(SELECT row_to_json(f) FROM public.church_finances f WHERE id='old-paid') AS receipt,(SELECT current_balance FROM public.church_accounts WHERE id='history-cash') AS balance")).rows[0];
  }});
  try{
    const current=await financeRow(db,'old-paid');
    for(const [key,value] of Object.entries(original.receipt))assert.deepEqual(current[key],value);
    assert.equal(current.approval_state,null);assert.deepEqual(current.approval_history,[]);
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='history-cash'")).rows[0].current_balance,original.balance);
    await asUser(db,root,async()=>{
      await assert.rejects(apply(db,[upsert('church_finances',{...current,transaction_type:'income'},current.updated_at)]),/Historical payments/);
      await assert.rejects(apply(db,[upsert('expenses',{...original.legacy,approved_by:'New name'})]),/read-only/);
      await assert.rejects(apply(db,[{table:'expenses',id:'old-expense',operation:'delete'}]),/read-only/);
      await apply(db,[upsert('church_finances',{...current,status:'voided',void_reason:'Historical correction'},current.updated_at)]);
      const backup=(await db.query("SELECT public.gwcc_backup_create() AS result")).rows[0].result;
      const exported=(await db.query('SELECT public.gwcc_backup_export($1) AS result',[backup])).rows[0].result;
      assert.ok(JSON.stringify(exported).includes('approval_history'));
    });
    assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='history-cash'")).rows[0].current_balance,'100.00');
  }finally{await db.close();}
});

const taskId=()=>crypto.randomUUID();
const taskAction=async(db,id,action,data={},version=null,idempotency=operation())=>(await db.query('SELECT public.gwcc_follow_up_action($1,$2,$3,$4,$5) AS result',[idempotency,id,version,action,JSON.stringify(data)])).rows[0].result;
const taskList=async db=>(await db.query('SELECT public.gwcc_follow_up_list() AS result')).rows[0].result;
const reviewedRole=async(db,id,role)=>db.query('UPDATE public.profiles SET role=$2,authorization_reviewed_at=now(),is_active=true,has_login_account=true WHERE id=$1',[id,role]);
const generalTask=(owner)=>({kind:'general',source_type:'none',title:'Synthetic follow-up task',description:'Review the equipment list',due_date:'2026-10-16',priority:'high',assigned_to_id:owner});

test('follow-up tasks require real reviewed staff owners, preserve immutable actors and history, reject stale edits and retry completion once',async()=>{
  const db=await setupDatabase();
  try{
    await reviewedRole(db,other,'finance_officer');
    const id=taskId(),request=operation();
    const created=await asUser(db,root,()=>taskAction(db,id,'create',{...generalTask(other),created_by_id:member,history:[{action:'forged'}],status:'completed'},null,request));
    assert.equal(created.created_by_id,root);assert.equal(created.status,'open');assert.equal(created.assigned_to_id,other);assert.deepEqual(created.history.map(e=>e.action),['create']);
    await asUser(db,root,async()=>{
      assert.deepEqual(await taskAction(db,id,'create',{...generalTask(other),created_by_id:member,history:[{action:'forged'}],status:'completed'},null,request),created);
      await assert.rejects(taskAction(db,id,'create',generalTask(root),null,request),/reused with different/);
      await assert.rejects(taskAction(db,taskId(),'create',generalTask('directory-without-login')),/active reviewed staff/);
      await assert.rejects(taskAction(db,taskId(),'create',{...generalTask(root),due_date:'2026-02-31'}),/date\/time|out of range/);
      await assert.rejects(apply(db,[upsert('follow_up_tasks',{id,title:'Bypass'})]),/Unknown table/);
      await assert.rejects(db.query("UPDATE public.gwcc_documents SET data='{}' WHERE namespace='follow_up_tasks'"),/permission denied/);
    });
    await asUser(db,member,async()=>{await assert.rejects(taskList(db),/reviewed staff/);await assert.rejects(taskAction(db,id,'complete',{outcome:'Not allowed'},created.updated_at),/reviewed staff/);});
    const started=await asUser(db,other,()=>taskAction(db,id,'start',{},created.updated_at));
    await asUser(db,root,()=>assert.rejects(taskAction(db,id,'update',{title:'Stale edit'},created.updated_at),/changed on another device/));
    const updated=await asUser(db,root,()=>taskAction(db,id,'update',{title:'Updated real task',due_date:'2026-10-18'},started.updated_at));
    await asUser(db,other,()=>assert.rejects(taskAction(db,id,'complete',{outcome:'Stale outcome'},started.updated_at),/changed on another device/));
    const completion=operation(),paid=await asUser(db,other,()=>taskAction(db,id,'complete',{outcome:'Equipment list checked'},updated.updated_at,completion));
    assert.equal(paid.completed_by_id,other);assert.equal(paid.status,'completed');assert.equal(paid.outcome,'Equipment list checked');
    await asUser(db,other,async()=>{
      assert.deepEqual(await taskAction(db,id,'complete',{outcome:'Equipment list checked'},updated.updated_at,completion),paid);
      await assert.rejects(taskAction(db,id,'complete',{outcome:'Changed'},updated.updated_at,completion),/reused with different/);
      await assert.rejects(taskAction(db,id,'update',{history:[]},paid.updated_at),/Reopen a closed task/);
      await assert.rejects(taskAction(db,id,'reopen',{outcome:''},paid.updated_at),/outcome or reason/);
    });
    const reopened=await asUser(db,root,()=>taskAction(db,id,'reopen',{outcome:'Check the revised equipment list'},paid.updated_at));
    assert.equal(reopened.status,'open');assert.equal(reopened.completed_by_id,undefined);assert.deepEqual(reopened.history.map(e=>e.action),['create','start','update','complete','reopen']);
    const lateReplay=await asUser(db,other,()=>taskAction(db,id,'complete',{outcome:'Equipment list checked'},updated.updated_at,completion));
    assert.deepEqual(lateReplay,reopened);
    const receipts=(await db.query("SELECT request_hash,result FROM public.gwcc_applied_operations WHERE operation_id=$1",[completion])).rows;
    assert.equal(receipts[0].request_hash.length,64);assert.deepEqual(receipts[0].result,{kind:'follow_up_task',task_id:id});
  }finally{await db.close();}
});

test('pastoral task privacy survives staff role changes, reassignment and idempotency replay; staff cannot delegate outside their authority',async()=>{
  const db=await setupDatabase();
  try{
    await reviewedRole(db,other,'pastor');const privateId=taskId(),privateOp=operation();
    const pastoral=await asUser(db,other,()=>taskAction(db,privateId,'create',{...generalTask(other),kind:'pastoral',title:'Confidential pastoral check-in'},null,privateOp));
    await reviewedRole(db,member,'administrator');
    await db.exec(`INSERT INTO auth.mfa_factors VALUES('${member}','${member}','totp','verified'); INSERT INTO auth.sessions VALUES('${member}','${member}','${member}','aal2',NULL);`);
    await asUser(db,member,async()=>{
      assert.deepEqual(await taskList(db),[]);await assert.rejects(taskAction(db,privateId,'complete',{outcome:'Outside pastoral access'},pastoral.updated_at),/outside your access/);
      await assert.rejects(taskAction(db,taskId(),'create',{...generalTask(member),kind:'pastoral'}),/category is outside/);
      const people=(await db.query("SELECT public.gwcc_follow_up_people('visitor') AS result")).rows[0].result;assert.ok(people.every(person=>Object.keys(person).sort().join(',')==='id,name,role'));
    });
    await reviewedRole(db,other,'finance_officer');
    await asUser(db,other,async()=>{
      assert.deepEqual(await taskList(db),[]);
      await assert.rejects(taskAction(db,privateId,'create',{...generalTask(other),kind:'pastoral',title:'Confidential pastoral check-in'},null,privateOp),/outside your access/);
      await assert.rejects(taskAction(db,taskId(),'create',generalTask(root)),/Only administrators may delegate/);
      assert.deepEqual((await db.query("SELECT data FROM public.gwcc_documents WHERE namespace='follow_up_tasks'")).rows,[]);
    });
    const assignedId=taskId(),task=await asUser(db,root,()=>taskAction(db,assignedId,'create',generalTask(other)));
    const startOp=operation(),started=await asUser(db,other,()=>taskAction(db,assignedId,'start',{},task.updated_at,startOp));
    await asUser(db,root,()=>taskAction(db,assignedId,'update',{assigned_to_id:root},started.updated_at));
    await asUser(db,other,()=>assert.rejects(taskAction(db,assignedId,'start',{},task.updated_at,startOp),/outside your access/));
    await db.exec(`UPDATE public.profiles SET is_active=false WHERE id='${other}'`);
    await asUser(db,other,()=>assert.rejects(taskList(db),/reviewed staff/));
    await asUser(db,root,()=>assert.rejects(taskList(db),/reviewed staff/),{aal:'aal1',session_id:root,role:'authenticated'});
    await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.gwcc_follow_up_list()'),/permission denied/);await db.exec('RESET ROLE');
  }finally{await db.close();}
});

test('visitor tasks reject duplicate open assignments, unsupported links and false conversion; task completion does not change membership',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec("INSERT INTO public.visitors(id,full_name,phone,visit_date,service_attended) VALUES('task-visitor','Synthetic Visitor','0240000001','2026-10-16','Sunday');");
    const create={...generalTask(root),kind:'visitor',source_type:'visitor',source_id:'task-visitor'},id=taskId();
    const task=await asUser(db,root,()=>taskAction(db,id,'create',create));
    await asUser(db,root,async()=>{
      await assert.rejects(taskAction(db,taskId(),'create',create),/open task already exists/);
      await assert.rejects(apply(db,[upsert('visitors',{id:'task-visitor',follow_up_status:'converted_to_member'})]),/member enrollment flow/);
      await assert.rejects(taskAction(db,id,'update',{source_type:'pastoral_care'},task.updated_at),/category and linked record are fixed/);
      await assert.rejects(taskAction(db,taskId(),'create',{...generalTask(root),source_type:'pastoral_care',source_id:'task-visitor'}),/General tasks/);
    });
    const done=await asUser(db,root,()=>taskAction(db,id,'complete',{outcome:'Called and agreed next steps'},task.updated_at));
    assert.equal((await db.query("SELECT follow_up_status FROM public.visitors WHERE id='task-visitor'")).rows[0].follow_up_status,'new');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.members')).rows[0].n,0);
    const next=await asUser(db,root,()=>taskAction(db,taskId(),'create',create));
    await asUser(db,root,()=>assert.rejects(taskAction(db,id,'reopen',{outcome:'Must not duplicate assignment'},done.updated_at),/already has an open task/));
    await asUser(db,root,()=>taskAction(db,next.id,'cancel',{outcome:'Scheduling corrected'},next.updated_at));
    await db.exec("UPDATE public.visitors SET follow_up_status='closed' WHERE id='task-visitor'");
    await asUser(db,root,()=>assert.rejects(taskAction(db,id,'reopen',{outcome:'Visitor no longer available'},done.updated_at),/no longer available/));
  }finally{await db.close();}
});

test('visitor interaction logging appends concurrent notes atomically, authenticates the recorder and preserves retry history in complete recovery coverage',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec("INSERT INTO public.visitors(id,full_name,phone,visit_date,service_attended,notes) VALUES('logged-visitor','Synthetic Visitor','0240000001','2026-10-16','Sunday','Earlier note');");
    const today=new Date().toISOString().slice(0,10),record=async(id,summary,patch={})=>(await db.query('SELECT public.gwcc_log_visitor_follow_up($1,$2,$3) AS result',[id,'logged-visitor',JSON.stringify({date:today,channel:'phone_call',status:'follow_up_required',summary,actor_id:member,minister:'Fabricated caller',...patch})])).rows[0].result;
    const request=operation();
    await asUser(db,root,async()=>{
      await Promise.all([record(request,'First real interaction'),record(operation(),'Second real interaction')]);
      const notes=(await db.query("SELECT notes FROM public.visitors WHERE id='logged-visitor'")).rows[0].notes;
      assert.match(notes,/Earlier note/);assert.match(notes,/First real interaction/);assert.match(notes,/Second real interaction/);assert.ok(!notes.includes('Fabricated caller'));
      assert.equal((await record(request,'First real interaction')).notes,notes);await assert.rejects(record(request,'Changed interaction'),/reused with different/);
      await assert.rejects(record(operation(),'Invalid conversion',{status:'converted_to_member'}),/valid interaction/);
      await assert.rejects(record(operation(),'Future contact',{date:'2999-01-01'}),/dated in the future/);
      const history=(await db.query("SELECT public.gwcc_visitor_follow_up_history('logged-visitor') AS result")).rows[0].result;
      assert.equal(history.length,2);assert.ok(history.every(event=>event.actor_id===root));
      await assert.rejects(apply(db,[upsert('visitor_interactions',{id:'forged',summary:'Fake history'})]),/Unknown table/);
    });
    await reviewedRole(db,other,'finance_officer');await asUser(db,other,async()=>{
      await assert.rejects(record(operation(),'Not authorised'),/follow-up access/);
      await assert.rejects(db.query("SELECT public.gwcc_visitor_follow_up_history('logged-visitor')"),/follow-up access/);
    });
    const id=taskId();await asUser(db,root,async()=>{
      await taskAction(db,id,'create',generalTask(root));
      const backup=(await db.query('SELECT public.gwcc_backup_create() AS id')).rows[0].id;
      const data=(await db.query('SELECT public.gwcc_backup_export($1) AS result',[backup])).rows[0].result;
      const docs=JSON.parse(data.payload_text).tables['public.gwcc_documents'];assert.equal(docs.filter(row=>row.namespace==='visitor_interactions').length,2);assert.equal(docs.filter(row=>row.namespace==='follow_up_tasks').length,1);
      const rehearsal=(await db.query('SELECT public.gwcc_backup_rehearse($1) AS result',[backup])).rows[0].result;assert.equal(rehearsal.tables_checked,34);
    });
  }finally{await db.close();}
});

test('personal communication drafts and SMS claims resolve exactly one chosen member or visitor and preserve broadcast drafts',async()=>{
 const db=await setupDatabase();try{
  let memberDraft,visitorDraft,memberPreview,visitorPreview;
  await asUser(db,root,async()=>{
   await apply(db,[upsert('members',{id:'personal-a',first_name:'Other',last_name:'Member',phone:'0240000001',status:'active'}),upsert('members',{id:'personal-b',first_name:'Chosen',last_name:'Member',phone:'+233240000001',status:'active'}),upsert('visitors',{id:'personal-v1',full_name:'Other Visitor',phone:'0240000002',visit_date:'2026-10-17',service_attended:'Sunday',follow_up_status:'new'}),upsert('visitors',{id:'personal-v2',full_name:'Chosen Visitor',phone:'0240000003',visit_date:'2026-10-17',service_attended:'Sunday',follow_up_status:'new'})]);
   const record=(id,type,target)=>({id,title:'Personal synthetic draft',message:'Hello chosen contact',channel:'sms',recipient_type:type,recipient_group_id:target,recipient_group_name:'Forged display name',recipient_ids:['personal-a','personal-v1'],recipient_count:999,sender_id:'GWCC'});
   memberDraft=(await apply(db,[upsert('communications',record('personal-member-draft','individual_member','personal-b'))])).rows[0].result[0].record;
   visitorDraft=(await apply(db,[upsert('communications',record('personal-visitor-draft','individual_visitor','personal-v2'))])).rows[0].result[0].record;
   assert.deepEqual(memberDraft.recipient_ids,['personal-b']);assert.equal(memberDraft.recipient_count,1);assert.equal(memberDraft.recipient_group_name,'Chosen Member');
   assert.deepEqual(visitorDraft.recipient_ids,['personal-v2']);assert.equal(visitorDraft.recipient_count,1);assert.equal(visitorDraft.recipient_group_name,'Chosen Visitor');
   memberPreview=await smsPreview(db,memberDraft);visitorPreview=await smsPreview(db,visitorDraft);
   assert.deepEqual(memberPreview.recipients.map(row=>row.id),['personal-b']);assert.deepEqual(visitorPreview.recipients.map(row=>row.id),['personal-v2']);
   const broadcast=(await apply(db,[upsert('communications',{...record('broadcast-preserved','all_members',null),recipient_group_name:null})])).rows[0].result[0].record;
   assert.deepEqual(broadcast.recipient_ids,['personal-a']);assert.equal(broadcast.recipient_group_id,null);
   for(const [type,id] of [['individual_member','missing'],['individual_visitor','personal-a'],['individual_member',null]])await assert.rejects(apply(db,[upsert('communications',record('invalid-target-'+String(type)+String(id),type,id))]),/Choose one current/);
   await assert.rejects(db.query("SELECT * FROM gwcc_private.communication_audience('all_members',NULL)"),/permission denied/);
  });
  await smsService(db,async()=>{
   const id=operation(),first=await smsClaim(db,memberDraft,memberPreview,{id});assert.equal(first.dispatch.snapshot.recipients.length,1);assert.equal(first.dispatch.snapshot.recipients[0].id,'personal-b');assert.equal((await smsClaim(db,memberDraft,memberPreview,{id})).created,false);
   const visitorClaim=await smsClaim(db,visitorDraft,visitorPreview);assert.equal(visitorClaim.dispatch.snapshot.recipients.length,1);assert.equal(visitorClaim.dispatch.snapshot.recipients[0].id,'personal-v2');
  });
  await db.exec("UPDATE public.members SET phone='0240000009' WHERE id='personal-b'");
  await smsService(db,()=>assert.rejects(smsClaim(db,memberDraft,memberPreview),/phone numbers changed/));
  await db.exec("UPDATE public.visitors SET follow_up_status='closed' WHERE id='personal-v2'");
  await asUser(db,root,()=>assert.rejects(smsPreview(db,visitorDraft),/audience changed/));
 }finally{await db.close();}
});

test('personal drafts reject unavailable phones or contacts, and the server refuses unresolved name tags before SMS review',async()=>{
 const db=await setupDatabase();try{
  await asUser(db,root,async()=>{
   await apply(db,[upsert('members',{id:'single-active',first_name:'Active',last_name:'Contact',phone:'0240000001',status:'active'}),upsert('members',{id:'single-bad',first_name:'Bad',last_name:'Phone',phone:'024000',status:'active'}),upsert('members',{id:'single-inactive',first_name:'Inactive',last_name:'Contact',phone:'0240000002',status:'inactive'})]);
   const make=(target)=>({id:'check-'+target,title:'Synthetic personal',message:'Hello selected contact',channel:'sms',recipient_type:'individual_member',recipient_group_id:target,recipient_ids:[],recipient_count:0,sender_id:'GWCC'});
   for(const target of ['single-bad','single-inactive'])await assert.rejects(apply(db,[upsert('communications',make(target))]),/Choose one current/);
   const tagged=(await apply(db,[upsert('communications',{...make('single-active'),message:'Hello [First Name]'})])).rows[0].result[0].record;
   await assert.rejects(smsPreview(db,tagged),/first-name placeholder/);
   const clean=(await apply(db,[upsert('communications',{...tagged,message:'Hello Active'},tagged.updated_at)])).rows[0].result[0].record;
   assert.equal((await smsPreview(db,clean)).recipients.length,1);
   await assert.rejects(apply(db,[upsert('communications',{...clean,message:'Stale edit'},tagged.updated_at)]),/changed on another device/);
  });
 }finally{await db.close();}
});


test('member event projection denies full attendee reads, hides contact data and budgets, and retains staff visibility',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone,auth_user_id) VALUES('event-own','GWCC-EVENT-OWN','Own','Member','0240000001','${member}');
      INSERT INTO public.events(id,title,event_type,start_date,end_date,start_time,end_time,budget,attendees) VALUES('portal-event','Synthetic event','conference',current_date+10,current_date+10,'18:00','20:00',1000,'[{"id":"someone-else","member_id":"other","name":"Another Member","phone":"0240000003","email":"other@example.test","private":"hidden"},{"id":"own-legacy","member_id":"GWCC-EVENT-OWN","name":"Own Member","phone":"0240000001","email":"own@example.test"}]');`);
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT public.gwcc_member_events()'),/permission denied/);
    await assert.rejects(db.query("SELECT public.gwcc_member_rsvp('portal-event')"),/permission denied/);await db.exec('RESET ROLE');
    await asUser(db,member,async()=>{
      assert.deepEqual((await db.query('SELECT * FROM public.events')).rows,[]);
      const events=(await db.query('SELECT public.gwcc_member_events() result')).rows[0].result;
      assert.equal(events.length,1);assert.equal(events[0].title,'Synthetic event');assert.equal(events[0].budget,undefined);
      assert.equal(events[0].attendees.length,1);assert.equal(events[0].attendees[0].member_id,'GWCC-EVENT-OWN');
      assert.doesNotMatch(JSON.stringify(events),/phone|email|someone-else|Another Member|hidden/);
      await assert.rejects(db.query("UPDATE public.events SET attendees='[]' WHERE id='portal-event'"),/permission denied/);
      await assert.rejects(apply(db,[upsert('events',{id:'portal-event',attendees:[]})]),/Staff authorization/);
    });
    await asUser(db,root,async()=>{
      assert.equal((await db.query("SELECT attendees FROM public.events WHERE id='portal-event'")).rows[0].attendees.length,2);
      await assert.rejects(db.query('SELECT public.gwcc_member_events()'),/member sign-in/);
    });
    await db.exec(`UPDATE public.members SET is_archived=true WHERE id='event-own'`);
    await asUser(db,member,async()=>await assert.rejects(db.query('SELECT public.gwcc_member_events()'),/active member record/));
    await db.exec(`UPDATE public.members SET is_archived=false WHERE id='event-own';UPDATE public.profiles SET is_active=false WHERE id='${member}'`);
    await asUser(db,member,async()=>await assert.rejects(db.query('SELECT public.gwcc_member_events()'),/member sign-in/));
  }finally{await db.close();}
});

test('member RSVP saves canonical identity, preserves other attendees and safely retries lost responses without duplicates',async()=>{
  const db=await setupDatabase();
  const register=()=>db.query("SELECT public.gwcc_member_rsvp('rsvp-event') result");
  try{
    await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone,email,auth_user_id) VALUES('rsvp-own','GWCC-RSVP-OWN','Own','Member','0240000001','own@example.test','${member}'),('rsvp-other','GWCC-RSVP-OTHER','Other','Member','0240000002','other@example.test','${other}');
      INSERT INTO public.events(id,title,event_type,start_date,end_date,start_time,end_time,budget,requires_registration,attendees) VALUES('rsvp-event','Preserved event','conference',current_date+10,current_date+10,'18:00','20:00',1500,true,'[{"id":"prior","member_id":"unrelated","name":"Another Member","phone":"0240000003","checked_in":true}]');`);
    const before=(await db.query("SELECT attendees->0 prior FROM public.events WHERE id='rsvp-event'")).rows[0].prior;
    await asUser(db,member,async()=>{
      const first=(await register()).rows[0].result;
      assert.equal(first.attendees.length,1);assert.equal(first.attendees[0].member_id,'rsvp-own');
      const retry=(await register()).rows[0].result;assert.deepEqual(retry,first);
    });
    await asUser(db,other,async()=>{
      const second=(await register()).rows[0].result;assert.equal(second.attendees.length,1);assert.equal(second.attendees[0].member_id,'rsvp-other');
    });
    const saved=(await db.query("SELECT * FROM public.events WHERE id='rsvp-event'")).rows[0];
    assert.equal(saved.attendees.length,3);assert.equal(saved.registration_count,3);assert.deepEqual(saved.attendees[0],before);
    assert.equal(saved.budget,'1500.00');assert.equal(saved.title,'Preserved event');
    assert.equal(saved.attendees[1].name,'Own Member');assert.equal(saved.attendees[1].phone,'0240000001');
    assert.equal((await db.query("SELECT count(*)::int n FROM public.audit_logs WHERE action='MEMBER_EVENT_RSVP'")).rows[0].n,2);
    await asUser(db,root,async()=>await assert.rejects(register(),/member sign-in/));
  }finally{await db.close();}
});

test('member RSVP rejects closed events and missing, unverified or archived member identities without changing event data',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec(`INSERT INTO public.events(id,title,start_date,end_date,start_time,end_time,status) VALUES('closed','Cancelled',current_date+1,current_date+1,'18:00','20:00','cancelled'),('past','Past',current_date-2,current_date-1,'18:00','20:00','upcoming');`);
    await asUser(db,member,async()=>await assert.rejects(db.query("SELECT public.gwcc_member_rsvp('closed')"),/active member record/));
    await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone,auth_user_id) VALUES('blocked-rsvp','GWCC-BLOCKED','Own','Member','0240000001','${member}');`);
    await asUser(db,member,async()=>{
      for(const id of ['closed','past'])await assert.rejects(db.query('SELECT public.gwcc_member_rsvp($1)',[id]),/Registration is closed/);
      await assert.rejects(db.query("SELECT public.gwcc_member_rsvp('missing')"),/no longer available/);
    });
    await db.exec(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${member}'`);
    await asUser(db,member,async()=>await assert.rejects(db.query("SELECT public.gwcc_member_rsvp('closed')"),/member sign-in/));
    assert.equal((await db.query('SELECT sum(registration_count)::int n FROM public.events')).rows[0].n,0);
  }finally{await db.close();}
});


const rosterFixture=async(db)=>db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone,auth_user_id) VALUES('duty-own','GWCC-DUTY-OWN','Own','Member','0240000001','${member}'),('duty-other','GWCC-DUTY-OTHER','Other','Member','0240000002','${other}');
 INSERT INTO public.services(id,name,type,day_of_week,start_time,end_time) VALUES('duty-service','Synthetic service','sunday','Sunday','08:00','10:30');
 INSERT INTO public.roster_assignments(id,service_id,service_name,member_id,member_name,date,department,role_title,report_time,status,notes)
 VALUES('future-duty','duty-service','Synthetic service','duty-own','Own Member',current_date+7,'ushers_protocol','Usher','07:30','pending','Original coordinator instructions'),('past-duty','duty-service','Synthetic service','duty-own','Own Member',current_date-7,'ushers_protocol','Usher','07:30','pending','Historical instructions');`);
const dutyRow=async(db,id='future-duty')=>(await db.query('SELECT to_jsonb(a) doc FROM public.roster_assignments a WHERE id=$1',[id])).rows[0].doc;
const dutyRequest=async(db,overrides={})=>db.query("SELECT public.gwcc_member_action('roster','future-duty',$1) doc",[JSON.stringify({status:'substitute_requested',reason:'Work commitment',notes:'Synthetic personal note',suggestion:'Ask another volunteer',request_id:'aaaaaaaa-aaaa-4aaa-8aaa-111111111111',expected_updated_at:(await dutyRow(db)).updated_at,...overrides})]);
const reviewDuty=(db,req,assignment,action='approve',replacement='duty-other',reason='')=>db.query('SELECT public.gwcc_review_roster_request($1,$2,$3,$4,$5,$6) doc',[req.id,req.updated_at,assignment.updated_at,action,replacement,reason]);

test('member roster requests preserve instructions and assignment status, protect past duties and reject stale or altered retries',async()=>{
 const db=await setupDatabase();try{
  await rosterFixture(db);const before=await dutyRow(db);
  await asUser(db,member,async()=>{
   await assert.rejects(db.query("SELECT public.gwcc_member_action('roster','past-duty',$1)",[JSON.stringify({status:'confirmed',expected_updated_at:(await dutyRow(db,'past-duty')).updated_at})]),/Past duties are read-only/);
   await assert.rejects(dutyRequest(db,{expected_updated_at:'2000-01-01T00:00:00Z'}),/duty changed/);
   const saved=(await dutyRequest(db)).rows[0].doc;assert.equal(saved.status,'pending');
   assert.equal(saved.created_by,member);assert.equal(saved.reason,'Work commitment');
   assert.deepEqual((await dutyRequest(db)).rows[0].doc,saved);
   await assert.rejects(dutyRequest(db,{notes:'Changed after submission'}),/reused with different data/);
   await assert.rejects(db.query("SELECT public.gwcc_member_action('roster','future-duty',$1)",[JSON.stringify({status:'confirmed',expected_updated_at:before.updated_at})]),/awaiting coordinator/);
   const visible=(await db.query('SELECT public.gwcc_roster_requests() doc')).rows[0].doc;assert.equal(visible.length,1);
   assert.deepEqual(await dutyRow(db),before);
   await assert.rejects(reviewDuty(db,saved,before),/coordinator authorization/);
   assert.deepEqual((await db.query("SELECT data FROM public.gwcc_documents WHERE namespace='roster_substitute_requests'")).rows,[]);
  });
  assert.equal((await db.query("SELECT count(*)::int n FROM public.gwcc_documents WHERE namespace='roster_substitute_requests'")).rows[0].n,1);
  await asUser(db,other,async()=>assert.deepEqual((await db.query('SELECT public.gwcc_roster_requests() doc')).rows[0].doc,[]));
 }finally{await db.close();}
});

test('coordinator replacement approval is atomic, identity-specific and retryable while preserving old instructions and requiring new member confirmation',async()=>{
 const db=await setupDatabase();try{
  await rosterFixture(db);let req;await asUser(db,member,async()=>{req=(await dutyRequest(db)).rows[0].doc;});
  const original=await dutyRow(db);
  await db.exec("UPDATE public.members SET status='inactive' WHERE id='duty-other'");
  await asUser(db,root,async()=>await assert.rejects(reviewDuty(db,req,original),/different active member/));
  await db.exec("UPDATE public.members SET status='active' WHERE id='duty-other'");
  await asUser(db,root,async()=>{
   await assert.rejects(apply(db,[upsert('roster_assignments',{...original,status:'substituted'},original.updated_at)]),/pending substitute request/);
   await assert.rejects(reviewDuty(db,{...req,updated_at:'2000-01-01'},original),/request changed/);
   await assert.rejects(reviewDuty(db,req,original,'approve','duty-own'),/different active member/);
   await assert.rejects(reviewDuty(db,req,{...original,updated_at:'2000-01-01'}),/assignment changed/);
   const saved=(await reviewDuty(db,req,original)).rows[0].doc;
   assert.equal(saved.status,'approved');assert.equal(saved.reviewed_by,root);assert.equal(saved.history.length,2);
   assert.deepEqual((await reviewDuty(db,req,original)).rows[0].doc,saved);
   const replacement=await dutyRow(db,saved.replacement_assignment_id);
   assert.equal(replacement.member_id,'duty-other');assert.equal(replacement.status,'pending');assert.equal(replacement.notes,original.notes);
  });
  const after=await dutyRow(db);assert.equal(after.status,'substituted');assert.equal(after.notes,original.notes);assert.equal(after.member_id,'duty-own');
  assert.equal((await db.query("SELECT count(*)::int n FROM public.roster_assignments WHERE id LIKE 'replacement-%'")).rows[0].n,1);
  await asUser(db,member,async()=>await assert.rejects(db.query("SELECT public.gwcc_member_action('roster','future-duty',$1)",[JSON.stringify({status:'confirmed',expected_updated_at:after.updated_at})]),/no longer awaiting/));
 }finally{await db.close();}
});

test('coordinator rejection requires a reason and does not alter the duty, and reviewed historical linking preserves an exact original snapshot',async()=>{
 const db=await setupDatabase();try{
  await rosterFixture(db);let req;await asUser(db,member,async()=>{req=(await dutyRequest(db)).rows[0].doc;});const before=await dutyRow(db);
  await asUser(db,root,async()=>{
   await assert.rejects(reviewDuty(db,req,before,'reject',null,''),/review reason/);
   const rejected=(await reviewDuty(db,req,before,'reject',null,'Please discuss this with your coordinator')).rows[0].doc;
   assert.equal(rejected.status,'rejected');assert.deepEqual(await dutyRow(db),before);
  });
  await db.exec("UPDATE public.roster_assignments SET member_id='ext-legacy',member_name='Original misspelled name' WHERE id='past-duty'");
  const old=await dutyRow(db,'past-duty');
  await asUser(db,member,async()=>await assert.rejects(db.query('SELECT public.gwcc_link_historical_roster($1,$2,$3)',[old.id,old.updated_at,'duty-own']),/coordinator authorization/));
  await asUser(db,root,async()=>{
   await assert.rejects(db.query('SELECT public.gwcc_link_historical_roster($1,$2,$3)',[old.id,'2000-01-01','duty-own']),/assignment changed/);
   const linked=(await db.query('SELECT public.gwcc_link_historical_roster($1,$2,$3) doc',[old.id,old.updated_at,'duty-own'])).rows[0].doc;
   assert.equal(linked.member_id,'duty-own');assert.equal(linked.date,old.date);assert.equal(linked.notes,old.notes);
   const snapshot=(await db.query("SELECT data->'previous' doc FROM public.gwcc_documents WHERE namespace='roster_link_reviews' AND id='past-duty'")).rows[0].doc;
   assert.deepEqual(snapshot,old);
  });
  await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.gwcc_roster_requests()'),/permission denied/);await db.exec('RESET ROLE');
 }finally{await db.close();}
});

test('official giving channels require finance approval, expose only payment instructions, safely retry, and hide changed account details',async()=>{
 const db=await setupDatabase();
 try{
  let account,enabled;
  await asUser(db,root,async()=>{
   const rows=(await apply(db,[upsert('church_accounts',{id:'giving-bank',name:'Private treasury label',account_type:'bank',account_number:'000000000001',bank_or_provider:'Synthetic Bank',current_balance:1234,currency:'GHS',is_active:true,description:'Private ledger note'}),upsert('church_accounts',{id:'giving-cash',name:'Cash drawer',account_type:'cash_petty',current_balance:0,currency:'GHS'})])).rows[0].result;
   account=rows.find(row=>row.record.id==='giving-bank').record;
   assert.deepEqual((await db.query('SELECT public.gwcc_giving_channels() result')).rows[0].result,[]);
   const catalog=(await db.query('SELECT public.gwcc_giving_channel_accounts() result')).rows[0].result;
   assert.equal(catalog.length,1);assert.equal(catalog[0].enabled,false);assert.ok(!('current_balance' in catalog[0]));assert.ok(!('description' in catalog[0]));
   const id=operation(),args=[id,account.id,account.updated_at,null,true,'Greater Works Synthetic Church'];
   enabled=(await db.query('SELECT public.gwcc_set_giving_channel($1,$2,$3,$4,$5,$6) result',args)).rows[0].result;
   assert.deepEqual((await db.query('SELECT public.gwcc_set_giving_channel($1,$2,$3,$4,$5,$6) result',args)).rows[0].result,enabled);
   await assert.rejects(db.query('SELECT public.gwcc_set_giving_channel($1,$2,$3,$4,$5,$6)',[...args.slice(0,5),'Different name']),/reused/);
   await assert.rejects(db.query('SELECT public.gwcc_set_giving_channel($1,$2,$3,$4,$5,$6)',[operation(),account.id,account.updated_at,null,true,'Stale approval']),/giving channel changed/);
  });
  await asUser(db,member,async()=>{
   const list=(await db.query('SELECT public.gwcc_giving_channels() result')).rows[0].result;
   assert.equal(list.length,1);assert.deepEqual(Object.keys(list[0]).sort(),['id','account_type','account_number','bank_or_provider','currency','account_name'].sort());
   assert.equal(list[0].account_name,'Greater Works Synthetic Church');assert.equal((await db.query('SELECT * FROM public.church_accounts')).rows.length,0);
   assert.equal((await db.query("SELECT * FROM public.gwcc_documents WHERE namespace='official_giving_channels'")).rows.length,0);
   await assert.rejects(db.query('SELECT public.gwcc_giving_channel_accounts()'),/Finance staff/);
   await assert.rejects(db.query('SELECT public.gwcc_set_giving_channel($1,$2,$3,$4,$5,$6)',[operation(),account.id,account.updated_at,enabled.updated_at,false,'']),/Finance staff/);
  });
  await asUser(db,root,async()=>{
   account=(await apply(db,[upsert('church_accounts',{...account,account_number:'000000000002'},account.updated_at)])).rows[0].result[0].record;
   assert.deepEqual((await db.query('SELECT public.gwcc_giving_channels() result')).rows[0].result,[]);
   const args=[operation(),account.id,account.updated_at,enabled.updated_at,true,'Greater Works Synthetic Church'];
   await db.query('SELECT public.gwcc_set_giving_channel($1,$2,$3,$4,$5,$6)',args);
   const published=(await db.query('SELECT public.gwcc_giving_channels() result')).rows[0].result;
   assert.equal(published[0].account_number,'000000000002');
   const current=(await db.query('SELECT public.gwcc_giving_channel_accounts() result')).rows[0].result[0];
   await db.query('SELECT public.gwcc_set_giving_channel($1,$2,$3,$4,$5,$6)',[operation(),account.id,account.updated_at,current.channel_version,false,current.account_name]);
   assert.deepEqual((await db.query('SELECT public.gwcc_giving_channels() result')).rows[0].result,[]);
  });
  assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='giving-bank'")).rows[0].current_balance,'1234.00');
  assert.equal((await db.query("SELECT count(*)::int n FROM public.audit_logs WHERE action='APPROVE_GIVING_CHANNEL'")).rows[0].n,2);
  assert.equal((await db.query("SELECT has_function_privilege('anon','public.gwcc_giving_channels()','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

test('cell reports save canonical identities and exact totals, preserve report history, enforce roles and never post money',async()=>{
 const db=await setupDatabase();
 try{
  const date=new Date().toISOString().slice(0,10),report={id:'cell-report',group_id:'cell-one',group_name:'Forged name',leader_name:'Forged leader',date,topic:'Synthetic meeting',scripture:'Acts 2:42',attendance_men:3,attendance_women:4,attendance_children:2,attendance_visitors:1,total_attendance:999,offering_amount:25.50,prayer_requests:'Synthetic private prayer',testimonies:'Synthetic testimony',recorded_by_id:member,recorded_by:'Forged actor'};
  await asUser(db,root,async()=>{
   await apply(db,[upsert('small_groups',{id:'cell-one',name:'Actual Cell',leader_name:'Actual Leader',meeting_location:'Synthetic address',meeting_day:'Wednesday',meeting_time:'19:00',member_count:0})]);
   const opid=operation(),changes=[upsert('cell_meeting_reports',report)];
   const saved=(await apply(db,changes,opid)).rows[0].result;
   assert.deepEqual((await apply(db,changes,opid)).rows[0].result,saved);
   assert.equal(saved[0].record.total_attendance,10);assert.equal(saved[0].record.group_name,'Actual Cell');assert.equal(saved[0].record.leader_name,'Actual Leader');assert.equal(saved[0].record.recorded_by_id,root);
   assert.equal((await db.query("SELECT count(*)::int n FROM public.gwcc_documents WHERE namespace='cell_meeting_reports'")).rows[0].n,1);
   await assert.rejects(apply(db,[upsert('cell_meeting_reports',{...report,topic:'Rewrite'},saved[0].record.updated_at)]),/preserved/);
   await assert.rejects(apply(db,[{table:'cell_meeting_reports',id:report.id,operation:'delete'}]),/preserved/);
   for(const patch of [{attendance_men:-1},{attendance_women:1.5},{offering_amount:'NaN'},{offering_amount:12.345},{date:'2026-02-30'},{group_id:'missing'},{topic:''}])await assert.rejects(apply(db,[upsert('cell_meeting_reports',{...report,id:crypto.randomUUID(),...patch})]));
  });
  await db.exec(`UPDATE public.profiles SET role='finance_officer',authorization_reviewed_at=now() WHERE id='${other}'`);
  for(const id of [member,other])await asUser(db,id,async()=>{
   assert.equal((await db.query("SELECT * FROM public.gwcc_documents WHERE namespace='cell_meeting_reports'")).rows.length,0);
   await assert.rejects(apply(db,[upsert('cell_meeting_reports',{...report,id:'unauthorized'})]),/authorization|Not authorized/);
  });
  assert.equal((await db.query('SELECT count(*)::int n FROM public.giving')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.church_finances')).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int n FROM public.gwcc_documents WHERE namespace='cell_meeting_reports'")).rows[0].n,1);
 }finally{await db.close();}
});

test('saved legacy counseling requests recover with unchanged operation IDs and safely unblock later edits after a lost response',async()=>{
 const {SyncOutbox}=await import('../src/lib/syncOutbox.ts');
 const db=await setupDatabase();
 try{await asUser(db,root,async()=>{
  let revision=0;const outbox=new SyncOutbox(root,{getItem:()=>null,setItem(){},removeItem(){}},()=>{},{load:async()=>null,save:async(_snapshot,expected)=>{assert.equal(expected,revision);return ++revision;}});
  const record={id:'old-counseling',member_id:'synthetic-person',member_name:'Synthetic Member',date:new Date().toISOString().slice(0,10),status:'scheduled',key_discussion:'Synthetic private note'};
  await outbox.enqueue(upsert('pastoral_counseling',record));await outbox.enqueue(upsert('counseling_sessions',record));await outbox.enqueue(upsert('members',{id:'later-member',first_name:'Later',last_name:'Edit',phone:'0240000000'}));
  const requests=[];let interrupt=true;
  const transport={async rpc(name,args){requests.push(structuredClone(args));try{const result=(await db.query(`SELECT public.${name}($1,$2) result`,[args.p_operation_id,JSON.stringify(args.p_changes)])).rows[0].result;if(interrupt){interrupt=false;return {data:null,error:{message:'Synthetic response lost'}};}return {data:result,error:null};}catch(error){return {data:null,error:{message:error.message}};}}};
  assert.equal((await outbox.flush(transport)).pending,3);
  const status=await outbox.flush(transport);assert.equal(status.success,true);assert.equal(status.pending,0);assert.deepEqual(requests[0],requests[1]);
  assert.equal((await db.query("SELECT count(*)::int n FROM public.gwcc_documents WHERE namespace='counseling_sessions'")).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int n FROM public.gwcc_documents WHERE namespace='pastoral_counseling'")).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int n FROM public.members WHERE id='later-member'")).rows[0].n,1);
 });}finally{await db.close();}
});

test('removing ministry or cell assignments persists explicit nulls through JSON and a database refresh',async()=>{
 const {removeMemberFromMinistry}=await import('../src/features/ministries/ministryStore.ts');
 const {sanitizeMemberForSupabase}=await import('../src/lib/supabase.ts');
 const db=await setupDatabase();
 try{await asUser(db,root,async()=>{
  const data=(await apply(db,[upsert('ministries',{id:'clear-ministry',name:'Synthetic Ministry',member_count:0}),upsert('small_groups',{id:'clear-cell',name:'Synthetic Cell',meeting_location:'Synthetic address',meeting_day:'Wednesday',meeting_time:'19:00',member_count:0}),upsert('members',{id:'clear-person',first_name:'Synthetic',last_name:'Member',phone:'0240000000',ministry_id:'clear-ministry',ministry_name:'Synthetic Ministry',small_group_id:'clear-cell',small_group_name:'Synthetic Cell'})])).rows[0].result;
  let members=[data.find(row=>row.table==='members').record],mutation;
  removeMemberFromMinistry('clear-person',fn=>members=fn(members),()=>{},(table,record)=>mutation=upsert(table,sanitizeMemberForSupabase({...record,small_group_id:null,small_group_name:null}),data.find(row=>row.table==='members').record.updated_at));
  await apply(db,JSON.parse(JSON.stringify([mutation])));
  const actual=(await db.query("SELECT ministry_id,ministry_name,small_group_id,small_group_name FROM public.members WHERE id='clear-person'")).rows[0];
  assert.deepEqual(actual,{ministry_id:null,ministry_name:null,small_group_id:null,small_group_name:null});
 });}finally{await db.close();}
});

test('unnamed welfare fund receipts preserve named dues, treasury balances, server identity and exactly-once retries',async()=>{
  const db=await setupDatabase();
  const receipt={id:'wfr-ledger',amount:15400,date:'2026-10-22',source:'opening_balance',reference_no:'WFR-LEDGER',notes:'Previous welfare fund ledger carried forward',status:'active',recorded_by_id:member,recorded_by:'Forged name',created_at:'1900-01-01T00:00:00Z'};
  try {
    await db.exec("INSERT INTO public.church_accounts(id,name,current_balance,opening_balance,currency) VALUES('wfr-cash','Synthetic cash',10895,10895,'GHS')");
    const before=(await db.query('SELECT to_jsonb(a) doc FROM public.church_accounts a')).rows;
    await asUser(db,root,async()=>{
      const changes=[upsert('welfare_fund_receipts',receipt)],id=operation();
      const first=(await apply(db,changes,id)).rows[0].result;
      const saved=first[0].record;
      assert.equal(saved.amount,15400);assert.equal(saved.status,'active');
      assert.equal(saved.recorded_by_id,root);assert.notEqual(saved.recorded_by,'Forged name');assert.notEqual(saved.created_at,receipt.created_at);
      assert.equal(first[0].canonical_table,'welfare_fund_receipts');
      assert.deepEqual((await apply(db,changes,id)).rows[0].result,first);
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...receipt,amount:1})],id),/Operation ID was reused/);
      assert.equal((await db.query("SELECT count(*)::int n FROM public.gwcc_documents WHERE namespace='welfare_fund_receipts'")).rows[0].n,1);
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...receipt,id:'wfr-duplicate',reference_no:' wfr-ledger '})]),/reference already/);
      await assert.rejects(db.query("INSERT INTO public.gwcc_documents(namespace,id,data) VALUES('welfare_fund_receipts','bypass','{}')"),/permission denied/);
      await assert.rejects(db.query('SELECT gwcc_private.prepare_welfare_fund_receipt($1,NULL)',[JSON.stringify(receipt)]),/permission denied/);
    });
    assert.deepEqual((await db.query('SELECT to_jsonb(a) doc FROM public.church_accounts a')).rows,before);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.welfare_contributions')).rows[0].n,0);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.audit_logs WHERE module='welfare_fund_receipts' AND actor_id=$1",[root])).rows[0].n,1);
    assert.equal((await db.query("SELECT 'public.gwcc_documents'=ANY(gwcc_private.backup_tables()) covered")).rows[0].covered,true);
  }finally{await db.close();}
});

test('welfare fund receipts reject invalid money, dates, unknown fields and changes; voids require a senior role, version and reason',async()=>{
  const db=await setupDatabase();
  const receipt={id:'wfr-controlled',amount:80.25,date:'2026-10-22',source:'donation',reference_no:'WFR-CONTROLLED',notes:'Anonymous welfare donation received',status:'active'};
  try {
    let saved,voided;
    await asUser(db,root,async()=>{
      for(const patch of [{amount:0},{amount:-1},{amount:0.001},{amount:'NaN'},{amount:'Infinity'},{amount:null},{amount:1e9+1},{date:'2099-01-01'},{date:'2026-02-30'},{date:'bad'},{source:null},{source:'constructor'},{notes:'x'},{reference_no:' '},{member_id:'some-member'},{member_name:'Anonymous'},{account_id:'cash'},{status:'voided'},{void_reason:'fake void'}])await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...receipt,...patch})]));
      saved=(await apply(db,[upsert('welfare_fund_receipts',receipt)])).rows[0].result[0].record;
      await assert.rejects(apply(db,[{table:'welfare_fund_receipts',id:receipt.id,operation:'delete'}]),/voided, not deleted/);
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...saved,status:'voided',void_reason:'Duplicate receipt'})]),/version is required/);
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...saved,amount:100},saved.updated_at)]),/cannot be edited/);
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...saved,source:'other'},saved.updated_at)]),/cannot be edited/);
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...saved,status:'voided',void_reason:'x'},saved.updated_at)]),/void reason/);
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...saved,status:'voided',void_reason:'Duplicate receipt'},'2020-01-01T00:00:00Z')]),/changed on another device/);
    });
    await db.query("UPDATE public.profiles SET role='finance_officer',authorization_reviewed_at=now() WHERE id=$1",[other]);
    await asUser(db,other,async()=>{
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...saved,status:'voided',void_reason:'Duplicate receipt'},saved.updated_at)]),/senior pastor/);
      const own=(await apply(db,[upsert('welfare_fund_receipts',{...receipt,id:'wfr-finance',reference_no:'WFR-FINANCE',source:'unallocated_dues'})])).rows[0].result[0].record;
      assert.equal(own.recorded_by_id,other);
    });
    await asUser(db,root,async()=>{
      const changes=[upsert('welfare_fund_receipts',{...saved,status:'voided',void_reason:'Receipt entered twice',voided_by_id:member,voided_at:'1900-01-01T00:00:00Z'},saved.updated_at)],id=operation();
      const response=(await apply(db,changes,id)).rows[0].result;voided=response[0].record;
      assert.equal(voided.status,'voided');assert.equal(voided.amount,80.25);assert.equal(voided.recorded_by_id,root);assert.equal(voided.created_at,saved.created_at);
      assert.equal(voided.voided_by_id,root);assert.notEqual(voided.voided_at,'1900-01-01T00:00:00Z');assert.equal(voided.void_reason,'Receipt entered twice');
      assert.deepEqual((await apply(db,changes,id)).rows[0].result,response);
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...voided,status:'active'},voided.updated_at)]),/cannot be reopened/);
      await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...voided,void_reason:'Changed reason'},voided.updated_at)]),/cannot be reopened/);
      assert.equal((await db.query("SELECT data FROM public.gwcc_documents WHERE namespace='welfare_fund_receipts' AND id='wfr-controlled'")).rows[0].data.void_reason,'Receipt entered twice');
    });
  }finally{await db.close();}
});

test('welfare fund permissions deny members, unreviewed and disabled accounts, and staff without finance or welfare access',async()=>{
  const db=await setupDatabase();
  const receipt={id:'wfr-access',amount:25,date:'2026-10-22',source:'other',reference_no:'WFR-ACCESS',notes:'Synthetic additional welfare funds',status:'active'};
  try {
    await asUser(db,root,()=>apply(db,[upsert('welfare_fund_receipts',receipt)]));
    const select=()=>db.query("SELECT data FROM public.gwcc_documents WHERE namespace='welfare_fund_receipts'");
    for(const role of ['member','administrator','pastor','ministry_leader','attendance_officer','data_entry']){
      await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,other]);
      await asUser(db,other,async()=>{
        assert.equal((await select()).rows.length,['administrator','pastor'].includes(role)?1:0,role);
        await assert.rejects(apply(db,[upsert('welfare_fund_receipts',{...receipt,id:`wfr-${role}`,reference_no:`WFR-${role}`})]),/authorization|authorized/);
      });
    }
    for(const role of ['super_admin','senior_pastor','finance_officer']){
      await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,other]);
      await asUser(db,other,async()=>{assert.equal((await select()).rows.length,1);assert.equal((await db.query("SELECT public.gwcc_can_write('welfare_fund_receipts') ok")).rows[0].ok,true);});
    }
    for(const update of ["authorization_reviewed_at=NULL","authorization_reviewed_at=now(),is_active=false"]){
      await db.exec(`UPDATE public.profiles SET ${update} WHERE id='${other}'`);
      await asUser(db,other,async()=>{assert.equal((await select()).rows.length,0);await assert.rejects(apply(db,[upsert('welfare_fund_receipts',receipt)]),/authorization/);});
    }
    await db.query("UPDATE public.profiles SET role='finance_officer',authorization_reviewed_at=now(),is_active=true WHERE id=$1",[other]);
    await asUser(db,other,async()=>{assert.equal((await select()).rows.length,0);await assert.rejects(apply(db,[upsert('welfare_fund_receipts',receipt)]),/authorization/);},{aal:'aal1',session_id:other,role:'authenticated'});
    await db.query("UPDATE auth.sessions SET not_after=now()-interval '1 minute' WHERE user_id=$1",[other]);
    await asUser(db,other,async()=>{assert.equal((await select()).rows.length,0);await assert.rejects(apply(db,[upsert('welfare_fund_receipts',receipt)]),/authorization/);});
    await db.exec('SET ROLE anon');await assert.rejects(select(),/permission denied/);
  }finally{await db.close();}
});

const validEvent=(id,extra={})=>({id,title:'Synthetic safe event',event_type:'conference',start_date:'2099-10-24',end_date:'2099-10-24',start_time:'18:00',end_time:'20:00',venue:'Synthetic venue',status:'upcoming',requires_registration:true,attendees:[],budget:0,expected_attendance:0,...extra});
test('event writes validate schedules and amounts, require versions, and preserve a concurrent member RSVP',async()=>{
 const db=await setupDatabase();try{
  await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone,auth_user_id) VALUES('event-concurrent','GWCC-CONCURRENT','Own','Member','0240000001','${member}');`);
  let original;
  await asUser(db,root,async()=>{
   for(const [index,changes] of [{end_date:'2099-10-23'},{start_time:'garbage'},{budget:-5},{budget:0.001},{expected_attendance:-1},{attendees:{}},{attendees:[{id:'bad',name:'Spoofed',checked_in:'yes'}]}].entries())await assert.rejects(apply(db,[upsert('events',validEvent('invalid-event-'+index,changes))]));
   original=(await apply(db,[upsert('events',validEvent('concurrent-event'))])).rows[0].result[0].record;
   await assert.rejects(apply(db,[upsert('events',{...original,title:'Unversioned overwrite'})]),/event version is required/);
  });
  await asUser(db,member,()=>db.query("SELECT public.gwcc_member_rsvp('concurrent-event')"));
  await asUser(db,root,async()=>{
   await assert.rejects(apply(db,[upsert('events',{...original,title:'Stale overwrite'},original.updated_at)]),/changed on another device/);
   const current=(await db.query("SELECT to_jsonb(e) doc FROM public.events e WHERE id='concurrent-event'")).rows[0].doc;
   assert.equal(current.attendees.length,1);
   const saved=(await apply(db,[upsert('events',{id:current.id,title:'Fresh safe edit'},current.updated_at)])).rows[0].result[0].record;
   assert.equal(saved.attendees.length,1);assert.equal(saved.expected_attendance,0);assert.equal(saved.title,'Fresh safe edit');
   await assert.rejects(apply(db,[{table:'events',id:saved.id,operation:'delete',expected_updated_at:saved.updated_at}]),/must be cancelled/);
   const checked=(await apply(db,[upsert('events',{...saved,attendees:saved.attendees.map(person=>({...person,checked_in:true}))},saved.updated_at)])).rows[0].result[0].record;
   await assert.rejects(apply(db,[upsert('events',{...checked,attendees:[]},checked.updated_at)]),/checked-in person cannot be removed/);
   const cancelled=(await apply(db,[upsert('events',{...checked,status:'cancelled'},checked.updated_at)])).rows[0].result[0].record;
   assert.equal(cancelled.attendees[0].checked_in,true);
  });
 }finally{await db.close();}
});
test('drafts stay private and members cannot RSVP when disabled or already ended today',async()=>{
 const db=await setupDatabase();try{
  await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone,auth_user_id) VALUES('event-rules','GWCC-RULES','Own','Member','0240000001','${member}');`);
  await asUser(db,root,async()=>{
   for(const row of [validEvent('private-draft',{status:'draft'}),validEvent('disabled-rsvp',{requires_registration:false}),validEvent('open-rsvp'),validEvent('ended-today',{start_date:new Date().toISOString().slice(0,10),end_date:new Date().toISOString().slice(0,10),start_time:'00:00',end_time:'00:01'})])await apply(db,[upsert('events',row)]);
  });
  await asUser(db,member,async()=>{
   const rows=(await db.query('SELECT public.gwcc_member_events() doc')).rows[0].doc;
   assert.ok(!rows.some(row=>row.id==='private-draft'));
   for(const id of ['private-draft','disabled-rsvp','ended-today'])await assert.rejects(db.query('SELECT public.gwcc_member_rsvp($1)',[id]),/no longer available|Registration is closed/);
   const first=(await db.query("SELECT public.gwcc_member_rsvp('open-rsvp') doc")).rows[0].doc;
   assert.equal(first.attendees.length,1);
   assert.deepEqual((await db.query("SELECT public.gwcc_member_rsvp('open-rsvp') doc")).rows[0].doc,first);
  });
  await db.exec("UPDATE public.events SET status='draft' WHERE id='open-rsvp'");
  await asUser(db,member,()=>assert.rejects(db.query("SELECT public.gwcc_member_rsvp('open-rsvp')"),/no longer available/));
 }finally{await db.close();}
});
test('staff event registration canonicalizes members, prevents alias duplicates, and audits removals',async()=>{
 const db=await setupDatabase();try{
  await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone) VALUES('staff-event-person','GWCC-STAFF-EVENT','Canonical','Member','0240000001');`);
  await asUser(db,root,async()=>{
   let row=(await apply(db,[upsert('events',validEvent('staff-event'))])).rows[0].result[0].record;
   row=(await apply(db,[upsert('events',{...row,attendees:[{id:'att-one',member_id:'GWCC-STAFF-EVENT',name:'Spoofed name',registered_at:'2000-01-01',checked_in:false}]},row.updated_at)])).rows[0].result[0].record;
   assert.equal(row.attendees[0].member_id,'staff-event-person');assert.equal(row.attendees[0].name,'Canonical Member');assert.notEqual(row.attendees[0].registered_at,'2000-01-01');
   await assert.rejects(apply(db,[upsert('events',{...row,attendees:[...row.attendees,{id:'att-two',member_id:'GWCC-STAFF-EVENT',name:'Duplicate',checked_in:false}]},row.updated_at)]),/already registered/);
   await assert.rejects(apply(db,[upsert('events',{...row,attendees:row.attendees.map(person=>({...person,member_id:'someone-else'}))},row.updated_at)]),/identity and registration date cannot/);
   row=(await apply(db,[upsert('events',{...row,attendees:[]},row.updated_at)])).rows[0].result[0].record;
   assert.equal(row.registration_count,0);
   const audit=(await db.query("SELECT details FROM public.audit_logs WHERE action='REMOVE_EVENT_ATTENDEE' AND record_id='staff-event'")).rows;
   assert.equal(audit.length,1);assert.match(audit[0].details,/Canonical Member/);
  });
 }finally{await db.close();}
});

test('pledges preserve historical balances and enforce versioned receipt-backed collections, atomic Giving, voids and protected history',async()=>{
  let legacyBefore;
  const db=await setupDatabase({beforePledgeControls:async db=>{
    await db.exec(`INSERT INTO public.members(id,member_id,first_name,last_name,phone) VALUES('pledge-member','PLG-MEMBER','Synthetic','Partner','0240000001');
      INSERT INTO public.pledge_campaigns(id,name,target_amount,start_date,end_date,is_active) VALUES('pledge-campaign','Synthetic campaign',1000,'2026-01-01','2099-12-31',true);
      INSERT INTO public.pledges(id,campaign_id,member_id,member_name,campaign_name,amount_pledged,amount_paid,start_date,due_date) VALUES('legacy-pledge','pledge-campaign','pledge-member','Synthetic Partner','Synthetic campaign',100,20,'2026-01-01','2099-12-31');`);
    legacyBefore=(await db.query("SELECT amount_pledged,amount_paid,balance,status FROM public.pledges WHERE id='legacy-pledge'")).rows[0];
  }});
  const read=async(table,id)=>(await db.query(`SELECT to_jsonb(p) doc FROM public.${table} p WHERE id=$1`,[id])).rows[0]?.doc;
  const receipt=(id,amount=10,extra={})=>({id,amount,date:'2026-10-01',payment_method:'cash',payment_channel:'Cash counter',transaction_reference:'SYNTHETIC',notes:'Synthetic payment note',sync_with_giving:false,status:'completed',...extra});
  const receiptId='bbbbbbbb-bbbb-4bbb-8bbb-000000000001',linkedId='bbbbbbbb-bbbb-4bbb-8bbb-000000000002';
  try {
    assert.deepEqual((await db.query("SELECT amount_pledged,amount_paid,balance,status FROM public.pledges WHERE id='legacy-pledge'")).rows[0],legacyBefore);
    await asUser(db,root,async()=>{
      let row=await read('pledges','legacy-pledge');
      await assert.rejects(apply(db,[upsert('pledges',{...row,amount_paid:30},row.updated_at)]),/payment receipts/);
      await assert.rejects(apply(db,[upsert('pledges',{...row,notes:'stale unversioned edit'})]),/version is required/);
      await assert.rejects(apply(db,[upsert('pledges',{...row,payments:[receipt(receiptId,81)]},row.updated_at)]),/remaining pledge balance/);
      await assert.rejects(apply(db,[upsert('pledges',{...row,payments:[receipt(receiptId,1.001)]},row.updated_at)]),/two decimals/);
      await assert.rejects(apply(db,[upsert('pledges',{...row,payments:[receipt(receiptId,10,{notes:{unsafe:'object'}})]},row.updated_at)]),/must be text/);
      const beforePayment=row,operationId=operation(),change=upsert('pledges',{...row,legacy_paid_amount:999,payments:[receipt(receiptId)]},row.updated_at);
      const first=(await apply(db,[change],operationId)).rows[0].result;
      assert.deepEqual((await apply(db,[change],operationId)).rows[0].result,first,'same operation retries once');
      row=await read('pledges',row.id);
      assert.equal(row.legacy_paid_amount,20);assert.equal(row.amount_paid,30);assert.equal(row.balance,70);
      assert.equal(row.payments[0].recorded_by_id,root);assert.match(row.payments[0].receipt_no,/^PLG-/);assert.ok(row.payments[0].recorded_at);
      await assert.rejects(apply(db,[upsert('pledges',{...beforePayment,notes:'stale edit'},beforePayment.updated_at)]),/changed on another device/);
      await assert.rejects(apply(db,[upsert('pledges',{...row,payments:[]},row.updated_at)]),/history cannot be removed/);
      await assert.rejects(apply(db,[upsert('pledges',{...row,payments:[{...row.payments[0],amount:9}]},row.updated_at)]),/cannot be rewritten/);
      await assert.rejects(apply(db,[upsert('pledges',{...row,amount_pledged:29},row.updated_at)]),/remaining pledge balance/);
      const linked=receipt(linkedId,15,{sync_with_giving:true,giving_id:'pledge-gift'});
      const gift={id:'pledge-gift',member_id:'forged',member_name:'Forged',category:'Other',amount:15,currency:'GHS',date:linked.date,payment_method:'cash',payment_channel:linked.payment_channel,reference_number:linked.transaction_reference,notes:linked.notes,pledge_id:row.id,status:'completed'};
      const parent=upsert('pledges',{...row,payments:[...row.payments,linked]},row.updated_at);
      await assert.rejects(apply(db,[parent]),/saved together/);
      assert.equal((await read('pledges',row.id)).amount_paid,30,'failed linked batch rolls back balance');
      await assert.rejects(apply(db,[parent,upsert('giving',{...gift,amount:16})]),/matching details/);
      assert.equal(await read('giving',gift.id),undefined,'failed linked batch rolls back receipt');
      await apply(db,[parent,upsert('giving',gift)]);
      row=await read('pledges',row.id);let savedGift=await read('giving',gift.id);
      assert.equal(row.amount_paid,45);assert.equal(row.balance,55);assert.equal(savedGift.pledge_id,row.id);assert.equal(savedGift.member_id,'pledge-member');assert.equal(savedGift.category,'Building Fund');
      await assert.rejects(apply(db,[upsert('giving',{...savedGift,status:'voided',void_reason:'Independent void'},savedGift.updated_at)]),/linked pledge payment/);
      await assert.rejects(apply(db,[upsert('giving',{...savedGift,amount:14},savedGift.updated_at)]),/through the pledge/);
      const voided={...row,payments:row.payments.map(r=>r.id===linkedId?{...r,status:'voided',void_reason:'Duplicate receipt correction'}:r)};
      await assert.rejects(apply(db,[upsert('pledges',voided,row.updated_at)]),/saved together/);
      await assert.rejects(apply(db,[upsert('pledges',voided,row.updated_at),upsert('giving',{...savedGift,status:'voided',void_reason:'Different correction reason'},savedGift.updated_at)]),/matching details/);
      await apply(db,[upsert('pledges',voided,row.updated_at),upsert('giving',{...savedGift,status:'voided',void_reason:'Duplicate receipt correction',voided_by:'forged actor'},savedGift.updated_at)]);
      row=await read('pledges',row.id);savedGift=await read('giving',gift.id);
      assert.equal(row.amount_paid,30);assert.equal(row.payments.length,2);assert.equal(savedGift.status,'voided');assert.equal(savedGift.voided_by,root);assert.equal(row.payments[1].voided_by_id,root);
      await assert.rejects(apply(db,[upsert('pledges',{...row,payments:row.payments.map(r=>r.id===linkedId?{...r,status:'completed'}:r)},row.updated_at)]),/cannot be reopened/);
      await assert.rejects(apply(db,[{table:'pledges',id:row.id,operation:'delete',expected_updated_at:row.updated_at}]),/payment history/);
      const campaign=await read('pledge_campaigns','pledge-campaign');
      await assert.rejects(apply(db,[upsert('pledge_campaigns',{...campaign,name:'unversioned'})]),/version is required/);
      await assert.rejects(apply(db,[{table:'pledge_campaigns',id:campaign.id,operation:'delete',expected_updated_at:campaign.updated_at}]),/archived/);
      await apply(db,[upsert('pledge_campaigns',{...campaign,is_active:false},campaign.updated_at)]);
      assert.equal((await read('pledges',row.id)).amount_paid,30);
      const base={id:'new-pledge',campaign_id:campaign.id,member_id:'pledge-member',amount_pledged:100,amount_paid:0,start_date:'2026-01-01',due_date:'2099-12-31',status:'active'};
      await assert.rejects(apply(db,[upsert('pledges',base)]),/active saved campaign/);
      const archived=await read('pledge_campaigns',campaign.id);await apply(db,[upsert('pledge_campaigns',{...archived,is_active:true},archived.updated_at)]);
      await assert.rejects(apply(db,[upsert('pledges',{...base,amount_paid:20})]),/payment receipts/);
      await assert.rejects(apply(db,[upsert('pledges',{...base,member_id:'missing'})]),/active saved member/);
      await assert.rejects(apply(db,[upsert('pledges',{...base,payments:[receipt(receiptId)]})]),/already in use/);
      await apply(db,[upsert('pledges',{...base,payments:[receipt('bbbbbbbb-bbbb-4bbb-8bbb-000000000003',5)]})]);
      assert.equal((await read('pledges',base.id)).amount_paid,5,'initial payment is atomic with pledge creation');
      await apply(db,[upsert('giving',{id:'unlinked-gift',category:'Building Fund',amount:1,currency:'GHS',date:'2026-10-01',payment_method:'cash'})]);
      const unlinked=await read('giving','unlinked-gift');await assert.rejects(apply(db,[upsert('giving',{...unlinked,pledge_id:row.id},unlinked.updated_at)]),/cannot be reassigned/);
      await assert.rejects(db.query("UPDATE public.pledges SET amount_paid=999 WHERE id='legacy-pledge'"),/permission denied/);
    });
    await db.query("UPDATE public.members SET auth_user_id=$1 WHERE id='pledge-member'",[member]);
    await asUser(db,member,async()=>{
      assert.equal((await db.query("SELECT payments FROM public.pledges WHERE id='legacy-pledge'")).rows[0].payments.length,2);
      await assert.rejects(apply(db,[upsert('pledges',{id:'forbidden'})]),/Staff authorization/);
      await assert.rejects(db.query('SELECT gwcc_private.prepare_pledge($1,NULL)',[JSON.stringify({})]),/permission denied/);
    });
    assert.equal((await db.query("SELECT count(*)::int n FROM public.audit_logs WHERE action='VOID_PLEDGE_PAYMENT'")).rows[0].n,1);
  } finally {await db.close();}
});

test('portal activation is a read-only MFA-guarded snapshot with correct account states and no Auth secrets',async()=>{
  const db=await setupDatabase();
  const ready='44444444-4444-4444-8444-444444444444';
  try{
    await db.exec(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('${ready}','ready@example.test',now()); UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${other}';`);
    await asUser(db,root,async()=>{
      const rows=[['activation-email',null],['activation-new','new@example.test'],['activation-link','member@example.test'],['activation-pending','other@example.test'],['activation-ready','ready@example.test'],['activation-staff','root@example.test'],['activation-conflict','other@example.test'],['activation-archived','archived@example.test']];
      await apply(db,rows.map(([id,email])=>upsert('members',{id,first_name:'Synthetic',last_name:id,email,phone:'0240000000',is_archived:id==='activation-archived'})));
      for(const [id,user,email] of [['activation-pending',other,'other@example.test'],['activation-ready',ready,'ready@example.test']])
        await db.query('SELECT public.gwcc_link_member_login($1,$2,$3)',[id,user,email]);
      const before=(await db.query('SELECT count(*) AS n FROM public.audit_logs')).rows[0].n;
      const result=(await db.query('SELECT public.gwcc_member_activation_overview() AS snapshot')).rows[0].snapshot;
      const states=Object.fromEntries(result.members.map(row=>[row.id,row.state]));
      assert.equal(states['activation-email'],'needs_email');assert.equal(states['activation-new'],'not_invited');assert.equal(states['activation-link'],'needs_link');
      assert.equal(states['activation-pending'],'pending');assert.equal(states['activation-ready'],'ready');assert.equal(states['activation-staff'],'review');assert.equal(states['activation-conflict'],'review');assert.equal(states['activation-archived'],undefined);
      for(const row of result.members)assert.deepEqual(Object.keys(row).sort(),['email','id','member_id','name','reason','state']);
      assert.equal((await db.query('SELECT count(*) AS n FROM public.audit_logs')).rows[0].n,before);
    });
    for(const role of ['member','administrator','pastor','finance_officer']){
      await db.query('UPDATE public.profiles SET role=$1,authorization_reviewed_at=now() WHERE id=$2',[role,root]);
      await asUser(db,root,async()=>assert.rejects(db.query('SELECT public.gwcc_member_activation_overview()'),/super administrator/));
    }
    await db.query("UPDATE public.profiles SET role='super_admin' WHERE id=$1",[root]);
    await asUser(db,root,async()=>assert.rejects(db.query('SELECT public.gwcc_member_activation_overview()'),/two-factor/),{role:'authenticated',aal:'aal1',session_id:root});
    await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.gwcc_member_activation_overview()'),/permission denied/);await db.exec('RESET ROLE');
    await db.query('UPDATE public.profiles SET is_active=false WHERE id=$1',[root]);
    await asUser(db,root,async()=>assert.rejects(db.query('SELECT public.gwcc_member_activation_overview()'),/super administrator/));
  }finally{await db.close();}
});

test('graduation repair restores only the derived member flag, preserves history and is idempotently audited',async()=>{
  const db=await setupDatabase();
  try{
    await asUser(db,root,async()=>{
      await apply(db,[upsert('members',{id:'completion-repair',first_name:'Synthetic',last_name:'Graduate',phone:'0240000000',membership_class_completed:false})]);
      await apply(db,[upsert('foundation_students',{id:'completion-student',member_id:'completion-repair',status:'graduated',graduation_date:'2020-01-01',certificate_no:'KEEP-ORIGINAL',completed_modules:[1,2,3,4,5]})]);
    });
    const before=(await db.query("SELECT to_jsonb(m)-'updated_at'-'membership_class_completed' AS record FROM public.members m WHERE id='completion-repair'")).rows[0].record;
    const history=(await db.query("SELECT data FROM public.gwcc_documents WHERE id='completion-student' AND namespace='foundation_students'")).rows[0].data;
    const migration=fs.readdirSync('supabase/migrations').find(file=>file.endsWith('_reliable_operations_portal_activation.sql'));
    const sql=fs.readFileSync(`supabase/migrations/${migration}`,'utf8');await db.exec(sql);await db.exec(sql);
    const after=(await db.query("SELECT to_jsonb(m)-'updated_at'-'membership_class_completed' AS record,membership_class_completed AS completed FROM public.members m WHERE id='completion-repair'")).rows[0];
    assert.deepEqual(after.record,before);assert.equal(after.completed,true);
    assert.deepEqual((await db.query("SELECT data FROM public.gwcc_documents WHERE id='completion-student' AND namespace='foundation_students'")).rows[0].data,history);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM public.audit_logs WHERE action='REPAIR_FOUNDATION_COMPLETION' AND record_id='completion-repair'")).rows[0].n,1);
  }finally{await db.close();}
});

test('welfare officers can record dues and review relief with MFA, without treasury, staff or unrelated record access',async()=>{
  const db=await setupDatabase();
  try {
    await db.exec("INSERT INTO public.members(id,member_id,first_name,last_name,email,phone,status,is_archived) VALUES('officer-member','GWCC-OFFICER','Synthetic','Beneficiary','beneficiary@example.test','0240000000','active',false)");
    await asUser(db,root,async()=>{
      const result=(await db.query('SELECT public.gwcc_manage_profile($1,$2) p',[other,JSON.stringify({role:'welfare_officer',first_name:'Synthetic',last_name:'Officer'})])).rows[0].p;
      assert.equal(result.role,'welfare_officer');assert.ok(result.authorization_reviewed_at);
    });
    await asUser(db,other,async()=>{
      const security=(await db.query('SELECT public.gwcc_security_status() s')).rows[0].s;
      assert.equal(security.required,true);assert.equal(security.satisfied,false);
      assert.equal((await db.query("SELECT public.gwcc_can_read('welfare_claims') ok")).rows[0].ok,false);
      await assert.rejects(apply(db,[upsert('welfare_contributions',{id:'pre-mfa',amount:20})]),/authorized|authorization/);
    },{role:'authenticated',aal:'aal1',session_id:other});
    await asUser(db,other,async()=>{
      const read=['members','welfare_contributions','welfare_claims','welfare_events','welfare_event_contributions','welfare_fund_receipts'];
      const write=read.filter(t=>!['members','welfare_fund_receipts'].includes(t));
      for(const table of [...read,'profiles','settings','audit_logs','church_accounts','church_finances','giving','pledges','pastoral_care','prayer_requests','visitors','communications','attendance','services','events','assets','foundation_students']){
        const flags=(await db.query('SELECT public.gwcc_can_read($1) r, public.gwcc_can_write($1) w',[table])).rows[0];
        assert.equal(flags.r,read.includes(table),`read ${table}`);assert.equal(flags.w,write.includes(table),`write ${table}`);
      }
      assert.equal((await db.query('SELECT id FROM public.members')).rows.length,1);
      const dues={id:'officer-dues',member_id:'officer-member',member_name:'Synthetic Beneficiary',amount:20,date:'2026-10-29',month:'2026-10',payment_method:'cash',recorded_by:'Forged reviewer'};
      const request=[upsert('welfare_contributions',dues)],id=operation();
      const result=(await apply(db,request,id)).rows[0].result;
      assert.equal(result[0].record.recorded_by,'Synthetic Officer');
      assert.deepEqual((await apply(db,request,id)).rows[0].result,result);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.welfare_contributions')).rows[0].n,1);
      for(const patch of [{amount:-1},{amount:0},{amount:'NaN'},{amount:0.001},{member_id:'missing'},{month:'2026-99'}])await assert.rejects(apply(db,[upsert('welfare_contributions',{...dues,...patch,id:crypto.randomUUID()})]));
      await assert.rejects(apply(db,[{table:'welfare_contributions',id:dues.id,operation:'delete'}]),/preserve records/);
      const claim={id:'officer-claim',claim_number:'BEN-OFFICER',beneficiary_type:'church_member',member_id:'officer-member',member_name:'Synthetic Beneficiary',category:'emergency_relief',title:'Synthetic relief',description:'Synthetic request',amount_requested:50,amount_approved:0,status:'pending',date_submitted:'2026-10-29'};
      let saved=(await apply(db,[upsert('welfare_claims',claim)])).rows[0].result[0].record;
      saved=(await apply(db,[upsert('welfare_claims',{...saved,status:'approved',amount_approved:30,reviewed_by:'Senior Pastor',date_reviewed:'1900-01-01'},saved.updated_at)])).rows[0].result[0].record;
      assert.equal(saved.reviewed_by,'Synthetic Officer');assert.notEqual(saved.date_reviewed,'1900-01-01');assert.equal(saved.amount_approved,30);
      for(const patch of [{amount_disbursed:1},{disbursements:[{amount:1,finance_transaction_id:'fake'}]},{finance_account_id:'bank'},{disbursement_date:'2026-10-29'},{status:'disbursed'}])await assert.rejects(apply(db,[upsert('welfare_claims',{...saved,...patch},saved.updated_at)]),/finance|payment|payout/);
      await assert.rejects(apply(db,[{table:'welfare_claims',id:saved.id,operation:'delete'}]),/preserve records/);
      const event={id:'officer-appeal',title:'Synthetic appeal',category:'emergency_relief',member_id:'officer-member',member_name:'Synthetic Beneficiary',description:'Synthetic appeal',end_date:'2026-11-30',minimum_contribution:20,status:'open',created_by:'Synthetic Officer'};
      await apply(db,[upsert('welfare_events',event)]);
      const contribution={id:'officer-appeal-receipt',event_id:event.id,member_id:'officer-member',contributor_name:'Synthetic Beneficiary',amount:20,payment_date:'2026-10-29',payment_method:'cash',payment_status:'confirmed',recorded_by:'Forged actor',finance_linked:false};
      const appealReceipt=(await apply(db,[upsert('welfare_event_contributions',contribution)])).rows[0].result[0].record;
      assert.equal(appealReceipt.recorded_by,'Synthetic Officer');
      for(const patch of [{finance_linked:true},{finance_transaction_id:'receipt'},{finance_account_id:'bank'}])await assert.rejects(apply(db,[upsert('welfare_event_contributions',{...appealReceipt,...patch},appealReceipt.updated_at)]),/Finance staff/);
      await assert.rejects(apply(db,[{table:'welfare_events',id:event.id,operation:'delete'}]),/preserve records/);
      await assert.rejects(db.query('SELECT public.gwcc_manage_profile($1,$2)',[other,JSON.stringify({role:'super_admin'})]),/super administrator/);
      for(const table of ['church_finances','church_accounts','giving','members','welfare_fund_receipts'])await assert.rejects(apply(db,[upsert(table,{id:`officer-denied-${table}`,amount:20})]),/authorized|authorization/);
    });
    assert.equal((await db.query("SELECT count(*)::int n FROM public.audit_logs WHERE actor_id=$1 AND module='welfare_contributions'",[other])).rows[0].n,1);
    for(const updates of ['authorization_reviewed_at=NULL','authorization_reviewed_at=now(),is_active=false']){
      await db.exec(`UPDATE public.profiles SET ${updates} WHERE id='${other}'`);
      await asUser(db,other,async()=>{assert.equal((await db.query("SELECT public.gwcc_can_read('welfare_claims') ok")).rows[0].ok,false);});
    }
    const migration=fs.readdirSync('supabase/migrations').find(name=>name.endsWith('_welfare_officer_access.sql'));
    await db.exec(fs.readFileSync(`supabase/migrations/${migration}`,'utf8'));
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','gwcc_private.prepare_welfare_officer_mutation(text,text,jsonb,jsonb)','EXECUTE') ok")).rows[0].ok,false);
  }finally{await db.close();}
});

test('Giving deposits post once, link existing income without a second credit, protect receipts and retain recovery coverage',async()=>{
 const db=await setupDatabase();
 try{await asUser(db,root,async()=>{
  const date=new Date().toISOString().slice(0,10);
  await apply(db,[upsert('church_accounts',{id:'deposit-cash',name:'Deposit cash',account_type:'cash_petty',currency:'GHS',is_active:true,current_balance:100})]);
  await apply(db,[upsert('giving',{id:'deposit-g1',category:'Tithe',amount:40,currency:'GHS',date,payment_method:'cash',status:'completed'}),upsert('giving',{id:'deposit-g2',category:'Offering',amount:60,currency:'GHS',date,payment_method:'cash',status:'completed'})]);
  const receipts=(await db.query("SELECT id,updated_at FROM public.giving WHERE id LIKE 'deposit-g%' ORDER BY id")).rows;
  const args=[operation(),JSON.stringify(receipts),'deposit-cash',date,'cash','',null,null];
  const post=args=>db.query('SELECT public.gwcc_post_giving_deposit($1,$2,$3,$4,$5,$6,$7,$8) result',args);
  const saved=(await post(args)).rows[0].result;
  assert.equal(Number(saved.giving_deposit_amount),100);assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='deposit-cash'")).rows[0].current_balance,'200.00');
  assert.deepEqual((await post(args)).rows[0].result,saved);
  await assert.rejects(post([operation(),...args.slice(1)]),/already allocated/);
  await assert.rejects(post([args[0],...args.slice(1,5),'different',null,null]),/reused with different/);
  await assert.rejects(apply(db,[upsert('giving',{id:'deposit-g1',status:'voided',void_reason:'Synthetic correction'},receipts[0].updated_at)]),/Void the linked treasury income/);
  await assert.rejects(apply(db,[upsert('church_finances',{id:saved.id,giving_deposit_amount:0},saved.updated_at)]),/deposit totals/);
  await assert.rejects(apply(db,[upsert('church_finances',{id:saved.id,amount:120},saved.updated_at)]),/linked treasury income/);
  assert.equal((await db.query('SELECT public.gwcc_giving_deposit_links() result')).rows[0].result.filter(row=>row.active).length,2);
  const backup=(await db.query("SELECT public.gwcc_backup_create() result")).rows[0].result;
  const archive=(await db.query('SELECT public.gwcc_backup_export($1) result',[backup])).rows[0].result;
  assert.equal(JSON.parse(archive.payload_text).tables['public.gwcc_documents'].filter(row=>row.namespace==='giving_deposit_links').length,2);
  // The protected links use the already-covered document table; no new backup table is omitted.
  assert.equal((await db.query("SELECT count(*)::int n FROM public.gwcc_documents WHERE namespace='giving_deposit_links'")).rows[0].n,2);
  await apply(db,[upsert('church_finances',{id:saved.id,status:'voided',void_reason:'Replace the synthetic allocation'},saved.updated_at)]);
  assert.equal((await db.query('SELECT public.gwcc_giving_deposit_links() result')).rows[0].result.filter(row=>row.active).length,0);
  await apply(db,[upsert('church_finances',{id:'existing-deposit',transaction_type:'income',account_id:'deposit-cash',account_name:'Deposit cash',category:'Income',title:'Existing collection',amount:150,currency:'GHS',date,payment_method:'cash',status:'completed'})]);
  const existing=(await db.query("SELECT updated_at FROM public.church_finances WHERE id='existing-deposit'")).rows[0];
  const before=(await db.query("SELECT current_balance FROM public.church_accounts WHERE id='deposit-cash'")).rows[0].current_balance;
  const linked=(await post([operation(),JSON.stringify(receipts),'deposit-cash',date,'cash','','existing-deposit',existing.updated_at])).rows[0].result;
  assert.equal(Number(linked.giving_deposit_amount),100);assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='deposit-cash'")).rows[0].current_balance,before);
  assert.equal((await db.query("SELECT count(*)::int n FROM public.giving WHERE id LIKE 'deposit-g%' AND status='completed'")).rows[0].n,2);
 });}finally{await db.close();}
});

test('Giving deposit validation rolls back stale, duplicate, excessive and unavailable selections and denies non-finance sessions',async()=>{
 const db=await setupDatabase();try{
  let args;
  await asUser(db,root,async()=>{
   const date=new Date().toISOString().slice(0,10);
   await apply(db,[upsert('church_accounts',{id:'deposit-bank',name:'Bank',account_type:'bank',currency:'GHS',is_active:true,current_balance:0})]);
   await apply(db,[upsert('giving',{id:'available-giving',category:'Tithe',amount:10,currency:'GHS',date,payment_method:'bank_transfer'})]);
   const receipt=(await db.query("SELECT id,updated_at FROM public.giving WHERE id='available-giving'")).rows[0];
   args=[operation(),JSON.stringify([receipt]),'deposit-bank',date,'bank_transfer','',null,null];
   const post=a=>db.query('SELECT public.gwcc_post_giving_deposit($1,$2,$3,$4,$5,$6,$7,$8) result',a);
   await assert.rejects(post([operation(),JSON.stringify([receipt,receipt]),...args.slice(2)]),/distinct confirmed/);
   await assert.rejects(post([operation(),JSON.stringify([receipt,{id:'missing',updated_at:receipt.updated_at}]),...args.slice(2)]),/changed or is unavailable/);
   await assert.rejects(post([operation(),JSON.stringify([{...receipt,updated_at:'2020-01-01T00:00:00Z'}]),...args.slice(2)]),/changed or is unavailable/);
   await assert.rejects(post([operation(),args[1],'missing',...args.slice(3)]),/active GHS/);
   await apply(db,[upsert('church_finances',{id:'small-income',account_id:'deposit-bank',account_name:'Bank',transaction_type:'income',amount:5,currency:'GHS',date,payment_method:'bank_transfer',category:'Income',title:'Small',status:'completed'})]);
   const stamp=(await db.query("SELECT updated_at FROM public.church_finances WHERE id='small-income'")).rows[0].updated_at;
   await assert.rejects(post([operation(),args[1],args[2],args[3],args[4],'','small-income',stamp]),/exceeds the unallocated/);
   assert.equal((await db.query("SELECT count(*)::int n FROM public.gwcc_documents WHERE namespace='giving_deposit_links'")).rows[0].n,0);
   assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='deposit-bank'")).rows[0].current_balance,'5.00');
  });
  for(const id of [member,other])await asUser(db,id,async()=>{
   await assert.rejects(db.query('SELECT public.gwcc_giving_deposit_links()'),/finance authorization/);
   await assert.rejects(db.query('SELECT public.gwcc_post_giving_deposit($1,$2,$3,$4,$5,$6,$7,$8)',args),/finance authorization/);
  });
  await asUser(db,root,async()=>{await assert.rejects(db.query('SELECT public.gwcc_giving_deposit_links()'),/finance authorization/);},{aal:'aal1',session_id:root});
  assert.equal((await db.query("SELECT has_function_privilege('anon','public.gwcc_giving_deposit_links()','EXECUTE') allowed")).rows[0].allowed,false);
  await db.exec("INSERT INTO public.gwcc_documents(namespace,id,data) VALUES('unrelated-fixture','cleanup','{}');DELETE FROM public.gwcc_documents WHERE namespace='unrelated-fixture';");
  assert.equal((await db.query("SELECT count(*)::int n FROM public.gwcc_documents WHERE namespace='unrelated-fixture'")).rows[0].n,0);
 }finally{await db.close();}
});

test('optional department caps block over-budget payment atomically, allow requests, and free capacity after a documented reversal',async()=>{
 const date=new Date().toISOString().slice(0,10),year=date.slice(0,4);
 const db=await setupDatabase({beforeApprovalControls:async db=>{
  await db.exec(`INSERT INTO public.church_accounts(id,name,account_type,current_balance,opening_balance,currency,is_active) VALUES('budget-bank','Budget bank','bank',1000,1000,'GHS',true);
   INSERT INTO public.church_finances(id,transaction_type,account_id,account_name,category,title,amount,currency,date,payment_method,department,status) VALUES('historic-budget-spend','expense','budget-bank','Budget bank','Utilities','Historical payment',75,'GHS','${date}','bank_transfer','Facilities','completed');`);
 }});
 try{
  await db.query("UPDATE public.profiles SET role='finance_officer',authorization_reviewed_at=now() WHERE id=$1",[other]);
  let request;
  await asUser(db,root,async()=>{
   await apply(db,[upsert('department_budgets',{id:'strict-budget',department:'Facilities',period:year+' Annual',currency:'GHS',allocated_amount:100,spent_amount:0,enforce_limit:true})]);
   request=(await apply(db,[upsert('church_finances',{id:'capped-payment',transaction_type:'expense',account_id:'budget-bank',account_name:'Budget bank',category:'Utilities',title:'Capped request',amount:30,currency:'GHS',date,payment_method:'bank_transfer',department:'Facilities',status:'completed'})])).rows[0].result[0].record;
   assert.equal(request.approval_state,'requested');
  });
  await asUser(db,other,async()=>{request=(await db.query("SELECT public.gwcc_finance_approval_action($1,$2,$3,'approve','','') result",[operation(),request.id,request.updated_at])).rows[0].result;});
  await asUser(db,root,async()=>{
   await assert.rejects(db.query("SELECT public.gwcc_finance_approval_action($1,$2,$3,'paid','','TEST-PAID')",[operation(),request.id,request.updated_at]),/Budget limit exceeded/);
   assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='budget-bank'")).rows[0].current_balance,'925.00');
   assert.equal((await db.query("SELECT approval_state FROM public.church_finances WHERE id='capped-payment'")).rows[0].approval_state,'approved');
   const stamp=(await db.query("SELECT updated_at FROM public.church_finances WHERE id='historic-budget-spend'")).rows[0].updated_at;
   await apply(db,[upsert('church_finances',{id:'historic-budget-spend',status:'voided',void_reason:'Reverse the test entry'},stamp)]);
   const paid=(await db.query("SELECT public.gwcc_finance_approval_action($1,$2,$3,'paid','','TEST-PAID') result",[operation(),request.id,request.updated_at])).rows[0].result;
   assert.equal(paid.approval_state,'paid');assert.equal((await db.query("SELECT current_balance FROM public.church_accounts WHERE id='budget-bank'")).rows[0].current_balance,'970.00');
   const budget=(await db.query("SELECT updated_at FROM public.gwcc_documents WHERE namespace='department_budgets' AND id='strict-budget'")).rows[0];
   await assert.rejects(apply(db,[upsert('department_budgets',{id:'strict-budget',allocated_amount:20},budget.updated_at)]),/below already posted spending/);
  });
 }finally{await db.close();}
});

test('welfare appeals default to GHc10, accept exact levy receipts, reject GHc9.99 and preserve higher saved levies',async()=>{
 const db=await setupDatabase();let higher;try{await asUser(db,root,async()=>{
  const event={id:'levy-ten',title:'Synthetic levy appeal',category:'other',member_id:'levy-beneficiary',member_name:'Synthetic Beneficiary',description:'Synthetic welfare appeal',start_date:'2026-10-31',end_date:'2026-11-30',status:'open',created_by:'Synthetic Officer'};
  const saved=(await apply(db,[upsert('welfare_events',event)])).rows[0].result[0].record;
  assert.equal(Number(saved.minimum_contribution),10);
  await assert.rejects(apply(db,[upsert('welfare_events',{...event,id:'levy-too-low',minimum_contribution:9.99})]),/minimum_contribution_check/);
  const receipt={event_id:event.id,member_id:'levy-donor',contributor_name:'Synthetic Donor',payment_date:'2026-10-31',payment_method:'cash',payment_status:'confirmed',recorded_by:'Synthetic Officer',finance_linked:false};
  await assert.rejects(apply(db,[upsert('welfare_event_contributions',{...receipt,id:'levy-999',amount:9.99})]),/appeal minimum/);
  for(const amount of [10,12.5]){
   const row=(await apply(db,[upsert('welfare_event_contributions',{...receipt,id:'levy-'+amount,amount})])).rows[0].result[0].record;
   assert.equal(Number(row.amount),amount);
  }
  higher=(await apply(db,[upsert('welfare_events',{...event,id:'levy-higher',minimum_contribution:25})])).rows[0].result[0].record;
  await assert.rejects(apply(db,[upsert('welfare_event_contributions',{...receipt,id:'higher-too-low',event_id:higher.id,amount:10})]),/appeal minimum/);
 });
  const migration=fs.readFileSync('supabase/migrations/20261031090746_welfare_appeal_minimum_10.sql','utf8');
  const before=(await db.query("SELECT id,minimum_contribution FROM public.welfare_events WHERE id IN ('levy-ten','levy-higher') ORDER BY id")).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query("SELECT id,minimum_contribution FROM public.welfare_events WHERE id IN ('levy-ten','levy-higher') ORDER BY id")).rows,before);
 await asUser(db,root,async()=>{
  const lowered=(await apply(db,[upsert('welfare_events',{id:higher.id,minimum_contribution:10},higher.updated_at)])).rows[0].result[0].record;
  assert.equal(Number(lowered.minimum_contribution),10);
 });}finally{await db.close();}
});
