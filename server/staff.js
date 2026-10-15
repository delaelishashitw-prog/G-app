import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { authorizeRequest, serverSupabaseConfig, HttpError, requirePost, sendError } from './security.js';

const roles = ['super_admin','senior_pastor','administrator','finance_officer','pastor','ministry_leader','attendance_officer','data_entry','member'];
const safeFields = ['first_name','last_name','phone','department','job_title','employment_type','avatar_url','role','is_active','has_login_account','member_id'];

export async function staffHandler(req, res, dependencies = {}) {
  if (!requirePost(req,res)) return;
  try {
    const config = serverSupabaseConfig();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const forward = !serviceKey && !dependencies.disableEdgeFallback;
    const { client, profile } = await (dependencies.authorizeRequest || authorizeRequest)(req,{ roles: ['super_admin'], bucket: forward ? null : 'staff' });
    if (new TextEncoder().encode(JSON.stringify(req.body || {})).length > 20000) throw new HttpError(413,'The request is too large.');
    if (forward) {
      // Supabase supplies the privileged credential inside its own runtime.
      // Forward only to this project's fixed endpoint, after checking the caller.
      const response = await (dependencies.fetch || fetch)(`${config.url}/functions/v1/gwcc-staff`,{
        method:'POST',headers:{ Authorization:req.headers.authorization,apikey:config.key,'Content-Type':'application/json' },
        body:JSON.stringify(req.body || {}),signal:AbortSignal.timeout(15000),redirect:'error',
      });
      let result;try {result=await response.json();} catch {throw new HttpError(503,'Staff account management is temporarily unavailable.');}
      if(response.status>=500)throw new HttpError(503,'Staff account management is temporarily unavailable.');
      res.status(response.status).json(result);return;
    }
    const { action, id, email, password, updates = {} } = req.body || {};
    // Role/status changes use the caller's checked RPC; invitation/password changes require server-only Auth privileges.
    const admin = serviceKey ? (dependencies.createClient || createClient)(config.url,serviceKey,{ auth:{ persistSession:false,autoRefreshToken:false } }) : null;
    if (action === 'update' || action === 'archive') {
      if (!id || typeof id !== 'string') throw new HttpError(400,'A staff account ID is required.');
      const patch = action === 'archive' ? { is_active:false,has_login_account:false } : Object.fromEntries(Object.entries(updates).filter(([key])=>safeFields.includes(key)));
      const { data, error } = await client.rpc('gwcc_manage_profile',{ p_id:id,p_updates:patch });
      if (error) throw new HttpError(400,error.message);
      res.status(200).json({ user:data,message:action === 'archive' ? 'Account access revoked.' : 'Staff record updated.' }); return;
    }
    if (!admin) throw new HttpError(503,'Staff invitations and password resets require the server authentication key.');
    if (action === 'reset_password') {
      if (typeof email !== 'string' || typeof password !== 'string' || password.length < 12) throw new HttpError(400,'Use a temporary password of at least 12 characters.');
      const { data: target,error: targetError } = await client.from('profiles').select('id,role').eq('email',email.trim().toLowerCase()).eq('has_login_account',true).single();
      if (targetError || !target) throw new HttpError(404,'Staff account not found.');
      const { error } = await admin.auth.admin.updateUserById(target.id,{ password });
      if (error) throw new HttpError(400,error.message);
      await admin.from('audit_logs').insert({ id:randomUUID(),actor_id:profile.id,user_name:profile.id,user_role:profile.role,action:'RESET_STAFF_PASSWORD',module:'Users & Roles',record_id:target.id,details:'Authentication password reset; credential not logged.' });
      res.status(200).json({ success:true }); return;
    }
    if (action !== 'create') throw new HttpError(400,'Unknown staff operation.');
    const input = req.body;
    if (!input.first_name?.trim() || !input.last_name?.trim() || !roles.includes(input.role)) throw new HttpError(400,'Enter a valid staff name and role.');
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    let newId = randomUUID();
    if (input.has_login_account !== false) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new HttpError(400,'A valid staff email is required.');
      const appOrigin = dependencies.appOrigin || process.env.APP_ORIGIN;
      const redirectTo = appOrigin ? `${appOrigin}/auth/password` : undefined;
      const { data,error } = await admin.auth.admin.inviteUserByEmail(cleanEmail,{ redirectTo,data:{ first_name:input.first_name.trim(),last_name:input.last_name.trim() } });
      if (error || !data.user) throw new HttpError(400,error?.message || 'The invitation could not be created.');
      newId=data.user.id;
    } else {
      const { error } = await admin.from('profiles').insert({ id:newId,email:cleanEmail || null,first_name:input.first_name.trim(),last_name:input.last_name.trim(),role:'member',is_active:true,has_login_account:false });
      if (error) throw new HttpError(400,error.message);
    }
    const patch=Object.fromEntries(safeFields.filter(key=>input[key]!==undefined).map(key=>[key,input[key]]));
    const { data: result,error: profileError } = await client.rpc('gwcc_manage_profile',{ p_id:newId,p_updates:patch });
    if (profileError) throw new HttpError(400,profileError.message);
    if (input.member_id && input.has_login_account !== false) {
      const { data:linked,error } = await admin.from('members').update({auth_user_id:newId}).eq('id',input.member_id).is('auth_user_id',null).select('id').single();
      if(error||!linked)throw new HttpError(409,'Account created, but the member link needs administrator review. The selected member may already have a login.');
    }
    res.status(201).json({ user:result,message: input.has_login_account === false ? 'Staff directory record created.' : 'Staff invitation sent. The recipient must verify the email and choose a password.' });
  } catch(error) { sendError(res,error); }
}
