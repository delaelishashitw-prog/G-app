import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProductionMode = () => process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const isLocalDevelopment = !isProductionMode();
const apiRequestCounts = new Map<string, { count: number; resetAt: number }>();

// ==========================================
// REAL-TIME DUTY ROSTER NOTIFICATION ENGINE
// ==========================================

export interface ServerRosterNotification {
  id: string;
  type: 'ROSTER_ASSIGNED' | 'ROSTER_UPDATED' | 'ROSTER_SUBSTITUTED' | 'ROSTER_CONFIRMED';
  memberId: string;
  memberName: string;
  dutyId: string;
  serviceName: string;
  date: string;
  department: string;
  roleTitle: string;
  reportTime: string;
  notes?: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// In-memory persistent buffer for recent roster alerts
const rosterNotifications: ServerRosterNotification[] = [];

interface ConnectedClient {
  ws: WebSocket;
  memberId?: string;
  memberName?: string;
  subscribedAt: number;
}

const connectedClients = new Set<ConnectedClient>();

// Initialize WebSocket server attached to HTTP server on /ws path
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastRosterNotification(notification: ServerRosterNotification): number {
  const payload = JSON.stringify({
    type: 'ROSTER_NOTIFICATION',
    notification,
  });

  let sentCount = 0;
  for (const client of connectedClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const isTarget =
        !notification.memberId ||
        !client.memberId ||
        client.memberId === notification.memberId ||
        client.memberId.toLowerCase() === notification.memberId.toLowerCase() ||
        client.memberId.includes(notification.memberId) ||
        notification.memberId.includes(client.memberId);

      if (isTarget) {
        try {
          client.ws.send(payload);
          sentCount++;
        } catch (err) {
          console.warn('Failed to send WebSocket notification to client:', err);
        }
      }
    }
  }
  return sentCount;
}

