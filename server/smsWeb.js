import {smsHandler} from './sms.js';
import {HttpError} from './security.js';
export async function smsWebHandler(request,dependencies={}){
  const appOrigin=dependencies.appOrigin,origin=request.headers.get('origin');
  const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(origin&&origin!==appOrigin)return Response.json({error:'This origin is not allowed.'},{status:403,headers});
  if(origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');}
  if(request.method==='OPTIONS'){
    headers.set('Access-Control-Allow-Methods','POST');headers.set('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info');
    return new Response(null,{status:204,headers});
  }
  let status=200,payload;
  const res={setHeader:(name,value)=>headers.set(name,value),status(code){status=code;return this;},json(value){payload=value;}};
  try{
    let body;
    if(request.method==='POST'&&request.body){
      const reader=request.body.getReader(),chunks=[];let length=0;
      try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>20000){await reader.cancel();throw new HttpError(413,'The request is too large.');}chunks.push(value);}}finally{reader.releaseLock();}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'A JSON object is required.');}
      if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'A JSON object is required.');
    }
    await smsHandler({method:request.method,headers:Object.fromEntries(request.headers),body},res,{...dependencies,edgeRuntime:true});
  }catch(error){status=error instanceof HttpError?error.status:500;payload={error:status<500?error.message:'SMS service is temporarily unavailable.'};}
  return new Response(JSON.stringify(payload),{status,headers});
}
