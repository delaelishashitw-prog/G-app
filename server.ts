import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { aiHandler } from './server/ai.js';
import { staffHandler } from './server/staff.js';
import { smsHandler } from './server/sms.js';

dotenv.config();
const app = express();
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');next();});
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.all('/api/ai/assistant', aiHandler);
app.all('/api/staff', staffHandler);
app.all('/api/sms', smsHandler);
app.use('/api', (_req,res) => res.status(404).json({ error:'Endpoint not found' }));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('dist')));
  app.get('*', (_req,res) => res.sendFile(path.resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const status=error.status===413?413:400;res.status(status).json({error:status===413?'The request is too large.':'Invalid request body.'});});
const port=Number(process.env.PORT || 3000);
app.listen(port,'0.0.0.0', () => console.info(`GWCC listening on port ${port}`));
