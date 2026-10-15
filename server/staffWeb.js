import { staffHandler } from './staff.js';
import { HttpError } from './security.js';

// Web Request adapter for the same staff handler used by Express and Vercel.
// Keep the body bounded even when Content-Length is absent or untrusted.
export async function staffWebHandler(request, dependencies = {}) {
  const headers = new Headers({ 'Content-Type':'application/json','Cache-Control':'no-store' });
  let status = 200, payload;
  const res = {
    setHeader(name,value) { headers.set(name,value); },
    status(code) { status=code;return this; },
    json(value) { payload=value; },
  };
  let body;
  try {
    if (request.method === 'POST' && request.body) {
      const reader=request.body.getReader(),chunks=[];let length=0;
      try {
        for (;;) {
          const {done,value}=await reader.read();if(done)break;
          length+=value.byteLength;
          if(length>20000){await reader.cancel();throw new HttpError(413,'The request is too large.');}
          chunks.push(value);
        }
      } finally {reader.releaseLock();}
      const bytes=new Uint8Array(length);let offset=0;
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      try {body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'A JSON object is required.');}
      if(!body || typeof body!=='object' || Array.isArray(body))throw new HttpError(400,'A JSON object is required.');
    }
    await staffHandler({method:request.method,headers:Object.fromEntries(request.headers),body},res,{...dependencies,disableEdgeFallback:true});
  } catch(error) {
    status=error instanceof HttpError?error.status:500;
    payload={error:status<500?error.message:'The operation could not be completed. Please try again.'};
  }
  return new Response(JSON.stringify(payload),{status,headers});
}
