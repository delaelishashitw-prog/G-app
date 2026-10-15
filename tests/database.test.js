import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const root='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';

export async function setupDatabase() {
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
      await apply(db,[upsert('roster_assignments',{id:'own-duty',member_id:'own',member_name:'Own Member',service_name:'Sunday',role_title:'Usher'}),upsert('roster_assignments',{id:'other-duty',member_id:'other',member_name:'Other Member',service_name:'Sunday',role_title:'Choir'})]);
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
