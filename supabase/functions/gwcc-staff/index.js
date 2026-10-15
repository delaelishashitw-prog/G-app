import { staffWebHandler } from '../../../server/staffWeb.js';

// Public app configuration, never a credential. Keep aligned with APP_ORIGIN.
// Every call is verified with Auth getUser, the protected root profile and the
// persistent staff quota in the shared handler, before privileged Auth access.
Deno.serve(request => staffWebHandler(request,{ appOrigin:'https://g-app-pi.vercel.app' }));
