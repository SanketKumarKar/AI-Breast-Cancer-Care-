import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Gemini client ──
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Retry helper for rate limits ──
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 429 && i < retries) {
        const delay = (i + 1) * 2000;
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Mammogram Analysis ──
app.post('/api/analyze', upload.fields([
  { name: 'cc', maxCount: 1 },
  { name: 'mlo', maxCount: 1 }
]), async (req, res) => {
  try {
    const ccFile = req.files?.cc?.[0];
    const mloFile = req.files?.mlo?.[0];

    if (!ccFile || !mloFile) {
      return res.status(400).json({ error: 'Please upload both CC and MLO view images.' });
    }

    // gemini-2.5-flash: best multimodal model for image + text analysis
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const ccImage = {
      inlineData: {
        data: ccFile.buffer.toString('base64'),
        mimeType: ccFile.mimetype
      }
    };

    const mloImage = {
      inlineData: {
        data: mloFile.buffer.toString('base64'),
        mimeType: mloFile.mimetype
      }
    };

    const prompt = `You are an expert radiologist AI assistant specialized in mammogram analysis. You are analyzing two mammogram views of the same breast:

1. The first image is the CC (Cranio-Caudal) view - top-down view
2. The second image is the MLO (Medio-Lateral Oblique) view - angled side view

Analyze both images carefully. Look for:
- Tissue density patterns and BI-RADS density category
- Any masses, nodules, or architectural distortions
- Calcifications (microcalcifications or macrocalcifications)
- Asymmetric densities between views
- Skin thickening or retraction
- Lymph node abnormalities
- Overall breast composition

IMPORTANT: You MUST respond with ONLY valid JSON, no markdown, no code fences. Use this exact structure:
{
  "probability": <number between 0 and 100 representing cancer risk percentage>,
  "riskLevel": "<Low Risk | Moderate Risk | High Risk>",
  "prediction": "<Cancer Signal Detected | No Strong Cancer Signal>",
  "biradsDensity": "<A: Almost entirely fatty | B: Scattered fibroglandular | C: Heterogeneously dense | D: Extremely dense>",
  "selectedView": "<CC | MLO>",
  "analysisBasis": "<2-3 sentence explanation of the main findings>",
  "findings": [
    "<finding 1>",
    "<finding 2>",
    "<finding 3>"
  ],
  "areaOfConcern": {
    "description": "<description of the most concerning area, or 'No specific area of concern'>",
    "location": "<upper-outer | upper-inner | lower-outer | lower-inner | central | retroareolar | axillary | none>"
  },
  "recommendations": [
    "<recommendation 1>",
    "<recommendation 2>"
  ],
  "disclaimer": "This AI analysis is for educational and screening assistance only. It does NOT replace a professional medical diagnosis. Please consult a qualified healthcare provider."
}

Rules for probability scoring:
- 0-20%: Normal breast tissue, no suspicious findings
- 20-40%: Minor findings that likely benign, routine follow-up
- 40-60%: Indeterminate findings, additional imaging recommended
- 60-80%: Suspicious findings, biopsy may be recommended
- 80-100%: Highly suspicious findings, immediate medical attention

Be thorough but conservative. When in doubt, recommend follow-up rather than alarming the patient.`;

    const result = await withRetry(() => model.generateContent([prompt, ccImage, mloImage]));
    const responseText = result.response.text();

    // Parse the JSON response from Gemini
    let analysisResult;
    try {
      // Strip code fences if Gemini wraps it
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      analysisResult = {
        probability: 15,
        riskLevel: 'Low Risk',
        prediction: 'Analysis Inconclusive',
        biradsDensity: 'Unable to determine',
        selectedView: 'CC',
        analysisBasis: 'The AI was unable to produce a structured analysis. The images may not be standard mammograms or may be unclear.',
        findings: ['Unable to parse detailed findings from AI response'],
        areaOfConcern: { description: 'Unable to determine', location: 'none' },
        recommendations: ['Please consult a radiologist for proper interpretation', 'Ensure high-quality mammogram images are uploaded'],
        disclaimer: 'This AI analysis is for educational and screening assistance only. It does NOT replace a professional medical diagnosis.'
      };
    }

    res.json(analysisResult);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze images. Please try again.' });
  }
});

// ── Chatbot ──
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // gemini-2.5-flash: reliable model for chat
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `You are a compassionate and knowledgeable breast cancer awareness assistant called "BCA Care Bot". Your role is to:

1. Provide accurate, evidence-based information about breast cancer
2. Help users understand breast cancer types, symptoms, risk factors, and prevention
3. Encourage regular screening and early detection
4. Offer emotional support and encouragement
5. Direct users to seek professional medical advice for personal health concerns

IMPORTANT RULES:
- NEVER provide a diagnosis or interpret specific medical results
- NEVER recommend specific treatments or medications
- Always encourage consulting with healthcare professionals
- Be empathetic and supportive in tone
- Keep responses concise (2-4 paragraphs max)
- Use simple, accessible language
- If asked about the app, explain you help with breast cancer awareness and work alongside the AI mammogram analysis tool`;

    // Build chat history
    const chatHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I am the BCA Care Bot, a breast cancer awareness assistant. I will provide helpful, empathetic, and evidence-based information while always encouraging professional medical consultation. How can I help you today?' }] },
        ...chatHistory
      ]
    });

    const result = await withRetry(() => chat.sendMessage(message));
    const reply = result.response.text();

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get response. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`🩺 AI Breast Cancer Care server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});
