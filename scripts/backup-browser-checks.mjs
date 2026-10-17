import assert from 'node:assert/strict';
import {BACKUP_TABLES, decryptRecoveryBundle, encryptRecoveryBundle, recoveryDigest, bytesToBase64} from '../src/lib/recoveryBackup.ts';
import {watchSyncStatus,readSavedOutbox} from './sync-browser-utils.mjs';

export async function checkBackup(browser,{origin,settings}) {
  const owner='15151515-1515-4515-8515-151515151515',source='16161616-1616-4616-8616-161616161616';
  const password='Synthetic backup passphrase 2026',fileBytes=new Uint8Array([0,1,2,3,4,255]);
  for(const width of [390,1440]){
    const user={id:owner,email:'backup@example.test',email_confirmed_at:'2026-10-15T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',role:'authenticated'};
    const profile={id:owner,email:user.email,first_name:'Backup',last_name:'QA',role:'super_admin',is_active:true,has_login_account:true,authorization_reviewed_at:'2026-10-15T00:00:00Z'};
    const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp})).toString('base64url')}.test-signature`;
    const session={user,access_token:token,refresh_token:'qa-backup-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
    const tables=Object.fromEntries(BACKUP_TABLES.map(name=>[name,[]]));
    tables['public.settings']=[{id:'gwcc_global_settings',...settings}];
    tables['public.members']=[{id:'backup-member',first_name:'Synthetic',last_name:'Person',phone:'0240000001',member_id:'BACKUP-1',profile_photo_url:'data:image/jpeg;base64,'+'A'.repeat(600000)}];
    tables['public.gwcc_documents']=[{namespace:'foundation_students',id:'foundation-one',data:{completed_modules:[1,2]}}];
    const snapshot={format:'gwcc-records-v1',source_id:source,created_at:new Date().toISOString(),tables,counts:Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,rows.length])),storage_objects:[{bucket:'gwcc-media',name:'members/backup.bin',metadata:null,updated_at:null}],exclusions:['Supabase Auth accounts and sessions']};
    const raw=JSON.stringify(snapshot),cloud={id:source,payload_text:raw,digest:await recoveryDigest(raw)};
    const point={id:source,kind:'daily',created_at:snapshot.created_at,digest:cloud.digest,counts:snapshot.counts,byte_count:Buffer.byteLength(raw),media_count:1,rehearsed_at:null};
    let calls=[],mutations=[],failStorage=false,mediaChanged=false;
    const errors=[],context=await browser.newContext({viewport:{width,height:1000}});
    await context.addInitScript(watchSyncStatus);
    await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));localStorage.setItem('gwcc_momo_name','Synthetic account label');},{session});
    await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
      const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
      if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      let result=[];
      if(url.pathname==='/auth/v1/user')result=user;
      else if(url.pathname==='/auth/v1/token')result=session;
      else if(url.pathname.includes('/storage/v1/object/')){
        await route.fulfill({status:failStorage?404:200,headers:{...headers,'content-type':'application/octet-stream'},body:failStorage?'Synthetic missing file':Buffer.from(fileBytes)});return;
      }else if(url.pathname.includes('/rest/v1/rpc/')){
        const name=url.pathname.split('/').at(-1);calls.push(name);
        assert.equal(request.headers().authorization,`Bearer ${token}`);
        if(name==='gwcc_backup_status')result={source_id:source,daily_enabled:true,daily_time_utc:'03:00',retention_daily:7,retention_manual:2,last_run:{status:'succeeded',ended_at:snapshot.created_at},points:[point],tables:BACKUP_TABLES};
        else if(name==='gwcc_backup_create')result=source;
        else if(name==='gwcc_backup_export')result=cloud;
        else if(name==='gwcc_backup_media_check'){
          if(mediaChanged){await route.fulfill({status:400,headers,body:JSON.stringify({message:'Storage files changed after this recovery point. Create a fresh point.'})});return;}result=true;
        }else if(name==='gwcc_backup_rehearse'){point.rehearsed_at=new Date().toISOString();result={tables_checked:BACKUP_TABLES.length,rehearsed_at:point.rehearsed_at};}
        else if(name==='gwcc_apply_mutations'){mutations.push(request.postDataJSON());throw new Error('Backup checks must never submit cloud mutations.');}
        else throw new Error('Unexpected backup RPC '+name);
      }else if(url.pathname.startsWith('/rest/v1/')){
        const table=url.pathname.split('/').at(-1),rows=table==='profiles'?[profile]:tables['public.'+table]||[];
        const offset=Number(url.searchParams.get('offset')||0);result=rows.slice(offset,offset+500);
        if(request.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
      }
      await route.fulfill({status:200,headers,body:JSON.stringify(result)});
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${origin}/settings`);await page.getByRole('button',{name:'Backup & Maintenance',exact:true}).click();
    const panel=page.getByRole('region',{name:'Church backup and recovery'});
    await panel.getByText('Scheduled at 03:00 GMT; latest 7 daily points retained.',{exact:false}).waitFor();
    await panel.getByRole('button',{name:'Create recovery point',exact:true}).click();
    await panel.getByText('Recovery point created from cloud-confirmed records.',{exact:false}).waitFor();
    await panel.getByRole('button',{name:'Rehearse selected point',exact:true}).click();
    await panel.getByText(`${BACKUP_TABLES.length} tables reconstructed successfully.`,{exact:false}).waitFor();
    await panel.getByLabel('Backup passphrase',{exact:true}).fill(password);await panel.getByLabel('Confirm backup passphrase',{exact:true}).fill('Mismatch');
    const before=calls.filter(name=>name==='gwcc_backup_export').length;
    await panel.getByRole('button',{name:'Download encrypted backup',exact:true}).click();
    await panel.getByRole('alert').getByText('The backup passphrases do not match.',{exact:true}).waitFor();
    assert.equal(calls.filter(name=>name==='gwcc_backup_export').length,before);
    await panel.getByLabel('Confirm backup passphrase',{exact:true}).fill(password);
    const event=page.waitForEvent('download');await panel.getByRole('button',{name:'Download encrypted backup',exact:true}).click();
    const download=await event,chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
    const encrypted=Buffer.concat(chunks).toString('utf8');assert.ok(!encrypted.includes('Synthetic'));assert.match(download.suggestedFilename(),/GWCC-recovery-.*\.gwcc\.json$/);
    const decoded=await decryptRecoveryBundle(encrypted,password,'gwcc-e2e',source);
    assert.equal(decoded.summary.tables,BACKUP_TABLES.length);assert.equal(decoded.summary.files,1);
    assert.equal(decoded.bundle.files[0].data,bytesToBase64(fileBytes));assert.equal(decoded.summary.snapshot.tables['public.members'][0].profile_photo_url.length,600023);
    assert.equal(decoded.bundle.device.preferences.gwcc_momo_name,'Synthetic account label');assert.ok(!('gwcc_supabase_anon_key' in decoded.bundle.device.preferences));
    await panel.getByLabel('Encrypted recovery file').setInputFiles({name:'saved.gwcc.json',mimeType:'application/json',buffer:Buffer.from(encrypted)});
    await panel.getByLabel('File passphrase',{exact:true}).fill('An incorrect passphrase');await panel.getByRole('button',{name:'Check recovery file',exact:true}).click();
    await panel.getByRole('alert').getByText('The passphrase is incorrect or the recovery file is damaged.',{exact:true}).waitFor();
    await panel.getByLabel('File passphrase',{exact:true}).fill(password);await panel.getByRole('button',{name:'Check recovery file',exact:true}).click();
    await panel.getByLabel('Verified recovery file').waitFor();assert.equal(mutations.length,0);
    const recovered=structuredClone(decoded.bundle);recovered.device.pending_text=JSON.stringify({owner,batches:[{id:'17171717-1717-4717-8717-171717171717',createdAt:new Date().toISOString(),attempts:0,changes:[{table:'members',id:'pending-recovery-member',operation:'upsert',record:{id:'pending-recovery-member',first_name:'Pending synthetic',profile_photo_url:'data:image/png;base64,AA=='}}]}],versions:{}});
    const pendingFile=await encryptRecoveryBundle(recovered,password);
    await panel.getByLabel('Encrypted recovery file').setInputFiles({name:'pending.gwcc.json',mimeType:'application/json',buffer:Buffer.from(pendingFile)});
    await panel.getByLabel('File passphrase',{exact:true}).fill(password);await panel.getByRole('button',{name:'Check recovery file',exact:true}).click();
    await panel.getByRole('button',{name:'Restore this device’s pending changes',exact:true}).click();
    await panel.getByText('1 pending change(s) restored for review.',{exact:false}).waitFor();
    const saved=await readSavedOutbox(page,owner);assert.equal(saved.batches.length,1);assert.equal(saved.batches[0].requiresReview,true);assert.equal(mutations.length,0);
    failStorage=true;await panel.getByLabel('Backup passphrase',{exact:true}).fill(password);await panel.getByLabel('Confirm backup passphrase',{exact:true}).fill(password);
    await panel.getByRole('button',{name:'Download encrypted backup',exact:true}).click();
    await panel.getByRole('alert').getByText('A storage file could not be preserved:',{exact:false}).waitFor();
    failStorage=false;mediaChanged=true;await panel.getByRole('button',{name:'Download encrypted backup',exact:true}).click();
    await panel.getByRole('alert').getByText('Storage files changed after this recovery point.',{exact:false}).waitFor();
    mediaChanged=false;
    await context.setOffline(true);await panel.getByRole('button',{name:'Create recovery point',exact:true}).click();
    await panel.getByRole('alert').getByText('Connect to the internet and sign in',{exact:false}).waitFor();await context.setOffline(false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`Backup page overflows ${width}px`);
    if(process.env.BACKUP_SCREENSHOT && width===390)await page.screenshot({path:process.env.BACKUP_SCREENSHOT,fullPage:true});
    assert.deepEqual(errors,[]);
    const prior=calls.length;profile.role='senior_pastor';await page.reload();await page.getByRole('button',{name:'Backup & Maintenance',exact:true}).click();
    await page.getByText('Church recovery files are managed by the reviewed super administrator.',{exact:true}).waitFor();assert.equal(calls.length,prior);
    await context.close();
  }
  console.log('Backup browser checks passed: mobile/desktop, encryption, file integrity, media failures, owner-scoped pending recovery and staff denial.');
}
