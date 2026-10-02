import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { prompt, churchContext } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      res.status(200).json({
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
1. Sermon Preparation & Bible Study
2. Pastoral Care & Counseling Guidance
3. Church Operations & Event Communication
4. Discipleship & Community Growth

Contextual Church Information:
${churchContext ? JSON.stringify(churchContext, null, 2) : 'Active Ghanaian assembly with Sunday Prophetic Celebration Service, Wednesday Midweek Miracle Service, Friday All-Night vigils, and Community Cells.'}

Tone: Faith-filled, biblically sound, encouraging, respectful of Ghanaian Christian culture, and practical.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.status(200).json({
      text: response.text || 'No response generated.',
    });
  } catch (error) {
    console.error('AI assistant error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to process AI assistant request.',
    });
  }
}
