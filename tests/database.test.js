import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const root='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';

export async function setupDatabase({beforeSecurityUpgrade}={}) {
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
