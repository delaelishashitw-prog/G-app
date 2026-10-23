import { GoogleGenAI } from '@google/genai';
import { HttpError } from './security.js';

// Keep the existing provider and server-controlled model configuration.
// Never construct tools, database access, or delivery actions from model output.
export async function generateAiDraft({ contents, systemInstruction, maxOutputTokens = 4096 }, dependencies = {}) {
  if (!process.env.GEMINI_API_KEY) throw new HttpError(503, 'The AI service is not connected. Ask an administrator to configure it.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const ai = dependencies.ai || new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 20000 } });
  const response = await ai.models.generateContent({
    model, contents, config: { systemInstruction, maxOutputTokens },
  });
  const text = response.text;
  if (typeof text !== 'string' || !text.trim()) throw new HttpError(502, 'The AI provider did not return a draft.');
  if (text.length > 30000) throw new HttpError(502, 'The AI provider returned an oversized draft.');
  return { text, model, status: 'draft' };
}
