import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProductionMode = () => process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const isLocalDevelopment = !isProductionMode();
const apiRequestCounts = new Map<string, { count: number; resetAt: number }>();

function getAllowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    ...configured,
  ]));
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const allowedOrigins = getAllowedOrigins();

  if (isLocalDevelopment) {
    return true;
  }

  return allowedOrigins.some((allowed) => {
    if (allowed.includes('*')) {
      const pattern = new RegExp(`^${allowed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`);
      return pattern.test(origin);
    }
    return origin === allowed;
  });
}

function enforceApiGuard(req: Request, res: Response, next: () => void): void {
  if (!req.path.startsWith('/api')) {
    next();
    return;
  }

  const origin = req.get('origin');
  if (origin && !isOriginAllowed(origin)) {
    res.status(403).json({ error: 'Origin not allowed for this API.' });
    return;
  }

  const gatewayKey = process.env.API_GATEWAY_KEY;
  if (gatewayKey) {
    const incomingKey = req.header('x-api-key');
    if (!incomingKey || incomingKey !== gatewayKey) {
      res.status(401).json({ error: 'Valid API key required.' });
      return;
    }
  }

  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown-client';
  const now = Date.now();
  const record = apiRequestCounts.get(String(clientIp)) || { count: 0, resetAt: now + 60000 };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 60000;
  }

  if (record.count >= 60) {
    res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    return;
  }

  record.count += 1;
  apiRequestCounts.set(String(clientIp), record);
  next();
}

app.disable('x-powered-by');
app.use(enforceApiGuard);

function startListening(targetPort: number, retries = 5): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = app.listen(targetPort, '0.0.0.0', () => {
      resolve(targetPort);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && retries > 0) {
        console.warn(`Port ${targetPort} is busy; waiting to retry on ${targetPort} (${retries} attempts left)...`);
        setTimeout(() => {
          resolve(startListening(targetPort, retries - 1));
        }, 1000);
        return;
      }
      reject(error);
    });
  });
}

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// AI Assistant endpoint
app.post('/api/ai/assistant', async (req: Request, res: Response) => {
  try {
    const { prompt, churchContext } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    if (prompt.length > 10000) {
      res.status(400).json({ error: 'Prompt exceeds maximum allowed length (10,000 characters)' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      res.json({
        text: `**Greater Works City Church Assistant Notice**\n\nThe AI Assistant is configured for **gemini-3.8-flash**, but the \`GEMINI_API_KEY\` environment variable is not currently set in this environment.\n\nHere is a pastoral guidance template for your request:\n\n> *"${prompt}"*\n\n**Biblical Focus & Inspiration**:\n- *Scripture*: Ephesians 3:20 — "Now unto him that is able to do exceeding abundantly above all that we ask or think, according to the power that worketh in us."\n- *Guidance*: For Greater Works City Church (Joma, Accra), continue holding fast to faith, prayer, and congregational love. When an API key is connected, full real-time generative responses will be delivered here automatically.`
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
        timeout: 15000,
      },
    });

    const systemInstruction = `You are the AI Ministerial & Pastoral Assistant for Greater Works City Church (GWCC), a vibrant Pentecostal/Charismatic church located in Joma, Greater Accra, Ghana.
Senior Pastor & General Overseer: Prophet Elisha K. Richard.
General Secretary: Tamekloe Clara Gaewornu.
The church motto is: "Exceeding Abundantly Above All We Ask or Think" (Ephesians 3:20).
Auditorium: Joma New Site, Off Ablekuma-Joma Highway (GPS: GA-183-4921).

Your mission is to support church leadership, pastors, department heads, and church administrators with:
1. **Sermon Preparation & Bible Study**: Generate biblical outlines, hermeneutical insights, Scripture references, sermon illustrations relevant to contemporary Ghanaian and Christian life, and prayer points.
2. **Pastoral Care & Counseling Guidance**: Provide compassionate, biblically grounded pastoral advice, visitation messages, bereavement support, and prayer outlines.
3. **Church Operations & Event Communication**: Draft engaging service announcements, SMS broadcasts (concise for Ghana SMS), WhatsApp devotionals, order of service flow, and administrative letters.
4. **Discipleship & Community Growth**: Offer strategies for home cell fellowships across Joma, Ablekuma, Weija, and Anyaa sectors, youth engagement, and visitor assimilation.

Contextual Church Information:
${churchContext ? JSON.stringify(churchContext, null, 2) : 'Active Ghanaian assembly with Sunday Prophetic Celebration Service, Wednesday Midweek Miracle Service, Friday All-Night vigils, and Community Cells.'}

Tone: Faith-filled, biblically sound, encouraging, respectful of Ghanaian Christian culture, and practical. Use warm pastoral terms when appropriate (e.g., 'Shalom', 'Beloved', 'Grace and peace'). Format answers with clear headings and bullet points where helpful.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const text = response.text || 'No response generated.';
    res.json({ text });
  } catch (error: any) {
    console.warn('AI generation encountered error, returning pastoral fallback:', error?.message || error);
    res.status(200).json({
      text: `**Greater Works City Church Assistant Notice**\n\nThe AI service is currently experiencing high demand or a temporary network interruption. Please try again in a few moments.\n\n**Scripture for the Hour**:\n> *"And God is able to make all grace abound toward you; that ye, always having all sufficiency in all things, may abound to every good work."* — 2 Corinthians 9:8\n\n*GWCC Ministerial Team • Joma New Site, Accra, Ghana*`
    });
  }
});

// 404 handler for unhandled API routes
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API route not found' });
});

// Setup Vite or static serving
async function startServer() {
  if (isProductionMode()) {
    const distPath = path.resolve('dist');
    const indexPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      throw new Error('Production build not found. Run "npm run build" before starting the app in production mode.');
    }

    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(indexPath);
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  try {
    const port = await startListening(PORT);
    console.log(`GWCC Server listening on port ${port} (${isProductionMode() ? 'production' : 'development'})`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
