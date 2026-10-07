import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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

    res.status(200).json({
      text: response.text || 'No response generated.',
    });
  } catch (error) {
    console.warn('AI generation encountered error, returning pastoral fallback:', error?.message || error);
    res.status(200).json({
      text: `**Greater Works City Church Assistant Notice**\n\nThe AI service is currently experiencing high demand or a temporary network interruption. Please try again in a few moments.\n\n**Scripture for the Hour**:\n> *"And God is able to make all grace abound toward you; that ye, always having all sufficiency in all things, may abound to every good work."* — 2 Corinthians 9:8\n\n*GWCC Ministerial Team • Joma New Site, Accra, Ghana*`
    });
  }
}