wss.on('connection', (ws: WebSocket) => {
  const client: ConnectedClient = {
    ws,
    subscribedAt: Date.now(),
  };
  connectedClients.add(client);

  ws.on('message', (rawMessage: string) => {
    try {
      const data = JSON.parse(rawMessage.toString());
      if (data.type === 'subscribe') {
        client.memberId = (data.memberId || '').trim();
        client.memberName = (data.memberName || '').trim();

        // Send confirmation back along with relevant recent notifications
        const memberNotifs = rosterNotifications.filter(
          (n) =>
            !client.memberId ||
            n.memberId === client.memberId ||
            client.memberId.includes(n.memberId) ||
            n.memberId.includes(client.memberId)
        );

        ws.send(
          JSON.stringify({
            type: 'SUBSCRIBED',
            memberId: client.memberId,
            unreadCount: memberNotifs.filter((n) => !n.read).length,
            notifications: memberNotifs.slice(-20),
            timestamp: new Date().toISOString(),
          })
        );
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      } else if (data.type === 'mark_read') {
        if (data.notificationId) {
          const found = rosterNotifications.find((n) => n.id === data.notificationId);
          if (found) found.read = true;
        } else if (data.all && client.memberId) {
          rosterNotifications.forEach((n) => {
            if (n.memberId === client.memberId) n.read = true;
          });
        }
      }
    } catch {
      // Ignore malformed message
    }
  });

  ws.on('close', () => {
    connectedClients.delete(client);
  });

  ws.on('error', () => {
    connectedClients.delete(client);
  });

  // Initial welcome event
  try {
    ws.send(
      JSON.stringify({
        type: 'CONNECTED',
        message: 'Connected to Greater Works City Church Real-time Notification Engine',
        timestamp: new Date().toISOString(),
      })
    );
  } catch {}
});

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
    server.listen(targetPort, '0.0.0.0', () => {
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

// ==========================================
// ROSTER REAL-TIME NOTIFICATION API ENDPOINTS
// ==========================================

// Get active notifications (optional ?memberId=...)
app.get('/api/roster/notifications', (req: Request, res: Response) => {
  const memberId = typeof req.query.memberId === 'string' ? req.query.memberId.trim() : '';

  if (!memberId) {
    res.json({ notifications: rosterNotifications.slice(-50), total: rosterNotifications.length });
    return;
  }

  const matching = rosterNotifications.filter(
    (n) =>
      !n.memberId ||
      n.memberId === memberId ||
      memberId.includes(n.memberId) ||
      n.memberId.includes(memberId)
  );

  res.json({
    notifications: matching.slice(-50),
    unreadCount: matching.filter((n) => !n.read).length,
    total: matching.length,
    activeConnections: connectedClients.size,
  });
});

// Trigger a new roster notification (from CMS or duty scheduler)
app.post('/api/roster/notify', (req: Request, res: Response) => {
  const {
    type = 'ROSTER_ASSIGNED',
    memberId,
    memberName,
    dutyId,
    serviceName,
    date,
    department,
    roleTitle,
    reportTime,
    notes,
    message,
  } = req.body || {};

  if (!memberId || !serviceName || !roleTitle) {
    res.status(400).json({ error: 'memberId, serviceName, and roleTitle are required' });
    return;
  }

  const actionText =
    type === 'ROSTER_UPDATED'
      ? 'updated for'
      : type === 'ROSTER_SUBSTITUTED'
      ? 'substitute requested for'
      : type === 'ROSTER_CONFIRMED'
      ? 'attendance confirmed for'
      : 'assigned to';

  const notification: ServerRosterNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: type as ServerRosterNotification['type'],
    memberId: String(memberId).trim(),
    memberName: memberName ? String(memberName).trim() : 'Ministerial Steward',
    dutyId: dutyId ? String(dutyId) : `duty-${Date.now()}`,
    serviceName: String(serviceName).trim(),
    date: date ? String(date).trim() : new Date().toISOString().split('T')[0],
    department: department ? String(department).trim() : 'Sanctuary Protocol',
    roleTitle: String(roleTitle).trim(),
    reportTime: reportTime ? String(reportTime).trim() : '08:00 AM',
    notes: notes ? String(notes).trim() : undefined,
    message:
      message ||
      `Service Duty ${actionText} ${serviceName}: ${roleTitle} on ${date || 'upcoming service'} (Report at ${reportTime || 'scheduled time'}).`,
    timestamp: new Date().toISOString(),
    read: false,
  };

  rosterNotifications.push(notification);
  if (rosterNotifications.length > 200) {
    rosterNotifications.shift();
  }

  const broadcastedCount = broadcastRosterNotification(notification);

  res.json({
    success: true,
    notification,
    broadcastedTo: broadcastedCount,
    totalActiveClients: connectedClients.size,
  });
});

// Mark notification(s) as read
app.post('/api/roster/notifications/mark-read', (req: Request, res: Response) => {
  const { id, memberId, all } = req.body || {};

  if (all && memberId) {
    rosterNotifications.forEach((n) => {
      if (
        n.memberId === memberId ||
        memberId.includes(n.memberId) ||
        n.memberId.includes(memberId)
      ) {
        n.read = true;
      }
    });
    res.json({ success: true, message: 'All notifications marked as read' });
    return;
  }

  if (id) {
    const found = rosterNotifications.find((n) => n.id === id);
    if (found) {
      found.read = true;
      res.json({ success: true, notification: found });
      return;
    }
  }

  res.json({ success: true, message: 'Updated' });
});

// Simulator / Test Trigger for Member Portal verification
app.post('/api/roster/simulate', (req: Request, res: Response) => {
  const { memberId = 'GWCC-0001', memberName = 'Alfred Torgbo', roleTitle, serviceName } = req.body || {};

  const sampleRoles = [
    'Head Usher - Sanctuary Main Entrance',
    'Voice of Dominion - Lead Vocalist',
    'Sound & Livestream Console Mixer',
    'Altar Intercession & Pre-Service Prayer Leader',
    'Protocol & VIP Reception Steward',
  ];

  const randomRole = roleTitle || sampleRoles[Math.floor(Math.random() * sampleRoles.length)];
  const nextSunday = new Date();
  nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7));
  const dateStr = nextSunday.toISOString().split('T')[0];

  const simulatedNotif: ServerRosterNotification = {
    id: `notif-sim-${Date.now()}`,
    type: 'ROSTER_ASSIGNED',
    memberId: String(memberId).trim(),
    memberName: String(memberName).trim(),
    dutyId: `duty-sim-${Date.now()}`,
    serviceName: serviceName || 'Sunday Prophetic Celebration Service',
    date: dateStr,
    department: 'ushers_protocol',
    roleTitle: randomRole,
    reportTime: '07:30 AM',
    notes: 'Please arrive 30 minutes prior for pre-service ministerial prayers in the auditorium.',
    message: `New duty assigned: ${randomRole} for ${serviceName || 'Sunday Prophetic Celebration Service'} on ${dateStr} (Call time: 07:30 AM).`,
    timestamp: new Date().toISOString(),
    read: false,
  };

  rosterNotifications.push(simulatedNotif);
  const broadcastCount = broadcastRosterNotification(simulatedNotif);

  res.json({
    success: true,
    simulated: true,
    notification: simulatedNotif,
    broadcastedTo: broadcastCount,
  });
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
