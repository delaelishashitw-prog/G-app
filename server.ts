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
    const { prompt, churchContext } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required' });
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
    console.error('Error generating AI response:', error);
    res.status(500).json({
      error: error?.message || 'Failed to process AI assistant request. Please try again.',
    });
  }
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
