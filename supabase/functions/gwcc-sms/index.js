import {smsWebHandler} from '../../../server/smsWeb.js';
Deno.serve(request=>smsWebHandler(request,{appOrigin:'https://g-app-pi.vercel.app'}));
