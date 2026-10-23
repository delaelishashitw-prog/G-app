import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAuthLink,authSessionId} from '../src/lib/authLinks.ts';
import {verifyPasswordLink,savePasswordFromLink,matchesPasswordSession} from '../src/lib/passwordSetup.ts';

const token=(sub,session_id,aal='aal1')=>`e30.${Buffer.from(JSON.stringify({sub,session_id,aal,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic`;
const user={id:'account-a',email:'a@example.test',email_confirmed_at:'2026-10-23T00:00:00Z'};
const session={user,access_token:token(user.id,'email-link-session'),refresh_token:'synthetic-refresh'};
const link={kind:'password',purpose:'invite',accessToken:session.access_token,refreshToken:session.refresh_token};
const config={url:'https://test.supabase.co',anonKey:'synthetic-public-key'};
const client=(current=session,verified=user)=>({auth:{getSession:async()=>({data:{session:current},error:null}),getUser:async accessToken=>{assert.equal(accessToken,link.accessToken);return {data:{user:verified},error:null};}}});

test('email callbacks distinguish invitations and recovery from errors, ordinary sign-in and forged recovery flags',()=>{
  for(const purpose of ['invite','recovery']){
    const hash=new URLSearchParams({type:purpose,access_token:link.accessToken,refresh_token:link.refreshToken,token_type:'bearer'});
    assert.deepEqual(parseAuthLink(`https://app.test/#${hash}`),{...link,purpose});
  }
  for(const url of ['https://app.test/#error=access_denied&error_code=otp_expired','https://app.test/login?error_code=otp_expired','https://app.test/auth/password?link_error=expired'])assert.deepEqual(parseAuthLink(url),{kind:'error',reason:'expired'});
  assert.deepEqual(parseAuthLink('https://app.test/#type=invite&access_token=partial'),{kind:'error',reason:'invalid'});
  assert.deepEqual(parseAuthLink('https://app.test/login?recovery=1'),{kind:'none'});
  assert.deepEqual(parseAuthLink('https://app.test/auth/password'),{kind:'none'});
  assert.equal(parseAuthLink(`https://app.test/#type=invite&access_token=${link.accessToken}&refresh_token=x&token_type=bearer&error=access_denied`).kind,'error');
  assert.equal(authSessionId('malformed'),null);
});

test('password setup requires a verified link and the exact account/session instead of an existing sign-in',async()=>{
  for(const bad of [{kind:'none'},{kind:'error',reason:'expired'}])await assert.rejects(verifyPasswordLink(client(),bad),/invalid, expired, or already used/);
  await assert.rejects(verifyPasswordLink(client(session,{...user,email_confirmed_at:null}),link),/invalid, expired/);
  await assert.rejects(verifyPasswordLink(client({...session,user:{...user,id:'account-b'}}),link),/signed-in account changed/);
  await assert.rejects(verifyPasswordLink(client({...session,access_token:token(user.id,'different-session')}),link),/signed-in account changed/);
  const proof=await verifyPasswordLink(client(),link);assert.equal(proof.email,user.email);assert.equal(proof.userId,user.id);
  assert.equal(matchesPasswordSession(proof,null),false);
});

test('a verified email-link session remains valid through refresh and MFA without accepting another session for the same account',async()=>{
  const proof=await verifyPasswordLink(client(),link);
  const elevated={...session,access_token:token(user.id,'email-link-session','aal2')};
  assert.equal(matchesPasswordSession(proof,elevated),true);
  assert.equal(matchesPasswordSession(proof,{...elevated,access_token:token(user.id,'different-session','aal2')}),false);
  let options,supplied,writes=0;
  const isolated=(_url,_key,settings)=>{options=settings;return {auth:{
    setSession:async tokens=>{supplied=tokens;return {data:{user,session:elevated}};},
    updateUser:async()=>{writes++;return {error:null};},
  }};};
  await savePasswordFromLink(client(elevated),proof,config,'synthetic-long-password',isolated);
  assert.equal(writes,1);assert.equal(supplied.access_token,elevated.access_token);
  assert.equal(options.auth.persistSession,false);assert.equal(options.auth.autoRefreshToken,false);assert.equal(options.auth.detectSessionInUrl,false);
});

test('switching accounts while password setup is in flight aborts before the password write',async()=>{
  const proof=await verifyPasswordLink(client(),link);
  let active=session,writes=0;
  const main={auth:{getSession:async()=>({data:{session:active}})}};
  const isolated=()=>({auth:{setSession:async()=>{
    active={...session,user:{...user,id:'account-b'}};
    return {data:{user,session}};
  },updateUser:async()=>{writes++;return {error:null};}}});
  await assert.rejects(savePasswordFromLink(main,proof,config,'synthetic-long-password',isolated),/signed-in account changed/);
  assert.equal(writes,0);
});

test('a final account switch cannot redirect an isolated password write to the newly signed-in account',async()=>{
  const proof=await verifyPasswordLink(client(),link);
  let active=session,reads=0,bound,written;
  const main={auth:{getSession:async()=>{const result=active;if(++reads===2)active={...session,user:{...user,id:'account-b'}};return {data:{session:result}};}}};
  const isolated=()=>({auth:{setSession:async tokens=>{bound=tokens.access_token;return {data:{user,session}};},updateUser:async()=>{assert.equal(active.user.id,'account-b');written=bound;return {error:null};}}});
  await savePasswordFromLink(main,proof,config,'synthetic-long-password',isolated);
  assert.equal(written,link.accessToken);
});
